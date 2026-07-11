import { useCallback, useEffect, useRef, useState } from "react";
import { useTypingEngine } from "../hooks/useTypingEngine";
import { useTimer } from "../hooks/useTimer";
import { englishWords } from "../data/words";
import { getChineseText as getChineseLocal } from "../data/chinese";
import { TypingDisplay } from "./TypingDisplay";

type GamePhase = "idle" | "countdown" | "playing" | "finished";

async function fetchTextFromAPI(lang: string) {
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

function generateEnglishTextLocal() {
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

export default function TypingGame() {
  const [language, setLanguage] = useState<"en" | "zh">("en");
  const [timeLimit, setTimeLimit] = useState(30);
  const [phase, setPhase] = useState<GamePhase>("idle");
  const [gameText, setGameText] = useState(() => generateEnglishTextLocal());
  const [showResult, setShowResult] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [compCount, setCompCount] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const onTimeUp = useCallback(() => {
    setPhase("finished");
    setShowResult(true);
  }, []);

  const timer = useTimer(timeLimit, onTimeUp);
  const onFinish = useCallback(() => {
    setPhase("finished");
    setShowResult(true);
    timer.stop();
  }, [timer]);

  const { state: typingState, reset: resetTyping } = useTypingEngine({
    text: gameText,
    language,
    isActive: phase === "playing",
    onFinish,
  });

  const startGame = useCallback(async () => {
    setFetching(true);
    const text = await fetchTextFromAPI(language).catch(() => null) ||
      (language === "en" ? generateEnglishTextLocal() : getChineseLocal());
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


  const toggleLanguage = useCallback(() => {
    setLanguage((l) => (l === "en" ? "zh" : "en"));
    setPhase("idle");
    setShowResult(false);
  }, []);

  const minutes = Math.floor(timer.timeLeft / 60);
  const seconds = timer.timeLeft % 60;

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4 py-8">
      <h1 className="text-2xl font-bold text-accent mb-8 tracking-widest">NLType</h1>

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

      <div className="w-full max-w-3xl">
        <div className="text-center mb-6">          {phase === "playing" && (
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

        {phase === "playing" && (
          <textarea
            className="absolute opacity-0 w-0 h-0 -z-10"
            autoFocus

          />
        )}
        <div
          className="relative w-full bg-surface-alt rounded-xl p-3
                     border border-text-muted/10 focus:border-accent/50
                     focus:outline-none transition-colors cursor-text"
          onClick={() => setTimeout(() => textareaRef.current?.focus(), 0)}
        >
          {phase === "idle" && (
            <div className="text-center text-text-muted py-12">
              <p className="text-lg mb-4">
                {fetching ? "Loading..." : "Ready to start?"}
              </p>
              <button
                onClick={startGame}
                disabled={fetching}
                className="px-8 py-3 bg-accent text-surface font-bold rounded-lg
                           hover:bg-accent/80 transition-colors text-lg
                           disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {fetching ? "Loading..." : "Start"}
              </button>
              <p className="text-sm mt-4 text-text-muted/60">Press any key to start</p>
            </div>
          )}

          {phase === "playing" && (
            <TypingDisplay
              chars={typingState.chars}
              currentIndex={typingState.currentIndex}
              isFinished={typingState.isFinished}
            />
          )}
        </div>

        {phase === "playing" && (
          <div className="grid grid-cols-4 gap-4 mb-6">
            <StatCard label="WPM" value={String(typingState.wpm)} />
            <StatCard label="Acc" value={`${typingState.accuracy}%`} />
            <StatCard label="Progress" value={getProgress(typingState)} />
            <StatCard label="CPM" value={String(typingState.cpm)} />
          </div>
        )}
      </div>

      {showResult && phase === "finished" && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-surface-alt rounded-2xl p-8 w-full max-w-md border border-text-muted/20">
            <h2 className="text-2xl font-bold text-center text-accent mb-6">Result</h2>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <ResultStat label="WPM" value={String(typingState.wpm)} />
              <ResultStat label="Accuracy" value={`${typingState.accuracy}%`} />
              <ResultStat label="CPM" value={String(typingState.cpm)} />
              <ResultStat label="Raw WPM" value={String(typingState.rawWpm)} />
            </div>

            <div className="flex gap-1 justify-center mb-6 text-xs text-text-muted">
              <span className="bg-accent-green/20 text-accent-green px-2 py-1 rounded">
                OK {typingState.correctCount}
              </span>
              <span className="bg-accent-red/20 text-accent-red px-2 py-1 rounded">
                ERR {typingState.incorrectCount}
              </span>
              <span className="bg-text-muted/10 px-2 py-1 rounded">
                TTL {typingState.correctCount + typingState.incorrectCount}
              </span>
            </div>

            <div className="flex gap-3">
              <button
                onClick={startGame}
                className="flex-1 px-4 py-3 bg-accent text-surface font-semibold
                           rounded-lg hover:bg-accent/80 transition-colors"
              >
                Retry
              </button>
              <button
                onClick={newGame}
                className="flex-1 px-4 py-3 bg-surface border border-text-muted/20
                           text-text rounded-lg hover:border-text-muted/40 transition-colors"
              >
                Back
              </button>
            </div>
          </div>
        </div>
      )}

      {phase === "idle" && !fetching && (
        <p className="text-xs text-text-muted/40 mt-8">Press any key to start</p>
      )}
      {phase === "playing" && (
        <div className="fixed top-1 right-1 text-[10px] text-text-muted/30 pointer-events-none z-50">
          comp:{compCount} lang:{language}
        </div>
      )}
    </div>
  );
}

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
  return Math.round((state.currentIndex / state.chars.length) * 100) + "%";
}