"""
Export service for managing export operations
"""

import asyncpg
import uuid
import json
import os
import aiofiles
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List
from fastapi import BackgroundTasks
from fastapi.responses import FileResponse, StreamingResponse
from supabase import Client
import redis.asyncio as redis
import logging

from app.models.export import (
    ExportRequest, ExportResponse, ExportStatsResponse,
    BulkExportRequest, ValidationResult, ExportStatus,
    ExportFormat, ExportType
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
                    "SELECT EXISTS(SELECT 1 FROM pdf_processing.documents WHERE id = $1)",
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
                    INSERT INTO pdf_processing.export_records (
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
                    SELECT * FROM pdf_processing.export_records WHERE id = $1
                """, export_id)
            
            if row:
                return ExportResponse(**dict(row))
            return None
        except Exception as e:
            logger.error(f"Error getting export job {export_id}: {e}")
            return None
    
    async def download_export_file(self, export_id: uuid.UUID, format: str):
        """Get export file download stream"""
        try:
            export_job = await self.get_export_job(export_id)
            if not export_job or export_job.status != ExportStatus.COMPLETED:
                return None
            
            # Get file path from export record
            file_paths = export_job.file_paths or {}
            file_path = file_paths.get(format)
            
            if not file_path or not os.path.exists(file_path):
                logger.error(f"Export file not found: {file_path}")
                return None
            
            # Get filename for download
            filename = os.path.basename(file_path)
            
            # Return file response
            return FileResponse(
                path=file_path,
                filename=filename,
                media_type=self._get_media_type(format)
            )
        except Exception as e:
            logger.error(f"Error downloading export file {export_id}: {e}")
            return None
    
    def _get_media_type(self, format: str) -> str:
        """Get media type for format"""
        media_types = {
            "json": "application/json",
            "jsonl": "application/x-ndjson",
            "csv": "text/csv",
            "txt": "text/plain",
            "md": "text/markdown",
            "xml": "application/xml"
        }
        return media_types.get(format, "application/octet-stream")
    
    async def increment_download_count(self, export_id: uuid.UUID, format: str):
        """Increment download counter"""
        try:
            async with self.db_pool.acquire() as conn:
                await conn.execute("""
                    UPDATE pdf_processing.export_records 
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
                    DELETE FROM pdf_processing.export_records WHERE id = $1
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
                count_query = f"SELECT COUNT(*) FROM pdf_processing.export_records {where_clause}"
                total = await conn.fetchval(count_query, *where_values)
                
                # Get exports
                exports_query = f"""
                    SELECT * FROM pdf_processing.export_records 
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
                    FROM pdf_processing.export_records
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
                    SELECT * FROM pdf_processing.export_records 
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
                    UPDATE pdf_processing.export_records 
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
                    SELECT id, file_paths FROM pdf_processing.export_records 
                    WHERE expires_at < $1
                """, datetime.utcnow())
                
                # Delete expired exports
                result = await conn.execute("""
                    DELETE FROM pdf_processing.export_records WHERE expires_at < $1
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
        logger.info(f"Processing export {export_id} for document {document_id}")
        
        try:
            # Update status to processing
            async with self.db_pool.acquire() as conn:
                await conn.execute("""
                    UPDATE pdf_processing.export_records 
                    SET status = $1, started_at = $2, updated_at = $3
                    WHERE id = $4
                """, ExportStatus.PROCESSING, datetime.utcnow(), datetime.utcnow(), export_id)
                
                # Get document data and zones
                document_data = await self._get_document_data(document_id)
                zones_data = await self._get_zones_data(document_id, export_request)
                
                # Generate files for each format
                file_paths = {}
                file_sizes = {}
                
                for format in export_request.formats:
                    file_path, file_size = await self._generate_export_file(
                        export_id, document_data, zones_data, format, export_request
                    )
                    file_paths[format.value] = file_path
                    file_sizes[format.value] = file_size
                
                # Update export record with file information
                await conn.execute("""
                    UPDATE pdf_processing.export_records 
                    SET status = $1, completed_at = $2, updated_at = $3,
                        file_paths = $4, file_sizes = $5
                    WHERE id = $6
                """, ExportStatus.COMPLETED, datetime.utcnow(), datetime.utcnow(),
                     json.dumps(file_paths), json.dumps(file_sizes), export_id)
        
        except Exception as e:
            logger.error(f"Error in background export processing for {export_id}: {e}")
            # Mark export as failed
            try:
                async with self.db_pool.acquire() as conn:
                    await conn.execute("""
                        UPDATE pdf_processing.export_records 
                        SET status = $1, error_message = $2, updated_at = $3
                        WHERE id = $4
                    """, ExportStatus.FAILED, str(e), datetime.utcnow(), export_id)
            except:
                pass
    
    async def generate_preview(self, export_request: ExportRequest) -> Dict[str, Any]:
        """Generate export preview"""
        try:
            document_id = export_request.document_id
            
            # Get document data
            document_data = await self._get_document_data(document_id)
            if not document_data:
                raise Exception("Document not found")
            
            # Get zones data with limit for preview
            zones_data = await self._get_zones_data(document_id, export_request, limit=10)
            
            # Generate preview for each format
            previews = {}
            for format in export_request.formats:
                preview_data = self._format_preview_data(zones_data, format, export_request)
                previews[format.value] = preview_data
            
            # Calculate estimated sizes
            total_zones = await self._count_zones(document_id, export_request)
            estimated_sizes = self._estimate_file_sizes(total_zones, export_request.formats)
            
            return {
                "document_id": str(document_id),
                "document_name": document_data.get("filename", "Unknown"),
                "total_zones": total_zones,
                "preview_zones": len(zones_data),
                "formats": [f.value for f in export_request.formats],
                "previews": previews,
                "estimated_sizes": estimated_sizes,
                "export_options": export_request.options.dict()
            }
        
        except Exception as e:
            logger.error(f"Error generating export preview: {e}")
            raise
    
    async def validate_export_request(self, export_request: ExportRequest) -> ValidationResult:
        """Validate export request"""
        try:
            document_id = export_request.document_id
            errors = []
            warnings = []
            suggestions = []
            
            # Check if document exists
            if not await self.document_exists(document_id):
                errors.append(f"Document {document_id} not found")
                return ValidationResult(
                    is_valid=False,
                    errors=errors,
                    warnings=warnings,
                    suggestions=suggestions,
                    score=0.0
                )
            
            # Get zone count
            zone_count = await self._count_zones(document_id, export_request)
            
            # Validate zone count
            if zone_count == 0:
                errors.append("No zones found matching the selection criteria")
            elif zone_count > 10000:
                warnings.append(f"Large export: {zone_count} zones. This may take some time.")
                suggestions.append("Consider using partial export or filtering by zone type")
            
            # Validate formats
            for format in export_request.formats:
                if format == ExportFormat.PDF:
                    warnings.append("PDF export is not yet supported")
                elif format == ExportFormat.DOCX:
                    warnings.append("DOCX export is not yet supported")
            
            # Calculate validation score
            score = 100.0
            score -= len(errors) * 25
            score -= len(warnings) * 10
            score = max(0.0, min(100.0, score))
            
            return ValidationResult(
                is_valid=len(errors) == 0,
                errors=errors,
                warnings=warnings,
                suggestions=suggestions,
                score=score
            )
        
        except Exception as e:
            logger.error(f"Error validating export request: {e}")
            return ValidationResult(
                is_valid=False,
                errors=[str(e)],
                warnings=[],
                suggestions=[],
                score=0.0
            )
    
    async def _get_document_data(self, document_id: uuid.UUID) -> Optional[Dict[str, Any]]:
        """Get document data"""
        try:
            async with self.db_pool.acquire() as conn:
                row = await conn.fetchrow(
                    "SELECT * FROM pdf_processing.documents WHERE id = $1",
                    document_id
                )
            return dict(row) if row else None
        except Exception as e:
            logger.error(f"Error getting document data: {e}")
            return None
    
    async def _get_zones_data(
        self, 
        document_id: uuid.UUID, 
        export_request: ExportRequest,
        limit: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """Get zones data based on selection criteria"""
        try:
            query = "SELECT * FROM pdf_processing.zones WHERE document_id = $1"
            params = [document_id]
            param_count = 2
            
            # Apply selection filters
            if export_request.selection:
                if export_request.selection.zone_types:
                    query += f" AND zone_type = ANY(${param_count})"
                    params.append(export_request.selection.zone_types)
                    param_count += 1
                
                if export_request.selection.confidence_threshold is not None:
                    query += f" AND confidence >= ${param_count}"
                    params.append(export_request.selection.confidence_threshold)
                    param_count += 1
            
            query += " ORDER BY page_number, zone_order"
            
            if limit:
                query += f" LIMIT ${param_count}"
                params.append(limit)
            
            async with self.db_pool.acquire() as conn:
                rows = await conn.fetch(query, *params)
            
            return [dict(row) for row in rows]
        
        except Exception as e:
            logger.error(f"Error getting zones data: {e}")
            return []
    
    async def _count_zones(
        self, 
        document_id: uuid.UUID, 
        export_request: ExportRequest
    ) -> int:
        """Count zones matching selection criteria"""
        try:
            query = "SELECT COUNT(*) FROM pdf_processing.zones WHERE document_id = $1"
            params = [document_id]
            param_count = 2
            
            # Apply selection filters
            if export_request.selection:
                if export_request.selection.zone_types:
                    query += f" AND zone_type = ANY(${param_count})"
                    params.append(export_request.selection.zone_types)
                    param_count += 1
                
                if export_request.selection.confidence_threshold is not None:
                    query += f" AND confidence >= ${param_count}"
                    params.append(export_request.selection.confidence_threshold)
            
            async with self.db_pool.acquire() as conn:
                count = await conn.fetchval(query, *params)
            
            return count or 0
        
        except Exception as e:
            logger.error(f"Error counting zones: {e}")
            return 0
    
    def _format_preview_data(
        self, 
        zones_data: List[Dict[str, Any]], 
        format: ExportFormat,
        export_request: ExportRequest
    ) -> Any:
        """Format preview data based on export format"""
        if format == ExportFormat.JSON:
            return self._format_json_preview(zones_data, export_request)
        elif format == ExportFormat.JSONL:
            return self._format_jsonl_preview(zones_data, export_request)
        elif format == ExportFormat.CSV:
            return self._format_csv_preview(zones_data, export_request)
        elif format == ExportFormat.TXT:
            return self._format_txt_preview(zones_data, export_request)
        else:
            return {"error": f"Preview not available for format {format.value}"}
    
    def _format_json_preview(self, zones_data: List[Dict[str, Any]], export_request: ExportRequest) -> Dict[str, Any]:
        """Format JSON preview"""
        preview_data = []
        for zone in zones_data[:5]:  # Show first 5 zones
            zone_dict = {
                "id": str(zone.get("id")),
                "type": zone.get("zone_type"),
                "content": zone.get("content", "")[:200] + "..." if len(zone.get("content", "")) > 200 else zone.get("content", ""),
                "page": zone.get("page_number")
            }
            
            if export_request.options.include_confidence:
                zone_dict["confidence"] = zone.get("confidence")
            
            if export_request.options.include_coordinates:
                zone_dict["coordinates"] = zone.get("coordinates")
            
            preview_data.append(zone_dict)
        
        return {
            "zones": preview_data,
            "total_zones": len(zones_data),
            "preview_count": len(preview_data)
        }
    
    def _format_jsonl_preview(self, zones_data: List[Dict[str, Any]], export_request: ExportRequest) -> List[str]:
        """Format JSONL preview"""
        lines = []
        for zone in zones_data[:5]:
            zone_dict = {
                "id": str(zone.get("id")),
                "content": zone.get("content", "")[:200] + "..." if len(zone.get("content", "")) > 200 else zone.get("content", "")
            }
            lines.append(json.dumps(zone_dict))
        return lines
    
    def _format_csv_preview(self, zones_data: List[Dict[str, Any]], export_request: ExportRequest) -> List[List[str]]:
        """Format CSV preview"""
        headers = ["ID", "Type", "Page", "Content"]
        if export_request.options.include_confidence:
            headers.append("Confidence")
        
        rows = [headers]
        for zone in zones_data[:5]:
            row = [
                str(zone.get("id")),
                zone.get("zone_type", ""),
                str(zone.get("page_number", "")),
                zone.get("content", "")[:100] + "..." if len(zone.get("content", "")) > 100 else zone.get("content", "")
            ]
            if export_request.options.include_confidence:
                row.append(str(zone.get("confidence", "")))
            rows.append(row)
        
        return rows
    
    def _format_txt_preview(self, zones_data: List[Dict[str, Any]], export_request: ExportRequest) -> str:
        """Format TXT preview"""
        lines = []
        for zone in zones_data[:5]:
            content = zone.get("content", "")
            preview = content[:200] + "..." if len(content) > 200 else content
            lines.append(f"[Page {zone.get('page_number', 'N/A')}] {preview}")
        return "\n\n".join(lines)
    
    def _estimate_file_sizes(self, zone_count: int, formats: List[ExportFormat]) -> Dict[str, str]:
        """Estimate file sizes for each format"""
        # Rough estimates based on average zone size
        avg_zone_size = 500  # bytes
        estimates = {}
        
        for format in formats:
            if format == ExportFormat.JSON:
                size = zone_count * avg_zone_size * 1.5  # JSON overhead
            elif format == ExportFormat.JSONL:
                size = zone_count * avg_zone_size * 1.2
            elif format == ExportFormat.CSV:
                size = zone_count * avg_zone_size * 0.8
            elif format == ExportFormat.TXT:
                size = zone_count * avg_zone_size * 0.6
            else:
                size = zone_count * avg_zone_size
            
            # Format size
            for unit in ['B', 'KB', 'MB', 'GB']:
                if size < 1024:
                    estimates[format.value] = f"{size:.1f} {unit}"
                    break
                size /= 1024
        
        return estimates
    
    async def _generate_export_file(
        self,
        export_id: uuid.UUID,
        document_data: Dict[str, Any],
        zones_data: List[Dict[str, Any]],
        format: ExportFormat,
        export_request: ExportRequest
    ) -> tuple[str, int]:
        """Generate export file and return path and size"""
        try:
            # Create export directory if it doesn't exist
            export_dir = f"exports/{export_id}"
            os.makedirs(export_dir, exist_ok=True)
            
            # Generate filename
            filename = f"{document_data.get('filename', 'export').split('.')[0]}_{format.value}.{self._get_file_extension(format)}"
            file_path = os.path.join(export_dir, filename)
            
            # Generate file content based on format
            if format == ExportFormat.JSON:
                await self._generate_json_file(file_path, zones_data, export_request)
            elif format == ExportFormat.JSONL:
                await self._generate_jsonl_file(file_path, zones_data, export_request)
            elif format == ExportFormat.CSV:
                await self._generate_csv_file(file_path, zones_data, export_request)
            elif format == ExportFormat.TXT:
                await self._generate_txt_file(file_path, zones_data, export_request)
            else:
                raise ValueError(f"Unsupported format: {format.value}")
            
            # Get file size
            file_size = os.path.getsize(file_path)
            
            return file_path, file_size
        
        except Exception as e:
            logger.error(f"Error generating export file: {e}")
            raise
    
    def _get_file_extension(self, format: ExportFormat) -> str:
        """Get file extension for format"""
        extensions = {
            ExportFormat.JSON: "json",
            ExportFormat.JSONL: "jsonl",
            ExportFormat.CSV: "csv",
            ExportFormat.TXT: "txt",
            ExportFormat.MD: "md",
            ExportFormat.XML: "xml"
        }
        return extensions.get(format, "dat")
    
    async def _generate_json_file(self, file_path: str, zones_data: List[Dict[str, Any]], export_request: ExportRequest):
        """Generate JSON export file"""
        export_data = {
            "export_metadata": {
                "export_date": datetime.utcnow().isoformat(),
                "total_zones": len(zones_data),
                "export_options": export_request.options.dict()
            },
            "zones": []
        }
        
        for zone in zones_data:
            zone_dict = {
                "id": str(zone.get("id")),
                "type": zone.get("zone_type"),
                "content": zone.get("content", ""),
                "page_number": zone.get("page_number"),
                "zone_order": zone.get("zone_order")
            }
            
            if export_request.options.include_metadata:
                zone_dict["metadata"] = zone.get("metadata", {})
            
            if export_request.options.include_confidence:
                zone_dict["confidence"] = zone.get("confidence")
            
            if export_request.options.include_coordinates:
                zone_dict["coordinates"] = zone.get("coordinates")
            
            if export_request.options.include_timestamps:
                zone_dict["created_at"] = zone.get("created_at").isoformat() if zone.get("created_at") else None
                zone_dict["updated_at"] = zone.get("updated_at").isoformat() if zone.get("updated_at") else None
            
            export_data["zones"].append(zone_dict)
        
        async with aiofiles.open(file_path, 'w') as f:
            await f.write(json.dumps(export_data, indent=2))
    
    async def _generate_jsonl_file(self, file_path: str, zones_data: List[Dict[str, Any]], export_request: ExportRequest):
        """Generate JSONL export file for RAG chunks"""
        async with aiofiles.open(file_path, 'w') as f:
            for zone in zones_data:
                # Create RAG-friendly chunk
                chunk = {
                    "id": str(zone.get("id")),
                    "document_id": str(zone.get("document_id")),
                    "content": zone.get("content", ""),
                    "metadata": {
                        "page_number": zone.get("page_number"),
                        "zone_type": zone.get("zone_type"),
                        "zone_order": zone.get("zone_order")
                    }
                }
                
                if export_request.options.include_confidence:
                    chunk["metadata"]["confidence"] = zone.get("confidence")
                
                if export_request.options.include_coordinates:
                    chunk["metadata"]["coordinates"] = zone.get("coordinates")
                
                await f.write(json.dumps(chunk) + "\n")
    
    async def _generate_csv_file(self, file_path: str, zones_data: List[Dict[str, Any]], export_request: ExportRequest):
        """Generate CSV export file"""
        import csv
        import io
        
        # Define headers
        headers = ["id", "type", "page_number", "zone_order", "content"]
        
        if export_request.options.include_confidence:
            headers.append("confidence")
        
        if export_request.options.include_timestamps:
            headers.extend(["created_at", "updated_at"])
        
        # Write CSV
        output = io.StringIO()
        writer = csv.DictWriter(output, fieldnames=headers)
        writer.writeheader()
        
        for zone in zones_data:
            row = {
                "id": str(zone.get("id")),
                "type": zone.get("zone_type"),
                "page_number": zone.get("page_number"),
                "zone_order": zone.get("zone_order"),
                "content": zone.get("content", "")
            }
            
            if export_request.options.include_confidence:
                row["confidence"] = zone.get("confidence")
            
            if export_request.options.include_timestamps:
                row["created_at"] = zone.get("created_at").isoformat() if zone.get("created_at") else ""
                row["updated_at"] = zone.get("updated_at").isoformat() if zone.get("updated_at") else ""
            
            writer.writerow(row)
        
        async with aiofiles.open(file_path, 'w') as f:
            await f.write(output.getvalue())
    
    async def _generate_txt_file(self, file_path: str, zones_data: List[Dict[str, Any]], export_request: ExportRequest):
        """Generate TXT export file"""
        async with aiofiles.open(file_path, 'w') as f:
            current_page = None
            
            for zone in zones_data:
                page_num = zone.get("page_number")
                
                # Add page separator
                if current_page != page_num:
                    if current_page is not None:
                        await f.write("\n" + "="*80 + "\n\n")
                    await f.write(f"Page {page_num}\n" + "-"*40 + "\n\n")
                    current_page = page_num
                
                # Write content
                content = zone.get("content", "")
                if export_request.options.include_metadata:
                    zone_type = zone.get("zone_type", "unknown")
                    await f.write(f"[{zone_type}] ")
                
                await f.write(content + "\n\n") 