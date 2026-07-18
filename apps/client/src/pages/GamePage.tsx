import { useMemo, useState, useCallback, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import TypingGame from "../components/TypingGame";
import { getChineseText } from "../data/zh";
import { getRandomCodeSnippet } from "../data/code";
import { getRandomQuote } from "../data/quotes";
import { getApprovedEntries } from "../services/entries";
import type { GameConfig, CodeLang } from "../types/game";

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateEnglishWords(count: number, pool: string[]): string {
  const words: string[] = [];
  for (let i = 0; i < count; i++) {
    words.push(pickRandom(pool));
  }
  return words.join(" ");
}

function generateEnglishTime(timeLimit: number, pool: string[]): string {
  const targetLen = timeLimit <= 15 ? 80 : timeLimit <= 30 ? 200 : timeLimit <= 60 ? 400 : 800;
  const words: string[] = [];
  let len = 0;
  while (len < targetLen) {
    const w = pickRandom(pool);
    words.push(w);
    len += w.length + 1;
  }
  return words.slice(0, -1).join(" ");
}

function makeText(config: GameConfig, enEntries: string[], zhEntries: string[], codeEntries: string[], enWordsFallback: string[]): string {
  // Custom text mode — use pasted text directly
  if (config.customText) {
    return config.customText;
  }

  if (config.language === "code") {
    const codeLang: CodeLang = config.codeLang || "typescript";
    // Use server entries first, fallback to local snippets
    if (codeEntries.length > 0) {
      return codeEntries[Math.floor(Math.random() * codeEntries.length)];
    }
    return getRandomCodeSnippet(codeLang);
  }
  if (config.language === "zh") {
    return zhEntries.length > 0 ? pickRandom(zhEntries) : getChineseText();
  }

  // Build word pool from approved entries or server fallback
  const pool = enEntries.length > 0
    ? enEntries.flatMap((e) => e.split(/\s+/).filter(Boolean))
    : (enWordsFallback ?? []);

  switch (config.mode) {
    case "quote":
      return enEntries.length > 0 ? pickRandom(enEntries) : getRandomQuote();
    case "words":
      return generateEnglishWords(config.wordCount, pool);
    case "time":
      return generateEnglishTime(config.timeLimit, pool);
    case "zen":
      return generateEnglishTime(120, pool);
    default:
      return generateEnglishTime(30, pool);
  }
}

export default function GamePage() {
  const location = useLocation();
  const navigate = useNavigate();
  const stored = (location.state as { config?: GameConfig })?.config;
  const [key, setKey] = useState(0);
  const [enEntries, setEnEntries] = useState<string[]>([]);
  const [zhEntries, setZhEntries] = useState<string[]>([]);
  const [codeEntries, setCodeEntries] = useState<string[]>([]);
  const [enWordsFallback, setEnWordsFallback] = useState<string[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!stored) { navigate("/", { replace: true }); return; }
    const enPromise = getApprovedEntries("en").then((entries) => entries.map((e) => e.content));
    const zhPromise = getApprovedEntries("zh").then((entries) => entries.map((e) => e.content));
    const codePromise = stored.codeLang
      ? getApprovedEntries("code", stored.codeLang).then((entries) => entries.map((e) => e.content))
      : Promise.resolve<string[]>([]);
    const wordsPromise = fetch("/api/text/words")
      .then((r) => r.json())
      .then((d: { words: string[] }) => d.words)
      .catch(() => [] as string[]);
    Promise.all([enPromise, zhPromise, codePromise, wordsPromise]).then(([en, zh, code, words]) => {
      setEnEntries(en);
      setZhEntries(zh);
      setCodeEntries(code);
      setEnWordsFallback(words);
      setReady(true);
    });
  }, [stored, navigate]);

  const config = stored!;
  const text = useMemo(() => makeText(config, enEntries, zhEntries, codeEntries, enWordsFallback), [config, enEntries, zhEntries, codeEntries, enWordsFallback, key]);

  const handleRetry = useCallback(() => {
    setKey((k) => k + 1);
  }, []);

  const handleBack = useCallback(() => {
    navigate("/");
  }, [navigate]);

  if (!stored || !ready) return null;

  const noTimer = config.mode === "zen" || config.mode === "words" || config.mode === "quote" || config.mode === "custom";

  return (
    <TypingGame
      key={key}
      text={text}
      language={config.language}
      timeLimit={noTimer ? 0 : config.timeLimit}
      gameConfig={config}
      onRetry={handleRetry}
      onBack={handleBack}
    />
  );
}
