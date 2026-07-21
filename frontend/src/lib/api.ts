import type { HealingEvent, IngestSummary, Lead, Stats } from "./types";

export const API_BASE =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "") ||
  "http://localhost:8000";

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${path}`);
  return res.json() as Promise<T>;
}

export const api = {
  stats: () => get<Stats>("/stats"),
  leads: (limit = 5000) => get<Lead[]>(`/leads?limit=${limit}`),
  duplicates: (limit = 2000) => get<Lead[]>(`/duplicates?limit=${limit}`),
  invalid: (limit = 2000) => get<Record<string, unknown>[]>(`/invalid?limit=${limit}`),
  healingEvents: (limit = 1000) => get<HealingEvent[]>(`/healing-events?limit=${limit}`),
  humanReview: () => get<Record<string, unknown>[]>("/human-review"),

  // Generic "upload any CSV" — routes straight to the RAG field mapper.
  uploadCsv: async (file: File): Promise<IngestSummary | null> => {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`${API_BASE}/ingest/csv`, { method: "POST", body: form });
    if (!res.ok) throw new Error(`Upload failed: ${res.status} ${res.statusText}`);
    const body = (await res.json()) as { summary: IngestSummary | null };
    return body.summary;
  },
};
