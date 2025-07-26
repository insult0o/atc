"""
Processing progress event emitter for real-time updates
"""
import asyncio
import uuid
from datetime import datetime
from typing import Dict, Optional, Any, List
from enum import Enum

from .events import EventEmitter, EventType, ProcessingProgressEvent, ZoneProcessingEvent
from .manager import ConnectionManager


class ProgressStage(str, Enum):
    """Processing stages for progress tracking"""
    INITIALIZING = "initializing"
    PREPROCESSING = "preprocessing"
    ANALYZING = "analyzing"
    ZONE_DETECTION = "zone_detection"
    TEXT_EXTRACTION = "text_extraction"
    POST_PROCESSING = "post_processing"
    FINALIZING = "finalizing"
    COMPLETED = "completed"
    FAILED = "failed"


class ProcessingProgressEmitter:
    """Handles real-time processing progress updates"""
    
    def __init__(self, connection_manager: ConnectionManager):
        self.connection_manager = connection_manager
        self.event_emitter = EventEmitter(connection_manager)
        self.active_jobs: Dict[str, Dict[str, Any]] = {}
        
    async def start_job_tracking(
        self,
        job_id: str,
        document_id: str,
        user_id: str,
        total_pages: int = 1,
        estimated_duration: Optional[int] = None
    ) -> None:
        """Start tracking a processing job"""
        self.active_jobs[job_id] = {
            "document_id": document_id,
            "user_id": user_id,
            "total_pages": total_pages,
            "current_page": 0,
            "stage": ProgressStage.INITIALIZING,
            "progress_percentage": 0,
            "start_time": datetime.utcnow(),
            "estimated_duration": estimated_duration,
            "zones_processed": 0,
            "zones_detected": 0,
            "errors": [],
            "last_update": datetime.utcnow()
        }
        
        # Join user to job-specific room
        room_id = f"job_{job_id}"
        await self.connection_manager.join_room(user_id, room_id)
        
        # Send initial progress event
        await self.emit_progress_update(job_id)
        
    async def update_stage(
        self,
        job_id: str,
        stage: ProgressStage,
        message: Optional[str] = None
    ) -> None:
        """Update the current processing stage"""
        if job_id not in self.active_jobs:
            return
            
        job = self.active_jobs[job_id]
        job["stage"] = stage
        job["last_update"] = datetime.utcnow()
        
        # Update progress percentage based on stage
        stage_progress = {
            ProgressStage.INITIALIZING: 5,
            ProgressStage.PREPROCESSING: 15,
            ProgressStage.ANALYZING: 25,
            ProgressStage.ZONE_DETECTION: 45,
            ProgressStage.TEXT_EXTRACTION: 75,
            ProgressStage.POST_PROCESSING: 90,
            ProgressStage.FINALIZING: 95,
            ProgressStage.COMPLETED: 100,
            ProgressStage.FAILED: job["progress_percentage"]  # Keep current on failure
        }
        
        if stage != ProgressStage.FAILED:
            job["progress_percentage"] = stage_progress.get(stage, job["progress_percentage"])
        
        await self.emit_progress_update(job_id, message)
        
    async def update_page_progress(
        self,
        job_id: str,
        current_page: int,
        zones_on_page: int = 0
    ) -> None:
        """Update page-level progress"""
        if job_id not in self.active_jobs:
            return
            
        job = self.active_jobs[job_id]
        job["current_page"] = current_page
        job["zones_detected"] += zones_on_page
        job["last_update"] = datetime.utcnow()
        
        # Calculate detailed progress within current stage
        if job["total_pages"] > 0:
            page_progress = (current_page / job["total_pages"]) * 100
            
            # Adjust based on current stage
            stage_weight = {
                ProgressStage.ZONE_DETECTION: 0.3,
                ProgressStage.TEXT_EXTRACTION: 0.4,
                ProgressStage.POST_PROCESSING: 0.2
            }
            
            if job["stage"] in stage_weight:
                base_progress = {
                    ProgressStage.ZONE_DETECTION: 25,
                    ProgressStage.TEXT_EXTRACTION: 45,
                    ProgressStage.POST_PROCESSING: 75
                }[job["stage"]]
                
                stage_contribution = page_progress * stage_weight[job["stage"]]
                job["progress_percentage"] = min(base_progress + stage_contribution, 95)
        
        await self.emit_progress_update(job_id)
        
    async def add_zone_processed(
        self,
        job_id: str,
        zone_id: str,
        zone_type: str,
        confidence: float,
        processing_time: float,
        error: Optional[str] = None
    ) -> None:
        """Add a processed zone update"""
        if job_id not in self.active_jobs:
            return
            
        job = self.active_jobs[job_id]
        job["zones_processed"] += 1
        job["last_update"] = datetime.utcnow()
        
        if error:
            job["errors"].append({
                "zone_id": zone_id,
                "error": error,
                "timestamp": datetime.utcnow().isoformat()
            })
        
        # Emit zone-specific event
        zone_event = ZoneProcessingEvent(
            type=EventType.ZONE_PROCESSED,
            data={
                "job_id": job_id,
                "zone_id": zone_id,
                "zone_type": zone_type,
                "confidence": confidence,
                "processing_time": processing_time,
                "error": error,
                "zones_completed": job["zones_processed"],
                "zones_total": job["zones_detected"]
            },
            user_id=job["user_id"],
            room_id=f"job_{job_id}"
        )
        
        await self.event_emitter.emit_event(zone_event)
        await self.emit_progress_update(job_id)
        
    async def add_error(
        self,
        job_id: str,
        error_message: str,
        error_code: Optional[str] = None,
        recoverable: bool = True
    ) -> None:
        """Add an error to the job"""
        if job_id not in self.active_jobs:
            return
            
        job = self.active_jobs[job_id]
        error_entry = {
            "message": error_message,
            "code": error_code,
            "recoverable": recoverable,
            "timestamp": datetime.utcnow().isoformat()
        }
        
        job["errors"].append(error_entry)
        job["last_update"] = datetime.utcnow()
        
        if not recoverable:
            job["stage"] = ProgressStage.FAILED
        
        await self.emit_progress_update(job_id)
        
    async def complete_job(
        self,
        job_id: str,
        success: bool = True,
        final_message: Optional[str] = None
    ) -> None:
        """Mark job as completed"""
        if job_id not in self.active_jobs:
            return
            
        job = self.active_jobs[job_id]
        job["stage"] = ProgressStage.COMPLETED if success else ProgressStage.FAILED
        job["progress_percentage"] = 100 if success else job["progress_percentage"]
        job["end_time"] = datetime.utcnow()
        job["last_update"] = datetime.utcnow()
        
        # Calculate actual duration
        if "start_time" in job:
            duration = (job["end_time"] - job["start_time"]).total_seconds()
            job["actual_duration"] = duration
        
        await self.emit_progress_update(job_id, final_message)
        
        # Schedule cleanup
        asyncio.create_task(self._cleanup_job_after_delay(job_id, delay=300))  # 5 minutes
        
    async def emit_progress_update(
        self,
        job_id: str,
        message: Optional[str] = None
    ) -> None:
        """Emit a progress update event"""
        if job_id not in self.active_jobs:
            return
            
        job = self.active_jobs[job_id]
        
        # Calculate estimated time remaining
        eta_seconds = None
        if job["progress_percentage"] > 0 and "start_time" in job:
            elapsed = (datetime.utcnow() - job["start_time"]).total_seconds()
            if job["progress_percentage"] < 100:
                total_estimated = elapsed * (100 / job["progress_percentage"])
                eta_seconds = max(0, total_estimated - elapsed)
        
        progress_event = ProcessingProgressEvent(
            type=EventType.PROCESSING_PROGRESS,
            data={
                "job_id": job_id,
                "document_id": job["document_id"],
                "stage": job["stage"].value,
                "progress_percentage": job["progress_percentage"],
                "current_page": job["current_page"],
                "total_pages": job["total_pages"],
                "zones_processed": job["zones_processed"],
                "zones_detected": job["zones_detected"],
                "eta_seconds": eta_seconds,
                "message": message,
                "errors_count": len(job["errors"]),
                "last_error": job["errors"][-1] if job["errors"] else None
            },
            user_id=job["user_id"],
            room_id=f"job_{job_id}"
        )
        
        await self.event_emitter.emit_event(progress_event)
        
    async def get_job_status(self, job_id: str) -> Optional[Dict[str, Any]]:
        """Get current job status"""
        return self.active_jobs.get(job_id)
        
    async def cancel_job(self, job_id: str) -> None:
        """Cancel a job"""
        if job_id in self.active_jobs:
            await self.add_error(
                job_id,
                "Job cancelled by user",
                "JOB_CANCELLED",
                recoverable=False
            )
            await self.complete_job(job_id, success=False, final_message="Job cancelled")
            
    async def get_active_jobs(self, user_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get list of active jobs, optionally filtered by user"""
        if user_id:
            return [
                {**job, "job_id": job_id}
                for job_id, job in self.active_jobs.items()
                if job["user_id"] == user_id
            ]
        
        return [
            {**job, "job_id": job_id}
            for job_id, job in self.active_jobs.items()
        ]
        
    async def _cleanup_job_after_delay(self, job_id: str, delay: int) -> None:
        """Clean up job data after delay"""
        await asyncio.sleep(delay)
        if job_id in self.active_jobs:
            job = self.active_jobs[job_id]
            room_id = f"job_{job_id}"
            
            # Remove user from job room
            await self.connection_manager.leave_room(job["user_id"], room_id)
            
            # Remove job data
            del self.active_jobs[job_id] 