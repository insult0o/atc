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

@router.get("/documents/{document_id}/zones", response_model=ZoneListResponse)
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
        zones = await zone_service.get_zones_by_document(
            document_id=document_id,
            zone_type=zone_type,
            status=status,
            page_number=page_number
        )
        
        logger.info(
            f"Retrieved {zones.total} zones for document {document_id}",
            extra={
                "document_id": str(document_id),
                "total_zones": zones.total,
                "filters": {
                    "zone_type": zone_type.value if zone_type else None,
                    "status": status.value if status else None,
                    "page_number": page_number
                }
            }
        )
        
        return zones
        
    except Exception as e:
        logger.error(f"Error retrieving zones for document {document_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve zones: {str(e)}"
        )

@router.post("/documents/{document_id}/zones", response_model=ZoneResponse)
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
        
        zone = await zone_service.create_zone(zone_data)
        
        logger.info(
            f"Created zone {zone.id} for document {document_id}",
            extra={
                "zone_id": str(zone.id),
                "document_id": str(document_id),
                "zone_type": zone.zone_type.value,
                "page_number": zone.page_number
            }
        )
        
        return zone
        
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