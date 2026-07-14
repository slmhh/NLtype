import { useState, useEffect } from "react";
import { Message, Select } from "@arco-design/web-react";
import { useAuth } from "../context/AuthContext";
import { api } from "../services/api";
import type { Role } from "../types/permissions";
import { ROLE_LABELS } from "../types/permissions";

interface UserItem {
  id: number;
  username: string;
  email: string;
  role: Role;
  createdAt: string;
}

const ROLE_OPTIONS: { value: Role; label: string }[] = [
  { value: "user", label: "普通用户" },
  { value: "admin", label: "管理员" },
  { value: "developer", label: "开发者" },
];

export default function AdminPage() {
  const { user, token, hasPermission } = useAuth();
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!hasPermission("users:view")) return;
    api<{ users: UserItem[] }>("/api/auth/users", { token })
      .then((res) => setUsers(res.users))
      .catch((e) => Message.error(e.message))
      .finally(() => setLoading(false));
  }, []);

  const handleRoleChange = async (targetId: number, newRole: Role) => {
    if (!hasPermission("roles:assign")) {
      Message.error("无权限修改角色");
      return;
    }
    try {
      await api(`/api/auth/users/${targetId}/role`, {
        method: "PATCH",
        body: { role: newRole },
        token,
      });
      setUsers((prev) => prev.map((u) => (u.id === targetId ? { ...u, role: newRole } : u)));
      Message.success("角色已更新");
    } catch (e: any) {
      Message.error(e.message);
    }
  };

  if (!hasPermission("admin:panel")) {
    return (
      <div className="flex flex-col items-center pt-20 px-4 select-none">
        <p className="text-[var(--text-tertiary)] text-sm tracking-wider">无权限访问管理面板</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center pt-16 px-4 pb-16 select-none">
      <div className="w-full max-w-2xl">
        <h2 className="text-center text-[var(--text-primary)] text-lg tracking-[0.15em] mb-6">管理面板</h2>

        <div className="bg-card rounded-2xl shadow-card overflow-hidden">
          <div className="grid grid-cols-[3rem_1fr_auto_auto] gap-0 text-xs tracking-wider uppercase text-[var(--text-tertiary)] px-5 py-3 border-b border-[var(--border)]">
            <span>#</span>
            <span>用户名</span>
            <span>角色</span>
            <span className="text-right">操作</span>
          </div>

          {loading ? (
            <div className="p-8 text-center text-[var(--text-tertiary)] text-sm">加载中...</div>
          ) : (
            users.map((u) => (
              <div key={u.id} className="grid grid-cols-[3rem_1fr_auto_auto] gap-0 text-sm px-5 py-3 border-b border-[var(--border)] last:border-b-0 hover:bg-[var(--bg-alt)] transition-colors items-center">
                <span className="text-[var(--text-tertiary)] font-mono">{u.id}</span>
                <div>
                  <span className="text-[var(--text-primary)] font-mono">{u.username}</span>
                  <span className="text-[var(--text-tertiary)] text-xs ml-2">{u.email}</span>
                </div>
                <span className={`text-xs font-mono px-2 py-0.5 rounded ${
                  u.role === "developer" ? "bg-yellow-500/10 text-yellow-500" :
                  u.role === "admin" ? "bg-blue-500/10 text-blue-500" :
                  "bg-gray-500/10 text-[var(--text-tertiary)]"
                }`}>
                  {ROLE_LABELS[u.role]}
                </span>
                <div className="text-right">
                  {hasPermission("roles:assign") && u.id !== user?.id ? (
                    <Select
                      size="mini"
                      value={u.role}
                      options={ROLE_OPTIONS}
                      onChange={(v) => handleRoleChange(u.id, v as Role)}
                      className="!w-24"
                    />
                  ) : (
                    <span className="text-[var(--text-tertiary)] text-xs">—</span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
