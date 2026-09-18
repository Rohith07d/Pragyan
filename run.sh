#!/bin/bash
set -e

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"

echo "=========================================================="
echo "   🛡️ Starting AegisMeet (Air-Gapped Zero-Leak Proxy)    "
echo "=========================================================="

# Check for backend virtual environment
if [ ! -d "$BACKEND_DIR/venv" ]; then
    echo "❌ Virtual environment not found in $BACKEND_DIR/venv."
    echo "Creating virtual environment and installing dependencies..."
    python3 -m venv "$BACKEND_DIR/venv"
    "$BACKEND_DIR/venv/bin/pip" install -r "$BACKEND_DIR/requirements.txt"
    "$BACKEND_DIR/venv/bin/python" -m spacy download en_core_web_lg
fi

# Clean up child processes on exit
cleanup() {
    echo ""
    echo "🛑 Shutting down AegisMeet services..."
    kill $(jobs -p) 2>/dev/null || true
    exit 0
}
trap cleanup SIGINT SIGTERM EXIT

# Start FastAPI backend proxy
echo "🚀 Launching Privacy Proxy Engine on http://127.0.0.1:8000 ..."
cd "$BACKEND_DIR"
"$BACKEND_DIR/venv/bin/uvicorn" proxy:app --host 127.0.0.1 --port 8000 &
BACKEND_PID=$!

# Wait for backend health
echo "⏳ Waiting for backend proxy initialization..."
for i in {1..20}; do
    if curl -s http://127.0.0.1:8000/health >/dev/null 2>&1; then
        echo "✅ Backend proxy is healthy!"
        break
    fi
    sleep 1
done

# Start Next.js frontend
echo "💻 Launching Next.js Dual-Pane Dashboard on http://localhost:3000 ..."
cd "$FRONTEND_DIR"
npm run dev &
FRONTEND_PID=$!

echo ""
echo "=========================================================="
echo "  ✅ AegisMeet is running:"
echo "     • Frontend Dashboard: http://localhost:3000"
echo "     • Backend API / Docs: http://127.0.0.1:8000/docs"
echo "     • Health Status:      http://127.0.0.1:8000/health"
echo "  Press Ctrl+C to gracefully stop all services."
echo "=========================================================="

wait
