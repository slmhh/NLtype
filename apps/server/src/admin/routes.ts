import type { FastifyInstance } from "fastify";
import { verifyToken, hasPermission } from "../auth/db.js";
import type { Role } from "../auth/db.js";
import { getStats } from "./db.js";

function getAuthUser(req: any): { id: number; username: string; role: Role } | null {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith("Bearer ")) return null;
  try { const p = verifyToken(auth.slice(7)); return { ...p, role: p.role as Role }; } catch { return null; }
}

export function registerAdminRoutes(server: FastifyInstance) {
  server.get("/api/admin/stats", async (req, reply) => {
    const payload = getAuthUser(req);
    if (!payload || !hasPermission(payload.role, "admin:panel"))
      return reply.status(403).send({ error: "Insufficient permissions" });

    return reply.send({ stats: getStats() });
  });
}
