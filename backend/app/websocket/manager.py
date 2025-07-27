"""
WebSocket connection manager for handling client connections and broadcasting
"""

from fastapi import WebSocket, WebSocketDisconnect
from typing import Dict, Set, Optional, Any, List
import json
import asyncio
import uuid
import logging
from datetime import datetime
from collections import defaultdict

from app.websocket.events import EventType
from app.websocket.queue import MessageQueue

logger = logging.getLogger(__name__)

class ConnectionManager:
    """Manages WebSocket connections, rooms, and message broadcasting"""
    
    def __init__(self, message_queue: Optional["MessageQueue"] = None):
        # Active connections: client_id -> WebSocket
        self.active_connections: Dict[str, WebSocket] = {}
        
        # User connections: user_id -> Set[client_id]
        self.user_connections: Dict[str, Set[str]] = defaultdict(set)
        
        # Room memberships: room_id -> Set[client_id]  
        self.rooms: Dict[str, Set[str]] = defaultdict(set)
        
        # Client metadata: client_id -> metadata dict
        self.client_metadata: Dict[str, Dict[str, Any]] = {}
        
        # Message queue for reliability
        if message_queue:
            self.message_queue = message_queue
        else:
            from .queue import MessageQueue
            self.message_queue = MessageQueue()
        
        # Connection statistics
        self.connection_stats = {
            "total_connections": 0,
            "active_connections": 0,
            "messages_sent": 0,
            "messages_failed": 0,
            "reconnections": 0
        }
        
        # Background task handles
        self._message_queue_task: Optional[asyncio.Task] = None
        self._cleanup_task: Optional[asyncio.Task] = None
        self._running = False
    
    async def connect(
        self, 
        websocket: WebSocket, 
        user_id: str,
        metadata: Optional[Dict[str, Any]] = None
    ) -> str:
        """Accept new WebSocket connection and register client"""
        client_id = str(uuid.uuid4())
        
        try:
            await websocket.accept()
            
            # Store connection
            self.active_connections[client_id] = websocket
            self.user_connections[user_id].add(client_id)
            self.client_metadata[client_id] = {
                "user_id": user_id,
                "user_name": metadata.get("user_name", f"User {user_id[:8]}") if metadata else f"User {user_id[:8]}",
                "user_color": metadata.get("user_color", self._generate_user_color(user_id)) if metadata else self._generate_user_color(user_id),
                "user_avatar": metadata.get("user_avatar") if metadata else None,
                "connected_at": datetime.utcnow(),
                "last_ping": datetime.utcnow(),
                "rooms": set(),
                **(metadata or {})
            }
            
            # Update stats
            self.connection_stats["total_connections"] += 1
            self.connection_stats["active_connections"] = len(self.active_connections)
            
            # Send connection confirmation
            await self.send_personal_message(
                client_id,
                {
                    "type": EventType.CONNECTION_ESTABLISHED.value,
                    "data": {
                        "client_id": client_id,
                        "user_id": user_id,
                        "server_time": datetime.utcnow().isoformat(),
                        "capabilities": [
                            "processing_updates", 
                            "export_updates", 
                            "zone_updates",
                            "collaborative_editing",
                            "user_presence",
                            "conflict_resolution"
                        ]
                    }
                }
            )
            
            logger.info(f"WebSocket connected: {client_id} (user: {user_id})")
            return client_id
            
        except Exception as e:
            logger.error(f"Error connecting WebSocket {client_id}: {e}")
            await self._cleanup_connection(client_id)
            raise
    
    async def disconnect(self, client_id: str, reason: str = "client_disconnect"):
        """Handle client disconnection"""
        try:
            if client_id in self.active_connections:
                metadata = self.client_metadata.get(client_id, {})
                user_id = metadata.get("user_id")
                
                # Notify other clients in user's rooms
                await self._broadcast_user_status(user_id, "disconnected", {"reason": reason})
                
                # Clean up connection
                await self._cleanup_connection(client_id)
                
                logger.info(f"WebSocket disconnected: {client_id} (reason: {reason})")
            
        except Exception as e:
            logger.error(f"Error disconnecting WebSocket {client_id}: {e}")
    
    async def send_personal_message(self, client_id: str, event: Any) -> bool:
        """Send message to specific client"""
        try:
            if client_id not in self.active_connections:
                logger.warning(f"Attempted to send message to disconnected client: {client_id}")
                return False
            
            websocket = self.active_connections[client_id]
            
            # Handle different message types
            if hasattr(event, 'to_dict'):
                message_data = event.to_dict()
            elif hasattr(event, 'model_dump'):
                message_data = event.model_dump()
            elif isinstance(event, dict):
                message_data = event
            else:
                message_data = {"data": event}
            
            # Add message to queue for reliability
            message_id = self.message_queue.add_message(message_data, client_id)
            
            # Send message
            await websocket.send_text(json.dumps(message_data))
            
            # Confirm delivery
            self.message_queue.confirm_message(message_id)
            self.connection_stats["messages_sent"] += 1
            
            return True
            
        except WebSocketDisconnect:
            await self.disconnect(client_id, "websocket_disconnect")
            return False
        except Exception as e:
            logger.error(f"Error sending message to {client_id}: {e}")
            self.connection_stats["messages_failed"] += 1
            return False
    
    async def broadcast_to_user(self, user_id: str, event: Any) -> int:
        """Send message to all connections for a user"""
        sent_count = 0
        client_ids = self.user_connections.get(user_id, set()).copy()
        
        for client_id in client_ids:
            if await self.send_personal_message(client_id, event):
                sent_count += 1
        
        return sent_count
    
    async def broadcast_to_room(self, room_id: str, event: Any, exclude_client: Optional[str] = None) -> int:
        """Send message to all clients in a room"""
        sent_count = 0
        client_ids = self.rooms.get(room_id, set()).copy()
        
        for client_id in client_ids:
            if client_id != exclude_client:
                if await self.send_personal_message(client_id, event):
                    sent_count += 1
        
        return sent_count
    
    async def broadcast_to_all(self, event: Any, exclude_client: Optional[str] = None) -> int:
        """Send message to all connected clients"""
        sent_count = 0
        client_ids = list(self.active_connections.keys())
        
        for client_id in client_ids:
            if client_id != exclude_client:
                if await self.send_personal_message(client_id, event):
                    sent_count += 1
        
        return sent_count
    
    async def join_room(self, client_id: str, room_id: str):
        """Add client to a room"""
        if client_id in self.active_connections:
            self.rooms[room_id].add(client_id)
            
            # Update client metadata
            if client_id in self.client_metadata:
                if "rooms" not in self.client_metadata[client_id]:
                    self.client_metadata[client_id]["rooms"] = set()
                self.client_metadata[client_id]["rooms"].add(room_id)
            
            # Get user metadata
            metadata = self.client_metadata.get(client_id, {})
            
            # If this is a document room, broadcast user presence
            if room_id.startswith("document_"):
                from .events import UserPresenceEvent
                
                # Notify room members about new user
                await self.broadcast_to_room(
                    room_id,
                    UserPresenceEvent(
                        event_type=EventType.USER_JOINED,
                        document_id=room_id.replace("document_", ""),
                        user_id=metadata.get("user_id"),
                        user_name=metadata.get("user_name"),
                        user_avatar=metadata.get("user_avatar"),
                        user_color=metadata.get("user_color")
                    ),
                    exclude_client=client_id
                )
                
                # Send current room members to the new user
                room_members = self.get_room_user_details(room_id)
                await self.send_personal_message(
                    client_id,
                    {
                        "type": EventType.USER_PRESENCE_UPDATE.value,
                        "data": {
                            "room_id": room_id,
                            "members": room_members
                        }
                    }
                )
            else:
                # Standard room join notification
                await self.broadcast_to_room(
                    room_id,
                    {
                        "type": EventType.USER_JOINED_ROOM.value,
                        "data": {
                            "client_id": client_id,
                            "room_id": room_id,
                            "user_id": metadata.get("user_id")
                        }
                    },
                    exclude_client=client_id
                )
            
            logger.debug(f"Client {client_id} joined room {room_id}")
    
    async def leave_room(self, client_id: str, room_id: str):
        """Remove client from a room"""
        if room_id in self.rooms:
            self.rooms[room_id].discard(client_id)
            
            # Update client metadata
            if client_id in self.client_metadata and "rooms" in self.client_metadata[client_id]:
                self.client_metadata[client_id]["rooms"].discard(room_id)
            
            # Get user metadata
            metadata = self.client_metadata.get(client_id, {})
            
            # Clean up empty rooms
            if not self.rooms[room_id]:
                del self.rooms[room_id]
            else:
                # If this is a document room, broadcast user left
                if room_id.startswith("document_"):
                    from .events import UserPresenceEvent
                    
                    await self.broadcast_to_room(
                        room_id,
                        UserPresenceEvent(
                            event_type=EventType.USER_LEFT,
                            document_id=room_id.replace("document_", ""),
                            user_id=metadata.get("user_id"),
                            user_name=metadata.get("user_name")
                        )
                    )
                else:
                    # Notify remaining room members
                    await self.broadcast_to_room(
                        room_id,
                        {
                            "type": EventType.USER_LEFT_ROOM.value,
                            "data": {
                                "client_id": client_id,
                                "room_id": room_id,
                                "user_id": metadata.get("user_id")
                            }
                        }
                    )
            
            logger.debug(f"Client {client_id} left room {room_id}")
    
    async def handle_ping(self, client_id: str) -> bool:
        """Handle ping from client"""
        if client_id in self.client_metadata:
            self.client_metadata[client_id]["last_ping"] = datetime.utcnow()
            
            # Send pong response
            await self.send_personal_message(
                client_id,
                {
                    "type": EventType.PONG.value,
                    "data": {"timestamp": datetime.utcnow().isoformat()}
                }
            )
            return True
        return False
    
    def get_connection_info(self, client_id: str) -> Optional[Dict[str, Any]]:
        """Get connection information for a client"""
        if client_id in self.active_connections:
            metadata = self.client_metadata.get(client_id, {})
            return {
                "client_id": client_id,
                "user_id": metadata.get("user_id"),
                "connected_at": metadata.get("connected_at"),
                "last_ping": metadata.get("last_ping"),
                "is_connected": True
            }
        return None
    
    def get_user_connections(self, user_id: str) -> List[str]:
        """Get all connection IDs for a user"""
        return list(self.user_connections.get(user_id, set()))
    
    def get_room_members(self, room_id: str) -> List[str]:
        """Get all client IDs in a room"""
        return list(self.rooms.get(room_id, set()))
    
    def get_statistics(self) -> Dict[str, Any]:
        """Get connection statistics"""
        return {
            **self.connection_stats,
            "active_connections": len(self.active_connections),
            "unique_users": len(self.user_connections),
            "active_rooms": len(self.rooms),
            "queue_size": self.message_queue._get_total_queue_size()
        }
    
    async def _cleanup_connection(self, client_id: str):
        """Clean up all connection data"""
        try:
            # Remove from active connections
            if client_id in self.active_connections:
                del self.active_connections[client_id]
            
            # Remove from user connections
            metadata = self.client_metadata.get(client_id, {})
            user_id = metadata.get("user_id")
            if user_id and user_id in self.user_connections:
                self.user_connections[user_id].discard(client_id)
                if not self.user_connections[user_id]:
                    del self.user_connections[user_id]
            
            # Remove from all rooms
            rooms_to_clean = []
            for room_id, members in self.rooms.items():
                if client_id in members:
                    members.discard(client_id)
                    if not members:
                        rooms_to_clean.append(room_id)
            
            for room_id in rooms_to_clean:
                del self.rooms[room_id]
            
            # Remove metadata
            if client_id in self.client_metadata:
                del self.client_metadata[client_id]
            
            # Update stats
            self.connection_stats["active_connections"] = len(self.active_connections)
            
        except Exception as e:
            logger.error(f"Error cleaning up connection {client_id}: {e}")
    
    async def _broadcast_user_status(self, user_id: str, status: str, details: Dict[str, Any]):
        """Broadcast user status change to relevant rooms"""
        try:
            # Find rooms where user has connections
            user_rooms = set()
            for room_id, members in self.rooms.items():
                for client_id in members:
                    if self.client_metadata.get(client_id, {}).get("user_id") == user_id:
                        user_rooms.add(room_id)
                        break
            
            # Broadcast to all relevant rooms
            event = {
                "type": EventType.USER_STATUS_CHANGED.value,
                "data": {
                    "user_id": user_id,
                    "status": status,
                    **details
                }
            }
            
            for room_id in user_rooms:
                await self.broadcast_to_room(room_id, event)
                
        except Exception as e:
            logger.error(f"Error broadcasting user status for {user_id}: {e}")
    
    async def _process_message_queue(self):
        """Background task to process failed messages"""
        while self._running:
            try:
                await self.message_queue.process_queue(self._send_queued_message)
                await asyncio.sleep(1)
            except Exception as e:
                logger.error(f"Error processing message queue: {e}")
                await asyncio.sleep(5)
    
    async def _send_queued_message(self, message: Dict[str, Any], client_id: str):
        """Send a queued message"""
        if client_id in self.active_connections:
            websocket = self.active_connections[client_id]
            await websocket.send_text(json.dumps(message))
    
    async def _cleanup_stale_connections(self):
        """Background task to clean up stale connections"""
        while self._running:
            try:
                stale_threshold = datetime.utcnow().timestamp() - 300  # 5 minutes
                stale_clients = []
                
                for client_id, metadata in self.client_metadata.items():
                    last_ping = metadata.get("last_ping", datetime.utcnow())
                    if last_ping.timestamp() < stale_threshold:
                        stale_clients.append(client_id)
                
                for client_id in stale_clients:
                    await self.disconnect(client_id, "stale_connection")
                
                await asyncio.sleep(60)  # Check every minute
                
            except Exception as e:
                logger.error(f"Error cleaning up stale connections: {e}")
                await asyncio.sleep(60)

    async def start(self) -> None:
        """Start the connection manager background tasks"""
        if self._running:
            return
            
        self._running = True
        
        # Start message queue if not already started
        if hasattr(self.message_queue, 'start') and not getattr(self.message_queue, '_running', False):
            await self.message_queue.start()
        
        # Start background tasks
        self._message_queue_task = asyncio.create_task(self._process_message_queue())
        self._cleanup_task = asyncio.create_task(self._cleanup_stale_connections())
        
        logger.info("ConnectionManager started successfully")
    
    async def stop(self) -> None:
        """Stop the connection manager and clean up resources"""
        self._running = False
        
        # Cancel background tasks
        if self._message_queue_task:
            self._message_queue_task.cancel()
        if self._cleanup_task:
            self._cleanup_task.cancel()
        
        # Disconnect all clients
        client_ids = list(self.active_connections.keys())
        for client_id in client_ids:
            await self.disconnect(client_id, "server_shutdown")
        
        # Stop message queue
        if hasattr(self.message_queue, 'stop'):
            await self.message_queue.stop()
        
        logger.info("ConnectionManager stopped successfully")
    
    def _get_current_time(self) -> str:
        """Get current time as ISO string"""
        return datetime.utcnow().isoformat()
    
    def _generate_user_color(self, user_id: str) -> str:
        """Generate a consistent color for a user based on their ID"""
        # Use hash to generate consistent color
        import hashlib
        hash_value = int(hashlib.md5(user_id.encode()).hexdigest()[:6], 16)
        
        # Generate a pleasant color with good contrast
        hue = hash_value % 360
        saturation = 70 + (hash_value % 20)  # 70-90%
        lightness = 45 + (hash_value % 15)   # 45-60%
        
        return f"hsl({hue}, {saturation}%, {lightness}%)"
    
    def get_room_user_details(self, room_id: str) -> List[Dict[str, Any]]:
        """Get detailed information about users in a room"""
        members = []
        for client_id in self.rooms.get(room_id, set()):
            metadata = self.client_metadata.get(client_id, {})
            members.append({
                "client_id": client_id,
                "user_id": metadata.get("user_id"),
                "user_name": metadata.get("user_name"),
                "user_color": metadata.get("user_color"),
                "user_avatar": metadata.get("user_avatar"),
                "connected_at": metadata.get("connected_at").isoformat() if metadata.get("connected_at") else None
            })
        return members
    
    async def broadcast_user_cursor(
        self,
        client_id: str,
        document_id: str,
        cursor_position: Dict[str, Any]
    ):
        """Broadcast user cursor position to room members"""
        metadata = self.client_metadata.get(client_id, {})
        room_id = f"document_{document_id}"
        
        from .events import UserPresenceEvent
        
        await self.broadcast_to_room(
            room_id,
            UserPresenceEvent(
                event_type=EventType.USER_CURSOR_MOVED,
                document_id=document_id,
                user_id=metadata.get("user_id"),
                user_name=metadata.get("user_name"),
                user_color=metadata.get("user_color"),
                cursor_position=cursor_position
            ),
            exclude_client=client_id
        )
    
    async def broadcast_zone_update(
        self,
        client_id: str,
        document_id: str,
        zone_id: str,
        action: str,
        zone_data: Optional[Dict[str, Any]] = None,
        version: Optional[int] = None
    ):
        """Broadcast zone updates to room members"""
        metadata = self.client_metadata.get(client_id, {})
        room_id = f"document_{document_id}"
        
        from .events import ZoneCollaborationEvent
        
        # Map action to event type
        event_type_map = {
            "create": EventType.ZONE_CREATED,
            "update": EventType.ZONE_UPDATED,
            "delete": EventType.ZONE_DELETED,
            "lock": EventType.ZONE_LOCKED,
            "unlock": EventType.ZONE_UNLOCKED
        }
        
        event_type = event_type_map.get(action, EventType.ZONE_UPDATED)
        
        await self.broadcast_to_room(
            room_id,
            ZoneCollaborationEvent(
                event_type=event_type,
                document_id=document_id,
                zone_id=zone_id,
                user_id=metadata.get("user_id"),
                action=action,
                zone_data=zone_data,
                version=version
            ),
            exclude_client=client_id
        )


# Global connection manager instance (for backwards compatibility)
connection_manager = ConnectionManager() 