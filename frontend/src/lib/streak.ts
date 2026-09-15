// "No-narc" streak — Pro-only home widget.
// A clean week (Mon-Sun UTC) = user has at least one saved analysis in that
// week where Person A's score is < 33 (green zone). Streak counts consecutive
// clean weeks ending in the current week. Streak Freeze grants Pro users a
// one-off skip per calendar month so a rough week doesn't kill the streak.
import { useEffect, useMemo, useState, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { listHistory, type HistoryItem } from "@/src/api";

export type StreakState = {
  current: number;
  longest: number;
  freezesAvailable: number;
  weekPunches: WeekPunch[];
  loading: boolean;
  refresh: () => void;
  useFreeze: () => Promise<void>;
};

type WeekPunch = {
  weekStart: string; // ISO date of Monday
  status: "clean" | "narc" | "empty" | "frozen";
  bestScore: number | null;
};

const FREEZE_KEY = "narc.streak.freeze_history";
const CLEAN_THRESHOLD = 33;

function startOfWeek(d: Date): Date {
  const nd = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = nd.getUTCDay(); // 0 = Sun
  const diff = (day + 6) % 7; // days since Monday
  nd.setUTCDate(nd.getUTCDate() - diff);
  return nd;
}

function weekKey(d: Date): string {
  return startOfWeek(d).toISOString().slice(0, 10);
}

function monthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

async function loadFreezeHistory(): Promise<Record<string, string[]>> {
  try {
    const raw = await AsyncStorage.getItem(FREEZE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

async function saveFreezeHistory(v: Record<string, string[]>) {
  try {
    await AsyncStorage.setItem(FREEZE_KEY, JSON.stringify(v));
  } catch {}
}

export function useNoNarcStreak(enabled: boolean): StreakState {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [freezes, setFreezes] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    let alive = true;
    setLoading(true);
    Promise.all([listHistory().catch(() => []), loadFreezeHistory()]).then(
      ([hist, fr]) => {
        if (!alive) return;
        setItems(hist);
        setFreezes(fr);
        setLoading(false);
      },
    );
    return () => {
      alive = false;
    };
  }, [enabled, reloadKey]);

  const refresh = useCallback(() => setReloadKey((k) => k + 1), []);

  const { current, longest, freezesAvailable, weekPunches } = useMemo(() => {
    if (!enabled) {
      return { current: 0, longest: 0, freezesAvailable: 0, weekPunches: [] as WeekPunch[] };
    }
    // Bucket analyses by week (min score for Person A per week).
    const buckets = new Map<string, number>();
    for (const it of items) {
      const d = new Date(it.created_at);
      const k = weekKey(d);
      const prev = buckets.get(k);
      const s = it.person_a_score;
      if (prev == null || s < prev) buckets.set(k, s);
    }

    // Build the last 12 weeks including the current one.
    const now = new Date();
    const weeks: WeekPunch[] = [];
    for (let i = 11; i >= 0; i--) {
      const start = startOfWeek(now);
      start.setUTCDate(start.getUTCDate() - i * 7);
      const key = start.toISOString().slice(0, 10);
      const best = buckets.get(key);
      const mkey = monthKey(start);
      const frozenThisMonth = freezes[mkey] || [];
      const isFrozen = frozenThisMonth.includes(key);

      let status: WeekPunch["status"];
      if (best == null) status = "empty";
      else if (best < CLEAN_THRESHOLD) status = "clean";
      else if (isFrozen) status = "frozen";
      else status = "narc";

      weeks.push({ weekStart: key, status, bestScore: best ?? null });
    }

    // Longest streak: only clean and frozen weeks count. Empty weeks are
    // neutral and do NOT extend a streak (nothing happened to celebrate).
    let longestStreak = 0;
    let run = 0;
    for (const w of weeks) {
      if (w.status === "clean" || w.status === "frozen") {
        run += 1;
        if (run > longestStreak) longestStreak = run;
      } else if (w.status === "narc") {
        run = 0;
      }
      // empty weeks: don't increment run, don't reset it
    }

    // Current streak = consecutive clean/frozen weeks ending in the most recent
    // non-empty week. Empty weeks before the streak starts don't count. An empty
    // current week is allowed to trail a streak that already exists.
    let currentStreak = 0;
    let started = false;
    for (let i = weeks.length - 1; i >= 0; i--) {
      const s = weeks[i].status;
      if (s === "narc") break;
      if (s === "clean" || s === "frozen") {
        currentStreak += 1;
        started = true;
      } else {
        // empty: only kept if a streak has already started (i.e. tolerated gap)
        if (started) continue;
        // otherwise fresh account — stop; current stays 0
      }
    }

    const nowMonth = monthKey(now);
    const usedThisMonth = (freezes[nowMonth] || []).length;
    const freezesAvailableCount = Math.max(0, 1 - usedThisMonth);

    return {
      current: currentStreak,
      longest: Math.max(longestStreak, currentStreak),
      freezesAvailable: freezesAvailableCount,
      weekPunches: weeks,
    };
  }, [enabled, items, freezes]);

  const useFreeze = useCallback(async () => {
    if (!enabled) return;
    // Freeze the most recent narc week that still exists.
    const target = [...weekPunches].reverse().find((w) => w.status === "narc");
    if (!target) return;
    const mkey = monthKey(new Date(target.weekStart));
    const already = freezes[mkey] || [];
    if (already.length >= 1) return; // one freeze per month
    const next: Record<string, string[]> = {
      ...freezes,
      [mkey]: [...already, target.weekStart],
    };
    await saveFreezeHistory(next);
    setFreezes(next);
  }, [enabled, weekPunches, freezes]);

  return {
    current,
    longest,
    freezesAvailable,
    weekPunches,
    loading,
    refresh,
    useFreeze,
  };
}
