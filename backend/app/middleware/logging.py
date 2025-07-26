"""
Logging middleware for request tracking and performance monitoring
"""

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
import time
import logging
import json
import uuid
from typing import Dict, Any
from datetime import datetime

logger = logging.getLogger(__name__)

class LoggingMiddleware(BaseHTTPMiddleware):
    """Middleware for structured request/response logging"""
    
    def __init__(self, app, log_requests: bool = True, log_responses: bool = True):
        super().__init__(app)
        self.log_requests = log_requests
        self.log_responses = log_responses
    
    async def dispatch(self, request: Request, call_next):
        # Generate request ID if not present
        request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
        request.state.request_id = request_id
        
        # Start timing
        start_time = time.time()
        
        # Log incoming request
        if self.log_requests:
            await self._log_request(request, request_id)
        
        # Process request
        response = await call_next(request)
        
        # Calculate duration
        process_time = time.time() - start_time
        
        # Log response
        if self.log_responses:
            await self._log_response(request, response, request_id, process_time)
        
        # Add headers
        response.headers["X-Request-ID"] = request_id
        response.headers["X-Process-Time"] = str(process_time)
        
        return response
    
    async def _log_request(self, request: Request, request_id: str):
        """Log incoming request details"""
        try:
            # Extract basic request info
            log_data = {
                "event": "request_received",
                "request_id": request_id,
                "timestamp": datetime.utcnow().isoformat(),
                "method": request.method,
                "url": str(request.url),
                "path": request.url.path,
                "query_params": dict(request.query_params),
                "headers": await self._safe_headers(request),
                "client": {
                    "host": request.client.host if request.client else None,
                    "port": request.client.port if request.client else None
                },
                "user_agent": request.headers.get("user-agent"),
                "content_type": request.headers.get("content-type"),
                "content_length": request.headers.get("content-length")
            }
            
            # Log request body for non-file uploads (security consideration)
            if (request.method in ["POST", "PUT", "PATCH"] and 
                request.headers.get("content-type", "").startswith("application/json")):
                try:
                    body = await request.body()
                    if body:
                        # Limit body size for logging
                        if len(body) < 1000:
                            log_data["body"] = body.decode("utf-8")
                        else:
                            log_data["body"] = f"<body too large: {len(body)} bytes>"
                except Exception:
                    log_data["body"] = "<unable to read body>"
            
            logger.info("Request received", extra=log_data)
            
        except Exception as e:
            logger.error(f"Error logging request: {e}", extra={"request_id": request_id})
    
    async def _log_response(
        self, 
        request: Request, 
        response, 
        request_id: str, 
        process_time: float
    ):
        """Log response details"""
        try:
            log_data = {
                "event": "request_completed",
                "request_id": request_id,
                "timestamp": datetime.utcnow().isoformat(),
                "method": request.method,
                "path": request.url.path,
                "status_code": response.status_code,
                "process_time": round(process_time, 4),
                "response_headers": dict(response.headers),
                "performance": self._get_performance_metrics(process_time, response.status_code)
            }
            
            # Determine log level based on status code
            if response.status_code >= 500:
                logger.error("Request completed with server error", extra=log_data)
            elif response.status_code >= 400:
                logger.warning("Request completed with client error", extra=log_data)
            elif process_time > 5.0:  # Slow requests
                logger.warning("Slow request completed", extra=log_data)
            else:
                logger.info("Request completed successfully", extra=log_data)
            
        except Exception as e:
            logger.error(f"Error logging response: {e}", extra={"request_id": request_id})
    
    async def _safe_headers(self, request: Request) -> Dict[str, str]:
        """Extract headers while filtering sensitive information"""
        headers = dict(request.headers)
        
        # Remove sensitive headers
        sensitive_headers = {
            "authorization", "cookie", "x-api-key", "x-auth-token",
            "x-secret-key", "x-access-token", "authentication"
        }
        
        filtered_headers = {}
        for key, value in headers.items():
            if key.lower() in sensitive_headers:
                filtered_headers[key] = "<redacted>"
            else:
                filtered_headers[key] = value
        
        return filtered_headers
    
    def _get_performance_metrics(self, process_time: float, status_code: int) -> Dict[str, Any]:
        """Generate performance metrics"""
        return {
            "duration_ms": round(process_time * 1000, 2),
            "duration_category": self._categorize_duration(process_time),
            "status_category": self._categorize_status(status_code),
            "is_slow": process_time > 1.0,
            "is_error": status_code >= 400
        }
    
    def _categorize_duration(self, duration: float) -> str:
        """Categorize request duration"""
        if duration < 0.1:
            return "fast"
        elif duration < 0.5:
            return "normal"
        elif duration < 1.0:
            return "slow"
        elif duration < 5.0:
            return "very_slow"
        else:
            return "extremely_slow"
    
    def _categorize_status(self, status_code: int) -> str:
        """Categorize HTTP status code"""
        if 200 <= status_code < 300:
            return "success"
        elif 300 <= status_code < 400:
            return "redirect"
        elif 400 <= status_code < 500:
            return "client_error"
        elif 500 <= status_code < 600:
            return "server_error"
        else:
            return "unknown"

# Structured logger configuration
def configure_logging(log_level: str = "INFO", log_format: str = "json"):
    """Configure structured logging"""
    
    # Create custom formatter
    if log_format.lower() == "json":
        formatter = JsonFormatter()
    else:
        formatter = logging.Formatter(
            '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )
    
    # Configure root logger
    logging.basicConfig(
        level=getattr(logging, log_level.upper()),
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        handlers=[
            logging.StreamHandler()
        ]
    )
    
    # Get logger and set formatter
    logger = logging.getLogger()
    for handler in logger.handlers:
        handler.setFormatter(formatter)

class JsonFormatter(logging.Formatter):
    """JSON formatter for structured logging"""
    
    def format(self, record):
        log_entry = {
            "timestamp": datetime.utcnow().isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno
        }
        
        # Add extra fields if present
        if hasattr(record, '__dict__'):
            for key, value in record.__dict__.items():
                if key not in ['name', 'msg', 'args', 'levelname', 'levelno', 'pathname', 
                              'filename', 'module', 'lineno', 'funcName', 'created', 
                              'msecs', 'relativeCreated', 'thread', 'threadName', 
                              'processName', 'process', 'getMessage']:
                    log_entry[key] = value
        
        return json.dumps(log_entry)

# Request context logger
class RequestContextLogger:
    """Logger that includes request context in all log messages"""
    
    def __init__(self, request: Request):
        self.request = request
        self.logger = logging.getLogger(__name__)
        self.request_id = getattr(request.state, 'request_id', None)
    
    def _add_context(self, extra: Dict[str, Any] = None) -> Dict[str, Any]:
        """Add request context to log extra"""
        context = {
            "request_id": self.request_id,
            "path": self.request.url.path,
            "method": self.request.method
        }
        
        if extra:
            context.update(extra)
        
        return context
    
    def debug(self, message: str, extra: Dict[str, Any] = None):
        self.logger.debug(message, extra=self._add_context(extra))
    
    def info(self, message: str, extra: Dict[str, Any] = None):
        self.logger.info(message, extra=self._add_context(extra))
    
    def warning(self, message: str, extra: Dict[str, Any] = None):
        self.logger.warning(message, extra=self._add_context(extra))
    
    def error(self, message: str, extra: Dict[str, Any] = None):
        self.logger.error(message, extra=self._add_context(extra))
    
    def critical(self, message: str, extra: Dict[str, Any] = None):
        self.logger.critical(message, extra=self._add_context(extra)) 