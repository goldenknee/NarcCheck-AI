"""Auth layer for NarcCheck AI.

- Apple Sign-In: verify identity token against Apple JWKS, upsert user by apple_sub, issue session_token.
- Emergent-managed Google auth: exchange the one-time session_id via demobackend, upsert user by email, issue session_token.
- Session tokens live in `user_sessions` (7 day TTL). Bearer only, no cookies.
- History migration: bulk re-key history rows from device_id -> user_id on first sign-in.
"""
from __future__ import annotations

import os
import uuid
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional

import httpx
import jwt
from fastapi import APIRouter, Header, HTTPException, Request
from pydantic import BaseModel, Field

APPLE_JWKS_URL = "https://appleid.apple.com/auth/keys"
APPLE_ISSUER = "https://appleid.apple.com"
EMERGENT_SESSION_URL = "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data"

logger = logging.getLogger(__name__)

APPLE_AUDIENCES = [
    a.strip()
    for a in (os.environ.get("APPLE_AUDIENCES") or "").split(",")
    if a.strip()
]

# JWKS cache (12h)
_jwks_cache: dict = {"fetched_at": 0.0, "keys": {}}


async def _get_apple_jwks() -> dict[str, dict]:
    now = datetime.now(timezone.utc).timestamp()
    if now - _jwks_cache["fetched_at"] < 12 * 3600 and _jwks_cache["keys"]:
        return _jwks_cache["keys"]
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.get(APPLE_JWKS_URL)
        r.raise_for_status()
        data = r.json()
    keys_by_kid: dict[str, dict] = {}
    for k in data.get("keys", []):
        kid = k.get("kid")
        if kid:
            keys_by_kid[kid] = k
    _jwks_cache["keys"] = keys_by_kid
    _jwks_cache["fetched_at"] = now
    return keys_by_kid


async def verify_apple_identity_token(token: str) -> dict:
    """Return decoded claims after verifying the token against Apple's JWKS."""
    try:
        header = jwt.get_unverified_header(token)
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"invalid_apple_token_header: {e}")

    kid = header.get("kid")
    keys = await _get_apple_jwks()
    key_data = keys.get(kid) if kid else None
    if not key_data:
        # cache miss — force refresh once
        _jwks_cache["fetched_at"] = 0.0
        keys = await _get_apple_jwks()
        key_data = keys.get(kid) if kid else None
    if not key_data:
        raise HTTPException(status_code=401, detail="apple_key_not_found")

    if not APPLE_AUDIENCES:
        raise HTTPException(status_code=500, detail="APPLE_AUDIENCES not configured")

    public_key = jwt.algorithms.RSAAlgorithm.from_jwk(key_data)
    try:
        claims = jwt.decode(
            token,
            key=public_key,
            algorithms=["RS256"],
            audience=APPLE_AUDIENCES,
            issuer=APPLE_ISSUER,
            options={"require": ["exp", "iat", "sub"]},
        )
    except jwt.PyJWTError as e:
        raise HTTPException(status_code=401, detail=f"invalid_apple_token: {e}")
    return claims


# ------------------------------------------------------------------ models
class User(BaseModel):
    user_id: str
    email: Optional[str] = None
    name: Optional[str] = None
    picture: Optional[str] = None
    apple_sub: Optional[str] = None
    google_sub: Optional[str] = None
    provider: str  # 'apple' | 'google'
    created_at: str


class AuthResponse(BaseModel):
    session_token: str
    user: User


class AppleLoginRequest(BaseModel):
    identity_token: str
    full_name: Optional[str] = None
    email: Optional[str] = None
    device_id: Optional[str] = None  # to migrate anonymous history


class EmergentSessionRequest(BaseModel):
    session_id: str
    device_id: Optional[str] = None


# ------------------------------------------------------------------ helpers
def _new_user_id() -> str:
    return f"user_{uuid.uuid4().hex[:12]}"


def _new_session_token() -> str:
    return uuid.uuid4().hex + uuid.uuid4().hex


def _iso_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _to_utc(dt) -> datetime:
    if isinstance(dt, str):
        dt = datetime.fromisoformat(dt.replace("Z", "+00:00"))
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


async def _upsert_user(db, *, provider: str, key: dict, profile: dict) -> User:
    """Upsert a user. `key` is the query used to find them (one field: apple_sub or email).
    `profile` contains fields to set on insert AND (when non-None) on update."""
    now = _iso_now()
    existing = await db.users.find_one(key, {"_id": 0})
    if existing:
        # Only update fields that are not None (avoid overwriting with null on subsequent Apple logins)
        updates = {k: v for k, v in profile.items() if v is not None}
        if updates:
            await db.users.update_one({"user_id": existing["user_id"]}, {"$set": updates})
            existing.update(updates)
        return User(**existing)

    doc = {
        "user_id": _new_user_id(),
        "provider": provider,
        "created_at": now,
        **profile,
    }
    # Ensure all Model fields exist
    doc.setdefault("email", None)
    doc.setdefault("name", None)
    doc.setdefault("picture", None)
    doc.setdefault("apple_sub", None)
    doc.setdefault("google_sub", None)
    await db.users.insert_one(dict(doc))
    return User(**doc)


