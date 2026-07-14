import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "data");
const RESULTS_FILE = join(DATA_DIR, "results.json");

export interface ServerResult {
  id: number;
  userId: number;
  username: string;
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

export interface LeaderboardEntry {
  rank: number;
  wpm: number;
  accuracy: number;
  modeLabel: string;
  langLabel: string;
  date: string;
  username: string;
}

function ensureDataDir() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

function loadResults(): ServerResult[] {
  ensureDataDir();
  if (!existsSync(RESULTS_FILE)) {
    writeFileSync(RESULTS_FILE, "[]", "utf-8");
    return [];
  }
  try {
    return JSON.parse(readFileSync(RESULTS_FILE, "utf-8"));
  } catch {
    return [];
  }
}

function saveResults(results: ServerResult[]) {
  ensureDataDir();
  writeFileSync(RESULTS_FILE, JSON.stringify(results, null, 2), "utf-8");
}

let nextId = loadResults().reduce((max, r) => Math.max(max, r.id), 0) + 1;

export function createResult(data: Omit<ServerResult, "id" | "createdAt">): ServerResult {
  const results = loadResults();
  const result: ServerResult = { id: nextId++, ...data, createdAt: new Date().toISOString() };
  results.unshift(result);
  saveResults(results);
  return result;
}

export function getResultsByUser(userId: number, limit = 50): ServerResult[] {
  return loadResults().filter((r) => r.userId === userId).slice(0, limit);
}

export function getLeaderboard(limit = 20): LeaderboardEntry[] {
  const all = loadResults();
  const sorted = [...all].sort((a, b) => b.wpm - a.wpm).slice(0, limit);
  return sorted.map((r, i) => ({
    rank: i + 1,
    wpm: r.wpm,
    accuracy: r.accuracy,
    modeLabel: modeLabel(r.mode),
    langLabel: langLabel(r.language),
    date: new Date(r.createdAt).toLocaleDateString(),
    username: r.username,
  }));
}

export function clearAllResults() {
  saveResults([]);
}

function modeLabel(m: string): string {
  const map: Record<string, string> = { time: "计时", words: "单词", quote: "引用", code: "代码", zen: "禅" };
  return map[m] ?? m;
}

function langLabel(l: string): string {
  const map: Record<string, string> = { en: "EN", zh: "ZH", code: "Code" };
  return map[l] ?? l;
}
