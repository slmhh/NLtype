import type { GameMode, Language } from "./game";

export interface PersonalBest {
  mode: string;
  language: string;
  wpm: number;
  accuracy: number;
  cpm: number;
  rawWpm: number;
  correctCount: number;
  incorrectCount: number;
  durationSec: number;
  createdAt: string;
}

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
