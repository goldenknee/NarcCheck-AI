import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@react-native-vector-icons/ionicons";

import { colors, radius, spacing } from "@/src/theme";

export default function BillingCancel() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const retry = () => router.replace("/paywall");
  const home = () => router.replace("/");

  return (
    <View style={styles.root}>
      <View style={[styles.body, { paddingTop: insets.top + spacing.xl }]}>
        <View style={styles.iconCircle}>
          <Ionicons name="close" size={38} color={colors.muted} />
        </View>
        <Text style={styles.title}>Checkout cancelled.</Text>
        <Text style={styles.subtitle}>
          No charge was made. You can keep using NarcCheck AI for free — you still have the
          analyses you had before. Upgrade whenever you're ready.
        </Text>
      </View>
      <View style={[styles.ctaBar, { paddingBottom: Math.max(insets.bottom, 12) + 12 }]}>
        <Pressable onPress={retry} style={styles.cta} testID="billing-cancel-retry">
          <Ionicons name="refresh" size={18} color={colors.onBrandPrimary} />
          <Text style={styles.ctaText}>Try again</Text>
        </Pressable>
        <Pressable onPress={home} style={styles.secondary} testID="billing-cancel-home">
          <Text style={styles.secondaryText}>Back to app</Text>
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
  iconCircle: {
    width: 86,
    height: 86,
    borderRadius: 43,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    color: colors.onSurface,
    fontSize: 26,
    fontWeight: "500",
    letterSpacing: -0.6,
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
    gap: spacing.md,
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
  ctaText: { color: colors.onBrandPrimary, fontSize: 16, fontWeight: "500", letterSpacing: 0.3 },
  secondary: {
    alignItems: "center",
    paddingVertical: 12,
  },
  secondaryText: { color: colors.muted, fontSize: 13, fontWeight: "500" },
});
