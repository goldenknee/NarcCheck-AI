import { useCallback, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "narc.onboarded";

async function readFlag(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(KEY)) === "1";
  } catch {
    return false;
  }
}

export function useOnboardingState() {
  const [onboarded, setOnboarded] = useState<boolean | null>(null);

  useEffect(() => {
    let alive = true;
    readFlag().then((v) => {
      if (alive) setOnboarded(v);
    });
    return () => {
      alive = false;
    };
  }, []);

  const complete = useCallback(async () => {
    try {
      await AsyncStorage.setItem(KEY, "1");
    } catch {}
    setOnboarded(true);
  }, []);

  const reset = useCallback(async () => {
    try {
      await AsyncStorage.removeItem(KEY);
    } catch {}
    setOnboarded(false);
  }, []);

  return { onboarded, complete, reset };
}
