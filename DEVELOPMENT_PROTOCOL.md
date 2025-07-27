# PDF Intelligence Platform - Development Protocol

## 🚀 Preferred Startup Sequence (Cursor-Safe)

**⚠️ IMPORTANT:** Use individual service startup to avoid overwhelming Cursor IDE.

### Step-by-Step Protocol

```bash
# 1. Clear all ports (ALWAYS FIRST)
npm run dev:clear-all-ports

# 2. Start Backend API (Terminal 1)
./scripts/start-backend.sh

# 3. Start Processing Server (Terminal 2) 
cd lib/python && python fastapi_server.py --port 8001

# 4. Start Frontend (Terminal 3)
npm run dev:clean
```

### Service Configuration

| Service | Port | URL | Purpose |
|---------|------|-----|---------|
| Frontend | 3000 | http://localhost:3000 | Next.js UI, document viewer |
| Backend API | 8000 | http://localhost:8000/docs | FastAPI core, business logic |
| Processing Server | 8001 | http://localhost:8001/health | GPU-accelerated PDF processing |
| WebSocket (Future) | 8002 | http://localhost:8002 | Real-time communications |

## 🧹 Port Management System

### Quick Commands
```bash
# Clear all development ports
npm run dev:clear-all-ports

# Emergency port clearing (nuclear option)
npm run dev:emergency-clear

# Check port status
ss -tulpn | grep -E ":3000|:8000|:8001"
```

### Port Clearing Methods
1. **Comprehensive** - `clear-all-ports.sh` (ports 3000-3006, 8000-8005, 9000-9002)
2. **Basic** - `clear-ports.sh` (core development ports only)
3. **Emergency** - `emergency-port-clear.sh` (aggressive cleanup)

## 🔄 Alternative Startup Methods

### Option A: Individual Services (RECOMMENDED)
Use the step-by-step protocol above for maximum stability.

### Option B: All-Services Script (Use with caution)
```bash
npm run dev:full-stack
# or
npm run dev:all-services
```
**Note:** May crash Cursor on some systems due to resource usage.

### Option C: Partial Startup
```bash
# Frontend + Backend only (no processing server)
./scripts/start-both.sh
```

## 🏥 Health Check Protocol

### Verification Commands
```bash
# Check all ports are listening
ss -tulpn | grep -E ":3000|:8000|:8001"

# Test service responses
curl -s http://localhost:3000 | grep "PDF Intelligence Platform"
curl -s http://localhost:8000/docs | head -2
curl -s http://localhost:8001/health | grep "healthy"
```

### Expected Responses
- **Frontend**: HTML with "PDF Intelligence Platform" title
- **Backend**: FastAPI docs page or API response
- **Processing**: `{"status":"healthy","gpu_available":true,...}`

## 🛠 Troubleshooting Guide

### Issue: Port Already in Use
```bash
# Solution 1: Clear specific port
lsof -ti:3000 | xargs kill -9

# Solution 2: Comprehensive clearing
npm run dev:clear-all-ports

# Solution 3: Emergency clearing
npm run dev:emergency-clear
```

### Issue: Service Won't Start
```bash
# Check for errors in terminal output
# Verify port is actually clear:
ss -tulpn | grep :PORT_NUMBER

# Restart with verbose output:
cd backend && python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload --log-level debug
```

### Issue: Cursor IDE Crashes
- **Always use individual service startup**
- Avoid `npm run dev:full-stack` on resource-constrained systems
- Start services in separate terminal tabs/windows

### Issue: Services Stop Unexpectedly
```bash
# Check process status
ps aux | grep -E "(uvicorn|python.*8001|next-server)" | grep -v grep

# Restart stopped services individually
./scripts/start-backend.sh  # If backend stopped
cd lib/python && python fastapi_server.py --port 8001  # If processing stopped
```

## 📋 Quick Reference Scripts

### Primary Commands
```bash
npm run dev:clear-all-ports     # Clear all ports
npm run dev:clean               # Frontend only
./scripts/start-backend.sh      # Backend only
./scripts/start-both.sh         # Frontend + Backend
npm run dev:full-stack          # All services (use cautiously)
```

### Diagnostic Commands
```bash
./scripts/test-all-services.sh  # Test each service individually
ss -tulpn | grep -E ":3000|:8000|:8001"  # Check listening ports
ps aux | grep -E "(next|uvicorn|python.*800)" | grep -v grep  # Check processes
```

## 🎯 Development Workflow

### Daily Startup Routine
1. **Clear environment**: `npm run dev:clear-all-ports`
2. **Start backend**: `./scripts/start-backend.sh` (Terminal 1)
3. **Start processing**: `cd lib/python && python fastapi_server.py --port 8001` (Terminal 2)
4. **Start frontend**: `npm run dev:clean` (Terminal 3)
5. **Verify health**: Check all three URLs are responding

### Before Code Changes
- Ensure all services are running and healthy
- Check that ports are stable (not conflicting)
- Test upload functionality if making PDF-related changes

### After Major Changes
```bash
# Restart all services to pick up changes
npm run dev:clear-all-ports
# Restart each service individually
```

## 🔒 Production Considerations

### Environment Variables
- `PORT=3000` for frontend (set automatically)
- Backend runs on 8000 (configured in uvicorn)
- Processing server accepts `--port` argument

### Resource Requirements
- **Frontend**: Low (Node.js development server)
- **Backend**: Medium (FastAPI + database connections)
- **Processing**: High (GPU-accelerated, 8 workers)

### Scaling Notes
- Processing server is the bottleneck (GPU-dependent)
- Backend can handle multiple concurrent requests
- Frontend is static during development

---

**Last Updated:** 2025-07-27  
**Tested Environment:** Linux 6.11.0-17-generic, Cursor IDE  
**Service Versions:** Next.js 14.2.30, FastAPI with Uvicorn, GPU-enabled unstructured processing 