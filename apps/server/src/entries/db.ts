import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "data");
const ENTRIES_FILE = join(DATA_DIR, "entries.json");

export type EntryStatus = "pending" | "approved" | "rejected";
export type EntryLanguage = "en" | "zh" | "code";

export interface WordEntry {
  id: number;
  userId: number;
  username: string;
  language: EntryLanguage;
  content: string;
  status: EntryStatus;
  createdAt: string;
  reviewedAt?: string;
  reviewedBy?: number;
}

function ensureDataDir() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

function loadEntries(): WordEntry[] {
  ensureDataDir();
  if (!existsSync(ENTRIES_FILE)) {
    writeFileSync(ENTRIES_FILE, "[]", "utf-8");
    return [];
  }
  try { return JSON.parse(readFileSync(ENTRIES_FILE, "utf-8")); }
  catch { return []; }
}

function saveEntries(entries: WordEntry[]) {
  ensureDataDir();
  writeFileSync(ENTRIES_FILE, JSON.stringify(entries, null, 2), "utf-8");
}

let nextId = loadEntries().reduce((max, e) => Math.max(max, e.id), 0) + 1;

export function createEntry(userId: number, username: string, language: EntryLanguage, content: string, autoApprove: boolean): WordEntry {
  const entries = loadEntries();
  const entry: WordEntry = {
    id: nextId++,
    userId,
    username,
    language,
    content,
    status: autoApprove ? "approved" : "pending",
    createdAt: new Date().toISOString(),
    ...(autoApprove ? { reviewedAt: new Date().toISOString(), reviewedBy: userId } : {}),
  };
  entries.unshift(entry);
  saveEntries(entries);
  return entry;
}

export function getEntries(filter?: { userId?: number; status?: EntryStatus; language?: EntryLanguage }): WordEntry[] {
  let entries = loadEntries();
  if (filter?.userId) entries = entries.filter((e) => e.userId === filter.userId);
  if (filter?.status) entries = entries.filter((e) => e.status === filter.status);
  if (filter?.language) entries = entries.filter((e) => e.language === filter.language);
  return entries;
}

export function getApprovedByLanguage(language: EntryLanguage, limit = 50): WordEntry[] {
  return loadEntries().filter((e) => e.status === "approved" && e.language === language).slice(0, limit);
}

export function reviewEntry(entryId: number, status: "approved" | "rejected", reviewerId: number): WordEntry | null {
  const entries = loadEntries();
  const idx = entries.findIndex((e) => e.id === entryId);
  if (idx === -1) return null;
  entries[idx].status = status;
  entries[idx].reviewedAt = new Date().toISOString();
  entries[idx].reviewedBy = reviewerId;
  saveEntries(entries);
  return entries[idx];
}
