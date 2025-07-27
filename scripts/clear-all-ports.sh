#!/bin/bash

# Comprehensive Port Clearing Script
# Clears ALL ports used by the PDF Intelligence Platform

echo "🧹 COMPREHENSIVE PORT CLEARING - ALL SERVICES"
echo "=============================================="

# Define all service ports
FRONTEND_PORTS=(3000 3001 3002 3003 3004 3005 3006)
BACKEND_PORTS=(8000 8001 8002 8003 8004 8005)
WEBSOCKET_PORTS=(9000 9001 9002)
DEVELOPMENT_PORTS=(5000 5001 5173 4000)

ALL_PORTS=("${FRONTEND_PORTS[@]}" "${BACKEND_PORTS[@]}" "${WEBSOCKET_PORTS[@]}" "${DEVELOPMENT_PORTS[@]}")

echo "🎯 Target Ports: ${ALL_PORTS[*]}"
echo ""

# Enhanced kill function with multiple detection methods
kill_port_comprehensive() {
    local port=$1
    local max_attempts=3
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        # Method 1: lsof detection
        local lsof_pids=$(lsof -ti:$port 2>/dev/null)
        
        # Method 2: ss detection with PID extraction
        local ss_pids=$(ss -tulpn | grep ":$port " | grep -o 'pid=[0-9]*' | cut -d= -f2 2>/dev/null)
        
        # Method 3: netstat alternative (if available)
        local netstat_pids=$(netstat -tulpn 2>/dev/null | grep ":$port " | awk '{print $7}' | cut -d/ -f1 2>/dev/null | grep -E '^[0-9]+$')
        
        # Combine all results
        local all_pids=$(echo "$lsof_pids $ss_pids $netstat_pids" | tr ' ' '\n' | grep -v '^$' | sort -u | tr '\n' ' ')
        
        # Check if port is truly clear
        if [ -z "$all_pids" ] && ! ss -tulpn | grep -q ":$port "; then
            return 0
        fi
        
        if [ ! -z "$all_pids" ]; then
            echo "   🎯 Port $port: Killing PIDs [$all_pids] (attempt $attempt)"
            echo $all_pids | xargs kill -9 2>/dev/null || true
        fi
        
        # Additional force methods
        fuser -k $port/tcp 2>/dev/null || true
        
        sleep 2
        attempt=$((attempt + 1))
    done
    
    # Final check
    if ss -tulpn | grep -q ":$port "; then
        echo "   ⚠️  Port $port still occupied after $max_attempts attempts"
        return 1
    fi
    
    return 0
}

# Kill all Node.js/Next.js processes
echo "🔥 Killing all Node.js/Next.js processes..."
pkill -f "next-server" 2>/dev/null || true
pkill -f "next dev" 2>/dev/null || true
pkill -f "npm run dev" 2>/dev/null || true
pkill -f "yarn dev" 2>/dev/null || true
pkill -f "node.*3000" 2>/dev/null || true

# Kill all Python/FastAPI processes
echo "🐍 Killing all Python/FastAPI processes..."
pkill -f "uvicorn" 2>/dev/null || true
pkill -f "fastapi_server" 2>/dev/null || true
pkill -f "python.*8000" 2>/dev/null || true
pkill -f "python.*8001" 2>/dev/null || true

# Kill WebSocket processes
echo "🔌 Killing WebSocket processes..."
pkill -f "websocket" 2>/dev/null || true
pkill -f "ws-server" 2>/dev/null || true

echo ""
echo "🧹 Clearing individual ports..."

# Clear each port
for port in "${ALL_PORTS[@]}"; do
    kill_port_comprehensive $port
done

echo ""
echo "⏳ Final cleanup wait..."
sleep 3

# Final verification
echo "✅ Final Verification:"
occupied_ports=()

for port in "${ALL_PORTS[@]}"; do
    if ss -tulpn | grep -q ":$port "; then
        occupied_ports+=($port)
        echo "   ❌ Port $port: STILL OCCUPIED"
        ss -tulpn | grep ":$port " | head -1
    else
        echo "   ✅ Port $port: CLEAR"
    fi
done

if [ ${#occupied_ports[@]} -eq 0 ]; then
    echo ""
    echo "🎉 ALL PORTS CLEARED SUCCESSFULLY!"
    echo "   Ready for service startup"
else
    echo ""
    echo "⚠️  Some ports still occupied: ${occupied_ports[*]}"
    echo "   You may need to run: sudo fuser -k PORT/tcp"
fi

echo "==============================================" 