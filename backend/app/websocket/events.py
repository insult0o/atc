"""
WebSocket event system for structured messaging
"""

from enum import Enum
from pydantic import BaseModel, Field
from typing import Any, Dict, Optional
from datetime import datetime
import uuid

class EventType(str, Enum):
    """WebSocket event types"""
    
    # Connection events
    CONNECTION_ESTABLISHED = "connection_established"
    CONNECTION_LOST = "connection_lost"
    RECONNECTED = "reconnected"
    PING = "ping"
    PONG = "pong"
    
    # User events
    USER_JOINED_ROOM = "user_joined_room"
    USER_LEFT_ROOM = "user_left_room"
    USER_STATUS_CHANGED = "user_status_changed"
    
    # Processing events
    PROCESSING_STARTED = "processing_started"
    PROCESSING_PROGRESS = "processing_progress"
    PROCESSING_COMPLETED = "processing_completed"
    PROCESSING_FAILED = "processing_failed"
    PROCESSING_CANCELLED = "processing_cancelled"
    PROCESSING_PAUSED = "processing_paused"
    PROCESSING_RESUMED = "processing_resumed"
    
    # Zone events
    ZONE_PROCESSING_STARTED = "zone_processing_started"
    ZONE_PROCESSING_PROGRESS = "zone_processing_progress"
    ZONE_PROCESSING_COMPLETED = "zone_processing_completed"
    ZONE_PROCESSING_FAILED = "zone_processing_failed"
    ZONE_UPDATED = "zone_updated"
    ZONE_CORRECTED = "zone_corrected"
    
    # Export events
    EXPORT_STARTED = "export_started"
    EXPORT_PROGRESS = "export_progress"
    EXPORT_COMPLETED = "export_completed"
    EXPORT_FAILED = "export_failed"
    EXPORT_CANCELLED = "export_cancelled"
    EXPORT_DOWNLOADED = "export_downloaded"
    
    # Document events
    DOCUMENT_UPLOADED = "document_uploaded"
    DOCUMENT_UPDATED = "document_updated"
    DOCUMENT_DELETED = "document_deleted"
    DOCUMENT_VALIDATED = "document_validated"
    
    # System events
    SYSTEM_NOTIFICATION = "system_notification"
    ERROR_OCCURRED = "error_occurred"
    MAINTENANCE_MODE = "maintenance_mode"

