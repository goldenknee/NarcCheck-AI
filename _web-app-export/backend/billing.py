"""Stripe Checkout billing for NarcCheck AI web app.

Flow for the MVP (no webhook required):
1. Server idempotently creates the "NarcCheck Pro" product + 2 recurring Prices
   ($8.99/mo, $60/yr) on first boot, and caches the Price IDs.
2. Web client POSTs /api/billing/checkout with plan=monthly|yearly and the
   X-Device-Id header. Server returns a Stripe-hosted checkout URL.
3. On success Stripe redirects to /billing/success?session_id=...
4. Client calls /api/billing/verify?session_id=... which retrieves the session
   from Stripe (authoritative). If payment_status == "paid" and the device_id
   on the session matches the caller, we upsert a pro_entitlements doc.
5. /api/billing/status returns the entitlement for the device.
6. /api/billing/portal opens a Stripe Customer Portal session for cancellation.

Webhook handler is included but tolerates a missing STRIPE_WEBHOOK_SECRET for
development; set it in production to receive subscription updates/cancellations.
"""

from __future__ import annotations

import logging
import os
import time
from typing import Literal, Optional

import stripe
from fastapi import APIRouter, Header, HTTPException, Request
from pydantic import BaseModel

logger = logging.getLogger(__name__)

# -----------------------------------------------------------------------------
# Stripe config
# -----------------------------------------------------------------------------
def _get_stripe_key() -> str:
    """Lazy-read the Stripe key each call so dotenv-loaded env is honoured even
    when billing.py was imported before load_dotenv() ran in server.py."""
    key = os.environ.get("STRIPE_SECRET_KEY") or os.environ.get("STRIPE_API_KEY") or ""
    if key == "sk_test_emergent":  # Emergent placeholder → treat as unset
        return ""
    return key


def _is_stripe_configured() -> bool:
    key = _get_stripe_key()
    if key:
        stripe.api_key = key
        return True
    return False

PRODUCT_NAME = "NarcCheck Pro"
PRICE_MONTHLY_CENTS = 899   # $8.99
PRICE_YEARLY_CENTS = 6000   # $60.00

# These are populated by ensure_products() on startup.
_PRICE_IDS: dict[str, str] = {"monthly": "", "yearly": ""}


def _web_url() -> str:
    """Base URL used for Stripe success / cancel redirects.

    Prefers APP_URL (the public preview URL) when available; falls back to
    localhost for local-only runs.
    """
    return (
        os.environ.get("APP_URL")
        or os.environ.get("WEB_URL")
        or "http://localhost:3000"
    ).rstrip("/")


async def ensure_products(db) -> None:
    """Idempotently ensure the NarcCheck Pro product + both prices exist.

    Caches the resolved price IDs in the module-level _PRICE_IDS so checkout
    doesn't hit Stripe product APIs on every request.
    """
    if not _is_stripe_configured():
        logger.warning("STRIPE_SECRET_KEY unset; Stripe billing disabled.")
        return

    try:
        # Find or create the product by name.
        products = stripe.Product.list(limit=100, active=True)
        product = next((p for p in products.auto_paging_iter() if p.name == PRODUCT_NAME), None)
        if product is None:
            product = stripe.Product.create(
                name=PRODUCT_NAME,
                description="Unlimited analyses, trait radar, streak freezer, shareable receipts.",
            )

        # Find or create recurring prices.
        prices = stripe.Price.list(product=product.id, limit=100, active=True)
        monthly = next(
            (p for p in prices.auto_paging_iter()
             if p.recurring and p.recurring.interval == "month"
             and p.unit_amount == PRICE_MONTHLY_CENTS),
            None,
        )
        if monthly is None:
            monthly = stripe.Price.create(
                product=product.id,
                unit_amount=PRICE_MONTHLY_CENTS,
                currency="usd",
                recurring={"interval": "month"},
            )
        yearly = next(
            (p for p in prices.auto_paging_iter()
             if p.recurring and p.recurring.interval == "year"
             and p.unit_amount == PRICE_YEARLY_CENTS),
            None,
        )
        if yearly is None:
            yearly = stripe.Price.create(
                product=product.id,
                unit_amount=PRICE_YEARLY_CENTS,
                currency="usd",
                recurring={"interval": "year"},
            )

        _PRICE_IDS["monthly"] = monthly.id
        _PRICE_IDS["yearly"] = yearly.id
        logger.info("Stripe prices ready: monthly=%s yearly=%s", monthly.id, yearly.id)

        # Create unique index on device_id + stripe_subscription_id for upserts.
        await db.pro_entitlements.create_index("device_id", unique=True)
        await db.stripe_events.create_index("event_id", unique=True)
    except Exception as e:
        logger.exception("Failed to ensure Stripe products: %s", e)


