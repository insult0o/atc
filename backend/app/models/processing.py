"""
Processing-related Pydantic models
"""

from pydantic import Field, validator
from typing import Optional, Dict, Any, List
from datetime import datetime
from enum import Enum
from uuid import UUID

from .base import BaseModel, UUIDMixin, TimestampMixin

class ProcessingStatus(str, Enum):
    """Processing job status"""
    QUEUED = "queued"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"
    PAUSED = "paused"

class ProcessingStrategy(str, Enum):
    """Processing strategy options"""
    AUTO = "auto"
    FAST = "fast"
    ACCURATE = "accurate" 
    BALANCED = "balanced"

class ZoneType(str, Enum):
    """Zone content types"""
    TEXT = "text"
    TABLE = "table"
    IMAGE = "image"
    DIAGRAM = "diagram"
    HEADER = "header"
    FOOTER = "footer"
    UNKNOWN = "unknown"

class ZoneStatus(str, Enum):
    """Zone processing status"""
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    SKIPPED = "skipped"

class ProcessingRequest(BaseModel):
    """Request to start processing a document"""
    strategy: ProcessingStrategy = Field(default=ProcessingStrategy.AUTO, description="Processing strategy")
    tools: Optional[List[str]] = Field(None, description="Specific tools to use")
    zones_only: Optional[List[int]] = Field(None, description="Process only specific zones")
    options: Dict[str, Any] = Field(default_factory=dict, description="Additional processing options")
    priority: int = Field(default=5, ge=1, le=10, description="Processing priority (1-10)")
    
    @validator('tools')
    def validate_tools(cls, v):
        if v is not None:
            allowed_tools = ['unstructured', 'layoutlm', 'paddle', 'tesseract', 'textract']
            invalid_tools = [tool for tool in v if tool not in allowed_tools]
            if invalid_tools:
                raise ValueError(f'Invalid tools: {invalid_tools}. Allowed: {allowed_tools}')
        return v

class ZoneCoordinates(BaseModel):
    """Zone coordinates on a page"""
    x: float = Field(..., ge=0, description="X coordinate")
    y: float = Field(..., ge=0, description="Y coordinate") 
    width: float = Field(..., gt=0, description="Width")
    height: float = Field(..., gt=0, description="Height")
    page_width: float = Field(..., gt=0, description="Page width")
    page_height: float = Field(..., gt=0, description="Page height")

class ZoneUpdate(BaseModel):
    """Model for updating zone information"""
    zone_type: Optional[ZoneType] = Field(None, description="Zone content type")
    content: Optional[str] = Field(None, description="Extracted content")
    confidence: Optional[float] = Field(None, ge=0.0, le=1.0, description="Confidence score")
    processing_tool: Optional[str] = Field(None, description="Tool used for processing")
    status: Optional[ZoneStatus] = Field(None, description="Zone status")
    coordinates: Optional[ZoneCoordinates] = Field(None, description="Zone coordinates")
    metadata: Optional[Dict[str, Any]] = Field(None, description="Additional metadata")

class Zone(BaseModel, UUIDMixin, TimestampMixin):
    """Complete zone model"""
    document_id: UUID = Field(..., description="Parent document ID")
    zone_index: int = Field(..., ge=0, description="Zone index within document")
    page_number: int = Field(..., ge=1, description="Page number")
    zone_type: ZoneType = Field(default=ZoneType.UNKNOWN, description="Content type")
    coordinates: ZoneCoordinates = Field(..., description="Zone coordinates")
    content: Optional[str] = Field(None, description="Extracted content")
    confidence: Optional[float] = Field(None, ge=0.0, le=1.0, description="Confidence score")
    processing_tool: Optional[str] = Field(None, description="Tool used")
    status: ZoneStatus = Field(default=ZoneStatus.PENDING, description="Processing status")
    error_message: Optional[str] = Field(None, description="Error message if failed")
    processing_duration: Optional[float] = Field(None, description="Processing time in seconds")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Additional metadata")

