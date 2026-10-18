# NarcCheck AI — Web App Export

Everything needed to resurrect the web (Expo Web + Stripe) build of NarcCheck AI
inside a fresh Emergent workspace. Nothing in this folder is referenced by the
iOS app any more, so you can copy it out and delete this folder when you're done.

Last exported: October 2026 (after original iOS submission).

---

## What this bundle contains

```
_web-app-export/
├── README.md                     ← you are here
├── backend/
│   └── billing.py                ← FastAPI Stripe-Checkout router
└── frontend/
    ├── src/
    │   ├── components/
    │   │   ├── web-frame.tsx     ← desktop phone-frame + hero copy
    │   │   └── legal-page.tsx    ← shared Terms/Privacy layout primitive
    │   └── lib/
    │       ├── stripe-billing.ts ← frontend wrapper around /api/billing/*
    │       └── use-is-desktop.ts ← Dimensions hook for responsive branching
    └── app/
        ├── billing/
        │   ├── success.tsx       ← /billing/success?session_id=…
        │   └── cancel.tsx        ← /billing/cancel
        └── legal/
            ├── terms.tsx         ← Terms of Service
            └── privacy.tsx       ← Privacy Policy
```

---

## Prerequisites in the NEW workspace

Create a fresh Emergent workspace from the Expo + FastAPI + Mongo template. Then
make sure these pieces exist (they already come with the template):

- `/app/frontend/src/theme.ts` with `colors`, `radius`, `spacing` exports
- `/app/frontend/src/components/` folder
- `/app/frontend/src/lib/` folder
- A root `_layout.tsx` with Expo Router Stack
- `react-native-safe-area-context`, `expo-linear-gradient`, `expo-haptics`,
  `@react-native-vector-icons/ionicons`, `@tanstack/react-query`, `expo-router`,
  `expo-linking` installed
- `@react-native-async-storage/async-storage` installed (stripe-billing.ts uses it)
- `stripe` Python package in the backend (`pip install stripe`)
- A `STRIPE_SECRET_KEY=sk_live_…` or `sk_test_…` in `/app/backend/.env`

---

## Copy map — exact paths in the new workspace

| From this bundle                                        | Paste to                                                         |
|---------------------------------------------------------|------------------------------------------------------------------|
| `backend/billing.py`                                    | `/app/backend/billing.py`                                        |
| `frontend/src/components/web-frame.tsx`                 | `/app/frontend/src/components/web-frame.tsx`                     |
| `frontend/src/components/legal-page.tsx`                | `/app/frontend/src/components/legal-page.tsx`                    |
| `frontend/src/lib/stripe-billing.ts`                    | `/app/frontend/src/lib/stripe-billing.ts`                        |
| `frontend/src/lib/use-is-desktop.ts`                    | `/app/frontend/src/lib/use-is-desktop.ts`                        |
| `frontend/app/billing/success.tsx`                      | `/app/frontend/app/billing/success.tsx`                          |
| `frontend/app/billing/cancel.tsx`                       | `/app/frontend/app/billing/cancel.tsx`                           |
| `frontend/app/legal/terms.tsx`                          | `/app/frontend/app/legal/terms.tsx`                              |
| `frontend/app/legal/privacy.tsx`                        | `/app/frontend/app/legal/privacy.tsx`                            |

---

## Wire-up changes in the new workspace

### 1. `backend/server.py` — add the billing router and startup hook

```python
# at top with other imports
from billing import make_billing_router, ensure_products as ensure_billing_products

# where you include routers
app.include_router(make_billing_router(db), prefix="/api")

# in your startup event
@app.on_event("startup")
async def _startup():
    try:
        await ensure_billing_products(db)
    except Exception:
        logging.exception("billing setup failed")
```

### 2. `backend/.env` — add Stripe credentials

```
STRIPE_SECRET_KEY=sk_test_...        # swap to sk_live_... when going live
STRIPE_WEBHOOK_SECRET=whsec_...      # optional for dev; needed in prod
APP_URL=https://your-deploy.emergent.sh   # used for success/cancel redirects
```

### 3. `frontend/app/_layout.tsx` — register routes and wrap Stack with WebFrame

```tsx
import { WebFrame } from "@/src/components/web-frame";

// … inside your provider tree
<WebFrame>
  <Stack screenOptions={{ headerShown: false }}>
    {/* your existing screens */}
    <Stack.Screen name="billing/success" options={{ presentation: "modal", animation: "slide_from_bottom" }} />
    <Stack.Screen name="billing/cancel"  options={{ presentation: "modal", animation: "slide_from_bottom" }} />
    <Stack.Screen name="legal/terms"     options={{ presentation: "modal", animation: "slide_from_bottom" }} />
    <Stack.Screen name="legal/privacy"   options={{ presentation: "modal", animation: "slide_from_bottom" }} />
  </Stack>
</WebFrame>
```

