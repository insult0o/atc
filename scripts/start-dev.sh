#!/bin/bash

# Development Startup Script
# This script ensures clean port environment and starts the frontend on port 3000

echo "🚀 Starting PDF Intelligence Platform Development Environment"
echo "=================================================="

# Clear ports first
./scripts/clear-ports.sh

echo ""
echo "🌐 Starting frontend development server on port 3000..."
echo "   Access your app at: http://localhost:3000"
echo "   Press Ctrl+C to stop the server"
echo ""

# Final check before starting server
echo "🔍 Final check: Ensuring port 3000 is completely free..."
if lsof -ti:3000 >/dev/null 2>&1; then
    echo "   ⚠️  Port 3000 still in use! Forcing one more clear..."
    lsof -ti:3000 | xargs kill -9 2>/dev/null || true
    fuser -k 3000/tcp 2>/dev/null || true
    sleep 3
    
    if lsof -ti:3000 >/dev/null 2>&1; then
        echo "   ❌ Cannot clear port 3000. Please run: lsof -ti:3000 | xargs kill -9"
        exit 1
    fi
fi

echo "   ✅ Port 3000 confirmed available, starting server..."
sleep 1

# Start the development server with explicit port
PORT=3000 npm run dev 