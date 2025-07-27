"""
Dependency injection for FastAPI endpoints
"""

from fastapi import Depends
from functools import lru_cache
from typing import Optional
import asyncpg
from supabase import create_client, Client
import redis.asyncio as redis
import logging

from app.config.settings import get_settings, Settings
from app.services.document_service import DocumentService
from app.services.processing_service import ProcessingService
from app.services.export_service import ExportService
from app.services.zone_service import ZoneService

logger = logging.getLogger(__name__)

# Database connection pool
_db_pool = None
_redis_client = None
_supabase_client = None

async def get_database_pool() -> Optional[asyncpg.Pool]:
    """Get database connection pool"""
    global _db_pool
    if _db_pool is None:
        settings = get_settings()
        try:
            _db_pool = await asyncpg.create_pool(
                settings.database_url,
                min_size=5,
                max_size=settings.database_pool_size,
                max_queries=50000,
                max_inactive_connection_lifetime=300,
                command_timeout=60
            )
            logger.info("Database connection pool created successfully")
        except Exception as e:
            logger.warning(f"Database not available (demo mode): {e}")
            # Return None for demo mode - services will handle this gracefully
            return None
    return _db_pool

async def get_redis_client() -> redis.Redis:
    """Get Redis client"""
    global _redis_client
    if _redis_client is None:
        settings = get_settings()
        try:
            _redis_client = redis.from_url(
                settings.redis_url,
                encoding="utf-8",
                decode_responses=True,
                socket_connect_timeout=5,
                socket_timeout=5,
                retry_on_timeout=True,
                health_check_interval=30
            )
            # Test connection
            await _redis_client.ping()
            logger.info("Redis client connected successfully")
        except Exception as e:
            logger.warning(f"Redis connection failed: {e}. Continuing without cache.")
            _redis_client = None
    return _redis_client

async def get_supabase_client() -> Optional[Client]:
    """Get Supabase client"""
    global _supabase_client
    if _supabase_client is None:
        settings = get_settings()
        try:
            _supabase_client = create_client(
                settings.supabase_url,
                settings.supabase_service_key
            )
            logger.info("Supabase client created successfully")
        except Exception as e:
            logger.warning(f"Supabase connection failed: {e}. Continuing in demo mode.")
            _supabase_client = None
    return _supabase_client

# Service dependencies
async def get_document_service() -> DocumentService:
    """Get document service instance"""
    db_pool = await get_database_pool()
    supabase_client = await get_supabase_client()
    redis_client = await get_redis_client()
    
    return DocumentService(
        db_pool=db_pool,
        supabase_client=supabase_client,
        redis_client=redis_client
    )

async def get_processing_service() -> ProcessingService:
    """Get processing service instance"""
    db_pool = await get_database_pool()
    redis_client = await get_redis_client()
    document_service = await get_document_service()
    
    return ProcessingService(
        db_pool=db_pool,
        redis_client=redis_client,
        document_service=document_service
    )

async def get_export_service() -> ExportService:
    """Get export service instance"""
    db_pool = await get_database_pool()
    supabase_client = await get_supabase_client()
    redis_client = await get_redis_client()
    document_service = await get_document_service()
    
    return ExportService(
        db_pool=db_pool,
        supabase_client=supabase_client,
        redis_client=redis_client,
        document_service=document_service
    )

async def get_zone_service() -> ZoneService:
    """Get zone service instance"""
    db_pool = await get_database_pool()
    supabase_client = await get_supabase_client()
    redis_client = await get_redis_client()
    
    return ZoneService(
        db_pool=db_pool,
        supabase_client=supabase_client,
        redis_client=redis_client
    )

# Utility dependencies
def get_current_settings() -> Settings:
    """Get current settings"""
    return get_settings()

async def get_current_user_id() -> str:
    """Get current user ID (placeholder for authentication)"""
    # TODO: Implement proper authentication
    # For now, return anonymous user
    return "anonymous"

