"""Tests for the DELETE /api/auth/me (soft-delete account) route."""
import os
import sys
import uuid
from datetime import datetime, timezone, timedelta
from pathlib import Path

import pytest
import requests
from pymongo import MongoClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from dotenv import load_dotenv  # noqa: E402

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

BASE_URL = None
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


def _fake_result():
    return {
        "person_a": {"name": "A", "narcissism_score": 20, "key_traits_detected": [], "notable_quotes": []},
        "person_b": {"name": "B", "narcissism_score": 30, "key_traits_detected": [], "notable_quotes": []},
        "verdict": "v",
        "breakdown": "b",
    }


def _seed_user_with_history(n_history: int = 2):
    uid = f"user_{uuid.uuid4().hex[:12]}"
    token = uuid.uuid4().hex + uuid.uuid4().hex
    now = datetime.now(timezone.utc)
    _db.users.insert_one({
        "user_id": uid,
        "provider": "apple",
        "created_at": now.isoformat(),
        "email": f"TEST_{uid}@example.com",
        "name": "TEST Delete",
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
    inserted_ids = []
    for i in range(n_history):
        hid = str(uuid.uuid4())
        _db.history.insert_one({
            "id": hid,
            "created_at": now.isoformat(),
            "person_a_name": "A",
            "person_b_name": "B",
            "person_a_score": 20,
            "person_b_score": 30,
            "verdict": "v",
            "result": _fake_result(),
            "source_mode": "text",
            "source_text_preview": f"TEST item {i}",
            "user_id": uid,
            "device_id": None,
        })
        inserted_ids.append(hid)
    return uid, token, inserted_ids


def _cleanup_user(uid: str):
    _db.user_sessions.delete_many({"user_id": uid})
    _db.users.delete_many({"user_id": uid})
    _db.history.delete_many({"user_id": uid})


@pytest.fixture()
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


class TestDeleteAccount:
    def test_delete_me_without_auth_returns_401(self, api):
        r = api.delete(f"{BASE_URL}/api/auth/me")
        assert r.status_code == 401, r.text
        assert r.json().get("detail") == "unauthorized"

    def test_delete_me_soft_deletes_user_and_history(self, api):
        uid, token, hids = _seed_user_with_history(2)
        try:
            headers = {"Authorization": f"Bearer {token}"}

            # sanity: /me works, /history returns 2
            rMe = api.get(f"{BASE_URL}/api/auth/me", headers=headers)
            assert rMe.status_code == 200
            rH = api.get(f"{BASE_URL}/api/history", headers=headers)
            assert rH.status_code == 200
            assert len({i["id"] for i in rH.json()} & set(hids)) == 2

            # DELETE /auth/me
            rDel = api.delete(f"{BASE_URL}/api/auth/me", headers=headers)
            assert rDel.status_code == 200, rDel.text
            body = rDel.json()
            assert body.get("deleted") is True
            assert body.get("history_items_removed") == 2

            # /auth/me now 401 (session purged AND user soft-deleted)
            rMe2 = api.get(f"{BASE_URL}/api/auth/me", headers=headers)
            assert rMe2.status_code == 401
            assert rMe2.json().get("detail") == "unauthorized"

            # DB: user has deleted_at; sessions gone; history rows have deleted_at
            udoc = _db.users.find_one({"user_id": uid}, {"_id": 0})
            assert udoc is not None
            assert udoc.get("deleted_at")
            assert _db.user_sessions.count_documents({"user_id": uid}) == 0
            for hid in hids:
                hd = _db.history.find_one({"id": hid}, {"_id": 0})
                assert hd and hd.get("deleted_at")
        finally:
            _cleanup_user(uid)

    def test_stale_token_after_deletion_still_401(self, api):
        """Insert a fresh session for the soft-deleted user; /me must still 401."""
        uid, token, _ = _seed_user_with_history(1)
        try:
            # delete first
            rDel = api.delete(
                f"{BASE_URL}/api/auth/me",
                headers={"Authorization": f"Bearer {token}"},
            )
            assert rDel.status_code == 200

            # Simulate a stale/leaked token by inserting a fresh session row
            stale_token = uuid.uuid4().hex + uuid.uuid4().hex
            now = datetime.now(timezone.utc)
            _db.user_sessions.insert_one({
                "session_token": stale_token,
                "user_id": uid,
                "created_at": now.isoformat(),
                "expires_at": (now + timedelta(days=7)).isoformat(),
            })
            r = api.get(
                f"{BASE_URL}/api/auth/me",
                headers={"Authorization": f"Bearer {stale_token}"},
            )
            assert r.status_code == 401, r.text
            assert r.json().get("detail") == "unauthorized"
        finally:
            _cleanup_user(uid)

    def test_history_list_empty_after_deletion_with_fresh_session(self, api):
        """After soft-delete, insert a fresh session for the same user_id and hit
        GET /api/history; must return [] because user is soft-deleted (so
        get_current_user_optional returns None => query falls back to anon; and
        no anon rows belong to this user)."""
        uid, token, _ = _seed_user_with_history(3)
        try:
            rDel = api.delete(
                f"{BASE_URL}/api/auth/me",
                headers={"Authorization": f"Bearer {token}"},
            )
            assert rDel.status_code == 200
            # Confirm all 3 history rows are soft-deleted
            live = _db.history.count_documents(
                {"user_id": uid, "deleted_at": {"$in": [None, ""]}}
            )
            assert live == 0

            # Fresh session for stale token
            stale_token = uuid.uuid4().hex + uuid.uuid4().hex
            now = datetime.now(timezone.utc)
            _db.user_sessions.insert_one({
                "session_token": stale_token,
                "user_id": uid,
                "created_at": now.isoformat(),
                "expires_at": (now + timedelta(days=7)).isoformat(),
            })
            r = api.get(
                f"{BASE_URL}/api/history",
                headers={"Authorization": f"Bearer {stale_token}"},
            )
            # Since user is soft-deleted, server treats caller as anon (no
            # X-Device-Id) and returns any legacy anon items — must NOT include
            # any of our seeded items (they were soft-deleted).
            assert r.status_code == 200
            ids = [i["id"] for i in r.json()]
            # None of our soft-deleted history rows should appear.
            leaked = _db.history.find({"user_id": uid}, {"_id": 0, "id": 1})
            for row in leaked:
                assert row["id"] not in ids
        finally:
            _cleanup_user(uid)
