export interface GameResult {
  wpm: number;
  accuracy: number;
  cpm: number;
  rawWpm: number;
  timeSeconds: number;
  correctChars: number;
  incorrectChars: number;
  missedChars: number;
  mode: "time" | "words" | "quote";
  language: "en" | "zh";
  timestamp: number;
}

export interface PlayerProgress {
  position: number;
  total: number;
  wpm: number;
  accuracy: number;
}

export type GameMode = "time" | "words" | "quote";
export type Language = "en" | "zh";
