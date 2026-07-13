import { useState } from "react";
import { getLeaderboard, clearResults } from "../services/results";
import type { LeaderboardEntry } from "../types/results";
import { NavLink } from "react-router-dom";

export default function LeaderboardPage() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>(() => getLeaderboard(50));

  return (
    <div className="flex flex-col items-center pt-20 px-4 pb-16 select-none">
      <div className="w-full max-w-xl">
        <h2 className="text-center text-[var(--text-primary)] text-lg tracking-[0.15em] mb-6">排行榜</h2>

        {entries.length === 0 ? (
          <div className="bg-card rounded-2xl shadow-card p-8 text-center">
            <p className="text-[var(--text-tertiary)] text-sm tracking-wider mb-4">
              暂无记录
            </p>
            <NavLink to="/" className="text-[var(--accent)] text-xs tracking-[0.15em] hover:underline">
              ← 开始一局
            </NavLink>
          </div>
        ) : (
          <>
            {/* Table */}
            <div className="bg-card rounded-2xl shadow-card overflow-hidden mb-4">
              <div className="grid grid-cols-[3rem_1fr_auto_auto_auto] gap-0 text-xs tracking-wider uppercase text-[var(--text-tertiary)] px-5 py-3 border-b border-[var(--border)]">
                <span>#</span>
                <span>wpm</span>
                <span className="text-right">acc</span>
                <span className="text-right">mode</span>
                <span className="text-right">lang</span>
              </div>
              {entries.map((e) => (
                <div
                  key={e.rank + e.wpm + e.date}
                  className="grid grid-cols-[3rem_1fr_auto_auto_auto] gap-0 text-sm px-5 py-3 border-b border-[var(--border)] last:border-b-0 hover:bg-[var(--bg-alt)] transition-colors"
                >
                  <span className="text-[var(--text-tertiary)] font-mono">{e.rank}</span>
                  <span className="text-[var(--text-primary)] font-mono font-semibold tabular-nums">{e.wpm}</span>
                  <span className="text-[var(--text-secondary)] font-mono text-right tabular-nums">{e.accuracy}%</span>
                  <span className="text-[var(--text-tertiary)] text-xs text-right">{e.modeLabel}</span>
                  <span className="text-[var(--text-tertiary)] text-xs text-right">{e.langLabel}</span>
                </div>
              ))}
            </div>

            {/* Clear button */}
            <div className="flex justify-end gap-3">
              <button
                onClick={() => { clearResults(); setEntries([]); }}
                className="text-[var(--text-tertiary)] text-xs tracking-[0.15em] hover:text-[var(--accent-red)] transition-colors"
              >
                清空记录
              </button>
              <NavLink to="/" className="text-[var(--accent)] text-xs tracking-[0.15em] hover:underline">
                ← 返回游戏
              </NavLink>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
