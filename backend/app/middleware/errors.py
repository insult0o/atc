"""
Error handling middleware and custom exceptions
"""

from fastapi import Request, HTTPException, status
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from pydantic import ValidationError
import logging
import traceback
from typing import Union
from datetime import datetime

from app.models.base import ErrorResponse, ValidationErrorResponse, ValidationErrorDetail

logger = logging.getLogger(__name__)

class APIError(HTTPException):
    """Base API error with structured response"""
    
    def __init__(
        self, 
        status_code: int, 
        error_code: str, 
        message: str, 
        details: dict = None,
        headers: dict = None
    ):
        self.error_code = error_code
        self.message = message
        self.details = details or {}
        super().__init__(status_code=status_code, detail=message, headers=headers)

class DocumentNotFoundError(APIError):
    """Document not found error"""
    def __init__(self, document_id: str):
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            error_code="DOCUMENT_NOT_FOUND",
            message=f"Document with ID '{document_id}' not found",
            details={"document_id": document_id}
        )

class ProcessingJobNotFoundError(APIError):
    """Processing job not found error"""
    def __init__(self, job_id: str):
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            error_code="PROCESSING_JOB_NOT_FOUND",
            message=f"Processing job with ID '{job_id}' not found",
            details={"job_id": job_id}
        )

class ExportNotFoundError(APIError):
    """Export not found error"""
    def __init__(self, export_id: str):
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            error_code="EXPORT_NOT_FOUND",
            message=f"Export with ID '{export_id}' not found",
            details={"export_id": export_id}
        )

class ZoneNotFoundError(APIError):
    """Zone not found error"""
    def __init__(self, zone_id: str):
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            error_code="ZONE_NOT_FOUND",
            message=f"Zone with ID '{zone_id}' not found",
            details={"zone_id": zone_id}
        )

class InvalidFileTypeError(APIError):
    """Invalid file type error"""
    def __init__(self, file_type: str, allowed_types: list):
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            error_code="INVALID_FILE_TYPE",
            message=f"File type '{file_type}' is not supported",
            details={
                "file_type": file_type,
                "allowed_types": allowed_types
            }
        )

class FileSizeExceededError(APIError):
    """File size exceeded error"""
    def __init__(self, file_size: int, max_size: int):
        super().__init__(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            error_code="FILE_SIZE_EXCEEDED",
            message=f"File size {file_size} bytes exceeds maximum allowed size {max_size} bytes",
            details={
                "file_size": file_size,
                "max_size": max_size
            }
        )

class ProcessingInProgressError(APIError):
    """Processing already in progress error"""
    def __init__(self, document_id: str):
        super().__init__(
            status_code=status.HTTP_409_CONFLICT,
            error_code="PROCESSING_IN_PROGRESS",
            message=f"Document '{document_id}' is already being processed",
            details={"document_id": document_id}
        )

class ProcessingCapacityExceededError(APIError):
    """Processing capacity exceeded error"""
    def __init__(self, current_jobs: int, max_jobs: int):
        super().__init__(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            error_code="PROCESSING_CAPACITY_EXCEEDED",
            message=f"Processing capacity exceeded. Current jobs: {current_jobs}, Max: {max_jobs}",
            details={
                "current_jobs": current_jobs,
                "max_jobs": max_jobs
            }
        )

class DatabaseConnectionError(APIError):
    """Database connection error"""
    def __init__(self, details: str = None):
        super().__init__(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            error_code="DATABASE_CONNECTION_ERROR",
            message="Database connection failed",
            details={"details": details} if details else {}
        )

class StorageError(APIError):
    """Storage operation error"""
    def __init__(self, operation: str, details: str = None):
        super().__init__(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            error_code="STORAGE_ERROR",
            message=f"Storage operation '{operation}' failed",
            details={"operation": operation, "details": details}
        )

