"""Backend tests for Narc app - analyze + history CRUD."""
import os
import io
import base64
import pytest
import requests
from PIL import Image, ImageDraw

BASE_URL = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/") if os.environ.get("EXPO_PUBLIC_BACKEND_URL") else "https://narc-analyzer.preview.emergentagent.com"
API = f"{BASE_URL}/api"

TIMEOUT = 90  # LLM calls slow

# ---------- fixtures ----------
@pytest.fixture(scope="session")
def sess():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s

@pytest.fixture(scope="session")
def sample_transcript():
    return (
        "Alex: You always twist my words. I never said that.\n"
        "Sam: I have the messages right here. You literally said 'I don't care about your feelings'.\n"
        "Alex: You're being crazy again. This is why nobody likes you.\n"
        "Sam: Please stop. That's hurtful.\n"
        "Alex: I'm the victim here. You attacked me first with your tone.\n"
        "Sam: I asked a simple question about the plans.\n"
        "Alex: Whatever. You're impossible. I'm done talking to you.\n"
    )

@pytest.fixture(scope="session")
def real_image_b64():
    # Build a real PNG with shapes/edges (not solid color)
    img = Image.new("RGB", (400, 300), (30, 30, 50))
    d = ImageDraw.Draw(img)
    d.rectangle([20, 20, 380, 80], fill=(70, 130, 200))
    d.text((30, 40), "Alex: You always twist my words", fill=(255, 255, 255))
    d.rectangle([20, 100, 380, 160], fill=(60, 60, 60))
    d.text((30, 120), "Sam: I have the messages here", fill=(230, 230, 230))
    d.rectangle([20, 180, 380, 240], fill=(70, 130, 200))
    d.text((30, 200), "Alex: You're crazy again", fill=(255, 255, 255))
    d.ellipse([300, 250, 380, 290], outline=(200, 200, 50), width=3)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode()


# ---------- health ----------
def test_root(sess):
    r = sess.get(f"{API}/", timeout=10)
    assert r.status_code == 200
    assert "message" in r.json()


# ---------- analyze ----------
class TestAnalyze:
    def test_analyze_text_valid(self, sess, sample_transcript):
        payload = {
            "mode": "text",
            "text": sample_transcript,
            "person_a_name": "Alex",
            "person_b_name": "Sam",
        }
        r = sess.post(f"{API}/analyze", json=payload, timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        d = r.json()
        for key in ("person_a", "person_b", "verdict", "breakdown"):
            assert key in d
        for p in ("person_a", "person_b"):
            assert set(d[p].keys()) >= {"name", "narcissism_score", "key_traits_detected", "notable_quotes"}
            assert isinstance(d[p]["narcissism_score"], int)
            assert 0 <= d[p]["narcissism_score"] <= 100
            assert isinstance(d[p]["key_traits_detected"], list)
            assert isinstance(d[p]["notable_quotes"], list)
        assert isinstance(d["verdict"], str) and len(d["verdict"]) > 0
        # Alex should score higher (clear narcissistic behavior)
        pytest.analysis_text_result = d

    def test_analyze_text_empty_returns_400(self, sess):
        r = sess.post(f"{API}/analyze", json={"mode": "text", "text": "   "}, timeout=30)
        assert r.status_code == 400, r.text

    def test_analyze_image_valid(self, sess, real_image_b64):
        payload = {
            "mode": "image",
            "images_base64": [real_image_b64],
            "person_a_name": "Alex",
            "person_b_name": "Sam",
        }
        r = sess.post(f"{API}/analyze", json=payload, timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        d = r.json()
        for p in ("person_a", "person_b"):
            assert 0 <= d[p]["narcissism_score"] <= 100


# ---------- history CRUD ----------
class TestHistory:
    created_id = None

    def test_save_history(self, sess):
        result = getattr(pytest, "analysis_text_result", None)
        if not result:
            pytest.skip("analyze text did not produce result")
        payload = {
            "person_a_name": "Alex",
            "person_b_name": "Sam",
            "result": result,
            "source_mode": "text",
            "source_text_preview": "TEST_ preview",
        }
        r = sess.post(f"{API}/history", json=payload, timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "id" in d and d["id"]
        assert d["person_a_score"] == result["person_a"]["narcissism_score"]
        assert d["person_b_score"] == result["person_b"]["narcissism_score"]
        assert "_id" not in d
        TestHistory.created_id = d["id"]

    def test_list_history(self, sess):
        r = sess.get(f"{API}/history", timeout=15)
        assert r.status_code == 200
        items = r.json()
        assert isinstance(items, list)
        assert len(items) >= 1
        # sorted desc by created_at
        ts = [i["created_at"] for i in items]
        assert ts == sorted(ts, reverse=True)
        # no _id leak
        for it in items:
            assert "_id" not in it

    def test_get_history_by_id(self, sess):
        if not TestHistory.created_id:
            pytest.skip("no id")
        r = sess.get(f"{API}/history/{TestHistory.created_id}", timeout=15)
        assert r.status_code == 200
        assert r.json()["id"] == TestHistory.created_id

    def test_delete_history(self, sess):
        if not TestHistory.created_id:
            pytest.skip("no id")
        r = sess.delete(f"{API}/history/{TestHistory.created_id}", timeout=15)
        assert r.status_code == 200
        assert r.json().get("deleted") is True
        # confirm 404
        r2 = sess.get(f"{API}/history/{TestHistory.created_id}", timeout=15)
        assert r2.status_code == 404
        r3 = sess.delete(f"{API}/history/{TestHistory.created_id}", timeout=15)
        assert r3.status_code == 404
