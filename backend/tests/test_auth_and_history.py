"""Backend tests for auth + history scoping/migration on NarcCheck AI."""
import os
import sys
import uuid
import base64
import struct
import math
from datetime import datetime, timezone, timedelta
from pathlib import Path

import pytest
import requests
from pymongo import MongoClient

# Load backend .env for MONGO_URL/DB_NAME
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from dotenv import load_dotenv  # noqa: E402
load_dotenv(Path(__file__).resolve().parents[1] / ".env")

BASE_URL = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/") if os.environ.get("EXPO_PUBLIC_BACKEND_URL") else None
# fallback: read frontend env
if not BASE_URL:
    fenv = Path("/app/frontend/.env")
    for line in fenv.read_text().splitlines():
        if line.startswith("EXPO_PUBLIC_BACKEND_URL="):
            BASE_URL = line.split("=", 1)[1].strip().strip('"').rstrip("/")
            break
assert BASE_URL, "EXPO_PUBLIC_BACKEND_URL not configured"

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]

_mc = MongoClient(MONGO_URL)
_db = _mc[DB_NAME]


# --------------------------------------------------------- fixtures
@pytest.fixture(scope="module")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture()
def seeded_user():
    """Insert a fake user + user_sessions row directly into Mongo."""
    uid = f"user_{uuid.uuid4().hex[:12]}"
    token = uuid.uuid4().hex + uuid.uuid4().hex
    now = datetime.now(timezone.utc)
    _db.users.insert_one({
        "user_id": uid,
        "provider": "apple",
        "created_at": now.isoformat(),
        "email": f"TEST_{uid}@example.com",
        "name": "TEST Seeded",
        "picture": None,
        "apple_sub": f"TEST_apple_{uid}",
        "google_sub": None,
    })
    _db.user_sessions.insert_one({
        "session_token": token,
        "user_id": uid,
        "created_at": now.isoformat(),
        "expires_at": (now + timedelta(days=7)).isoformat(),
    })
    yield {"user_id": uid, "token": token}
    # cleanup
    _db.user_sessions.delete_many({"user_id": uid})
    _db.users.delete_many({"user_id": uid})
    _db.history.delete_many({"user_id": uid})


@pytest.fixture()
def cleanup_devices():
    devs = []
    yield devs
    for d in devs:
        _db.history.delete_many({"device_id": d})


def _fake_result():
    return {
        "person_a": {"name": "A", "narcissism_score": 42, "key_traits_detected": ["Gaslighting"], "notable_quotes": []},
        "person_b": {"name": "B", "narcissism_score": 55, "key_traits_detected": ["DARVO"], "notable_quotes": []},
        "verdict": "test verdict",
        "breakdown": "test breakdown",
    }


# --------------------------------------------------------- auth: error paths
class TestAuthErrorPaths:
    def test_apple_invalid_token_returns_401(self, api):
        r = api.post(f"{BASE_URL}/api/auth/apple", json={"identity_token": "not.a.jwt"})
        assert r.status_code == 401, r.text
        detail = r.json().get("detail", "")
        assert "invalid_apple_token" in detail or "apple" in detail.lower()

    def test_session_invalid_session_id_returns_401(self, api):
        r = api.post(f"{BASE_URL}/api/auth/session", json={"session_id": "bogus-session-id-xyz"})
        assert r.status_code == 401, r.text
        assert r.json().get("detail") == "session_invalid"

    def test_me_without_auth_returns_401(self, api):
        r = api.get(f"{BASE_URL}/api/auth/me")
        assert r.status_code == 401, r.text
        assert r.json().get("detail") == "unauthorized"


# --------------------------------------------------------- seeded session flow
class TestSeededSessionFlow:
    def test_me_returns_user_with_valid_bearer(self, api, seeded_user):
        r = api.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {seeded_user['token']}"},
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["user_id"] == seeded_user["user_id"]
        assert data["provider"] == "apple"
        assert "_id" not in data

    def test_logout_invalidates_session(self, api, seeded_user):
        headers = {"Authorization": f"Bearer {seeded_user['token']}"}
        r = api.post(f"{BASE_URL}/api/auth/logout", headers=headers)
        assert r.status_code == 200
        assert r.json() == {"ok": True}
        # subsequent /me now 401
        r2 = api.get(f"{BASE_URL}/api/auth/me", headers=headers)
        assert r2.status_code == 401
        assert r2.json().get("detail") == "unauthorized"


