import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "data");
const USERS_FILE = join(DATA_DIR, "users.json");

const SALT_ROUNDS = 12;
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-in-production";
const JWT_EXPIRY = "24h";

export type Role = "user" | "admin" | "developer";

const ROLE_HIERARCHY: Record<number, Role> = { 0: "user", 1: "admin", 2: "developer" };
const ROLE_LEVEL: Record<Role, number> = { user: 0, admin: 1, developer: 2 };

export const ROLE_PERMISSIONS: Record<Role, string[]> = {
  user: ["game:play", "leaderboard:view"],
  admin: ["game:play", "leaderboard:view", "leaderboard:clear", "users:view", "admin:panel", "users:manage"],
  developer: [
    "game:play", "leaderboard:view", "leaderboard:clear",
    "users:view", "admin:panel", "users:manage", "users:ban", "system:config", "roles:assign",
  ],
};

export interface User {
  id: number;
  username: string;
  email: string;
  passwordHash: string;
  role: Role;
  createdAt: string;
}

export interface UserPublic {
  id: number;
  username: string;
  email: string;
  role: Role;
  permissions: string[];
  createdAt: string;
}

function ensureDataDir() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

function loadUsers(): User[] {
  ensureDataDir();
  if (!existsSync(USERS_FILE)) {
    writeFileSync(USERS_FILE, "[]", "utf-8");
    return [];
  }
  try {
    return JSON.parse(readFileSync(USERS_FILE, "utf-8"));
  } catch {
    return [];
  }
}

function saveUsers(users: User[]) {
  ensureDataDir();
  writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), "utf-8");
}

let nextId = loadUsers().reduce((max, u) => Math.max(max, u.id), 0) + 1;

function toPublic(user: User): UserPublic {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    permissions: ROLE_PERMISSIONS[user.role],
    createdAt: user.createdAt,
  };
}

export function registerUser(username: string, email: string, password: string): UserPublic {
  const users = loadUsers();

  if (users.some((u) => u.username === username)) throw new Error("USERNAME_TAKEN");
  if (users.some((u) => u.email === email)) throw new Error("EMAIL_TAKEN");

  const role: Role = users.length === 0 ? "developer" : "user";
  const passwordHash = bcrypt.hashSync(password, SALT_ROUNDS);
  const user: User = { id: nextId++, username, email, passwordHash, role, createdAt: new Date().toISOString() };
  users.push(user);
  saveUsers(users);

  return toPublic(user);
}

export function loginUser(identifier: string, password: string): UserPublic {
  const users = loadUsers();
  const user = users.find((u) => u.username === identifier || u.email === identifier);
  if (!user) throw new Error("INVALID_CREDENTIALS");

  const valid = bcrypt.compareSync(password, user.passwordHash);
  if (!valid) throw new Error("INVALID_CREDENTIALS");

  return toPublic(user);
}

export function findUserById(id: number): UserPublic | null {
  const users = loadUsers();
  const user = users.find((u) => u.id === id);
  return user ? toPublic(user) : null;
}

export function findAllUsers(): UserPublic[] {
  return loadUsers().map(toPublic);
}

export function updateUserRole(targetId: number, newRole: Role): UserPublic | null {
  const users = loadUsers();
  const idx = users.findIndex((u) => u.id === targetId);
  if (idx === -1) return null;
  users[idx].role = newRole;
  saveUsers(users);
  return toPublic(users[idx]);
}

export function signToken(user: UserPublic): string {
  return jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: JWT_EXPIRY });
}

export function verifyToken(token: string): { id: number; username: string; role: Role } {
  return jwt.verify(token, JWT_SECRET) as { id: number; username: string; role: Role };
}

export function hasPermission(userRole: Role, permission: string): boolean {
  return ROLE_PERMISSIONS[userRole]?.includes(permission) ?? false;
}
