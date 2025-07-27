#!/bin/bash

# Clear Development Ports Script
# This script ensures ports 3000 and 8000 are always available for our services

echo "🔧 Clearing development ports..."

# Function to kill processes on specific ports with retry logic
kill_port() {
    local port=$1
    local max_attempts=5
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        # Use both lsof and ss to find processes (lsof sometimes misses them)
        local lsof_pids=$(lsof -ti:$port 2>/dev/null)
        local ss_pids=$(ss -tulpn | grep ":$port " | grep -o 'pid=[0-9]*' | cut -d= -f2 2>/dev/null)
        
        # Combine both results
        local all_pids=$(echo "$lsof_pids $ss_pids" | tr ' ' '\n' | grep -v '^$' | sort -u | tr '\n' ' ')
        
        if [ -z "$all_pids" ]; then
            # Double check with ss command
            if ! ss -tulpn | grep -q ":$port "; then
                echo "   ✅ Port $port is completely clear"
                return 0
            fi
        fi
        
        if [ ! -z "$all_pids" ]; then
            echo "   ⚡ Attempt $attempt: Killing processes on port $port: $all_pids"
            echo $all_pids | xargs kill -9 2>/dev/null || true
        fi
        
        # Also kill any remaining next-server processes specifically
        pkill -9 -f "next-server.*$port" 2>/dev/null || true
        
        # Wait longer between attempts
        sleep 3
        
        # Check if port is actually free now using both methods
        if ! lsof -ti:$port >/dev/null 2>&1 && ! ss -tulpn | grep -q ":$port "; then
            echo "   ✅ Port $port cleared successfully"
            return 0
        fi
        
        attempt=$((attempt + 1))
    done
    
    echo "   ⚠️  Warning: Port $port may still be in use after $max_attempts attempts"
    echo "   🔍 Remaining processes on port $port:"
    ss -tulpn | grep ":$port " || echo "      (none found with ss)"
    lsof -ti:$port | head -3 || echo "      (none found with lsof)"
    return 1
}

# Kill all processes on frontend ports (3000-3006)
echo "🌐 Clearing frontend ports (3000-3006)..."
for port in {3000..3006}; do
    kill_port $port
done

# Kill all processes on backend ports (8000-8003)
echo "🔧 Clearing backend ports (8000-8003)..."
for port in {8000..8003}; do
    kill_port $port
done

# Also kill any Node.js/Next.js development servers that might be hanging
echo "🔄 Cleaning up development servers..."
pkill -f "next-server" 2>/dev/null || true
pkill -f "next dev" 2>/dev/null || true
pkill -f "npm run dev" 2>/dev/null || true
pkill -f "yarn dev" 2>/dev/null || true

# Wait for processes to fully terminate
echo "⏳ Waiting for processes to terminate..."
sleep 3

# Final verification with aggressive retry for critical ports
echo "✅ Final verification of critical ports..."

# Port 3000 (Frontend) - Critical
echo "🔍 Checking port 3000 (Frontend)..."
if ! kill_port 3000; then
    echo "   🚨 Emergency: Force clearing port 3000..."
    fuser -k 3000/tcp 2>/dev/null || true
    sleep 2
fi

# Port 8000 (Backend) - Critical  
echo "🔍 Checking port 8000 (Backend)..."
if ! kill_port 8000; then
    echo "   🚨 Emergency: Force clearing port 8000..."
    fuser -k 8000/tcp 2>/dev/null || true
    sleep 2
fi

# Final check
if ! lsof -ti:3000 >/dev/null 2>&1; then
    echo "   ✅ Port 3000 is ready"
else
    echo "   ❌ Port 3000 still occupied! Manual intervention needed."
    lsof -ti:3000 | head -5
fi

if ! lsof -ti:8000 >/dev/null 2>&1; then
    echo "   ✅ Port 8000 is ready"
else
    echo "   ❌ Port 8000 still occupied! Manual intervention needed."
    lsof -ti:8000 | head -5
fi

echo "🎉 Port clearing completed! Frontend (3000) and Backend (8000) ports are ready." 