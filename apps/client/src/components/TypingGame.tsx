import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Modal, Statistic, Tag } from "@arco-design/web-react";
import { useTypingEngine } from "../hooks/useTypingEngine";
import { useTimer } from "../hooks/useTimer";
import { TypingDisplay } from "./TypingDisplay";

interface TypingGameProps {
  text: string;
  language: "en" | "zh";
  timeLimit: number;
  onRetry: () => void;
  onBack: () => void;
}

export default function TypingGame({ text, language, timeLimit, onRetry, onBack }: TypingGameProps) {
  const [phase, setPhase] = useState<"playing" | "finished">("playing");
  const [showResult, setShowResult] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const hasTimer = timeLimit > 0;

  const onTimeUp = useCallback(() => {
    setPhase("finished");
    setShowResult(true);
  }, []);

  const timer = useTimer(hasTimer ? timeLimit : 0, onTimeUp);
  const timerRef = useRef(timer);
  timerRef.current = timer;

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
    if (hasTimer) {
      timerRef.current.reset(timeLimit);
      timerRef.current.start();
    }
    inputRef.current?.focus();
  }, [text, timeLimit, resetTyping, hasTimer]);

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
      {/* Hidden textarea for IME */}
      <textarea ref={inputRef} className="absolute opacity-0 w-0 h-0 -z-10" autoFocus />

      {/* Back link */}
      <button onClick={onBack} className="self-start mb-4 ml-4 text-[var(--text-tertiary)] text-xs tracking-[0.15em] hover:text-[var(--text-secondary)] transition-colors">
        ← 返回
      </button>

      {/* Game card */}
      <div
        className="w-full max-w-[780px] bg-card rounded-2xl shadow-card overflow-hidden transition-colors"
        onClick={() => inputRef.current?.focus()}
      >
        {/* Timer area */}
        {hasTimer && (
          <div className="px-6 pt-5 pb-2 flex items-center justify-between">
            <span className={`text-3xl font-bold font-mono tracking-wider transition-colors ${
              timer.timeLeft <= 5 ? "text-[var(--accent-red)]" : "text-[var(--text-primary)]"
            }`}>
              {timerLabel}
            </span>
            {language === "en" ? (
              <span className="text-[var(--text-tertiary)] text-xs tracking-[0.15em] uppercase">EN</span>
            ) : (
              <span className="text-[var(--text-tertiary)] text-xs tracking-[0.15em] uppercase">ZH</span>
            )}
          </div>
        )}

        {/* Text display */}
        <div className="px-6 py-4">
          {phase === "playing" && (
            <TypingDisplay
              chars={typingState.chars}
              currentIndex={typingState.currentIndex}
              isFinished={typingState.isFinished}
            />
          )}
        </div>

        {/* Progress bar */}
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

      {/* Stats bar */}
      {phase === "playing" && (
        <div className="w-full max-w-[780px] grid grid-cols-4 gap-0 mt-5">
          <StatBlock label="wpm" value={String(typingState.wpm)} />
          <StatBlock label="acc" value={`${typingState.accuracy}%`} />
          <StatBlock label="progress" value={`${Math.round(progress * 100)}%`} />
          <StatBlock label="time" value={timerLabel} last />
        </div>
      )}

      {/* Result Modal */}
      <Modal
        visible={showResult}
        onCancel={onBack}
        footer={null}
        closable={false}
        maskClosable={false}
        escToExit={false}
        alignCenter
        style={{ maxWidth: 380 }}
        className="!rounded-3xl"
      >
        <div className="text-center pt-4 pb-2">
          <p className="text-[var(--text-tertiary)] text-xs tracking-[0.2em] uppercase mb-6">
            result
          </p>

          <Statistic
            title="wpm"
            value={typingState.wpm}
            countUp
            countDuration={800}
            countFrom={0}
            className="[&_.arco-statistic-title]:!text-[var(--text-tertiary)] [&_.arco-statistic-title]:!tracking-[0.2em] [&_.arco-statistic-title]:!text-xs [&_.arco-statistic-value]:!text-7xl [&_.arco-statistic-value]:!font-bold [&_.arco-statistic-value]:!font-mono [&_.arco-statistic-value]:!text-[var(--accent)]"
          />

          <div className="grid grid-cols-3 gap-2 my-6">
            <MiniStat label="accuracy" value={`${typingState.accuracy}%`} />
            <MiniStat label="cpm" value={String(typingState.cpm)} />
            <MiniStat label="raw" value={String(typingState.rawWpm)} />
          </div>

          <div className="flex items-center justify-center gap-3 mb-8">
            <Tag color="green" bordered>✓ {typingState.correctCount}</Tag>
            <span className="text-[var(--text-tertiary)]">·</span>
            <Tag color="red" bordered>✗ {typingState.incorrectCount}</Tag>
          </div>

          <div className="flex gap-2.5">
            <Button type="primary" long onClick={onRetry}
              className="!rounded-xl !text-sm !tracking-wider !uppercase !font-semibold !h-11">
              再来一局
            </Button>
            <Button type="outline" long onClick={onBack}
              className="!rounded-xl !text-sm !tracking-wider !uppercase !h-11">
              返回大厅
            </Button>
          </div>
        </div>
      </Modal>
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
