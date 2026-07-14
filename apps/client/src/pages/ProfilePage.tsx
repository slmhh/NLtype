import { useMemo, useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { getResults } from "../services/results";
import type { GameResult } from "../types/results";
import { ROLE_LABELS } from "../types/permissions";

const MODE_LABEL: Record<string, string> = { time: "计时", words: "单词", quote: "引用", code: "代码", zen: "禅" };
const LANG_LABEL: Record<string, string> = { en: "EN", zh: "ZH", code: "Code" };

export default function ProfilePage() {
  const { user, token } = useAuth();
  const [results, setResults] = useState<GameResult[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    getResults(token).then((r) => { setResults(r); setLoading(false); });
  }, [user, token]);

  const stats = useMemo(() => {
    if (results.length === 0) return null;
    const total = results.length;
    const wpmValues = results.map((r) => r.wpm);
    const avgWpm = Math.round(wpmValues.reduce((a, b) => a + b, 0) / total);
    const bestWpm = Math.max(...wpmValues);
    const totalTime = Math.round(results.reduce((s, r) => s + r.durationSec, 0));
    const avgAcc = Math.round(results.reduce((s, r) => s + r.accuracy, 0) / total);
    return { total, avgWpm, bestWpm, totalTime, avgAcc };
  }, [results]);

  const recent = useMemo(() => results.slice(0, 20), [results]);

  if (!user) {
    return (
      <div className="flex flex-col items-center pt-20 px-4 select-none">
        <p className="text-[var(--text-tertiary)] text-sm tracking-wider">请先登录</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center pt-20 px-4 select-none">
        <p className="text-[var(--text-tertiary)] text-sm tracking-wider">加载中...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center pt-16 px-4 pb-16 select-none">
      <div className="w-full max-w-2xl space-y-6">
        {/* User info card */}
        <div className="bg-card rounded-2xl shadow-card p-8">
          <div className="flex items-center gap-4 mb-4">
            <span className="w-14 h-14 flex items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent)] text-xl font-mono font-bold">
              {user.username[0].toUpperCase()}
            </span>
            <div>
              <h2 className="text-[var(--text-primary)] text-lg font-mono font-semibold">{user.username}</h2>
              <p className="text-[var(--text-tertiary)] text-xs mt-0.5">{user.email}</p>
            </div>
            <span className={`ml-auto text-xs font-mono px-2.5 py-1 rounded ${
              user.role === "developer" ? "bg-yellow-500/10 text-yellow-500" :
              user.role === "admin" ? "bg-blue-500/10 text-blue-500" :
              "bg-gray-500/10 text-[var(--text-tertiary)]"
            }`}>
              {ROLE_LABELS[user.role]}
            </span>
          </div>
          <p className="text-[var(--text-tertiary)] text-xs tracking-wider">
            注册时间 · {new Date(user.createdAt).toLocaleDateString("zh-CN")}
          </p>
        </div>

        {/* Stats card */}
        <div className="bg-card rounded-2xl shadow-card p-8">
          <h3 className="text-[var(--text-primary)] text-sm tracking-[0.15em] mb-5">游戏统计</h3>
          {stats ? (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
              {[
                { label: "总场次", value: stats.total },
                { label: "平均 WPM", value: stats.avgWpm },
                { label: "最高 WPM", value: stats.bestWpm },
                { label: "平均准确率", value: `${stats.avgAcc}%` },
                { label: "总时长", value: `${Math.floor(stats.totalTime / 60)}m` },
              ].map((s) => (
                <div key={s.label} className="text-center">
                  <div className="text-2xl font-bold font-mono text-[var(--text-primary)] tabular-nums">{s.value}</div>
                  <div className="text-[var(--text-tertiary)] text-xs tracking-wider mt-1">{s.label}</div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[var(--text-tertiary)] text-sm text-center py-4 tracking-wider">暂无数据</p>
          )}
        </div>

        {/* History */}
        <div className="bg-card rounded-2xl shadow-card p-8">
          <h3 className="text-[var(--text-primary)] text-sm tracking-[0.15em] mb-5">最近成绩</h3>
          {recent.length > 0 ? (
            <div>
              <div className="grid grid-cols-[auto_auto_auto_auto_auto] gap-0 text-xs tracking-wider uppercase text-[var(--text-tertiary)] px-2 pb-3 border-b border-[var(--border)]">
                <span className="w-20">日期</span>
                <span className="w-12 text-right">WPM</span>
                <span className="w-14 text-right">准确率</span>
                <span className="w-12 text-right">模式</span>
                <span className="w-12 text-right">语言</span>
              </div>
              {recent.map((r) => (
                <div
                  key={r.id}
                  className="grid grid-cols-[auto_auto_auto_auto_auto] gap-0 text-sm px-2 py-2.5 border-b border-[var(--border)] last:border-b-0 hover:bg-[var(--bg-alt)] transition-colors"
                >
                  <span className="w-20 text-[var(--text-tertiary)] text-xs font-mono">{new Date(r.createdAt).toLocaleDateString("zh-CN")}</span>
                  <span className="w-12 text-right text-[var(--text-primary)] font-mono font-semibold tabular-nums">{r.wpm}</span>
                  <span className="w-14 text-right text-[var(--text-secondary)] font-mono tabular-nums">{r.accuracy}%</span>
                  <span className="w-12 text-right text-[var(--text-tertiary)] text-xs">{MODE_LABEL[r.mode] ?? r.mode}</span>
                  <span className="w-12 text-right text-[var(--text-tertiary)] text-xs">{LANG_LABEL[r.language] ?? r.language}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[var(--text-tertiary)] text-sm text-center py-4 tracking-wider">暂无记录</p>
          )}
        </div>
      </div>
    </div>
  );
}