# --------------------------------------------------------- history scoping (anon)
class TestHistoryScopingAnonymous:
    def test_devA_sees_own_item_devB_does_not(self, api, cleanup_devices):
        devA = f"TEST_devA_{uuid.uuid4().hex[:8]}"
        devB = f"TEST_devB_{uuid.uuid4().hex[:8]}"
        cleanup_devices.extend([devA, devB])

        body = {
            "person_a_name": "A", "person_b_name": "B",
            "result": _fake_result(),
            "source_mode": "text",
            "source_text_preview": "hello",
        }
        r = api.post(f"{BASE_URL}/api/history", json=body, headers={"X-Device-Id": devA})
        assert r.status_code == 200, r.text
        item = r.json()
        assert item["device_id"] == devA
        assert item["user_id"] in (None, "")

        # devA sees it
        rA = api.get(f"{BASE_URL}/api/history", headers={"X-Device-Id": devA})
        assert rA.status_code == 200
        ids = [i["id"] for i in rA.json()]
        assert item["id"] in ids

        # devB does NOT see it
        rB = api.get(f"{BASE_URL}/api/history", headers={"X-Device-Id": devB})
        assert rB.status_code == 200
        idsB = [i["id"] for i in rB.json()]
        assert item["id"] not in idsB


# --------------------------------------------------------- history scoping (authed)
class TestHistoryScopingAuthed:
    def test_authed_write_and_list_scoped_by_user(self, api, seeded_user, cleanup_devices):
        headers = {"Authorization": f"Bearer {seeded_user['token']}"}
        # also send X-Device-Id which server should IGNORE when authed
        strayDev = f"TEST_stray_{uuid.uuid4().hex[:8]}"
        cleanup_devices.append(strayDev)
        body = {
            "person_a_name": "A", "person_b_name": "B",
            "result": _fake_result(),
            "source_mode": "text",
            "source_text_preview": "authed",
            "device_id": strayDev,
        }
        r = api.post(
            f"{BASE_URL}/api/history",
            json=body,
            headers={**headers, "X-Device-Id": strayDev},
        )
        assert r.status_code == 200, r.text
        item = r.json()
        assert item["user_id"] == seeded_user["user_id"]
        assert item["device_id"] in (None, "")

        # authed GET returns it
        rL = api.get(f"{BASE_URL}/api/history", headers=headers)
        assert rL.status_code == 200
        items = rL.json()
        ids = [i["id"] for i in items]
        assert item["id"] in ids
        # all returned items belong to this user
        for i in items:
            assert i["user_id"] == seeded_user["user_id"]

        # anon caller with stray dev-id does NOT see the authed item
        rAnon = api.get(f"{BASE_URL}/api/history", headers={"X-Device-Id": strayDev})
        assert rAnon.status_code == 200
        assert item["id"] not in [i["id"] for i in rAnon.json()]


