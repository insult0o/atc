# 🚀 Smart Start Script Documentation

The `smart-start-all.sh` script is an intelligent service orchestrator that ensures all ports are properly cleared and all services start successfully with comprehensive monitoring.

## Features

### 🔍 Intelligent Port Management
- **Pre-flight checks**: Scans all ports before attempting to start services
- **Multi-method detection**: Uses `lsof`, `ss`, `netstat`, and `fuser` for comprehensive port detection
- **Smart cleanup**: Only clears ports that are actually in use
- **Process identification**: Shows which process is using each port
- **Retry logic**: Multiple attempts with different methods to clear stubborn ports

### 🏥 Health Monitoring
- **Service health checks**: Validates each service is actually responding
- **Startup verification**: Ensures services don't die immediately after starting
- **Error capture**: Logs all service output to `/tmp/` for debugging
- **Live monitoring**: Continuously checks if services are still running

### 📊 Service Management
- **Ordered startup**: Services start in dependency order
- **Graceful shutdown**: Ctrl+C cleanly stops all services
- **Process tracking**: Maintains PIDs of all started services
- **Error reporting**: Clear indication of which services failed and why

## Usage

```bash
# Using npm script (recommended)
npm run dev:smart

# Or directly
./scripts/smart-start-all.sh
```

## What It Does

1. **Port Availability Check**
   - Checks all required ports (3000, 8000, 8001, 8002, etc.)
   - Identifies which processes are using occupied ports
   - Shows clear status for each port

2. **Port Clearing**
   - Only attempts to clear ports that are in use
   - Uses multiple methods (lsof, fuser, pkill)
   - Provides detailed feedback on clearing attempts
   - Retries up to 5 times per port

3. **Service Startup**
   - Starts services in correct order:
     1. Docker services (if available)
     2. Main Backend API (port 8000)
     3. Processing Server (port 8001)
     4. WebSocket Server (port 8002, if exists)
     5. Frontend (port 3000)
   - Each service gets health-checked
   - Failed services are reported with error logs

4. **Continuous Monitoring**
   - Checks every 30 seconds if services are still running
   - Reports any crashed services
   - Maintains service logs in `/tmp/`

## Output Example

```
🚀 PDF Intelligence Platform - Smart Startup System
============================================================

ℹ️  Step 1: Port availability check
------------------------------------------------
✅ Port 3000 is available
⚠️  Port 8000 is in use by PID 12345 (python)
✅ Port 8001 is available

ℹ️  Step 2: Clearing occupied ports
------------------------------------------------
ℹ️  Clearing port 8000...
⚠️  Attempt 1/5: Port 8000 in use by PID 12345 (python)
✅ Port 8000 is clear

ℹ️  Step 3: Final port verification
------------------------------------------------
✅ Port 3000 confirmed clear
✅ Port 8000 confirmed clear
✅ Port 8001 confirmed clear

ℹ️  Step 4: Starting all services
------------------------------------------------
ℹ️  Starting Main Backend API...
✅ Main Backend API started (PID: 23456)
   Waiting for Main Backend API to be ready...
✅ Main Backend API is healthy at http://localhost:8000/docs

[continues for all services...]

============================================================
✅ Running services:
   🌐 Frontend:          http://localhost:3000
   📊 Backend API Docs:  http://localhost:8000/docs
   🔧 Processing Docs:   http://localhost:8001/docs

✅ All critical services are running!
ℹ️  Press Ctrl+C to stop all services
============================================================
```

## Error Handling

If a service fails to start, you'll see:

```
❌ Processing Server failed to start (PID 34567 died)
Last error output:
    ModuleNotFoundError: No module named 'fastapi'
    ...
```

## Log Files

All service logs are saved to `/tmp/`:
- `/tmp/Main Backend API.log`
- `/tmp/Processing Server.log`
- `/tmp/Frontend Next.js.log`
- `/tmp/WebSocket Server.log`

## Troubleshooting

1. **Port still in use after clearing**
   ```bash
   # Manual nuclear option
   sudo fuser -k 8000/tcp
   ```

2. **Service keeps crashing**
   ```bash
   # Check the service log
   tail -f "/tmp/Main Backend API.log"
   ```

3. **Frontend takes too long to start**
   - This is normal, Next.js compilation can take 30-60 seconds
   - The script will wait and show progress dots

## Advanced Features

### Custom Port Configuration
Edit the script to modify default ports:
```bash
FRONTEND_PORT=3001  # Change from 3000
MAIN_BACKEND_PORT=8080  # Change from 8000
```

### Skip Docker Services
The script automatically detects if Docker is available and skips if not.

### Parallel Service Startup
Services that don't depend on each other start in parallel for faster startup.

## Comparison with Other Scripts

| Feature | smart-start-all.sh | start-all-services.sh | start-both.sh |
|---------|-------------------|---------------------|---------------|
| Port clearing | Intelligent (only if needed) | Always clears all | Basic clearing |
| Health checks | ✅ Comprehensive | ✅ Basic | ❌ |
| Error reporting | ✅ Detailed with logs | ⚠️ Basic | ❌ |
| Process monitoring | ✅ Continuous | ❌ | ❌ |
| Service recovery | ✅ Detects crashes | ❌ | ❌ |
| Startup order | ✅ Dependency-aware | ✅ Fixed order | ⚠️ Parallel only |

## Best Practices

1. **Always use this script for development** - It's the most reliable way to start all services
2. **Check logs on failure** - The `/tmp/` logs contain detailed error information
3. **Clean shutdown** - Always use Ctrl+C to stop services cleanly
4. **Port conflicts** - If you have other services on these ports, modify the script

This script is designed to be the most robust and user-friendly way to start your development environment!