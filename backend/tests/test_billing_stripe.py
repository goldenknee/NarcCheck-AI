"""Backend tests for Stripe web checkout + regression suite (iteration 11)."""
import os
import io
import time
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "").rstrip("/")
assert BASE_URL, "EXPO_PUBLIC_BACKEND_URL not set"

DEVICE = f"TEST_DEV_{int(time.time())}"


@pytest.fixture
def api():
    s = requests.Session()
    return s


# -----------------------------------------------------------------
# Billing: /api/billing/checkout
# -----------------------------------------------------------------
class TestBillingCheckout:
    def test_checkout_monthly_returns_stripe_url(self, api):
        r = api.post(
            f"{BASE_URL}/api/billing/checkout",
            json={"plan": "monthly"},
            headers={"X-Device-Id": DEVICE, "Content-Type": "application/json"},
            timeout=30,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert "url" in body and "session_id" in body
        assert body["url"].startswith("https://checkout.stripe.com/c/pay/cs_test_"), body["url"]
        assert body["session_id"].startswith("cs_test_")

    def test_checkout_yearly_returns_different_session(self, api):
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
        assert r1.json()["session_id"] != r2.json()["session_id"]
        assert r2.json()["url"].startswith("https://checkout.stripe.com/c/pay/cs_test_")

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
            params={"session_id": "cs_test_bogus_does_not_exist_123"},
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
