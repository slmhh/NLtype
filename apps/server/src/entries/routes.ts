import type { FastifyInstance } from "fastify";
import { verifyToken, hasPermission } from "../auth/db.js";
import type { Role } from "../auth/db.js";
import { createEntry, getEntries, getApprovedByLanguage, reviewEntry } from "./db.js";
import type { EntryLanguage, EntryStatus } from "./db.js";

function getAuthUser(req: any): { id: number; username: string; role: Role } | null {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith("Bearer ")) return null;
  try { const p = verifyToken(auth.slice(7)); return { ...p, role: p.role as Role }; } catch { return null; }
}

const MAX_CONTENT_LENGTH = 10000;
const MAX_SUBMISSIONS_PER_HOUR = 20;
const submitCounts = new Map<number, { count: number; resetAt: number }>();

function checkRateLimit(userId: number): boolean {
  const now = Date.now();
  const record = submitCounts.get(userId);
  if (!record || now > record.resetAt) {
    submitCounts.set(userId, { count: 1, resetAt: now + 3600000 });
    return true;
  }
  if (record.count >= MAX_SUBMISSIONS_PER_HOUR) return false;
  record.count++;
  return true;
}

function sanitizeContent(text: string): string {
  return text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "").trim();
}

export function registerEntryRoutes(server: FastifyInstance) {
  // Submit a new entry
  server.post<{ Body: { language: string; content: string } }>("/api/entries", async (req, reply) => {
    const payload = getAuthUser(req);
    if (!payload) return reply.status(401).send({ error: "Authentication required" });

    const { language, content } = req.body;
    if (!language || !content) return reply.status(400).send({ error: "Missing language or content" });

    const validLangs: EntryLanguage[] = ["en", "zh", "code"];
    if (!validLangs.includes(language as EntryLanguage))
      return reply.status(400).send({ error: "Invalid language" });

    const sanitized = sanitizeContent(content);
    if (sanitized.length < 10) return reply.status(400).send({ error: "Content too short (min 10 chars)" });
    if (sanitized.length > MAX_CONTENT_LENGTH)
      return reply.status(400).send({ error: `Content too long (max ${MAX_CONTENT_LENGTH} chars)` });

    if (!checkRateLimit(payload.id))
      return reply.status(429).send({ error: "Too many submissions (max 20/hour)" });

    const autoApprove = payload.role === "developer";
    const entry = createEntry(payload.id, payload.username, language as EntryLanguage, sanitized, autoApprove);

    return reply.status(201).send({ entry });
  });

  // List entries
  server.get("/api/entries", async (req, reply) => {
    const payload = getAuthUser(req);
    if (!payload) return reply.status(401).send({ error: "Authentication required" });

    const query = req.query as any;
    const isAdmin = payload.role === "admin" || payload.role === "developer";

    const entries = getEntries({
      userId: isAdmin && query.userId ? Number(query.userId) : payload.id,
      status: query.status as EntryStatus || undefined,
      language: query.language as EntryLanguage || undefined,
    });

    // Non-admin users only see their own entries
    if (!isAdmin) return reply.send({ entries: entries.filter((e) => e.userId === payload.id) });

    return reply.send({ entries });
  });

  // Get approved entries for game (public)
  server.get("/api/entries/approved", async (req, reply) => {
    const query = req.query as any;
    const language = (query.language as EntryLanguage) || "en";
    const entries = getApprovedByLanguage(language, Number(query.limit) || 50);
    return reply.send({ entries });
  });

  // Review an entry (admin+)
  server.patch<{ Params: { id: string }; Body: { status: "approved" | "rejected" } }>(
    "/api/entries/:id/review", async (req, reply) => {
      const payload = getAuthUser(req);
      if (!payload || !hasPermission(payload.role, "admin:panel"))
        return reply.status(403).send({ error: "Insufficient permissions" });

      const entryId = Number(req.params.id);
      if (isNaN(entryId)) return reply.status(400).send({ error: "Invalid entry ID" });

      if (!["approved", "rejected"].includes(req.body.status))
        return reply.status(400).send({ error: "Status must be 'approved' or 'rejected'" });

      const entry = reviewEntry(entryId, req.body.status, payload.id);
      if (!entry) return reply.status(404).send({ error: "Entry not found" });

      return reply.send({ entry });
    },
  );
}
