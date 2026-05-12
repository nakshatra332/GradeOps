"""
agents/grading.py — Agent 3: Structured grading + plagiarism detection.

Sub-step A: For each student, send their transcript + rubric to the
            grading LLM (default: Groq/Llama3) and get back a structured
            GradeOutput via .with_structured_output().

Sub-step B: Embed all transcripts via Google text-embedding-004 and run
            cosine-similarity sweep to detect suspiciously similar answers.

Rate-limit strategy:
  - asyncio.Semaphore limits concurrent requests to settings.llm_concurrency.
  - tenacity retries on 429 / 503 errors with exponential back-off.
  - Default provider is Groq (free tier: 30 req/min, 14,400 req/day).
    Change GRADING_PROVIDER=google in .env to switch back to Gemini.
"""

from __future__ import annotations
import asyncio
from typing import Any

from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

from config import settings
from schemas.rubric import RubricSchema
from schemas.outputs import GradeOutput, QuestionGrade
from state import ExamGradingState, StudentRecord
from tools.similarity import find_suspicious_pairs, build_student_flag_map


# ── Prompt builders ───────────────────────────────────────────────────────────

def _build_grading_prompt(rubric: RubricSchema, transcript: str) -> str:
    criteria_text = ""
    for q in rubric.questions:
        criteria_text += f"\n\nQuestion {q.id}: {q.text} (max {q.max_marks} marks)\n"
        for c in q.criteria:
            criteria_text += f"  • [{c.marks} pts] {c.text}\n"

    return (
        "You are a strict but fair exam grader. "
        "Grade the following student answer according to the rubric below.\n\n"
        f"RUBRIC:{criteria_text}\n\n"
        f"STUDENT ANSWER:\n{transcript}\n\n"
        "Instructions:\n"
        "- Award marks ONLY for criteria explicitly met in the answer.\n"
        "- For each question, list exactly which criteria the student satisfied.\n"
        "- Justification must reference the rubric criteria by name.\n"
        "- Be consistent: the same answer quality should get the same score.\n"
        "- Return structured JSON matching the GradeOutput schema exactly."
    )


# ── Mock responses ────────────────────────────────────────────────────────────

def _mock_grade(rubric: RubricSchema, student_id: str) -> GradeOutput:
    """Deterministic mock grade — incrementally varies score per student."""
    import hashlib
    seed = int(hashlib.md5(student_id.encode()).hexdigest()[:4], 16)

    question_grades = []
    for q in rubric.questions:
        ratio = 0.6 + (seed % 30) / 100
        awarded = round(q.max_marks * ratio, 1)
        met = [c.text for c in q.criteria[:max(1, len(q.criteria) - 1)]]
        question_grades.append(QuestionGrade(
            question_id=q.id,
            score=awarded,
            max_score=q.max_marks,
            criteria_met=met,
            justification=(
                f"[MOCK] Student demonstrated understanding of {q.text}. "
                f"Most criteria were met ({len(met)}/{len(q.criteria)})."
            ),
        ))

    return GradeOutput(
        question_grades=question_grades,
        overall_justification=f"[MOCK] {student_id} shows solid understanding overall.",
    )


def _mock_embeddings(transcripts: list[str]) -> list[list[float]]:
    """Return pseudo-random embeddings based on transcript content."""
    import hashlib, math
    vectors = []
    for t in transcripts:
        h = hashlib.md5(t.encode()).digest()
        vec = [(b - 128) / 128 for b in h] * 24  # 384-dim pseudo-random
        norm = math.sqrt(sum(x * x for x in vec)) or 1
        vectors.append([x / norm for x in vec])
    return vectors


# ── Retry decorator ───────────────────────────────────────────────────────────

def _make_retry():
    """
    Retry on transient API errors (429 rate-limit, 503 service unavailable).
    Waits 2s, 4s, 8s … up to settings.llm_max_retries attempts.
    """
    try:
        from groq import RateLimitError as GroqRateLimitError
        retry_exceptions = (GroqRateLimitError, Exception)
    except ImportError:
        retry_exceptions = (Exception,)

    return retry(
        retry=retry_if_exception_type(retry_exceptions),
        stop=stop_after_attempt(settings.llm_max_retries),
        wait=wait_exponential(multiplier=1, min=2, max=15),
        reraise=True,
    )


# ── Throttled grading task ────────────────────────────────────────────────────

