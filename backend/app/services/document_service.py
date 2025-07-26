"""
Document service for managing document operations
"""

import asyncpg
import hashlib
import uuid
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List
from supabase import Client
import redis.asyncio as redis
import logging

from app.models.document import (
    Document, DocumentCreate, DocumentUpdate, DocumentResponse,
    DocumentUploadResponse, DocumentListResponse, DocumentStatsResponse,
    DocumentStatus
)
from app.models.base import PaginatedResponse
from app.middleware.errors import DocumentNotFoundError, StorageError

logger = logging.getLogger(__name__)

class DocumentService:
    """Service for document management operations"""
    
    def __init__(
        self, 
        db_pool: asyncpg.Pool,
        supabase_client: Client,
        redis_client: Optional[redis.Redis] = None
    ):
        self.db_pool = db_pool
        self.supabase = supabase_client
        self.redis = redis_client
        self.storage_bucket = "documents"
    
    async def upload_document(
        self, 
        filename: str, 
        file_content: bytes, 
        content_type: str,
        user_id: str = "anonymous"
    ) -> DocumentUploadResponse:
        """Upload a document and create database record"""
        try:
            # Generate file hash for deduplication
            file_hash = hashlib.sha256(file_content).hexdigest()
            file_size = len(file_content)
            
            # Check for existing document with same hash
            existing_doc = await self._find_document_by_hash(file_hash)
            if existing_doc:
                logger.info(f"Duplicate document detected: {existing_doc.id}")
                return DocumentUploadResponse(
                    document_id=existing_doc.id,
                    filename=existing_doc.filename,
                    file_size_bytes=existing_doc.file_size_bytes,
                    file_size_human=self._format_file_size(existing_doc.file_size_bytes),
                    page_count=existing_doc.page_count,
                    upload_timestamp=existing_doc.created_at,
                    status=existing_doc.status,
                    storage_url=existing_doc.metadata.get("storage_url")
                )
            
            # Generate unique document ID and storage path
            document_id = uuid.uuid4()
            storage_path = f"documents/{document_id}/{filename}"
            
            # Upload to Supabase storage
            storage_response = self.supabase.storage.from_(self.storage_bucket).upload(
                storage_path, file_content
            )
            
            if storage_response.get("error"):
                raise StorageError("upload", str(storage_response["error"]))
            
            # Get public URL
            storage_url = self.supabase.storage.from_(self.storage_bucket).get_public_url(
                storage_path
            )
            
            # Extract PDF metadata (page count, etc.)
            page_count = await self._extract_pdf_metadata(file_content)
            
            # Create database record
            document_data = DocumentCreate(
                filename=filename,
                original_filename=filename,
                file_size_bytes=file_size,
                mime_type=content_type,
                storage_path=storage_path,
                uploaded_by=user_id,
                metadata={
                    "file_hash": file_hash,
                    "storage_url": storage_url,
                    "upload_ip": "127.0.0.1",  # TODO: Get from request
                    "user_agent": "API"  # TODO: Get from request
                }
            )
            
            async with self.db_pool.acquire() as conn:
                row = await conn.fetchrow("""
                    INSERT INTO documents (
                        id, filename, original_filename, file_size_bytes, 
                        page_count, mime_type, storage_path, status, 
                        uploaded_by, metadata, created_at, updated_at
                    ) VALUES (
                        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
                    ) RETURNING *
                """, 
                    document_id, document_data.filename, document_data.original_filename,
                    document_data.file_size_bytes, page_count, document_data.mime_type,
                    document_data.storage_path, DocumentStatus.UPLOADED,
                    document_data.uploaded_by, document_data.metadata,
                    datetime.utcnow(), datetime.utcnow()
                )
            
            # Cache document metadata
            if self.redis:
                await self._cache_document(document_id, dict(row))
            
            logger.info(f"Document uploaded successfully: {document_id}")
            
            return DocumentUploadResponse(
                document_id=document_id,
                filename=filename,
                file_size_bytes=file_size,
                file_size_human=self._format_file_size(file_size),
                page_count=page_count,
                upload_timestamp=datetime.utcnow(),
                status=DocumentStatus.UPLOADED,
                storage_url=storage_url
            )
        
        except Exception as e:
            logger.error(f"Error uploading document: {e}")
            # Cleanup storage if database insert failed
            if 'storage_path' in locals():
                try:
                    self.supabase.storage.from_(self.storage_bucket).remove([storage_path])
                except:
                    pass
            raise
    
    async def get_document(self, document_id: uuid.UUID) -> Optional[DocumentResponse]:
        """Get document by ID"""
        try:
            # Try cache first
            if self.redis:
                cached_doc = await self._get_cached_document(document_id)
                if cached_doc:
                    return DocumentResponse(**cached_doc)
            
            # Query database
            async with self.db_pool.acquire() as conn:
                row = await conn.fetchrow("""
                    SELECT d.*, 
                           COUNT(z.id) as zones_count
                    FROM documents d
                    LEFT JOIN zones z ON d.id = z.document_id
                    WHERE d.id = $1
                    GROUP BY d.id
                """, document_id)
            
            if not row:
                return None
            
            document_dict = dict(row)
            
            # Cache for future requests
            if self.redis:
                await self._cache_document(document_id, document_dict)
            
            return DocumentResponse(**document_dict)
        
        except Exception as e:
            logger.error(f"Error getting document {document_id}: {e}")
            raise
    
    async def update_document(
        self, 
        document_id: uuid.UUID, 
        document_update: DocumentUpdate
    ) -> Optional[DocumentResponse]:
        """Update document information"""
        try:
            update_fields = []
            update_values = []
            param_count = 1
            
            # Build dynamic update query
            if document_update.filename is not None:
                update_fields.append(f"filename = ${param_count}")
                update_values.append(document_update.filename)
                param_count += 1
            
            if document_update.status is not None:
                update_fields.append(f"status = ${param_count}")
                update_values.append(document_update.status)
                param_count += 1
            
            if document_update.metadata is not None:
                update_fields.append(f"metadata = ${param_count}")
                update_values.append(document_update.metadata)
                param_count += 1
            
            if not update_fields:
                # No fields to update, return current document
                return await self.get_document(document_id)
            
            # Add updated_at
            update_fields.append(f"updated_at = ${param_count}")
            update_values.append(datetime.utcnow())
            param_count += 1
            
            # Add document_id for WHERE clause
            update_values.append(document_id)
            
            query = f"""
                UPDATE documents 
                SET {', '.join(update_fields)}
                WHERE id = ${param_count}
                RETURNING *
            """
            
            async with self.db_pool.acquire() as conn:
                row = await conn.fetchrow(query, *update_values)
            
            if not row:
                return None
            
            # Invalidate cache
            if self.redis:
                await self._invalidate_document_cache(document_id)
            
            return DocumentResponse(**dict(row))
        
        except Exception as e:
            logger.error(f"Error updating document {document_id}: {e}")
            raise
    
    async def delete_document(self, document_id: uuid.UUID) -> bool:
        """Delete document and all associated data"""
        try:
            async with self.db_pool.acquire() as conn:
                # Get document info first
                doc_row = await conn.fetchrow(
                    "SELECT storage_path FROM documents WHERE id = $1", 
                    document_id
                )
                
                if not doc_row:
                    return False
                
                # Start transaction
                async with conn.transaction():
                    # Delete zones first (foreign key constraint)
                    await conn.execute(
                        "DELETE FROM zones WHERE document_id = $1", 
                        document_id
                    )
                    
                    # Delete processing jobs
                    await conn.execute(
                        "DELETE FROM processing_jobs WHERE document_id = $1", 
                        document_id
                    )
                    
                    # Delete export records
                    await conn.execute(
                        "DELETE FROM export_records WHERE document_id = $1", 
                        document_id
                    )
                    
                    # Delete document
                    result = await conn.execute(
                        "DELETE FROM documents WHERE id = $1", 
                        document_id
                    )
                
                # Delete from storage
                if doc_row["storage_path"]:
                    try:
                        self.supabase.storage.from_(self.storage_bucket).remove([
                            doc_row["storage_path"]
                        ])
                    except Exception as e:
                        logger.warning(f"Failed to delete storage file: {e}")
                
                # Invalidate cache
                if self.redis:
                    await self._invalidate_document_cache(document_id)
                
                return "DELETE 1" in result
        
        except Exception as e:
            logger.error(f"Error deleting document {document_id}: {e}")
            raise
    
    async def list_documents(
        self,
        page: int = 1,
        size: int = 20,
        filters: Dict[str, Any] = None,
        sort_by: str = "created_at",
        sort_order: str = "desc"
    ) -> PaginatedResponse[DocumentResponse]:
        """List documents with pagination and filtering"""
        try:
            filters = filters or {}
            offset = (page - 1) * size
            
            # Build WHERE clause
            where_conditions = []
            where_values = []
            param_count = 1
            
            if filters.get("status"):
                where_conditions.append(f"d.status = ${param_count}")
                where_values.append(filters["status"])
                param_count += 1
            
            if filters.get("search"):
                where_conditions.append(f"d.filename ILIKE ${param_count}")
                where_values.append(f"%{filters['search']}%")
                param_count += 1
            
            where_clause = "WHERE " + " AND ".join(where_conditions) if where_conditions else ""
            
            # Build ORDER BY clause
            valid_sort_fields = ["created_at", "updated_at", "filename", "file_size_bytes"]
            if sort_by not in valid_sort_fields:
                sort_by = "created_at"
            
            if sort_order.lower() not in ["asc", "desc"]:
                sort_order = "desc"
            
            order_clause = f"ORDER BY d.{sort_by} {sort_order.upper()}"
            
            async with self.db_pool.acquire() as conn:
                # Get total count
                count_query = f"""
                    SELECT COUNT(*)
                    FROM documents d
                    {where_clause}
                """
                total = await conn.fetchval(count_query, *where_values)
                
                # Get documents
                documents_query = f"""
                    SELECT d.*, 
                           COUNT(z.id) as zones_count
                    FROM documents d
                    LEFT JOIN zones z ON d.id = z.document_id
                    {where_clause}
                    GROUP BY d.id
                    {order_clause}
                    LIMIT ${param_count} OFFSET ${param_count + 1}
                """
                where_values.extend([size, offset])
                
                rows = await conn.fetch(documents_query, *where_values)
            
            documents = [DocumentResponse(**dict(row)) for row in rows]
            
            total_pages = (total + size - 1) // size
            
            return PaginatedResponse(
                items=documents,
                total=total,
                page=page,
                size=size,
                pages=total_pages,
                has_next=page < total_pages,
                has_prev=page > 1
            )
        
        except Exception as e:
            logger.error(f"Error listing documents: {e}")
            raise
    
    async def get_document_stats(self) -> DocumentStatsResponse:
        """Get document statistics"""
        try:
            async with self.db_pool.acquire() as conn:
                stats_row = await conn.fetchrow("""
                    SELECT 
                        COUNT(*) as total_documents,
                        SUM(file_size_bytes) as total_size_bytes,
                        AVG(EXTRACT(EPOCH FROM (processing_completed_at - processing_started_at))) as avg_processing_time,
                        COUNT(CASE WHEN DATE(created_at) = CURRENT_DATE THEN 1 END) as documents_today,
                        COUNT(CASE WHEN created_at >= DATE_TRUNC('week', CURRENT_DATE) THEN 1 END) as documents_this_week,
                        COUNT(CASE WHEN created_at >= DATE_TRUNC('month', CURRENT_DATE) THEN 1 END) as documents_this_month
                    FROM documents
                """)
                
                status_rows = await conn.fetch("""
                    SELECT status, COUNT(*) as count
                    FROM documents
                    GROUP BY status
                """)
            
            status_counts = {row["status"]: row["count"] for row in status_rows}
            
            return DocumentStatsResponse(
                total_documents=stats_row["total_documents"],
                total_size_bytes=stats_row["total_size_bytes"] or 0,
                total_size_human=self._format_file_size(stats_row["total_size_bytes"] or 0),
                documents_by_status=status_counts,
                average_processing_time=stats_row["avg_processing_time"],
                documents_today=stats_row["documents_today"],
                documents_this_week=stats_row["documents_this_week"],
                documents_this_month=stats_row["documents_this_month"]
            )
        
        except Exception as e:
            logger.error(f"Error getting document stats: {e}")
            raise
    
    async def get_document_status(self, document_id: uuid.UUID) -> Optional[Dict[str, Any]]:
        """Get document processing status"""
        try:
            async with self.db_pool.acquire() as conn:
                row = await conn.fetchrow("""
                    SELECT 
                        d.status,
                        d.processing_started_at,
                        d.processing_completed_at,
                        pj.progress,
                        pj.current_zone_id,
                        pj.total_zones,
                        pj.completed_zones,
                        pj.error_message
                    FROM documents d
                    LEFT JOIN processing_jobs pj ON d.id = pj.document_id 
                        AND pj.status IN ('queued', 'processing')
                    WHERE d.id = $1
                """, document_id)
            
            if not row:
                return None
            
            return dict(row)
        
        except Exception as e:
            logger.error(f"Error getting document status {document_id}: {e}")
            raise
    
    async def validate_document(self, document_id: uuid.UUID) -> Optional[Dict[str, Any]]:
        """Validate document file integrity"""
        try:
            document = await self.get_document(document_id)
            if not document:
                return None
            
            # Basic validation results
            validation_result = {
                "is_valid": True,
                "errors": [],
                "warnings": [],
                "file_size": document.file_size_bytes,
                "page_count": document.page_count,
                "mime_type": document.mime_type,
                "status": document.status
            }
            
            # Check file size
            if document.file_size_bytes == 0:
                validation_result["errors"].append("File is empty")
                validation_result["is_valid"] = False
            
            # Check MIME type
            if document.mime_type != "application/pdf":
                validation_result["errors"].append("Invalid MIME type")
                validation_result["is_valid"] = False
            
            # Check page count
            if document.page_count == 0:
                validation_result["warnings"].append("No pages detected")
            
            return validation_result
        
        except Exception as e:
            logger.error(f"Error validating document {document_id}: {e}")
            raise
    
    async def download_document(self, document_id: uuid.UUID):
        """Get document download stream"""
        try:
            document = await self.get_document(document_id)
            if not document or not document.storage_path:
                return None
            
            # Get file from Supabase storage
            response = self.supabase.storage.from_(self.storage_bucket).download(
                document.storage_path
            )
            
            if response:
                from fastapi.responses import StreamingResponse
                import io
                
                return StreamingResponse(
                    io.BytesIO(response),
                    media_type="application/pdf",
                    headers={"Content-Disposition": f"attachment; filename={document.filename}"}
                )
            
            return None
        
        except Exception as e:
            logger.error(f"Error downloading document {document_id}: {e}")
            raise
    
    async def bulk_delete_documents(self, document_ids: List[uuid.UUID]) -> Dict[str, int]:
        """Delete multiple documents"""
        deleted = 0
        failed = 0
        
        for document_id in document_ids:
            try:
                success = await self.delete_document(document_id)
                if success:
                    deleted += 1
                else:
                    failed += 1
            except Exception as e:
                logger.error(f"Failed to delete document {document_id}: {e}")
                failed += 1
        
        return {"deleted": deleted, "failed": failed}
    
    # Helper methods
    
    async def _find_document_by_hash(self, file_hash: str) -> Optional[Document]:
        """Find document by file hash"""
        try:
            async with self.db_pool.acquire() as conn:
                row = await conn.fetchrow("""
                    SELECT * FROM documents 
                    WHERE metadata->>'file_hash' = $1
                    ORDER BY created_at DESC
                    LIMIT 1
                """, file_hash)
            
            if row:
                return Document(**dict(row))
            return None
        
        except Exception:
            return None
    
    async def _extract_pdf_metadata(self, file_content: bytes) -> int:
        """Extract metadata from PDF content"""
        try:
            # Simple PDF page count extraction
            # In production, use proper PDF library like PyPDF2
            page_count = file_content.count(b'/Type /Page')
            return max(1, page_count)  # At least 1 page
        
        except Exception:
            return 1  # Default to 1 page
    
    def _format_file_size(self, size_bytes: int) -> str:
        """Format file size to human readable string"""
        for unit in ['B', 'KB', 'MB', 'GB']:
            if size_bytes < 1024:
                return f"{size_bytes:.1f} {unit}"
            size_bytes /= 1024
        return f"{size_bytes:.1f} TB"
    
    async def _cache_document(self, document_id: uuid.UUID, document_dict: Dict[str, Any]):
        """Cache document data"""
        if self.redis:
            try:
                import json
                cache_key = f"document:{document_id}"
                # Convert datetime objects to strings for JSON serialization
                cacheable_dict = {}
                for key, value in document_dict.items():
                    if isinstance(value, datetime):
                        cacheable_dict[key] = value.isoformat()
                    else:
                        cacheable_dict[key] = value
                
                await self.redis.setex(
                    cache_key, 
                    3600,  # 1 hour TTL
                    json.dumps(cacheable_dict, default=str)
                )
            except Exception as e:
                logger.warning(f"Failed to cache document {document_id}: {e}")
    
    async def _get_cached_document(self, document_id: uuid.UUID) -> Optional[Dict[str, Any]]:
        """Get document from cache"""
        if self.redis:
            try:
                import json
                cache_key = f"document:{document_id}"
                cached_data = await self.redis.get(cache_key)
                if cached_data:
                    document_dict = json.loads(cached_data)
                    # Convert date strings back to datetime objects
                    for key in ["created_at", "updated_at", "processing_started_at", "processing_completed_at"]:
                        if document_dict.get(key):
                            document_dict[key] = datetime.fromisoformat(document_dict[key])
                    return document_dict
            except Exception as e:
                logger.warning(f"Failed to get cached document {document_id}: {e}")
        return None
    
    async def _invalidate_document_cache(self, document_id: uuid.UUID):
        """Invalidate document cache"""
        if self.redis:
            try:
                cache_key = f"document:{document_id}"
                await self.redis.delete(cache_key)
            except Exception as e:
                logger.warning(f"Failed to invalidate cache for document {document_id}: {e}") 