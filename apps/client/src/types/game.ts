export type GameCategory = "timed" | "passage" | "custom";
export type GameMode = "time" | "zen" | "words" | "quote" | "custom";
export type Language = "en" | "zh" | "code";
export type CodeLang = "typescript" | "javascript" | "python" | "rust" | "go" | "c" | "cpp" | "csharp" | "html" | "css" | "sql";

export const CODE_LANGUAGES: CodeLang[] = [
  "typescript", "javascript", "python", "rust", "go", "c", "cpp", "csharp", "html", "css", "sql",
];

export interface GameConfig {
  category: GameCategory;
  mode: GameMode;
  language: Language;
  timeLimit: number;
  wordCount: number;
  customText?: string;
  codeLang?: CodeLang;
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
export const MAX_TIME_LIMIT = 3600; // 1 hour, matches backend cap

export function defaultConfig(): GameConfig {
  return { category: "timed", mode: "time", language: "en", timeLimit: 30, wordCount: 50 };
}

const MAX_CUSTOM_LENGTH = 5000;

export function sanitizeCustomText(input: string): string {
  // Strip null bytes and control characters (keep \t, \n, \r)
  let text = input.replace(/[\0-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
  // Normalize line endings to \n
  text = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  // Collapse 3+ consecutive newlines into 2
  text = text.replace(/\n{3,}/g, "\n\n");
  // Limit length
  text = text.slice(0, MAX_CUSTOM_LENGTH).trim();
  return text;
}
