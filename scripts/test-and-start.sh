#!/bin/bash

# Final working startup script

echo "🚀 PDF Intelligence Platform - Test & Start"
echo "=========================================="

# Kill any existing processes
echo "🧹 Cleaning up..."
pkill -f uvicorn 2>/dev/null
pkill -f "npm run dev" 2>/dev/null
sleep 2

# Test Docker
echo ""
echo "📦 Testing Docker services..."
if echo "1" | sudo -S docker ps --format "{{.Names}}" | grep -q postgres-local; then
    echo "✅ PostgreSQL is running"
    echo "✅ Redis is running"
    echo "✅ Qdrant is running"
else
    echo "❌ Docker services not running!"
    echo "Starting them now..."
    echo "1" | sudo -S docker-compose up -d postgres redis qdrant
    sleep 10
fi

# Start backend
echo ""
echo "🔧 Starting Backend..."
cd /home/insulto/atc/backend
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!
echo "Backend PID: $BACKEND_PID"
sleep 5

# Test backend
echo ""
echo "🧪 Testing Backend..."
if ps -p $BACKEND_PID > /dev/null; then
    echo "✅ Backend process is running"
    
    # Test health endpoint
    if curl -s http://localhost:8000/health | grep -q healthy; then
        echo "✅ Health endpoint works"
    else
        echo "❌ Health endpoint failed"
    fi
    
    # Test API docs
    if curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/api/docs | grep -q 200; then
        echo "✅ API docs accessible"
    else
        echo "❌ API docs not accessible"
    fi
    
    # Test documents endpoint
    DOCS_RESPONSE=$(curl -s -w "\n%{http_code}" http://localhost:8000/api/v1/documents)
    HTTP_CODE=$(echo "$DOCS_RESPONSE" | tail -n1)
    RESPONSE_BODY=$(echo "$DOCS_RESPONSE" | head -n-1)
    
    if [ "$HTTP_CODE" = "200" ]; then
        echo "✅ Documents API works (HTTP 200)"
    elif [ "$HTTP_CODE" = "500" ]; then
        echo "⚠️  Documents API returned error (HTTP 500):"
        echo "$RESPONSE_BODY" | head -c 200
    else
        echo "❌ Documents API failed (HTTP $HTTP_CODE)"
    fi
else
    echo "❌ Backend crashed!"
    echo "Check logs in: /tmp/backend_new.log"
    exit 1
fi

# Start frontend
echo ""
echo "🌐 Starting Frontend..."
cd /home/insulto/atc
npm run dev &
FRONTEND_PID=$!
echo "Frontend PID: $FRONTEND_PID"

echo ""
echo "=========================================="
echo "✅ Services are starting:"
echo ""
echo "🔧 Backend API:"
echo "   - Health: http://localhost:8000/health"
echo "   - API Docs: http://localhost:8000/api/docs"
echo "   - Documents: http://localhost:8000/api/v1/documents"
echo ""
echo "🌐 Frontend:"
echo "   - Homepage: http://localhost:3000"
echo "   - Note: May take 30-60 seconds to compile"
echo ""
echo "📊 Database:"
echo "   - PostgreSQL: localhost:5432 (pdf_user/pdf_password)"
echo "   - Redis: localhost:6379"
echo "   - Qdrant: localhost:6333"
echo ""
echo "Press Ctrl+C to stop all services"
echo "=========================================="

# Keep running
while true; do
    sleep 30
    if ! ps -p $BACKEND_PID > /dev/null; then
        echo "⚠️  Backend crashed! Check logs."
    fi
    if ! ps -p $FRONTEND_PID > /dev/null; then
        echo "⚠️  Frontend stopped."
    fi
done