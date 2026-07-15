export type GameCategory = "timed" | "passage";
export type GameMode = "time" | "zen" | "words" | "quote";
export type Language = "en" | "zh" | "code";

export interface GameConfig {
  category: GameCategory;
  mode: GameMode;
  language: Language;
  timeLimit: number;
  wordCount: number;
}

export interface ModeEntry {
  id: GameMode;
  label: string;
}

export const TIMED_MODES: ModeEntry[] = [
  { id: "time", label: "time" },
  { id: "zen", label: "zen" },
];

export const PASSAGE_MODES: ModeEntry[] = [
  { id: "words", label: "words" },
  { id: "quote", label: "quote" },
];

export const LANGUAGES: { id: Language; label: string }[] = [
  { id: "en", label: "en" },
  { id: "zh", label: "zh" },
  { id: "code", label: "code" },
];

export const TIME_OPTIONS = [15, 30, 60, 120] as const;
export const WORD_OPTIONS = [10, 25, 50, 100, 200] as const;

export function defaultConfig(): GameConfig {
  return { category: "timed", mode: "time", language: "en", timeLimit: 30, wordCount: 50 };
}
