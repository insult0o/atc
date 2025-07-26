"""
Document management API endpoints
"""

from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, status, Query
from fastapi.responses import JSONResponse
from typing import List, Optional
from uuid import UUID
import logging

from app.models.document import (
    Document, DocumentCreate, DocumentUpdate, DocumentResponse,
    DocumentUploadResponse, DocumentListResponse, DocumentStatsResponse
)
from app.models.base import SuccessResponse, PaginatedResponse
from app.services.document_service import DocumentService
from app.middleware.errors import (
    DocumentNotFoundError, InvalidFileTypeError, FileSizeExceededError
)
from app.middleware.logging import RequestContextLogger
from app.dependencies import get_document_service

logger = logging.getLogger(__name__)
router = APIRouter()

@router.post("/upload", response_model=DocumentUploadResponse)
async def upload_document(
    file: UploadFile = File(...),
    document_service: DocumentService = Depends(get_document_service)
):
    """
    Upload a PDF document for processing
    
    - **file**: PDF file to upload (max 100MB)
    - Returns document metadata and storage information
    """
    try:
        # Validate file type
        if not file.content_type == "application/pdf":
            raise InvalidFileTypeError(file.content_type, ["application/pdf"])
        
        # Read file content
        file_content = await file.read()
        file_size = len(file_content)
        
        # Validate file size (100MB limit)
        max_size = 100 * 1024 * 1024  # 100MB
        if file_size > max_size:
            raise FileSizeExceededError(file_size, max_size)
        
        # Create document record
        result = await document_service.upload_document(
            filename=file.filename,
            file_content=file_content,
            content_type=file.content_type
        )
        
        logger.info(
            f"Document uploaded successfully: {result.document_id}",
            extra={
                "document_id": str(result.document_id),
                "filename": result.filename,
                "file_size": result.file_size_bytes
            }
        )
        
        return result
    
    except Exception as e:
        logger.error(f"Error uploading document: {str(e)}")
        raise

@router.get("/{document_id}", response_model=DocumentResponse)
async def get_document(
    document_id: UUID,
    document_service: DocumentService = Depends(get_document_service)
):
    """
    Retrieve document information by ID
    
    - **document_id**: Unique document identifier
    - Returns complete document metadata and processing status
    """
    try:
        document = await document_service.get_document(document_id)
        if not document:
            raise DocumentNotFoundError(str(document_id))
        
        return document
    
    except DocumentNotFoundError:
        raise
    except Exception as e:
        logger.error(f"Error retrieving document {document_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve document"
        )

@router.get("/{document_id}/status")
async def get_document_status(
    document_id: UUID,
    document_service: DocumentService = Depends(get_document_service)
):
    """
    Get document processing status
    
    - **document_id**: Unique document identifier
    - Returns current processing status and progress
    """
    try:
        status_info = await document_service.get_document_status(document_id)
        if not status_info:
            raise DocumentNotFoundError(str(document_id))
        
        return status_info
    
    except DocumentNotFoundError:
        raise
    except Exception as e:
        logger.error(f"Error getting document status {document_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get document status"
        )

@router.patch("/{document_id}", response_model=DocumentResponse)
async def update_document(
    document_id: UUID,
    document_update: DocumentUpdate,
    document_service: DocumentService = Depends(get_document_service)
):
    """
    Update document information
    
    - **document_id**: Unique document identifier
    - **document_update**: Fields to update
    - Returns updated document information
    """
    try:
        updated_document = await document_service.update_document(
            document_id, document_update
        )
        if not updated_document:
            raise DocumentNotFoundError(str(document_id))
        
        logger.info(
            f"Document updated: {document_id}",
            extra={"document_id": str(document_id)}
        )
        
        return updated_document
    
    except DocumentNotFoundError:
        raise
    except Exception as e:
        logger.error(f"Error updating document {document_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update document"
        )

