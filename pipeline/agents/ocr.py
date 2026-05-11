"""
agents/ocr.py — Agent 2: OCR / Vision transcription.

Sends each student's page images to Gemini Flash (a Vision Language Model)
and gets back a structured transcript with confidence score.

Runs all students concurrently using asyncio.gather for throughput.
The node itself is sync (LangGraph requirement for simple nodes) but
spawns an event loop internally for the async calls.
"""

from __future__ import annotations
import asyncio
import base64
import json
from pathlib import Path

from config import settings
from schemas.outputs import OCROutput
from state import ExamGradingState, StudentRecord

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


# ── Real Gemini OCR ───────────────────────────────────────────────────────────

def _build_ocr_prompt() -> str:
    return (
        "You are transcribing a handwritten student exam answer. "
        "Return ONLY a JSON object with these exact keys:\n"
        "  - transcript (string): verbatim transcription of the handwritten text\n"
        "  - confidence (float 0-1): your confidence in the accuracy\n"
        "  - illegible_regions (list of strings): descriptions of any unreadable areas\n\n"
        "Do not add any commentary outside the JSON object."
    )


async def _ocr_student_async(
    student: StudentRecord,
    model,  # ChatGoogleGenerativeAI instance
) -> OCROutput:
    """Send all pages for one student to the VLM and parse the response."""
    from langchain_core.messages import HumanMessage

    # Build a single message with all page images as base64 inline data
    content: list[dict] = [{"type": "text", "text": _build_ocr_prompt()}]
    for page_path in student["page_paths"]:
        img_bytes = Path(page_path).read_bytes()
        b64 = base64.b64encode(img_bytes).decode()
        content.append({
            "type":      "image_url",
            "image_url": {"url": f"data:image/png;base64,{b64}"},
        })

    response = await model.ainvoke([HumanMessage(content=content)])

    # Parse JSON from response text
    raw = response.content.strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1].lstrip("json").strip()

    data = json.loads(raw)
    return OCROutput(**data)


async def _run_all_ocr(students: list[StudentRecord], model) -> list[OCROutput]:
    """Run OCR for all students concurrently."""
    tasks = [_ocr_student_async(s, model) for s in students]
    return await asyncio.gather(*tasks)


# ── Agent node ────────────────────────────────────────────────────────────────

def ocr_agent(state: ExamGradingState) -> dict:
    """
    LangGraph node function.
    Reads page_paths from each StudentRecord.
    Writes transcript and ocr_confidence back into each StudentRecord.
    """
    if state.get("error"):
        return {}  # propagate error from ingestion without doing work

    students: list[StudentRecord] = list(state["students"])

    if settings.mock_llm:
        results = [_mock_ocr(s["student_id"]) for s in students]
    else:
        from langchain_google_genai import ChatGoogleGenerativeAI
        model = ChatGoogleGenerativeAI(
            model=settings.ocr_model,
            google_api_key=settings.google_api_key,
            temperature=0,
        )
        try:
            loop = asyncio.get_event_loop()
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
        results = loop.run_until_complete(_run_all_ocr(students, model))

    # Write results back into student records
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
