import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Message } from "@arco-design/web-react";
import { useAuth } from "../context/AuthContext";
import { useI18n } from "../context/I18nContext";
import { useTypingEngine } from "../hooks/useTypingEngine";
import { useTimer } from "../hooks/useTimer";
import { TypingDisplay } from "../components/TypingDisplay";
import { WpmChart } from "../components/WpmChart";
import type { Language } from "../types/game";
import {
  getDailyChallenge,
  submitDailyAttempt,
  getDailyLeaderboard,
} from "../services/daily";
import type { DailyChallenge, DailyLeaderboardEntry } from "../services/daily";

const TIME_LIMIT = 60;

export default function DailyPage() {
  const navigate = useNavigate();
  const { user, token } = useAuth();
  const { t } = useI18n();
  const [challenge, setChallenge] = useState<DailyChallenge | null>(null);
  const [leaderboard, setLeaderboard] = useState<DailyLeaderboardEntry[]>([]);
  const [phase, setPhase] = useState<"loading" | "ready" | "countdown" | "playing" | "finished">("loading");
  const [submitted, setSubmitted] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [countdownNum, setCountdownNum] = useState(3);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const savedRef = useRef(false);

  const text = challenge?.text ?? "";
  const hasTimer = true;

  // Fetch challenge + leaderboard
  useEffect(() => {
    if (!token) return;
    getDailyChallenge(token).then((c) => {
      setChallenge(c);
      if (c.alreadyDone) {
        setPhase("finished");
        setSubmitted(true);
        setShowResult(true);
      } else {
        setPhase("ready");
      }
    });
    getDailyLeaderboard(token).then(setLeaderboard);
  }, [token]);

  const onTimeUp = useCallback(() => {
    setPhase("finished");
    setShowResult(true);
  }, []);

  const timer = useTimer(TIME_LIMIT, onTimeUp);
  const timerRef = useRef(timer);
  timerRef.current = timer;

  const onGameFinish = useCallback(() => {
    setPhase("finished");
    setShowResult(true);
    timerRef.current.stop();
  }, []);

  const { state: typingState, reset: resetTyping } = useTypingEngine({
    text,
    language: "en" as Language,
    isActive: phase === "playing",
    onFinish: onGameFinish,
  });

  // Start countdown then game
  const startGame = useCallback(() => {
    setPhase("playing");
    timerRef.current.start();
  }, []);

  useEffect(() => {
    if (phase !== "ready") return;
    // Auto-start countdown
    const t = setTimeout(() => {
      setPhase("countdown");
      countdownRef.current = setInterval(() => {
        setCountdownNum((prev) => {
          if (prev <= 1) {
            if (countdownRef.current) clearInterval(countdownRef.current);
            countdownRef.current = null;
            setTimeout(() => startGame(), 0);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }, 500);
    return () => {
      clearTimeout(t);
      if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }
    };
  }, [phase, startGame]);

  useEffect(() => {
    resetTyping(text);
    timerRef.current.reset(TIME_LIMIT);
  }, [text, resetTyping]);

  // Submit daily attempt
  useEffect(() => {
    if (phase === "finished" && !savedRef.current && !submitted && token && challenge) {
      savedRef.current = true;
      submitDailyAttempt(token, challenge.challengeId, {
        wpm: typingState.wpm,
        accuracy: typingState.accuracy,
        cpm: typingState.cpm,
        rawWpm: typingState.rawWpm,
        correctCount: typingState.correctCount,
        incorrectCount: typingState.incorrectCount,
        durationSec: Math.round(typingState.elapsedMs / 1000),
      }).then(() => {
        setSubmitted(true);
        Message.success(t("daily.submitted"));
        // Refresh leaderboard
        getDailyLeaderboard(token!).then(setLeaderboard);
      }).catch(() => Message.error(t("daily.submitFailed")));
    }
  }, [phase, typingState, token, challenge, submitted, t]);

  const peakWpm = useMemo(() => Math.max(...typingState.wpmHistory, typingState.wpm), [typingState.wpmHistory, typingState.wpm]);
  const avgWpm = useMemo(() => {
    const all = [...typingState.wpmHistory, typingState.wpm].filter(Boolean);
    return all.length > 0 ? Math.round(all.reduce((a, b) => a + b, 0) / all.length) : 0;
  }, [typingState.wpmHistory, typingState.wpm]);

  const progress = text.length > 0 ? Math.min(1, typingState.currentIndex / text.length) : 0;

  const minutes = Math.floor(timer.timeLeft / 60);
  const seconds = timer.timeLeft % 60;

  if (!user || !token) {
    return (
      <div className="flex flex-col items-center pt-20 px-4 select-none">
        <p className="text-[var(--text-tertiary)] text-sm tracking-wider">{t("daily.loginRequired")}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center pt-8 px-4 pb-16 select-none">
      {phase === "loading" ? (
        <p className="text-[var(--text-tertiary)] text-sm mt-20">{t("daily.loading")}</p>
      ) : (
        <>
          {/* Header */}
          <div className="flex items-center justify-between w-full max-w-[780px] mb-4">
            <button onClick={() => navigate("/")} className="text-[var(--text-tertiary)] text-xs tracking-[0.15em] hover:text-[var(--text-secondary)] transition-colors">
              ← {t("daily.back")}
            </button>
            <span className="text-[var(--text-tertiary)] text-xs tracking-[0.2em] uppercase">{t("daily.title")} · {challenge?.date}</span>
          </div>

          {/* Game card */}
          <div className="w-full max-w-[780px] bg-card rounded-2xl shadow-card overflow-hidden transition-colors">
            {phase !== "finished" && (
              <div className="px-6 pt-5 pb-2 flex items-center justify-between">
                <span className="text-3xl font-bold font-mono tracking-wider text-[var(--text-primary)]">
                  {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
                </span>
                <span className="text-[var(--text-tertiary)] text-xs tracking-[0.15em] uppercase">
                  {t("daily.timed", { s: TIME_LIMIT })}
                </span>
              </div>
            )}

            <div className="px-6 py-4 relative">
              {phase !== "ready" && (
                <TypingDisplay
                  chars={typingState.chars}
                  currentIndex={typingState.currentIndex}
                  isFinished={typingState.isFinished}
                />
              )}

              {phase === "ready" && (
                <div className="flex items-center justify-center h-40">
                  <p className="text-[var(--text-tertiary)] text-sm tracking-wider">{t("daily.getReady")}</p>
                </div>
              )}

              {phase === "countdown" && (
                <div className="absolute inset-0 flex items-center justify-center bg-card/80 backdrop-blur-sm rounded-2xl z-10">
                  <span
                    className="font-bold font-mono transition-all duration-300"
                    style={{
                      fontSize: countdownNum > 0 ? "8rem" : "5rem",
                      color: countdownNum > 0 ? "var(--accent)" : "var(--accent-green)",
                    }}
                  >
                    {countdownNum > 0 ? countdownNum : "GO!"}
                  </span>
                </div>
              )}

              {text && phase !== "ready" && (
                <div className="h-[2px] bg-[var(--border)] mx-0 mb-0 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300 ease-out"
                    style={{ width: `${progress * 100}%`, backgroundColor: "var(--accent)" }}
                  />
                </div>
              )}
            </div>

            {/* Stats during playing */}
            {phase === "playing" && (
              <div className="w-full grid grid-cols-4 gap-0 px-6 pb-5">
                <StatBlock label={t("game.wpm")} value={String(typingState.wpm)} />
                <StatBlock label={t("game.acc")} value={`${typingState.accuracy}%`} />
                <StatBlock label={t("game.progress")} value={`${Math.round(progress * 100)}%`} />
                <StatBlock label={t("game.time")} value={`${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`} last />
              </div>
            )}
          </div>

          {/* Result section */}
          {showResult && (
            <div className="w-full max-w-[780px] mt-6 space-y-6">
              {/* Your result */}
              <div className="bg-card rounded-2xl shadow-card p-8">
                <p className="text-[var(--text-tertiary)] text-xs tracking-[0.2em] uppercase mb-4 text-center">
                  {submitted ? t("daily.yourResult") : t("daily.saving")}
                </p>
                {submitted && (
                  <>
                    <div className="text-center mb-4">
                      <span className="text-6xl font-bold font-mono text-[var(--accent)]">{typingState.wpm}</span>
                      <span className="text-[var(--text-tertiary)] text-sm ml-1">WPM</span>
                    </div>
                    <div className="grid grid-cols-4 gap-2 mb-4">
                      <MiniStat label={t("game.peak")} value={String(peakWpm)} />
                      <MiniStat label={t("game.avg")} value={String(avgWpm)} />
                      <MiniStat label={t("game.accuracy")} value={`${typingState.accuracy}%`} />
                      <MiniStat label={t("game.cpm")} value={String(typingState.cpm)} />
                    </div>
                    {typingState.wpmHistory.length > 1 && (
                      <div className="mb-4 px-2">
                        <WpmChart data={typingState.wpmHistory} currentWpm={typingState.wpm} />
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Leaderboard */}
              <div className="bg-card rounded-2xl shadow-card p-8">
                <h3 className="text-[var(--text-primary)] text-sm tracking-[0.15em] mb-5">{t("daily.leaderboard")}</h3>
                {leaderboard.length === 0 ? (
                  <p className="text-[var(--text-tertiary)] text-sm text-center py-4">{t("daily.noEntries")}</p>
                ) : (
                  <div>
                    <div className="grid grid-cols-[auto_1fr_auto_auto] gap-0 text-xs tracking-wider uppercase text-[var(--text-tertiary)] px-2 pb-3 border-b border-[var(--border)]">
                      <span className="w-8">#</span>
                      <span>{t("daily.colUser")}</span>
                      <span className="w-14 text-right">WPM</span>
                      <span className="w-14 text-right">{t("daily.colAcc")}</span>
                    </div>
                    {leaderboard.map((e) => (
                      <div
                        key={`${e.rank}-${e.username}`}
                        className={`grid grid-cols-[auto_1fr_auto_auto] gap-0 text-sm px-2 py-2.5 border-b border-[var(--border)] last:border-b-0 transition-colors ${
                          e.username === user?.username ? "bg-[var(--accent-soft)]" : "hover:bg-[var(--bg-alt)]"
                        }`}
                      >
                        <span className={`w-8 font-mono text-xs ${e.rank <= 3 ? "text-[var(--accent)] font-bold" : "text-[var(--text-tertiary)]"}`}>
                          {e.rank <= 3 ? ["🥇", "🥈", "🥉"][e.rank - 1] : e.rank}
                        </span>
                        <span className="text-[var(--text-primary)] font-mono text-xs">{e.username}</span>
                        <span className="w-14 text-right text-[var(--text-primary)] font-mono font-semibold tabular-nums">{e.wpm}</span>
                        <span className="w-14 text-right text-[var(--text-secondary)] font-mono tabular-nums">{e.accuracy}%</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button onClick={() => navigate("/")}
                  className="flex-1 py-3 rounded-xl border border-[var(--border)] text-[var(--text-tertiary)] text-sm tracking-wider hover:text-[var(--accent)] hover:border-[var(--accent)] transition-all"
                >
                  {t("daily.backToHome")}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function StatBlock({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <div className={`text-center ${last ? "" : "border-r border-[var(--border)]"}`}>
      <div className="text-2xl font-bold text-[var(--text-primary)] font-mono tabular-nums">{value}</div>
      <div className="text-xs text-[var(--text-tertiary)] tracking-[0.15em] uppercase mt-0.5">{label}</div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl py-3 text-center border border-[var(--border)]">
      <div className="text-2xl font-bold text-[var(--text-primary)] font-mono tabular-nums">{value}</div>
      <div className="text-xs text-[var(--text-tertiary)] tracking-[0.15em] uppercase mt-0.5">{label}</div>
    </div>
  );
}