# -----------------------------------------------------------------------------
# Pydantic models
# -----------------------------------------------------------------------------
class CheckoutRequest(BaseModel):
    plan: Literal["monthly", "yearly"]
    user_id: Optional[str] = None


class PortalRequest(BaseModel):
    pass


# -----------------------------------------------------------------------------
# Helpers
# -----------------------------------------------------------------------------
def _require_device(x_device_id: Optional[str]) -> str:
    if not x_device_id or not (6 <= len(x_device_id) <= 200):
        raise HTTPException(400, "X-Device-Id header is required")
    return x_device_id


async def _grant_from_subscription(db, sub, *, device_id: str, user_id: Optional[str] = None):
    """Upsert the pro_entitlements doc from a Stripe Subscription."""
    status = sub.get("status") if isinstance(sub, dict) else sub.status
    period_end = sub.get("current_period_end") if isinstance(sub, dict) else sub.current_period_end
    customer_id = sub.get("customer") if isinstance(sub, dict) else sub.customer
    subscription_id = sub.get("id") if isinstance(sub, dict) else sub.id
    active = status in {"active", "trialing"}

    await db.pro_entitlements.update_one(
        {"device_id": device_id},
        {"$set": {
            "device_id": device_id,
            "user_id": user_id,
            "status": "active" if active else "inactive",
            "current_period_end": period_end,
            "stripe_customer_id": customer_id,
            "stripe_subscription_id": subscription_id,
            "stripe_status": status,
            "updated_at": int(time.time()),
        }},
        upsert=True,
    )


