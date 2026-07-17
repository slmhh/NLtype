import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "../context/LanguageContext";
import { useAuth } from "../context/AuthContext";
import { useI18n } from "../context/I18nContext";
import type { GameConfig, GameCategory, GameMode, Language } from "../types/game";
import { TIMED_MODES, PASSAGE_MODES, TIME_OPTIONS, WORD_OPTIONS, LANGUAGES, defaultConfig, sanitizeCustomText } from "../types/game";

export type { GameConfig, GameMode, Language } from "../types/game";

export default function HomePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { language, setLanguage } = useLanguage();
  const { t } = useI18n();
  const config = useState<GameConfig>(defaultConfig)[0];
  const [category, setCategory] = useState<GameCategory>(config.category);
  const [mode, setMode] = useState<GameMode>(config.mode);
  const [timeLimit, setTimeLimit] = useState(config.timeLimit);
  const [wordCount, setWordCount] = useState(config.wordCount);
  const [customText, setCustomText] = useState("");
  const [customError, setCustomError] = useState("");
  const [customTimerEnabled, setCustomTimerEnabled] = useState(false);
  const [customTimeLimit, setCustomTimeLimit] = useState(30);
  const [timeInputStr, setTimeInputStr] = useState("30");
  const [mounted, setMounted] = useState(false);
  const readyRef = useRef(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const activeModes = category === "timed" ? TIMED_MODES : PASSAGE_MODES;

  const timerLimit = customTimerEnabled ? customTimeLimit : 0;

  const configRef = useRef({ category, mode, language, timeLimit, wordCount, customText: "" });
  configRef.current = { category, mode, language, timeLimit: timerLimit, wordCount, customText };

  useEffect(() => { setMounted(true); }, []);

  const validateTimeLimit = useCallback((val: number): string | null => {
    if (!customTimerEnabled) return null;
    if (!Number.isInteger(val) || val <= 0) return t("home.customTimerInvalid");
    if (val > 3600) return t("home.customTimerMax", { max: 3600 });
    return null;
  }, [customTimerEnabled, t]);

  const handleStart = useCallback(() => {
    if (readyRef.current) return;
    if (category === "custom") {
      const sanitized = sanitizeCustomText(customText);
      if (!sanitized) {
        setCustomError(t("home.customEmpty"));
        return;
      }
      const timeErr = validateTimeLimit(customTimeLimit);
      if (timeErr) {
        setCustomError(timeErr);
        return;
      }
      setCustomError("");
      readyRef.current = true;
      navigate("/game", { state: { config: { ...configRef.current, customText: sanitized, language: "en" as Language, timeLimit: timerLimit } } });
      return;
    }
    readyRef.current = true;
    navigate("/game", { state: { config: configRef.current } });
  }, [category, customText, customTimeLimit, timerLimit, navigate, t, validateTimeLimit]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== "Enter" || readyRef.current) return;
      if (category === "custom") {
        const sanitized = sanitizeCustomText(customText);
        if (!sanitized) return;
        const timeErr = validateTimeLimit(customTimeLimit);
        if (timeErr) return;
        readyRef.current = true;
        navigate("/game", { state: { config: { ...configRef.current, customText: sanitized, language: "en" as Language, timeLimit: timerLimit } } });
      } else {
        readyRef.current = true;
        navigate("/game", { state: { config: configRef.current } });
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [navigate, category, customText, customTimeLimit, timerLimit, validateTimeLimit]);

  useEffect(() => {
    if (category !== "custom" && category !== configRef.current.category) {
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

      {/* Daily challenge callout */}
      {user && (
        <div className={`w-full max-w-[780px] mb-4 ${fade}`} style={{ transitionDelay: "50ms" }}>
          <button
            onClick={() => navigate("/daily")}
            className="w-full flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-[var(--accent-soft)] to-transparent border border-[var(--accent)]/20 hover:border-[var(--accent)]/40 transition-all group"
          >
            <div className="flex items-center gap-3">
              <span className="text-lg">🔥</span>
              <div className="text-left">
                <p className="text-sm font-semibold text-[var(--text-primary)] tracking-wider">{t("daily.title")}</p>
                <p className="text-xs text-[var(--text-tertiary)] mt-0.5">{t("home.dailyDesc")}</p>
              </div>
            </div>
            <span className="text-xs text-[var(--accent)] group-hover:translate-x-1 transition-transform">
              {t("home.dailyGo")} →
            </span>
          </button>
        </div>
      )}

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
          <button onClick={() => setCategory("custom")}
            className={`px-5 py-1.5 text-sm tracking-[0.15em] rounded-full transition-all font-mono ${
              category === "custom"
                ? "bg-[var(--accent)] text-white shadow-sm"
                : "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
            }`}>
            {t("home.categoryCustom")}
          </button>
        </div>

        {category === "custom" ? (
          <div className="mb-6">
            <textarea
              ref={textareaRef}
              value={customText}
              onChange={(e) => setCustomText(e.target.value)}
              placeholder={t("home.customPlaceholder")}
              className="w-full h-40 p-4 rounded-xl bg-[var(--bg-alt)] border border-[var(--border)] text-sm font-mono resize-none focus:outline-none focus:border-[var(--accent)] transition-colors"
              maxLength={5000}
            />
            <div className="flex items-center justify-between mt-2">
              <span className="text-xs text-[var(--text-tertiary)]">
                {customText.length}/5000
              </span>
              <span className="text-xs text-[var(--text-tertiary)]">
                {t("home.customNote")}
              </span>
            </div>
            {customError && (
              <p className="text-red-500 text-xs mt-2">{customError}</p>
            )}

            {/* Timer toggle for custom mode */}
            <div className="mt-4 flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={customTimerEnabled}
                  onChange={(e) => setCustomTimerEnabled(e.target.checked)}
                  className="w-4 h-4 rounded border-[var(--border)] text-[var(--accent)] focus:ring-[var(--accent)]"
                />
                <span className="text-sm text-[var(--text-secondary)] tracking-[0.05em]">
                  {t("home.customTimerLabel")}
                </span>
              </label>
            </div>

            {customTimerEnabled && (
              <div className="mt-3 flex items-center gap-3">
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      const next = Math.max(1, customTimeLimit - 5);
                      setCustomTimeLimit(next);
                      setTimeInputStr(String(next));
                    }}
                    className="w-8 h-8 rounded-lg bg-[var(--bg-alt)] border border-[var(--border)] text-sm hover:border-[var(--accent)] transition-colors"
                  >
                    −
                  </button>
                  <input
                    type="number"
                    value={timeInputStr}
                    onChange={(e) => {
                      const raw = e.target.value;
                      setTimeInputStr(raw);
                      const n = parseInt(raw, 10);
                      if (!isNaN(n) && n >= 1 && n <= 3600) {
                        setCustomTimeLimit(n);
                      }
                    }}
                    onBlur={() => {
                      const n = parseInt(timeInputStr, 10);
                      if (isNaN(n) || n < 1) { setCustomTimeLimit(1); setTimeInputStr("1"); }
                      else if (n > 3600) { setCustomTimeLimit(3600); setTimeInputStr("3600"); }
                      else { setCustomTimeLimit(n); setTimeInputStr(String(n)); }
                    }}
                    className="w-16 h-8 text-center rounded-lg bg-[var(--bg-alt)] border border-[var(--border)] text-sm font-mono focus:outline-none focus:border-[var(--accent)] [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    min={1}
                    max={3600}
                  />
                  <button
                    onClick={() => {
                      const next = Math.min(3600, customTimeLimit + 5);
                      setCustomTimeLimit(next);
                      setTimeInputStr(String(next));
                    }}
                    className="w-8 h-8 rounded-lg bg-[var(--bg-alt)] border border-[var(--border)] text-sm hover:border-[var(--accent)] transition-colors"
                  >
                    +
                  </button>
                </div>
                <span className="text-xs text-[var(--text-tertiary)]">{t("home.customTimerUnit")}</span>
              </div>
            )}
          </div>
        ) : (
          <>
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
          </>
        )}

        {/* Start */}
        <button onClick={handleStart}
          className="w-full py-4 rounded-xl bg-[var(--accent)] text-white text-base tracking-[0.15em] font-medium hover:opacity-90 transition-all">
          {t("home.start")}
        </button>
      </div>

      {/* Footer */}
      <p className="fixed bottom-6 text-[var(--text-tertiary)] text-xs tracking-[0.2em]">
        {t(`lang.${language}`)} ·{" "}
        {category === "custom" ? t("home.categoryCustom") : language !== "code" ? (mode === "time" ? `${timeLimit}${t("general.seconds")}` : mode === "words" ? `${wordCount}${t("general.words")}` : mode === "quote" ? t("general.quote") : t(`mode.${mode}`)) + " · " : ""}
        {category === "timed" ? t("home.footerTimed") : category === "passage" ? t("home.footerPassage") : ""}
      </p>
    </div>
  );
}
