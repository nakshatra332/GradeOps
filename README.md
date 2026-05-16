# GradeOps

> **Human-in-the-Loop AI Grading Pipeline** — Upload bulk exam scans, let AI grade them against a strict rubric, then let TAs rapidly approve, override, or escalate decisions from a high-speed review dashboard.

---

## Architecture

```
                    ┌─────────────────────────────────────┐
                    │          GradeOps Frontend           │
                    │  Vanilla JS SPA · served on :3000    │
                    │                                      │
                    │  Instructor:          TA:            │
                    │  · Dashboard          · Queue        │
                    │  · Upload Exam        · Review       │
                    │  · Exams / Export     · Approved     │
                    │  · Rubrics            · Exams        │
                    │  · Users                             │
                    │  · Reports                           │
                    └──────────────┬──────────────────────┘
                                   │ REST + WebSocket
                    ┌──────────────▼──────────────────────┐
                    │       FastAPI Backend · :8000        │
                    │                                      │
                    │  POST /pipeline/start                │
                    │  GET  /pipeline/{id}                 │
                    │  GET  /pipeline/{id}/export/csv      │
                    │  GET  /pipeline/{id}/export/json     │
                    │  POST /review/{id}/decide            │
                    │  WS   /ws/{id}                       │
                    └──────────────┬──────────────────────┘
                                   │ LangGraph
                    ┌──────────────▼──────────────────────┐
                    │      Agentic Pipeline (LangGraph)    │
                    │                                      │
                    │  1. Ingest   — PDF split + validate  │
                    │  2. OCR      — Gemini Flash vision   │
                    │  3. Grade    — Groq Llama3 + rubric  │
                    │  4. Review   — HITL interrupt node   │
                    │  5. Finalize — Stats + gradebook     │
                    └─────────────────────────────────────┘
```

---

## Quick Start