# -----------------------------------------------------------------------------
# Router
# -----------------------------------------------------------------------------
def make_billing_router(db) -> APIRouter:
    router = APIRouter(prefix="/billing", tags=["billing"])

    @router.post("/checkout")
    async def create_checkout(
        body: CheckoutRequest,
        x_device_id: Optional[str] = Header(None),
    ):
        device_id = _require_device(x_device_id)
        if not _is_stripe_configured():
            raise HTTPException(503, "Billing not configured")
        price_id = _PRICE_IDS.get(body.plan)
        if not price_id:
            raise HTTPException(503, "Pricing not yet initialised. Please retry.")
        base = _web_url()
        try:
            session = stripe.checkout.Session.create(
                mode="subscription",
                line_items=[{"price": price_id, "quantity": 1}],
                success_url=f"{base}/billing/success?session_id={{CHECKOUT_SESSION_ID}}",
                cancel_url=f"{base}/billing/cancel",
                client_reference_id=device_id,
                metadata={"device_id": device_id, "user_id": body.user_id or "", "plan": body.plan},
                subscription_data={
                    "metadata": {"device_id": device_id, "user_id": body.user_id or "", "plan": body.plan},
                    "description": "NarcCheck Pro — receipt and invoice will be emailed automatically.",
                },
                # Note: Checkout in subscription mode ALWAYS creates a Customer
                # automatically — the collected email is persisted on that
                # Customer, so Stripe can email receipts for every renewal.
                billing_address_collection="auto",
                allow_promotion_codes=True,
            )
            return {"url": session.url, "session_id": session.id}
        except stripe.error.StripeError as e:
            logger.exception("Stripe checkout failed: %s", e)
            raise HTTPException(502, "Could not start checkout. Please try again.")

    @router.get("/verify")
    async def verify_session(
        session_id: str,
        x_device_id: Optional[str] = Header(None),
    ):
        """Called by the success page. Confirms payment with Stripe (source of
        truth) and grants the entitlement if everything checks out."""
        device_id = _require_device(x_device_id)
        if not _is_stripe_configured():
            raise HTTPException(503, "Billing not configured")
        try:
            session = stripe.checkout.Session.retrieve(session_id, expand=["subscription"])
        except stripe.error.StripeError as e:
            logger.exception("Session retrieve failed: %s", e)
            raise HTTPException(404, "Session not found")

        md = session.get("metadata") or {}
        if md.get("device_id") != device_id:
            # Prevent cross-device entitlement grants.
            raise HTTPException(403, "Device does not match session")
        if session.get("payment_status") != "paid":
            return {"status": "pending"}

        sub = session.get("subscription")
        if sub is None:
            return {"status": "pending"}
        await _grant_from_subscription(
            db, sub, device_id=device_id, user_id=md.get("user_id") or None
        )
        return {"status": "active"}

    @router.get("/status")
    async def status(x_device_id: Optional[str] = Header(None)):
        device_id = _require_device(x_device_id)
        row = await db.pro_entitlements.find_one({"device_id": device_id}, {"_id": 0})
        if not row:
            return {"status": "inactive"}
        # Treat anything whose Stripe period has elapsed as inactive, even if we
        # never got a webhook.
        now = int(time.time())
        if row.get("status") == "active" and row.get("current_period_end"):
            if row["current_period_end"] + 60 < now:
                row["status"] = "inactive"
        return row

    @router.post("/portal")
    async def portal(x_device_id: Optional[str] = Header(None)):
        device_id = _require_device(x_device_id)
        if not _is_stripe_configured():
            raise HTTPException(503, "Billing not configured")
        row = await db.pro_entitlements.find_one({"device_id": device_id})
        if not row or not row.get("stripe_customer_id"):
            raise HTTPException(404, "No subscription found for this device")
        try:
            portal_session = stripe.billing_portal.Session.create(
                customer=row["stripe_customer_id"],
                return_url=f"{_web_url()}/paywall",
            )
            return {"url": portal_session.url}
        except stripe.error.StripeError as e:
            logger.exception("Portal failed: %s", e)
            raise HTTPException(502, "Could not open billing portal")

    @router.post("/webhook")
    async def webhook(request: Request):
        """Optional webhook handler.

        If STRIPE_WEBHOOK_SECRET is set we verify the signature. In dev we
        accept events unverified so you can wire up `stripe listen` later.
        """
        payload = await request.body()
        secret = os.environ.get("STRIPE_WEBHOOK_SECRET", "")
        signature = request.headers.get("stripe-signature")
        try:
            if secret and signature:
                event = stripe.Webhook.construct_event(payload, signature, secret)
            else:
                import json as _json
                event = _json.loads(payload or b"{}")
        except Exception:
            raise HTTPException(400, "Invalid webhook")

        event_id = event.get("id") if isinstance(event, dict) else event.id
        try:
            await db.stripe_events.insert_one({"event_id": event_id, "received_at": int(time.time())})
        except Exception:
            return {"received": True, "duplicate": True}

        etype = event.get("type") if isinstance(event, dict) else event.type
        obj = (event.get("data") or {}).get("object") if isinstance(event, dict) else event.data.object

        if etype == "checkout.session.completed":
            md = (obj.get("metadata") or {}) if isinstance(obj, dict) else (obj.metadata or {})
            device_id = md.get("device_id") or (obj.get("client_reference_id") if isinstance(obj, dict) else obj.client_reference_id)
            sub_id = obj.get("subscription") if isinstance(obj, dict) else obj.subscription
            if device_id and sub_id:
                sub = stripe.Subscription.retrieve(sub_id)
                await _grant_from_subscription(db, sub, device_id=device_id, user_id=md.get("user_id") or None)
        elif etype in {"customer.subscription.updated", "customer.subscription.deleted",
                       "invoice.paid", "invoice.payment_failed"}:
            md = (obj.get("metadata") or {}) if isinstance(obj, dict) else (obj.metadata or {})
            device_id = md.get("device_id")
            if not device_id:
                sub_id = obj.get("id") if isinstance(obj, dict) else obj.id
                row = await db.pro_entitlements.find_one({"stripe_subscription_id": sub_id})
                device_id = (row or {}).get("device_id")
            if device_id:
                sub = obj if (isinstance(obj, dict) and obj.get("object") == "subscription") else (obj if hasattr(obj, "status") else None)
                if sub is None:
                    sub_id = obj.get("subscription") if isinstance(obj, dict) else getattr(obj, "subscription", None)
                    if sub_id:
                        sub = stripe.Subscription.retrieve(sub_id)
                if sub is not None:
                    await _grant_from_subscription(db, sub, device_id=device_id, user_id=md.get("user_id") or None)

        return {"received": True}

    return router
