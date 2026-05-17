"""
agents/ocr.py — Agent 2: OCR / Vision transcription.

<<<<<<< HEAD
Supports OCR via Gemini Flash (API) or local Qwen-VL, returning a
structured transcript with confidence score.
=======
Sends each student's page images to Gemini Flash (a Vision Language Model)
and gets back a structured transcript with confidence score.
>>>>>>> 63e8a80e29fe3b5f4b16edbf8eb97b77e87ee3c0

Rate-limit strategy (same as grading.py):
  - asyncio.Semaphore throttles concurrent Vision API calls to
    settings.llm_concurrency (default 2 — conservative for OCR free tier).
  - tenacity retries on 429 / 503 with exponential back-off, then pauses
    for exactly the retry-delay the API reports before giving up.
"""

from __future__ import annotations
import asyncio
import base64
import json
<<<<<<< HEAD
import threading
=======
>>>>>>> 63e8a80e29fe3b5f4b16edbf8eb97b77e87ee3c0
from pathlib import Path

from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

<<<<<<< HEAD
from config import settings
from schemas.outputs import OCROutput
from state import ExamGradingState, StudentRecord

_QWEN_MODEL = None
_QWEN_TOKENIZER = None
_QWEN_LOCK = threading.Lock()
=======
from pipeline.config import settings
from pipeline.schemas.outputs import OCROutput
from pipeline.state import ExamGradingState, StudentRecord
>>>>>>> 63e8a80e29fe3b5f4b16edbf8eb97b77e87ee3c0

# ── Mock responses (used when MOCK_LLM=true) ─────────────────────────────────

def _mock_ocr(student_id: str) -> OCROutput:
    """Deterministic mock OCR response — no API call."""
    return OCROutput(
        transcript=(
            f"[MOCK] Student {student_id} answer: "
            "QuickSort has average time complexity O(n log n). "
            "In the worst case it degrades to O(n²) when the pivot is always the extreme element. "
            "The partition step runs in O(n). "
            "This satisfies the recurrence T(n) = 2T(n/2) + O(n)."
        ),
        confidence=0.95,
        illegible_regions=[],
    )


# ── Prompt ────────────────────────────────────────────────────────────────────

def _build_ocr_prompt() -> str:
    return (
        "You are transcribing a handwritten student exam answer. "
        "Return ONLY a JSON object with these exact keys:\n"
        "  - transcript (string): verbatim transcription of the handwritten text\n"
        "  - confidence (float 0-1): your confidence in the accuracy\n"
        "  - illegible_regions (list of strings): descriptions of any unreadable areas\n\n"
        "Do not add any commentary outside the JSON object."
    )


<<<<<<< HEAD
def _extract_json_text(raw: str) -> str:
    cleaned = raw.strip()
    if cleaned.startswith("```"):
        parts = cleaned.split("```")
        if len(parts) > 1:
            cleaned = parts[1]
        cleaned = cleaned.lstrip("json").strip()
    if "{" in cleaned and "}" in cleaned:
        start = cleaned.find("{")
        end = cleaned.rfind("}")
        cleaned = cleaned[start:end + 1]
    return cleaned


def _parse_ocr_response(raw: str) -> OCROutput:
    cleaned = _extract_json_text(raw)
    try:
        data = json.loads(cleaned)
        return OCROutput(**data)
    except (json.JSONDecodeError, TypeError) as exc:
        return OCROutput(
            transcript=raw[:2000],
            confidence=0.0,
            illegible_regions=[f"JSON parse error: {exc}"],
        )


def _resolve_qwen_torch_dtype(device: str):
    import torch

    use_cpu = device == "cpu" or (device == "auto" and not torch.cuda.is_available())
    if use_cpu:
        return torch.float32

    dtype = (settings.qwen_dtype or "bf16").lower()
    if dtype in ("bf16", "bfloat16"):
        return torch.bfloat16
    if dtype in ("fp16", "float16"):
        return torch.float16
    return torch.float32