### Prerequisites
- Python 3.10+
- Node.js 18+ (for `npx serve`)
- API keys: [Google AI Studio](https://aistudio.google.com/app/apikey) and [Groq](https://console.groq.com/keys) *(or use mock mode — no keys needed)*

---

### 1. Set up the Python environment

```powershell
# From the GradeOps-main directory
cd pipeline

# Create and activate virtual environment (Windows)
python -m venv .venv
.venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Copy environment file
copy .env.example .env
# Edit .env and add your GOOGLE_API_KEY and GROQ_API_KEY
```

---

### 2. Start the backend (FastAPI)

**Windows (double-click or run from project root):**
```powershell
# From GradeOps-main root:
uvicorn pipeline.server.app:app --reload --port 8000
```

Or use the convenience script:
```powershell
pipeline\start_server.bat
```

**Linux / macOS:**
```bash
./pipeline/start_server.sh
```

Verify it's up:
```
GET http://localhost:8000/health
→ {"status":"ok","mock_llm":false,"grading_model":"llama3-70b-8192","ocr_model":"gemini-2.0-flash"}
```

---

### 3. Start the frontend

```powershell
npm install
npm run dev
# → http://localhost:3000
```

---

### 4. Test with mock mode (no API keys needed)

1. Open `http://localhost:3000`
2. Navigate to **Upload Exam**
3. Upload `pipeline/examples/sample_exam.pdf` and `pipeline/examples/rubric.json`
4. Check **Mock mode** checkbox
5. Click **Submit for grading**
6. Switch to **TA** role and click **Start Review** to approve/override grades
7. View results in **Reports** and download the CSV

---

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/pipeline/start` | Upload PDF + rubric, start pipeline |
| `GET`  | `/pipeline/{id}` | Poll state (students, AI grades, next pending review) |
| `GET`  | `/pipeline/{id}/export/csv` | Download gradebook as CSV (Excel-compatible) |
| `GET`  | `/pipeline/{id}/export/json` | Download raw gradebook JSON |
| `POST` | `/review/{id}/decide` | Submit TA decision; returns updated state immediately |
| `WS`   | `/ws/{id}` | Real-time stat push after finalization |
| `GET`  | `/health` | Server health + model info |
| `GET`  | `/docs` | Swagger UI |

---

## Directory Structure

```
GradeOps-main/
├── index.html              ← SPA shell
├── package.json            ← Frontend dev server
├── css/
│   ├── base.css            ← CSS variables + reset
│   ├── layout.css          ← Header + sidebar + main
│   ├── components.css      ← Cards, buttons, badges, forms
│   └── pages.css           ← Page-specific styles
├── js/
│   ├── main.js             ← Boot + role-switch
│   ├── router.js           ← Page registry + navigation
│   ├── state.js            ← In-memory store
│   ├── api/
│   │   ├── pipeline.js     ← POST/GET pipeline endpoints
│   │   ├── ws.js           ← WebSocket live stats client
│   │   ├── exams.js        ← Exam CRUD + status sync
│   │   ├── reviews.js      ← Review queue operations
│   │   ├── rubrics.js      ← Rubric CRUD
│   │   └── users.js        ← User management
│   ├── components/
│   │   ├── sidebar.js      ← Nav rendering
│   │   └── toast.js        ← Toast notifications
│   └── pages/
│       ├── dashboard.js    ← Instructor overview
│       ├── upload.js       ← Exam upload + pipeline polling
│       ├── exams.js        ← Exam table + CSV download
│       ├── rubrics.js      ← Rubric management
│       ├── users.js        ← Team management
│       ├── reports.js      ← Grade distribution + export
│       ├── ta-dashboard.js ← TA queue overview
│       ├── ta-review.js    ← HITL review panel + WS
│       ├── ta-approved.js  ← Completed reviews
│       └── ta-exams.js     ← Read-only exam view
└── pipeline/
    ├── .env.example        ← Copy to .env and add API keys
    ├── requirements.txt
    ├── config.py           ← All settings (reads .env)
    ├── state.py            ← LangGraph ExamGradingState
    ├── graph.py            ← StateGraph wiring
    ├── main.py             ← CLI runner
    ├── start_server.bat    ← Windows startup script
    ├── start_server.sh     ← Linux/macOS startup script
    ├── agents/
    │   ├── ingestion.py    ← PDF split + rubric validate
    │   ├── ocr.py          ← Gemini Flash vision OCR
    │   ├── grading.py      ← Groq structured scoring + plagiarism
    │   ├── review.py       ← HITL interrupt node
    │   └── finalize.py     ← Stats + gradebook JSON
    ├── schemas/
    │   ├── rubric.py       ← RubricSchema
    │   └── outputs.py      ← OCROutput, GradeOutput, FinalGrade
    ├── tools/
    │   ├── storage.py      ← Local / S3 / GCS storage
    │   ├── pdf_splitter.py ← PyMuPDF extraction
    │   └── similarity.py   ← Cosine similarity (plagiarism)
    ├── server/
    │   ├── app.py          ← FastAPI app factory
    │   ├── ws.py           ← WebSocket manager
    │   └── routes/
    │       ├── pipeline.py ← /pipeline/* routes + CSV export
    │       └── review.py   ← /review/*/decide (full state response)
    └── examples/
        ├── rubric.json
        └── sample_exam.pdf
```

---

## Rubric Format

```json
{
  "exam": "Midterm",
  "course": "CS 301",
  "pages_per_student": 2,
  "questions": [
    {
      "id": "q1",
      "text": "Explain QuickSort time complexity",
      "max_marks": 10,
      "criteria": [
        { "text": "Correct average case O(n log n)", "marks": 4 },
        { "text": "Worst case O(n²) mentioned",       "marks": 3 },
        { "text": "Partition step explained",          "marks": 3 }
      ]
    }
  ]
}
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Vanilla JS (ES Modules), Vanilla CSS |
| Backend | FastAPI + Uvicorn |
| AI Pipeline | LangGraph + LangChain |
| OCR / Vision | Gemini Flash (Google) |
| Grading LLM | Groq Llama3-70b (default) or Gemini |
| Plagiarism | Cosine similarity via Google text-embedding-004 |
| PDF Processing | PyMuPDF |
| Storage | Local filesystem (upgradeable to S3 / GCS) |
