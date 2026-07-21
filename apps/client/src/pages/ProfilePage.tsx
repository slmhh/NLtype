import { useMemo, useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useI18n } from "../context/I18nContext";
import { getResults, getPersonalBests } from "../services/results";
import { TrendChart } from "../components/TrendChart";
import type { GameResult, PersonalBest } from "../types/results";

export default function ProfilePage() {
  const { user, token } = useAuth();
  const { t } = useI18n();
  const [results, setResults] = useState<GameResult[]>([]);
  const [bests, setBests] = useState<PersonalBest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !token) { setLoading(false); return; }
    Promise.all([
      getResults(token).then(setResults),
      getPersonalBests(token).then(setBests),
    ]).catch(() => {}).finally(() => setLoading(false));
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
        <p className="text-[var(--text-tertiary)] text-sm tracking-wider">{t("profile.notLoggedIn")}</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center pt-20 px-4 select-none">
        <p className="text-[var(--text-tertiary)] text-sm tracking-wider">{t("profile.loading")}</p>
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
              {t(`role.${user.role}`)}
            </span>
          </div>
          <p className="text-[var(--text-tertiary)] text-xs tracking-wider">
            {t("profile.registeredAt", { date: new Date(user.createdAt).toLocaleDateString("zh-CN") })}
          </p>
        </div>

        {/* Stats card */}
        <div className="bg-card rounded-2xl shadow-card p-8">
          <h3 className="text-[var(--text-primary)] text-sm tracking-[0.15em] mb-5">{t("profile.stats")}</h3>
          {stats ? (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
              {[
                { label: t("profile.totalGames"), value: stats.total },
                { label: t("profile.avgWpm"), value: stats.avgWpm },
                { label: t("profile.bestWpm"), value: stats.bestWpm },
                { label: t("profile.avgAcc"), value: `${stats.avgAcc}%` },
                { label: t("profile.totalTime"), value: `${Math.floor(stats.totalTime / 60)}m` },
              ].map((s) => (
                <div key={s.label} className="text-center">
                  <div className="text-2xl font-bold font-mono text-[var(--text-primary)] tabular-nums">{s.value}</div>
                  <div className="text-[var(--text-tertiary)] text-xs tracking-wider mt-1">{s.label}</div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[var(--text-tertiary)] text-sm text-center py-4 tracking-wider">{t("profile.noData")}</p>
          )}
        </div>

        {/* Trend chart */}
        {stats && results.length >= 2 && (
          <div className="bg-card rounded-2xl shadow-card p-8">
            <h3 className="text-[var(--text-primary)] text-sm tracking-[0.15em] mb-5">{t("profile.trend")}</h3>
            <TrendChart results={results} />
          </div>
        )}

        {/* Personal Bests card */}
        {bests.length > 0 && (
          <div className="bg-card rounded-2xl shadow-card p-8">
            <h3 className="text-[var(--text-primary)] text-sm tracking-[0.15em] mb-5">{t("profile.personalBests")}</h3>
            <div>
              <div className="grid grid-cols-[auto_auto_auto_auto] gap-0 text-xs tracking-wider uppercase text-[var(--text-tertiary)] px-2 pb-3 border-b border-[var(--border)]">
                <span className="w-20">{t("profile.colMode")}</span>
                <span className="w-12 text-right">WPM</span>
                <span className="w-14 text-right">{t("profile.colAcc")}</span>
                <span className="w-20 text-right">{t("profile.colDate")}</span>
              </div>
              {bests.map((b) => (
                <div key={`${b.mode}-${b.language}`}
                  className="grid grid-cols-[auto_auto_auto_auto] gap-0 text-sm px-2 py-2.5 border-b border-[var(--border)] last:border-b-0 hover:bg-[var(--bg-alt)] transition-colors"
                >
                  <span className="w-20 text-[var(--text-primary)] font-mono text-xs">{t(`mode.${b.mode}`)} · {t(`lang.${b.language}`)}</span>
                  <span className="w-12 text-right text-[var(--text-primary)] font-mono font-semibold tabular-nums">{b.wpm}</span>
                  <span className="w-14 text-right text-[var(--text-secondary)] font-mono tabular-nums">{b.accuracy}%</span>
                  <span className="w-20 text-right text-[var(--text-tertiary)] text-xs font-mono">{new Date(b.createdAt).toLocaleDateString("zh-CN")}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* History */}
        <div className="bg-card rounded-2xl shadow-card p-8">
          <h3 className="text-[var(--text-primary)] text-sm tracking-[0.15em] mb-5">{t("profile.recentResults")}</h3>
          {recent.length > 0 ? (
            <div>
              <div className="grid grid-cols-[auto_auto_auto_auto_auto] gap-0 text-xs tracking-wider uppercase text-[var(--text-tertiary)] px-2 pb-3 border-b border-[var(--border)]">
                <span className="w-20">{t("profile.colDate")}</span>
                <span className="w-12 text-right">WPM</span>
                <span className="w-14 text-right">{t("profile.colAcc")}</span>
                <span className="w-12 text-right">{t("profile.colMode")}</span>
                <span className="w-12 text-right">{t("profile.colLang")}</span>
              </div>
              {recent.map((r) => (
                <div
                  key={r.id}
                  className="grid grid-cols-[auto_auto_auto_auto_auto] gap-0 text-sm px-2 py-2.5 border-b border-[var(--border)] last:border-b-0 hover:bg-[var(--bg-alt)] transition-colors"
                >
                  <span className="w-20 text-[var(--text-tertiary)] text-xs font-mono">{new Date(r.createdAt).toLocaleDateString("zh-CN")}</span>
                  <span className="w-12 text-right text-[var(--text-primary)] font-mono font-semibold tabular-nums">{r.wpm}</span>
                  <span className="w-14 text-right text-[var(--text-secondary)] font-mono tabular-nums">{r.accuracy}%</span>
                  <span className="w-12 text-right text-[var(--text-tertiary)] text-xs">{t(`mode.${r.mode}`)}</span>
                  <span className="w-12 text-right text-[var(--text-tertiary)] text-xs">{t(`lang.${r.language}`)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[var(--text-tertiary)] text-sm text-center py-4 tracking-wider">{t("profile.noRecords")}</p>
          )}
        </div>
      </div>
    </div>
  );
}
