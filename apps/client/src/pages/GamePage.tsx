import { useMemo, useState, useCallback, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import TypingGame from "../components/TypingGame";
import { englishWords } from "../data/en";
import { getChineseText } from "../data/zh";
import { getRandomCodeSnippet } from "../data/code";
import { getRandomQuote } from "../data/quotes";
import type { GameConfig } from "../types/game";

function generateEnglishWords(count: number): string {
  const words: string[] = [];
  for (let i = 0; i < count; i++) {
    words.push(englishWords[Math.floor(Math.random() * englishWords.length)]);
  }
  return words.join(" ");
}

function generateEnglishTime(timeLimit: number): string {
  const targetLen = timeLimit <= 15 ? 80 : timeLimit <= 30 ? 200 : timeLimit <= 60 ? 400 : 800;
  const words: string[] = [];
  let len = 0;
  while (len < targetLen) {
    const w = englishWords[Math.floor(Math.random() * englishWords.length)];
    words.push(w);
    len += w.length + 1;
  }
  return words.slice(0, -1).join(" ");
}

function generateText(config: GameConfig): string {
  if (config.language === "code") {
    return getRandomCodeSnippet();
  }
  if (config.language === "zh") {
    return getChineseText();
  }
  switch (config.mode) {
    case "quote":
      return getRandomQuote();
    case "words":
      return generateEnglishWords(config.wordCount);
    case "time":
      return generateEnglishTime(config.timeLimit);
    case "zen":
      return generateEnglishTime(120);
  }
}

export default function GamePage() {
  const location = useLocation();
  const navigate = useNavigate();
  const stored = (location.state as { config?: GameConfig })?.config;
  const [key, setKey] = useState(0);

  useEffect(() => {
    if (!stored) {
      navigate("/", { replace: true });
    }
  }, [stored, navigate]);

  const config = stored!;

  const text = useMemo(() => generateText(config), [config, key]);

  const handleRetry = useCallback(() => {
    setKey((k) => k + 1);
  }, []);

  const handleBack = useCallback(() => {
    navigate("/");
  }, [navigate]);

  if (!stored) return null;

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
