import React from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Platform } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import * as AppleAuthentication from "expo-apple-authentication";

import { colors, radius, spacing } from "@/src/theme";
import { useAuth } from "@/src/lib/auth";

const PERKS = [
  { icon: "cloud-upload-outline", title: "Sync across devices", body: "Your history follows you." },
  { icon: "shield-checkmark-outline", title: "Protect your Pro plan", body: "Keep your subscription if you switch phones." },
  { icon: "sparkles-outline", title: "Stay anonymous if you want", body: "Sign-in is optional — the app works without it." },
];

export default function SignInScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isAuthed, appleAvailable, signInWithApple, signInWithGoogle, error, clearError } = useAuth();
  const [busy, setBusy] = React.useState<"apple" | "google" | null>(null);

  React.useEffect(() => {
    if (isAuthed) router.back();
  }, [isAuthed, router]);

  const doApple = async () => {
    setBusy("apple");
    clearError();
    try {
      await signInWithApple();
    } finally {
      setBusy(null);
    }
  };

  const doGoogle = async () => {
    setBusy("google");
    clearError();
    try {
      await signInWithGoogle();
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={["#2a0808", colors.surface]}
        style={{ position: "absolute", top: 0, left: 0, right: 0, height: 320 }}
      />
      <View style={[styles.headerRow, { paddingTop: insets.top + spacing.md }]}>
        <Pressable onPress={() => router.back()} hitSlop={16} testID="sign-in-close">
          <Ionicons name="close" size={24} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.headerLabel}>Sign In</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.body}>
        <View style={styles.heroBadge}>
          <Ionicons name="warning" size={13} color={colors.brandPrimary} />
          <Text style={styles.heroBadgeText}>NARCCHECK AI</Text>
        </View>
        <Text style={styles.title}>Save your{"\n"}scorecards forever.</Text>
        <Text style={styles.subtitle}>
          Sign in to sync history and Pro across every device. It's optional — you can keep using the app anonymously.
        </Text>

        <View style={styles.perks}>
          {PERKS.map((p) => (
            <View key={p.title} style={styles.perkRow}>
              <View style={styles.perkIcon}>
                <Ionicons name={p.icon as any} size={16} color={colors.brandPrimary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.perkTitle}>{p.title}</Text>
                <Text style={styles.perkBody}>{p.body}</Text>
              </View>
            </View>
          ))}
        </View>

        {error ? (
          <Text style={styles.errorText} testID="sign-in-error">
            {error}
          </Text>
        ) : null}
      </View>

      <View style={[styles.ctaBar, { paddingBottom: Math.max(insets.bottom, 12) + 12 }]}>
        {Platform.OS === "ios" && appleAvailable ? (
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
            buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
            cornerRadius={999}
            style={styles.appleBtn}
            onPress={doApple}
          />
        ) : (
          <Pressable
            onPress={doApple}
            disabled={Platform.OS !== "ios" || busy !== null}
            style={[
              styles.appleFallback,
              (Platform.OS !== "ios" || busy) && { opacity: 0.5 },
            ]}
            testID="apple-signin-fallback"
          >
            {busy === "apple" ? (
              <ActivityIndicator color={colors.onSurfaceInverse} />
            ) : (
              <>
                <Ionicons name="logo-apple" size={18} color={colors.onSurfaceInverse} />
                <Text style={styles.appleFallbackText}>
                  {Platform.OS === "ios" ? "Sign in with Apple" : "Apple Sign-In (iOS only)"}
                </Text>
              </>
            )}
          </Pressable>
        )}

        <Pressable
          onPress={doGoogle}
          disabled={busy !== null}
          style={[styles.googleBtn, busy && { opacity: 0.7 }]}
          testID="google-signin"
        >
          {busy === "google" ? (
            <ActivityIndicator color={colors.onSurface} />
          ) : (
            <>
              <Ionicons name="logo-google" size={18} color={colors.onSurface} />
              <Text style={styles.googleBtnText}>Sign in with Google</Text>
            </>
          )}
        </Pressable>

        <Pressable onPress={() => router.back()} style={styles.laterBtn} testID="sign-in-later">
          <Text style={styles.laterBtnText}>Keep using anonymously</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  headerLabel: { color: colors.onSurface, fontSize: 15, fontWeight: "500" },
  body: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  heroBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.brandTertiary,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.brandPrimary,
    marginBottom: spacing.md,
  },
  heroBadgeText: {
    color: colors.onBrandTertiary,
    fontSize: 10,
    letterSpacing: 1.4,
    fontWeight: "500",
  },
  title: {
    color: colors.onSurface,
    fontSize: 32,
    fontWeight: "500",
    letterSpacing: -1,
    lineHeight: 38,
  },
  subtitle: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21,
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
  },
  perks: {
    gap: spacing.lg,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  perkRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
  },
  perkIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  perkTitle: { color: colors.onSurface, fontSize: 14, fontWeight: "500" },
  perkBody: { color: colors.muted, fontSize: 12, marginTop: 2, lineHeight: 18 },
  errorText: {
    color: colors.brandPrimary,
    fontSize: 12,
    marginTop: spacing.md,
    textAlign: "center",
  },
  ctaBar: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    gap: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  appleBtn: {
    height: 50,
    width: "100%",
  },
  appleFallback: {
    height: 50,
    borderRadius: radius.pill,
    backgroundColor: colors.onSurface,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  appleFallbackText: {
    color: colors.onSurfaceInverse,
    fontSize: 15,
    fontWeight: "500",
  },
  googleBtn: {
    height: 50,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  googleBtnText: { color: colors.onSurface, fontSize: 15, fontWeight: "500" },
  laterBtn: {
    alignItems: "center",
    paddingVertical: 12,
  },
  laterBtnText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "500",
  },
});
