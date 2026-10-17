import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import type { PurchasesPackage } from "react-native-purchases";

import { colors, radius, spacing } from "@/src/theme";
import { useSubscription, rcEnabled } from "@/src/lib/revenuecat";
import { startStripeCheckout } from "@/src/lib/stripe-billing";
import { useAuth } from "@/src/lib/auth";

const IS_WEB = Platform.OS === "web";

// On web, Stripe is the source of truth. We hard-render these plan values so
// the paywall is usable even if Stripe hasn't been configured yet — the backend
// will reject the actual checkout call with a clear error if the key is missing.
const WEB_MONTHLY = {
  identifier: "$rc_monthly",
  product: { price: 8.99, priceString: "$8.99", title: "Monthly" },
  stripePlan: "monthly" as const,
};
const WEB_ANNUAL = {
  identifier: "$rc_annual",
  product: { price: 60, priceString: "$60.00", title: "Annual" },
  stripePlan: "yearly" as const,
};

const BENEFITS = [
  { icon: "infinite", title: "Unlimited analyses", body: "No more 3-analysis cap." },
  { icon: "images", title: "Screenshots & Voice", body: "Ingest arguments any way you want." },
  { icon: "flash", title: "GPT-5.4 forensic scoring", body: "The full trait breakdown, quotes, and verdict." },
  { icon: "lock-closed", title: "Private & yours", body: "History stays on your account. Cancel anytime." },
];

