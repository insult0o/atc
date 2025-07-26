"""
PDF Intelligence Platform - FastAPI Backend
Main application entry point with routing and middleware configuration
"""

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse
import time
import uuid
import logging

from app.routers import documents, processing, export, websocket
from app.middleware.errors import ErrorHandlerMiddleware
from app.middleware.logging import LoggingMiddleware
from app.config.settings import get_settings

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load settings
settings = get_settings()

# Create FastAPI app
app = FastAPI(
    title="PDF Intelligence Platform API",
    description="Advanced PDF processing and content extraction platform",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json"
)

# Add security middleware
app.add_middleware(
    TrustedHostMiddleware, 
    allowed_hosts=settings.allowed_hosts
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Add custom middleware
app.add_middleware(ErrorHandlerMiddleware)
app.add_middleware(LoggingMiddleware)

# Request middleware for timing and IDs
@app.middleware("http")
async def add_request_metadata(request: Request, call_next):
    # Add request ID
    request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
    request.state.request_id = request_id
    
    # Add timing
    start_time = time.time()
    
    # Process request
    response = await call_next(request)
    
    # Add response headers
    process_time = time.time() - start_time
    response.headers["X-Request-ID"] = request_id
    response.headers["X-Process-Time"] = str(process_time)
    
    return response

# API Router setup
from fastapi import APIRouter
api_router = APIRouter(prefix="/api/v1")

# Include routers
api_router.include_router(
    documents.router, 
    prefix="/documents", 
    tags=["documents"]
)
api_router.include_router(
    processing.router, 
    prefix="/process", 
    tags=["processing"]
)
api_router.include_router(
    export.router, 
    prefix="/export", 
    tags=["export"]
)

app.include_router(api_router)

# Include WebSocket router (not under /api/v1 prefix)
app.include_router(websocket.router)

# Application lifecycle events
@app.on_event("startup")
async def startup_event():
    """Initialize application resources on startup"""
    logger.info("Starting PDF Intelligence Platform backend...")
    
    # Initialize WebSocket resources
    try:
        from app.dependencies import get_connection_manager, get_message_queue
        connection_manager = await get_connection_manager()
        message_queue = await get_message_queue()
        logger.info("WebSocket infrastructure initialized successfully")
    except Exception as e:
        logger.error(f"Failed to initialize WebSocket infrastructure: {e}")
        # Don't fail startup, but log the error
    
    logger.info("Application startup complete")

@app.on_event("shutdown")
async def shutdown_event():
    """Clean up application resources on shutdown"""
    logger.info("Shutting down PDF Intelligence Platform backend...")
    
    # Clean up WebSocket resources
    try:
        from app.dependencies import cleanup_websocket_resources, cleanup_database_pool, cleanup_redis_client
        await cleanup_websocket_resources()
        await cleanup_database_pool()
        await cleanup_redis_client()
        logger.info("Application resources cleaned up successfully")
    except Exception as e:
        logger.error(f"Error during cleanup: {e}")
    
    logger.info("Application shutdown complete")

# Health check endpoint
@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "version": "1.0.0",
        "timestamp": time.time()
    }

# Root endpoint
@app.get("/")
async def root():
    return {
        "message": "PDF Intelligence Platform API",
        "version": "1.0.0",
        "docs": "/api/docs"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    ) 