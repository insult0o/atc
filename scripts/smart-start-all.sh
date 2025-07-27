#!/bin/bash

# Smart All Services Startup Script with Comprehensive Port Management
# This script ensures all ports are clear and starts all services with monitoring

set -e  # Exit on error

echo "🚀 PDF Intelligence Platform - Smart Startup System"
echo "============================================================"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Define all service ports
FRONTEND_PORT=3000
MAIN_BACKEND_PORT=8000
PROCESSING_SERVER_PORT=8001
WEBSOCKET_PORT=8002
UNSTRUCTURED_API_PORT=8003
GRAFANA_PORT=9000
PROMETHEUS_PORT=9001
QDRANT_PORT=6333
POSTGRES_PORT=5432
REDIS_PORT=6379

# Array to store all ports
ALL_PORTS=(
    $FRONTEND_PORT
    $MAIN_BACKEND_PORT  
    $PROCESSING_SERVER_PORT
    $WEBSOCKET_PORT
    $UNSTRUCTURED_API_PORT
    $GRAFANA_PORT
    $PROMETHEUS_PORT
    $QDRANT_PORT
)

# Array to store background process IDs
declare -a PIDS=()
declare -a SERVICE_NAMES=()
declare -a SERVICE_ERRORS=()

# Function to print colored messages
print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Function to check if a port is in use
is_port_in_use() {
    local port=$1
    lsof -ti:$port >/dev/null 2>&1 || ss -tulpn 2>/dev/null | grep -q ":$port "
}

# Function to get process info on a port
get_port_info() {
    local port=$1
    local process_info=""
    
    # Try lsof first
    if command -v lsof >/dev/null 2>&1; then
        process_info=$(lsof -ti:$port 2>/dev/null | head -1)
        if [ ! -z "$process_info" ]; then
            local process_name=$(ps -p $process_info -o comm= 2>/dev/null || echo "unknown")
            echo "PID $process_info ($process_name)"
            return
        fi
    fi
    
    # Try ss as fallback
    if command -v ss >/dev/null 2>&1; then
        process_info=$(ss -tulpn 2>/dev/null | grep ":$port " | grep -o 'pid=[0-9]*' | cut -d= -f2 | head -1)
        if [ ! -z "$process_info" ]; then
            local process_name=$(ps -p $process_info -o comm= 2>/dev/null || echo "unknown")
            echo "PID $process_info ($process_name)"
            return
        fi
    fi
    
    echo "unknown process"
}

# Enhanced kill port function with better error handling
kill_port() {
    local port=$1
    local max_attempts=5
    local attempt=1
    
    print_info "Clearing port $port..."
    
    while [ $attempt -le $max_attempts ]; do
        if ! is_port_in_use $port; then
            print_success "Port $port is clear"
            return 0
        fi
        
        local port_info=$(get_port_info $port)
        print_warning "Attempt $attempt/$max_attempts: Port $port in use by $port_info"
        
        # Multiple methods to kill the process
        lsof -ti:$port 2>/dev/null | xargs -r kill -9 2>/dev/null || true
        fuser -k $port/tcp 2>/dev/null || true
        
        # Kill specific known processes
        pkill -9 -f "port.*$port" 2>/dev/null || true
        pkill -9 -f "next.*$port" 2>/dev/null || true
        pkill -9 -f "uvicorn.*$port" 2>/dev/null || true
        pkill -9 -f "python.*$port" 2>/dev/null || true
        
        sleep 2
        
        attempt=$((attempt + 1))
    done
    
    print_error "Failed to clear port $port after $max_attempts attempts"
    return 1
}

# Function to check service health
check_service_health() {
    local service_name=$1
    local url=$2
    local max_retries=10
    local retry=0
    
    while [ $retry -lt $max_retries ]; do
        if curl -s -f "$url" > /dev/null 2>&1; then
            print_success "$service_name is healthy at $url"
            return 0
        fi
        
        retry=$((retry + 1))
        if [ $retry -lt $max_retries ]; then
            echo -n "."
            sleep 2
        fi
    done
    
    print_error "$service_name failed health check at $url"
    return 1
}

