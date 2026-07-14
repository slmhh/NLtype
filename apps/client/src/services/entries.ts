import { api } from "./api";

interface Entry {
  id: number;
  content: string;
  language: string;
}

/** Fetch approved entries from server, fall back to empty array */
export async function getApprovedEntries(language: string): Promise<string[]> {
  try {
    const data = await api<{ entries: Entry[] }>(`/api/entries/approved?language=${language}&limit=100`);
    return data.entries.map((e) => e.content);
  } catch {
    return [];
  }
}
