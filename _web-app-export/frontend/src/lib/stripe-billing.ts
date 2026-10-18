import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

const DEVICE_ID_KEY = "narc.device_id"; // same key as auth.tsx / revenuecat.tsx

/** Reads the device id persisted by auth.tsx / revenuecat.tsx. Returns null when missing. */
export async function getDeviceId(): Promise<string | null> {
  try {
    const v = await AsyncStorage.getItem(DEVICE_ID_KEY);
    return v ?? null;
  } catch {
    return null;
  }
}

type Plan = "monthly" | "yearly";

const api = (): string =>
  (process.env.EXPO_PUBLIC_BACKEND_URL ?? "").replace(/\/+$/, "");

async function withHeaders(): Promise<HeadersInit> {
  const id = (await getDeviceId()) ?? "web-unknown";
  return { "Content-Type": "application/json", "X-Device-Id": id };
}

/** Starts Stripe-hosted Checkout and redirects the browser on web. */
export async function startStripeCheckout(plan: Plan, userId?: string): Promise<void> {
  const r = await fetch(`${api()}/api/billing/checkout`, {
    method: "POST",
    headers: await withHeaders(),
    body: JSON.stringify({ plan, user_id: userId ?? null }),
  });
  if (!r.ok) {
    const b = await r.json().catch(() => ({}));
    throw new Error(b?.detail ?? "Could not start checkout. Please try again.");
  }
  const { url } = (await r.json()) as { url: string };
  if (!url) throw new Error("No checkout URL returned");
  if (Platform.OS === "web") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).location?.assign(url);
  } else {
    // Native fallback (we gate the paywall to Stripe on web only, so this is defensive).
    const { openURL } = await import("expo-linking");
    await openURL(url);
  }
}

/** Verifies a Stripe session on return; returns "active" when the entitlement was granted. */
export async function verifyStripeSession(sessionId: string): Promise<"active" | "pending"> {
  const r = await fetch(
    `${api()}/api/billing/verify?session_id=${encodeURIComponent(sessionId)}`,
    { headers: await withHeaders() },
  );
  if (!r.ok) {
    const b = await r.json().catch(() => ({}));
    throw new Error(b?.detail ?? `HTTP ${r.status}`);
  }
  const { status } = (await r.json()) as { status: "active" | "pending" };
  return status;
}

/** Returns the device's current entitlement status for the gating code to use. */
export async function fetchBillingStatus(): Promise<{ status: "active" | "inactive"; current_period_end?: number }> {
  const r = await fetch(`${api()}/api/billing/status`, { headers: await withHeaders() });
  if (!r.ok) return { status: "inactive" };
  return (await r.json()) as { status: "active" | "inactive"; current_period_end?: number };
}

/** Opens the Stripe customer portal in the current browser tab. */
export async function openStripePortal(): Promise<void> {
  const r = await fetch(`${api()}/api/billing/portal`, {
    method: "POST",
    headers: await withHeaders(),
  });
  if (!r.ok) {
    const b = await r.json().catch(() => ({}));
    throw new Error(b?.detail ?? "Could not open billing portal");
  }
  const { url } = (await r.json()) as { url: string };
  if (Platform.OS === "web" && url) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).location?.assign(url);
  }
}
