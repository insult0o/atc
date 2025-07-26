"""
Export service for managing export operations
"""

import asyncpg
import uuid
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List
from fastapi import BackgroundTasks
from supabase import Client
import redis.asyncio as redis
import logging

from app.models.export import (
    ExportRequest, ExportResponse, ExportStatsResponse,
    BulkExportRequest, ValidationResult, ExportStatus
)
from app.models.base import PaginatedResponse

logger = logging.getLogger(__name__)

class ExportService:
    """Service for export management operations"""
    
    def __init__(
        self, 
        db_pool: asyncpg.Pool,
        supabase_client: Client,
        redis_client: Optional[redis.Redis] = None,
        document_service=None
    ):
        self.db_pool = db_pool
        self.supabase = supabase_client
        self.redis = redis_client
        self.document_service = document_service
    
    async def document_exists(self, document_id: uuid.UUID) -> bool:
        """Check if document exists"""
        try:
            async with self.db_pool.acquire() as conn:
                result = await conn.fetchval(
                    "SELECT EXISTS(SELECT 1 FROM documents WHERE id = $1)",
                    document_id
                )
            return result
        except Exception as e:
            logger.error(f"Error checking document existence {document_id}: {e}")
            return False
    
    async def create_export_job(
        self, 
        document_id: uuid.UUID, 
        export_request: ExportRequest
    ) -> ExportResponse:
        """Create a new export job"""
        try:
            export_id = uuid.uuid4()
            now = datetime.utcnow()
            expires_at = now + timedelta(days=7)  # Exports expire after 7 days
            
            async with self.db_pool.acquire() as conn:
                row = await conn.fetchrow("""
                    INSERT INTO export_records (
                        id, document_id, export_type, formats, status,
                        selection, options, expires_at, created_at, updated_at
                    ) VALUES (
                        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
                    ) RETURNING *
                """, 
                    export_id, document_id, export_request.export_type,
                    [f.value for f in export_request.formats], ExportStatus.PENDING,
                    export_request.selection.dict() if export_request.selection else None,
                    export_request.options.dict(), expires_at, now, now
                )
            
            return ExportResponse(**dict(row))
        except Exception as e:
            logger.error(f"Error creating export job: {e}")
            raise
    
    async def get_export_job(self, export_id: uuid.UUID) -> Optional[ExportResponse]:
        """Get export job by ID"""
        try:
            async with self.db_pool.acquire() as conn:
                row = await conn.fetchrow("""
                    SELECT * FROM export_records WHERE id = $1
                """, export_id)
            
            if row:
                return ExportResponse(**dict(row))
            return None
        except Exception as e:
            logger.error(f"Error getting export job {export_id}: {e}")
            return None
    
    async def download_export_file(self, export_id: uuid.UUID, format: str):
        """Get export file download stream"""
        # Stub implementation
        try:
            export_job = await self.get_export_job(export_id)
            if not export_job or export_job.status != ExportStatus.COMPLETED:
                return None
            
            # In production, this would return the actual file stream
            from fastapi.responses import JSONResponse
            return JSONResponse({
                "message": f"Export file download for {export_id} in {format} format",
                "status": "stub_implementation"
            })
        except Exception as e:
            logger.error(f"Error downloading export file {export_id}: {e}")
            return None
    
    async def increment_download_count(self, export_id: uuid.UUID, format: str):
        """Increment download counter"""
        try:
            async with self.db_pool.acquire() as conn:
                await conn.execute("""
                    UPDATE export_records 
                    SET download_count = download_count + 1, updated_at = $1
                    WHERE id = $2
                """, datetime.utcnow(), export_id)
        except Exception as e:
            logger.warning(f"Error incrementing download count for {export_id}: {e}")
    
    async def validate_export(self, export_id: uuid.UUID) -> Optional[ValidationResult]:
        """Validate export quality"""
        # Stub implementation
        try:
            export_job = await self.get_export_job(export_id)
            if not export_job:
                return None
            
            return ValidationResult(
                is_valid=True,
                errors=[],
                warnings=[],
                suggestions=[],
                score=95.0
            )
        except Exception as e:
            logger.error(f"Error validating export {export_id}: {e}")
            return None
    
    async def delete_export(self, export_id: uuid.UUID) -> bool:
        """Delete export and files"""
        try:
            async with self.db_pool.acquire() as conn:
                result = await conn.execute("""
                    DELETE FROM export_records WHERE id = $1
                """, export_id)
            
            return "DELETE 1" in result
        except Exception as e:
            logger.error(f"Error deleting export {export_id}: {e}")
            return False
    
    async def list_exports(
        self,
        page: int = 1,
        size: int = 20,
        filters: Dict[str, Any] = None
    ) -> PaginatedResponse[ExportResponse]:
        """List exports with pagination"""
        try:
            filters = filters or {}
            offset = (page - 1) * size
            
            where_conditions = []
            where_values = []
            param_count = 1
            
            if filters.get("status"):
                where_conditions.append(f"status = ${param_count}")
                where_values.append(filters["status"])
                param_count += 1
            
            if filters.get("document_id"):
                where_conditions.append(f"document_id = ${param_count}")
                where_values.append(filters["document_id"])
                param_count += 1
            
            if filters.get("export_type"):
                where_conditions.append(f"export_type = ${param_count}")
                where_values.append(filters["export_type"])
                param_count += 1
            
            where_clause = "WHERE " + " AND ".join(where_conditions) if where_conditions else ""
            
            async with self.db_pool.acquire() as conn:
                # Get total count
                count_query = f"SELECT COUNT(*) FROM export_records {where_clause}"
                total = await conn.fetchval(count_query, *where_values)
                
                # Get exports
                exports_query = f"""
                    SELECT * FROM export_records 
                    {where_clause}
                    ORDER BY created_at DESC
                    LIMIT ${param_count} OFFSET ${param_count + 1}
                """
                where_values.extend([size, offset])
                
                rows = await conn.fetch(exports_query, *where_values)
            
            exports = [ExportResponse(**dict(row)) for row in rows]
            total_pages = (total + size - 1) // size
            
            return PaginatedResponse(
                items=exports,
                total=total,
                page=page,
                size=size,
                pages=total_pages,
                has_next=page < total_pages,
                has_prev=page > 1
            )
        except Exception as e:
            logger.error(f"Error listing exports: {e}")
            raise
    
    async def get_export_stats(self) -> ExportStatsResponse:
        """Get export statistics"""
        try:
            async with self.db_pool.acquire() as conn:
                stats_row = await conn.fetchrow("""
                    SELECT 
                        COUNT(*) as total_exports,
                        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_exports,
                        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_exports,
                        COUNT(CASE WHEN status IN ('pending', 'processing') THEN 1 END) as active_exports,
                        SUM(download_count) as total_downloads
                    FROM export_records
                """)
            
            return ExportStatsResponse(
                total_exports=stats_row["total_exports"] or 0,
                completed_exports=stats_row["completed_exports"] or 0,
                failed_exports=stats_row["failed_exports"] or 0,
                active_exports=stats_row["active_exports"] or 0,
                total_file_size=0,
                total_file_size_human="0 B",
                average_export_time=None,
                exports_by_format={},
                exports_by_type={},
                exports_today=0,
                exports_this_week=0,
                exports_this_month=0,
                total_downloads=stats_row["total_downloads"] or 0
            )
        except Exception as e:
            logger.error(f"Error getting export stats: {e}")
            raise
    
    async def get_document_exports(self, document_id: uuid.UUID) -> List[ExportResponse]:
        """Get all exports for document"""
        try:
            async with self.db_pool.acquire() as conn:
                rows = await conn.fetch("""
                    SELECT * FROM export_records 
                    WHERE document_id = $1 
                    ORDER BY created_at DESC
                """, document_id)
            
            return [ExportResponse(**dict(row)) for row in rows]
        except Exception as e:
            logger.error(f"Error getting exports for document {document_id}: {e}")
            return []
    
    async def create_bulk_export(
        self, 
        bulk_request: BulkExportRequest,
        background_tasks: BackgroundTasks
    ) -> List[ExportResponse]:
        """Create bulk export jobs"""
        export_jobs = []
        
        for document_id in bulk_request.document_ids:
            try:
                # Create individual export request
                export_request = ExportRequest(
                    export_type=bulk_request.export_type,
                    formats=bulk_request.formats,
                    options=bulk_request.options,
                    validation_level=bulk_request.validation_level
                )
                
                # Create export job
                export_job = await self.create_export_job(document_id, export_request)
                export_jobs.append(export_job)
                
                # Queue for background processing
                background_tasks.add_task(
                    self.process_export_background,
                    export_job.id, document_id, export_request
                )
                
            except Exception as e:
                logger.error(f"Error creating bulk export for document {document_id}: {e}")
        
        return export_jobs
    
    async def cancel_export(self, export_id: uuid.UUID) -> bool:
        """Cancel export"""
        try:
            async with self.db_pool.acquire() as conn:
                result = await conn.execute("""
                    UPDATE export_records 
                    SET status = $1, updated_at = $2
                    WHERE id = $3 AND status IN ('pending', 'processing')
                """, ExportStatus.CANCELLED, datetime.utcnow(), export_id)
            
            return "UPDATE" in result and not result.endswith("0")
        except Exception as e:
            logger.error(f"Error cancelling export {export_id}: {e}")
            return False
    
    async def cleanup_expired_exports(self) -> Dict[str, Any]:
        """Cleanup expired exports"""
        try:
            async with self.db_pool.acquire() as conn:
                # Get expired exports
                expired_exports = await conn.fetch("""
                    SELECT id, file_paths FROM export_records 
                    WHERE expires_at < $1
                """, datetime.utcnow())
                
                # Delete expired exports
                result = await conn.execute("""
                    DELETE FROM export_records WHERE expires_at < $1
                """, datetime.utcnow())
            
            deleted_count = len(expired_exports)
            
            # In production, would also delete associated files
            freed_space = 0  # Calculate actual freed space
            
            return {
                "deleted": deleted_count,
                "freed_space_bytes": freed_space
            }
        except Exception as e:
            logger.error(f"Error cleaning up expired exports: {e}")
            return {"deleted": 0, "freed_space_bytes": 0}
    
    async def process_export_background(
        self, 
        export_id: uuid.UUID, 
        document_id: uuid.UUID, 
        export_request: ExportRequest
    ):
        """Background task for export processing"""
        # Stub implementation
        logger.info(f"Processing export {export_id} for document {document_id}")
        
        try:
            # Simulate export processing
            async with self.db_pool.acquire() as conn:
                await conn.execute("""
                    UPDATE export_records 
                    SET status = $1, started_at = $2, updated_at = $3
                    WHERE id = $4
                """, ExportStatus.PROCESSING, datetime.utcnow(), datetime.utcnow(), export_id)
                
                # Simulate completion
                await conn.execute("""
                    UPDATE export_records 
                    SET status = $1, completed_at = $2, updated_at = $3
                    WHERE id = $4
                """, ExportStatus.COMPLETED, datetime.utcnow(), datetime.utcnow(), export_id)
        
        except Exception as e:
            logger.error(f"Error in background export processing for {export_id}: {e}")
            # Mark export as failed
            try:
                async with self.db_pool.acquire() as conn:
                    await conn.execute("""
                        UPDATE export_records 
                        SET status = $1, error_message = $2, updated_at = $3
                        WHERE id = $4
                    """, ExportStatus.FAILED, str(e), datetime.utcnow(), export_id)
            except:
                pass 