# Cleanup functions for graceful shutdown
async def close_database_pool():
    """Close database connection pool"""
    global _db_pool
    if _db_pool:
        await _db_pool.close()
        _db_pool = None
        logger.info("Database connection pool closed")

async def close_redis_client():
    """Close Redis client"""
    global _redis_client
    if _redis_client:
        await _redis_client.close()
        _redis_client = None
        logger.info("Redis client closed")

# Background task dependencies
class BackgroundTaskContext:
    """Context for background tasks with shared resources"""
    
    def __init__(self):
        self.db_pool = None
        self.redis_client = None
        self.supabase_client = None
    
    async def initialize(self):
        """Initialize all resources"""
        self.db_pool = await get_database_pool()
        self.redis_client = await get_redis_client()
        self.supabase_client = await get_supabase_client()
    
    async def cleanup(self):
        """Cleanup resources"""
        # Background tasks should not close shared resources
        pass

async def get_background_task_context() -> BackgroundTaskContext:
    """Get background task context"""
    context = BackgroundTaskContext()
    await context.initialize()
    return context

# Health check dependencies
async def check_database_health() -> bool:
    """Check database connectivity"""
    try:
        pool = await get_database_pool()
        async with pool.acquire() as conn:
            await conn.fetchval("SELECT 1")
        return True
    except Exception as e:
        logger.error(f"Database health check failed: {e}")
        return False

async def check_redis_health() -> bool:
    """Check Redis connectivity"""
    try:
        client = await get_redis_client()
        if client:
            await client.ping()
            return True
        return False
    except Exception as e:
        logger.error(f"Redis health check failed: {e}")
        return False

async def check_supabase_health() -> bool:
    """Check Supabase connectivity"""
    try:
        client = await get_supabase_client()
        # Simple test query
        response = client.table("documents").select("id").limit(1).execute()
        return response.data is not None
    except Exception as e:
        logger.error(f"Supabase health check failed: {e}")
        return False

# Request context dependencies
class RequestContext:
    """Request context with user information and metadata"""
    
    def __init__(self, user_id: str, request_id: str = None):
        self.user_id = user_id
        self.request_id = request_id
        self.metadata = {}
    
    def add_metadata(self, key: str, value):
        """Add metadata to request context"""
        self.metadata[key] = value

async def get_request_context(
    user_id: str = Depends(get_current_user_id)
) -> RequestContext:
    """Get request context"""
    return RequestContext(user_id=user_id)

# Pagination dependencies
class PaginationParams:
    """Pagination parameters"""
    
    def __init__(self, page: int = 1, size: int = 20):
        self.page = max(1, page)
        self.size = min(100, max(1, size))
        self.offset = (self.page - 1) * self.size
    
    def to_dict(self):
        return {
            "page": self.page,
            "size": self.size,
            "offset": self.offset
        }

def get_pagination_params(page: int = 1, size: int = 20) -> PaginationParams:
    """Get pagination parameters"""
    return PaginationParams(page=page, size=size)

# Cache dependencies
class CacheManager:
    """Cache manager for Redis operations"""
    
    def __init__(self, redis_client: redis.Redis = None):
        self.redis = redis_client
    
    async def get(self, key: str):
        """Get value from cache"""
        if not self.redis:
            return None
        try:
            return await self.redis.get(key)
        except Exception as e:
            logger.warning(f"Cache get failed for key {key}: {e}")
            return None
    
    async def set(self, key: str, value: str, ttl: int = 3600):
        """Set value in cache"""
        if not self.redis:
            return False
        try:
            await self.redis.setex(key, ttl, value)
            return True
        except Exception as e:
            logger.warning(f"Cache set failed for key {key}: {e}")
            return False
    
    async def delete(self, key: str):
        """Delete value from cache"""
        if not self.redis:
            return False
        try:
            await self.redis.delete(key)
            return True
        except Exception as e:
            logger.warning(f"Cache delete failed for key {key}: {e}")
            return False

async def get_cache_manager() -> CacheManager:
    """Get cache manager"""
    redis_client = await get_redis_client()
    return CacheManager(redis_client)