class ErrorHandlerMiddleware(BaseHTTPMiddleware):
    """Middleware to handle exceptions and return structured error responses"""
    
    async def dispatch(self, request: Request, call_next):
        try:
            response = await call_next(request)
            return response
        
        except APIError as exc:
            return await self._handle_api_error(request, exc)
        
        except ValidationError as exc:
            return await self._handle_validation_error(request, exc)
        
        except HTTPException as exc:
            return await self._handle_http_exception(request, exc)
        
        except Exception as exc:
            return await self._handle_unexpected_error(request, exc)
    
    async def _handle_api_error(self, request: Request, exc: APIError) -> JSONResponse:
        """Handle custom API errors"""
        request_id = getattr(request.state, 'request_id', None)
        
        error_response = ErrorResponse(
            error_code=exc.error_code,
            message=exc.message,
            details=exc.details,
            request_id=request_id,
            timestamp=datetime.utcnow()
        )
        
        # Log error
        logger.error(
            f"API Error: {exc.error_code} - {exc.message}",
            extra={
                "request_id": request_id,
                "error_code": exc.error_code,
                "details": exc.details,
                "status_code": exc.status_code,
                "path": request.url.path,
                "method": request.method
            }
        )
        
        return JSONResponse(
            status_code=exc.status_code,
            content=error_response.model_dump(mode='json'),
            headers=exc.headers
        )
    
    async def _handle_validation_error(self, request: Request, exc: ValidationError) -> JSONResponse:
        """Handle Pydantic validation errors"""
        request_id = getattr(request.state, 'request_id', None)
        
        # Convert Pydantic errors to our format
        validation_errors = []
        for error in exc.errors():
            field = " -> ".join(str(loc) for loc in error["loc"])
            validation_errors.append(
                ValidationErrorDetail(
                    field=field,
                    message=error["msg"],
                    value=error.get("input")
                )
            )
        
        error_response = ValidationErrorResponse(
            error_code="VALIDATION_ERROR",
            message="Request validation failed",
            details={"error_count": len(validation_errors)},
            request_id=request_id,
            timestamp=datetime.utcnow(),
            validation_errors=validation_errors
        )
        
        # Log validation error
        logger.warning(
            f"Validation Error: {len(validation_errors)} field(s) failed validation",
            extra={
                "request_id": request_id,
                "validation_errors": [str(e) for e in validation_errors],
                "path": request.url.path,
                "method": request.method
            }
        )
        
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content=error_response.model_dump(mode='json')
        )
    
    async def _handle_http_exception(self, request: Request, exc: HTTPException) -> JSONResponse:
        """Handle FastAPI HTTP exceptions"""
        request_id = getattr(request.state, 'request_id', None)
        
        # Map HTTP status codes to error codes
        error_code_map = {
            400: "BAD_REQUEST",
            401: "UNAUTHORIZED",
            403: "FORBIDDEN",
            404: "NOT_FOUND",
            405: "METHOD_NOT_ALLOWED",
            409: "CONFLICT",
            413: "PAYLOAD_TOO_LARGE",
            422: "UNPROCESSABLE_ENTITY",
            429: "TOO_MANY_REQUESTS",
            500: "INTERNAL_SERVER_ERROR",
            502: "BAD_GATEWAY",
            503: "SERVICE_UNAVAILABLE",
            504: "GATEWAY_TIMEOUT"
        }
        
        error_code = error_code_map.get(exc.status_code, "HTTP_ERROR")
        
        error_response = ErrorResponse(
            error_code=error_code,
            message=str(exc.detail),
            details={"status_code": exc.status_code},
            request_id=request_id,
            timestamp=datetime.utcnow()
        )
        
        # Log HTTP error
        logger.warning(
            f"HTTP Error: {exc.status_code} - {exc.detail}",
            extra={
                "request_id": request_id,
                "status_code": exc.status_code,
                "path": request.url.path,
                "method": request.method
            }
        )
        
        return JSONResponse(
            status_code=exc.status_code,
            content=error_response.model_dump(mode='json'),
            headers=exc.headers
        )
    
    async def _handle_unexpected_error(self, request: Request, exc: Exception) -> JSONResponse:
        """Handle unexpected errors"""
        request_id = getattr(request.state, 'request_id', None)
        
        error_response = ErrorResponse(
            error_code="INTERNAL_SERVER_ERROR",
            message="An unexpected error occurred",
            details={
                "error_type": type(exc).__name__,
                "error_message": str(exc) if not isinstance(exc, Exception) else "Internal server error"
            },
            request_id=request_id,
            timestamp=datetime.utcnow()
        )
        
        # Log unexpected error with full traceback
        logger.error(
            f"Unexpected Error: {type(exc).__name__} - {str(exc)}",
            extra={
                "request_id": request_id,
                "path": request.url.path,
                "method": request.method,
                "traceback": traceback.format_exc()
            }
        )
        
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=error_response.model_dump(mode='json')
        ) 