@router.delete("/{document_id}")
async def delete_document(
    document_id: UUID,
    document_service: DocumentService = Depends(get_document_service)
):
    """
    Delete a document and all associated data
    
    - **document_id**: Unique document identifier
    - Returns success confirmation
    """
    try:
        success = await document_service.delete_document(document_id)
        if not success:
            raise DocumentNotFoundError(str(document_id))
        
        logger.info(
            f"Document deleted: {document_id}",
            extra={"document_id": str(document_id)}
        )
        
        return SuccessResponse(
            message="Document deleted successfully",
            data={"document_id": str(document_id)}
        )
    
    except DocumentNotFoundError:
        raise
    except Exception as e:
        logger.error(f"Error deleting document {document_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete document"
        )

@router.get("", response_model=PaginatedResponse[DocumentResponse])
async def list_documents(
    page: int = Query(1, ge=1, description="Page number"),
    size: int = Query(20, ge=1, le=100, description="Items per page"),
    status: Optional[str] = Query(None, description="Filter by status"),
    search: Optional[str] = Query(None, description="Search in filename"),
    sort_by: str = Query("created_at", description="Sort field"),
    sort_order: str = Query("desc", regex="^(asc|desc)$", description="Sort order"),
    document_service: DocumentService = Depends(get_document_service)
):
    """
    List documents with pagination and filtering
    
    - **page**: Page number (default: 1)
    - **size**: Items per page (default: 20, max: 100)
    - **status**: Filter by processing status
    - **search**: Search in document filename
    - **sort_by**: Field to sort by (default: created_at)
    - **sort_order**: Sort order - asc or desc (default: desc)
    """
    try:
        filters = {}
        if status:
            filters["status"] = status
        if search:
            filters["search"] = search
        
        result = await document_service.list_documents(
            page=page,
            size=size,
            filters=filters,
            sort_by=sort_by,
            sort_order=sort_order
        )
        
        return result
    
    except Exception as e:
        logger.error(f"Error listing documents: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to list documents"
        )

@router.get("/stats/overview", response_model=DocumentStatsResponse)
async def get_document_stats(
    document_service: DocumentService = Depends(get_document_service)
):
    """
    Get document statistics and overview
    
    - Returns comprehensive statistics about documents
    """
    try:
        stats = await document_service.get_document_stats()
        return stats
    
    except Exception as e:
        logger.error(f"Error getting document stats: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get document statistics"
        )

@router.post("/{document_id}/validate")
async def validate_document(
    document_id: UUID,
    document_service: DocumentService = Depends(get_document_service)
):
    """
    Validate document file integrity and format
    
    - **document_id**: Unique document identifier
    - Returns validation results
    """
    try:
        validation_result = await document_service.validate_document(document_id)
        if validation_result is None:
            raise DocumentNotFoundError(str(document_id))
        
        return validation_result
    
    except DocumentNotFoundError:
        raise
    except Exception as e:
        logger.error(f"Error validating document {document_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to validate document"
        )

@router.get("/{document_id}/download")
async def download_document(
    document_id: UUID,
    document_service: DocumentService = Depends(get_document_service)
):
    """
    Download original document file
    
    - **document_id**: Unique document identifier
    - Returns file stream for download
    """
    try:
        file_stream = await document_service.download_document(document_id)
        if not file_stream:
            raise DocumentNotFoundError(str(document_id))
        
        return file_stream
    
    except DocumentNotFoundError:
        raise
    except Exception as e:
        logger.error(f"Error downloading document {document_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to download document"
        )

@router.post("/bulk/delete")
async def bulk_delete_documents(
    document_ids: List[UUID],
    document_service: DocumentService = Depends(get_document_service)
):
    """
    Delete multiple documents at once
    
    - **document_ids**: List of document IDs to delete
    - Returns summary of deletion results
    """
    try:
        if len(document_ids) > 100:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot delete more than 100 documents at once"
            )
        
        result = await document_service.bulk_delete_documents(document_ids)
        
        logger.info(
            f"Bulk delete completed: {result['deleted']} deleted, {result['failed']} failed",
            extra={
                "requested_count": len(document_ids),
                "deleted_count": result['deleted'],
                "failed_count": result['failed']
            }
        )
        
        return SuccessResponse(
            message=f"Bulk delete completed: {result['deleted']} deleted, {result['failed']} failed",
            data=result
        )
    
    except Exception as e:
        logger.error(f"Error in bulk delete: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete documents"
        ) 