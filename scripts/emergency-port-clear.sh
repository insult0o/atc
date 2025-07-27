#!/bin/bash

# Emergency Port Clearing Script
# Use this when normal port clearing fails

echo "🚨 EMERGENCY PORT CLEARING"
echo "=========================="

echo "🔥 Aggressively clearing ALL development processes..."

# Kill all Node.js processes
echo "   Killing all Node.js processes..."
pkill -f node 2>/dev/null || true

# Kill all Next.js processes
echo "   Killing all Next.js processes..."
pkill -f next 2>/dev/null || true
pkill -9 -f "next-server" 2>/dev/null || true

# Kill all npm processes
echo "   Killing all npm processes..."
pkill -f npm 2>/dev/null || true

# Force kill on specific ports using fuser
echo "   Force killing port 3000..."
fuser -k 3000/tcp 2>/dev/null || true

echo "   Force killing port 8000..."
fuser -k 8000/tcp 2>/dev/null || true

# Kill processes on extended port range
for port in {3000..3010} {8000..8010}; do
    if lsof -ti:$port >/dev/null 2>&1; then
        echo "   Force killing port $port..."
        lsof -ti:$port | xargs kill -9 2>/dev/null || true
        fuser -k $port/tcp 2>/dev/null || true
    fi
done

# Wait for cleanup
echo "⏳ Waiting for cleanup..."
sleep 5

# Final verification using both lsof and ss
echo "✅ Verification:"

# Check port 3000
if ! lsof -ti:3000 >/dev/null 2>&1 && ! ss -tulpn | grep -q ":3000 "; then
    echo "   ✅ Port 3000 is clear"
else
    echo "   ❌ Port 3000 still occupied:"
    echo "      lsof results:"
    lsof -ti:3000 | head -3 || echo "        (none)"
    echo "      ss results:"
    ss -tulpn | grep ":3000 " || echo "        (none)"
fi

# Check port 8000
if ! lsof -ti:8000 >/dev/null 2>&1 && ! ss -tulpn | grep -q ":8000 "; then
    echo "   ✅ Port 8000 is clear"
else
    echo "   ❌ Port 8000 still occupied:"
    echo "      lsof results:"
    lsof -ti:8000 | head -3 || echo "        (none)"
    echo "      ss results:"
    ss -tulpn | grep ":8000 " || echo "        (none)"
fi

echo ""
echo "🎯 If ports are still occupied, try:"
echo "   sudo lsof -ti:3000 | xargs sudo kill -9"
echo "   sudo fuser -k 3000/tcp" 