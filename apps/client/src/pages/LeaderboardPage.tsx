import { useState, useEffect } from "react";
import { getLeaderboard, clearResults } from "../services/results";
import type { LeaderboardEntry } from "../types/results";
import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useI18n } from "../context/I18nContext";
import PermissionGuard from "../components/PermissionGuard";

export default function LeaderboardPage() {
  const { token } = useAuth();
  const { t } = useI18n();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [after, setAfter] = useState("");
  const [before, setBefore] = useState("");

  useEffect(() => {
    setLoading(true);
    getLeaderboard(50, token, after || undefined, before || undefined)
      .then(setEntries)
      .finally(() => setLoading(false));
  }, [token, after, before]);

  const handleClear = async () => {
    if (!confirm(t("leaderboard.confirmClear"))) return;
    await clearResults(token);
    setEntries([]);
  };

  return (
    <div className="flex flex-col items-center pt-20 px-4 pb-16 select-none">
      <div className="w-full max-w-xl">
        <h2 className="text-center text-[var(--text-primary)] text-lg tracking-[0.15em] mb-6">{t("leaderboard.title")}</h2>

        {/* Date filters */}
        <div className="bg-card rounded-2xl shadow-card p-4 mb-4 flex items-center gap-3 flex-wrap">
          <span className="text-[var(--text-tertiary)] text-xs tracking-wider">{t("leaderboard.filterTitle")}</span>
          <input
            type="date"
            value={after}
            onChange={(e) => setAfter(e.target.value)}
            className="bg-[var(--bg-alt)] border border-[var(--border)] rounded-lg px-3 py-1.5 text-xs text-[var(--text-primary)] font-mono focus:outline-none focus:border-[var(--accent)] transition-colors"
            placeholder={t("leaderboard.filterAfter")}
          />
          <span className="text-[var(--text-tertiary)] text-xs">—</span>
          <input
            type="date"
            value={before}
            onChange={(e) => setBefore(e.target.value)}
            className="bg-[var(--bg-alt)] border border-[var(--border)] rounded-lg px-3 py-1.5 text-xs text-[var(--text-primary)] font-mono focus:outline-none focus:border-[var(--accent)] transition-colors"
            placeholder={t("leaderboard.filterBefore")}
          />
          {(after || before) && (
            <button
              onClick={() => { setAfter(""); setBefore(""); }}
              className="text-[var(--text-tertiary)] text-xs tracking-wider hover:text-[var(--accent)] transition-colors ml-auto"
            >
              {t("leaderboard.filterClear")}
            </button>
          )}
        </div>

        {loading ? (
          <div className="bg-card rounded-2xl shadow-card p-8 text-center">
            <p className="text-[var(--text-tertiary)] text-sm tracking-wider">{t("leaderboard.loading")}</p>
          </div>
        ) : entries.length === 0 ? (
          <div className="bg-card rounded-2xl shadow-card p-8 text-center">
            <p className="text-[var(--text-tertiary)] text-sm tracking-wider mb-4">{t("leaderboard.empty")}</p>
            <NavLink to="/" className="text-[var(--accent)] text-xs tracking-[0.15em] hover:underline">
              {t("leaderboard.startGame")}
            </NavLink>
          </div>
        ) : (
          <>
            <div className="bg-card rounded-2xl shadow-card overflow-hidden mb-4">
              <div className="grid grid-cols-[3rem_1fr_auto_auto_auto] gap-0 text-xs tracking-wider uppercase text-[var(--text-tertiary)] px-5 py-3 border-b border-[var(--border)]">
                <span>{t("leaderboard.colHash")}</span>
                <span>{t("leaderboard.colUser")}</span>
                <span className="text-right">{t("leaderboard.colWpm")}</span>
                <span className="text-right">{t("leaderboard.colAcc")}</span>
                <span className="text-right">{t("leaderboard.colMode")}</span>
              </div>
              {entries.map((e) => (
                <div
                  key={e.rank + e.wpm}
                  className="grid grid-cols-[3rem_1fr_auto_auto_auto] gap-0 text-sm px-5 py-3 border-b border-[var(--border)] last:border-b-0 hover:bg-[var(--bg-alt)] transition-colors"
                >
                  <span className="text-[var(--text-tertiary)] font-mono">{e.rank}</span>
                  <span className="text-[var(--text-primary)] font-mono">{e.username || "—"}</span>
                  <span className="text-[var(--text-primary)] font-mono font-semibold text-right tabular-nums">{e.wpm}</span>
                  <span className="text-[var(--text-secondary)] font-mono text-right tabular-nums">{e.accuracy}%</span>
                  <span className="text-[var(--text-tertiary)] text-xs text-right">{e.modeLabel}</span>
                </div>
              ))}
            </div>

            <div className="flex justify-between items-center gap-3">
              <PermissionGuard permission="admin:panel">
                <button onClick={handleClear}
                  className="text-[var(--text-tertiary)] text-xs tracking-[0.15em] hover:text-[var(--accent-red)] transition-colors"
                >
                  {t("leaderboard.clear")}
                </button>
              </PermissionGuard>
              <NavLink to="/" className="text-[var(--accent)] text-xs tracking-[0.15em] hover:underline">
                {t("leaderboard.backToGame")}
              </NavLink>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
