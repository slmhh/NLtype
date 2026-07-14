import type { FastifyInstance } from "fastify";
import { verifyToken, hasPermission } from "../auth/db.js";
import type { Role } from "../auth/db.js";
import { createResult, getResultsByUser, getLeaderboard, clearAllResults } from "./db.js";

function getAuthUser(req: any): { id: number; username: string; role: Role } | null {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith("Bearer ")) return null;
  try { const p = verifyToken(auth.slice(7)); return { ...p, role: p.role as Role }; } catch { return null; }
}

interface ResultBody {
  mode: string; language?: string; wpm: number; accuracy: number;
  cpm?: number; rawWpm?: number; correctCount?: number; incorrectCount?: number; durationSec?: number;
}

export function registerResultRoutes(server: FastifyInstance) {
  // Save a result
  server.post<{ Body: ResultBody }>("/api/results", async (req, reply) => {
    const payload = getAuthUser(req);
    if (!payload) return reply.status(401).send({ error: "Authentication required" });

    const { mode, language, wpm, accuracy, cpm, rawWpm, correctCount, incorrectCount, durationSec } = req.body;
    if (!mode || wpm == null || accuracy == null) {
      return reply.status(400).send({ error: "Missing required fields (mode, wpm, accuracy)" });
    }

    const result = createResult({
      userId: payload.id,
      username: payload.username,
      mode,
      language: language || "en",
      wpm: Math.round(wpm),
      accuracy: Math.round(accuracy),
      cpm: Math.round(cpm || 0),
      rawWpm: Math.round(rawWpm || 0),
      correctCount: correctCount || 0,
      incorrectCount: incorrectCount || 0,
      durationSec: durationSec || 0,
    });

    return reply.status(201).send({ result });
  });

  // Get current user's results
  server.get("/api/results", async (req, reply) => {
    const payload = getAuthUser(req);
    if (!payload) return reply.status(401).send({ error: "Authentication required" });

    const results = getResultsByUser(payload.id);
    return reply.send({ results });
  });

  // Global leaderboard (public)
  server.get("/api/results/leaderboard", async (req, reply) => {
    const limit = Number((req.query as any)?.limit) || 20;
    const entries = getLeaderboard(limit);
    return reply.send({ entries });
  });

  // Clear all results (admin+)
  server.delete("/api/results", async (req, reply) => {
    const payload = getAuthUser(req);
    if (!payload || !hasPermission(payload.role, "leaderboard:clear"))
      return reply.status(403).send({ error: "Insufficient permissions" });

    clearAllResults();
    return reply.send({ ok: true });
  });
}