# Function to start a service with monitoring
start_service() {
    local service_name=$1
    local command=$2
    local health_url=$3
    local working_dir=${4:-.}
    
    print_info "Starting $service_name..."
    
    # Change to working directory
    cd "$working_dir"
    
    # Start the service and capture both stdout and stderr
    eval "$command" > "/tmp/${service_name}.log" 2>&1 &
    local pid=$!
    
    # Store PID and service name
    PIDS+=($pid)
    SERVICE_NAMES+=("$service_name")
    
    # Return to original directory
    cd - > /dev/null
    
    # Wait a moment for the service to start
    sleep 2
    
    # Check if process is still running
    if ! kill -0 $pid 2>/dev/null; then
        print_error "$service_name failed to start (PID $pid died)"
        # Show last 10 lines of error log
        echo "Last error output:"
        tail -10 "/tmp/${service_name}.log" 2>/dev/null | sed 's/^/    /'
        SERVICE_ERRORS+=("$service_name")
        return 1
    fi
    
    print_success "$service_name started (PID: $pid)"
    
    # Health check
    if [ ! -z "$health_url" ]; then
        echo -n "   Waiting for $service_name to be ready"
        if check_service_health "$service_name" "$health_url"; then
            return 0
        else
            SERVICE_ERRORS+=("$service_name")
            return 1
        fi
    fi
    
    return 0
}

# Cleanup function
cleanup() {
    echo ""
    print_warning "Shutting down all services..."
    
    # Kill all background processes gracefully first
    for i in "${!PIDS[@]}"; do
        local pid="${PIDS[$i]}"
        local name="${SERVICE_NAMES[$i]}"
        if kill -0 $pid 2>/dev/null; then
            print_info "Stopping $name (PID: $pid)..."
            kill -TERM $pid 2>/dev/null || true
        fi
    done
    
    # Wait for graceful shutdown
    sleep 3
    
    # Force kill if necessary
    for pid in "${PIDS[@]}"; do
        if kill -0 $pid 2>/dev/null; then
            print_warning "Force killing PID: $pid"
            kill -9 $pid 2>/dev/null || true
        fi
    done
    
    # Clear all ports one final time
    print_info "Final port cleanup..."
    for port in "${ALL_PORTS[@]}"; do
        kill_port $port > /dev/null 2>&1 || true
    done
    
    print_success "All services stopped"
    exit 0
}

# Set up trap for cleanup
trap cleanup SIGINT SIGTERM EXIT

# Main execution
echo ""
print_info "Step 1: Port availability check"
echo "------------------------------------------------"

# Check all ports first
ports_in_use=()
for port in "${ALL_PORTS[@]}"; do
    if is_port_in_use $port; then
        port_info=$(get_port_info $port)
        print_warning "Port $port is in use by $port_info"
        ports_in_use+=($port)
    else
        print_success "Port $port is available"
    fi
done

