import { api } from "./api";

export interface DailyChallenge {
  challengeId: number;
  date: string;
  text: string;
  alreadyDone: boolean;
}

export interface DailyAttempt {
  wpm: number;
  accuracy: number;
  cpm: number;
  rawWpm: number;
  correctCount: number;
  incorrectCount: number;
  durationSec: number;
}

export interface DailyLeaderboardEntry {
  rank: number;
  username: string;
  wpm: number;
  accuracy: number;
  cpm: number;
  correctCount: number;
  incorrectCount: number;
  durationSec: number;
  date: string;
}

export async function getDailyChallenge(token: string): Promise<DailyChallenge> {
  return api<DailyChallenge>("/api/daily", { token });
}

export async function submitDailyAttempt(token: string, challengeId: number, stats: DailyAttempt): Promise<void> {
  await api("/api/daily/attempt", {
    method: "POST",
    body: { challengeId, ...stats },
    token,
  });
}

export async function getDailyLeaderboard(token: string): Promise<DailyLeaderboardEntry[]> {
  const data = await api<{ entries: DailyLeaderboardEntry[] }>("/api/daily/leaderboard", { token });
  return data.entries;
}
