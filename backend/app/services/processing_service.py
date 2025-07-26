"""
Processing service for managing processing operations
"""

import asyncpg
import uuid
from datetime import datetime
from typing import Optional, Dict, Any, List
from fastapi import BackgroundTasks
import redis.asyncio as redis
import logging

from app.models.processing import (
    ProcessingRequest, ProcessingResponse, ProcessingStatsResponse,
    ZoneUpdate, ZoneResponse, ProcessingHistory, ProcessingStatus,
    ProcessingJob
)
from app.models.base import PaginatedResponse
from app.middleware.errors import ProcessingJobNotFoundError

logger = logging.getLogger(__name__)

class ProcessingService:
    """Service for processing management operations"""
    
    def __init__(
        self, 
        db_pool: asyncpg.Pool,
        redis_client: Optional[redis.Redis] = None,
        document_service=None
    ):
        self.db_pool = db_pool
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
    
    async def get_active_job(self, document_id: uuid.UUID) -> Optional[ProcessingResponse]:
        """Get active processing job for document"""
        try:
            async with self.db_pool.acquire() as conn:
                row = await conn.fetchrow("""
                    SELECT * FROM processing_jobs 
                    WHERE document_id = $1 AND status IN ('queued', 'processing')
                    ORDER BY created_at DESC LIMIT 1
                """, document_id)
            
            if row:
                return ProcessingResponse(**dict(row))
            return None
        except Exception as e:
            logger.error(f"Error getting active job for document {document_id}: {e}")
            return None
    
    async def get_active_jobs_count(self) -> int:
        """Get count of active processing jobs"""
        try:
            async with self.db_pool.acquire() as conn:
                count = await conn.fetchval("""
                    SELECT COUNT(*) FROM processing_jobs 
                    WHERE status IN ('queued', 'processing')
                """)
            return count or 0
        except Exception as e:
            logger.error(f"Error getting active jobs count: {e}")
            return 0
    
    async def create_processing_job(
        self, 
        document_id: uuid.UUID, 
        request: ProcessingRequest
    ) -> ProcessingResponse:
        """Create a new processing job"""
        try:
            job_id = uuid.uuid4()
            now = datetime.utcnow()
            
            async with self.db_pool.acquire() as conn:
                row = await conn.fetchrow("""
                    INSERT INTO processing_jobs (
                        id, document_id, status, strategy, progress,
                        total_zones, completed_zones, failed_zones,
                        options, created_at, updated_at
                    ) VALUES (
                        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
                    ) RETURNING *
                """, 
                    job_id, document_id, ProcessingStatus.QUEUED, 
                    request.strategy, 0.0, 0, 0, 0,
                    request.options, now, now
                )
            
            return ProcessingResponse(**dict(row))
        except Exception as e:
            logger.error(f"Error creating processing job: {e}")
            raise
    
    async def get_latest_job(self, document_id: uuid.UUID) -> Optional[ProcessingResponse]:
        """Get latest processing job for document"""
        try:
            async with self.db_pool.acquire() as conn:
                row = await conn.fetchrow("""
                    SELECT * FROM processing_jobs 
                    WHERE document_id = $1 
                    ORDER BY created_at DESC LIMIT 1
                """, document_id)
            
            if row:
                return ProcessingResponse(**dict(row))
            return None
        except Exception as e:
            logger.error(f"Error getting latest job for document {document_id}: {e}")
            return None
    
    async def cancel_processing(self, document_id: uuid.UUID) -> bool:
        """Cancel active processing for document"""
        try:
            async with self.db_pool.acquire() as conn:
                result = await conn.execute("""
                    UPDATE processing_jobs 
                    SET status = $1, updated_at = $2
                    WHERE document_id = $3 AND status IN ('queued', 'processing')
                """, ProcessingStatus.CANCELLED, datetime.utcnow(), document_id)
            
            return "UPDATE" in result and not result.endswith("0")
        except Exception as e:
            logger.error(f"Error cancelling processing for document {document_id}: {e}")
            return False
    
    async def retry_processing(
        self, 
        document_id: uuid.UUID, 
        zones_only: Optional[List[int]], 
        background_tasks: BackgroundTasks
    ) -> Optional[ProcessingResponse]:
        """Retry processing for document"""
        # Stub implementation
        try:
            processing_request = ProcessingRequest(strategy="auto")
            job = await self.create_processing_job(document_id, processing_request)
            
            # Queue for background processing
            background_tasks.add_task(
                self.process_document_background,
                job.id, document_id, processing_request
            )
            
            return job
        except Exception as e:
            logger.error(f"Error retrying processing for document {document_id}: {e}")
            return None
    
    async def get_document_zones(
        self, 
        document_id: uuid.UUID, 
        filters: Dict[str, Any] = None
    ) -> List[ZoneResponse]:
        """Get zones for document"""
        # Stub implementation
        try:
            async with self.db_pool.acquire() as conn:
                # Build query with filters
                query = "SELECT * FROM zones WHERE document_id = $1"
                params = [document_id]
                
                if filters:
                    if filters.get("page_number"):
                        query += " AND page_number = $2"
                        params.append(filters["page_number"])
                    if filters.get("zone_type"):
                        query += f" AND zone_type = ${len(params) + 1}"
                        params.append(filters["zone_type"])
                    if filters.get("status"):
                        query += f" AND status = ${len(params) + 1}"
                        params.append(filters["status"])
                
                query += " ORDER BY zone_index"
                rows = await conn.fetch(query, *params)
            
            return [ZoneResponse(**dict(row)) for row in rows]
        except Exception as e:
            logger.error(f"Error getting zones for document {document_id}: {e}")
            return []
    
    async def update_zone(
        self, 
        document_id: uuid.UUID, 
        zone_id: uuid.UUID, 
        zone_update: ZoneUpdate
    ) -> Optional[ZoneResponse]:
        """Update zone information"""
        # Stub implementation
        try:
            update_fields = []
            update_values = []
            param_count = 1
            
            if zone_update.zone_type is not None:
                update_fields.append(f"zone_type = ${param_count}")
                update_values.append(zone_update.zone_type)
                param_count += 1
            
            if zone_update.content is not None:
                update_fields.append(f"content = ${param_count}")
                update_values.append(zone_update.content)
                param_count += 1
            
            if zone_update.confidence is not None:
                update_fields.append(f"confidence = ${param_count}")
                update_values.append(zone_update.confidence)
                param_count += 1
            
            if zone_update.status is not None:
                update_fields.append(f"status = ${param_count}")
                update_values.append(zone_update.status)
                param_count += 1
            
            if not update_fields:
                return None
            
            update_fields.append(f"updated_at = ${param_count}")
            update_values.append(datetime.utcnow())
            param_count += 1
            
            update_values.append(zone_id)
            
            query = f"""
                UPDATE zones 
                SET {', '.join(update_fields)}
                WHERE id = ${param_count}
                RETURNING *
            """
            
            async with self.db_pool.acquire() as conn:
                row = await conn.fetchrow(query, *update_values)
            
            if row:
                return ZoneResponse(**dict(row))
            return None
        except Exception as e:
            logger.error(f"Error updating zone {zone_id}: {e}")
            return None
    
    async def list_processing_jobs(
        self,
        page: int = 1,
        size: int = 20,
        filters: Dict[str, Any] = None
    ) -> PaginatedResponse[ProcessingResponse]:
        """List processing jobs with pagination"""
        # Stub implementation
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
            
            where_clause = "WHERE " + " AND ".join(where_conditions) if where_conditions else ""
            
            async with self.db_pool.acquire() as conn:
                # Get total count
                count_query = f"SELECT COUNT(*) FROM processing_jobs {where_clause}"
                total = await conn.fetchval(count_query, *where_values)
                
                # Get jobs
                jobs_query = f"""
                    SELECT * FROM processing_jobs 
                    {where_clause}
                    ORDER BY created_at DESC
                    LIMIT ${param_count} OFFSET ${param_count + 1}
                """
                where_values.extend([size, offset])
                
                rows = await conn.fetch(jobs_query, *where_values)
            
            jobs = [ProcessingResponse(**dict(row)) for row in rows]
            total_pages = (total + size - 1) // size
            
            return PaginatedResponse(
                items=jobs,
                total=total,
                page=page,
                size=size,
                pages=total_pages,
                has_next=page < total_pages,
                has_prev=page > 1
            )
        except Exception as e:
            logger.error(f"Error listing processing jobs: {e}")
            raise
    
    async def get_processing_stats(self) -> ProcessingStatsResponse:
        """Get processing statistics"""
        # Stub implementation
        try:
            async with self.db_pool.acquire() as conn:
                stats_row = await conn.fetchrow("""
                    SELECT 
                        COUNT(*) as total_jobs,
                        COUNT(CASE WHEN status IN ('queued', 'processing') THEN 1 END) as active_jobs,
                        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_jobs,
                        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_jobs,
                        AVG(EXTRACT(EPOCH FROM (completed_at - started_at))) as avg_processing_time,
                        SUM(total_zones) as total_zones_processed,
                        AVG(total_zones) as avg_zones_per_job
                    FROM processing_jobs
                """)
            
            return ProcessingStatsResponse(
                total_jobs=stats_row["total_jobs"] or 0,
                active_jobs=stats_row["active_jobs"] or 0,
                completed_jobs=stats_row["completed_jobs"] or 0,
                failed_jobs=stats_row["failed_jobs"] or 0,
                average_processing_time=stats_row["avg_processing_time"],
                total_zones_processed=stats_row["total_zones_processed"] or 0,
                average_zones_per_job=stats_row["avg_zones_per_job"],
                success_rate=0.0,  # Calculate based on completed vs failed
                jobs_today=0,
                jobs_this_week=0,
                jobs_this_month=0
            )
        except Exception as e:
            logger.error(f"Error getting processing stats: {e}")
            raise
    
    async def get_job_history(self, job_id: uuid.UUID) -> List[ProcessingHistory]:
        """Get processing history for job"""
        # Stub implementation
        return []
    
    async def pause_processing_job(self, job_id: uuid.UUID) -> bool:
        """Pause processing job"""
        # Stub implementation
        return True
    
    async def resume_processing_job(self, job_id: uuid.UUID, background_tasks: BackgroundTasks) -> bool:
        """Resume processing job"""
        # Stub implementation
        return True
    
    async def process_document_background(
        self, 
        job_id: uuid.UUID, 
        document_id: uuid.UUID, 
        processing_request: ProcessingRequest
    ):
        """Background task for document processing"""
        # Stub implementation - in production this would:
        # 1. Load the document from storage
        # 2. Run zone detection
        # 3. Process each zone with appropriate tools
        # 4. Update progress via WebSocket
        # 5. Store results in database
        logger.info(f"Processing document {document_id} with job {job_id}")
        
        try:
            # Simulate processing by updating job status
            async with self.db_pool.acquire() as conn:
                await conn.execute("""
                    UPDATE processing_jobs 
                    SET status = $1, started_at = $2, progress = $3, updated_at = $4
                    WHERE id = $5
                """, ProcessingStatus.PROCESSING, datetime.utcnow(), 50.0, datetime.utcnow(), job_id)
                
                # Simulate completion after some processing
                await conn.execute("""
                    UPDATE processing_jobs 
                    SET status = $1, completed_at = $2, progress = $3, updated_at = $4
                    WHERE id = $5
                """, ProcessingStatus.COMPLETED, datetime.utcnow(), 100.0, datetime.utcnow(), job_id)
        
        except Exception as e:
            logger.error(f"Error in background processing for job {job_id}: {e}")
            # Mark job as failed
            try:
                async with self.db_pool.acquire() as conn:
                    await conn.execute("""
                        UPDATE processing_jobs 
                        SET status = $1, error_message = $2, updated_at = $3
                        WHERE id = $4
                    """, ProcessingStatus.FAILED, str(e), datetime.utcnow(), job_id)
            except:
                pass 