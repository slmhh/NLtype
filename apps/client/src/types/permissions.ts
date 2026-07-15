export type Role = "guest" | "user" | "admin" | "developer";

export const ROLE_PERMISSIONS: Record<Role, string[]> = {
  guest: ["game:play", "leaderboard:view"],
  user: ["game:play", "leaderboard:view"],
  admin: ["game:play", "leaderboard:view", "users:view", "admin:panel", "users:manage"],
  developer: [
    "game:play", "leaderboard:view",
    "users:view", "admin:panel", "users:manage", "users:ban", "system:config", "roles:assign",
  ],
};

export function hasPermission(role: Role, permission: string): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export const ROLE_LABELS: Record<Role, string> = {
  guest: "guest",
  user: "user",
  admin: "admin",
  developer: "developer",
};
