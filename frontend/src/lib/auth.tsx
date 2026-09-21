// Auth layer for NarcCheck AI: Apple + Emergent-managed Google Sign-In.
// - Anonymous is fine; auth is optional.
// - session_token in expo-secure-store on native; localStorage on web.
// - After sign-in we ask the server to migrate anonymous history to user_id.
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import * as AppleAuthentication from "expo-apple-authentication";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";

const TOKEN_KEY = "narc.session_token";
const DEVICE_ID_KEY = "narc.device_id"; // shared with revenuecat.tsx

export type AuthUser = {
  user_id: string;
  email?: string | null;
  name?: string | null;
  picture?: string | null;
  provider: "apple" | "google";
  created_at: string;
};

type AuthState =
  | { status: "loading" }
  | { status: "anon" }
  | { status: "authed"; user: AuthUser; token: string };

type Ctx = {
  state: AuthState;
  isAuthed: boolean;
  user: AuthUser | null;
  token: string | null;
  appleAvailable: boolean;
  signInWithApple: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  error: string | null;
  clearError: () => void;
};

const AuthContext = createContext<Ctx | null>(null);

// Module-level token for API client to read synchronously.
let currentToken: string | null = null;
export function getSessionToken(): string | null {
  return currentToken;
}

// Called once in root layout.
WebBrowser.maybeCompleteAuthSession();

async function storeToken(token: string | null) {
  currentToken = token;
  if (Platform.OS === "web") {
    try {
      if (token) window.localStorage.setItem(TOKEN_KEY, token);
      else window.localStorage.removeItem(TOKEN_KEY);
    } catch {}
    return;
  }
  try {
    if (token) await SecureStore.setItemAsync(TOKEN_KEY, token);
    else await SecureStore.deleteItemAsync(TOKEN_KEY);
  } catch {}
}

