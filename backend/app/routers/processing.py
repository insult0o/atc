"""
Processing control API endpoints
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query, BackgroundTasks
from fastapi.responses import StreamingResponse
from typing import List, Optional, AsyncGenerator
from uuid import UUID
import logging
import asyncio
import json

from app.models.processing import (
    ProcessingRequest, ProcessingResponse, ProcessingStatsResponse,
    ZoneUpdate, ZoneResponse, ProcessingHistory
)
from app.models.base import SuccessResponse, PaginatedResponse
from app.services.processing_service import ProcessingService
from app.middleware.errors import (
    DocumentNotFoundError, ProcessingJobNotFoundError, ZoneNotFoundError,
    ProcessingInProgressError, ProcessingCapacityExceededError
)
from app.dependencies import get_processing_service

logger = logging.getLogger(__name__)
router = APIRouter()

@router.post("/{document_id}", response_model=ProcessingResponse)
async def start_processing(
    document_id: UUID,
    processing_request: ProcessingRequest,
    background_tasks: BackgroundTasks,
    processing_service: ProcessingService = Depends(get_processing_service)
):
    """
    Start processing a document
    
    - **document_id**: Document to process
    - **processing_request**: Processing configuration
    - Returns processing job information
    """
    try:
        # Check if document exists
        document_exists = await processing_service.document_exists(document_id)
        if not document_exists:
            raise DocumentNotFoundError(str(document_id))
        
        # Check if already processing
        existing_job = await processing_service.get_active_job(document_id)
        if existing_job:
            raise ProcessingInProgressError(str(document_id))
        
        # Check processing capacity
        active_jobs_count = await processing_service.get_active_jobs_count()
        max_jobs = 10  # From settings
        if active_jobs_count >= max_jobs:
            raise ProcessingCapacityExceededError(active_jobs_count, max_jobs)
        
        # Create processing job
        job = await processing_service.create_processing_job(
            document_id, processing_request
        )
        
        # Queue for background processing
        background_tasks.add_task(
            processing_service.process_document_background,
            job.id,
            document_id,
            processing_request
        )
        
        logger.info(
            f"Processing started for document {document_id}",
            extra={
                "document_id": str(document_id),
                "job_id": str(job.id),
                "strategy": processing_request.strategy,
                "priority": processing_request.priority
            }
        )
        
        return job
    
    except (DocumentNotFoundError, ProcessingInProgressError, ProcessingCapacityExceededError):
        raise
    except Exception as e:
        logger.error(f"Error starting processing for document {document_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to start processing"
        )

@router.get("/{document_id}/status", response_model=ProcessingResponse)
async def get_processing_status(
    document_id: UUID,
    processing_service: ProcessingService = Depends(get_processing_service)
):
    """
    Get processing status for a document
    
    - **document_id**: Document ID to check
    - Returns current processing job status and progress
    """
    try:
        job = await processing_service.get_latest_job(document_id)
        if not job:
            raise ProcessingJobNotFoundError(f"No processing job found for document {document_id}")
        
        return job
    
    except ProcessingJobNotFoundError:
        raise
    except Exception as e:
        logger.error(f"Error getting processing status for document {document_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get processing status"
        )

@router.post("/{document_id}/cancel")
async def cancel_processing(
    document_id: UUID,
    processing_service: ProcessingService = Depends(get_processing_service)
):
    """
    Cancel active processing for a document
    
    - **document_id**: Document ID to cancel processing for
    - Returns cancellation confirmation
    """
    try:
        success = await processing_service.cancel_processing(document_id)
        if not success:
            raise ProcessingJobNotFoundError(f"No active processing job found for document {document_id}")
        
        logger.info(
            f"Processing cancelled for document {document_id}",
            extra={"document_id": str(document_id)}
        )
        
        return SuccessResponse(
            message="Processing cancelled successfully",
            data={"document_id": str(document_id)}
        )
    
    except ProcessingJobNotFoundError:
        raise
    except Exception as e:
        logger.error(f"Error cancelling processing for document {document_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to cancel processing"
        )

@router.post("/{document_id}/retry")
async def retry_processing(
    document_id: UUID,
    background_tasks: BackgroundTasks,
    zones_only: Optional[List[int]] = Query(None, description="Retry only specific zones"),
    processing_service: ProcessingService = Depends(get_processing_service)
):
    """
    Retry processing for a document or specific zones
    
    - **document_id**: Document ID to retry processing for
    - **zones_only**: Optional list of zone indices to retry
    - Returns new processing job information
    """
    try:
        job = await processing_service.retry_processing(
            document_id, zones_only, background_tasks
        )
        if not job:
            raise ProcessingJobNotFoundError(f"Cannot retry processing for document {document_id}")
        
        logger.info(
            f"Processing retry started for document {document_id}",
            extra={
                "document_id": str(document_id),
                "job_id": str(job.id),
                "zones_only": zones_only
            }
        )
        
        return job
    
    except ProcessingJobNotFoundError:
        raise
    except Exception as e:
        logger.error(f"Error retrying processing for document {document_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retry processing"
        )

@router.get("/{document_id}/zones", response_model=List[ZoneResponse])
async def get_document_zones(
    document_id: UUID,
    page_number: Optional[int] = Query(None, description="Filter by page number"),
    zone_type: Optional[str] = Query(None, description="Filter by zone type"),
    status: Optional[str] = Query(None, description="Filter by processing status"),
    processing_service: ProcessingService = Depends(get_processing_service)
):
    """
    Get zones for a document with optional filtering
    
    - **document_id**: Document ID
    - **page_number**: Filter by specific page
    - **zone_type**: Filter by zone type (text, table, image, etc.)
    - **status**: Filter by processing status
    - Returns list of zones with their processing status
    """
    try:
        filters = {}
        if page_number:
            filters["page_number"] = page_number
        if zone_type:
            filters["zone_type"] = zone_type
        if status:
            filters["status"] = status
        
        zones = await processing_service.get_document_zones(document_id, filters)
        return zones
    
    except Exception as e:
        logger.error(f"Error getting zones for document {document_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get document zones"
        )

@router.patch("/{document_id}/zones/{zone_id}", response_model=ZoneResponse)
async def update_zone(
    document_id: UUID,
    zone_id: UUID,
    zone_update: ZoneUpdate,
    processing_service: ProcessingService = Depends(get_processing_service)
):
    """
    Update zone information
    
    - **document_id**: Document ID
    - **zone_id**: Zone ID to update
    - **zone_update**: Fields to update
    - Returns updated zone information
    """
    try:
        updated_zone = await processing_service.update_zone(
            document_id, zone_id, zone_update
        )
        if not updated_zone:
            raise ZoneNotFoundError(str(zone_id))
        
        logger.info(
            f"Zone updated: {zone_id}",
            extra={
                "document_id": str(document_id),
                "zone_id": str(zone_id)
            }
        )
        
        return updated_zone
    
    except ZoneNotFoundError:
        raise
    except Exception as e:
        logger.error(f"Error updating zone {zone_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update zone"
        )

@router.get("/jobs", response_model=PaginatedResponse[ProcessingResponse])
async def list_processing_jobs(
    page: int = Query(1, ge=1, description="Page number"),
    size: int = Query(20, ge=1, le=100, description="Items per page"),
    status: Optional[str] = Query(None, description="Filter by job status"),
    document_id: Optional[UUID] = Query(None, description="Filter by document ID"),
    processing_service: ProcessingService = Depends(get_processing_service)
):
    """
    List processing jobs with pagination and filtering
    
    - **page**: Page number (default: 1)
    - **size**: Items per page (default: 20, max: 100)
    - **status**: Filter by job status
    - **document_id**: Filter by specific document
    """
    try:
        filters = {}
        if status:
            filters["status"] = status
        if document_id:
            filters["document_id"] = document_id
        
        result = await processing_service.list_processing_jobs(
            page=page,
            size=size,
            filters=filters
        )
        
        return result
    
    except Exception as e:
        logger.error(f"Error listing processing jobs: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to list processing jobs"
        )

@router.get("/stats/overview", response_model=ProcessingStatsResponse)
async def get_processing_stats(
    processing_service: ProcessingService = Depends(get_processing_service)
):
    """
    Get processing statistics and overview
    
    - Returns comprehensive processing statistics
    """
    try:
        stats = await processing_service.get_processing_stats()
        return stats
    
    except Exception as e:
        logger.error(f"Error getting processing stats: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get processing statistics"
        )

@router.get("/jobs/{job_id}/history", response_model=List[ProcessingHistory])
async def get_job_history(
    job_id: UUID,
    processing_service: ProcessingService = Depends(get_processing_service)
):
    """
    Get processing history for a specific job
    
    - **job_id**: Processing job ID
    - Returns detailed processing history
    """
    try:
        history = await processing_service.get_job_history(job_id)
        if not history:
            raise ProcessingJobNotFoundError(str(job_id))
        
        return history
    
    except ProcessingJobNotFoundError:
        raise
    except Exception as e:
        logger.error(f"Error getting job history for {job_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get job history"
        )

@router.post("/jobs/{job_id}/pause")
async def pause_processing_job(
    job_id: UUID,
    processing_service: ProcessingService = Depends(get_processing_service)
):
    """
    Pause an active processing job
    
    - **job_id**: Processing job ID to pause
    - Returns success confirmation
    """
    try:
        success = await processing_service.pause_processing_job(job_id)
        if not success:
            raise ProcessingJobNotFoundError(str(job_id))
        
        logger.info(
            f"Processing job paused: {job_id}",
            extra={"job_id": str(job_id)}
        )
        
        return SuccessResponse(
            message="Processing job paused successfully",
            data={"job_id": str(job_id)}
        )
    
    except ProcessingJobNotFoundError:
        raise
    except Exception as e:
        logger.error(f"Error pausing job {job_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to pause processing job"
        )

@router.post("/jobs/{job_id}/resume")
async def resume_processing_job(
    job_id: UUID,
    background_tasks: BackgroundTasks,
    processing_service: ProcessingService = Depends(get_processing_service)
):
    """
    Resume a paused processing job
    
    - **job_id**: Processing job ID to resume
    - Returns success confirmation
    """
    try:
        success = await processing_service.resume_processing_job(job_id, background_tasks)
        if not success:
            raise ProcessingJobNotFoundError(str(job_id))
        
        logger.info(
            f"Processing job resumed: {job_id}",
            extra={"job_id": str(job_id)}
        )
        
        return SuccessResponse(
            message="Processing job resumed successfully",
            data={"job_id": str(job_id)}
        )
    
    except ProcessingJobNotFoundError:
        raise
    except Exception as e:
        logger.error(f"Error resuming job {job_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to resume processing job"
        )

@router.get("/{document_id}/progress-stream")
async def stream_processing_progress(
    document_id: UUID,
    processing_service: ProcessingService = Depends(get_processing_service)
):
    """
    Stream processing progress updates using Server-Sent Events
    
    - **document_id**: Document ID to stream progress for
    - Returns SSE stream of progress updates
    """
    async def event_generator() -> AsyncGenerator[str, None]:
        """Generate SSE events for processing progress"""
        try:
            # Keep connection alive and stream updates
            while True:
                # Get current processing status
                job = await processing_service.get_latest_job(document_id)
                
                if job:
                    # Create SSE event data
                    event_data = {
                        "document_id": str(document_id),
                        "status": job.status,
                        "progress": job.progress,
                        "total_zones": job.total_zones,
                        "completed_zones": job.completed_zones,
                        "current_zone_id": str(job.current_zone_id) if job.current_zone_id else None,
                        "error_message": job.error_message,
                        "is_complete": job.status in ["completed", "failed", "cancelled"]
                    }
                    
                    # Send SSE event
                    yield f"data: {json.dumps(event_data)}\n\n"
                    
                    # If processing is complete, close the stream
                    if event_data["is_complete"]:
                        break
                else:
                    # No job found, send empty status
                    yield f"data: {json.dumps({'document_id': str(document_id), 'status': 'not_found'})}\n\n"
                    break
                
                # Wait before next update
                await asyncio.sleep(1)
        
        except asyncio.CancelledError:
            # Client disconnected
            logger.info(f"SSE stream cancelled for document {document_id}")
            raise
        except Exception as e:
            logger.error(f"Error in SSE stream for document {document_id}: {str(e)}")
            # Send error event
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
    
    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"  # Disable Nginx buffering
        }
    ) 