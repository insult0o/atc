#!/bin/bash

# Backend Startup Script
# This script ensures port 8000 is available and starts the backend

echo "🔧 Starting PDF Intelligence Platform Backend Environment"
echo "=================================================="

# Clear backend ports first
echo "🔄 Clearing backend port 8000..."
if lsof -ti:8000 >/dev/null 2>&1; then
    echo "   ⚡ Killing processes on port 8000..."
    lsof -ti:8000 | xargs kill -9 2>/dev/null || true
    sleep 2
fi

# Verify port is clear
if ! lsof -ti:8000 >/dev/null 2>&1; then
    echo "   ✅ Port 8000 is available"
else
    echo "   ⚠️  Port 8000 still occupied, trying force kill..."
    lsof -ti:8000 | xargs kill -9 2>/dev/null || true
    sleep 1
fi

echo ""
echo "🐍 Starting backend server on port 8000..."
echo "   Access backend at: http://localhost:8000"
echo "   Press Ctrl+C to stop the server"
echo ""

# Change to backend directory and start server
cd backend && python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload 