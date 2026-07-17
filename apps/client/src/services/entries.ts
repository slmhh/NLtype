import { api } from "./api";

interface Entry {
  id: number;
  content: string;
  language: string;
  codeLang?: string;
}

/** Fetch approved entries from server, fall back to empty array */
export async function getApprovedEntries(language: string, codeLang?: string): Promise<Entry[]> {
  try {
    let url = `/api/entries/approved?language=${language}&limit=100`;
    if (codeLang) {
      url += `&code_lang=${codeLang}`;
    }
    const data = await api<{ entries: Entry[] }>(url);
    return data.entries;
  } catch {
    return [];
  }
}
