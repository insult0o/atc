"""
Document-related Pydantic models
"""

from pydantic import Field, validator
from typing import Optional, Dict, Any, List
from datetime import datetime
from enum import Enum
from uuid import UUID

from .base import BaseModel, UUIDMixin, TimestampMixin

class DocumentStatus(str, Enum):
    """Document processing status"""
    UPLOADED = "uploaded"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"

class DocumentCreate(BaseModel):
    """Model for creating a new document"""
    filename: str = Field(..., min_length=1, max_length=255, description="Document filename")
    original_filename: str = Field(..., min_length=1, max_length=255, description="Original filename")
    file_size_bytes: int = Field(..., gt=0, description="File size in bytes")
    mime_type: str = Field(..., description="MIME type of the file")
    storage_path: Optional[str] = Field(None, description="Storage path for the file")
    uploaded_by: Optional[str] = Field(None, description="User who uploaded the document")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Additional metadata")
    
    @validator('mime_type')
    def validate_mime_type(cls, v):
        allowed_types = ['application/pdf']
        if v not in allowed_types:
            raise ValueError(f'MIME type must be one of {allowed_types}')
        return v
    
    @validator('file_size_bytes')
    def validate_file_size(cls, v):
        max_size = 100 * 1024 * 1024  # 100MB
        if v > max_size:
            raise ValueError(f'File size cannot exceed {max_size} bytes')
        return v

class DocumentUpdate(BaseModel):
    """Model for updating document information"""
    filename: Optional[str] = Field(None, min_length=1, max_length=255)
    status: Optional[DocumentStatus] = Field(None)
    metadata: Optional[Dict[str, Any]] = Field(None)

class Document(BaseModel, UUIDMixin, TimestampMixin):
    """Complete document model"""
    filename: str = Field(..., description="Document filename")
    original_filename: str = Field(..., description="Original filename")
    file_size_bytes: int = Field(..., description="File size in bytes")
    page_count: Optional[int] = Field(None, description="Number of pages")
    mime_type: str = Field(..., description="MIME type")
    storage_path: Optional[str] = Field(None, description="Storage path")
    status: DocumentStatus = Field(default=DocumentStatus.UPLOADED, description="Processing status")
    uploaded_by: Optional[str] = Field(None, description="User who uploaded")
    processing_started_at: Optional[datetime] = Field(None, description="Processing start time")
    processing_completed_at: Optional[datetime] = Field(None, description="Processing completion time")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Additional metadata")

class DocumentResponse(Document):
    """Document response with additional computed fields"""
    processing_duration: Optional[float] = Field(None, description="Processing duration in seconds")
    file_size_human: str = Field(..., description="Human-readable file size")
    zones_count: Optional[int] = Field(None, description="Number of detected zones")
    
    @validator('file_size_human', always=True)
    def compute_file_size_human(cls, v, values):
        size_bytes = values.get('file_size_bytes', 0)
        for unit in ['B', 'KB', 'MB', 'GB']:
            if size_bytes < 1024:
                return f"{size_bytes:.1f} {unit}"
            size_bytes /= 1024
        return f"{size_bytes:.1f} TB"
    
    @validator('processing_duration', always=True)
    def compute_processing_duration(cls, v, values):
        started = values.get('processing_started_at')
        completed = values.get('processing_completed_at')
        if started and completed:
            return (completed - started).total_seconds()
        return None

class DocumentUploadResponse(BaseModel):
    """Response after successful document upload"""
    document_id: UUID = Field(..., description="Unique document identifier")
    filename: str = Field(..., description="Document filename")
    file_size_bytes: int = Field(..., description="File size in bytes")
    file_size_human: str = Field(..., description="Human-readable file size")
    page_count: Optional[int] = Field(None, description="Number of pages")
    upload_timestamp: datetime = Field(..., description="Upload timestamp")
    status: DocumentStatus = Field(..., description="Document status")
    storage_url: Optional[str] = Field(None, description="Storage URL for access")
    demo_mode: Optional[bool] = Field(False, description="Whether this is a demo mode response")
    error: Optional[str] = Field(None, description="Error message if any")

class DocumentListResponse(BaseModel):
    """Response for document list queries"""
    documents: List[DocumentResponse] = Field(..., description="List of documents")
    total: int = Field(..., description="Total number of documents")
    page: int = Field(..., description="Current page")
    size: int = Field(..., description="Page size")
    total_pages: int = Field(..., description="Total number of pages")

class DocumentStatsResponse(BaseModel):
    """Document statistics response"""
    total_documents: int = Field(..., description="Total number of documents")
    total_size_bytes: int = Field(..., description="Total size in bytes")
    total_size_human: str = Field(..., description="Human-readable total size")
    documents_by_status: Dict[str, int] = Field(..., description="Document count by status")
    average_processing_time: Optional[float] = Field(None, description="Average processing time")
    documents_today: int = Field(..., description="Documents uploaded today")
    documents_this_week: int = Field(..., description="Documents uploaded this week")
    documents_this_month: int = Field(..., description="Documents uploaded this month") 