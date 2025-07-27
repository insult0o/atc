# Port Management System

This project uses a dedicated port management system to ensure consistent development environment.

## Reserved Ports

- **Frontend (Next.js)**: `localhost:3000` (always)
- **Main Backend (FastAPI)**: `localhost:8000` (always)
- **Processing Server (Unstructured)**: `localhost:8001` (always)
- **WebSocket Server**: `localhost:8002` (always)

## Available Scripts

### Quick Start (Recommended)
```bash
# PREFERRED: Individual services (Cursor-safe) ⭐
npm run dev:clear-all-ports                              # 1. Clear ports
./scripts/start-backend.sh                               # 2. Backend (Terminal 1)
cd lib/python && python fastapi_server.py --port 8001   # 3. Processing (Terminal 2)
npm run dev:clean                                        # 4. Frontend (Terminal 3)

# ALTERNATIVE: All services at once (may crash Cursor) ⚠️
npm run dev:full-stack
npm run dev:all-services

# PARTIAL: Frontend + Backend only
./scripts/start-both.sh        
```

### Manual Port Management
```bash
# Clear ALL service ports (comprehensive) 
npm run dev:clear-all-ports

# Clear basic dev ports only (3000-3006, 8000-8003)
npm run dev:clear-ports

# Emergency nuclear option
npm run dev:emergency-clear

# Regular development (without auto-clearing)
npm run dev
```

## What the Scripts Do

### `start-all-services.sh` ⭐ **MAIN SCRIPT**
- Clears ALL service ports comprehensively
- Starts Frontend (3000), Main Backend (8000), Processing Server (8001)
- Health checks all services
- Proper cleanup on Ctrl+C
- **ONE COMMAND TO RULE THEM ALL**

### `clear-all-ports.sh`
- Kills processes on ALL development ports (3000-3006, 8000-8005, 9000-9002, etc.)
- Uses multiple detection methods (lsof, ss, netstat)
- Force kills stubborn processes with fuser
- Comprehensive verification

### `clear-ports.sh` (Basic)
- Kills processes on core ports (3000-3006, 8000-8003)
- Basic Next.js and FastAPI cleanup
- Uses dual detection (lsof + ss)

### `start-dev.sh` 
- Clears frontend ports
- Starts Next.js on port 3000
- Final port verification before startup

### `start-backend.sh`
- Clears backend port 8000
- Starts main FastAPI backend
- Changes to backend directory automatically

### `start-both.sh`
- Starts frontend + main backend only
- Does not include processing server

## Troubleshooting

If you get "port already in use" errors:

1. **Quick fix**: Run `npm run dev:clear-ports`
2. **Manual check**: `lsof -ti:3000` (shows what's using port 3000)
3. **Force kill**: `lsof -ti:3000 | xargs kill -9`

## Environment Variables

The scripts automatically set:
- `PORT=3000` for frontend
- `PORT=8000` for backend

No need to manually configure ports anymore! 