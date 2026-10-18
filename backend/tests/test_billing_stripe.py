"""Backend tests for Stripe web checkout + regression suite.

Iteration 14: verifies the switch from TEST (sk_test_) to LIVE (sk_live_)
Stripe mode. Asserts:
- /api/billing/checkout returns a cs_live_ session + URL under
  checkout.stripe.com/{c,g}/pay/cs_live_...
- Session retrieved via Stripe SDK reports livemode=true
- billing_address_collection='auto' and metadata preservation
- Full regression suite (analyze/transcribe/history/auth/billing status+verify)
"""
import os
import io
import time
import pytest
import requests

# Load backend .env so STRIPE_SECRET_KEY is available for Session retrieval
try:
    from dotenv import load_dotenv  # type: ignore
    load_dotenv("/app/backend/.env")
    load_dotenv("/app/frontend/.env")
except Exception:
    pass

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "").rstrip("/")
assert BASE_URL, "EXPO_PUBLIC_BACKEND_URL not set"

STRIPE_KEY = os.environ.get("STRIPE_SECRET_KEY", "")

DEVICE = f"TEST_DEV_{int(time.time())}"

# Accept all live Stripe-hosted checkout URL shapes (/c/pay/, /g/pay/, /f/pay/ etc).
# The invariant is: host is checkout.stripe.com AND path contains cs_live_.
LIVE_URL_HOST = "https://checkout.stripe.com/"


def _is_live_checkout_url(url: str) -> bool:
    return url.startswith(LIVE_URL_HOST) and "cs_live_" in url and "cs_test_" not in url


@pytest.fixture
def api():
    s = requests.Session()
    return s


