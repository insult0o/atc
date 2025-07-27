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
    Zone,
    ZoneUpdate,
    ZoneResponse,
    ZoneType,
    ZoneStatus,
    ZoneCoordinates
)

from .zone import (
    ZoneCreate,
    ZoneReprocessRequest,
    ZoneSplitRequest,
    ZoneMergeRequest,
    ZoneSplitResponse,
    ZoneMergeResponse,
    ZoneListResponse,
    ZoneBatchUpdateRequest,
    ZoneBatchUpdateResponse
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
    "Zone",
    "ZoneUpdate",
    "ZoneResponse",
    "ZoneType",
    "ZoneStatus",
    "ZoneCoordinates",
    
    # Zone models
    "ZoneCreate",
    "ZoneReprocessRequest",
    "ZoneSplitRequest",
    "ZoneMergeRequest",
    "ZoneSplitResponse",
    "ZoneMergeResponse",
    "ZoneListResponse",
    "ZoneBatchUpdateRequest",
    "ZoneBatchUpdateResponse",
    
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