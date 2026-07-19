import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, Message, Modal, Statistic } from "@arco-design/web-react";
import { useTypingEngine } from "../hooks/useTypingEngine";
import { useTimer } from "../hooks/useTimer";
import { useKeyboardShortcuts } from "../hooks/useKeyboardShortcuts";
import { TypingDisplay } from "./TypingDisplay";
import { WpmChart } from "./WpmChart";
import { TypingStatsModal } from "./TypingStatsModal";
import type { GameConfig, Language } from "../types/game";
import { useAuth } from "../context/AuthContext";
import { useI18n } from "../context/I18nContext";
import { saveResult } from "../services/results";

interface TypingGameProps {
  text: string;
  language: Language;
  timeLimit: number;
  gameConfig: GameConfig;
  onRetry: () => void;
  onBack: () => void;
}

export default function TypingGame({ text, language, timeLimit, gameConfig, onRetry, onBack }: TypingGameProps) {
  const { token } = useAuth();
  const { t } = useI18n();
  const [phase, setPhase] = useState<"countdown" | "playing" | "finished">("countdown");
  const [countdownNum, setCountdownNum] = useState(3);
  const [showResult, setShowResult] = useState(false);
  const [showStatsModal, setShowStatsModal] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const hasTimer = timeLimit > 0;
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useKeyboardShortcuts({ Tab: onRetry, Escape: onBack }, phase === "finished" && showResult);

  const onTimeUp = useCallback(() => {
    setPhase("finished");
    setShowResult(true);
  }, []);

  const timer = useTimer(hasTimer ? timeLimit : 0, onTimeUp);
  const timerRef = useRef(timer);
  timerRef.current = timer;

  const startGame = useCallback(() => {
    setPhase("playing");
    if (hasTimer) timerRef.current.start();
    inputRef.current?.focus();
  }, [hasTimer]);

  useEffect(() => {
    if (phase !== "countdown") return;
    countdownRef.current = setInterval(() => {
      setCountdownNum((prev) => {
        if (prev <= 1) {
          if (countdownRef.current) clearInterval(countdownRef.current);
          countdownRef.current = null;
          // transition to playing on next tick
          setTimeout(() => startGame(), 0);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }
    };
  }, [phase, startGame]);

  const onGameFinish = useCallback(() => {
    setPhase("finished");
    setShowResult(true);
    if (hasTimer) timerRef.current.stop();
  }, [hasTimer]);

  const { state: typingState, reset: resetTyping } = useTypingEngine({
    text,
    language,
    isActive: phase === "playing",
    onFinish: onGameFinish,
  });

  useEffect(() => {
    resetTyping(text);
    if (hasTimer) timerRef.current.reset(timeLimit);
  }, [text, timeLimit, resetTyping, hasTimer]);

  const savedRef = useRef(false);
  const [lastResultId, setLastResultId] = useState<string | null>(null);
  useEffect(() => {
    if (phase === "finished" && !savedRef.current) {
      savedRef.current = true;
      saveResult(gameConfig, {
        wpm: typingState.wpm,
        accuracy: typingState.accuracy,
        cpm: typingState.cpm,
        rawWpm: typingState.rawWpm,
        correctCount: typingState.correctCount,
        incorrectCount: typingState.incorrectCount,
        durationSec: Math.round(typingState.elapsedMs / 1000),
      }, token, typingState.events).then((r) => { setLastResultId(r.id); }).catch(() => {});
    }
  }, [phase, typingState, gameConfig, token]);

  const peakWpm = useMemo(() => Math.max(...typingState.wpmHistory, typingState.wpm), [typingState.wpmHistory, typingState.wpm]);
  const avgWpm = useMemo(() => {
    const all = [...typingState.wpmHistory, typingState.wpm].filter(Boolean);
    return all.length > 0 ? Math.round(all.reduce((a, b) => a + b, 0) / all.length) : 0;
  }, [typingState.wpmHistory, typingState.wpm]);

  const missedCount = useMemo(() => Math.max(0, text.length - (typingState.correctCount + typingState.incorrectCount)), [text.length, typingState.correctCount, typingState.incorrectCount]);
  const extraCount = 0;

  const consistency = useMemo(() => {
    const all = typingState.wpmHistory.filter(Boolean);
    if (all.length < 2) return 0;
    const mean = all.reduce((a, b) => a + b, 0) / all.length;
    const variance = all.reduce((sum, v) => sum + (v - mean) ** 2, 0) / all.length;
    return Math.round(Math.sqrt(variance) * 100) / 100;
  }, [typingState.wpmHistory]);

  const minutes = Math.floor(timer.timeLeft / 60);
  const seconds = timer.timeLeft % 60;

  const progress = text.length > 0
    ? Math.min(1, typingState.currentIndex / text.length)
    : 0;

  const timerLabel = hasTimer
    ? `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
    : `${Math.floor(typingState.elapsedMs / 60000)}:${String(Math.floor((typingState.elapsedMs % 60000) / 1000)).padStart(2, "0")}`;

  return (
    <div className="flex flex-col items-center pt-8 px-4 pb-16 select-none">
      <textarea ref={inputRef} className="absolute opacity-0 w-0 h-0 -z-10" autoFocus />

      <button onClick={onBack} className="self-start mb-4 ml-4 text-[var(--text-tertiary)] text-xs tracking-[0.15em] hover:text-[var(--text-secondary)] transition-colors">
        {t("game.back")}
      </button>

      <div
        className="w-full max-w-[780px] bg-card rounded-2xl shadow-card overflow-hidden transition-colors"
        onClick={() => inputRef.current?.focus()}
      >
        {hasTimer && (
          <div className="px-6 pt-5 pb-2 flex items-center justify-between">
            <span className={`text-3xl font-bold font-mono tracking-wider transition-colors ${
              timer.timeLeft <= 5 ? "text-[var(--accent-red)]" : "text-[var(--text-primary)]"
            }`}>
              {timerLabel}
            </span>
            <span className="text-[var(--text-tertiary)] text-xs tracking-[0.15em] uppercase">{t(`lang.${language}`)}</span>
          </div>
        )}

        <div className="px-6 py-4 relative">
          {phase !== "finished" && (
            <TypingDisplay
              chars={typingState.chars}
              currentIndex={typingState.currentIndex}
              isFinished={typingState.isFinished}
            />
          )}

          {phase === "countdown" && (
            <div className="absolute inset-0 flex items-center justify-center bg-card/80 backdrop-blur-sm rounded-2xl z-10">
              <span
                className="font-bold font-mono transition-all duration-300"
                style={{
                  fontSize: countdownNum > 0 ? "8rem" : "5rem",
                  color: countdownNum > 0 ? "var(--accent)" : "var(--accent-green)",
                  opacity: 1,
                  transform: `scale(${countdownNum > 0 ? 1 : 0.9})`,
                }}
              >
                {countdownNum > 0 ? countdownNum : "GO!"}
              </span>
            </div>
          )}
        </div>

        <div className="h-[2px] bg-[var(--border)] mx-6 mb-5 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-300 ease-out"
            style={{
              width: `${progress * 100}%`,
              backgroundColor: "var(--accent)",
            }}
          />
        </div>
      </div>

      {phase === "playing" && (
        <div className="w-full max-w-[780px] grid grid-cols-4 gap-0 mt-5">
          <StatBlock label={t("game.wpm")} value={String(typingState.wpm)} />
          <StatBlock label={t("game.acc")} value={`${typingState.accuracy}%`} />
          <StatBlock label={t("game.progress")} value={`${Math.round(progress * 100)}%`} />
          <StatBlock label={t("game.time")} value={timerLabel} last />
        </div>
      )}

      <Modal
        visible={showResult}
        onCancel={onBack}
        footer={null}
        closable={false}
        maskClosable={false}
        escToExit={false}
        alignCenter
        style={{ maxWidth: 460 }}
        className="!rounded-3xl"
      >
        <div className="text-center pt-4 pb-2">
          <p className="text-[var(--text-tertiary)] text-xs tracking-[0.2em] uppercase mb-2">
            {t("game.result")}
          </p>
          <p className="text-[var(--text-tertiary)] text-xs mb-4">
            {t(`mode.${gameConfig.mode}`)} · {t(`lang.${language}`)}
          </p>

          <Statistic
            title="wpm"
            value={typingState.wpm}
            countUp
            countDuration={800}
            countFrom={0}
            className="[&_.arco-statistic-title]:!text-[var(--text-tertiary)] [&_.arco-statistic-title]:!tracking-[0.2em] [&_.arco-statistic-title]:!text-xs [&_.arco-statistic-value]:!text-7xl [&_.arco-statistic-value]:!font-bold [&_.arco-statistic-value]:!font-mono [&_.arco-statistic-value]:!text-[var(--accent)]"
          />

          <div className="grid grid-cols-4 gap-2 my-5">
            <MiniStat label={t("game.peak")} value={String(peakWpm)} />
            <MiniStat label={t("game.avg")} value={String(avgWpm)} />
            <MiniStat label={t("game.accuracy")} value={`${typingState.accuracy}%`} />
            <MiniStat label={t("game.cpm")} value={String(typingState.cpm)} />
          </div>

          <div className="grid grid-cols-4 gap-2 mb-5">
            <CharStat label={t("game.correct")} value={String(typingState.correctCount)} color="var(--accent-green)" />
            <CharStat label={t("game.incorrect")} value={String(typingState.incorrectCount)} color="var(--accent-red)" />
            <CharStat label={t("game.missed")} value={String(missedCount)} color="var(--text-tertiary)" />
            <CharStat label={t("game.extra")} value={String(extraCount)} color="var(--text-tertiary)" />
          </div>

          {consistency > 0 && (
            <div className="flex items-center justify-center gap-2 mb-5">
              <span className="text-xs text-[var(--text-tertiary)] tracking-[0.15em] uppercase">{t("game.consistency")}</span>
              <span className="text-sm font-bold font-mono text-[var(--text-primary)]">{consistency} <span className="text-[var(--text-tertiary)] text-xs font-normal">σ</span></span>
            </div>
          )}

          {typingState.wpmHistory.length > 1 && (
            <div className="mb-5 px-2">
              <p className="text-[var(--text-tertiary)] text-xs tracking-[0.2em] uppercase mb-2">{t("game.speedCurve")}</p>
              <WpmChart data={typingState.wpmHistory} currentWpm={typingState.wpm} />
            </div>
          )}

          <div className="text-[var(--text-tertiary)] text-xs mb-5">
            {t("game.elapsed", { m: Math.floor(typingState.elapsedMs / 60000), s: Math.floor((typingState.elapsedMs % 60000) / 1000) })}
          </div>

          <button onClick={() => {
            const text = [
              t("game.shareHeader"),
              `${t(`mode.${gameConfig.mode}`)} · ${t(`lang.${language}`)}`,
              ``,
              t("game.shareWpm", { wpm: typingState.wpm, acc: typingState.accuracy }),
              t("game.shareCpm", { cpm: typingState.cpm, raw: typingState.rawWpm }),
              t("game.shareCorrect", { correct: typingState.correctCount, incorrect: typingState.incorrectCount }),
              t("game.shareTime", { m: Math.floor(typingState.elapsedMs / 60000), s: Math.floor((typingState.elapsedMs % 60000) / 1000) }),
              t("game.sharePeak", { peak: peakWpm }),
              ``,
              t("game.shareFooter"),
            ].join("\n");
            navigator.clipboard.writeText(text).then(
              () => Message.success(t("game.shareCopied")),
              () => Message.error(t("game.shareFailed")),
            );
          }}
            className="w-full mb-4 py-2 rounded-xl text-xs tracking-[0.15em] border border-[var(--border)] text-[var(--text-tertiary)] hover:text-[var(--accent)] hover:border-[var(--accent)] transition-all"
          >
             {t("game.shareBtn")}
          </button>

          {token && lastResultId && (
            <button onClick={() => setShowStatsModal(true)}
              className="w-full mb-4 py-2 rounded-xl text-xs tracking-[0.15em] border border-[var(--border)] text-[var(--text-tertiary)] hover:text-[var(--accent)] hover:border-[var(--accent)] transition-all"
            >
              {t("game.detailStats")}
            </button>
          )}

          <div className="flex gap-2.5">
            <Button type="primary" long onClick={onRetry}
              className="!rounded-xl !text-sm !tracking-wider !uppercase !font-semibold !h-11">
              {t("game.retry")} <span className="text-[var(--text-tertiary)] opacity-60 ml-1 text-[10px]">Tab</span>
            </Button>
            <Button type="outline" long onClick={onBack}
              className="!rounded-xl !text-sm !tracking-wider !uppercase !h-11">
              {t("game.backToLobby")} <span className="text-[var(--text-tertiary)] opacity-60 ml-1 text-[10px]">Esc</span>
            </Button>
          </div>
        </div>
      </Modal>

      <TypingStatsModal
        visible={showStatsModal}
        onClose={() => setShowStatsModal(false)}
        resultId={lastResultId ?? ""}
      />
    </div>
  );
}

function StatBlock({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <div className={`text-center ${last ? "" : "border-r border-[var(--border)]"}`}>
      <div className="text-2xl font-bold text-[var(--text-primary)] font-mono tabular-nums">
        {value}
      </div>
      <div className="text-xs text-[var(--text-tertiary)] tracking-[0.15em] uppercase mt-0.5">
        {label}
      </div>
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

function CharStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-xl py-2.5 text-center border border-[var(--border)]">
      <div className="text-lg font-bold font-mono tabular-nums" style={{ color }}>{value}</div>
      <div className="text-[10px] text-[var(--text-tertiary)] tracking-[0.15em] uppercase mt-0.5">{label}</div>
    </div>
  );
}
