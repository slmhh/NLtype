import { useState, useEffect } from "react";
import { Message, Statistic, Card } from "@arco-design/web-react";
import { useAuth } from "../context/AuthContext";
import { api } from "../services/api";
import { getLeaderboard, clearResults } from "../services/results";
import type { Role } from "../types/permissions";
import { ROLE_LABELS } from "../types/permissions";
import PermissionGuard from "../components/PermissionGuard";

interface Stats {
  totalUsers: number;
  totalResults: number;
  resultsByMode: Record<string, number>;
  resultsByLang: Record<string, number>;
  topWpm: number;
  avgWpm: number;
}

interface UserItem {
  id: number;
  username: string;
  email: string;
  role: Role;
  createdAt: string;
}

const MODE_LABEL: Record<string, string> = { time: "计时", words: "单词", quote: "引用", code: "代码", zen: "禅" };
const LANG_LABEL: Record<string, string> = { en: "EN", zh: "ZH", code: "Code" };

export default function AdminPage() {
  const { token, hasPermission } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"dashboard" | "users">("dashboard");

  useEffect(() => {
    if (!hasPermission("admin:panel")) { setLoading(false); return; }
    Promise.all([
      api<{ stats: Stats }>("/api/admin/stats", { token }).then((d) => setStats(d.stats)),
      hasPermission("users:view")
        ? api<{ users: UserItem[] }>("/api/auth/users", { token }).then((d) => setUsers(d.users))
        : Promise.resolve(),
    ]).catch((e) => Message.error(e.message)).finally(() => setLoading(false));
  }, []);

  const handleClearLeaderboard = async () => {
    if (!confirm("确定清空所有成绩记录？")) return;
    await clearResults(token);
    Message.success("已清空");
  };

  if (!hasPermission("admin:panel")) {
    return (
      <div className="flex flex-col items-center pt-20 px-4 select-none">
        <p className="text-[var(--text-tertiary)] text-sm tracking-wider">无权限访问</p>
      </div>
    );
  }

  const tabs = [
    { key: "dashboard" as const, label: "概览" },
    { key: "users" as const, label: "用户管理" },
  ];

  return (
    <div className="flex flex-col items-center pt-16 px-4 pb-16 select-none">
      <div className="w-full max-w-2xl">
        <h2 className="text-center text-[var(--text-primary)] text-lg tracking-[0.15em] mb-6">管理面板</h2>

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
        ) : tab === "dashboard" && stats ? (
          <>
            {/* Stats grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              {[
                { title: "用户总数", value: stats.totalUsers, color: "var(--accent)" },
                { title: "游戏场次", value: stats.totalResults, color: "var(--accent)" },
                { title: "最高 WPM", value: stats.topWpm, color: "var(--accent)" },
                { title: "平均 WPM", value: stats.avgWpm, color: "var(--accent)" },
              ].map((s) => (
                <Card key={s.title} className="!bg-card !rounded-2xl !border-[var(--border)] text-center">
                  <div className="text-3xl font-bold font-mono tabular-nums" style={{ color: s.color }}>{s.value}</div>
                  <div className="text-[var(--text-tertiary)] text-xs tracking-wider mt-1">{s.title}</div>
                </Card>
              ))}
            </div>

            {/* Mode / Lang distribution */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <Card className="!bg-card !rounded-2xl !border-[var(--border)]">
                <h4 className="text-[var(--text-tertiary)] text-xs tracking-wider mb-3">模式分布</h4>
                {Object.entries(stats.resultsByMode).map(([k, v]) => (
                  <div key={k} className="flex justify-between text-sm py-1">
                    <span className="text-[var(--text-secondary)] font-mono">{MODE_LABEL[k] ?? k}</span>
                    <span className="text-[var(--text-primary)] font-mono">{v}</span>
                  </div>
                ))}
              </Card>
              <Card className="!bg-card !rounded-2xl !border-[var(--border)]">
                <h4 className="text-[var(--text-tertiary)] text-xs tracking-wider mb-3">语言分布</h4>
                {Object.entries(stats.resultsByLang).map(([k, v]) => (
                  <div key={k} className="flex justify-between text-sm py-1">
                    <span className="text-[var(--text-secondary)] font-mono">{LANG_LABEL[k] ?? k}</span>
                    <span className="text-[var(--text-primary)] font-mono">{v}</span>
                  </div>
                ))}
              </Card>
            </div>

            <PermissionGuard permission="leaderboard:clear">
              <button onClick={handleClearLeaderboard}
                className="w-full py-2 rounded-xl text-xs tracking-[0.15em] border border-[var(--border)] text-[var(--text-tertiary)] hover:text-[var(--accent-red)] hover:border-[var(--accent-red)] transition-all">
                清空所有成绩
              </button>
            </PermissionGuard>
          </>
        ) : tab === "users" ? (
          <div className="bg-card rounded-2xl shadow-card overflow-hidden">
            <div className="grid grid-cols-[3rem_1fr_auto_auto] gap-0 text-xs tracking-wider uppercase text-[var(--text-tertiary)] px-5 py-3 border-b border-[var(--border)]">
              <span>#</span>
              <span>用户名</span>
              <span>角色</span>
              <span className="text-right">注册时间</span>
            </div>
            {users.length === 0 ? (
              <div className="p-8 text-center text-[var(--text-tertiary)] text-sm">暂无用户</div>
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
                  <span className="text-[var(--text-tertiary)] text-xs text-right font-mono">
                    {new Date(u.createdAt).toLocaleDateString("zh-CN")}
                  </span>
                </div>
              ))
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
