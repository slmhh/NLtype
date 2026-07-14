import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "data");
const USERS_FILE = join(DATA_DIR, "users.json");
const RESULTS_FILE = join(DATA_DIR, "results.json");

interface Stats {
  totalUsers: number;
  totalResults: number;
  resultsByMode: Record<string, number>;
  resultsByLang: Record<string, number>;
  topWpm: number;
  avgWpm: number;
}

function readJSON(path: string): any[] {
  if (!existsSync(path)) return [];
  try { return JSON.parse(readFileSync(path, "utf-8")); } catch { return []; }
}

export function getStats(): Stats {
  const users = readJSON(USERS_FILE);
  const results = readJSON(RESULTS_FILE);

  const modeCount: Record<string, number> = {};
  const langCount: Record<string, number> = {};
  let totalWpm = 0;
  let topWpm = 0;

  for (const r of results) {
    modeCount[r.mode] = (modeCount[r.mode] || 0) + 1;
    langCount[r.language] = (langCount[r.language] || 0) + 1;
    totalWpm += r.wpm || 0;
    if ((r.wpm || 0) > topWpm) topWpm = r.wpm;
  }

  return {
    totalUsers: users.length,
    totalResults: results.length,
    resultsByMode: modeCount,
    resultsByLang: langCount,
    topWpm,
    avgWpm: results.length ? Math.round(totalWpm / results.length) : 0,
  };
}
