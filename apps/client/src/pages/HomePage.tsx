import { useState, useEffect, useRef } from "react";

export type GameMode = "time" | "words" | "quote" | "code" | "zen";
export type Language = "en" | "zh";

export interface GameConfig {
  mode: GameMode;
  language: Language;
  timeLimit: number;
  wordCount: number;
}

interface HomePageProps {
  onStart: (config: GameConfig) => void;
}

const MODES: { id: GameMode; label: string }[] = [
  { id: "time", label: "time" },
  { id: "words", label: "words" },
  { id: "quote", label: "quote" },
  { id: "code", label: "code" },
  { id: "zen", label: "zen" },
];

const TIME_OPTIONS = [15, 30, 60, 120];
const WORD_OPTIONS = [10, 25, 50, 100, 200];

export default function HomePage({ onStart }: HomePageProps) {
  const [mode, setMode] = useState<GameMode>("time");
  const [timeLimit, setTimeLimit] = useState(30);
  const [wordCount, setWordCount] = useState(50);
  const [language, setLanguage] = useState<Language>("en");
  const [mounted, setMounted] = useState(false);
  const readyRef = useRef(false);

  const configRef = useRef({ mode, language, timeLimit, wordCount });
  configRef.current = { mode, language, timeLimit, wordCount };

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Tab") return;
      if (readyRef.current) return;
      readyRef.current = true;
      const c = configRef.current;
      onStart({ mode: c.mode, language: c.language, timeLimit: c.timeLimit, wordCount: c.wordCount });
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onStart]);

  const handleStart = () => {
    if (readyRef.current) return;
    readyRef.current = true;
    onStart({ mode, language, timeLimit, wordCount });
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4 select-none">
      {/* Logo */}
      <div className={`text-center transition-all duration-700 ease-out ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}>
        <h1 className="relative text-5xl font-bold tracking-[0.28em] text-accent uppercase">
          <span className="opacity-40 mr-2">▐</span>
          n l t y p e
          <span className="opacity-40 ml-2">▌</span>
        </h1>
        <p className="text-text-muted/30 text-[11px] tracking-[0.35em] uppercase mt-2">
          a typing game
        </p>
      </div>

      {/* Divider */}
      <div className={`w-10 h-px bg-gradient-to-r from-transparent via-text-muted/15 to-transparent my-10 transition-all duration-700 delay-100 ease-out ${mounted ? "opacity-100" : "opacity-0"}`} />

      {/* Mode tabs */}
      <div className={`flex items-center gap-0 mb-5 transition-all duration-700 delay-200 ease-out ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
        {MODES.map((m, i) => (
          <div key={m.id} className="flex items-center">
            <button
              onClick={() => setMode(m.id)}
              className={`px-3.5 py-1.5 text-sm tracking-[0.2em] uppercase transition-all duration-200
                ${mode === m.id
                  ? "text-accent"
                  : "text-text-muted/25 hover:text-text-muted/60"
                }`}
            >
              {m.label}
            </button>
            {i < MODES.length - 1 && (
              <span className="text-text-muted/10 mx-0.5 text-xs">/</span>
            )}
          </div>
        ))}
      </div>

      {/* Sub-options */}
      <div className={`flex items-center gap-1 min-h-[34px] mb-12 transition-all duration-700 delay-300 ease-out ${mounted ? "opacity-100" : "opacity-0"}`}>
        {mode === "time" && TIME_OPTIONS.map((t) => (
          <button
            key={t}
            onClick={() => setTimeLimit(t)}
            className={`px-3.5 py-1 text-sm tracking-wider rounded-lg transition-all duration-200
              ${timeLimit === t
                ? "text-text bg-surface-ov/50"
                : "text-text-muted/25 hover:text-text-muted/60"
              }`}
          >
            {t}
          </button>
        ))}
        {mode === "words" && WORD_OPTIONS.map((n) => (
          <button
            key={n}
            onClick={() => setWordCount(n)}
            className={`px-3.5 py-1 text-sm tracking-wider rounded-lg transition-all duration-200
              ${wordCount === n
                ? "text-text bg-surface-ov/50"
                : "text-text-muted/25 hover:text-text-muted/60"
              }`}
          >
            {n}
          </button>
        ))}
        {mode === "zen" && (
          <span className="text-text-muted/25 text-sm tracking-wider">∞ unlimited</span>
        )}
        {(mode === "quote" || mode === "code") && (
          <span className="text-text-muted/15 text-sm tracking-wider italic">coming soon</span>
        )}
      </div>

      {/* Start area */}
      <button
        onClick={handleStart}
        className={`group relative transition-all duration-700 delay-500 ease-out ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}
      >
        <div className="relative px-12 py-5 rounded-2xl border border-text-muted/10
                       hover:border-accent/30 transition-all duration-400
                       bg-surface-alt/30 hover:bg-surface-alt/60
                       hover:shadow-[0_0_40px_-12px_rgba(137,180,250,0.12)]">
          <p className="text-text-muted/25 group-hover:text-text-muted/50 text-[10px] tracking-[0.4em] uppercase transition-colors duration-300 mb-1.5">
            press any key
          </p>
          <p className="text-text-muted/40 group-hover:text-accent text-xl font-bold tracking-[0.35em] uppercase transition-all duration-300">
            start
          </p>
        </div>
      </button>

      {/* Language toggle */}
      <div className={`flex items-center gap-4 mt-12 transition-all duration-700 delay-[600ms] ease-out ${mounted ? "opacity-100" : "opacity-0"}`}>
        <button
          onClick={() => setLanguage("en")}
          className={`text-[11px] tracking-[0.3em] uppercase transition-all duration-200 px-3 py-1 rounded-lg
            ${language === "en"
              ? "text-text bg-surface-ov/40"
              : "text-text-muted/20 hover:text-text-muted/50"
            }`}
        >
          en
        </button>
        <span className="text-text-muted/10 text-xs">/</span>
        <button
          onClick={() => setLanguage("zh")}
          className={`text-[11px] tracking-[0.3em] uppercase transition-all duration-200 px-3 py-1 rounded-lg
            ${language === "zh"
              ? "text-text bg-surface-ov/40"
              : "text-text-muted/20 hover:text-text-muted/50"
            }`}
        >
          zh
        </button>
      </div>

      {/* Mode indicator */}
      <p className={`fixed bottom-6 text-text-muted/15 text-[9px] tracking-[0.35em] uppercase transition-all duration-700 delay-700 ${mounted ? "opacity-100" : "opacity-0"}`}>
        {mode} · {language === "en" ? "english" : "chinese"}
      </p>
    </div>
  );
}
