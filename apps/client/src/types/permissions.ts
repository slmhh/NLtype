export type Role = "guest" | "user" | "admin" | "developer";

export const ROLE_PERMISSIONS: Record<Role, string[]> = {
  guest: ["game:play", "leaderboard:view"],
  user: ["game:play", "leaderboard:view"],
  admin: ["game:play", "leaderboard:view", "leaderboard:clear", "users:view", "admin:panel", "users:manage"],
  developer: [
    "game:play", "leaderboard:view", "leaderboard:clear",
    "users:view", "admin:panel", "users:manage", "users:ban", "system:config", "roles:assign",
  ],
};

export function hasPermission(role: Role, permission: string): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export const ROLE_LABELS: Record<Role, string> = {
  guest: "未登录",
  user: "普通用户",
  admin: "管理员",
  developer: "开发者",
};
