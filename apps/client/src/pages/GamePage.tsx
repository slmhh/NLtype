import { useMemo, useState, useCallback, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import TypingGame from "../components/TypingGame";
import { englishWords } from "../data/en";
import { getChineseText } from "../data/zh";
import { getRandomCodeSnippet } from "../data/code";
import { getRandomQuote } from "../data/quotes";
import { getApprovedEntries } from "../services/entries";
import type { GameConfig } from "../types/game";

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateEnglishWords(count: number, pool?: string[]): string {
  const source = pool ?? englishWords;
  const words: string[] = [];
  for (let i = 0; i < count; i++) {
    words.push(pickRandom(source));
  }
  return words.join(" ");
}

function generateEnglishTime(timeLimit: number, pool?: string[]): string {
  const source = pool ?? englishWords;
  const targetLen = timeLimit <= 15 ? 80 : timeLimit <= 30 ? 200 : timeLimit <= 60 ? 400 : 800;
  const words: string[] = [];
  let len = 0;
  while (len < targetLen) {
    const w = pickRandom(source);
    words.push(w);
    len += w.length + 1;
  }
  return words.slice(0, -1).join(" ");
}

function makeText(config: GameConfig, enEntries: string[], zhEntries: string[], codeEntries: string[]): string {
  if (config.language === "code") {
    return codeEntries.length > 0 ? pickRandom(codeEntries) : getRandomCodeSnippet();
  }
  if (config.language === "zh") {
    return zhEntries.length > 0 ? pickRandom(zhEntries) : getChineseText();
  }

  // Build word pool from approved entries or local data
  const pool = enEntries.length > 0 ? enEntries.flatMap((e) => e.split(/\s+/).filter(Boolean)) : englishWords;

  switch (config.mode) {
    case "quote":
      return enEntries.length > 0 ? pickRandom(enEntries) : getRandomQuote();
    case "words":
      return generateEnglishWords(config.wordCount, pool);
    case "time":
      return generateEnglishTime(config.timeLimit, pool);
    case "zen":
      return generateEnglishTime(120, pool);
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
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!stored) { navigate("/", { replace: true }); return; }
    Promise.all([
      getApprovedEntries("en"),
      getApprovedEntries("zh"),
      getApprovedEntries("code"),
    ]).then(([en, zh, code]) => {
      setEnEntries(en);
      setZhEntries(zh);
      setCodeEntries(code);
      setReady(true);
    });
  }, [stored, navigate]);

  const config = stored!;
  const text = useMemo(() => makeText(config, enEntries, zhEntries, codeEntries), [config, enEntries, zhEntries, codeEntries, key]);

  const handleRetry = useCallback(() => {
    setKey((k) => k + 1);
  }, []);

  const handleBack = useCallback(() => {
    navigate("/");
  }, [navigate]);

  if (!stored || !ready) return null;

  const noTimer = config.mode === "zen" || config.mode === "words" || config.mode === "quote" || config.language === "code";

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
