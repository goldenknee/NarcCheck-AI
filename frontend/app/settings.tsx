import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Modal,
  Linking,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import * as Haptics from "expo-haptics";

import { colors, radius, spacing } from "@/src/theme";
import { useAuth } from "@/src/lib/auth";
import { useSubscription } from "@/src/lib/revenuecat";

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, isAuthed, signOut, deleteAccount } = useAuth();
  const { isSubscribed } = useSubscription();

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    // If somehow opened while anonymous, bounce home.
    if (!isAuthed) router.replace("/");
  }, [isAuthed, router]);

  const memberSince = user
    ? new Date(user.created_at).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "";

  const providerLabel =
    user?.provider === "apple" ? "Apple" : user?.provider === "google" ? "Google" : "";

  const doSignOut = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    await signOut();
    router.replace("/");
  };

  const doDelete = async () => {
    setDeleting(true);
    setError(null);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    try {
      await deleteAccount();
      setConfirmOpen(false);
      router.replace("/");
    } catch (e: any) {
      setError(e?.message ?? "Could not delete account");
    } finally {
      setDeleting(false);
    }
  };

  const openManageSubs = () => {
    Linking.openURL("itms-apps://apps.apple.com/account/subscriptions").catch(() => {});
  };

  if (!user) return null;

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Pressable onPress={() => router.back()} hitSlop={16} testID="settings-back">
          <Ionicons name="chevron-back" size={26} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView
        contentContainerStyle={{
          padding: spacing.lg,
          paddingBottom: insets.bottom + spacing.xxl,
          gap: spacing.xl,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Account card */}
        <View style={styles.card} testID="account-card">
          <View style={styles.accountRow}>
            <View style={styles.avatar}>
              <Ionicons name="person" size={28} color={colors.brandPrimary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.accountName} numberOfLines={1}>
                {user.name || user.email || "Signed in"}
              </Text>
              {user.email ? (
                <Text style={styles.accountEmail} numberOfLines={1}>
                  {user.email}
                </Text>
              ) : null}
              <View style={styles.metaRow}>
                <View style={styles.tag}>
                  <Ionicons
                    name={user.provider === "apple" ? "logo-apple" : "logo-google"}
                    size={11}
                    color={colors.muted}
                  />
                  <Text style={styles.tagText}>{providerLabel}</Text>
                </View>
                <Text style={styles.metaText}>Member since {memberSince}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Subscription */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>SUBSCRIPTION</Text>
          <View style={styles.card}>
            <View style={styles.rowBetween}>
              <View style={styles.rowLeft}>
                <View style={[styles.rowIcon, { backgroundColor: colors.brandTertiary }]}>
                  <Ionicons name="flash" size={16} color={colors.brandPrimary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>Narc Pro</Text>
                  <Text style={styles.rowSub}>
                    {isSubscribed ? "Active" : "Free plan · 3 analyses total"}
                  </Text>
                </View>
              </View>
              {isSubscribed ? (
                <Pressable
                  onPress={openManageSubs}
                  style={styles.tinyBtn}
                  testID="manage-subs-btn"
                >
                  <Text style={styles.tinyBtnText}>Manage</Text>
                </Pressable>
              ) : (
                <Pressable
                  onPress={() => router.push("/paywall")}
                  style={[styles.tinyBtn, { backgroundColor: colors.brandPrimary }]}
                  testID="upgrade-btn"
                >
                  <Text style={[styles.tinyBtnText, { color: colors.onBrandPrimary }]}>
                    Upgrade
                  </Text>
                </Pressable>
              )}
            </View>
          </View>
        </View>

        {/* Account actions */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>ACCOUNT</Text>
          <View style={styles.card}>
            <Pressable
              onPress={doSignOut}
              style={styles.rowBetween}
              testID="settings-sign-out"
            >
              <View style={styles.rowLeft}>
                <View style={[styles.rowIcon, { backgroundColor: colors.surfaceTertiary }]}>
                  <Ionicons name="log-out-outline" size={16} color={colors.onSurface} />
                </View>
                <Text style={styles.rowTitle}>Sign Out</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.muted} />
            </Pressable>

            <View style={styles.hairline} />

            <Pressable
              onPress={() => setConfirmOpen(true)}
              style={styles.rowBetween}
              testID="delete-account-btn"
            >
              <View style={styles.rowLeft}>
                <View style={[styles.rowIcon, { backgroundColor: colors.brandTertiary }]}>
                  <Ionicons name="trash-outline" size={16} color={colors.brandPrimary} />
                </View>
                <Text style={[styles.rowTitle, { color: colors.brandPrimary }]}>
                  Delete Account
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.brandPrimary} />
            </Pressable>
          </View>
          <Text style={styles.footnote}>
            Deleting your account permanently removes your saved history and signs you out on every device. Your subscription is managed by Apple — cancel it from the App Store to stop future charges.
          </Text>
        </View>

        {/* Legal */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>LEGAL</Text>
          <View style={styles.card}>
            <Pressable
              onPress={() => router.push("/legal/privacy")}
              style={styles.rowBetween}
              testID="privacy-link"
            >
              <View style={styles.rowLeft}>
                <View style={[styles.rowIcon, { backgroundColor: colors.surfaceTertiary }]}>
                  <Ionicons name="shield-checkmark-outline" size={16} color={colors.onSurface} />
                </View>
                <Text style={styles.rowTitle}>Privacy Policy</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.muted} />
            </Pressable>
            <View style={styles.hairline} />
            <Pressable
              onPress={() => router.push("/legal/terms")}
              style={styles.rowBetween}
              testID="terms-link"
            >
              <View style={styles.rowLeft}>
                <View style={[styles.rowIcon, { backgroundColor: colors.surfaceTertiary }]}>
                  <Ionicons name="document-text-outline" size={16} color={colors.onSurface} />
                </View>
                <Text style={styles.rowTitle}>Terms of Service</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.muted} />
            </Pressable>
            <View style={styles.hairline} />
            <Pressable
              onPress={() => Linking.openURL("mailto:Goldenknee@gmail.com").catch(() => {})}
              style={styles.rowBetween}
              testID="support-link"
            >
              <View style={styles.rowLeft}>
                <View style={[styles.rowIcon, { backgroundColor: colors.surfaceTertiary }]}>
                  <Ionicons name="mail-outline" size={16} color={colors.onSurface} />
                </View>
                <Text style={styles.rowTitle}>Contact Support</Text>
              </View>
              <Ionicons name="open-outline" size={16} color={colors.muted} />
            </Pressable>
          </View>
          <Text style={styles.footnote}>
            NarcCheck AI is for personal reflection and entertainment only. It is not a substitute for medical or psychological advice, diagnosis, or treatment. If you are in crisis, please reach out to a licensed professional.
          </Text>
        </View>
      </ScrollView>

      {/* Confirm modal */}
      <Modal
        visible={confirmOpen}
        transparent
        animationType="fade"
        onRequestClose={() => (deleting ? undefined : setConfirmOpen(false))}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet} testID="delete-confirm-sheet">
            <View style={styles.modalIcon}>
              <Ionicons name="warning" size={28} color={colors.brandPrimary} />
            </View>
            <Text style={styles.modalTitle}>Delete your account?</Text>
            <Text style={styles.modalBody}>
              This permanently removes your saved scorecards and signs you out everywhere. This action cannot be undone.
            </Text>
            {error ? (
              <Text style={styles.errorText} testID="delete-error">
                {error}
              </Text>
            ) : null}
            <View style={styles.modalBtnRow}>
              <Pressable
                onPress={() => setConfirmOpen(false)}
                disabled={deleting}
                style={[styles.modalBtn, { backgroundColor: colors.surfaceTertiary }]}
                testID="delete-cancel"
              >
                <Text style={styles.modalBtnText}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={doDelete}
                disabled={deleting}
                style={[
                  styles.modalBtn,
                  { backgroundColor: colors.brandPrimary },
                  deleting && { opacity: 0.7 },
                ]}
                testID="delete-confirm"
              >
                {deleting ? (
                  <ActivityIndicator color={colors.onBrandPrimary} />
                ) : (
                  <Text style={[styles.modalBtnText, { color: colors.onBrandPrimary }]}>
                    Delete
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  headerTitle: {
    color: colors.onSurface,
    fontSize: 17,
    fontWeight: "500",
  },
  section: { gap: spacing.sm },
  sectionLabel: {
    color: colors.muted,
    fontSize: 11,
    letterSpacing: 1.6,
    fontWeight: "500",
    marginLeft: spacing.xs,
  },
  card: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  accountRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  accountName: {
    color: colors.onSurface,
    fontSize: 17,
    fontWeight: "500",
    letterSpacing: -0.2,
  },
  accountEmail: {
    color: colors.muted,
    fontSize: 13,
    marginTop: 2,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 8,
  },
  tag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceTertiary,
  },
  tagText: {
    color: colors.muted,
    fontSize: 11,
    letterSpacing: 0.5,
  },
  metaText: {
    color: colors.muted,
    fontSize: 11,
  },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  rowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    flex: 1,
  },
  rowIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  rowTitle: {
    color: colors.onSurface,
    fontSize: 15,
    fontWeight: "500",
  },
  rowSub: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 2,
  },
  hairline: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginVertical: spacing.md,
  },
  tinyBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceTertiary,
  },
  tinyBtnText: {
    color: colors.onSurface,
    fontSize: 12,
    fontWeight: "500",
  },
  footnote: {
    color: colors.muted,
    fontSize: 11,
    lineHeight: 17,
    marginTop: spacing.sm,
    marginLeft: spacing.xs,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    justifyContent: "center",
    padding: spacing.lg,
  },
  modalSheet: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    padding: spacing.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    alignItems: "center",
    gap: spacing.sm,
  },
  modalIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  modalTitle: {
    color: colors.onSurface,
    fontSize: 18,
    fontWeight: "500",
    textAlign: "center",
  },
  modalBody: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
    marginTop: 4,
  },
  errorText: {
    color: colors.brandPrimary,
    fontSize: 12,
    textAlign: "center",
    marginTop: spacing.sm,
  },
  modalBtnRow: {
    flexDirection: "row",
    gap: spacing.md,
    marginTop: spacing.lg,
    width: "100%",
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: radius.pill,
    alignItems: "center",
  },
  modalBtnText: {
    color: colors.onSurface,
    fontSize: 14,
    fontWeight: "500",
  },
});
