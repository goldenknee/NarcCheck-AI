import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Platform } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import * as Haptics from "expo-haptics";

import { colors, radius, spacing } from "@/src/theme";
import { verifyStripeSession } from "@/src/lib/stripe-billing";

export default function BillingSuccess() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session_id } = useLocalSearchParams<{ session_id?: string }>();

  const [state, setState] = useState<"verifying" | "active" | "pending" | "error">("verifying");
  const [error, setError] = useState<string | null>(null);

  // Verify the Stripe session on mount — Stripe is the source of truth, not
  // this redirect, so we always re-ask the server.
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        if (!session_id) throw new Error("Missing session_id");
        const s = await verifyStripeSession(String(session_id));
        if (cancelled) return;
        if (s === "active") {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          setState("active");
        } else {
          setState("pending");
        }
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message ?? "Could not verify your purchase");
          setState("error");
        }
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [session_id]);

  // Strip the ?session_id= from the browser URL so refreshing doesn't re-trigger it.
  useEffect(() => {
    if (Platform.OS !== "web" || !session_id) return;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const w = globalThis as any;
      if (w.history?.replaceState) {
        w.history.replaceState(null, "", "/billing/success");
      }
    } catch {}
  }, [session_id]);

  const goHome = () => {
    router.replace("/");
  };

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={["#1a0404", colors.surface]}
        style={{ position: "absolute", top: 0, left: 0, right: 0, height: 420 }}
      />
      <View style={[styles.body, { paddingTop: insets.top + spacing.xl }]}>
        {state === "verifying" ? (
          <>
            <ActivityIndicator color={colors.brandPrimary} size="large" />
            <Text style={styles.title}>Confirming your purchase…</Text>
            <Text style={styles.subtitle}>
              Hang tight — we're double-checking with Stripe before unlocking Pro.
            </Text>
          </>
        ) : state === "active" ? (
          <>
            <View style={styles.iconCircleOk}>
              <Ionicons name="checkmark" size={44} color={colors.onBrandPrimary} />
            </View>
            <Text style={styles.title}>You're Pro now.</Text>
            <Text style={styles.subtitle}>
              Unlimited analyses, trait radar, streak freezer, and shareable receipts — unlocked
              on every device that signs into this account.
            </Text>
          </>
        ) : state === "pending" ? (
          <>
            <View style={styles.iconCirclePending}>
              <Ionicons name="hourglass" size={38} color={colors.brandSecondary} />
            </View>
            <Text style={styles.title}>Payment still processing…</Text>
            <Text style={styles.subtitle}>
              Stripe is finalising this payment. You'll get Pro access as soon as it clears —
              typically within a minute. Feel free to keep using the app.
            </Text>
          </>
        ) : (
          <>
            <View style={styles.iconCircleError}>
              <Ionicons name="alert-circle" size={38} color={colors.brandPrimary} />
            </View>
            <Text style={styles.title}>We couldn't confirm the purchase.</Text>
            <Text style={styles.subtitle}>{error ?? "Please try again."}</Text>
          </>
        )}
      </View>

      <View style={[styles.ctaBar, { paddingBottom: Math.max(insets.bottom, 12) + 12 }]}>
        <Pressable onPress={goHome} style={styles.cta} testID="billing-success-done">
          <Ionicons name="arrow-forward" size={18} color={colors.onBrandPrimary} />
          <Text style={styles.ctaText}>Back to NarcCheck</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  body: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
    gap: spacing.lg,
  },
  iconCircleOk: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: colors.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
  },
  iconCirclePending: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 2,
    borderColor: colors.brandSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
  iconCircleError: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 2,
    borderColor: colors.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    color: colors.onSurface,
    fontSize: 28,
    fontWeight: "500",
    letterSpacing: -0.8,
    textAlign: "center",
  },
  subtitle: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
    maxWidth: 420,
  },
  ctaBar: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  cta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: colors.brandPrimary,
    borderRadius: radius.pill,
    paddingVertical: 16,
  },
  ctaText: {
    color: colors.onBrandPrimary,
    fontSize: 16,
    fontWeight: "500",
    letterSpacing: 0.3,
  },
});
