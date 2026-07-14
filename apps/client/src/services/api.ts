const BASE = import.meta.env.DEV ? "http://localhost:3001" : "";

interface ApiOpts {
  method?: string;
  body?: unknown;
  token?: string | null;
}

export async function api<T>(path: string, opts: ApiOpts = {}): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (opts.token) headers["Authorization"] = `Bearer ${opts.token}`;

  const res = await fetch(`${BASE}${path}`, {
    method: opts.method || "GET",
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data as T;
}
