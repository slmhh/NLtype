import { useMemo, useState, useCallback } from "react";
import TypingGame from "../components/TypingGame";
import { englishWords } from "../data/en";
import { getChineseText } from "../data/zh";
import type { GameConfig } from "./HomePage";

interface GamePageProps {
  config: GameConfig;
  onBack: () => void;
}

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
  if (config.language === "zh") {
    return getChineseText();
  }

  switch (config.mode) {
    case "words":
      return generateEnglishWords(config.wordCount);
    case "time":
      return generateEnglishTime(config.timeLimit);
    case "zen":
      return generateEnglishTime(120);
    default:
      return generateEnglishTime(config.timeLimit);
  }
}

export default function GamePage({ config, onBack }: GamePageProps) {
  const [key, setKey] = useState(0);
  const text = useMemo(() => generateText(config), [config, key]);

  const handleRetry = useCallback(() => {
    setKey((k) => k + 1);
  }, []);

  return (
    <TypingGame
      key={key}
      text={text}
      language={config.language}
      timeLimit={config.mode === "zen" || config.mode === "words" ? 0 : config.timeLimit}
      onRetry={handleRetry}
      onBack={onBack}
    />
  );
}
