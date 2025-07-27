"""
Zone-specific Pydantic models for CRUD operations
"""

from pydantic import Field, validator
from typing import Optional, Dict, Any, List
from datetime import datetime
from uuid import UUID

from .base import BaseModel
from .processing import ZoneType, ZoneStatus, ZoneCoordinates, Zone, ZoneResponse

class ZoneCreate(BaseModel):
    """Model for creating a new zone"""
    document_id: UUID = Field(..., description="Parent document ID")
    zone_index: int = Field(..., ge=0, description="Zone index within document")
    page_number: int = Field(..., ge=1, description="Page number")
    zone_type: ZoneType = Field(default=ZoneType.UNKNOWN, description="Content type")
    coordinates: ZoneCoordinates = Field(..., description="Zone coordinates")
    content: Optional[str] = Field(None, description="Initial content")
    confidence: Optional[float] = Field(None, ge=0.0, le=1.0, description="Initial confidence score")
    processing_tool: Optional[str] = Field(None, description="Tool used for detection")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Additional metadata")

class ZoneUpdate(BaseModel):
    """Model for updating an existing zone"""
    zone_type: Optional[ZoneType] = Field(None, description="Content type")
    coordinates: Optional[ZoneCoordinates] = Field(None, description="Zone coordinates")
    content: Optional[str] = Field(None, description="Zone content")
    confidence: Optional[float] = Field(None, ge=0.0, le=1.0, description="Confidence score")
    processing_tool: Optional[str] = Field(None, description="Tool used for detection")
    status: Optional[ZoneStatus] = Field(None, description="Processing status")
    metadata: Optional[Dict[str, Any]] = Field(None, description="Additional metadata")

class ZoneReprocessRequest(BaseModel):
    """Request to reprocess a zone"""
    tools: Optional[List[str]] = Field(None, description="Specific tools to use")
    force_update: bool = Field(default=False, description="Force update even if already processed")
    options: Dict[str, Any] = Field(default_factory=dict, description="Processing options")
    
    @validator('tools')
    def validate_tools(cls, v):
        if v is not None:
            allowed_tools = ['unstructured', 'layoutlm', 'paddle', 'tesseract', 'textract']
            invalid_tools = [tool for tool in v if tool not in allowed_tools]
            if invalid_tools:
                raise ValueError(f'Invalid tools: {invalid_tools}. Allowed: {allowed_tools}')
        return v

class ZoneSplitRequest(BaseModel):
    """Request to split a zone into multiple zones"""
    split_type: str = Field(..., description="Type of split: 'horizontal', 'vertical', or 'auto'")
    split_position: Optional[float] = Field(None, ge=0.0, le=1.0, description="Position to split at (0-1)")
    split_count: Optional[int] = Field(None, ge=2, le=10, description="Number of zones to split into")
    
    @validator('split_type')
    def validate_split_type(cls, v):
        allowed_types = ['horizontal', 'vertical', 'auto']
        if v not in allowed_types:
            raise ValueError(f'Split type must be one of {allowed_types}')
        return v
    
    @validator('split_position')
    def validate_split_position(cls, v, values):
        if v is not None and values.get('split_count') is not None:
            raise ValueError('Cannot specify both split_position and split_count')
        return v

class ZoneMergeRequest(BaseModel):
    """Request to merge multiple zones"""
    zone_ids: List[UUID] = Field(..., min_items=2, description="IDs of zones to merge")
    merge_strategy: str = Field(default="concatenate", description="How to merge content")
    preserve_formatting: bool = Field(default=True, description="Preserve text formatting")
    
    @validator('merge_strategy')
    def validate_merge_strategy(cls, v):
        allowed_strategies = ['concatenate', 'smart', 'preserve_layout']
        if v not in allowed_strategies:
            raise ValueError(f'Merge strategy must be one of {allowed_strategies}')
        return v

class ZoneSplitResponse(BaseModel):
    """Response after splitting a zone"""
    original_zone_id: UUID = Field(..., description="ID of the original zone")
    new_zones: List[ZoneResponse] = Field(..., description="Newly created zones")
    split_metadata: Dict[str, Any] = Field(default_factory=dict, description="Split operation metadata")

class ZoneMergeResponse(BaseModel):
    """Response after merging zones"""
    merged_zone: ZoneResponse = Field(..., description="The merged zone")
    original_zone_ids: List[UUID] = Field(..., description="IDs of original zones")
    merge_metadata: Dict[str, Any] = Field(default_factory=dict, description="Merge operation metadata")

class ZoneListResponse(BaseModel):
    """Response for zone list queries"""
    zones: List[ZoneResponse] = Field(..., description="List of zones")
    total: int = Field(..., description="Total number of zones")
    by_type: Dict[str, int] = Field(..., description="Zone count by type")
    by_status: Dict[str, int] = Field(..., description="Zone count by status")
    average_confidence: Optional[float] = Field(None, description="Average confidence score")

class ZoneBatchUpdateRequest(BaseModel):
    """Request for batch updating multiple zones"""
    zone_ids: List[UUID] = Field(..., min_items=1, description="IDs of zones to update")
    update_data: Dict[str, Any] = Field(..., description="Data to update")
    
    @validator('update_data')
    def validate_update_data(cls, v):
        allowed_fields = ['zone_type', 'status', 'confidence', 'metadata']
        invalid_fields = [field for field in v.keys() if field not in allowed_fields]
        if invalid_fields:
            raise ValueError(f'Cannot batch update fields: {invalid_fields}')
        return v

class ZoneBatchUpdateResponse(BaseModel):
    """Response for batch update operations"""
    updated_count: int = Field(..., description="Number of zones updated")
    failed_count: int = Field(default=0, description="Number of zones that failed to update")
    updated_zones: List[UUID] = Field(..., description="IDs of successfully updated zones")
    failed_zones: List[Dict[str, Any]] = Field(default_factory=list, description="Failed zone details")