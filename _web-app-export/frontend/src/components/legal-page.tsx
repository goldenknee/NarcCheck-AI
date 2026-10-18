/**
 * Shared layout for the Terms of Service and Privacy Policy screens.
 *
 * Renders a dark-mode scrollable "document" surface with a sticky header + back
 * button. Children compose `<Section>`, `<P>`, `<Bullet>`, and `<Legal>` to keep
 * typography consistent between the two legal pages.
 */
import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@react-native-vector-icons/ionicons";

import { colors, radius, spacing } from "@/src/theme";

export const SUPPORT_EMAIL = "Goldenknee@gmail.com";
export const COMPANY_NAME = "NarcCheck AI";
// Keep in sync with the public launch date; shown at the top of each doc.
export const LEGAL_EFFECTIVE_DATE = "October 2026";

export function LegalPage({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          style={styles.closeBtn}
          testID="legal-close"
        >
          <Ionicons name="chevron-back" size={22} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {title}
        </Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + spacing.xxl },
        ]}
        showsVerticalScrollIndicator={Platform.OS === "web"}
      >
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.effective}>Effective {LEGAL_EFFECTIVE_DATE}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
        {children}

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Questions? Email{" "}
            <Text style={styles.link}>{SUPPORT_EMAIL}</Text>.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

export function Section({
  heading,
  children,
}: {
  heading: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionHeading}>{heading}</Text>
      {children}
    </View>
  );
}

export function P({ children }: { children: React.ReactNode }) {
  return <Text style={styles.body}>{children}</Text>;
}

export function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.bulletRow}>
      <Text style={styles.bulletDot}>•</Text>
      <Text style={[styles.body, { flex: 1, marginBottom: 0 }]}>{children}</Text>
    </View>
  );
}

export function Strong({ children }: { children: React.ReactNode }) {
  return <Text style={styles.strong}>{children}</Text>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    color: colors.onSurface,
    fontSize: 15,
    fontWeight: "500",
    flex: 1,
    textAlign: "center",
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceSecondary,
  },
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    maxWidth: 720,
    alignSelf: "center",
    width: "100%" as any,
  },
  title: {
    color: colors.onSurface,
    fontSize: 32,
    fontWeight: "500",
    letterSpacing: -1.1,
    marginBottom: spacing.xs,
  },
  effective: {
    color: colors.muted,
    fontSize: 12,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: spacing.lg,
  },
  subtitle: {
    color: colors.onSurfaceSecondary,
    fontSize: 15,
    lineHeight: 23,
    marginBottom: spacing.xl,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionHeading: {
    color: colors.onSurface,
    fontSize: 17,
    fontWeight: "500",
    marginBottom: spacing.md,
    letterSpacing: -0.3,
  },
  body: {
    color: colors.onSurfaceSecondary,
    fontSize: 14,
    lineHeight: 22,
    marginBottom: spacing.md,
  },
  bulletRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  bulletDot: {
    color: colors.brandPrimary,
    fontSize: 14,
    lineHeight: 22,
    width: 10,
  },
  strong: {
    color: colors.onSurface,
    fontWeight: "500",
  },
  link: {
    color: colors.brandPrimary,
    fontWeight: "500",
  },
  footer: {
    marginTop: spacing.xl,
    paddingTop: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    padding: spacing.md,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
  },
  footerText: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
  },
});
