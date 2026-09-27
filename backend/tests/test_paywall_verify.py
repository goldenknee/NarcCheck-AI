"""Iteration 9 verification: transcribe multipart, analyze text, auth reachability, history."""
import io
import os
import struct
import wave
import uuid
import pytest
import requests

BASE_URL = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"


def _wav_bytes(seconds: float = 0.5, rate: int = 16000) -> bytes:
    n = int(rate * seconds)
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes(struct.pack("<" + "h" * n, *([0] * n)))
    return buf.getvalue()


# ---- /api/transcribe multipart still works
def test_transcribe_multipart_accepts_file_field():
    files = {"file": ("clip.wav", _wav_bytes(), "audio/wav")}
    r = requests.post(f"{API}/transcribe", files=files, timeout=120)
    assert r.status_code == 200, r.text
    body = r.json()
    assert "text" in body and isinstance(body["text"], str)


# ---- /api/analyze mode=text still works
def test_analyze_text_returns_valid_analysis_result():
    payload = {
        "mode": "text",
        "text": (
            "Alex: You always twist my words. I never said that.\n"
            "Sam: I have the messages here. You literally said it.\n"
            "Alex: You're being crazy again.\n"
        ),
        "person_a_name": "Alex",
        "person_b_name": "Sam",
    }
    r = requests.post(f"{API}/analyze", json=payload, timeout=120)
    assert r.status_code == 200, r.text
    d = r.json()
    for k in ("person_a", "person_b", "verdict", "breakdown"):
        assert k in d
    for p in ("person_a", "person_b"):
        assert 0 <= d[p]["narcissism_score"] <= 100


# ---- Auth endpoints reachable and return 4xx (not 5xx) for invalid tokens
def test_auth_apple_invalid_token_returns_4xx_not_5xx():
    r = requests.post(
        f"{API}/auth/apple",
        json={"identity_token": "not-a-real-jwt"},
        timeout=30,
    )
    assert 400 <= r.status_code < 500, f"expected 4xx got {r.status_code}: {r.text}"


def test_auth_google_invalid_session_returns_4xx_not_5xx():
    # Emergent Google flow validates a session_id header via emergentagent proxy
    r = requests.post(
        f"{API}/auth/session",
        headers={"X-Session-ID": "invalid-session-xyz"},
        timeout=30,
    )
    # 4xx acceptable (401/400). Not 5xx.
    assert 400 <= r.status_code < 500, f"expected 4xx got {r.status_code}: {r.text}"


# ---- History with X-Device-Id header (anon device-scoped)
def test_history_post_and_get_with_device_id():
    device = f"TEST_devicever_{uuid.uuid4().hex[:8]}"
    result = {
        "person_a": {"name": "A", "narcissism_score": 55, "key_traits_detected": ["Gaslighting"], "notable_quotes": ["q"]},
        "person_b": {"name": "B", "narcissism_score": 10, "key_traits_detected": [], "notable_quotes": []},
        "verdict": "test",
        "breakdown": "test",
    }
    payload = {
        "person_a_name": "A",
        "person_b_name": "B",
        "result": result,
        "source_mode": "text",
        "source_text_preview": "TEST_ preview verify",
        "device_id": device,
    }
    rp = requests.post(f"{API}/history", json=payload, headers={"X-Device-Id": device}, timeout=30)
    assert rp.status_code == 200, rp.text
    created = rp.json()
    assert created["device_id"] == device
    assert "_id" not in created

    rg = requests.get(f"{API}/history", headers={"X-Device-Id": device}, timeout=15)
    assert rg.status_code == 200
    items = rg.json()
    assert any(it["id"] == created["id"] for it in items)

    # Cleanup
    requests.delete(f"{API}/history/{created['id']}", headers={"X-Device-Id": device}, timeout=15)
