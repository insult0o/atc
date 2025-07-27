"""
Export-related Pydantic models
"""

from pydantic import Field, validator
from typing import Optional, Dict, Any, List, Union
from datetime import datetime
from enum import Enum
from uuid import UUID

from .base import BaseModel, UUIDMixin, TimestampMixin

class ExportFormat(str, Enum):
    """Supported export formats"""
    JSON = "json"
    JSONL = "jsonl"
    CSV = "csv"
    TXT = "txt"
    MD = "markdown"
    DOCX = "docx"
    PDF = "pdf"
    XML = "xml"

class ExportType(str, Enum):
    """Export type options"""
    FULL = "full"
    PARTIAL = "partial"
    ZONES_ONLY = "zones_only"
    TEXT_ONLY = "text_only"
    METADATA_ONLY = "metadata_only"

class ExportStatus(str, Enum):
    """Export job status"""
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"

class ValidationLevel(str, Enum):
    """Export validation levels"""
    NONE = "none"
    BASIC = "basic"
    STRICT = "strict"
    COMPREHENSIVE = "comprehensive"

class ExportSelection(BaseModel):
    """Selection criteria for partial exports"""
    zone_ids: Optional[List[UUID]] = Field(None, description="Specific zones to export")
    zone_types: Optional[List[str]] = Field(None, description="Zone types to include")
    page_ranges: Optional[List[tuple[int, int]]] = Field(None, description="Page ranges to export")
    confidence_threshold: Optional[float] = Field(None, ge=0.0, le=1.0, description="Minimum confidence")
    include_metadata: bool = Field(default=True, description="Include zone metadata")
    include_coordinates: bool = Field(default=True, description="Include zone coordinates")

class ExportOptions(BaseModel):
    """Export configuration options"""
    include_confidence: bool = Field(default=True, description="Include confidence scores")
    include_timestamps: bool = Field(default=True, description="Include timestamps")
    include_processing_info: bool = Field(default=False, description="Include processing details")
    merge_text_zones: bool = Field(default=False, description="Merge adjacent text zones")
    preserve_formatting: bool = Field(default=True, description="Preserve text formatting")
    normalize_whitespace: bool = Field(default=False, description="Normalize whitespace")
    custom_headers: Dict[str, str] = Field(default_factory=dict, description="Custom headers for CSV")
    compression: bool = Field(default=False, description="Compress output files")
    password_protection: Optional[str] = Field(None, description="Password for protected formats")

class ExportRequest(BaseModel):
    """Request to start an export operation"""
    document_id: UUID = Field(..., description="Document to export")
    export_type: ExportType = Field(..., description="Type of export")
    formats: List[ExportFormat] = Field(..., min_items=1, description="Output formats")
    selection: Optional[ExportSelection] = Field(None, description="Selection criteria")
    options: ExportOptions = Field(default_factory=ExportOptions, description="Export options")
    validation_level: ValidationLevel = Field(default=ValidationLevel.BASIC, description="Validation level")
    notify_on_completion: bool = Field(default=True, description="Send notification when complete")
    
    @validator('formats')
    def validate_formats(cls, v):
        if len(v) != len(set(v)):
            raise ValueError('Duplicate formats are not allowed')
        return v

class ValidationResult(BaseModel):
    """Export validation result"""
    is_valid: bool = Field(..., description="Whether export is valid")
    errors: List[str] = Field(default_factory=list, description="Validation errors")
    warnings: List[str] = Field(default_factory=list, description="Validation warnings")
    suggestions: List[str] = Field(default_factory=list, description="Improvement suggestions")
    score: float = Field(..., ge=0.0, le=100.0, description="Quality score")

class ExportFile(BaseModel):
    """Export file information"""
    format: ExportFormat = Field(..., description="File format")
    filename: str = Field(..., description="Generated filename")
    file_path: str = Field(..., description="Storage path")
    file_size_bytes: int = Field(..., description="File size")
    file_size_human: str = Field(..., description="Human-readable size")
    download_url: Optional[str] = Field(None, description="Download URL")
    checksum: str = Field(..., description="File checksum")
    compressed: bool = Field(default=False, description="Whether file is compressed")

