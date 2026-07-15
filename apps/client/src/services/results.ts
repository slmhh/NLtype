import type { GameResult, LeaderboardEntry, PersonalBest } from "../types/results";
import type { GameConfig } from "../types/game";
import { load, save } from "./storage";
import { api } from "./api";

const LOCAL_KEY = "results";

function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function localResults(): GameResult[] {
  return load<GameResult[]>(LOCAL_KEY, []);
}

function pushLocal(r: GameResult) {
  const all = localResults();
  all.unshift(r);
  save(LOCAL_KEY, all);
}

const MODE_LABEL: Record<string, string> = { time: "计时", words: "单词", quote: "引用", code: "代码", zen: "禅" };
const LANG_LABEL: Record<string, string> = { en: "EN", zh: "ZH", code: "Code" };

function toGameResult(r: any): GameResult {
  return {
    id: String(r.id),
    createdAt: r.createdAt || new Date(r.timestamp).toISOString(),
    mode: r.mode,
    language: r.language,
    wpm: r.wpm,
    accuracy: r.accuracy,
    cpm: r.cpm,
    rawWpm: r.rawWpm,
    correctCount: r.correctCount,
    incorrectCount: r.incorrectCount,
    durationSec: r.durationSec,
  };
}

/** Save a result — uses server API when authenticated, localStorage fallback */
export async function saveResult(
  config: GameConfig,
  stats: Omit<GameResult, "id" | "createdAt" | "mode" | "language" | "durationSec"> & { durationSec: number },
  token?: string | null,
): Promise<GameResult> {
  if (token) {
    const data = await api<{ result: any }>("/api/results", {
      method: "POST",
      body: {
        mode: config.mode,
        language: config.language,
        wpm: stats.wpm,
        accuracy: stats.accuracy,
        cpm: stats.cpm,
        rawWpm: stats.rawWpm,
        correctCount: stats.correctCount,
        incorrectCount: stats.incorrectCount,
        durationSec: stats.durationSec,
      },
      token,
    });
    return toGameResult(data.result);
  }

  // localStorage fallback
  const result: GameResult = {
    id: uid(),
    createdAt: new Date().toISOString(),
    mode: config.mode,
    language: config.language,
    durationSec: stats.durationSec,
    wpm: stats.wpm,
    accuracy: stats.accuracy,
    cpm: stats.cpm,
    rawWpm: stats.rawWpm,
    correctCount: stats.correctCount,
    incorrectCount: stats.incorrectCount,
  };
  pushLocal(result);
  return result;
}

/** Get results for the current user */
export async function getResults(token?: string | null): Promise<GameResult[]> {
  if (token) {
    const data = await api<{ results: any[] }>("/api/results", { token });
    return data.results.map(toGameResult);
  }
  return localResults();
}

/** Get personal bests per mode+language */
export async function getPersonalBests(token: string): Promise<PersonalBest[]> {
  try {
    const data = await api<{ bests: PersonalBest[] }>("/api/results/best", { token });
    return data.bests;
  } catch {
    return [];
  }
}

/** Get global leaderboard */
export async function getLeaderboard(limit = 20, _token?: string | null, after?: string, before?: string): Promise<LeaderboardEntry[]> {
  try {
    let path = `/api/results/leaderboard?limit=${limit}`;
    if (after) path += `&after=${encodeURIComponent(after)}`;
    if (before) path += `&before=${encodeURIComponent(before)}`;
    const data = await api<{ entries: LeaderboardEntry[] }>(path);
    return data.entries;
  } catch {
    // fall through to local
  }

  // localStorage fallback
  const all = localResults();
  const sorted = [...all].sort((a, b) => b.wpm - a.wpm).slice(0, limit);
  return sorted.map((r, i) => ({
    rank: i + 1,
    username: "",
    wpm: r.wpm,
    accuracy: r.accuracy,
    modeLabel: MODE_LABEL[r.mode] ?? r.mode,
    langLabel: LANG_LABEL[r.language] ?? r.language,
    date: new Date(r.createdAt).toLocaleDateString(),
  }));
}

/** Clear results — uses API when authenticated, localStorage otherwise */
export async function clearResults(token?: string | null): Promise<void> {
  if (token) {
    await api("/api/results", { method: "DELETE", token });
    return;
  }
  save(LOCAL_KEY, []);
}
