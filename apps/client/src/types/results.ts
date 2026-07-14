import type { GameMode, Language } from "./game";

export interface GameResult {
  id: string;
  createdAt: string;
  mode: GameMode;
  language: Language;
  wpm: number;
  accuracy: number;
  cpm: number;
  rawWpm: number;
  correctCount: number;
  incorrectCount: number;
  durationSec: number;
}

export interface LeaderboardEntry {
  rank: number;
  username: string;
  wpm: number;
  accuracy: number;
  modeLabel: string;
  langLabel: string;
  date: string;
}
