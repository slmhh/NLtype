export type GameMode = "time" | "words" | "quote" | "code" | "zen";
export type Language = "en" | "zh";

export interface GameConfig {
  mode: GameMode;
  language: Language;
  timeLimit: number;
  wordCount: number;
}

export interface ModeEntry {
  id: GameMode;
  label: string;
  enabled: boolean;
}

export const MODES: ModeEntry[] = [
  { id: "time", label: "时间", enabled: true },
  { id: "words", label: "单词", enabled: true },
  { id: "quote", label: "引用", enabled: false },
  { id: "code", label: "代码", enabled: false },
  { id: "zen", label: "禅", enabled: true },
];

export const TIME_OPTIONS = [15, 30, 60, 120] as const;
export const WORD_OPTIONS = [10, 25, 50, 100, 200] as const;

export function defaultConfig(): GameConfig {
  return { mode: "time", language: "en", timeLimit: 30, wordCount: 50 };
}