async function loadStoredToken(): Promise<string | null> {
  if (Platform.OS === "web") {
    try {
      return window.localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  }
  try {
    return await SecureStore.getItemAsync(TOKEN_KEY);
  } catch {
    return null;
  }
}

async function getDeviceId(): Promise<string | null> {
  try {
    if (Platform.OS === "web") {
      return window.localStorage.getItem(DEVICE_ID_KEY);
    }
    return await SecureStore.getItemAsync(DEVICE_ID_KEY);
  } catch {
    return null;
  }
}

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL ?? "";

function extractSessionId(url: string): string | null {
  const m = url.match(/[?#&]session_id=([^&#]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: "loading" });
  const [error, setError] = useState<string | null>(null);
  const [appleAvailable, setAppleAvailable] = useState(false);
  const processedSessionIds = useRef<Set<string>>(new Set());

  // Boot: check for stored session.
  useEffect(() => {
    (async () => {
      try {
        if (Platform.OS === "ios") {
          setAppleAvailable(await AppleAuthentication.isAvailableAsync());
        }
      } catch {}
      const token = await loadStoredToken();
      if (!token) {
        setState({ status: "anon" });
        return;
      }
      currentToken = token;
      try {
        const res = await fetch(`${BASE}/api/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error(`me ${res.status}`);
        const user = (await res.json()) as AuthUser;
        setState({ status: "authed", user, token });
      } catch {
        await storeToken(null);
        setState({ status: "anon" });
      }
    })();
  }, []);

  const finishAuth = useCallback(async (token: string, user: AuthUser) => {
    await storeToken(token);
    setState({ status: "authed", user, token });
    setError(null);
  }, []);

  const signInWithApple = useCallback(async () => {
    setError(null);
    if (Platform.OS !== "ios") {
      setError("Apple Sign-In is only available on iOS.");
      return;
    }
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      const identityToken = credential.identityToken;
      if (!identityToken) {
        setError("Apple did not return an identity token.");
        return;
      }
      const fullName = credential.fullName
        ? [credential.fullName.givenName, credential.fullName.familyName].filter(Boolean).join(" ").trim() || null
        : null;
      const deviceId = await getDeviceId();
      const res = await fetch(`${BASE}/api/auth/apple`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identity_token: identityToken,
          full_name: fullName,
          email: credential.email ?? null,
          device_id: deviceId,
        }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b?.detail ?? `apple_login_failed ${res.status}`);
      }
      const data = (await res.json()) as { session_token: string; user: AuthUser };
      await finishAuth(data.session_token, data.user);
    } catch (e: any) {
      if (e?.code === "ERR_CANCELED") return;
      setError(e?.message ?? "Apple sign-in failed");
    }
  }, [finishAuth]);

  const exchangeEmergentSession = useCallback(
    async (sessionId: string) => {
      if (processedSessionIds.current.has(sessionId)) return;
      processedSessionIds.current.add(sessionId);
      const deviceId = await getDeviceId();
      const res = await fetch(`${BASE}/api/auth/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId, device_id: deviceId }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b?.detail ?? `google_exchange_failed ${res.status}`);
      }
      const data = (await res.json()) as { session_token: string; user: AuthUser };
      await finishAuth(data.session_token, data.user);
    },
    [finishAuth],
  );

  const signInWithGoogle = useCallback(async () => {
    setError(null);
    try {
      const redirectUrl =
        Platform.OS === "web" ? `${window.location.origin}/` : Linking.createURL("");
      const authUrl = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;

      if (Platform.OS === "web") {
        window.location.href = authUrl;
        return;
      }

      // Register listener BEFORE opening the browser (Android Custom Tabs).
      let deepLinkedUrl: string | null = null;
      const sub = Linking.addEventListener("url", ({ url }) => {
        deepLinkedUrl = url;
      });

      const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);
      sub.remove();

      const candidateUrl =
        (result as any)?.url ?? deepLinkedUrl ?? (await Linking.getInitialURL());
      if (!candidateUrl) return; // silent cancel
      const sid = extractSessionId(candidateUrl);
      if (!sid) return;
      await exchangeEmergentSession(sid);
    } catch (e: any) {
      setError(e?.message ?? "Google sign-in failed");
    }
  }, [exchangeEmergentSession]);

  // Web cold-start: session_id may already be on the URL.
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const url = window.location.href;
    const sid = extractSessionId(url);
    if (!sid) return;
    exchangeEmergentSession(sid)
      .then(() => {
        try {
          const clean = new URL(window.location.href);
          clean.hash = "";
          clean.searchParams.delete("session_id");
          window.history.replaceState(window.history.state, "", clean.toString());
        } catch {}
      })
      .catch((e) => setError(e?.message ?? "Google sign-in failed"));
  }, [exchangeEmergentSession]);

  // Native cold-start: hot deep-link.
  useEffect(() => {
    if (Platform.OS === "web") return;
    Linking.getInitialURL()
      .then((url) => {
        if (!url) return;
        const sid = extractSessionId(url);
        if (sid) exchangeEmergentSession(sid).catch(() => {});
      })
      .catch(() => {});
    const sub = Linking.addEventListener("url", ({ url }) => {
      const sid = extractSessionId(url);
      if (sid) exchangeEmergentSession(sid).catch(() => {});
    });
    return () => sub.remove();
  }, [exchangeEmergentSession]);

  const signOut = useCallback(async () => {
    setError(null);
    try {
      const t = currentToken;
      if (t) {
        fetch(`${BASE}/api/auth/logout`, {
          method: "POST",
          headers: { Authorization: `Bearer ${t}` },
        }).catch(() => {});
      }
    } catch {}
    await storeToken(null);
    setState({ status: "anon" });
  }, []);

  const deleteAccount = useCallback(async () => {
    setError(null);
    const t = currentToken;
    if (!t) {
      throw new Error("not_signed_in");
    }
    const res = await fetch(`${BASE}/api/auth/me`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${t}` },
    });
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      throw new Error(b?.detail ?? `delete_account_failed ${res.status}`);
    }
    await storeToken(null);
    setState({ status: "anon" });
  }, []);

  const value: Ctx = useMemo(
    () => ({
      state,
      isAuthed: state.status === "authed",
      user: state.status === "authed" ? state.user : null,
      token: state.status === "authed" ? state.token : null,
      appleAvailable,
      signInWithApple,
      signInWithGoogle,
      signOut,
      deleteAccount,
      error,
      clearError: () => setError(null),
    }),
    [state, appleAvailable, signInWithApple, signInWithGoogle, signOut, deleteAccount, error],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): Ctx {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