export default function Paywall() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    offerings,
    isLoading,
    purchase,
    restore,
    isPurchasing,
    isRestoring,
    isSubscribed,
    identityReady,
    identityError,
  } = useSubscription();

  const packages: PurchasesPackage[] = useMemo(() => {
    const cur = offerings?.current;
    if (!cur) return [];
    return cur.availablePackages ?? [];
  }, [offerings]);

  // On web we skip RevenueCat entirely and render Stripe-backed plans.
  const monthly = IS_WEB
    ? (WEB_MONTHLY as unknown as PurchasesPackage & { stripePlan?: "monthly" | "yearly" })
    : (packages.find((p) => p.identifier === "$rc_monthly") ?? packages[0]);
  const annual = IS_WEB
    ? (WEB_ANNUAL as unknown as PurchasesPackage & { stripePlan?: "monthly" | "yearly" })
    : (packages.find((p) => p.identifier === "$rc_annual") ?? packages[1]);

  const savings = useMemo(() => {
    const m = monthly?.product.price;
    const a = annual?.product.price;
    if (!m || !a || m <= 0) return null;
    const pct = Math.round(100 - (a / (m * 12)) * 100);
    return pct > 0 && pct < 90 ? pct : null;
  }, [monthly, annual]);

  const [selected, setSelected] = useState<"monthly" | "annual">("annual");
  const [error, setError] = useState<string | null>(null);
  const [devConfirming, setDevConfirming] = useState(false);

  React.useEffect(() => {
    if (isSubscribed) router.back();
  }, [isSubscribed, router]);

  const chosen = selected === "annual" ? annual : monthly;

  const { user } = useAuth();

  const doPurchase = async () => {
    if (!chosen) return;
    setError(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

    // Web uses Stripe-hosted Checkout; iOS uses RevenueCat / StoreKit.
    if (IS_WEB) {
      try {
        const plan = selected === "annual" ? "yearly" : "monthly";
        await startStripeCheckout(plan, user?.user_id ?? undefined);
      } catch (e: any) {
        setError(e?.message ?? "We couldn't start checkout. Please try again.");
      }
      return;
    }

    if (__DEV__) {
      setDevConfirming(true);
      return;
    }
    await runPurchase();
  };

  const runPurchase = async () => {
    if (!chosen) return;
    setDevConfirming(false);
    try {
      await purchase(chosen);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (e: any) {
      // Silently ignore user cancellation — never surface it as an error.
      if (e?.userCancelled) return;
      // Map common StoreKit / RevenueCat error codes to friendly copy so the
      // App Review team never sees a raw SDK error string.
      const code: string | undefined = e?.code ?? e?.userInfo?.readable_error_code;
      const friendly =
        code === "PRODUCT_NOT_AVAILABLE_FOR_PURCHASE_ERROR" ||
        code === "PURCHASE_NOT_ALLOWED_ERROR"
          ? "This subscription isn't available on your account right now. Please try again later."
        : code === "STORE_PROBLEM_ERROR" || code === "NETWORK_ERROR"
          ? "We couldn't reach the App Store. Check your connection and try again."
        : code === "PAYMENT_PENDING_ERROR"
          ? "Your payment is pending approval from the App Store."
        : code === "INVALID_RECEIPT_ERROR" || code === "MISSING_RECEIPT_FILE_ERROR"
          ? "We couldn't verify your purchase. Try Restore Purchases."
          : "We couldn't complete this purchase. Please try again.";
      setError(friendly);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    }
  };

  const doRestore = async () => {
    setError(null);
    try {
      const info = await restore();
      const active = (info as any)?.entitlements?.active ?? {};
      if (Object.keys(active).length === 0) {
        setError("No previous purchases were found on this Apple ID.");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
        return;
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (e: any) {
      if (e?.userCancelled) return;
      setError("We couldn't restore your purchases. Please try again.");
    }
  };

  const packagesUnavailable = !IS_WEB && !isLoading && rcEnabled && packages.length === 0;
  const canBuy =
    !!chosen && identityReady && !isPurchasing && !isRestoring && !packagesUnavailable;

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={["#2a0808", colors.surface]}
        style={{ position: "absolute", top: 0, left: 0, right: 0, height: 360 }}
      />
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + spacing.lg,
          paddingBottom: 220 + insets.bottom,
          paddingHorizontal: spacing.lg,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} hitSlop={16} testID="paywall-close">
            <Ionicons name="close" size={24} color={colors.onSurface} />
          </Pressable>
          <Pressable onPress={doRestore} hitSlop={16} testID="paywall-restore">
            {isRestoring ? (
              <ActivityIndicator color={colors.muted} />
            ) : (
              <Text style={styles.restoreText}>Restore</Text>
            )}
          </Pressable>
        </View>

        {/* Hero */}
        <View style={styles.heroBadge}>
          <Ionicons name="warning" size={13} color={colors.brandPrimary} />
          <Text style={styles.heroBadgeText}>NARCCHECK AI PRO</Text>
        </View>
        <Text style={styles.heroTitle}>Unlimited{"\n"}Forensic Analysis</Text>
        <Text style={styles.heroSub}>
          You've hit the free limit. Unlock unlimited scoring and see every manipulation tactic in full.
        </Text>

        {/* Benefits */}
        <View style={styles.benefits}>
          {BENEFITS.map((b) => (
            <View key={b.title} style={styles.benefitRow}>
              <View style={styles.benefitIcon}>
                <Ionicons name={b.icon as any} size={16} color={colors.brandPrimary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.benefitTitle}>{b.title}</Text>
                <Text style={styles.benefitBody}>{b.body}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Plan selector */}
        {isLoading && !IS_WEB ? (
          <View style={styles.plansLoading}>
            <ActivityIndicator color={colors.brandPrimary} />
          </View>
        ) : !rcEnabled && !IS_WEB ? (
          <View style={styles.plansUnavailable}>
            <Text style={styles.plansUnavailableText}>
              Subscriptions are only available in the mobile app.
            </Text>
          </View>
        ) : packages.length === 0 && !IS_WEB ? (
          <View style={styles.plansUnavailable} testID="plans-unavailable">
            <Ionicons name="hourglass-outline" size={22} color={colors.brandSecondary} />
            <Text style={styles.plansUnavailableTitle}>Subscriptions loading</Text>
            <Text style={styles.plansUnavailableText}>
              We couldn't load the subscription options right now. This can happen
              briefly after an update. Please close this screen and try again in a
              moment, or use Restore Purchases if you already subscribed.
            </Text>
            <Pressable
              onPress={doRestore}
              style={styles.plansRestoreBtn}
              testID="plans-restore"
            >
              {isRestoring ? (
                <ActivityIndicator color={colors.onBrandPrimary} />
              ) : (
                <>
                  <Ionicons name="refresh" size={16} color={colors.onBrandPrimary} />
                  <Text style={styles.plansRestoreText}>Restore Purchases</Text>
                </>
              )}
            </Pressable>
          </View>
        ) : (
          <View style={styles.plans}>
            {annual ? (
              <PlanCard
                selected={selected === "annual"}
                onPress={() => setSelected("annual")}
                title="Annual"
                price={annual.product.priceString}
                subtitle={
                  savings != null
                    ? `Billed yearly · Save ${savings}%`
                    : "Billed yearly · Cancel anytime"
                }
                badge="BEST VALUE"
                testID="plan-annual"
              />
            ) : null}
            {monthly ? (
              <PlanCard
                selected={selected === "monthly"}
                onPress={() => setSelected("monthly")}
                title="Monthly"
                price={monthly.product.priceString}
                subtitle="Billed monthly · Cancel anytime"
                testID="plan-monthly"
              />
            ) : null}
          </View>
        )}

        {/* Identity banner is RevenueCat-specific — never shown on web. */}
        {identityError && !IS_WEB ? (
          <View style={styles.errorBanner} testID="paywall-identity-error">
            <Ionicons name="information-circle" size={16} color={colors.brandSecondary} />
            <Text style={styles.errorBannerText}>
              Setting up secure payments… Please retry in a moment.
            </Text>
          </View>
        ) : null}
        {error ? (
          <View style={styles.errorBanner} testID="paywall-error">
            <Ionicons name="alert-circle" size={16} color={colors.brandPrimary} />
            <Text style={styles.errorBannerText}>{error}</Text>
            <Pressable
              onPress={() => setError(null)}
              hitSlop={8}
              testID="paywall-error-dismiss"
            >
              <Ionicons name="close" size={16} color={colors.muted} />
            </Pressable>
          </View>
        ) : null}

        <Text style={styles.finePrint}>
          {IS_WEB
            ? "Recurring billing. Cancel anytime from the Billing Portal. Payments are securely processed by Stripe."
            : "Recurring billing. Cancel anytime in your App Store settings. Payments go through Apple."}
        </Text>
      </ScrollView>

      {/* Sticky purchase bar */}
      <View style={[styles.ctaBar, { paddingBottom: Math.max(insets.bottom, 12) + 12 }]}>
        {packagesUnavailable ? (
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [styles.ctaSecondary, pressed && { opacity: 0.85 }]}
            testID="paywall-close-unavailable"
          >
            <Ionicons name="arrow-back" size={18} color={colors.onSurface} />
            <Text style={styles.ctaSecondaryText}>Back to app</Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={doPurchase}
            disabled={!canBuy}
            style={({ pressed }) => [
              styles.cta,
              !canBuy && styles.ctaDisabled,
              pressed && { opacity: 0.85 },
            ]}
            testID="paywall-purchase"
          >
            {isPurchasing ? (
              <ActivityIndicator color={colors.onBrandPrimary} />
            ) : (
              <>
                <Ionicons name="lock-open" size={18} color={colors.onBrandPrimary} />
                <Text style={styles.ctaText}>
                  {chosen ? `Continue — ${chosen.product.priceString}` : "Continue"}
                </Text>
              </>
            )}
          </Pressable>
        )}
      </View>

      {/* Dev-only confirmation modal */}
      {devConfirming ? (
        <View style={styles.devOverlay} testID="dev-confirm-overlay">
          <View style={styles.devSheet}>
            <Text style={styles.devTitle}>Simulated purchase</Text>
            <Text style={styles.devBody}>
              This is the RevenueCat Test Store. No real charge will be made.
            </Text>
            <View style={{ flexDirection: "row", gap: spacing.md, marginTop: spacing.lg }}>
              <Pressable
                onPress={() => setDevConfirming(false)}
                style={[styles.devBtn, { backgroundColor: colors.surfaceTertiary }]}
                testID="dev-cancel"
              >
                <Text style={styles.devBtnText}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={runPurchase}
                style={[styles.devBtn, { backgroundColor: colors.brandPrimary }]}
                testID="dev-confirm"
              >
                <Text style={[styles.devBtnText, { color: colors.onBrandPrimary }]}>Simulate</Text>
              </Pressable>
            </View>
          </View>
        </View>
      ) : null}
    </View>
  );
}

function PlanCard({
  selected,
  onPress,
  title,
  price,
  subtitle,
  badge,
  testID,
}: {
  selected: boolean;
  onPress: () => void;
  title: string;
  price: string;
  subtitle: string;
  badge?: string;
  testID?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.planCard, selected && styles.planCardSelected]}
      testID={testID}
    >
      <View style={{ flex: 1 }}>
        <View style={styles.planTitleRow}>
          <Text style={styles.planTitle}>{title}</Text>
          {badge ? (
            <View style={styles.planBadge}>
              <Text style={styles.planBadgeText}>{badge}</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.planSubtitle}>{subtitle}</Text>
      </View>
      <View style={styles.planPriceCol}>
        <Text style={styles.planPrice}>{price}</Text>
        <View style={[styles.radio, selected && styles.radioActive]}>
          {selected ? <View style={styles.radioDot} /> : null}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.xl,
  },
  restoreText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "500",
  },
  heroBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
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
  heroTitle: {
    color: colors.onSurface,
    fontSize: 34,
    fontWeight: "500",
    letterSpacing: -1,
    lineHeight: 40,
  },
  heroSub: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21,
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
    maxWidth: 340,
  },
  benefits: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    marginBottom: spacing.xl,
  },
  benefitRow: {
    flexDirection: "row",
    gap: spacing.md,
    alignItems: "flex-start",
  },
  benefitIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  benefitTitle: {
    color: colors.onSurface,
    fontSize: 14,
    fontWeight: "500",
  },
  benefitBody: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 2,
    lineHeight: 18,
  },
  plansLoading: {
    padding: spacing.xl,
    alignItems: "center",
  },
  plansUnavailable: {
    padding: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    alignItems: "center",
    gap: spacing.sm,
  },
  plansUnavailableTitle: {
    color: colors.onSurface,
    fontSize: 15,
    fontWeight: "500",
    marginTop: spacing.xs,
  },
  plansUnavailableText: {
    color: colors.muted,
    fontSize: 13,
    textAlign: "center",
    lineHeight: 19,
  },
  plansRestoreBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.brandPrimary,
    minWidth: 180,
  },
  plansRestoreText: {
    color: colors.onBrandPrimary,
    fontSize: 13,
    fontWeight: "500",
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  errorBannerText: {
    color: colors.onSurface,
    fontSize: 12,
    lineHeight: 17,
    flex: 1,
  },
  plans: { gap: spacing.md },
  planCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  planCardSelected: {
    borderColor: colors.brandPrimary,
    backgroundColor: colors.surfaceTertiary,
  },
  planTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  planTitle: {
    color: colors.onSurface,
    fontSize: 17,
    fontWeight: "500",
  },
  planBadge: {
    backgroundColor: colors.brandPrimary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.sm,
  },
  planBadgeText: {
    color: colors.onBrandPrimary,
    fontSize: 9,
    letterSpacing: 1,
    fontWeight: "500",
  },
  planSubtitle: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 4,
  },
  planPriceCol: {
    alignItems: "flex-end",
    gap: spacing.sm,
  },
  planPrice: {
    color: colors.onSurface,
    fontSize: 17,
    fontWeight: "500",
    letterSpacing: -0.3,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  radioActive: { borderColor: colors.brandPrimary },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.brandPrimary,
  },
  errorText: {
    color: colors.brandPrimary,
    fontSize: 12,
    marginTop: spacing.md,
    textAlign: "center",
  },
  finePrint: {
    color: colors.muted,
    fontSize: 11,
    lineHeight: 16,
    textAlign: "center",
    marginTop: spacing.xl,
  },
  ctaBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    backgroundColor: "rgba(9,9,11,0.92)",
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
  ctaDisabled: { backgroundColor: colors.surfaceTertiary },
  ctaText: {
    color: colors.onBrandPrimary,
    fontSize: 16,
    fontWeight: "500",
  },
  ctaSecondary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.pill,
    paddingVertical: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  ctaSecondaryText: {
    color: colors.onSurface,
    fontSize: 16,
    fontWeight: "500",
  },
  devOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.7)",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
  },
  devSheet: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    width: "100%",
    maxWidth: 340,
  },
  devTitle: {
    color: colors.onSurface,
    fontSize: 17,
    fontWeight: "500",
    marginBottom: spacing.sm,
  },
  devBody: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
  },
  devBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: radius.pill,
    alignItems: "center",
  },
  devBtnText: {
    color: colors.onSurface,
    fontSize: 14,
    fontWeight: "500",
  },
});
