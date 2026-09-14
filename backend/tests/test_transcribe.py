"""Tests for /api/transcribe endpoint (Whisper via Emergent proxy)."""
import io
import os
import wave
import struct
import pytest
import requests

BASE_URL = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"
TIMEOUT = 120


def _silent_wav_bytes(seconds: float = 0.5, rate: int = 16000) -> bytes:
    """Generate a valid but silent WAV file (Whisper will return empty text)."""
    n = int(rate * seconds)
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes(struct.pack("<" + "h" * n, *([0] * n)))
    return buf.getvalue()


@pytest.fixture(scope="module")
def speech_mp3_bytes():
    """Real TTS speech via gTTS. Whisper accepts mp3."""
    from gtts import gTTS
    tts = gTTS("You always twist my words. I never said that.", lang="en")
    buf = io.BytesIO()
    tts.write_to_fp(buf)
    return buf.getvalue()


class TestTranscribe:
    def test_transcribe_wav_returns_200_with_text_field(self):
        """WAV multipart upload -> 200 with {text: str}. Silent WAV is likely to
        yield empty text, so we only assert schema + status here."""
        wav = _silent_wav_bytes()
        files = {"file": ("clip.wav", wav, "audio/wav")}
        r = requests.post(f"{API}/transcribe", files=files, timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "text" in d
        assert isinstance(d["text"], str)

    def test_transcribe_real_speech_returns_non_empty_text(self, speech_mp3_bytes):
        """Real TTS clip -> Whisper should return some words."""
        files = {"file": ("speech.mp3", speech_mp3_bytes, "audio/mpeg")}
        r = requests.post(f"{API}/transcribe", files=files, timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "text" in d and isinstance(d["text"], str)
        text = d["text"].lower()
        # Expect at least one recognizable word from the phrase
        assert len(text.strip()) > 0, f"Whisper returned empty transcript: {d}"
        assert any(k in text for k in ("twist", "words", "said", "you")), (
            f"Transcript does not contain expected keywords: {d['text']!r}"
        )

    def test_transcribe_empty_body_returns_400(self):
        files = {"file": ("empty.wav", b"", "audio/wav")}
        r = requests.post(f"{API}/transcribe", files=files, timeout=30)
        assert r.status_code == 400, r.text

    def test_transcribe_oversize_returns_413(self):
        # 25 MB + 1 byte
        big = b"\x00" * (25 * 1024 * 1024 + 1)
        files = {"file": ("big.wav", big, "audio/wav")}
        r = requests.post(f"{API}/transcribe", files=files, timeout=60)
        assert r.status_code == 413, r.text
