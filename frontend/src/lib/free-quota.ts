// Tracks how many free analyses a device has used. 3 free total; then paywall.
import { useCallback, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "narc.free_analyses_used";
export const FREE_ANALYSIS_LIMIT = 3;

async function read(): Promise<number> {
  try {
    const v = await AsyncStorage.getItem(KEY);
    const n = v ? parseInt(v, 10) : 0;
    return Number.isFinite(n) && n >= 0 ? n : 0;
  } catch {
    return 0;
  }
}

async function write(n: number) {
  try {
    await AsyncStorage.setItem(KEY, String(n));
  } catch {}
}

export function useFreeQuota() {
  const [used, setUsed] = useState<number>(0);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    read().then((n) => {
      if (alive) {
        setUsed(n);
        setLoaded(true);
      }
    });
    return () => {
      alive = false;
    };
  }, []);

  const remaining = Math.max(0, FREE_ANALYSIS_LIMIT - used);

  const consumeOne = useCallback(async () => {
    const next = used + 1;
    setUsed(next);
    await write(next);
  }, [used]);

  const resetForTesting = useCallback(async () => {
    setUsed(0);
    await write(0);
  }, []);

  return { used, remaining, loaded, consumeOne, resetForTesting };
}
