"""
WebSocket client utilities for frontend integration
"""
import asyncio
import json
import logging
from datetime import datetime
from typing import Dict, Optional, Callable, Any, List
from enum import Enum
import websockets
from websockets.client import WebSocketClientProtocol

from .events import WebSocketEvent, EventType


class ConnectionState(str, Enum):
    """WebSocket connection states"""
    DISCONNECTED = "disconnected"
    CONNECTING = "connecting"
    CONNECTED = "connected"
    RECONNECTING = "reconnecting"
    FAILED = "failed"


class WebSocketClient:
    """
    WebSocket client for frontend applications to connect to the backend
    """
    
    def __init__(
        self,
        url: str,
        user_id: str,
        reconnect_interval: int = 5,
        max_reconnect_attempts: int = 10,
        heartbeat_interval: int = 30
    ):
        self.url = url
        self.user_id = user_id
        self.reconnect_interval = reconnect_interval
        self.max_reconnect_attempts = max_reconnect_attempts
        self.heartbeat_interval = heartbeat_interval
        
        self.websocket: Optional[WebSocketClientProtocol] = None
        self.state = ConnectionState.DISCONNECTED
        self.reconnect_attempts = 0
        self.event_handlers: Dict[EventType, List[Callable]] = {}
        self.subscribed_rooms: List[str] = []
        self.last_ping = None
        self.last_pong = None
        
        self.logger = logging.getLogger(__name__)
        
        # Background tasks
        self._heartbeat_task: Optional[asyncio.Task] = None
        self._listen_task: Optional[asyncio.Task] = None
        self._reconnect_task: Optional[asyncio.Task] = None
        
    async def connect(self) -> bool:
        """Connect to the WebSocket server"""
        try:
            self.state = ConnectionState.CONNECTING
            self.logger.info(f"Connecting to WebSocket server: {self.url}")
            
            headers = {
                "User-ID": self.user_id,
                "Client-Type": "web"
            }
            
            self.websocket = await websockets.connect(
                self.url,
                extra_headers=headers,
                ping_interval=self.heartbeat_interval,
                ping_timeout=10
            )
            
            self.state = ConnectionState.CONNECTED
            self.reconnect_attempts = 0
            self.logger.info("WebSocket connection established")
            
            # Start background tasks
            self._heartbeat_task = asyncio.create_task(self._heartbeat_loop())
            self._listen_task = asyncio.create_task(self._listen_loop())
            
            # Re-subscribe to rooms
            for room_id in self.subscribed_rooms:
                await self._send_control_message("join_room", {"room_id": room_id})
            
            # Trigger connection event
            await self._trigger_event_handlers(EventType.CONNECTION_ESTABLISHED, {
                "user_id": self.user_id,
                "timestamp": datetime.utcnow().isoformat()
            })
            
            return True
            
        except Exception as e:
            self.logger.error(f"Failed to connect: {e}")
            self.state = ConnectionState.FAILED
            
            # Schedule reconnection
            if self.reconnect_attempts < self.max_reconnect_attempts:
                self._reconnect_task = asyncio.create_task(self._reconnect_after_delay())
            
            return False
    
    async def disconnect(self) -> None:
        """Disconnect from the WebSocket server"""
        self.logger.info("Disconnecting from WebSocket server")
        self.state = ConnectionState.DISCONNECTED
        
        # Cancel background tasks
        if self._heartbeat_task:
            self._heartbeat_task.cancel()
        if self._listen_task:
            self._listen_task.cancel()
        if self._reconnect_task:
            self._reconnect_task.cancel()
        
        # Close WebSocket connection
        if self.websocket:
            await self.websocket.close()
            self.websocket = None
        
        # Trigger disconnection event
        await self._trigger_event_handlers(EventType.CONNECTION_CLOSED, {
            "user_id": self.user_id,
            "timestamp": datetime.utcnow().isoformat()
        })
    
    def on(self, event_type: EventType, handler: Callable[[Dict[str, Any]], None]) -> None:
        """Register an event handler"""
        if event_type not in self.event_handlers:
            self.event_handlers[event_type] = []
        self.event_handlers[event_type].append(handler)
        
    def off(self, event_type: EventType, handler: Callable[[Dict[str, Any]], None]) -> None:
        """Unregister an event handler"""
        if event_type in self.event_handlers:
            try:
                self.event_handlers[event_type].remove(handler)
            except ValueError:
                pass
    
    async def subscribe_to_room(self, room_id: str) -> None:
        """Subscribe to a room for receiving targeted events"""
        if room_id not in self.subscribed_rooms:
            self.subscribed_rooms.append(room_id)
            
        if self.state == ConnectionState.CONNECTED:
            await self._send_control_message("join_room", {"room_id": room_id})
            
    async def unsubscribe_from_room(self, room_id: str) -> None:
        """Unsubscribe from a room"""
        if room_id in self.subscribed_rooms:
            self.subscribed_rooms.remove(room_id)
            
        if self.state == ConnectionState.CONNECTED:
            await self._send_control_message("leave_room", {"room_id": room_id})
    
    async def send_message(self, event_type: EventType, data: Dict[str, Any]) -> None:
        """Send a message to the server"""
        if self.state != ConnectionState.CONNECTED or not self.websocket:
            self.logger.warning("Cannot send message: WebSocket not connected")
            return
            
        message = {
            "type": event_type.value,
            "data": data,
            "user_id": self.user_id,
            "timestamp": datetime.utcnow().isoformat()
        }
        
        try:
            await self.websocket.send(json.dumps(message))
        except Exception as e:
            self.logger.error(f"Failed to send message: {e}")
            # Trigger reconnection if connection is lost
            await self._handle_connection_error()
    
    async def get_connection_status(self) -> Dict[str, Any]:
        """Get current connection status"""
        return {
            "state": self.state.value,
            "connected": self.state == ConnectionState.CONNECTED,
            "reconnect_attempts": self.reconnect_attempts,
            "subscribed_rooms": self.subscribed_rooms.copy(),
            "last_ping": self.last_ping.isoformat() if self.last_ping else None,
            "last_pong": self.last_pong.isoformat() if self.last_pong else None
        }
    
    async def _send_control_message(self, action: str, data: Dict[str, Any]) -> None:
        """Send a control message to the server"""
        if self.state != ConnectionState.CONNECTED or not self.websocket:
            return
            
        control_message = {
            "type": "control",
            "action": action,
            "data": data,
            "user_id": self.user_id,
            "timestamp": datetime.utcnow().isoformat()
        }
        
        try:
            await self.websocket.send(json.dumps(control_message))
        except Exception as e:
            self.logger.error(f"Failed to send control message: {e}")
    
    async def _listen_loop(self) -> None:
        """Main message listening loop"""
        try:
            while self.state == ConnectionState.CONNECTED and self.websocket:
                try:
                    message = await self.websocket.recv()
                    await self._handle_message(message)
                except websockets.exceptions.ConnectionClosed:
                    self.logger.warning("WebSocket connection closed")
                    await self._handle_connection_error()
                    break
                except Exception as e:
                    self.logger.error(f"Error in listen loop: {e}")
                    
        except asyncio.CancelledError:
            self.logger.debug("Listen loop cancelled")
    
    async def _handle_message(self, raw_message: str) -> None:
        """Handle incoming WebSocket message"""
        try:
            data = json.loads(raw_message)
            
            # Handle pong responses
            if data.get("type") == "pong":
                self.last_pong = datetime.utcnow()
                return
            
            # Parse as WebSocket event
            event_type_str = data.get("type")
            if not event_type_str:
                return
                
            try:
                event_type = EventType(event_type_str)
            except ValueError:
                self.logger.warning(f"Unknown event type: {event_type_str}")
                return
            
            event_data = data.get("data", {})
            await self._trigger_event_handlers(event_type, event_data)
            
        except json.JSONDecodeError as e:
            self.logger.error(f"Failed to parse message: {e}")
        except Exception as e:
            self.logger.error(f"Error handling message: {e}")
    
    async def _trigger_event_handlers(self, event_type: EventType, data: Dict[str, Any]) -> None:
        """Trigger all registered handlers for an event type"""
        if event_type in self.event_handlers:
            for handler in self.event_handlers[event_type]:
                try:
                    if asyncio.iscoroutinefunction(handler):
                        await handler(data)
                    else:
                        handler(data)
                except Exception as e:
                    self.logger.error(f"Error in event handler: {e}")
    
    async def _heartbeat_loop(self) -> None:
        """Send periodic ping messages to keep connection alive"""
        try:
            while self.state == ConnectionState.CONNECTED:
                try:
                    if self.websocket:
                        self.last_ping = datetime.utcnow()
                        await self.websocket.send(json.dumps({
                            "type": "ping",
                            "timestamp": self.last_ping.isoformat()
                        }))
                    
                    await asyncio.sleep(self.heartbeat_interval)
                    
                except websockets.exceptions.ConnectionClosed:
                    await self._handle_connection_error()
                    break
                except Exception as e:
                    self.logger.error(f"Error in heartbeat: {e}")
                    
        except asyncio.CancelledError:
            self.logger.debug("Heartbeat loop cancelled")
    
    async def _handle_connection_error(self) -> None:
        """Handle connection errors and trigger reconnection"""
        if self.state == ConnectionState.CONNECTED:
            self.state = ConnectionState.DISCONNECTED
            
            # Trigger disconnection event
            await self._trigger_event_handlers(EventType.CONNECTION_CLOSED, {
                "user_id": self.user_id,
                "timestamp": datetime.utcnow().isoformat(),
                "reason": "connection_error"
            })
            
            # Schedule reconnection
            if self.reconnect_attempts < self.max_reconnect_attempts:
                self._reconnect_task = asyncio.create_task(self._reconnect_after_delay())
    
    async def _reconnect_after_delay(self) -> None:
        """Reconnect after a delay"""
        self.reconnect_attempts += 1
        self.state = ConnectionState.RECONNECTING
        
        self.logger.info(f"Attempting reconnection {self.reconnect_attempts}/{self.max_reconnect_attempts}")
        
        await asyncio.sleep(self.reconnect_interval)
        
        # Exponential backoff
        delay = min(self.reconnect_interval * (2 ** (self.reconnect_attempts - 1)), 60)
        await asyncio.sleep(delay)
        
        success = await self.connect()
        if not success and self.reconnect_attempts >= self.max_reconnect_attempts:
            self.state = ConnectionState.FAILED
            self.logger.error("Maximum reconnection attempts reached")
            
            await self._trigger_event_handlers(EventType.CONNECTION_FAILED, {
                "user_id": self.user_id,
                "timestamp": datetime.utcnow().isoformat(),
                "attempts": self.reconnect_attempts
            })


class WebSocketClientManager:
    """
    Singleton manager for WebSocket client instances
    """
    
    _instance: Optional['WebSocketClientManager'] = None
    _clients: Dict[str, WebSocketClient] = {}
    
    def __new__(cls) -> 'WebSocketClientManager':
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    def get_client(
        self,
        user_id: str,
        url: str,
        **kwargs
    ) -> WebSocketClient:
        """Get or create a WebSocket client for a user"""
        if user_id not in self._clients:
            self._clients[user_id] = WebSocketClient(url, user_id, **kwargs)
        return self._clients[user_id]
    
    def remove_client(self, user_id: str) -> None:
        """Remove a client from the manager"""
        if user_id in self._clients:
            del self._clients[user_id]
    
    async def disconnect_all(self) -> None:
        """Disconnect all managed clients"""
        for client in self._clients.values():
            await client.disconnect()
        self._clients.clear()
    
    def get_all_clients(self) -> Dict[str, WebSocketClient]:
        """Get all managed clients"""
        return self._clients.copy() 