import type { GameResult } from "../types/results";
import { getResults } from "./results";

export interface ProfileStats {
  totalGames: number;
  avgWpm: number;
  maxWpm: number;
  avgAccuracy: number;
  totalTimeSec: number;
  recentResults: GameResult[];
}

export function getProfileStats(limit = 20): ProfileStats {
  const all = getResults();

  if (all.length === 0) {
    return { totalGames: 0, avgWpm: 0, maxWpm: 0, avgAccuracy: 0, totalTimeSec: 0, recentResults: [] };
  }

  const maxWpm = Math.max(...all.map((r) => r.wpm));
  const avgWpm = Math.round(all.reduce((s, r) => s + r.wpm, 0) / all.length);
  const avgAccuracy = Math.round(all.reduce((s, r) => s + r.accuracy, 0) / all.length);
  const totalTimeSec = all.reduce((s, r) => s + r.durationSec, 0);

  return {
    totalGames: all.length,
    avgWpm,
    maxWpm,
    avgAccuracy,
    totalTimeSec,
    recentResults: all.slice(0, limit),
  };
}
