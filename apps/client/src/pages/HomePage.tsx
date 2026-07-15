import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "../context/LanguageContext";
import { useI18n } from "../context/I18nContext";
import type { GameConfig, GameCategory, GameMode, Language } from "../types/game";
import { TIMED_MODES, PASSAGE_MODES, TIME_OPTIONS, WORD_OPTIONS, LANGUAGES, defaultConfig } from "../types/game";

export type { GameConfig, GameMode, Language } from "../types/game";

export default function HomePage() {
  const navigate = useNavigate();
  const { language, setLanguage } = useLanguage();
  const { t } = useI18n();
  const config = useState<GameConfig>(defaultConfig)[0];
  const [category, setCategory] = useState<GameCategory>(config.category);
  const [mode, setMode] = useState<GameMode>(config.mode);
  const [timeLimit, setTimeLimit] = useState(config.timeLimit);
  const [wordCount, setWordCount] = useState(config.wordCount);
  const [mounted, setMounted] = useState(false);
  const readyRef = useRef(false);

  const activeModes = category === "timed" ? TIMED_MODES : PASSAGE_MODES;

  const configRef = useRef({ category, mode, language, timeLimit, wordCount });
  configRef.current = { category, mode, language, timeLimit, wordCount };

  useEffect(() => { setMounted(true); }, []);

  const handleStart = () => {
    if (readyRef.current) return;
    readyRef.current = true;
    navigate("/game", { state: { config: configRef.current } });
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== "Enter" || readyRef.current) return;
      readyRef.current = true;
      navigate("/game", { state: { config: configRef.current } });
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [navigate]);

  useEffect(() => {
    if (category !== configRef.current.category) {
      const first = activeModes[0];
      if (first) setMode(first.id);
    }
  }, [category]);

  const fade = `transition-all duration-700 ease-out ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5"}`;

  return (
    <div className="flex flex-col items-center pt-20 px-4 pb-16 select-none">
      {/* Header */}
      <div className={`text-center mb-12 ${fade}`} style={{ transitionDelay: "0ms" }}>
        <h1 className="text-5xl font-bold tracking-[0.08em] text-[var(--text-primary)]">
          NLType
        </h1>
        <p className="text-[var(--text-tertiary)] text-sm tracking-[0.2em] mt-3">
          {t("home.subtitle")}
        </p>
      </div>

      {/* Card */}
      <div className={`w-full max-w-[780px] bg-card rounded-2xl shadow-card p-10 ${fade}`} style={{ transitionDelay: "100ms" }}>
        {/* Category toggle */}
        <div className="flex items-center justify-center gap-1 mb-6 bg-[var(--bg-alt)] rounded-full p-1 w-fit mx-auto">
          <button onClick={() => setCategory("timed")}
            className={`px-5 py-1.5 text-sm tracking-[0.15em] rounded-full transition-all font-mono ${
              category === "timed"
                ? "             bg-[var(--accent)] text-white shadow-sm"
                : "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
            }`}>
            {t("home.categoryTimed")}
          </button>
          <button onClick={() => setCategory("passage")}
            className={`px-5 py-1.5 text-sm tracking-[0.15em] rounded-full transition-all font-mono ${
              category === "passage"
                ? "bg-[var(--accent)] text-white shadow-sm"
                : "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
            }`}>
            {t("home.categoryPassage")}
          </button>
        </div>

        {/* Mode tabs */}
        <div className="flex items-center justify-center gap-2 mb-6">
          {activeModes.map((m) => (
            <button key={m.id}
              onClick={() => setMode(m.id)}
              className={`px-4 py-1.5 text-sm tracking-[0.15em] rounded-full transition-all duration-200 font-mono ${
                mode === m.id
                  ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                  : "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
              }`}>
              {t(`mode.${m.id}`)}
            </button>
          ))}
        </div>

        <div className="h-px bg-[var(--border)] mb-6" />

        {/* Options */}
        <div className="flex items-center justify-center gap-3 min-h-[38px] mb-8">
          {mode === "time" && TIME_OPTIONS.map((t) => (
            <button key={t} onClick={() => setTimeLimit(t)}
              className={`px-4 py-1.5 text-sm tracking-wider rounded-lg transition-all font-mono ${
                timeLimit === t ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
              }`}>
              {t}s
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
          {mode === "zen" && <span className="text-[var(--text-tertiary)] text-sm tracking-wider font-mono">{t("home.zenMode")}</span>}
          {mode === "quote" && <span className="text-[var(--text-tertiary)] text-sm tracking-wider font-mono">{t("home.quoteMode")}</span>}
        </div>

        {/* Language */}
        <div className="flex items-center justify-center gap-4 mb-8">
          <span className="text-[var(--text-tertiary)] text-xs tracking-[0.15em] uppercase">{t("home.language")}</span>
          <div className="flex items-center gap-1.5">
            {LANGUAGES.map((l, i) => (
              <span key={l.id}>
                <button onClick={() => setLanguage(l.id)}
                  className={`px-4 py-1.5 text-sm tracking-wider rounded-lg transition-all font-mono ${
                    language === l.id ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
                  }`}>
                  {t(`lang.${l.id}`)}
                </button>
                {i < LANGUAGES.length - 1 && <span className="text-[var(--border)] text-xs mx-1">/</span>}
              </span>
            ))}
          </div>
        </div>

        {/* Start */}
        <button onClick={handleStart}
          className="w-full py-4 rounded-xl bg-[var(--accent)] text-white text-base tracking-[0.15em] font-medium hover:opacity-90 transition-all">
          {t("home.start")}
        </button>
      </div>

      {/* Footer */}
      <p className="fixed bottom-6 text-[var(--text-tertiary)] text-xs tracking-[0.2em]">
        {t(`lang.${language}`)} ·{" "}
        {language !== "code" && (mode === "time" ? `${timeLimit}${t("general.seconds")}` : mode === "words" ? `${wordCount}${t("general.words")}` : mode === "quote" ? t("general.quote") : mode) + " · "}
        {category === "timed" ? t("home.footerTimed") : t("home.footerPassage")}
      </p>
    </div>
  );
}
