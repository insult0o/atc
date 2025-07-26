"""
Base Pydantic models for common structures and responses
"""

from pydantic import BaseModel as PydanticBaseModel, Field, ConfigDict
from typing import Any, Dict, List, Optional, Generic, TypeVar
from datetime import datetime
from uuid import UUID

T = TypeVar('T')

class BaseModel(PydanticBaseModel):
    """Base model with common configuration"""
    model_config = ConfigDict(
        from_attributes=True,
        use_enum_values=True,
        validate_assignment=True,
        arbitrary_types_allowed=True
    )

class TimestampMixin(BaseModel):
    """Mixin for models with timestamp fields"""
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class UUIDMixin(BaseModel):
    """Mixin for models with UUID primary keys"""
    id: UUID = Field(..., description="Unique identifier")

class PaginatedResponse(BaseModel, Generic[T]):
    """Generic paginated response"""
    items: List[T] = Field(..., description="List of items")
    total: int = Field(..., description="Total number of items")
    page: int = Field(..., description="Current page number")
    size: int = Field(..., description="Items per page")
    pages: int = Field(..., description="Total number of pages")
    has_next: bool = Field(..., description="Whether there's a next page")
    has_prev: bool = Field(..., description="Whether there's a previous page")

class ErrorResponse(BaseModel):
    """Standard error response"""
    error_code: str = Field(..., description="Error code")
    message: str = Field(..., description="Human-readable error message")
    details: Optional[Dict[str, Any]] = Field(None, description="Additional error details")
    request_id: Optional[str] = Field(None, description="Request ID for tracking")
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class SuccessResponse(BaseModel):
    """Standard success response"""
    message: str = Field(..., description="Success message")
    data: Optional[Dict[str, Any]] = Field(None, description="Response data")
    request_id: Optional[str] = Field(None, description="Request ID for tracking")
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class StatusResponse(BaseModel):
    """Status response for long-running operations"""
    status: str = Field(..., description="Operation status")
    progress: float = Field(0.0, ge=0.0, le=100.0, description="Progress percentage")
    message: Optional[str] = Field(None, description="Status message")
    estimated_completion: Optional[datetime] = Field(None, description="Estimated completion time")
    metadata: Optional[Dict[str, Any]] = Field(None, description="Additional metadata")

class ValidationErrorDetail(BaseModel):
    """Validation error detail"""
    field: str = Field(..., description="Field name")
    message: str = Field(..., description="Error message")
    value: Any = Field(None, description="Invalid value")

class ValidationErrorResponse(ErrorResponse):
    """Validation error response with field details"""
    validation_errors: List[ValidationErrorDetail] = Field(
        ..., 
        description="List of validation errors"
    ) 