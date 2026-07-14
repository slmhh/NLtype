import type { FastifyInstance } from "fastify";
import {
  registerUser, loginUser, findUserById, findAllUsers,
  signToken, verifyToken, updateUserRole, hasPermission,
} from "./db.js";
import type { Role } from "./db.js";

interface AuthRequest { username?: string; email?: string; password: string }

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;

function validateRegister(body: AuthRequest): string | null {
  if (!body.username || !body.email || !body.password) return "Missing fields";
  if (!USERNAME_RE.test(body.username)) return "Username must be 3-20 alphanumeric characters";
  if (!EMAIL_RE.test(body.email)) return "Invalid email";
  if (body.password.length < 8) return "Password must be at least 8 characters";
  return null;
}

function validateLogin(body: { identifier?: string; password?: string }): string | null {
  if (!body.identifier || !body.password) return "Missing fields";
  return null;
}

function getAuthUser(req: any): { id: number; username: string; role: Role } | null {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith("Bearer ")) return null;
  try { return verifyToken(auth.slice(7)); } catch { return null; }
}

export function registerAuthRoutes(server: FastifyInstance) {
  // ── Register ──
  server.post<{ Body: AuthRequest }>("/api/auth/register", async (req, reply) => {
    const err = validateRegister(req.body);
    if (err) return reply.status(400).send({ error: err });

    try {
      const user = registerUser(req.body.username!, req.body.email!, req.body.password);
      const token = signToken(user);
      return reply.status(201).send({ user, token });
    } catch (e: any) {
      if (e.message === "USERNAME_TAKEN") return reply.status(409).send({ error: "Username already taken" });
      if (e.message === "EMAIL_TAKEN") return reply.status(409).send({ error: "Email already taken" });
      throw e;
    }
  });

  // ── Login ──
  server.post<{ Body: { identifier: string; password: string } }>("/api/auth/login", async (req, reply) => {
    const err = validateLogin(req.body);
    if (err) return reply.status(400).send({ error: err });

    try {
      const user = loginUser(req.body.identifier, req.body.password);
      const token = signToken(user);
      return reply.send({ user, token });
    } catch (e: any) {
      if (e.message === "INVALID_CREDENTIALS") return reply.status(401).send({ error: "Invalid username/email or password" });
      throw e;
    }
  });

  // ── Me ──
  server.get("/api/auth/me", async (req, reply) => {
    const payload = getAuthUser(req);
    if (!payload) return reply.status(401).send({ error: "Missing or invalid token" });

    const user = findUserById(payload.id);
    if (!user) return reply.status(404).send({ error: "User not found" });
    return reply.send({ user });
  });

  // ── List users (admin+) ──
  server.get("/api/auth/users", async (req, reply) => {
    const payload = getAuthUser(req);
    if (!payload || !hasPermission(payload.role, "users:view"))
      return reply.status(403).send({ error: "Insufficient permissions" });

    const users = findAllUsers();
    return reply.send({ users });
  });

  // ── Update user role (developer+ or self-promote guard) ──
  server.patch<{ Params: { id: string }; Body: { role: Role } }>("/api/auth/users/:id/role", async (req, reply) => {
    const payload = getAuthUser(req);
    if (!payload || !hasPermission(payload.role, "roles:assign"))
      return reply.status(403).send({ error: "Insufficient permissions" });

    const targetId = Number(req.params.id);
    if (isNaN(targetId)) return reply.status(400).send({ error: "Invalid user ID" });

    const validRoles: Role[] = ["user", "admin", "developer"];
    if (!validRoles.includes(req.body.role))
      return reply.status(400).send({ error: "Invalid role" });

    const updated = updateUserRole(targetId, req.body.role);
    if (!updated) return reply.status(404).send({ error: "User not found" });

    return reply.send({ user: updated });
  });
}
