import os
import io
import json
import uuid
import logging
import re
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional, Literal

from fastapi import FastAPI, APIRouter, HTTPException, UploadFile, File
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field

from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent
from emergentintegrations.llm.openai.speech_to_text import OpenAISpeechToText

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

# -----------------------------------------------------------------------------
# MongoDB
# -----------------------------------------------------------------------------
mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")

# -----------------------------------------------------------------------------
# App
# -----------------------------------------------------------------------------
app = FastAPI()
api_router = APIRouter(prefix="/api")

# -----------------------------------------------------------------------------
# Models
# -----------------------------------------------------------------------------
class ParticipantScore(BaseModel):
    name: str
    narcissism_score: int = Field(ge=0, le=100)
    key_traits_detected: List[str] = Field(default_factory=list)
    notable_quotes: List[str] = Field(default_factory=list)


class AnalysisResult(BaseModel):
    person_a: ParticipantScore
    person_b: ParticipantScore
    verdict: str
    breakdown: str


class AnalyzeRequest(BaseModel):
    mode: Literal["text", "image"]
    text: Optional[str] = None
    images_base64: Optional[List[str]] = None  # raw base64, no data: prefix
    person_a_name: Optional[str] = "Person A"
    person_b_name: Optional[str] = "Person B"


class HistoryItem(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    person_a_name: str
    person_b_name: str
    person_a_score: int
    person_b_score: int
    verdict: str
    result: AnalysisResult
    source_mode: str
    source_text_preview: Optional[str] = None


class SaveHistoryRequest(BaseModel):
    person_a_name: str
    person_b_name: str
    result: AnalysisResult
    source_mode: str
    source_text_preview: Optional[str] = None


# -----------------------------------------------------------------------------
# System prompt
# -----------------------------------------------------------------------------
SYSTEM_PROMPT = """You are a forensic conversational psychologist specialising in identifying narcissistic
manipulation tactics in text-message arguments. You will analyse a conversation between two people and
score each participant's demonstrated narcissistic tendencies within THIS conversation ONLY.

Analyse for tactics such as: Gaslighting, DARVO (Deny, Attack, Reverse Victim & Offender), Projection,
Deflection, Blame-shifting, Invalidation, Stonewalling, Tone Policing, Contempt, Word-salad,
Playing the victim, Lack of Empathy, Grandiosity, Love-bombing, Silent treatment.

Return ONLY a raw JSON object matching this exact schema (no markdown, no code fences, no commentary):
{
  "person_a": {
    "name": "<string>",
    "narcissism_score": <integer 0-100>,
    "key_traits_detected": ["<trait>", ...],
    "notable_quotes": ["<verbatim quote>", ...]
  },
  "person_b": {
    "name": "<string>",
    "narcissism_score": <integer 0-100>,
    "key_traits_detected": ["<trait>", ...],
    "notable_quotes": ["<verbatim quote>", ...]
  },
  "verdict": "<2-3 sentence summary of the argument dynamics and who exhibited stronger narcissistic tendencies>",
  "breakdown": "<chronological breakdown of the specific manipulation tactics observed, referencing quotes>"
}

Rules:
- narcissism_score is an integer between 0 and 100. 0 = no narcissistic behaviour, 100 = textbook malignant.
- key_traits_detected: 2-5 short trait names (e.g. "Gaslighting").
- notable_quotes: 1-4 verbatim short excerpts (<=140 chars each). Never invent quotes.
- If a participant showed no narcissistic behaviour, still return their entry with a low score and empty arrays are allowed.
- If the input is unreadable or empty, return best-effort with low scores and note the issue in verdict.
- Person A is the user unless the conversation clearly indicates otherwise.
- Output MUST be valid JSON. No trailing commas. No markdown. No prose outside JSON.
"""


def _extract_json(text: str) -> dict:
    """Best-effort extract JSON object from an LLM response."""
    if not text:
        raise ValueError("empty response")
    # Strip common code fences
    stripped = text.strip()
    if stripped.startswith("```"):
        stripped = re.sub(r"^```(?:json)?\s*", "", stripped)
        stripped = re.sub(r"\s*```$", "", stripped)
    # Try direct
    try:
        return json.loads(stripped)
    except Exception:
        pass
    # Find first { ... last }
    match = re.search(r"\{.*\}", stripped, re.DOTALL)
    if match:
        return json.loads(match.group(0))
    raise ValueError("no JSON object found in model response")


async def _run_analysis(req: AnalyzeRequest) -> AnalysisResult:
    if not EMERGENT_LLM_KEY:
        raise HTTPException(status_code=500, detail="EMERGENT_LLM_KEY not configured")

    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=f"narc-{uuid.uuid4()}",
        system_message=SYSTEM_PROMPT,
    ).with_model("openai", "gpt-5.4")

    user_prompt_parts = [
        f"Person A name: {req.person_a_name or 'Person A'}",
        f"Person B name: {req.person_b_name or 'Person B'}",
    ]

    file_contents = []

    if req.mode == "text":
        if not req.text or not req.text.strip():
            raise HTTPException(status_code=400, detail="text is required for mode=text")
        user_prompt_parts.append("Transcript of the argument follows. Determine which line belongs to whom based on context and any 'Name:' prefixes.\n\n")
        user_prompt_parts.append(req.text.strip())
    else:
        if not req.images_base64:
            raise HTTPException(status_code=400, detail="images_base64 is required for mode=image")
        user_prompt_parts.append(
            "Screenshots of a text-message argument are attached. The RIGHT-aligned bubbles (usually blue/green) are Person A (the sender). "
            "The LEFT-aligned bubbles are Person B (the other party). Read the messages in chronological order across screenshots. "
            "Then analyse and score."
        )
        for b64 in req.images_base64:
            # strip data-url prefix if present
            clean = b64.split(",", 1)[1] if "," in b64 and b64.strip().startswith("data:") else b64
            file_contents.append(ImageContent(image_base64=clean))

    user_msg = UserMessage(
        text="\n".join(user_prompt_parts),
        file_contents=file_contents or None,
    )

    try:
        raw = await chat.send_message(user_msg)
    except Exception as e:
        logging.exception("LLM call failed")
        raise HTTPException(status_code=502, detail=f"LLM call failed: {e}")

    try:
        data = _extract_json(raw if isinstance(raw, str) else str(raw))
        # normalise names in case the model missed them
        data.setdefault("person_a", {}).setdefault("name", req.person_a_name or "Person A")
        data.setdefault("person_b", {}).setdefault("name", req.person_b_name or "Person B")
        for p in ("person_a", "person_b"):
            data[p].setdefault("key_traits_detected", [])
            data[p].setdefault("notable_quotes", [])
            data[p]["narcissism_score"] = int(max(0, min(100, int(data[p].get("narcissism_score", 0)))))
        data.setdefault("verdict", "")
        data.setdefault("breakdown", "")
        return AnalysisResult(**data)
    except Exception as e:
        logging.exception("Failed to parse LLM JSON. Raw: %s", raw)
        raise HTTPException(status_code=502, detail=f"Malformed AI response: {e}")