async def _grade_student_throttled(
    student: StudentRecord,
    rubric: RubricSchema,
    grading_chain,
    semaphore: asyncio.Semaphore,
) -> GradeOutput:
    """Grade one student, respecting the concurrency semaphore and retrying on errors."""
    prompt = _build_grading_prompt(rubric, student["transcript"] or "")

    @_make_retry()
    async def _call():
        async with semaphore:
            return await grading_chain.ainvoke(prompt)

    try:
        return await _call()
    except Exception as exc:
        question_grades = []
        for q in rubric.questions:
            question_grades.append(QuestionGrade(
                question_id=q.id,
                score=0.0,
                max_score=q.max_marks,
                criteria_met=[],
                justification="[API Error] Auto-grading failed due to rate limits. TA MUST review manually.",
            ))
        return GradeOutput(
            question_grades=question_grades,
            overall_justification=f"[API Error] Could not grade due to rate limits: {exc}"
        )


async def _run_all_grading(
    students: list[StudentRecord],
    rubric: RubricSchema,
    grading_chain,
) -> list[GradeOutput]:
    """Grade all students concurrently, throttled by settings.llm_concurrency."""
    semaphore = asyncio.Semaphore(settings.llm_concurrency)
    tasks = [
        _grade_student_throttled(s, rubric, grading_chain, semaphore)
        for s in students
    ]
    return await asyncio.gather(*tasks)


# ── LLM factory ──────────────────────────────────────────────────────────────

def _build_grading_llm():
    """
    Return the correct LangChain LLM based on GRADING_PROVIDER in .env.
      groq   → langchain_groq.ChatGroq   (default, free tier, fast)
      google → langchain_google_genai.ChatGoogleGenerativeAI
    """
    provider = settings.grading_provider.lower()

    if provider == "groq":
        from langchain_groq import ChatGroq
        return ChatGroq(
            model=settings.grading_model,
            api_key=settings.groq_api_key,
            temperature=0,
        )
    elif provider == "google":
        from langchain_google_genai import ChatGoogleGenerativeAI
        return ChatGoogleGenerativeAI(
            model=settings.grading_model,
            google_api_key=settings.google_api_key,
            temperature=0,
        )
    else:
        raise ValueError(
            f"Unknown GRADING_PROVIDER={provider!r}. Must be 'groq' or 'google'."
        )


# ── Agent node ────────────────────────────────────────────────────────────────

def grading_agent(state: ExamGradingState) -> dict:
    """
    LangGraph node function.

    Sub-step A — Structured grading for every student.
    Sub-step B — Plagiarism detection across all transcripts.
    """
    if state.get("error"):
        return {}

    rubric_dict = state["rubric"]
    rubric      = RubricSchema.model_validate(rubric_dict)
    students: list[StudentRecord] = list(state["students"])

    # ── Sub-step A: Grade each student ───────────────────────────────────────
    if settings.mock_llm:
        grade_results = [_mock_grade(rubric, s["student_id"]) for s in students]
    else:
        llm           = _build_grading_llm()
        grading_chain = llm.with_structured_output(GradeOutput)

        try:
            loop = asyncio.get_event_loop()
            if loop.is_closed():
                raise RuntimeError
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)

        grade_results = loop.run_until_complete(
            _run_all_grading(students, rubric, grading_chain)
        )

    for student, grade in zip(students, grade_results):
        student["grade_output"] = grade.model_dump()

    # ── Sub-step B: Plagiarism detection ─────────────────────────────────────
    transcripts = [s["transcript"] or "" for s in students]
    student_ids = [s["student_id"] for s in students]

    if settings.mock_llm:
        embeddings = _mock_embeddings(transcripts)
    else:
        from langchain_google_genai import GoogleGenerativeAIEmbeddings
        embed_model = GoogleGenerativeAIEmbeddings(
            model=settings.embedding_model,
            google_api_key=settings.google_api_key,
        )
        try:
            embeddings = embed_model.embed_documents(transcripts)
        except Exception as exc:
            print(f"[grading] API Error during embeddings: {exc}")
            embeddings = [[0.0] * 768 for _ in transcripts]

    flags    = find_suspicious_pairs(student_ids, embeddings, settings.plagiarism_threshold)
    flag_map = build_student_flag_map(flags)

    for student in students:
        sid = student["student_id"]
        if sid in flag_map:
            score, match = flag_map[sid]
            student["plagiarism_score"] = score
            student["plagiarism_match"] = match

    return {"students": students}
