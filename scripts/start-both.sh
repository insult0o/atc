#!/bin/bash

# Full Stack Startup Script
# This script starts both frontend (3000) and backend (8000) with proper port management

echo "🚀 Starting PDF Intelligence Platform - Full Stack"
echo "=================================================="

# Clear all development ports first
./scripts/clear-ports.sh

echo ""
echo "🎯 Starting Full Stack Environment..."
echo "   Frontend: http://localhost:3000"
echo "   Backend:  http://localhost:8000"
echo ""
echo "Press Ctrl+C to stop all services"
echo ""

# Function to cleanup background processes
cleanup() {
    echo ""
    echo "🛑 Shutting down services..."
    kill $BACKEND_PID 2>/dev/null || true
    kill $FRONTEND_PID 2>/dev/null || true
    ./scripts/clear-ports.sh
    echo "✅ All services stopped"
    exit 0
}

# Set up trap for cleanup
trap cleanup SIGINT SIGTERM

# Start backend in background
echo "🔧 Starting backend server on port 8000..."
cd backend && python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!
cd ..

# Wait a moment for backend to start
sleep 3

# Start frontend in background
echo "🌐 Starting frontend server on port 3000..."
PORT=3000 npm run dev &
FRONTEND_PID=$!

# Wait for processes
wait 