# -----------------------------------------------------------------------------
# Routes
# -----------------------------------------------------------------------------
@api_router.get("/")
async def root():
    return {"message": "NarcCheck AI API online"}


@api_router.post("/analyze", response_model=AnalysisResult)
async def analyze(req: AnalyzeRequest):
    return await _run_analysis(req)


ALLOWED_AUDIO_EXTS = {"mp3", "mp4", "mpeg", "mpga", "m4a", "wav", "webm"}


@api_router.post("/transcribe")
async def transcribe(file: UploadFile = File(...)):
    if not EMERGENT_LLM_KEY:
        raise HTTPException(status_code=500, detail="EMERGENT_LLM_KEY not configured")

    filename = file.filename or "audio.m4a"
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else "m4a"
    if ext not in ALLOWED_AUDIO_EXTS:
        ext = "m4a"

    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Empty audio file")
    if len(data) > 25 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Audio too large (max 25 MB)")

    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=f".{ext}")
    try:
        tmp.write(data)
        tmp.flush()
        tmp.close()
        stt = OpenAISpeechToText(api_key=EMERGENT_LLM_KEY)
        try:
            with open(tmp.name, "rb") as fh:
                resp = await stt.transcribe(file=fh, model="whisper-1", response_format="json")
        except Exception as e:
            logging.exception("Whisper transcription failed")
            raise HTTPException(status_code=502, detail=f"Transcription failed: {e}")

        text = ""
        if isinstance(resp, str):
            text = resp
        elif hasattr(resp, "text"):
            text = resp.text or ""
        elif isinstance(resp, dict):
            text = resp.get("text", "") or ""
        return {"text": text.strip()}
    finally:
        try:
            os.unlink(tmp.name)
        except Exception:
            pass


@api_router.post("/history", response_model=HistoryItem)
async def save_history(req: SaveHistoryRequest):
    item = HistoryItem(
        person_a_name=req.person_a_name,
        person_b_name=req.person_b_name,
        person_a_score=req.result.person_a.narcissism_score,
        person_b_score=req.result.person_b.narcissism_score,
        verdict=req.result.verdict,
        result=req.result,
        source_mode=req.source_mode,
        source_text_preview=req.source_text_preview,
    )
    await db.history.insert_one(item.model_dump())
    return item


@api_router.get("/history", response_model=List[HistoryItem])
async def list_history():
    docs = await db.history.find({}, {"_id": 0}).sort("created_at", -1).limit(500).to_list(length=500)
    return [HistoryItem(**d) for d in docs]


@api_router.get("/history/{item_id}", response_model=HistoryItem)
async def get_history(item_id: str):
    doc = await db.history.find_one({"id": item_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Not found")
    return HistoryItem(**doc)


@api_router.delete("/history/{item_id}")
async def delete_history(item_id: str):
    res = await db.history.delete_one({"id": item_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Not found")
    return {"deleted": True}


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