# Rate limiting dependencies
class RateLimiter:
    """Simple rate limiter using Redis"""
    
    def __init__(self, redis_client: redis.Redis = None):
        self.redis = redis_client
    
    async def check_rate_limit(
        self, 
        key: str, 
        limit: int, 
        window: int = 3600
    ) -> tuple[bool, int]:
        """Check if rate limit is exceeded"""
        if not self.redis:
            return True, 0  # Allow if no Redis
        
        try:
            current = await self.redis.get(key)
            if current is None:
                await self.redis.setex(key, window, 1)
                return True, 1
            
            current_count = int(current)
            if current_count >= limit:
                return False, current_count
            
            await self.redis.incr(key)
            return True, current_count + 1
        
        except Exception as e:
            logger.warning(f"Rate limit check failed for key {key}: {e}")
            return True, 0  # Allow on error

async def get_rate_limiter() -> RateLimiter:
    """Get rate limiter"""
    redis_client = await get_redis_client()
    return RateLimiter(redis_client)


# WebSocket Dependencies
_connection_manager = None
_processing_progress_emitter = None
_message_queue = None

async def get_connection_manager() -> "ConnectionManager":
    """Get WebSocket connection manager"""
    global _connection_manager
    if _connection_manager is None:
        from .websocket.manager import ConnectionManager
        from .websocket.queue import MessageQueue
        
        # Initialize message queue
        redis_client = await get_redis_client()
        message_queue = MessageQueue(
            enable_persistence=True,
            redis_client=redis_client
        )
        await message_queue.start()
        
        # Initialize connection manager
        _connection_manager = ConnectionManager(message_queue=message_queue)
        await _connection_manager.start()
        
        logger.info("WebSocket connection manager initialized")
    return _connection_manager

async def get_processing_progress_emitter() -> "ProcessingProgressEmitter":
    """Get processing progress emitter"""
    global _processing_progress_emitter
    if _processing_progress_emitter is None:
        from .websocket.progress import ProcessingProgressEmitter
        
        connection_manager = await get_connection_manager()
        _processing_progress_emitter = ProcessingProgressEmitter(connection_manager)
        
        logger.info("Processing progress emitter initialized")
    return _processing_progress_emitter

async def get_message_queue() -> "MessageQueue":
    """Get message queue"""
    global _message_queue
    if _message_queue is None:
        from .websocket.queue import MessageQueue
        
        redis_client = await get_redis_client()
        _message_queue = MessageQueue(
            enable_persistence=True,
            redis_client=redis_client
        )
        await _message_queue.start()
        
        logger.info("Message queue initialized")
    return _message_queue


# WebSocket Cleanup Functions
async def cleanup_database_pool():
    """Cleanup database connection pool"""
    global _db_pool
    if _db_pool is not None:
        try:
            await _db_pool.close()
            logger.info("Database connection pool closed")
        except Exception as e:
            logger.error(f"Error closing database pool: {e}")
        finally:
            _db_pool = None

async def cleanup_redis_client():
    """Cleanup Redis client"""
    global _redis_client
    if _redis_client is not None:
        try:
            await _redis_client.close()
            logger.info("Redis client closed")
        except Exception as e:
            logger.error(f"Error closing Redis client: {e}")
        finally:
            _redis_client = None

async def cleanup_websocket_resources():
    """Cleanup WebSocket resources"""
    global _connection_manager, _message_queue, _processing_progress_emitter
    
    try:
        if _connection_manager is not None:
            await _connection_manager.stop()
            logger.info("Connection manager stopped")
            _connection_manager = None
            
        if _message_queue is not None:
            await _message_queue.stop()
            logger.info("Message queue stopped")
            _message_queue = None
            
        if _processing_progress_emitter is not None:
            # No specific cleanup needed for progress emitter
            _processing_progress_emitter = None
            
    except Exception as e:
        logger.error(f"Error cleaning up WebSocket resources: {e}") 