import { QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { LogBox, Platform } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";

import { ErrorBoundary } from "@/src/components/error-boundary";
import { queryClient } from "@/src/query-client";
import { colors } from "@/src/theme";
import { SubscriptionProvider, initializeRevenueCat } from "@/src/lib/revenuecat";
import { AuthProvider } from "@/src/lib/auth";

LogBox.ignoreAllLogs(true);

// Initialize RevenueCat ONCE at module scope, before any component mounts.
try {
  initializeRevenueCat();
} catch (err) {
  console.warn("RevenueCat unavailable:", err);
}

async function prewarmIcons() {
  try {
    if (Platform.OS === "web") return;
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
          <AuthProvider>
            <SubscriptionProvider>
              <StatusBar style="light" />
              <Stack
                screenOptions={{
                  headerShown: false,
                  contentStyle: { backgroundColor: colors.surface },
                  animation: "fade",
                }}
              >
                <Stack.Screen name="paywall" options={{ presentation: "modal", animation: "slide_from_bottom" }} />
                <Stack.Screen name="sign-in" options={{ presentation: "modal", animation: "slide_from_bottom" }} />
              </Stack>
            </SubscriptionProvider>
          </AuthProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
}
