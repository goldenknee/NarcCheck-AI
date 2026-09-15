// API client for the NarcCheck AI backend.
// - Auth: attaches Bearer session_token when signed in.
// - Anonymous: attaches X-Device-Id so the server can scope history / migrate on login.
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import { getSessionToken } from "./lib/auth";

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL ?? "";
const DEVICE_ID_KEY = "narc.device_id";

async function readDeviceId(): Promise<string | null> {
  try {
    if (Platform.OS === "web") return window.localStorage.getItem(DEVICE_ID_KEY);
    return await SecureStore.getItemAsync(DEVICE_ID_KEY);
  } catch {
    return null;
  }
}

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
  user_id?: string | null;
  device_id?: string | null;
};

type AnalyzeReq =
  | { mode: "text"; text: string; person_a_name?: string; person_b_name?: string }
  | { mode: "image"; images_base64: string[]; person_a_name?: string; person_b_name?: string };

async function jsonFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init?.headers as any),
  };
  const token = getSessionToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const deviceId = await readDeviceId();
  if (deviceId) headers["X-Device-Id"] = deviceId;

  const res = await fetch(`${BASE}${path}`, { ...init, headers });
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