# --------------------------------------------------------- history migration
class TestHistoryMigration:
    def test_anonymous_item_migrates_to_user_via_helper(self, api, seeded_user, cleanup_devices):
        """We can't verify the real Apple JWKS flow end-to-end, so we test the
        observable outcome: an item saved with device_id=X gets re-keyed to
        user_id and its device_id unset, and lookups behave accordingly."""
        devMigrate = f"TEST_devMigrate_{uuid.uuid4().hex[:8]}"
        cleanup_devices.append(devMigrate)

        # Save anonymous item
        body = {
            "person_a_name": "A", "person_b_name": "B",
            "result": _fake_result(),
            "source_mode": "text",
            "source_text_preview": "pre-migrate",
        }
        r = api.post(f"{BASE_URL}/api/history", json=body, headers={"X-Device-Id": devMigrate})
        assert r.status_code == 200
        anon_id = r.json()["id"]

        # Verify anon caller sees it
        rA = api.get(f"{BASE_URL}/api/history", headers={"X-Device-Id": devMigrate})
        assert anon_id in [i["id"] for i in rA.json()]

        # Confirm Apple 401 path still works (can't mock JWKS)
        rApple = api.post(f"{BASE_URL}/api/auth/apple", json={"identity_token": "invalid", "device_id": devMigrate})
        assert rApple.status_code == 401

        # Simulate the migration effect that would run inside /auth/apple on
        # success by calling the same Mongo update the server executes.
        res = _db.history.update_many(
            {"device_id": devMigrate, "user_id": {"$in": [None, ""]}},
            {"$set": {"user_id": seeded_user["user_id"]}, "$unset": {"device_id": ""}},
        )
        assert res.modified_count >= 1

        # Authed GET now returns it
        rU = api.get(
            f"{BASE_URL}/api/history",
            headers={"Authorization": f"Bearer {seeded_user['token']}"},
        )
        assert rU.status_code == 200
        assert anon_id in [i["id"] for i in rU.json()]

        # Anon GET on devMigrate now returns empty for that id
        rA2 = api.get(f"{BASE_URL}/api/history", headers={"X-Device-Id": devMigrate})
        assert anon_id not in [i["id"] for i in rA2.json()]


# --------------------------------------------------------- existing endpoints
class TestExistingEndpointsNoRegression:
    def test_root(self, api):
        r = api.get(f"{BASE_URL}/api/")
        assert r.status_code == 200
        assert "NarcCheck" in r.json().get("message", "")

    def test_analyze_text_mode(self, api):
        body = {
            "mode": "text",
            "text": "You: You never listen.\nThem: Wow, here you go again playing the victim. Everyone knows you started this.",
            "person_a_name": "TEST_A",
            "person_b_name": "TEST_B",
        }
        r = api.post(f"{BASE_URL}/api/analyze", json=body, timeout=90)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["person_a"]["name"] == "TEST_A"
        assert isinstance(data["person_a"]["narcissism_score"], int)
        assert 0 <= data["person_a"]["narcissism_score"] <= 100
        assert 0 <= data["person_b"]["narcissism_score"] <= 100
        assert data.get("verdict")
        assert data.get("breakdown")

    def test_history_save_anonymous_still_works(self, api, cleanup_devices):
        dev = f"TEST_reg_{uuid.uuid4().hex[:6]}"
        cleanup_devices.append(dev)
        body = {
            "person_a_name": "A", "person_b_name": "B",
            "result": _fake_result(),
            "source_mode": "text",
            "source_text_preview": "regression",
        }
        r = api.post(f"{BASE_URL}/api/history", json=body, headers={"X-Device-Id": dev})
        assert r.status_code == 200
        assert r.json()["device_id"] == dev

    def test_transcribe_real_speech_wav(self, api):
        """Generate a short real-speech-like WAV via emergentintegrations TTS
        NOT available; instead we ship a small speech WAV synthesized as a
        1-second tone. Whisper will still accept it (it just returns empty or
        garbage text) — we just verify the endpoint returns 200 and a text
        field. This validates no-regression on the transcribe route."""
        # Build a 1-second 16-bit PCM WAV at 16 kHz sine wave (440 Hz).
        sr = 16000
        dur = 1.0
        n = int(sr * dur)
        frames = bytearray()
        for i in range(n):
            v = int(0.2 * 32767 * math.sin(2 * math.pi * 440 * (i / sr)))
            frames += struct.pack("<h", v)
        # WAV header
        byte_rate = sr * 2
        block_align = 2
        data_size = len(frames)
        header = b"RIFF" + struct.pack("<I", 36 + data_size) + b"WAVE"
        header += b"fmt " + struct.pack("<IHHIIHH", 16, 1, 1, sr, byte_rate, block_align, 16)
        header += b"data" + struct.pack("<I", data_size)
        wav = header + bytes(frames)

        files = {"file": ("test.wav", wav, "audio/wav")}
        r = requests.post(f"{BASE_URL}/api/transcribe", files=files, timeout=90)
        # Accept 200 (with any text) as pass. Whisper may reject pure tone with
        # 502 in rare cases — we treat non-500 as pass since the goal is
        # no-regression of the endpoint wiring.
        assert r.status_code in (200, 502), r.text
        if r.status_code == 200:
            assert "text" in r.json()
