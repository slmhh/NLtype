import { useCallback, useRef, useState } from "react";
import type { GameResult, LeaderboardEntry } from "../types/results";
import type { GameConfig } from "../types/game";
import { load, save } from "./storage";

const KEY = "results";

function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function getResults(): GameResult[] {
  return load<GameResult[]>(KEY, []);
}

function pushResult(r: GameResult) {
  const all = getResults();
  all.unshift(r);
  save(KEY, all);
}

export function saveResult(config: GameConfig, stats: Omit<GameResult, "id" | "timestamp" | "mode" | "language" | "durationSec"> & { durationSec: number }): GameResult {
  const result: GameResult = {
    id: uid(),
    timestamp: Date.now(),
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
  pushResult(result);
  return result;
}

export function clearResults() {
  save(KEY, []);
}

export function getLeaderboard(limit = 20): LeaderboardEntry[] {
  const all = getResults();
  const sorted = [...all].sort((a, b) => b.wpm - a.wpm).slice(0, limit);
  return sorted.map((r, i) => ({
    rank: i + 1,
    wpm: r.wpm,
    accuracy: r.accuracy,
    modeLabel: modeLabel(r.mode),
    langLabel: r.language === "en" ? "EN" : "ZH",
    date: new Date(r.timestamp).toLocaleDateString(),
  }));
}

function modeLabel(m: GameResult["mode"]) {
  const map: Record<string, string> = { time: "计时", words: "单词", quote: "引用", code: "代码", zen: "禅" };
  return map[m] ?? m;
}

export function useResults() {
  const [results, setResults] = useState<GameResult[]>(() => getResults());
  const savedRef = useRef(false);

  const add = useCallback((config: GameConfig, stats: Omit<GameResult, "id" | "timestamp" | "mode" | "language" | "durationSec"> & { durationSec: number }) => {
    const r = saveResult(config, stats);
    setResults((prev) => [r, ...prev]);
    savedRef.current = true;
  }, []);

  return { results, add, saved: savedRef.current };
}