def _load_qwen_model():
    global _QWEN_MODEL, _QWEN_TOKENIZER

    with _QWEN_LOCK:
        if _QWEN_MODEL is not None and _QWEN_TOKENIZER is not None:
            return _QWEN_TOKENIZER, _QWEN_MODEL

        try:
            from transformers import AutoModelForCausalLM, AutoTokenizer
        except Exception as exc:
            raise RuntimeError("Missing Qwen dependencies: install transformers and torch") from exc

        device = (settings.qwen_device or "auto").strip().lower()
        torch_dtype = _resolve_qwen_torch_dtype(device)

        model_kwargs = {
            "trust_remote_code": True,
            "torch_dtype": torch_dtype,
            "device_map": settings.qwen_device or "auto",
        }
        try:
            model = AutoModelForCausalLM.from_pretrained(
                settings.qwen_model_id,
                **model_kwargs,
            ).eval()
        except Exception:
            # Fallback for environments that do not accept device_map strings.
            fallback_kwargs = {
                "trust_remote_code": True,
                "torch_dtype": torch_dtype,
            }
            model = AutoModelForCausalLM.from_pretrained(
                settings.qwen_model_id,
                **fallback_kwargs,
            ).eval()
            if device not in ("auto", ""):
                model = model.to(device)
        tokenizer = AutoTokenizer.from_pretrained(
            settings.qwen_model_id,
            trust_remote_code=True,
        )

        _QWEN_MODEL = model
        _QWEN_TOKENIZER = tokenizer

    return _QWEN_TOKENIZER, _QWEN_MODEL


def _build_qwen_query(page_paths: list[str], tokenizer) -> object:
    items: list[dict] = []
    for page_path in page_paths:
        items.append({"image": page_path})
    items.append({"text": _build_ocr_prompt()})
    return tokenizer.from_list_format(items)


def _ocr_student_qwen(student: StudentRecord) -> OCROutput:
    page_paths = [str(p) for p in student.get("page_paths", [])]
    missing = [p for p in page_paths if not Path(p).exists()]
    if missing:
        return OCROutput(
            transcript=(
                "[OCR Error] Non-local page path(s) detected. "
                "Use local storage or switch OCR_BACKEND to gemini."
            ),
            confidence=0.0,
            illegible_regions=[f"Missing files: {', '.join(missing[:3])}"],
        )

    try:
        tokenizer, model = _load_qwen_model()
        query = _build_qwen_query(page_paths, tokenizer)
        try:
            response, _history = model.chat(
                tokenizer,
                query=query,
                history=None,
                max_new_tokens=settings.qwen_max_new_tokens,
            )
        except TypeError:
            response, _history = model.chat(
                tokenizer,
                query=query,
                history=None,
            )
        return _parse_ocr_response(str(response))
    except Exception as exc:
        return OCROutput(
            transcript=f"[OCR Error] Qwen-VL failed: {exc}",
            confidence=0.0,
            illegible_regions=["Qwen OCR failure"],
        )


=======
>>>>>>> 63e8a80e29fe3b5f4b16edbf8eb97b77e87ee3c0
# ── Throttled OCR task ────────────────────────────────────────────────────────

async def _ocr_student_throttled(
    student: StudentRecord,
    model,
    semaphore: asyncio.Semaphore,
) -> OCROutput:
    """
    Run OCR for one student, respecting the concurrency semaphore.
    Retries on transient API errors with exponential back-off.
    """
    from langchain_core.messages import HumanMessage
    from langchain_google_genai.chat_models import ChatGoogleGenerativeAIError

    # Build message with all page images inline
    content: list[dict] = [{"type": "text", "text": _build_ocr_prompt()}]
    for page_path in student["page_paths"]:
        img_bytes = Path(page_path).read_bytes()
        b64 = base64.b64encode(img_bytes).decode()
        content.append({
            "type":      "image_url",
            "image_url": {"url": f"data:image/png;base64,{b64}"},
        })

    @retry(
        retry=retry_if_exception_type((ChatGoogleGenerativeAIError, Exception)),
        stop=stop_after_attempt(settings.llm_max_retries),
<<<<<<< HEAD
        wait=wait_exponential(multiplier=2, min=10, max=65),
=======
        wait=wait_exponential(multiplier=1, min=10, max=60),
>>>>>>> 63e8a80e29fe3b5f4b16edbf8eb97b77e87ee3c0
        reraise=True,
    )
    async def _call() -> OCROutput:
        async with semaphore:
<<<<<<< HEAD
            await asyncio.sleep(6.5)  # Strict pace: <10 requests per minute (bypasses Google's hidden 10 RPM throttle)
=======
>>>>>>> 63e8a80e29fe3b5f4b16edbf8eb97b77e87ee3c0
            response = await model.ainvoke([HumanMessage(content=content)])

        # Parse JSON — strip markdown fences if present
        raw = response.content.strip()
