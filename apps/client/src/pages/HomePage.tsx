import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";

export type GameMode = "time" | "words" | "quote" | "code" | "zen";
export type Language = "en" | "zh";

export interface GameConfig {
  mode: GameMode;
  language: Language;
  timeLimit: number;
  wordCount: number;
}

const MODES: { id: GameMode; label: string }[] = [
  { id: "time", label: "时间" },
  { id: "words", label: "单词" },
  { id: "quote", label: "引用" },
  { id: "code", label: "代码" },
  { id: "zen", label: "禅" },
];

const TIME_OPTIONS = [15, 30, 60, 120];
const WORD_OPTIONS = [10, 25, 50, 100, 200];

export default function HomePage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<GameMode>("time");
  const [timeLimit, setTimeLimit] = useState(30);
  const [wordCount, setWordCount] = useState(50);
  const [language, setLanguage] = useState<Language>("en");
  const [mounted, setMounted] = useState(false);
  const readyRef = useRef(false);

  const configRef = useRef({ mode, language, timeLimit, wordCount });
  configRef.current = { mode, language, timeLimit, wordCount };

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== "Enter" || readyRef.current) return;
      readyRef.current = true;
      const c = configRef.current;
      navigate("/game", { state: { config: { mode: c.mode, language: c.language, timeLimit: c.timeLimit, wordCount: c.wordCount } } });
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [navigate]);

  const handleStart = () => {
    if (readyRef.current) return;
    readyRef.current = true;
    navigate("/game", { state: { config: { mode, language, timeLimit, wordCount } } });
  };

  const fade = `transition-all duration-700 ease-out ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5"}`;

  return (
    <div className="flex flex-col items-center pt-20 px-4 pb-16 select-none">
      {/* Header */}
      <div className={`text-center mb-12 ${fade}`} style={{ transitionDelay: "0ms" }}>
        <h1 className="text-5xl font-bold tracking-[0.08em] text-[var(--text-primary)]">
          NLType
        </h1>
        <p className="text-[var(--text-tertiary)] text-sm tracking-[0.2em] mt-3">
          打字练习 · 专注书写
        </p>
      </div>

      {/* Card */}
      <div className={`w-full max-w-[780px] bg-card rounded-2xl shadow-card p-10 ${fade}`} style={{ transitionDelay: "100ms" }}>
        {/* Mode tabs */}
        <div className="flex items-center gap-2 mb-6">
          {MODES.map((m) => (
            <button key={m.id} onClick={() => setMode(m.id)}
              className={`px-4 py-1.5 text-sm tracking-[0.15em] rounded-full transition-all duration-200 font-mono ${
                mode === m.id
                  ? "bg-[var(--accent)] text-white"
                  : "bg-[var(--bg-alt)] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
              }`}>
              {m.label}
            </button>
          ))}
        </div>

        <div className="h-px bg-[var(--border)] mb-6" />

        {/* Options */}
        <div className="flex items-center gap-3 min-h-[38px] mb-8">
          {mode === "time" && TIME_OPTIONS.map((t) => (
            <button key={t} onClick={() => setTimeLimit(t)}
              className={`px-4 py-1.5 text-sm tracking-wider rounded-lg transition-all font-mono ${
                timeLimit === t ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
              }`}>
              {t}
            </button>
          ))}
          {mode === "words" && WORD_OPTIONS.map((n) => (
            <button key={n} onClick={() => setWordCount(n)}
              className={`px-4 py-1.5 text-sm tracking-wider rounded-lg transition-all font-mono ${
                wordCount === n ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
              }`}>
              {n}
            </button>
          ))}
          {mode === "zen" && <span className="text-[var(--text-tertiary)] text-sm tracking-wider font-mono">∞ 无限模式</span>}
          {(mode === "quote" || mode === "code") && <span className="text-[var(--text-tertiary)] text-sm tracking-wider italic font-mono">即将推出</span>}
        </div>

        {/* Language */}
        <div className="flex items-center gap-4 mb-8">
          <span className="text-[var(--text-tertiary)] text-xs tracking-[0.15em] uppercase">语言</span>
          <div className="flex items-center gap-1.5">
            <button onClick={() => setLanguage("en")}
              className={`px-4 py-1.5 text-sm tracking-wider rounded-lg transition-all font-mono ${
                language === "en" ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
              }`}>
              EN
            </button>
            <span className="text-[var(--border)] text-xs">/</span>
            <button onClick={() => setLanguage("zh")}
              className={`px-4 py-1.5 text-sm tracking-wider rounded-lg transition-all font-mono ${
                language === "zh" ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
              }`}>
              ZH
            </button>
          </div>
        </div>

        {/* Start */}
        <button onClick={handleStart}
          className="w-full py-4 rounded-xl bg-[var(--accent)] text-white text-base tracking-[0.15em] font-medium hover:opacity-90 transition-all">
          按 Enter 键开始
        </button>
        <p className="text-center text-[var(--text-tertiary)] text-xs tracking-[0.15em] mt-3">
          或按 Enter 键开始
        </p>
      </div>

      {/* Footer */}
      <p className="fixed bottom-6 text-[var(--text-tertiary)] text-xs tracking-[0.2em]">
        {language === "en" ? "english" : "chinese"} ·{" "}
        {mode === "time" ? `${timeLimit}秒` : mode === "words" ? `${wordCount}词` : mode} ·{" "}
        {mode === "time" ? "计时模式" : mode === "words" ? "单词模式" : mode === "zen" ? "禅模式" : "练习"}
      </p>
    </div>
  );
}