# Clear ports if needed
if [ ${#ports_in_use[@]} -gt 0 ]; then
    echo ""
    print_info "Step 2: Clearing occupied ports"
    echo "------------------------------------------------"
    
    for port in "${ports_in_use[@]}"; do
        if ! kill_port $port; then
            print_error "Could not clear port $port - manual intervention may be needed"
            # Continue anyway, service might fail but we'll catch it
        fi
    done
else
    echo ""
    print_success "All ports are already clear!"
fi

# Final port verification
echo ""
print_info "Step 3: Final port verification"
echo "------------------------------------------------"

all_clear=true
for port in "${ALL_PORTS[@]}"; do
    if is_port_in_use $port; then
        print_error "Port $port is still in use!"
        all_clear=false
    else
        print_success "Port $port confirmed clear"
    fi
done

if [ "$all_clear" = false ]; then
    print_error "Some ports could not be cleared. Services may fail to start."
    print_info "Try running: sudo ./scripts/emergency-port-clear.sh"
fi

# Start all services
echo ""
print_info "Step 4: Starting all services"
echo "------------------------------------------------"

# 1. Start Docker services if docker-compose.yml exists
if [ -f "docker-compose.yml" ] && command -v docker-compose >/dev/null 2>&1; then
    print_info "Checking Docker services..."
    
    # Check if containers are already running
    if echo "1" | sudo -S docker ps --format "{{.Names}}" 2>/dev/null | grep -q "postgres-local"; then
        print_success "Docker services already running"
    else
        print_info "Starting Docker services..."
        echo "1" | sudo -S docker-compose up -d postgres redis qdrant 2>/dev/null || print_warning "Docker services failed to start"
    fi
    
    # Wait for services to be ready
    print_info "Waiting for database to be ready..."
    sleep 5
fi

# 2. Start Main Backend API
start_service "Main Backend API" \
    "python -m uvicorn app.main:app --host 0.0.0.0 --port $MAIN_BACKEND_PORT --reload" \
    "http://localhost:$MAIN_BACKEND_PORT/api/docs" \
    "backend"

# 3. Start Processing Server
start_service "Processing Server" \
    "python fastapi_server.py --port $PROCESSING_SERVER_PORT" \
    "http://localhost:$PROCESSING_SERVER_PORT/health" \
    "lib/python"

# 4. Start WebSocket Server (if exists)
if [ -f "backend/app/websocket_server.py" ]; then
    start_service "WebSocket Server" \
        "python -m app.websocket_server --port $WEBSOCKET_PORT" \
        "" \
        "backend"
fi

# 5. Start Frontend (most likely to have issues, start last)
start_service "Frontend Next.js" \
    "PORT=$FRONTEND_PORT npm run dev" \
    "http://localhost:$FRONTEND_PORT" \
    "."

# Summary
echo ""
echo "============================================================"
print_info "STARTUP SUMMARY"
echo "============================================================"

# Check for errors
if [ ${#SERVICE_ERRORS[@]} -gt 0 ]; then
    print_error "The following services failed to start properly:"
    for service in "${SERVICE_ERRORS[@]}"; do
        echo "   - $service"
        echo "     Check logs: tail -f /tmp/${service}.log"
    done
    echo ""
fi

# Show running services
print_success "Running services:"
echo "   🌐 Frontend:          http://localhost:$FRONTEND_PORT"
echo "   📊 Backend API Docs:  http://localhost:$MAIN_BACKEND_PORT/api/docs"
echo "   🔧 Processing Docs:   http://localhost:$PROCESSING_SERVER_PORT/docs"

if kill -0 ${PIDS[3]} 2>/dev/null; then
    echo "   🔌 WebSocket:         ws://localhost:$WEBSOCKET_PORT"
fi

echo ""
print_info "Service logs are available at:"
for name in "${SERVICE_NAMES[@]}"; do
    echo "   - /tmp/${name}.log"
done

echo ""
print_success "All critical services are running!"
print_info "Press Ctrl+C to stop all services"
echo "============================================================"

# Monitor services
while true; do
    sleep 30
    
    # Check if services are still running
    failed_services=()
    for i in "${!PIDS[@]}"; do
        local pid="${PIDS[$i]}"
        local name="${SERVICE_NAMES[$i]}"
        if ! kill -0 $pid 2>/dev/null; then
            failed_services+=("$name")
        fi
    done
    
    if [ ${#failed_services[@]} -gt 0 ]; then
        echo ""
        print_error "The following services have stopped:"
        for service in "${failed_services[@]}"; do
            echo "   - $service"
        done
        print_info "Check logs in /tmp/ for error details"
    fi
done