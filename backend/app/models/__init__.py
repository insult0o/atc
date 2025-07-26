"""
Pydantic models for the PDF Intelligence Platform API
Defines request/response models and data validation
"""

from .document import (
    Document,
    DocumentCreate,
    DocumentUpdate,
    DocumentResponse,
    DocumentUploadResponse,
    DocumentListResponse
)

from .processing import (
    ProcessingJob,
    ProcessingRequest,
    ProcessingStatus,
    ProcessingResponse,
    ZoneUpdate,
    ZoneResponse
)

from .export import (
    ExportRecord,
    ExportRequest,
    ExportOptions,
    ExportResponse,
    ExportStatus
)

from .base import (
    BaseModel,
    PaginatedResponse,
    ErrorResponse,
    SuccessResponse
)

__all__ = [
    # Document models
    "Document",
    "DocumentCreate", 
    "DocumentUpdate",
    "DocumentResponse",
    "DocumentUploadResponse",
    "DocumentListResponse",
    
    # Processing models
    "ProcessingJob",
    "ProcessingRequest",
    "ProcessingStatus", 
    "ProcessingResponse",
    "ZoneUpdate",
    "ZoneResponse",
    
    # Export models
    "ExportRecord",
    "ExportRequest",
    "ExportOptions",
    "ExportResponse",
    "ExportStatus",
    
    # Base models
    "BaseModel",
    "PaginatedResponse",
    "ErrorResponse",
    "SuccessResponse"
] 