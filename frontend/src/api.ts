// API client for the Narc backend.
const BASE = process.env.EXPO_PUBLIC_BACKEND_URL ?? "";

export type ParticipantScore = {
  name: string;
  narcissism_score: number;
  key_traits_detected: string[];
  notable_quotes: string[];
};

export type AnalysisResult = {
  person_a: ParticipantScore;
  person_b: ParticipantScore;
  verdict: string;
  breakdown: string;
};

export type HistoryItem = {
  id: string;
  created_at: string;
  person_a_name: string;
  person_b_name: string;
  person_a_score: number;
  person_b_score: number;
  verdict: string;
  result: AnalysisResult;
  source_mode: "text" | "image";
  source_text_preview?: string | null;
};

type AnalyzeReq =
  | { mode: "text"; text: string; person_a_name?: string; person_b_name?: string }
  | { mode: "image"; images_base64: string[]; person_a_name?: string; person_b_name?: string };

async function jsonFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      msg = body?.detail ?? msg;
    } catch {}
    throw new Error(msg);
  }
  return (await res.json()) as T;
}

export function analyze(req: AnalyzeReq): Promise<AnalysisResult> {
  return jsonFetch<AnalysisResult>("/api/analyze", {
    method: "POST",
    body: JSON.stringify(req),
  });
}

export function saveHistory(payload: {
  person_a_name: string;
  person_b_name: string;
  result: AnalysisResult;
  source_mode: "text" | "image";
  source_text_preview?: string | null;
}): Promise<HistoryItem> {
  return jsonFetch<HistoryItem>("/api/history", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function listHistory(): Promise<HistoryItem[]> {
  return jsonFetch<HistoryItem[]>("/api/history");
}

export function getHistory(id: string): Promise<HistoryItem> {
  return jsonFetch<HistoryItem>(`/api/history/${id}`);
}

export function deleteHistory(id: string): Promise<{ deleted: boolean }> {
  return jsonFetch<{ deleted: boolean }>(`/api/history/${id}`, { method: "DELETE" });
}
