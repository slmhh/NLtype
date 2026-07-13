import { useCallback, useEffect, useRef, useState } from "react";
import { useTypingEngine } from "../hooks/useTypingEngine";
import { useTimer } from "../hooks/useTimer";
import { TypingDisplay } from "./TypingDisplay";

type GamePhase = "playing" | "finished";

interface TypingGameProps {
  text: string;
  language: "en" | "zh";
  timeLimit: number;
  onFinish?: (result: { wpm: number; accuracy: number; cpm: number; rawWpm: number }) => void;
  onRetry: () => void;
  onBack: () => void;
}

export default function TypingGame({ text, language, timeLimit, onFinish, onRetry, onBack }: TypingGameProps) {
  const [phase, setPhase] = useState<GamePhase>("playing");
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

  useEffect(() => {
    if (phase === "finished" && typingState.wpm > 0) {
      onFinish?.({ wpm: typingState.wpm, accuracy: typingState.accuracy, cpm: typingState.cpm, rawWpm: typingState.rawWpm });
    }
  }, [phase, typingState, onFinish]);

  const minutes = Math.floor(timer.timeLeft / 60);
  const seconds = timer.timeLeft % 60;

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4 py-8">
      {/* Top bar */}
      <div className="fixed top-0 left-0 right-0 flex items-center justify-between px-6 py-4 z-40">
        <button
          onClick={onBack}
          className="text-text-muted/30 hover:text-text-muted/60 text-sm tracking-widest uppercase transition-colors duration-150"
        >
          ← back
        </button>
        <div className="flex items-center gap-3">
          <span className="text-text-muted/20 text-[10px] tracking-widest uppercase">{language === "en" ? "en" : "zh"}</span>
        </div>
      </div>

      {/* Timer bar */}
      {hasTimer && (
        <div className="mb-6 text-center">
          <div
            className={`text-5xl font-bold font-mono tracking-wider transition-colors duration-300 ${
              timer.timeLeft <= 5
                ? "text-accent-red"
                : "text-text/80"
            }`}
          >
            {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
          </div>
          {/* Progress bar */}
          <div className="w-32 h-[2px] mx-auto mt-2 bg-surface-ov/50 rounded-full overflow-hidden">
            <div
              className="h-full bg-accent/60 rounded-full transition-all duration-1000 ease-linear"
              style={{ width: `${(timer.timeLeft / timeLimit) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Hidden textarea for IME/focus capture */}
      <textarea
        ref={inputRef}
        className="absolute opacity-0 w-0 h-0 -z-10"
        autoFocus
      />

      {/* Game Area */}
      <div
        className="relative w-full max-w-3xl bg-surface-alt/30 backdrop-blur-sm rounded-2xl p-5
                   border border-text-muted/5 transition-colors duration-300
                   focus-within:border-accent/20"
        onClick={() => inputRef.current?.focus()}
      >
        {phase === "playing" && (
          <TypingDisplay
            chars={typingState.chars}
            currentIndex={typingState.currentIndex}
            isFinished={typingState.isFinished}
          />
        )}
      </div>

      {/* Stats bar */}
      {phase === "playing" && (
        <div className="flex items-center justify-center gap-6 mt-6">
          <StatItem label="wpm" value={String(typingState.wpm)} />
          <div className="w-px h-5 bg-text-muted/8" />
          <StatItem label="acc" value={`${typingState.accuracy}%`} />
          <div className="w-px h-5 bg-text-muted/8" />
          <StatItem label="cpm" value={String(typingState.cpm)} />
          <div className="w-px h-5 bg-text-muted/8" />
          <StatItem label="raw" value={String(typingState.rawWpm)} />
          <div className="w-px h-5 bg-text-muted/8" />
          <StatItem label="progress" value={getProgress(typingState)} />
        </div>
      )}

      {/* Result Modal */}
      {showResult && phase === "finished" && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50">
          <div className="bg-surface/95 border border-text-muted/8 rounded-3xl p-12 w-full max-w-sm mx-4 shadow-2xl">
            <p className="text-center text-text-muted/30 text-[10px] tracking-[0.3em] uppercase mb-6">
              result
            </p>

            {/* Big WPM */}
            <div className="text-center mb-8">
              <div className="text-7xl font-bold text-accent font-mono tracking-tight">
                {typingState.wpm}
              </div>
              <div className="text-xs text-text-muted/40 tracking-[0.25em] uppercase mt-1">
                wpm
              </div>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-3 gap-2 mb-6">
              <MiniStat label="accuracy" value={`${typingState.accuracy}%`} />
              <MiniStat label="cpm" value={String(typingState.cpm)} />
              <MiniStat label="raw" value={String(typingState.rawWpm)} />
            </div>

            {/* Character counts */}
            <div className="flex items-center justify-center gap-3 mb-8">
              <span className="flex items-center gap-1.5 text-accent-green/80 text-xs">
                <span className="w-2 h-2 rounded-full bg-accent-green/40" />
                {typingState.correctCount} correct
              </span>
              <span className="text-text-muted/20">·</span>
              <span className="flex items-center gap-1.5 text-accent-red/80 text-xs">
                <span className="w-2 h-2 rounded-full bg-accent-red/40" />
                {typingState.incorrectCount} wrong
              </span>
            </div>

            {/* Buttons */}
            <div className="flex gap-2.5">
              <button
                onClick={onRetry}
                className="flex-1 px-4 py-3 bg-accent text-surface font-bold
                           rounded-2xl hover:bg-accent/90 active:scale-[0.98]
                           transition-all duration-150 text-sm tracking-wider uppercase"
              >
                retry
              </button>
              <button
                onClick={onBack}
                className="flex-1 px-4 py-3 border border-text-muted/10 text-text-muted
                           rounded-2xl hover:border-text-muted/25 hover:text-text/80 active:scale-[0.98]
                           transition-all duration-150 text-sm tracking-wider uppercase"
              >
                back
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center">
      <div className="text-lg font-semibold text-text/80 font-mono tabular-nums">{value}</div>
      <div className="text-[10px] text-text-muted/35 tracking-[0.2em] uppercase mt-0.5">{label}</div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface-ov/30 rounded-2xl py-3 text-center border border-text-muted/5">
      <div className="text-xl font-bold text-text/70 font-mono tabular-nums">{value}</div>
      <div className="text-[9px] text-text-muted/40 tracking-[0.2em] uppercase mt-0.5">{label}</div>
    </div>
  );
}

function getProgress(state: { currentIndex: number; chars: unknown[] }): string {
  if (state.chars.length === 0) return "0%";
  return Math.round((state.currentIndex / state.chars.length) * 100) + "%";
}
