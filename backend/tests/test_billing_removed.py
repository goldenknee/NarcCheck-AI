"""Verify billing routes removed + core backend regressions still green."""
import os
import io
import uuid
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://narc-analyzer.preview.emergentagent.com").rstrip("/")


# --- Billing routes 404 ------------------------------------------------------
class TestBillingRemoved:
    @pytest.mark.parametrize("path,method", [
        ("/api/billing/checkout", "post"),
        ("/api/billing/status", "get"),
        ("/api/billing/portal", "post"),
        ("/api/billing/webhook", "post"),
    ])
    def test_billing_route_returns_404(self, path, method):
        r = requests.request(method, f"{BASE_URL}{path}", json={}, timeout=15)
        assert r.status_code == 404, f"{method.upper()} {path} -> {r.status_code} body={r.text[:200]}"


# --- Core API regressions ----------------------------------------------------
class TestCoreApi:
    def test_root(self):
        r = requests.get(f"{BASE_URL}/api/", timeout=15)
        assert r.status_code == 200
        assert "online" in r.json().get("message", "").lower()

    def test_analyze_text(self):
        payload = {
            "mode": "text",
            "text": "A: You never listen.\nB: Stop making things up, you are being dramatic.",
            "person_a_name": "A",
            "person_b_name": "B",
        }
        r = requests.post(f"{BASE_URL}/api/analyze", json=payload, timeout=90)
        assert r.status_code == 200, r.text[:300]
        data = r.json()
        assert "person_a" in data and "person_b" in data
        assert isinstance(data["person_a"]["narcissism_score"], int)
        assert isinstance(data["person_b"]["narcissism_score"], int)
        assert 0 <= data["person_a"]["narcissism_score"] <= 100

    def test_analyze_text_missing_text_returns_400(self):
        r = requests.post(f"{BASE_URL}/api/analyze", json={"mode": "text"}, timeout=20)
        assert r.status_code == 400

    def test_transcribe_empty_returns_400(self):
        files = {"file": ("empty.m4a", b"", "audio/m4a")}
        r = requests.post(f"{BASE_URL}/api/transcribe", files=files, timeout=20)
        assert r.status_code == 400

    def test_transcribe_multipart_bad_audio_returns_502_or_200(self):
        # Minimal invalid audio bytes - whisper should reject but endpoint should at least respond
        files = {"file": ("bad.m4a", b"\x00\x00\x00\x20ftypM4A ", "audio/m4a")}
        r = requests.post(f"{BASE_URL}/api/transcribe", files=files, timeout=60)
        assert r.status_code in (200, 400, 502), f"unexpected {r.status_code}: {r.text[:200]}"


# --- History anonymous with X-Device-Id -------------------------------------
class TestHistoryDevice:
    def test_history_crud(self):
        device_id = f"TEST_dev_{uuid.uuid4()}"
        headers = {"X-Device-Id": device_id, "Content-Type": "application/json"}

        # list empty
        r = requests.get(f"{BASE_URL}/api/history", headers=headers, timeout=15)
        assert r.status_code == 200
        assert r.json() == []

        # save
        payload = {
            "person_a_name": "TEST_Alice",
            "person_b_name": "TEST_Bob",
            "source_mode": "text",
            "source_text_preview": "TEST preview",
            "device_id": device_id,
            "result": {
                "person_a": {"name": "TEST_Alice", "narcissism_score": 10, "key_traits_detected": [], "notable_quotes": []},
                "person_b": {"name": "TEST_Bob", "narcissism_score": 20, "key_traits_detected": [], "notable_quotes": []},
                "verdict": "test",
                "breakdown": "test",
            },
        }
        r = requests.post(f"{BASE_URL}/api/history", headers=headers, json=payload, timeout=15)
        assert r.status_code == 200, r.text[:300]
        item = r.json()
        assert item["device_id"] == device_id
        item_id = item["id"]

        # list now has 1
        r = requests.get(f"{BASE_URL}/api/history", headers=headers, timeout=15)
        assert r.status_code == 200
        ids = [i["id"] for i in r.json()]
        assert item_id in ids

        # delete
        r = requests.delete(f"{BASE_URL}/api/history/{item_id}", headers=headers, timeout=15)
        assert r.status_code == 200
        assert r.json().get("deleted") is True

        # list empty again
        r = requests.get(f"{BASE_URL}/api/history", headers=headers, timeout=15)
        ids = [i["id"] for i in r.json()]
        assert item_id not in ids


# --- Auth invalid token -----------------------------------------------------
class TestAuthInvalidTokens:
    def test_apple_invalid_token(self):
        r = requests.post(f"{BASE_URL}/api/auth/apple", json={"identity_token": "invalid.token.here"}, timeout=20)
        assert 400 <= r.status_code < 500, f"{r.status_code}: {r.text[:200]}"

    def test_google_invalid_token(self):
        r = requests.post(f"{BASE_URL}/api/auth/google", json={"id_token": "invalid.token.here"}, timeout=20)
        assert 400 <= r.status_code < 500, f"{r.status_code}: {r.text[:200]}"
