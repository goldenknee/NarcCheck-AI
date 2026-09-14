import { QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { LogBox, Platform } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";

import { ErrorBoundary } from "@/src/components/error-boundary";
import { queryClient } from "@/src/query-client";
import { colors } from "@/src/theme";

LogBox.ignoreAllLogs(true);

// PREWARM: keep the icon-font prewarm logic so vector icons render in Expo Go.
async function prewarmIcons() {
  try {
    if (Platform.OS === "web") return;
    // Any dynamic imports of icon fonts should stay here so Metro bundles the .ttf.
    // Ionicons ships its own font via config plugin, but touching the module also
    // helps Metro resolve the asset on first mount in Expo Go Android.
    await import("@react-native-vector-icons/ionicons");
  } catch {
    // ignore
  }
}

export default function RootLayout() {
  useEffect(() => {
    prewarmIcons();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.surface }}>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <StatusBar style="light" />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.surface },
              animation: "fade",
            }}
          />
        </QueryClientProvider>
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
}
