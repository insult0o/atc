# Port Management System

This project uses a dedicated port management system to ensure consistent development environment.

## Reserved Ports

- **Frontend (Next.js)**: `localhost:3000` (always)
- **Backend (FastAPI)**: `localhost:8000` (always)

## Available Scripts

### Quick Start (Recommended)
```bash
# Start frontend only (auto-clears port 3000)
npm run dev:clean

# Start backend only (auto-clears port 8000)  
./scripts/start-backend.sh

# Start both frontend and backend
./scripts/start-both.sh
```

### Manual Port Management
```bash
# Clear all development ports (3000-3006, 8000-8003)
npm run dev:clear-ports
# or
./scripts/clear-ports.sh

# Regular development (without auto-clearing)
npm run dev
```

## What the Scripts Do

### `clear-ports.sh`
- Kills all processes on ports 3000-3006 and 8000-8003
- Cleans up hanging Next.js development servers
- Verifies ports are available
- Force kills stubborn processes

### `start-dev.sh` 
- Clears frontend ports
- Starts Next.js on port 3000
- Provides clear status messages

### `start-backend.sh`
- Clears backend port 8000
- Starts FastAPI backend with hot reload
- Changes to backend directory automatically

### `start-both.sh`
- Clears all ports
- Starts both services simultaneously
- Proper cleanup on Ctrl+C

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