class ZoneResponse(Zone):
    """Zone response with additional computed fields"""
    content_preview: str = Field(..., description="Preview of content")
    word_count: Optional[int] = Field(None, description="Number of words")
    character_count: Optional[int] = Field(None, description="Number of characters")
    
    @validator('content_preview', always=True)
    def compute_content_preview(cls, v, values):
        content = values.get('content', '')
        if content:
            return content[:100] + ('...' if len(content) > 100 else '')
        return 'No content extracted'
    
    @validator('word_count', always=True)
    def compute_word_count(cls, v, values):
        content = values.get('content', '')
        if content:
            return len(content.split())
        return 0
    
    @validator('character_count', always=True)
    def compute_character_count(cls, v, values):
        content = values.get('content', '')
        return len(content)

class ProcessingJob(BaseModel, UUIDMixin, TimestampMixin):
    """Processing job model"""
    document_id: UUID = Field(..., description="Document being processed")
    status: ProcessingStatus = Field(default=ProcessingStatus.QUEUED, description="Job status")
    strategy: ProcessingStrategy = Field(..., description="Processing strategy")
    started_at: Optional[datetime] = Field(None, description="Processing start time")
    completed_at: Optional[datetime] = Field(None, description="Processing completion time")
    progress: float = Field(default=0.0, ge=0.0, le=100.0, description="Progress percentage")
    current_zone_id: Optional[UUID] = Field(None, description="Currently processing zone")
    total_zones: int = Field(default=0, ge=0, description="Total zones to process")
    completed_zones: int = Field(default=0, ge=0, description="Zones completed")
    failed_zones: int = Field(default=0, ge=0, description="Zones that failed")
    error_count: int = Field(default=0, ge=0, description="Total errors encountered")
    error_message: Optional[str] = Field(None, description="Latest error message")
    estimated_completion: Optional[datetime] = Field(None, description="Estimated completion time")
    options: Dict[str, Any] = Field(default_factory=dict, description="Processing options")
    metrics: Dict[str, Any] = Field(default_factory=dict, description="Processing metrics")

class ProcessingResponse(ProcessingJob):
    """Processing job response with additional computed fields"""
    duration: Optional[float] = Field(None, description="Total processing duration")
    zones_per_minute: Optional[float] = Field(None, description="Processing rate")
    success_rate: float = Field(..., description="Success rate percentage")
    
    @validator('duration', always=True)
    def compute_duration(cls, v, values):
        started = values.get('started_at')
        completed = values.get('completed_at')
        if started and completed:
            return (completed - started).total_seconds()
        elif started:
            return (datetime.utcnow() - started).total_seconds()
        return None
    
    @validator('zones_per_minute', always=True)
    def compute_zones_per_minute(cls, v, values):
        duration = values.get('duration')
        completed_zones = values.get('completed_zones', 0)
        if duration and duration > 0 and completed_zones > 0:
            return (completed_zones / duration) * 60
        return None
    
    @validator('success_rate', always=True)
    def compute_success_rate(cls, v, values):
        total_zones = values.get('total_zones', 0)
        failed_zones = values.get('failed_zones', 0)
        if total_zones > 0:
            return ((total_zones - failed_zones) / total_zones) * 100
        return 100.0

class ProcessingStatsResponse(BaseModel):
    """Processing statistics response"""
    total_jobs: int = Field(..., description="Total processing jobs")
    active_jobs: int = Field(..., description="Currently active jobs")
    completed_jobs: int = Field(..., description="Completed jobs")
    failed_jobs: int = Field(..., description="Failed jobs")
    average_processing_time: Optional[float] = Field(None, description="Average processing time")
    total_zones_processed: int = Field(..., description="Total zones processed")
    average_zones_per_job: Optional[float] = Field(None, description="Average zones per job")
    success_rate: float = Field(..., description="Overall success rate")
    jobs_today: int = Field(..., description="Jobs processed today")
    jobs_this_week: int = Field(..., description="Jobs processed this week")
    jobs_this_month: int = Field(..., description="Jobs processed this month")
    
class ProcessingHistory(BaseModel, UUIDMixin, TimestampMixin):
    """Processing history entry"""
    job_id: UUID = Field(..., description="Processing job ID")
    zone_id: Optional[UUID] = Field(None, description="Zone ID if zone-specific")
    action: str = Field(..., description="Action performed")
    status: str = Field(..., description="Result status")
    details: Dict[str, Any] = Field(default_factory=dict, description="Action details")
    error_message: Optional[str] = Field(None, description="Error message if failed")
    duration_ms: Optional[int] = Field(None, description="Action duration in milliseconds") 