### 4. Paywall branching — in your `app/paywall.tsx`

Add web-specific plan rendering and Stripe-checkout call. Minimal pattern:

```tsx
import { Platform } from "react-native";
import { startStripeCheckout } from "@/src/lib/stripe-billing";

const IS_WEB = Platform.OS === "web";

// Hard-coded plan shapes for web (prices come from Stripe server anyway).
const WEB_MONTHLY = { identifier: "$rc_monthly",
  product: { price: 8.99, priceString: "$8.99", title: "Monthly" } };
const WEB_ANNUAL  = { identifier: "$rc_annual",
  product: { price: 60,   priceString: "$60.00", title: "Annual" } };

// in your paywall component
const monthly = IS_WEB ? WEB_MONTHLY : rcMonthly;
const annual  = IS_WEB ? WEB_ANNUAL  : rcAnnual;

// in your purchase handler
if (IS_WEB) {
  const plan = selected === "annual" ? "yearly" : "monthly";
  await startStripeCheckout(plan, user?.user_id ?? undefined);
  return;
}
// else existing RevenueCat flow
```

### 5. Subscription entitlement — merge Stripe status

If you already have a `useSubscription` hook that returns `isSubscribed` from
RevenueCat, union it with the Stripe status on web:

```tsx
import { fetchBillingStatus } from "@/src/lib/stripe-billing";

const stripeEntitlementQuery = useQuery({
  queryKey: ["stripe", "entitlement"],
  queryFn: fetchBillingStatus,
  enabled: Platform.OS === "web",
  staleTime: 30 * 1000,
});
const stripeActive = stripeEntitlementQuery.data?.status === "active";

const isSubscribed = rcIsSubscribed || stripeActive;
```

### 6. Hide iOS-only features on web (if your app has them)

In `voice-recorder.tsx`:
```tsx
if (Platform.OS === "web") {
  return <WebFallback copy="Voice notes are available in the iOS app." />;
}
```

In `sign-in.tsx`, hide the Apple sign-in button entirely on web — only render it
when `Platform.OS === "ios" && appleAvailable`.

### 7. Legal links

Add from both the paywall sticky CTA bar and the sign-in screen footer:
```tsx
<Pressable onPress={() => router.push("/legal/terms")}>
  <Text>Terms</Text>
</Pressable>
<Pressable onPress={() => router.push("/legal/privacy")}>
  <Text>Privacy</Text>
</Pressable>
```

---

## Stripe-side setup

1. Dashboard → **Developers → API keys** → copy `sk_live_…` (or `sk_test_…` for dev)
2. Dashboard → **Settings → Emails** → enable "Successful payments"
3. Dashboard → **Developers → Webhooks → + Add endpoint**:
   - URL: `https://<your-deploy>/api/billing/webhook`
   - Events: `checkout.session.completed`, `customer.subscription.updated`,
     `customer.subscription.deleted`, `invoice.payment_failed`
   - Copy the `whsec_…` into `STRIPE_WEBHOOK_SECRET`
4. On first backend boot, `ensure_products()` auto-creates the "NarcCheck Pro"
   product + monthly ($8.99) + yearly ($60) recurring prices.

---

## Legal page constants

Before shipping, edit the three constants at the top of
`frontend/src/components/legal-page.tsx`:

```ts
export const SUPPORT_EMAIL = "Goldenknee@gmail.com";
export const COMPANY_NAME = "NarcCheck AI";
export const LEGAL_EFFECTIVE_DATE = "October 2026";
```

Governing-law in `terms.tsx` section 10 is set to **State of Florida** — change
only if the business is incorporated elsewhere.

---

## Smoke test after wiring

```bash
curl -X POST http://localhost:8001/api/billing/checkout \
  -H 'Content-Type: application/json' -H 'X-Device-Id: smoke-1' \
  -d '{"plan":"monthly"}'
# → {"url":"https://checkout.stripe.com/c/pay/cs_test_...","session_id":"cs_test_..."}
```

Open the returned URL in a browser → should show a Stripe-hosted checkout page
with "NarcCheck Pro — $8.99/mo". Pay with card `4242 4242 4242 4242` any
future expiry, any CVC → you'll land on `/billing/success` and your
`pro_entitlements` doc for `smoke-1` will flip to `status: "active"`.

---

## Done

You should now have a fully-functional NarcCheck AI web app with Stripe
subscriptions. Delete this `_web-app-export/` folder from the old iOS workspace
once you've verified everything works in the new one.
