import { useCallback, useEffect, useRef, useState } from "react";
import { useTypingEngine } from "../hooks/useTypingEngine";
import { useTimer } from "../hooks/useTimer";
import { englishWords } from "../data/words";
import { getChineseText as getChineseLocal } from "../data/chinese";
import { TypingDisplay } from "./TypingDisplay";

type GamePhase = "idle" | "countdown" | "playing" | "finished";

// ── Text fetchers (prefer backend, fall back to local data) ──────────────

async function fetchTextFromAPI(lang: "en" | "zh"): Promise<string | null> {
  try {
    const ep = lang === "en" ? "/api/text/english" : "/api/text/chinese";
    const res = await fetch(ep, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return null;
    const data = await res.json();
    return data.text ?? null;
  } catch {
    return null;
  }
}

function generateEnglishTextLocal(): string {
  const targetLen = 200;
  const words: string[] = [];
  let len = 0;
  while (len < targetLen) {
    const w = englishWords[Math.floor(Math.random() * englishWords.length)];
    words.push(w);
    len += w.length + 1;
  }
  return words.slice(0, -1).join(" ");
}

// ── Component ────────────────────────────────────────────────────────────

export default function TypingGame() {
  const [language, setLanguage] = useState<"en" | "zh">("en");
  const [timeLimit, setTimeLimit] = useState(30);
  const [phase, setPhase] = useState<GamePhase>("idle");
  const [gameText, setGameText] = useState(() => generateEnglishTextLocal());
  const [showResult, setShowResult] = useState(false);
  const [fetching, setFetching] = useState(false);
  const inputRef = useRef<HTMLDivElement>(null);

  const onTimeUp = useCallback(() => {
    setPhase("finished");
    setShowResult(true);
  }, []);

  const timer = useTimer(timeLimit, onTimeUp);

  // Typing engine callback (not needed for timer-based mode)
  const onFinish = useCallback(() => {}, []);

  const { state: typingState, reset: resetTyping } = useTypingEngine({
    text: gameText,
    language,
    isActive: phase === "playing",
    onFinish,
  });

  // Prepare text and start the game
  const startGame = useCallback(async () => {
    setFetching(true);
    const text = await fetchTextFromAPI(language).catch(() => null)
      ?? (language === "en" ? generateEnglishTextLocal() : getChineseLocal());

    setGameText(text);
    resetTyping(text);
    setShowResult(false);
    setFetching(false);
    setPhase("playing");
    timer.reset(timeLimit);
    timer.start();
  }, [language, timeLimit, resetTyping, timer]);

  const newGame = useCallback(() => {
    setPhase("idle");
    setShowResult(false);
    timer.reset(timeLimit);
  }, [timeLimit, timer]);

  // Focus input trap
  useEffect(() => {
    if (phase === "playing" && inputRef.current) inputRef.current.focus();
  }, [phase]);

  const toggleLanguage = useCallback(() => {
    setLanguage((l) => (l === "en" ? "zh" : "en"));
    setPhase("idle");
    setShowResult(false);
  }, []);

  const minutes = Math.floor(timer.timeLeft / 60);
  const seconds = timer.timeLeft % 60;

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4 py-8">
      {/* Header */}
      <h1 className="text-2xl font-bold text-accent mb-8 tracking-widest">
        TypeRush
      </h1>

      {/* Controls */}
      <div className="flex items-center gap-4 mb-8">
        <button
          onClick={toggleLanguage}
          disabled={phase === "playing"}
          className={`px-4 py-2 rounded-lg text-sm border transition-colors
            ${phase === "playing"
              ? "bg-surface-alt border-text-muted/10 text-text-muted/40 cursor-not-allowed"
              : "bg-surface-alt border-text-muted/20 text-text hover:border-accent/50"
            }`}
        >
          {language === "en" ? "English" : "\u4E2D\u6587"}
        </button>

        {phase === "idle" && (
          <div className="flex gap-2">
            {[15, 30, 60, 120].map((t) => (
              <button
                key={t}
                onClick={() => setTimeLimit(t)}
                className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                  timeLimit === t
                    ? "bg-accent text-surface font-semibold"
                    : "bg-surface-alt border border-text-muted/20 text-text-muted hover:text-text"
                }`}
              >
                {t}s
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Game area */}
      <div className="w-full max-w-3xl">
        {/* Timer */}
        <div className="text-center mb-6">
          {phase === "playing" && (
            <div
              className={`text-4xl font-bold font-mono ${
                timer.timeLeft <= 5
                  ? "text-accent-red animate-pulse"
                  : "text-text"
              }`}
            >
              {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
            </div>
          )}
        </div>

        {/* Text display area */}
        <div
          ref={inputRef}
          tabIndex={0}
          className="relative w-full bg-surface-alt rounded-xl p-3
                     border border-text-muted/10 focus:border-accent/50
                     focus:outline-none transition-colors cursor-text"
        >
          {/* Idle state */}
          {phase === "idle" && (
            <div className="text-center text-text-muted py-12">
              <p className="text-lg mb-4">
                {fetching ? "\u6B63\u5728\u52A0\u8F7D\u2026\u2026" : "\u51C6\u5907\u597D\u5F00\u59CB\u4E86\u5417\uFF1F"}
              </p>
              <button
                onClick={startGame}
                disabled={fetching}
                className="px-8 py-3 bg-accent text-surface font-bold rounded-lg
                           hover:bg-accent/80 transition-colors text-lg
                           disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {fetching ? "\u52A0\u8F7D\u4E2D\u2026\u2026" : "\u5F00\u59CB\u6E38\u620F"}
              </button>
              <p className="text-sm mt-4 text-text-muted/60">
                或按下任意键直接开始
              </p>
            </div>
          )}

          {/* Playing state — use the reusable TypingDisplay */}
          {phase === "playing" && (
            <TypingDisplay
              chars={typingState.chars}
              currentIndex={typingState.currentIndex}
              isFinished={typingState.isFinished}
            />
          )}
        </div>

        {/* Live stats */}
        {phase === "playing" && (
          <div className="grid grid-cols-4 gap-4 mb-6">
            <StatCard label="WPM" value={String(typingState.wpm)} />
            <StatCard label={"\u51C6\u786E\u7387"} value={`${typingState.accuracy}%`} />
            <StatCard label={"\u8FDB\u5EA6"} value={getProgress(typingState)} />
            <StatCard label="CPM" value={String(typingState.cpm)} />
          </div>
        )}
      </div>

      {/* Result screen */}
      {showResult && phase === "finished" && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-surface-alt rounded-2xl p-8 w-full max-w-md border border-text-muted/20">
            <h2 className="text-2xl font-bold text-center text-accent mb-6">
              {"\u6E38\u620F\u7ED3\u675F"}
            </h2>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <ResultStat label="WPM" value={String(typingState.wpm)} />
              <ResultStat label={"\u51C6\u786E\u7387"} value={`${typingState.accuracy}%`} />
              <ResultStat label="CPM" value={String(typingState.cpm)} />
              <ResultStat label="Raw WPM" value={String(typingState.rawWpm)} />
            </div>

            <div className="flex gap-1 justify-center mb-6 text-xs text-text-muted">
              <span className="bg-accent-green/20 text-accent-green px-2 py-1 rounded">
                {"\u2713"} {typingState.correctCount}
              </span>
              <span className="bg-accent-red/20 text-accent-red px-2 py-1 rounded">
                {"\u2717"} {typingState.incorrectCount}
              </span>
              <span className="bg-text-muted/10 px-2 py-1 rounded">
                {"\u03A3"} {typingState.correctCount + typingState.incorrectCount}
              </span>
            </div>

            <div className="flex gap-3">
              <button
                onClick={startGame}
                className="flex-1 px-4 py-3 bg-accent text-surface font-semibold
                           rounded-lg hover:bg-accent/80 transition-colors"
              >
                {"\u518D\u6765\u4E00\u5C40"}
              </button>
              <button
                onClick={newGame}
                className="flex-1 px-4 py-3 bg-surface border border-text-muted/20
                           text-text rounded-lg hover:border-text-muted/40 transition-colors"
              >
                {"\u8FD4\u56DE"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hint */}
      {phase === "idle" && !fetching && (
        <p className="text-xs text-text-muted/40 mt-8">
          Enter — {"\u5F00\u59CB"} &nbsp;&middot;&nbsp; Tab — {"\u5207\u6362\u6A21\u5F0F"} &nbsp;&middot;&nbsp; Esc — {"\u9000\u51FA"}
        </p>
      )}
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface-alt rounded-xl p-3 text-center border border-text-muted/10">
      <div className="text-xl font-bold text-text font-mono">{value}</div>
      <div className="text-xs text-text-muted mt-1">{label}</div>
    </div>
  );
}

function ResultStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface rounded-lg p-3 text-center">
      <div className="text-2xl font-bold text-accent font-mono">{value}</div>
      <div className="text-xs text-text-muted mt-1">{label}</div>
    </div>
  );
}

function getProgress(state: { currentIndex: number; chars: unknown[] }): string {
  if (state.chars.length === 0) return "0%";
  return `${Math.round((state.currentIndex / state.chars.length) * 100)}%`;
}