class WebSocketEvent(BaseModel):
    """Base WebSocket event structure"""
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    type: EventType = Field(..., description="Event type")
    data: Dict[str, Any] = Field(default_factory=dict, description="Event data")
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    user_id: Optional[str] = Field(None, description="Target user ID")
    room_id: Optional[str] = Field(None, description="Target room ID")
    priority: int = Field(default=5, ge=1, le=10, description="Event priority")
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization"""
        return {
            "id": self.id,
            "type": self.type.value,
            "data": self.data,
            "timestamp": self.timestamp.isoformat(),
            "user_id": self.user_id,
            "room_id": self.room_id,
            "priority": self.priority
        }

class ProcessingProgressEvent(WebSocketEvent):
    """Processing progress event with specific data structure"""
    
    type: EventType = EventType.PROCESSING_PROGRESS
    
    def __init__(
        self,
        document_id: str,
        job_id: str,
        progress: float,
        current_zone: Optional[str] = None,
        zones_completed: int = 0,
        zones_total: int = 0,
        estimated_time_remaining: Optional[int] = None,
        current_operation: str = "",
        **kwargs
    ):
        data = {
            "document_id": document_id,
            "job_id": job_id,
            "progress": progress,
            "current_zone": current_zone,
            "zones_completed": zones_completed,
            "zones_total": zones_total,
            "estimated_time_remaining": estimated_time_remaining,
            "current_operation": current_operation
        }
        super().__init__(data=data, **kwargs)

class ZoneProcessingEvent(WebSocketEvent):
    """Zone processing event with specific data structure"""
    
    type: EventType = EventType.ZONE_PROCESSING_PROGRESS
    
    def __init__(
        self,
        document_id: str,
        zone_id: str,
        zone_index: int,
        processing_tool: str,
        status: str,
        confidence: Optional[float] = None,
        duration_ms: Optional[int] = None,
        content_preview: Optional[str] = None,
        **kwargs
    ):
        data = {
            "document_id": document_id,
            "zone_id": zone_id,
            "zone_index": zone_index,
            "processing_tool": processing_tool,
            "status": status,
            "confidence": confidence,
            "duration_ms": duration_ms,
            "content_preview": content_preview
        }
        super().__init__(data=data, **kwargs)

class ExportProgressEvent(WebSocketEvent):
    """Export progress event with specific data structure"""
    
    type: EventType = EventType.EXPORT_PROGRESS
    
    def __init__(
        self,
        document_id: str,
        export_id: str,
        export_type: str,
        formats: list,
        progress: float,
        current_format: Optional[str] = None,
        estimated_time_remaining: Optional[int] = None,
        file_sizes: Optional[Dict[str, int]] = None,
        **kwargs
    ):
        data = {
            "document_id": document_id,
            "export_id": export_id,
            "export_type": export_type,
            "formats": formats,
            "progress": progress,
            "current_format": current_format,
            "estimated_time_remaining": estimated_time_remaining,
            "file_sizes": file_sizes or {}
        }
        super().__init__(data=data, **kwargs)

class DocumentEvent(WebSocketEvent):
    """Document-related event with specific data structure"""
    
    def __init__(
        self,
        event_type: EventType,
        document_id: str,
        document_name: str,
        action: str,
        details: Optional[Dict[str, Any]] = None,
        **kwargs
    ):
        data = {
            "document_id": document_id,
            "document_name": document_name,
            "action": action,
            "details": details or {}
        }
        super().__init__(type=event_type, data=data, **kwargs)

class SystemNotificationEvent(WebSocketEvent):
    """System notification event"""
    
    type: EventType = EventType.SYSTEM_NOTIFICATION
    
    def __init__(
        self,
        title: str,
        message: str,
        notification_type: str = "info",
        action_url: Optional[str] = None,
        auto_dismiss: bool = True,
        dismiss_after: int = 5000,
        **kwargs
    ):
        data = {
            "title": title,
            "message": message,
            "notification_type": notification_type,
            "action_url": action_url,
            "auto_dismiss": auto_dismiss,
            "dismiss_after": dismiss_after
        }
        super().__init__(data=data, **kwargs)

class ErrorEvent(WebSocketEvent):
    """Error event for reporting issues"""
    
    type: EventType = EventType.ERROR_OCCURRED
    
    def __init__(
        self,
        error_code: str,
        error_message: str,
        error_details: Optional[Dict[str, Any]] = None,
        recoverable: bool = True,
        retry_action: Optional[str] = None,
        **kwargs
    ):
        data = {
            "error_code": error_code,
            "error_message": error_message,
            "error_details": error_details or {},
            "recoverable": recoverable,
            "retry_action": retry_action
        }
        super().__init__(data=data, priority=8, **kwargs)  # High priority for errors

class EventEmitter:
    """Event emitter for creating and sending events"""
    
    def __init__(self, connection_manager):
        self.connection_manager = connection_manager
    
    async def emit_processing_started(
        self, 
        document_id: str, 
        job_id: str, 
        user_id: str,
        strategy: str = "auto"
    ):
        """Emit processing started event"""
        event = WebSocketEvent(
            type=EventType.PROCESSING_STARTED,
            data={
                "document_id": document_id,
                "job_id": job_id,
                "strategy": strategy,
                "started_at": datetime.utcnow().isoformat()
            },
            user_id=user_id
        )
        
        await self.connection_manager.broadcast_to_user(user_id, event)
        await self.connection_manager.broadcast_to_room(f"document:{document_id}", event)
    
    async def emit_processing_progress(
        self,
        progress_event: ProcessingProgressEvent,
        user_id: str
    ):
        """Emit processing progress event"""
        await self.connection_manager.broadcast_to_user(user_id, progress_event)
        await self.connection_manager.broadcast_to_room(
            f"document:{progress_event.data['document_id']}", 
            progress_event
        )
    
    async def emit_zone_processing(
        self,
        zone_event: ZoneProcessingEvent,
        user_id: str
    ):
        """Emit zone processing event"""
        await self.connection_manager.broadcast_to_user(user_id, zone_event)
        await self.connection_manager.broadcast_to_room(
            f"document:{zone_event.data['document_id']}", 
            zone_event
        )
    
    async def emit_export_progress(
        self,
        export_event: ExportProgressEvent,
        user_id: str
    ):
        """Emit export progress event"""
        await self.connection_manager.broadcast_to_user(user_id, export_event)
        await self.connection_manager.broadcast_to_room(
            f"document:{export_event.data['document_id']}", 
            export_event
        )
    
    async def emit_document_event(
        self,
        document_event: DocumentEvent,
        user_id: str
    ):
        """Emit document-related event"""
        await self.connection_manager.broadcast_to_user(user_id, document_event)
        await self.connection_manager.broadcast_to_room(
            f"document:{document_event.data['document_id']}", 
            document_event
        )
    
    async def emit_system_notification(
        self,
        notification: SystemNotificationEvent,
        target_user: Optional[str] = None,
        target_room: Optional[str] = None
    ):
        """Emit system notification"""
        if target_user:
            await self.connection_manager.broadcast_to_user(target_user, notification)
        elif target_room:
            await self.connection_manager.broadcast_to_room(target_room, notification)
        else:
            await self.connection_manager.broadcast_to_all(notification)
    
    async def emit_error(
        self,
        error_event: ErrorEvent,
        user_id: str
    ):
        """Emit error event"""
        await self.connection_manager.broadcast_to_user(user_id, error_event) 