#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# GradeOps — Start FastAPI backend server (Linux / macOS)
#
# Usage:
#   cd GradeOps-main
#   chmod +x pipeline/start_server.sh
#   ./pipeline/start_server.sh
#
# The server will be available at http://localhost:8000
# Swagger UI (API docs) at http://localhost:8000/docs
# ─────────────────────────────────────────────────────────────────────────────

set -e

echo ""
echo "[GradeOps] Starting FastAPI pipeline server..."
echo "[GradeOps] API docs: http://localhost:8000/docs"
echo "[GradeOps] Health:   http://localhost:8000/health"
echo "[GradeOps] Press Ctrl+C to stop."
echo ""

# Check if .env exists; if not, copy from example
if [ ! -f "pipeline/.env" ]; then
  if [ -f "pipeline/.env.example" ]; then
    echo "[GradeOps] No .env found — copying .env.example to .env"
    cp pipeline/.env.example pipeline/.env
    echo "[GradeOps] Edit pipeline/.env to add your API keys before running the real pipeline."
    echo ""
  fi
fi

# ── Step 2: Check/Install dependencies ─────────────────────────────────────────
if ! command -v uvicorn &> /dev/null; then
  echo "[GradeOps] uvicorn not found — installing requirements..."
  # Try to use a venv if it doesn't exist yet
  if [ ! -d "pipeline/.venv" ] && [ ! -d ".venv" ]; then
    echo "[GradeOps] Creating virtual environment..."
    python3 -m venv .venv
    source .venv/bin/activate
  fi
  pip install -r pipeline/requirements.txt
  echo "[GradeOps] Dependencies installed successfully!"
  echo ""
fi

# Activate virtual environment if it exists
if [ -d "pipeline/.venv" ]; then
  source pipeline/.venv/bin/activate
  echo "[GradeOps] Activated venv: pipeline/.venv"
elif [ -d ".venv" ]; then
  source .venv/bin/activate
  echo "[GradeOps] Activated venv: .venv"
fi

# Run the server from the project root (required for Python imports)
export PYTHONPATH=$PYTHONPATH:.
uvicorn pipeline.server.app:app --reload --port 8000 --host 0.0.0.0
