#!/bin/bash

# Debug startup script - starts services one by one with full logging

echo "🔍 Debug Startup - PDF Intelligence Platform"
echo "=========================================="

# Kill any existing processes
echo "Cleaning up old processes..."
pkill -f "uvicorn" 2>/dev/null || true
pkill -f "npm run dev" 2>/dev/null || true
sleep 2

# Start backend with full output
echo ""
echo "1. Starting Backend API..."
echo "=========================="
cd backend
echo "Current directory: $(pwd)"
echo "Starting uvicorn..."

# Start backend and show output
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!
echo "Backend PID: $BACKEND_PID"

# Wait for backend to start
echo "Waiting for backend to start..."
sleep 5

# Test backend
echo ""
echo "Testing backend endpoints:"
echo "- Health check:"
curl -s http://localhost:8000/health | python3 -m json.tool || echo "Health check failed"

echo ""
echo "- API docs:"
curl -s -o /dev/null -w "  Status: %{http_code}\n" http://localhost:8000/api/docs

echo ""
echo "- Documents endpoint:"
curl -s http://localhost:8000/api/v1/documents | python3 -m json.tool || echo "Documents endpoint failed"

# Check if backend is still running
if kill -0 $BACKEND_PID 2>/dev/null; then
    echo ""
    echo "✅ Backend is running on PID $BACKEND_PID"
else
    echo ""
    echo "❌ Backend crashed!"
fi

# Start frontend
echo ""
echo "2. Starting Frontend..."
echo "======================"
cd ..
echo "Current directory: $(pwd)"

npm run dev &
FRONTEND_PID=$!
echo "Frontend PID: $FRONTEND_PID"

echo ""
echo "Waiting for frontend to compile (this may take 30-60 seconds)..."
sleep 20

# Test frontend
echo ""
echo "Testing frontend:"
curl -s -o /dev/null -w "Frontend status: %{http_code}\n" http://localhost:3000

echo ""
echo "=========================================="
echo "Services should be running:"
echo "  Backend: http://localhost:8000/api/docs"
echo "  Frontend: http://localhost:3000"
echo ""
echo "Press Ctrl+C to stop all services"
echo "=========================================="

# Keep script running
wait