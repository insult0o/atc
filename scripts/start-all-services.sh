#!/bin/bash

# All Services Startup Script
# This script starts the entire PDF Intelligence Platform stack

echo "🚀 Starting PDF Intelligence Platform - FULL STACK"
echo "============================================================"

# Define service ports
FRONTEND_PORT=3000
MAIN_BACKEND_PORT=8000
PROCESSING_SERVER_PORT=8001
WEBSOCKET_PORT=8002

# Service URLs for reference
echo "📋 Service Configuration:"
echo "   Frontend (Next.js):       http://localhost:$FRONTEND_PORT"
echo "   Main Backend (FastAPI):   http://localhost:$MAIN_BACKEND_PORT"
echo "   Processing Server:        http://localhost:$PROCESSING_SERVER_PORT"
echo "   WebSocket Server:         http://localhost:$WEBSOCKET_PORT"
echo ""

# Clear ALL development ports aggressively
echo "🧹 Clearing ALL development ports..."
./scripts/clear-all-ports.sh

echo ""
echo "🎯 Starting All Services..."
echo "   Press Ctrl+C to stop all services"
echo ""

# Array to store background process IDs
declare -a PIDS=()

# Function to cleanup all processes
cleanup() {
    echo ""
    echo "🛑 Shutting down all services..."
    
    # Kill all background processes
    for pid in "${PIDS[@]}"; do
        if kill -0 $pid 2>/dev/null; then
            echo "   Stopping service (PID: $pid)..."
            kill -TERM $pid 2>/dev/null || true
        fi
    done
    
    # Wait a moment for graceful shutdown
    sleep 2
    
    # Force kill if necessary
    for pid in "${PIDS[@]}"; do
        if kill -0 $pid 2>/dev/null; then
            echo "   Force killing service (PID: $pid)..."
            kill -9 $pid 2>/dev/null || true
        fi
    done
    
    # Clear ports one final time
    ./scripts/clear-all-ports.sh
    echo "✅ All services stopped"
    exit 0
}

# Set up trap for cleanup
trap cleanup SIGINT SIGTERM EXIT

# Start Main Backend API first
echo "🗄️  Starting Main Backend API on port $MAIN_BACKEND_PORT..."
cd backend
python -m uvicorn app.main:app --host 0.0.0.0 --port $MAIN_BACKEND_PORT --reload &
BACKEND_PID=$!
PIDS+=($BACKEND_PID)
cd ..
echo "   Backend PID: $BACKEND_PID"

# Wait for backend to start
sleep 4

# Start Processing Server (Unstructured)
echo "🔧 Starting Processing Server on port $PROCESSING_SERVER_PORT..."
cd lib/python
python fastapi_server.py --port $PROCESSING_SERVER_PORT &
PROCESSING_PID=$!
PIDS+=($PROCESSING_PID)
cd ../..
echo "   Processing Server PID: $PROCESSING_PID"

# Wait for processing server to start
sleep 4

# Start Frontend
echo "🌐 Starting Frontend on port $FRONTEND_PORT..."
PORT=$FRONTEND_PORT npm run dev &
FRONTEND_PID=$!
PIDS+=($FRONTEND_PID)
echo "   Frontend PID: $FRONTEND_PID"

# Wait for frontend to start
sleep 5

# Health check all services
echo ""
echo "🏥 Health Check:"

# Check Frontend
if curl -s http://localhost:$FRONTEND_PORT > /dev/null; then
    echo "   ✅ Frontend: RUNNING"
else
    echo "   ❌ Frontend: FAILED"
fi

# Check Main Backend
if curl -s http://localhost:$MAIN_BACKEND_PORT/docs > /dev/null; then
    echo "   ✅ Main Backend: RUNNING"
else
    echo "   ❌ Main Backend: FAILED"
fi

# Check Processing Server
if curl -s http://localhost:$PROCESSING_SERVER_PORT/health > /dev/null; then
    echo "   ✅ Processing Server: RUNNING"
else
    echo "   ❌ Processing Server: FAILED"
fi

echo ""
echo "🎉 All services started! Access your application:"
echo "   🌐 Frontend:     http://localhost:$FRONTEND_PORT"
echo "   📊 Backend API:  http://localhost:$MAIN_BACKEND_PORT/docs"
echo "   🔧 Processing:   http://localhost:$PROCESSING_SERVER_PORT/docs"
echo ""
echo "💡 Logs will appear below. Press Ctrl+C to stop all services."
echo "================================================================="

# Wait for all processes
wait 