async def _issue_session(db, user_id: str) -> str:
    token = _new_session_token()
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    await db.user_sessions.insert_one({
        "session_token": token,
        "user_id": user_id,
        "created_at": _iso_now(),
        "expires_at": expires_at.isoformat(),
    })
    return token


async def _migrate_device_history(db, *, device_id: Optional[str], user_id: str) -> int:
    if not device_id:
        return 0
    res = await db.history.update_many(
        {"device_id": device_id, "user_id": {"$in": [None, ""]}},
        {"$set": {"user_id": user_id}, "$unset": {"device_id": ""}},
    )
    return res.modified_count or 0


async def get_current_user_optional(db, authorization: Optional[str]) -> Optional[User]:
    if not authorization or not authorization.lower().startswith("bearer "):
        return None
    token = authorization.split(" ", 1)[1].strip()
    session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not session:
        return None
    exp = _to_utc(session.get("expires_at"))
    if datetime.now(timezone.utc) >= exp:
        return None
    user = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
    if not user:
        return None
    return User(**user)


async def require_current_user(db, authorization: Optional[str]) -> User:
    user = await get_current_user_optional(db, authorization)
    if not user:
        raise HTTPException(status_code=401, detail="unauthorized")
    return user


# ------------------------------------------------------------------ router factory
def make_auth_router(db) -> APIRouter:
    router = APIRouter(prefix="/auth")

    @router.post("/apple", response_model=AuthResponse)
    async def apple_login(req: AppleLoginRequest):
        claims = await verify_apple_identity_token(req.identity_token)
        apple_sub = claims.get("sub")
        if not apple_sub:
            raise HTTPException(status_code=401, detail="apple_sub_missing")
        token_email = claims.get("email")

        # Only save name/email on first sign-in
        first_login_profile = {
            "apple_sub": apple_sub,
            "email": req.email or token_email,
            "name": req.full_name,
        }
        user = await _upsert_user(
            db,
            provider="apple",
            key={"apple_sub": apple_sub},
            profile=first_login_profile,
        )
        migrated = await _migrate_device_history(
            db, device_id=req.device_id, user_id=user.user_id
        )
        session_token = await _issue_session(db, user.user_id)
        logger.info("apple login user_id=%s migrated=%d", user.user_id, migrated)
        return AuthResponse(session_token=session_token, user=user)

    @router.post("/session", response_model=AuthResponse)
    async def emergent_google_login(req: EmergentSessionRequest):
        # Exchange the one-time session_id with Emergent
        async with httpx.AsyncClient(timeout=15) as client:
            try:
                r = await client.get(
                    EMERGENT_SESSION_URL,
                    headers={"X-Session-ID": req.session_id},
                )
            except Exception as e:
                raise HTTPException(status_code=401, detail=f"session_exchange_failed: {e}")
        if r.status_code != 200:
            raise HTTPException(status_code=401, detail="session_invalid")
        data = r.json()
        email = data.get("email")
        if not email:
            raise HTTPException(status_code=401, detail="email_missing_from_session")

        user = await _upsert_user(
            db,
            provider="google",
            key={"email": email},
            profile={
                "email": email,
                "name": data.get("name"),
                "picture": data.get("picture"),
                "google_sub": data.get("id") or data.get("sub"),
            },
        )
        migrated = await _migrate_device_history(
            db, device_id=req.device_id, user_id=user.user_id
        )
        session_token = await _issue_session(db, user.user_id)
        logger.info("google login user_id=%s migrated=%d", user.user_id, migrated)
        return AuthResponse(session_token=session_token, user=user)

    @router.get("/me", response_model=User)
    async def me(authorization: Optional[str] = Header(default=None)):
        return await require_current_user(db, authorization)

    @router.post("/logout")
    async def logout(authorization: Optional[str] = Header(default=None)):
        if authorization and authorization.lower().startswith("bearer "):
            token = authorization.split(" ", 1)[1].strip()
            await db.user_sessions.delete_one({"session_token": token})
        return {"ok": True}

    return router


async def ensure_indexes(db):
    await db.users.create_index("user_id", unique=True)
    await db.users.create_index("email", unique=True, sparse=True)
    await db.users.create_index("apple_sub", unique=True, sparse=True)
    await db.user_sessions.create_index("session_token", unique=True)
    await db.user_sessions.create_index("user_id")
    # TTL cleanup — store expires_at as ISO string so we can't rely on TTL index; a
    # periodic cleanup job would be added here; the token is also checked at request time.
