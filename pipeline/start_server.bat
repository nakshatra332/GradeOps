@echo off
REM ─────────────────────────────────────────────────────────────────────────────
REM GradeOps — Start FastAPI backend server (Windows)
REM
REM Usage (from GradeOps-main root):
REM   pipeline\start_server.bat
REM
REM The server will be available at http://localhost:8000
REM Swagger UI (API docs) at http://localhost:8000/docs
REM ─────────────────────────────────────────────────────────────────────────────

echo.
echo =========================================================
echo  GradeOps Pipeline Server
echo =========================================================
echo.

REM ── Step 1: Copy .env if missing ─────────────────────────────────────────────
if not exist "pipeline\.env" (
    if exist "pipeline\.env.example" (
        echo [1/3] No .env found -- copying .env.example to .env
        copy "pipeline\.env.example" "pipeline\.env" >nul
        echo       Edit pipeline\.env to add your API keys.
        echo       For mock mode (no keys), MOCK_LLM=true is already supported via the UI.
        echo.
    )
) else (
    echo [1/3] .env found. OK.
)

REM ── Step 2: Install Python dependencies if uvicorn is missing ─────────────────
echo [2/3] Checking Python dependencies...
uvicorn --version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo       uvicorn not found -- installing requirements now...
    echo       This only runs once.
    echo.
    pip install -r pipeline\requirements.txt
    if %ERRORLEVEL% NEQ 0 (
        echo.
        echo [ERROR] pip install failed. Please check:
        echo   1. Python is installed and on PATH  (python --version)
        echo   2. pip is available               (pip --version)
        echo   3. You have internet access
        echo.
        pause
        exit /b 1
    )
    echo.
    echo       Dependencies installed successfully!
    echo.
) else (
    echo       All dependencies present. OK.
)

REM ── Step 3: Start the server ─────────────────────────────────────────────────
echo [3/3] Starting FastAPI server on http://localhost:8000
echo.
echo  API docs  : http://localhost:8000/docs
echo  Health    : http://localhost:8000/health
echo  Press Ctrl+C to stop.
echo.

set PYTHONPATH=%PYTHONPATH%;.
uvicorn pipeline.server.app:app --reload --port 8000 --host 0.0.0.0

pause