# -----------------------------------------------------------------
# Billing: /api/billing/checkout — LIVE mode assertions
# -----------------------------------------------------------------
class TestBillingCheckoutLive:
    def test_checkout_monthly_returns_live_stripe_url(self, api):
        r = api.post(
            f"{BASE_URL}/api/billing/checkout",
            json={"plan": "monthly"},
            headers={"X-Device-Id": DEVICE, "Content-Type": "application/json"},
            timeout=30,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert "url" in body and "session_id" in body
        assert body["session_id"].startswith("cs_live_"), (
            f"expected cs_live_ session, got {body['session_id']}"
        )
        assert _is_live_checkout_url(body["url"]), (
            f"expected live checkout URL (host checkout.stripe.com, cs_live_ in path), got {body['url']}"
        )
        # Must NOT be a test-mode URL
        assert "cs_test_" not in body["url"] and "cs_test_" not in body["session_id"]

    def test_checkout_yearly_returns_live_session_different(self, api):
        r1 = api.post(
            f"{BASE_URL}/api/billing/checkout",
            json={"plan": "monthly"},
            headers={"X-Device-Id": DEVICE},
            timeout=30,
        )
        r2 = api.post(
            f"{BASE_URL}/api/billing/checkout",
            json={"plan": "yearly"},
            headers={"X-Device-Id": DEVICE},
            timeout=30,
        )
        assert r1.status_code == 200
        assert r2.status_code == 200
        s1, s2 = r1.json()["session_id"], r2.json()["session_id"]
        assert s1 != s2
        assert s1.startswith("cs_live_") and s2.startswith("cs_live_")
        assert _is_live_checkout_url(r2.json()["url"])
        assert "cs_test_" not in r2.json()["url"]

    def test_checkout_missing_device_header_returns_400(self, api):
        r = api.post(
            f"{BASE_URL}/api/billing/checkout",
            json={"plan": "monthly"},
            timeout=15,
        )
        assert r.status_code == 400, r.text

    def test_checkout_invalid_plan_returns_422(self, api):
        r = api.post(
            f"{BASE_URL}/api/billing/checkout",
            json={"plan": "lifetime"},
            headers={"X-Device-Id": DEVICE},
            timeout=15,
        )
        assert r.status_code == 422, r.text

    def test_live_session_livemode_true_and_metadata_preserved(self, api):
        """Retrieve the created Session via Stripe SDK and prove:
        - livemode == True (confirms LIVE mode)
        - billing_address_collection == 'auto'
        - metadata (device_id/user_id/plan) preserved
        - mode == 'subscription'
        - price used is a LIVE price (price_1URhgTI... family — not test IDs)
        """
        if not STRIPE_KEY:
            pytest.skip("STRIPE_SECRET_KEY not available for session retrieval")
        if not STRIPE_KEY.startswith("sk_live_"):
            pytest.fail(
                f"STRIPE_SECRET_KEY is not a live key (got prefix "
                f"{STRIPE_KEY[:8]}). This test iteration requires live mode."
            )
        import stripe
        stripe.api_key = STRIPE_KEY

        test_user = "TEST_user_live_123"
        test_device = f"TEST_DEV_LIVE_META_{int(time.time())}"
        r = api.post(
            f"{BASE_URL}/api/billing/checkout",
            json={"plan": "yearly", "user_id": test_user},
            headers={"X-Device-Id": test_device},
            timeout=30,
        )
        assert r.status_code == 200, r.text
        session_id = r.json()["session_id"]
        assert session_id.startswith("cs_live_"), session_id

        sess = stripe.checkout.Session.retrieve(
            session_id, expand=["subscription", "line_items"]
        )
        # 1. LIVE mode confirmation (Stripe source of truth)
        assert sess.get("livemode") is True, (
            f"expected livemode=True, got {sess.get('livemode')}"
        )
        # 2. billing_address_collection must be 'auto'
        assert sess.get("billing_address_collection") == "auto", (
            f"expected 'auto', got {sess.get('billing_address_collection')}"
        )
        # 3. top-level metadata preserved
        md = sess.get("metadata") or {}
        assert md.get("device_id") == test_device
        assert md.get("user_id") == test_user
        assert md.get("plan") == "yearly"
        # 4. mode is subscription (so Stripe auto-creates a Customer → receipts)
        assert sess.get("mode") == "subscription"
        # 5. client_reference_id mirrors the device id
        assert sess.get("client_reference_id") == test_device
        # 6. allow_promotion_codes enabled
        assert sess.get("allow_promotion_codes") is True
        # 7. line_items reference a LIVE price (not a test price). Just assert
        #    we have one line item and the price id is present and well-formed.
        line_items = (sess.get("line_items") or {}).get("data") or []
        assert line_items, "no line_items on session"
        price = line_items[0].get("price") or {}
        price_id = price.get("id") if isinstance(price, dict) else getattr(price, "id", "")
        assert price_id.startswith("price_"), price_id
        # LIVE prices live under livemode=true on the Price object
        assert price.get("livemode") is True, (
            f"line_item price livemode should be True, got {price.get('livemode')}"
        )


# -----------------------------------------------------------------
# Billing: /api/billing/status + /api/billing/verify
# -----------------------------------------------------------------
class TestBillingStatusAndVerify:
    def test_status_unknown_device_inactive(self, api):
        r = api.get(
            f"{BASE_URL}/api/billing/status",
            headers={"X-Device-Id": f"TEST_UNK_{int(time.time())}"},
            timeout=15,
        )
        assert r.status_code == 200
        assert r.json().get("status") == "inactive"

    def test_verify_bogus_session_returns_404(self, api):
        r = api.get(
            f"{BASE_URL}/api/billing/verify",
            params={"session_id": "cs_live_bogus_does_not_exist_123"},
            headers={"X-Device-Id": DEVICE},
            timeout=20,
        )
        assert r.status_code == 404, r.text


# -----------------------------------------------------------------
# Regression: /api/analyze, /api/transcribe, /api/history
# -----------------------------------------------------------------
class TestRegression:
    def test_analyze_mode_text(self, api):
        r = api.post(
            f"{BASE_URL}/api/analyze",
            json={
                "mode": "text",
                "text": "A: You never listen to me.\nB: That's not true, I always listen. You're overreacting as usual.",
                "person_a_name": "A",
                "person_b_name": "B",
            },
            timeout=90,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert "person_a" in data and "person_b" in data
        assert 0 <= data["person_a"]["narcissism_score"] <= 100
        assert "verdict" in data

    def test_transcribe_multipart(self, api):
        # tiny valid wav header + silence (will transcribe to empty but exercises path)
        wav = (
            b"RIFF$\x00\x00\x00WAVEfmt " + b"\x10\x00\x00\x00\x01\x00\x01\x00"
            b"\x40\x1f\x00\x00\x80>\x00\x00\x02\x00\x10\x00data\x00\x00\x00\x00"
        )
        r = api.post(
            f"{BASE_URL}/api/transcribe",
            files={"file": ("test.wav", io.BytesIO(wav), "audio/wav")},
            timeout=60,
        )
        # STT may return empty text or error on bare silence; accept 200 or 4xx/502
        assert r.status_code in (200, 400, 502), r.text
        if r.status_code == 200:
            assert "text" in r.json()

    def test_history_post_and_get_by_device(self, api):
        dev = f"TEST_HIST_{int(time.time())}"
        payload = {
            "person_a_name": "Alice",
            "person_b_name": "Bob",
            "result": {
                "person_a": {"name": "Alice", "narcissism_score": 50, "key_traits_detected": [], "notable_quotes": []},
                "person_b": {"name": "Bob", "narcissism_score": 30, "key_traits_detected": [], "notable_quotes": []},
                "verdict": "test",
                "breakdown": "test",
            },
            "source_mode": "text",
            "source_text_preview": "preview",
        }
        r = api.post(f"{BASE_URL}/api/history", json=payload, headers={"X-Device-Id": dev}, timeout=15)
        assert r.status_code == 200, r.text
        item_id = r.json()["id"]
        r2 = api.get(f"{BASE_URL}/api/history", headers={"X-Device-Id": dev}, timeout=15)
        assert r2.status_code == 200
        ids = [h["id"] for h in r2.json()]
        assert item_id in ids


class TestAuth:
    def test_apple_invalid_token_returns_4xx(self, api):
        r = api.post(f"{BASE_URL}/api/auth/apple", json={"identity_token": "bogus"}, timeout=15)
        assert 400 <= r.status_code < 500, f"got {r.status_code}: {r.text}"

    def test_google_invalid_token_returns_4xx(self, api):
        r = api.post(f"{BASE_URL}/api/auth/google", json={"id_token": "bogus"}, timeout=15)
        assert 400 <= r.status_code < 500, f"got {r.status_code}: {r.text}"
