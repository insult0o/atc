#!/bin/bash

# Simple startup script - just start the essentials

echo "🚀 Starting PDF Intelligence Platform - Simple Mode"
echo "=================================================="

# Change to project root
cd /home/insulto/atc

# 1. Check Docker containers
echo "📦 Checking Docker containers..."
if echo "1" | sudo -S docker ps | grep -q "postgres-local"; then
    echo "✅ Database is running"
else
    echo "⚠️  Starting database containers..."
    echo "1" | sudo -S docker-compose up -d postgres redis qdrant
    sleep 5
fi

# 2. Start Backend
echo ""
echo "🔧 Starting Backend API..."
cd backend
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!
cd ..
echo "Backend PID: $BACKEND_PID"
sleep 5

# 3. Test Backend
echo ""
echo "Testing backend..."
if curl -s http://localhost:8000/health | grep -q "healthy"; then
    echo "✅ Backend is working!"
else
    echo "❌ Backend failed to start"
fi

# 4. Start Frontend
echo ""
echo "🌐 Starting Frontend..."
npm run dev &
FRONTEND_PID=$!
echo "Frontend PID: $FRONTEND_PID"

echo ""
echo "=================================================="
echo "Services starting up:"
echo "  Backend:  http://localhost:8000/api/docs"
echo "  Frontend: http://localhost:3000"
echo ""
echo "Note: Frontend compilation may take 30-60 seconds"
echo "Press Ctrl+C to stop all services"
echo "=================================================="

# Wait for processes
wait