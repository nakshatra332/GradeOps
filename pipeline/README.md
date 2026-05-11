# GradeOps Pipeline

Multi-agent grading pipeline built with **LangGraph** and **LangChain + Gemini**.

```
Ingest → OCR (parallel) → Grade + Plagiarism → HITL Review (per student) → Finalize
```

---

## Quick start (no API key needed)

```bash
cd pipeline

# 1. Create a virtual environment
python3 -m venv .venv && source .venv/bin/activate

# 2. Install dependencies
pip install -r requirements.txt

# 3. Generate a test PDF
pip install reportlab
python examples/generate_sample_pdf.py

# 4. Copy env file
cp .env.example .env

# 5. Run the pipeline in mock mode (no Gemini calls)
python main.py --rubric examples/rubric.json --pdf examples/sample_exam.pdf --mock --auto-approve
```

The `--auto-approve` flag skips the interactive prompts. Remove it to review each student manually in the terminal.

---

## Using real Gemini

```bash
# Add your key to .env
echo "GOOGLE_API_KEY=your_key_here" >> .env

python main.py --rubric examples/rubric.json --pdf your_exam.pdf
```

---

## FastAPI server (for GradeOps frontend integration)

```bash
# From the GradeOps root (not inside pipeline/)
uvicorn pipeline.server.app:app --reload --port 8000

# Check it's up
curl http://localhost:8000/health
```

API surface:

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/pipeline/start` | Upload PDF + rubric, start the graph |
| `GET`  | `/pipeline/{exam_id}` | Poll state (students, AI grades, next pending review) |
| `POST` | `/review/{exam_id}/decide` | Submit TA decision (approve / override / escalate) |
| `WS`   | `/ws/{exam_id}` | Real-time stat push after finalization |

### Example: start a pipeline via curl

```bash
curl -X POST http://localhost:8000/pipeline/start \
  -F "pdf=@examples/sample_exam.pdf" \
  -F "rubric=@examples/rubric.json" \
  -F "mock=true"
# → {"exam_id": "exam_abc123", "student_count": 2}
```

### Example: approve a review

```bash
curl -X POST http://localhost:8000/review/exam_abc123/decide \
  -H "Content-Type: application/json" \
  -d '{"action": "approve"}'
```

### Example: override a score

```bash
curl -X POST http://localhost:8000/review/exam_abc123/decide \
  -H "Content-Type: application/json" \
  -d '{"action": "override", "score": 8.5, "comment": "Student also mentioned space complexity"}'
```

---

## Directory map

```
pipeline/
├── config.py          ← All settings (reads .env)
├── state.py           ← LangGraph ExamGradingState TypedDict
├── graph.py           ← StateGraph wiring (only file that touches nodes+edges)
├── main.py            ← CLI runner
├── schemas/
│   ├── rubric.py      ← Pydantic: RubricSchema, QuestionSchema, CriterionSchema
│   └── outputs.py     ← Pydantic: OCROutput, GradeOutput, FinalGrade
├── agents/
│   ├── ingestion.py   ← Agent 1: PDF split, rubric validate, storage upload
│   ├── ocr.py         ← Agent 2: Gemini Flash vision transcription (parallel)
│   ├── grading.py     ← Agent 3: Gemini Pro structured scoring + plagiarism
│   ├── review.py      ← HITL interrupt node
│   └── finalize.py    ← Stats aggregation, gradebook JSON write
├── tools/
│   ├── storage.py     ← LocalStorage / S3Storage (swap via config)
│   ├── pdf_splitter.py ← PyMuPDF page-image extraction
│   └── similarity.py  ← Cosine similarity (numpy, no ML deps)
└── server/
    ├── app.py         ← FastAPI app factory
    ├── ws.py          ← WebSocket manager
    └── routes/
        ├── pipeline.py ← /pipeline/start, /pipeline/{id}
        └── review.py   ← /review/{id}/decide
```

---

## Connecting to the GradeOps frontend

Replace the mock bodies in `js/api/` with fetch() calls:

```js
// js/api/reviews.js
export async function approveReview(id) {
  await fetch(`http://localhost:8000/review/${id}/decide`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'approve' }),
  });
}
```

---

## Upgrading the checkpointer (production)

In `graph.py`, change:

```python
# Development (in-memory, lost on restart)
checkpointer = MemorySaver()

# Single-server production (persists to SQLite file)
from langgraph.checkpoint.sqlite import SqliteSaver
checkpointer = SqliteSaver.from_conn_string("gradeops.db")

# Distributed production (PostgreSQL)
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
checkpointer = AsyncPostgresSaver.from_conn_string(os.environ["DATABASE_URL"])
```

No other code changes are needed.
