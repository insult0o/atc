#!/bin/bash

# Quick Test Script for All Services
echo "🧪 TESTING ALL SERVICES STARTUP"
echo "================================"

# Clear all ports first
echo "1️⃣ Clearing all ports..."
./scripts/clear-all-ports.sh

echo ""
echo "2️⃣ Testing individual service startups..."

# Test Backend startup
echo "🗄️  Testing Backend (port 8000)..."
cd backend
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!
cd ..
sleep 5

if ss -tulpn | grep -q ":8000 "; then
    echo "   ✅ Backend: STARTED"
    kill $BACKEND_PID 2>/dev/null || true
else
    echo "   ❌ Backend: FAILED"
fi

# Test Processing Server startup  
echo "🔧 Testing Processing Server (port 8001)..."
cd lib/python
python fastapi_server.py --port 8001 &
PROCESSING_PID=$!
cd ../..
sleep 5

if ss -tulpn | grep -q ":8001 "; then
    echo "   ✅ Processing Server: STARTED"
    kill $PROCESSING_PID 2>/dev/null || true
else
    echo "   ❌ Processing Server: FAILED"
fi

# Test Frontend startup
echo "🌐 Testing Frontend (port 3000)..."
PORT=3000 npm run dev &
FRONTEND_PID=$!
sleep 8

if ss -tulpn | grep -q ":3000 "; then
    echo "   ✅ Frontend: STARTED"
    kill $FRONTEND_PID 2>/dev/null || true
else
    echo "   ❌ Frontend: FAILED"
fi

# Cleanup
sleep 2
./scripts/clear-all-ports.sh

echo ""
echo "🎯 Test completed! All individual services can start."
echo "✨ You can now use: npm run dev:full-stack" 