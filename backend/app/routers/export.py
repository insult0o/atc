"""
Export management API endpoints
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query, BackgroundTasks
from fastapi.responses import StreamingResponse
from typing import List, Optional, Dict, Any
from uuid import UUID
import logging

from app.models.export import (
    ExportRequest, ExportResponse, ExportStatsResponse,
    BulkExportRequest, ValidationResult
)
from app.models.base import SuccessResponse, PaginatedResponse
from app.services.export_service import ExportService
from app.middleware.errors import (
    DocumentNotFoundError, ExportNotFoundError
)
from app.dependencies import get_export_service

logger = logging.getLogger(__name__)
router = APIRouter()

@router.post("/{document_id}", response_model=ExportResponse)
async def start_export(
    document_id: UUID,
    export_request: ExportRequest,
    background_tasks: BackgroundTasks,
    export_service: ExportService = Depends(get_export_service)
):
    """
    Start export for a document
    
    - **document_id**: Document to export
    - **export_request**: Export configuration
    - Returns export job information
    """
    try:
        # Ensure document_id is set in the request
        export_request.document_id = document_id
        
        # Check if document exists
        document_exists = await export_service.document_exists(document_id)
        if not document_exists:
            raise DocumentNotFoundError(str(document_id))
        
        # Create export job
        export_job = await export_service.create_export_job(
            document_id, export_request
        )
        
        # Queue for background processing
        background_tasks.add_task(
            export_service.process_export_background,
            export_job.id,
            document_id,
            export_request
        )
        
        logger.info(
            f"Export started for document {document_id}",
            extra={
                "document_id": str(document_id),
                "export_id": str(export_job.id),
                "export_type": export_request.export_type,
                "formats": [f.value for f in export_request.formats]
            }
        )
        
        return export_job
    
    except DocumentNotFoundError:
        raise
    except Exception as e:
        logger.error(f"Error starting export for document {document_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to start export"
        )

@router.get("/{export_id}/status", response_model=ExportResponse)
async def get_export_status(
    export_id: UUID,
    export_service: ExportService = Depends(get_export_service)
):
    """
    Get export status and progress
    
    - **export_id**: Export job ID
    - Returns export status and generated files
    """
    try:
        export_job = await export_service.get_export_job(export_id)
        if not export_job:
            raise ExportNotFoundError(str(export_id))
        
        return export_job
    
    except ExportNotFoundError:
        raise
    except Exception as e:
        logger.error(f"Error getting export status {export_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get export status"
        )

@router.get("/{export_id}/download")
async def download_export(
    export_id: UUID,
    format: str = Query(..., description="Format to download"),
    export_service: ExportService = Depends(get_export_service)
):
    """
    Download exported file
    
    - **export_id**: Export job ID
    - **format**: File format to download
    - Returns file stream for download
    """
    try:
        file_stream = await export_service.download_export_file(export_id, format)
        if not file_stream:
            raise ExportNotFoundError(str(export_id))
        
        # Increment download counter
        await export_service.increment_download_count(export_id, format)
        
        logger.info(
            f"Export downloaded: {export_id} ({format})",
            extra={
                "export_id": str(export_id),
                "format": format
            }
        )
        
        return file_stream
    
    except ExportNotFoundError:
        raise
    except Exception as e:
        logger.error(f"Error downloading export {export_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to download export"
        )

@router.post("/{export_id}/validate", response_model=ValidationResult)
async def validate_export(
    export_id: UUID,
    export_service: ExportService = Depends(get_export_service)
):
    """
    Validate exported content quality
    
    - **export_id**: Export job ID
    - Returns validation results and quality score
    """
    try:
        validation_result = await export_service.validate_export(export_id)
        if not validation_result:
            raise ExportNotFoundError(str(export_id))
        
        return validation_result
    
    except ExportNotFoundError:
        raise
    except Exception as e:
        logger.error(f"Error validating export {export_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to validate export"
        )

@router.delete("/{export_id}")
async def delete_export(
    export_id: UUID,
    export_service: ExportService = Depends(get_export_service)
):
    """
    Delete an export and all associated files
    
    - **export_id**: Export job ID to delete
    - Returns success confirmation
    """
    try:
        success = await export_service.delete_export(export_id)
        if not success:
            raise ExportNotFoundError(str(export_id))
        
        logger.info(
            f"Export deleted: {export_id}",
            extra={"export_id": str(export_id)}
        )
        
        return SuccessResponse(
            message="Export deleted successfully",
            data={"export_id": str(export_id)}
        )
    
    except ExportNotFoundError:
        raise
    except Exception as e:
        logger.error(f"Error deleting export {export_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete export"
        )

@router.get("", response_model=PaginatedResponse[ExportResponse])
async def list_exports(
    page: int = Query(1, ge=1, description="Page number"),
    size: int = Query(20, ge=1, le=100, description="Items per page"),
    status: Optional[str] = Query(None, description="Filter by export status"),
    document_id: Optional[UUID] = Query(None, description="Filter by document ID"),
    export_type: Optional[str] = Query(None, description="Filter by export type"),
    format: Optional[str] = Query(None, description="Filter by format"),
    export_service: ExportService = Depends(get_export_service)
):
    """
    List exports with pagination and filtering
    
    - **page**: Page number (default: 1)
    - **size**: Items per page (default: 20, max: 100)
    - **status**: Filter by export status
    - **document_id**: Filter by specific document
    - **export_type**: Filter by export type
    - **format**: Filter by format
    """
    try:
        filters = {}
        if status:
            filters["status"] = status
        if document_id:
            filters["document_id"] = document_id
        if export_type:
            filters["export_type"] = export_type
        if format:
            filters["format"] = format
        
        result = await export_service.list_exports(
            page=page,
            size=size,
            filters=filters
        )
        
        return result
    
    except Exception as e:
        logger.error(f"Error listing exports: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to list exports"
        )

@router.get("/stats/overview", response_model=ExportStatsResponse)
async def get_export_stats(
    export_service: ExportService = Depends(get_export_service)
):
    """
    Get export statistics and overview
    
    - Returns comprehensive export statistics
    """
    try:
        stats = await export_service.get_export_stats()
        return stats
    
    except Exception as e:
        logger.error(f"Error getting export stats: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get export statistics"
        )

@router.get("/document/{document_id}", response_model=List[ExportResponse])
async def get_document_exports(
    document_id: UUID,
    export_service: ExportService = Depends(get_export_service)
):
    """
    Get all exports for a specific document
    
    - **document_id**: Document ID
    - Returns list of all exports for the document
    """
    try:
        exports = await export_service.get_document_exports(document_id)
        return exports
    
    except Exception as e:
        logger.error(f"Error getting exports for document {document_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get document exports"
        )

@router.post("/preview", response_model=Dict[str, Any])
async def preview_export(
    export_request: ExportRequest,
    export_service: ExportService = Depends(get_export_service)
):
    """
    Generate export preview
    
    - **export_request**: Export configuration
    - Returns preview of export data
    """
    try:
        preview = await export_service.generate_preview(export_request)
        return preview
    
    except DocumentNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error generating export preview: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate export preview"
        )

@router.post("/generate", response_model=ExportResponse)
async def generate_export(
    export_request: ExportRequest,
    background_tasks: BackgroundTasks,
    export_service: ExportService = Depends(get_export_service)
):
    """
    Generate export file
    
    - **export_request**: Export configuration
    - Returns export job information
    """
    try:
        # Check if document exists
        document_id = export_request.document_id
        document_exists = await export_service.document_exists(document_id)
        if not document_exists:
            raise DocumentNotFoundError(str(document_id))
        
        # Create export job
        export_job = await export_service.create_export_job(
            document_id, export_request
        )
        
        # Queue for background processing
        background_tasks.add_task(
            export_service.process_export_background,
            export_job.id,
            document_id,
            export_request
        )
        
        logger.info(
            f"Export generation started for document {document_id}",
            extra={
                "document_id": str(document_id),
                "export_id": str(export_job.id),
                "export_type": export_request.export_type,
                "formats": [f.value for f in export_request.formats]
            }
        )
        
        return export_job
    
    except DocumentNotFoundError:
        raise
    except Exception as e:
        logger.error(f"Error generating export: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate export"
        )

@router.post("/validate")
async def validate_export_data(
    export_request: ExportRequest,
    export_service: ExportService = Depends(get_export_service)
):
    """
    Validate export data before generation
    
    - **export_request**: Export configuration to validate
    - Returns validation results
    """
    try:
        validation_result = await export_service.validate_export_request(export_request)
        return validation_result
    
    except DocumentNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error validating export: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to validate export"
        )

@router.post("/bulk", response_model=List[ExportResponse])
async def bulk_export(
    bulk_request: BulkExportRequest,
    background_tasks: BackgroundTasks,
    export_service: ExportService = Depends(get_export_service)
):
    """
    Create bulk export for multiple documents
    
    - **bulk_request**: Bulk export configuration
    - Returns list of created export jobs
    """
    try:
        export_jobs = await export_service.create_bulk_export(
            bulk_request, background_tasks
        )
        
        logger.info(
            f"Bulk export started for {len(bulk_request.document_ids)} documents",
            extra={
                "document_count": len(bulk_request.document_ids),
                "export_type": bulk_request.export_type,
                "formats": [f.value for f in bulk_request.formats],
                "combine_files": bulk_request.combine_files
            }
        )
        
        return export_jobs
    
    except Exception as e:
        logger.error(f"Error creating bulk export: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create bulk export"
        )

@router.post("/{export_id}/cancel")
async def cancel_export(
    export_id: UUID,
    export_service: ExportService = Depends(get_export_service)
):
    """
    Cancel an active export
    
    - **export_id**: Export job ID to cancel
    - Returns success confirmation
    """
    try:
        success = await export_service.cancel_export(export_id)
        if not success:
            raise ExportNotFoundError(str(export_id))
        
        logger.info(
            f"Export cancelled: {export_id}",
            extra={"export_id": str(export_id)}
        )
        
        return SuccessResponse(
            message="Export cancelled successfully",
            data={"export_id": str(export_id)}
        )
    
    except ExportNotFoundError:
        raise
    except Exception as e:
        logger.error(f"Error cancelling export {export_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to cancel export"
        )

@router.post("/cleanup/expired")
async def cleanup_expired_exports(
    export_service: ExportService = Depends(get_export_service)
):
    """
    Clean up expired exports and their files
    
    - Returns summary of cleanup operation
    """
    try:
        result = await export_service.cleanup_expired_exports()
        
        logger.info(
            f"Expired exports cleanup completed: {result['deleted']} exports removed",
            extra={
                "deleted_count": result['deleted'],
                "freed_space": result['freed_space_bytes']
            }
        )
        
        return SuccessResponse(
            message=f"Cleanup completed: {result['deleted']} expired exports removed",
            data=result
        )
    
    except Exception as e:
        logger.error(f"Error cleaning up expired exports: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to cleanup expired exports"
        ) 