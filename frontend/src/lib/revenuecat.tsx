import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import Purchases, { LOG_LEVEL } from "react-native-purchases";
import type { CustomerInfo, PurchasesPackage } from "react-native-purchases";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as SecureStore from "expo-secure-store";

import { fetchBillingStatus } from "@/src/lib/stripe-billing";

const REVENUECAT_TEST_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_TEST_API_KEY;
const REVENUECAT_IOS_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY;
const REVENUECAT_ANDROID_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY;

export const REVENUECAT_ENTITLEMENT_IDENTIFIER = "pro";

export const rcEnabled = Platform.OS !== "web" || __DEV__;

function getRevenueCatApiKey(): string {
  if (!REVENUECAT_TEST_API_KEY || !REVENUECAT_IOS_API_KEY || !REVENUECAT_ANDROID_API_KEY) {
    throw new Error("RevenueCat public API keys not found — run the Setup section first");
  }
  if (Platform.OS === "web" || __DEV__) {
    return REVENUECAT_TEST_API_KEY;
  }
  if (Platform.OS === "ios") return REVENUECAT_IOS_API_KEY;
  if (Platform.OS === "android") return REVENUECAT_ANDROID_API_KEY;
  return REVENUECAT_TEST_API_KEY;
}

export function initializeRevenueCat() {
  if (!rcEnabled) return;
  Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.DEBUG : LOG_LEVEL.WARN);
  Purchases.configure({ apiKey: getRevenueCatApiKey() });
}

// This app has no server-side auth. Generate + persist a stable per-device id so
// RevenueCat has a non-anonymous user id it can attach entitlements to. Uses
// SecureStore on native and AsyncStorage on web via @/src/utils/storage fallback.
const DEVICE_ID_KEY = "narc.device_id";

async function getStableDeviceId(): Promise<string> {
  try {
    let id = await SecureStore.getItemAsync(DEVICE_ID_KEY);
    if (!id) {
      id = `narc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
      await SecureStore.setItemAsync(DEVICE_ID_KEY, id);
    }
    return id;
  } catch {
    // secure-store not available (rare) — fall back to an in-memory id
    return `narc-mem-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }
}

function useSubscriptionContext() {
  const queryClient = useQueryClient();
  const boundIdRef = useRef<string | null>(null);
  const [identityBound, setIdentityBound] = useState(false);
  const [identityError, setIdentityError] = useState<string | null>(null);

  // Bind stable device id once on mount BEFORE the customer-info query runs.
  useEffect(() => {
    if (!rcEnabled) return;
    let cancelled = false;
    (async () => {
      try {
        const id = await getStableDeviceId();
        if (cancelled) return;
        if (boundIdRef.current !== id) {
          const { customerInfo } = await Purchases.logIn(id);
          if (cancelled) return;
          boundIdRef.current = id;
          queryClient.setQueryData(["revenuecat", "customer-info"], customerInfo);
          setIdentityBound(true);
          setIdentityError(null);
        }
      } catch (e: any) {
        setIdentityError(String(e?.message ?? e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [queryClient]);

  const customerInfoQuery = useQuery({
    queryKey: ["revenuecat", "customer-info"],
    queryFn: () => Purchases.getCustomerInfo(),
    // Only run AFTER logIn resolves so the anonymous customer info never overwrites
    // the bound identity we already put in the cache.
    enabled: rcEnabled && identityBound,
    staleTime: 60 * 1000,
  });

  const offeringsQuery = useQuery({
    queryKey: ["revenuecat", "offerings"],
    queryFn: () => Purchases.getOfferings(),
    enabled: rcEnabled,
    staleTime: 300 * 1000,
  });

  useEffect(() => {
    if (!rcEnabled) return;
    const listener = (info: CustomerInfo) =>
      queryClient.setQueryData(["revenuecat", "customer-info"], info);
    Purchases.addCustomerInfoUpdateListener(listener);
    return () => {
      Purchases.removeCustomerInfoUpdateListener(listener);
    };
  }, [queryClient]);

  const purchaseMutation = useMutation({
    mutationFn: async (pkg: PurchasesPackage) => {
      const id = (await Purchases.getCustomerInfo()).originalAppUserId;
      if (id.startsWith("$RCAnonymousID:")) throw new Error("identity_not_ready");
      const { customerInfo } = await Purchases.purchasePackage(pkg);
      return customerInfo;
    },
    onSuccess: async (customerInfo) => {
      // Browser Mode's customer-info listener isn't guaranteed to fire, so
      // push the fresh CustomerInfo into the cache and follow up with a
      // deterministic getCustomerInfo() so the pro entitlement flips.
      queryClient.setQueryData(["revenuecat", "customer-info"], customerInfo);
      try {
        const fresh = await Purchases.getCustomerInfo();
        queryClient.setQueryData(["revenuecat", "customer-info"], fresh);
      } catch {}
    },
  });

  const restoreMutation = useMutation({
    mutationFn: () => Purchases.restorePurchases(),
    onSuccess: (customerInfo) => {
      queryClient.setQueryData(["revenuecat", "customer-info"], customerInfo);
    },
  });

  const isSubscribed =
    customerInfoQuery.data?.entitlements.active?.[REVENUECAT_ENTITLEMENT_IDENTIFIER] !== undefined;

  // Stripe entitlement (web). Polled only on web; iOS relies on RevenueCat.
  const stripeEntitlementQuery = useQuery({
    queryKey: ["stripe", "entitlement"],
    queryFn: fetchBillingStatus,
    enabled: Platform.OS === "web",
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
  });
  const stripeActive = stripeEntitlementQuery.data?.status === "active";

  const originalAppUserId = customerInfoQuery.data?.originalAppUserId;
  // On web we use Stripe-hosted Checkout — RC identity binding is irrelevant.
  const identityReady =
    Platform.OS === "web"
      ? true
      : !!originalAppUserId && !originalAppUserId.startsWith("$RCAnonymousID:");

  return {
    customerInfo: customerInfoQuery.data,
    offerings: offeringsQuery.data,
    isSubscribed: isSubscribed || stripeActive,
    identityReady,
    identityError,
    isLoading: customerInfoQuery.isLoading || offeringsQuery.isLoading,
    purchase: purchaseMutation.mutateAsync,
    restore: restoreMutation.mutateAsync,
    isPurchasing: purchaseMutation.isPending,
    isRestoring: restoreMutation.isPending,
    refreshStripeEntitlement: stripeEntitlementQuery.refetch,
  };
}

type SubscriptionContextValue = ReturnType<typeof useSubscriptionContext>;
const Context = createContext<SubscriptionContextValue | null>(null);

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const value = useSubscriptionContext();
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useSubscription() {
  const ctx = useContext(Context);
  if (!ctx) throw new Error("useSubscription must be used within a SubscriptionProvider");
  return ctx;
}