class ExportRecord(BaseModel, UUIDMixin, TimestampMixin):
    """Complete export record"""
    document_id: UUID = Field(..., description="Source document ID")
    export_type: ExportType = Field(..., description="Export type")
    formats: List[ExportFormat] = Field(..., description="Requested formats")
    status: ExportStatus = Field(default=ExportStatus.PENDING, description="Export status")
    started_at: Optional[datetime] = Field(None, description="Export start time")
    completed_at: Optional[datetime] = Field(None, description="Export completion time")
    file_paths: Dict[str, str] = Field(default_factory=dict, description="Generated file paths")
    file_sizes: Dict[str, int] = Field(default_factory=dict, description="File sizes by format")
    validation_results: Optional[ValidationResult] = Field(None, description="Validation results")
    selection: Optional[ExportSelection] = Field(None, description="Selection criteria used")
    options: ExportOptions = Field(default_factory=ExportOptions, description="Export options used")
    error_message: Optional[str] = Field(None, description="Error message if failed")
    created_by: Optional[str] = Field(None, description="User who created export")
    download_count: int = Field(default=0, description="Number of downloads")
    expires_at: Optional[datetime] = Field(None, description="Expiration time")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Additional metadata")

class ExportResponse(ExportRecord):
    """Export response with additional computed fields"""
    duration: Optional[float] = Field(None, description="Export duration in seconds")
    total_file_size: int = Field(..., description="Total size of all files")
    total_file_size_human: str = Field(..., description="Human-readable total size")
    files: List[ExportFile] = Field(default_factory=list, description="Generated files")
    is_expired: bool = Field(..., description="Whether export has expired")
    
    @validator('duration', always=True)
    def compute_duration(cls, v, values):
        started = values.get('started_at')
        completed = values.get('completed_at')
        if started and completed:
            return (completed - started).total_seconds()
        return None
    
    @validator('total_file_size', always=True)
    def compute_total_file_size(cls, v, values):
        file_sizes = values.get('file_sizes', {})
        return sum(file_sizes.values())
    
    @validator('total_file_size_human', always=True)
    def compute_total_file_size_human(cls, v, values):
        total_size = values.get('total_file_size', 0)
        for unit in ['B', 'KB', 'MB', 'GB']:
            if total_size < 1024:
                return f"{total_size:.1f} {unit}"
            total_size /= 1024
        return f"{total_size:.1f} TB"
    
    @validator('is_expired', always=True)
    def compute_is_expired(cls, v, values):
        expires_at = values.get('expires_at')
        if expires_at:
            return datetime.utcnow() > expires_at
        return False

class ExportStatsResponse(BaseModel):
    """Export statistics response"""
    total_exports: int = Field(..., description="Total exports created")
    completed_exports: int = Field(..., description="Successfully completed exports")
    failed_exports: int = Field(..., description="Failed exports")
    active_exports: int = Field(..., description="Currently processing exports")
    total_file_size: int = Field(..., description="Total size of all exports")
    total_file_size_human: str = Field(..., description="Human-readable total size")
    average_export_time: Optional[float] = Field(None, description="Average export time")
    exports_by_format: Dict[str, int] = Field(..., description="Exports by format")
    exports_by_type: Dict[str, int] = Field(..., description="Exports by type")
    exports_today: int = Field(..., description="Exports created today")
    exports_this_week: int = Field(..., description="Exports created this week")
    exports_this_month: int = Field(..., description="Exports created this month")
    total_downloads: int = Field(..., description="Total download count")

class BulkExportRequest(BaseModel):
    """Request for bulk export operations"""
    document_ids: List[UUID] = Field(..., min_items=1, description="Documents to export")
    export_type: ExportType = Field(..., description="Export type for all documents")
    formats: List[ExportFormat] = Field(..., min_items=1, description="Output formats")
    options: ExportOptions = Field(default_factory=ExportOptions, description="Export options")
    combine_files: bool = Field(default=False, description="Combine into single archive")
    validation_level: ValidationLevel = Field(default=ValidationLevel.BASIC, description="Validation level")
    
    @validator('document_ids')
    def validate_document_ids(cls, v):
        if len(v) > 100:
            raise ValueError('Cannot export more than 100 documents at once')
        if len(v) != len(set(v)):
            raise ValueError('Duplicate document IDs are not allowed')
        return v 