<<<<<<< HEAD
        return _parse_ocr_response(raw)
=======
        if raw.startswith("```"):
            raw = raw.split("```")[1].lstrip("json").strip()

        try:
            data = json.loads(raw)
            return OCROutput(**data)
        except (json.JSONDecodeError, TypeError) as exc:
            # If the LLM returned garbage, fall back gracefully
            return OCROutput(
                transcript=raw[:2000],  # keep whatever text was returned
                confidence=0.0,
                illegible_regions=[f"JSON parse error: {exc}"],
            )
>>>>>>> 63e8a80e29fe3b5f4b16edbf8eb97b77e87ee3c0

    try:
        return await _call()
    except Exception as exc:
        return OCROutput(
<<<<<<< HEAD
            transcript=f"[API Error] Could not process image due to rate limits: {exc}",
=======
            transcript=f"[API Error] Could not process image: {exc}",
>>>>>>> 63e8a80e29fe3b5f4b16edbf8eb97b77e87ee3c0
            confidence=0.0,
            illegible_regions=["API Quota Exhausted"],
        )


<<<<<<< HEAD
async def _ocr_student_qwen_throttled(
    student: StudentRecord,
    semaphore: asyncio.Semaphore,
) -> OCROutput:
    async with semaphore:
        return await asyncio.to_thread(_ocr_student_qwen, student)


=======
>>>>>>> 63e8a80e29fe3b5f4b16edbf8eb97b77e87ee3c0
async def _run_all_ocr(
    students: list[StudentRecord],
    model,
) -> list[OCROutput]:
    """Run OCR for all students concurrently, throttled by settings.llm_concurrency."""
    # Use a lower concurrency for OCR (vision calls are heavier than text calls)
    ocr_concurrency = max(1, settings.llm_concurrency // 2)
    semaphore = asyncio.Semaphore(ocr_concurrency)
    tasks = [_ocr_student_throttled(s, model, semaphore) for s in students]
    return await asyncio.gather(*tasks)


<<<<<<< HEAD
async def _run_all_ocr_qwen(
    students: list[StudentRecord],
) -> list[OCROutput]:
    # Keep concurrency low for local GPU memory safety.
    semaphore = asyncio.Semaphore(1)
    tasks = [_ocr_student_qwen_throttled(s, semaphore) for s in students]
    return await asyncio.gather(*tasks)


=======
>>>>>>> 63e8a80e29fe3b5f4b16edbf8eb97b77e87ee3c0
# ── Agent node ────────────────────────────────────────────────────────────────

def ocr_agent(state: ExamGradingState) -> dict:
    """
    LangGraph node function.
    Reads page_paths from each StudentRecord.
    Writes transcript and ocr_confidence back into each StudentRecord.
    """
    if state.get("error"):
        return {}

    students: list[StudentRecord] = list(state["students"])

    if settings.mock_llm:
        results = [_mock_ocr(s["student_id"]) for s in students]
    else:
<<<<<<< HEAD
        backend = (settings.ocr_backend or "gemini").strip().lower()
=======
        from langchain_google_genai import ChatGoogleGenerativeAI
        model = ChatGoogleGenerativeAI(
            model=settings.ocr_model,
            google_api_key=settings.google_api_key,
            temperature=0,
        )
>>>>>>> 63e8a80e29fe3b5f4b16edbf8eb97b77e87ee3c0
        try:
            loop = asyncio.get_event_loop()
            if loop.is_closed():
                raise RuntimeError
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)

<<<<<<< HEAD
        if backend == "qwen_local":
            results = loop.run_until_complete(_run_all_ocr_qwen(students))
        else:
            from langchain_google_genai import ChatGoogleGenerativeAI
            model = ChatGoogleGenerativeAI(
                model=settings.ocr_model,
                google_api_key=settings.google_api_key,
                temperature=0,
            )
            results = loop.run_until_complete(_run_all_ocr(students, model))
=======
        results = loop.run_until_complete(_run_all_ocr(students, model))
>>>>>>> 63e8a80e29fe3b5f4b16edbf8eb97b77e87ee3c0

    updated = []
    for student, ocr in zip(students, results):
        updated_student = dict(student)
        updated_student["transcript"]    = ocr.transcript
        updated_student["ocr_confidence"] = ocr.confidence
        updated_student["needs_priority_review"] = (
            ocr.confidence < settings.ocr_confidence_threshold
        )
        updated.append(updated_student)

    return {"students": updated}
