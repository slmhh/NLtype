import { useState, useEffect } from "react";
import { Message, Select, Modal, Input } from "@arco-design/web-react";
import { useAuth } from "../context/AuthContext";
import { api } from "../services/api";
import { getResults } from "../services/results";
import type { Role } from "../types/permissions";
import { ROLE_LABELS } from "../types/permissions";

interface UserItem {
  id: number;
  username: string;
  email: string;
  role: Role;
  createdAt: string;
}

interface Stats {
  totalUsers: number;
  totalResults: number;
  resultsByMode: Record<string, number>;
  resultsByLang: Record<string, number>;
  topWpm: number;
  avgWpm: number;
}

const ROLE_OPTIONS: { value: Role; label: string }[] = [
  { value: "user", label: "普通用户" },
  { value: "admin", label: "管理员" },
  { value: "developer", label: "开发者" },
];

export default function DeveloperPage() {
  const { user, token, hasPermission } = useAuth();
  const [users, setUsers] = useState<UserItem[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"users" | "system">("users");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!hasPermission("users:view")) { setLoading(false); return; }
    Promise.all([
      api<{ users: UserItem[] }>("/api/auth/users", { token }).then((d) => setUsers(d.users)),
      api<{ stats: Stats }>("/api/admin/stats", { token }).then((d) => setStats(d.stats)),
    ]).catch((e) => Message.error(e.message)).finally(() => setLoading(false));
  }, []);

  const handleRoleChange = async (targetId: number, newRole: Role) => {
    try {
      await api(`/api/auth/users/${targetId}/role`, {
        method: "PATCH", body: { role: newRole }, token,
      });
      setUsers((prev) => prev.map((u) => (u.id === targetId ? { ...u, role: newRole } : u)));
      Message.success(`角色已更新为 ${ROLE_LABELS[newRole]}`);
    } catch (e: any) {
      Message.error(e.message);
    }
  };

  if (!hasPermission("admin:panel")) {
    return (
      <div className="flex flex-col items-center pt-20 px-4 select-none">
        <p className="text-[var(--text-tertiary)] text-sm tracking-wider">无权限访问</p>
      </div>
    );
  }

  const filtered = users.filter(
    (u) => u.username.includes(search) || u.email.includes(search),
  );

  const tabs = [
    { key: "users" as const, label: "用户管理" },
    { key: "system" as const, label: "系统信息" },
  ];

  return (
    <div className="flex flex-col items-center pt-16 px-4 pb-16 select-none">
      <div className="w-full max-w-3xl">
        <h2 className="text-center text-[var(--text-primary)] text-lg tracking-[0.15em] mb-6">
          <span className="bg-yellow-500/10 text-yellow-500 text-xs px-2 py-0.5 rounded mr-2 align-middle">DEV</span>
          开发者面板
        </h2>

        {/* Tabs */}
        <div className="flex mb-6 border-b border-[var(--border)]">
          {tabs.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex-1 pb-3 text-sm tracking-[0.15em] transition-colors font-mono ${
                tab === t.key ? "text-[var(--accent)] border-b-2 border-[var(--accent)]" : "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
              }`}>
              {t.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="bg-card rounded-2xl shadow-card p-8 text-center text-[var(--text-tertiary)] text-sm">加载中...</div>
        ) : tab === "users" ? (
          <>
            {/* Search */}
            <div className="mb-4">
              <Input.Search
                placeholder="搜索用户名或邮箱..."
                value={search}
                onChange={setSearch}
                className="!rounded-xl"
              />
            </div>

            <div className="bg-card rounded-2xl shadow-card overflow-hidden">
              <div className="grid grid-cols-[3rem_3fr_auto_auto] gap-0 text-xs tracking-wider uppercase text-[var(--text-tertiary)] px-5 py-3 border-b border-[var(--border)]">
                <span>#</span>
                <span>用户名 / 邮箱</span>
                <span>角色</span>
                <span className="text-right">操作</span>
              </div>
              {filtered.map((u) => (
                <div key={u.id} className="grid grid-cols-[3rem_3fr_auto_auto] gap-0 text-sm px-5 py-3 border-b border-[var(--border)] last:border-b-0 hover:bg-[var(--bg-alt)] transition-colors items-center">
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
                    {u.id !== user?.id ? (
                      hasPermission("roles:assign") ? (
                        <Select
                          size="mini"
                          value={u.role}
                          options={ROLE_OPTIONS}
                          onChange={(v) => handleRoleChange(u.id, v as Role)}
                          className="!w-24"
                        />
                      ) : (
                        <span className="text-[var(--text-tertiary)] text-xs">—</span>
                      )
                    ) : (
                      <span className="text-[var(--text-tertiary)] text-xs">当前用户</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          /* System tab */
          <div className="space-y-4">
            {stats && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: "用户总数", value: stats.totalUsers },
                  { label: "游戏场次", value: stats.totalResults },
                  { label: "最高 WPM", value: stats.topWpm },
                  { label: "平均 WPM", value: stats.avgWpm },
                ].map((s) => (
                  <div key={s.label} className="bg-card rounded-2xl shadow-card p-5 text-center">
                    <div className="text-3xl font-bold font-mono text-[var(--accent)] tabular-nums">{s.value}</div>
                    <div className="text-[var(--text-tertiary)] text-xs tracking-wider mt-1">{s.label}</div>
                  </div>
                ))}
              </div>
            )}

            <div className="bg-card rounded-2xl shadow-card p-6">
              <h4 className="text-[var(--text-primary)] text-sm tracking-[0.15em] mb-4">服务器信息</h4>
              <div className="space-y-2 text-sm">
                {[
                  { label: "API 地址", value: "http://localhost:3001" },
                  { label: "用户存储", value: "apps/server/data/users.json" },
                  { label: "成绩存储", value: "apps/server/data/results.json" },
                  { label: "认证方式", value: "JWT (24h) + bcryptjs (12轮)" },
                  { label: "CORS 来源", value: "http://localhost:5173" },
                ].map((s) => (
                  <div key={s.label} className="flex items-center gap-2">
                    <span className="text-[var(--text-tertiary)] text-xs tracking-wider w-24">{s.label}</span>
                    <code className="text-[var(--text-secondary)] text-xs font-mono bg-[var(--bg-alt)] px-2 py-0.5 rounded">{s.value}</code>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-card rounded-2xl shadow-card p-6">
              <h4 className="text-[var(--text-primary)] text-sm tracking-[0.15em] mb-4">模式分布</h4>
              {stats && (
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {Object.entries(stats.resultsByMode).map(([k, v]) => (
                    <div key={k} className="flex justify-between px-2 py-1">
                      <span className="text-[var(--text-secondary)] font-mono">{k}</span>
                      <span className="text-[var(--text-primary)] font-mono">{v}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
