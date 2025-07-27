"""
Zone management API endpoints
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import List, Optional
from uuid import UUID
import logging

from app.models.zone import (
    Zone, ZoneCreate, ZoneUpdate, ZoneResponse,
    ZoneReprocessRequest, ZoneSplitRequest, ZoneMergeRequest,
    ZoneSplitResponse, ZoneMergeResponse, ZoneListResponse,
    ZoneBatchUpdateRequest, ZoneBatchUpdateResponse
)
from app.models.processing import ZoneType, ZoneStatus
from app.models.base import SuccessResponse
from app.services.zone_service import ZoneService
from app.middleware.errors import (
    ZoneNotFoundError, InvalidZoneOperationError, ZoneProcessingError
)
from app.dependencies import get_zone_service

logger = logging.getLogger(__name__)
router = APIRouter()

@router.get("/documents/{document_id}/zones")
async def get_document_zones(
    document_id: UUID,
    zone_type: Optional[ZoneType] = Query(None, description="Filter by zone type"),
    status: Optional[ZoneStatus] = Query(None, description="Filter by status"),
    page_number: Optional[int] = Query(None, ge=1, description="Filter by page number"),
    zone_service: ZoneService = Depends(get_zone_service)
):
    """
    Get all zones for a document
    
    - **document_id**: Document UUID
    - **zone_type**: Optional filter by zone type
    - **status**: Optional filter by status
    - **page_number**: Optional filter by page number
    - Returns list of zones with statistics
    """
    try:
        # Get zones from demo storage
        zones = []
        for zone_data in zone_service._demo_zones.values():
            if isinstance(zone_data, dict) and zone_data.get("document_id") == str(document_id):
                # Apply filters
                if zone_type and zone_data.get("zone_type") != zone_type:
                    continue
                if status and zone_data.get("status") != status:
                    continue
                if page_number and zone_data.get("page_number") != page_number:
                    continue
                zones.append(zone_data)
        
        # Calculate statistics
        by_type = {}
        by_status = {}
        for zone in zones:
            zone_type_key = zone.get("zone_type", "unknown")
            status_key = zone.get("status", "unknown")
            by_type[zone_type_key] = by_type.get(zone_type_key, 0) + 1
            by_status[status_key] = by_status.get(status_key, 0) + 1
        
        response = {
            "zones": zones,
            "total": len(zones),
            "by_type": by_type,
            "by_status": by_status,
            "average_confidence": sum(z.get("confidence", 0) for z in zones) / len(zones) if zones else None
        }
        
        logger.info(f"Retrieved {len(zones)} zones for document {document_id}")
        
        return response
        
    except Exception as e:
        logger.error(f"Error retrieving zones for document {document_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve zones: {str(e)}"
        )

@router.post("/documents/{document_id}/zones")
async def create_zone(
    document_id: UUID,
    zone_data: ZoneCreate,
    zone_service: ZoneService = Depends(get_zone_service)
):
    """
    Create a new zone for a document
    
    - **document_id**: Document UUID
    - **zone_data**: Zone creation data
    - Returns created zone
    """
    try:
        # Ensure document_id matches
        if zone_data.document_id != document_id:
            raise InvalidZoneOperationError(
                "Document ID in URL does not match zone data",
                {"url_document_id": str(document_id), "data_document_id": str(zone_data.document_id)}
            )
        
        # For Epic 6 demo, create a simple response
        from uuid import uuid4
        from datetime import datetime
        
        zone_id = uuid4()
        now = datetime.utcnow()
        
        # Store in demo storage
        zone_dict = {
            "id": str(zone_id),
            "document_id": str(document_id),
            "zone_index": zone_data.zone_index,
            "page_number": zone_data.page_number,
            "zone_type": zone_data.zone_type,
            "coordinates": zone_data.coordinates.model_dump(),
            "content": zone_data.content,
            "confidence": zone_data.confidence,
            "processing_tool": zone_data.processing_tool,
            "status": "completed",
            "metadata": zone_data.metadata,
            "created_at": now.isoformat(),
            "updated_at": now.isoformat(),
            "content_preview": (zone_data.content[:100] + '...' if zone_data.content and len(zone_data.content) > 100 else zone_data.content) if zone_data.content else "No content",
            "word_count": len(zone_data.content.split()) if zone_data.content else 0,
            "character_count": len(zone_data.content) if zone_data.content else 0
        }
        
        # Store in service demo storage with string key
        zone_service._demo_zones[str(zone_id)] = zone_dict
        
        logger.info(f"Created zone {zone_id} for document {document_id}")
        
        return zone_dict
        
    except InvalidZoneOperationError:
        raise
    except Exception as e:
        logger.error(f"Error creating zone for document {document_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create zone: {str(e)}"
        )

@router.get("/zones/{zone_id}", response_model=ZoneResponse)
async def get_zone(
    zone_id: UUID,
    zone_service: ZoneService = Depends(get_zone_service)
):
    """
    Get a specific zone by ID
    
    - **zone_id**: Zone UUID
    - Returns zone details
    """
    try:
        zone = await zone_service.get_zone(zone_id)
        
        logger.info(
            f"Retrieved zone {zone_id}",
            extra={"zone_id": str(zone_id)}
        )
        
        return zone
        
    except ZoneNotFoundError:
        raise
    except Exception as e:
        logger.error(f"Error retrieving zone {zone_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve zone: {str(e)}"
        )

@router.put("/zones/{zone_id}", response_model=ZoneResponse)
async def update_zone(
    zone_id: UUID,
    zone_update: ZoneUpdate,
    zone_service: ZoneService = Depends(get_zone_service)
):
    """
    Update a zone
    
    - **zone_id**: Zone UUID
    - **zone_update**: Zone update data
    - Returns updated zone
    """
    try:
        zone = await zone_service.update_zone(zone_id, zone_update)
        
        logger.info(
            f"Updated zone {zone_id}",
            extra={
                "zone_id": str(zone_id),
                "updated_fields": list(zone_update.model_dump(exclude_none=True).keys())
            }
        )
        
        return zone
        
    except ZoneNotFoundError:
        raise
    except Exception as e:
        logger.error(f"Error updating zone {zone_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update zone: {str(e)}"
        )

@router.delete("/zones/{zone_id}", response_model=SuccessResponse)
async def delete_zone(
    zone_id: UUID,
    zone_service: ZoneService = Depends(get_zone_service)
):
    """
    Delete a zone
    
    - **zone_id**: Zone UUID
    - Returns success message
    """
    try:
        await zone_service.delete_zone(zone_id)
        
        logger.info(
            f"Deleted zone {zone_id}",
            extra={"zone_id": str(zone_id)}
        )
        
        return SuccessResponse(
            message=f"Zone {zone_id} deleted successfully",
            data={"zone_id": str(zone_id)}
        )
        
    except ZoneNotFoundError:
        raise
    except Exception as e:
        logger.error(f"Error deleting zone {zone_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete zone: {str(e)}"
        )

@router.post("/zones/{zone_id}/reprocess", response_model=ZoneResponse)
async def reprocess_zone(
    zone_id: UUID,
    request: ZoneReprocessRequest,
    zone_service: ZoneService = Depends(get_zone_service)
):
    """
    Reprocess a zone with specified tools
    
    - **zone_id**: Zone UUID
    - **request**: Reprocessing configuration
    - Returns updated zone after reprocessing
    """
    try:
        zone = await zone_service.reprocess_zone(zone_id, request)
        
        logger.info(
            f"Initiated reprocessing for zone {zone_id}",
            extra={
                "zone_id": str(zone_id),
                "tools": request.tools,
                "force_update": request.force_update
            }
        )
        
        return zone
        
    except (ZoneNotFoundError, InvalidZoneOperationError, ZoneProcessingError):
        raise
    except Exception as e:
        logger.error(f"Error reprocessing zone {zone_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to reprocess zone: {str(e)}"
        )

@router.post("/zones/{zone_id}/split", response_model=ZoneSplitResponse)
async def split_zone(
    zone_id: UUID,
    request: ZoneSplitRequest,
    zone_service: ZoneService = Depends(get_zone_service)
):
    """
    Split a zone into multiple zones
    
    - **zone_id**: Zone UUID to split
    - **request**: Split configuration
    - Returns information about the split operation
    """
    try:
        result = await zone_service.split_zone(zone_id, request)
        
        logger.info(
            f"Split zone {zone_id} into {len(result.new_zones)} zones",
            extra={
                "original_zone_id": str(zone_id),
                "new_zone_count": len(result.new_zones),
                "split_type": request.split_type
            }
        )
        
        return result
        
    except (ZoneNotFoundError, InvalidZoneOperationError):
        raise
    except Exception as e:
        logger.error(f"Error splitting zone {zone_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to split zone: {str(e)}"
        )

@router.post("/zones/merge", response_model=ZoneMergeResponse)
async def merge_zones(
    request: ZoneMergeRequest,
    zone_service: ZoneService = Depends(get_zone_service)
):
    """
    Merge multiple zones into one
    
    - **request**: Merge configuration with zone IDs
    - Returns information about the merged zone
    """
    try:
        result = await zone_service.merge_zones(request)
        
        logger.info(
            f"Merged {len(request.zone_ids)} zones into zone {result.merged_zone.id}",
            extra={
                "merged_zone_id": str(result.merged_zone.id),
                "original_zone_ids": [str(id) for id in request.zone_ids],
                "merge_strategy": request.merge_strategy
            }
        )
        
        return result
        
    except (ZoneNotFoundError, InvalidZoneOperationError):
        raise
    except Exception as e:
        logger.error(f"Error merging zones: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to merge zones: {str(e)}"
        )

@router.post("/zones/batch-update", response_model=ZoneBatchUpdateResponse)
async def batch_update_zones(
    request: ZoneBatchUpdateRequest,
    zone_service: ZoneService = Depends(get_zone_service)
):
    """
    Batch update multiple zones
    
    - **request**: Batch update configuration
    - Returns summary of update operation
    """
    try:
        result = await zone_service.batch_update_zones(request)
        
        logger.info(
            f"Batch updated zones: {result.updated_count} succeeded, {result.failed_count} failed",
            extra={
                "total_zones": len(request.zone_ids),
                "updated_count": result.updated_count,
                "failed_count": result.failed_count
            }
        )
        
        return result
        
    except Exception as e:
        logger.error(f"Error in batch update: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to batch update zones: {str(e)}"
        )