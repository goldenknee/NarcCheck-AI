import React from "react";
import { View, Text, StyleSheet, Platform } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@react-native-vector-icons/ionicons";

import { colors, radius, spacing } from "@/src/theme";
import { useIsDesktop } from "@/src/lib/use-is-desktop";

/**
 * WebFrame wraps the app on desktop web viewports with a centered "phone"
 * container plus a dark-themed desktop surround (brand strip + feature list).
 *
 * On native (iOS) and on narrow web viewports it is a transparent passthrough.
 */
export function WebFrame({ children }: { children: React.ReactNode }) {
  const isDesktop = useIsDesktop();
  if (!isDesktop) return <>{children}</>;

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={["#2a0808", colors.surface, "#0a0a0b"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.row}>
        <View style={styles.leftColumn}>
          <View style={styles.badge}>
            <Ionicons name="warning" size={13} color={colors.brandPrimary} />
            <Text style={styles.badgeText}>NARCCHECK AI</Text>
          </View>
          <Text style={styles.heroTitle}>See through{"\n"}the argument.</Text>
          <Text style={styles.heroBody}>
            Paste a transcript, upload screenshots, or record a voice note.{"\n"}
            Our forensic model scores manipulation tactics across both sides and{"\n"}
            hands you a receipts-ready verdict in seconds.
          </Text>

          <View style={styles.featureGrid}>
            {FEATURES.map((f) => (
              <View key={f.title} style={styles.feature}>
                <View style={styles.featureIcon}>
                  <Ionicons name={f.icon as any} size={16} color={colors.brandPrimary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.featureTitle}>{f.title}</Text>
                  <Text style={styles.featureBody}>{f.body}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.phoneWrap}>
          {/* Phone bezel */}
          <View style={styles.phone}>
            <View style={styles.phoneScreen}>
              <View style={styles.phoneNotch} />
              {children}
            </View>
          </View>
          <Text style={styles.phoneCaption}>
            Also on iOS — <Text style={styles.phoneCaptionAccent}>download on the App Store</Text>
          </Text>
        </View>
      </View>
    </View>
  );
}

const FEATURES = [
  {
    icon: "speedometer",
    title: "Dual-gauge scorecard",
    body: "0–100 narcissism scores for both participants, with the dominant traits called out.",
  },
  {
    icon: "image",
    title: "Screenshot analysis",
    body: "Drop in text-message screenshots. OCR + GPT identifies tactics inside each line.",
  },
  {
    icon: "shield-checkmark",
    title: "Private by default",
    body: "No sign-in required. History is scoped to your browser — syncs only if you sign in.",
  },
  {
    icon: "flash",
    title: "Pro: unlimited analyses",
    body: "3 free. Then $8.99/mo or $60/yr. Cancel anytime from the billing portal.",
  },
];

const PHONE_WIDTH = 390;
const PHONE_HEIGHT = 844;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.surface,
    minHeight: "100%" as any,
    ...(Platform.OS === "web" ? ({ overflow: "auto" } as any) : {}),
  },
  row: {
    flexDirection: "row",
    gap: 48,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    paddingVertical: 48,
    minHeight: PHONE_HEIGHT + 96,
    maxWidth: 1360,
    alignSelf: "center",
    width: "100%" as any,
  },
  leftColumn: {
    flex: 1,
    maxWidth: 560,
    paddingTop: 20,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 7,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.brandTertiary,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.brandPrimary,
    marginBottom: spacing.lg,
  },
  badgeText: {
    color: colors.onBrandTertiary,
    fontSize: 11,
    letterSpacing: 1.5,
    fontWeight: "500",
  },
  heroTitle: {
    color: colors.onSurface,
    fontSize: 52,
    fontWeight: "500",
    letterSpacing: -1.6,
    lineHeight: 58,
    marginBottom: spacing.md,
  },
  heroBody: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 24,
    marginBottom: spacing.xl,
    maxWidth: 500,
  },
  featureGrid: {
    gap: spacing.lg,
    paddingTop: spacing.md,
  },
  feature: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
    maxWidth: 480,
  },
  featureIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  featureTitle: { color: colors.onSurface, fontSize: 14, fontWeight: "500" },
  featureBody: { color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: 2 },
  phoneWrap: {
    alignItems: "center",
    gap: spacing.md,
  },
  phone: {
    width: PHONE_WIDTH + 16,
    height: PHONE_HEIGHT + 16,
    borderRadius: 54,
    backgroundColor: "#111113",
    borderWidth: 2,
    borderColor: "#222",
    padding: 8,
    ...(Platform.OS === "web"
      ? ({ boxShadow: "0 40px 80px -20px rgba(220, 38, 38, 0.25), 0 20px 40px -10px rgba(0,0,0,0.6)" } as any)
      : {}),
  },
  phoneScreen: {
    flex: 1,
    borderRadius: 46,
    overflow: "hidden",
    backgroundColor: colors.surface,
    position: "relative",
  },
  phoneNotch: {
    position: "absolute",
    top: 10,
    left: "50%" as any,
    width: 110,
    height: 28,
    marginLeft: -55,
    borderRadius: 14,
    backgroundColor: "#000",
    zIndex: 100,
  },
  phoneCaption: {
    color: colors.muted,
    fontSize: 12,
    marginTop: spacing.sm,
  },
  phoneCaptionAccent: {
    color: colors.brandPrimary,
    fontWeight: "500",
  },
});
