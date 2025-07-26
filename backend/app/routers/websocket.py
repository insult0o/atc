"""
WebSocket endpoints for real-time communication
"""
import json
import logging
from typing import Dict, Any, Optional
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, HTTPException, status
from fastapi.responses import JSONResponse

from ..websocket import ConnectionManager, EventEmitter, ProcessingProgressEmitter, EventType
from ..websocket.client import ConnectionState
from ..websocket.events import WebSocketEvent, SystemNotificationEvent
from ..dependencies import get_connection_manager, get_processing_progress_emitter
from ..middleware.logging import RequestContextLogger


router = APIRouter(prefix="/ws", tags=["websocket"])
logger = logging.getLogger(__name__)


@router.websocket("/connect")
async def websocket_endpoint(
    websocket: WebSocket,
    user_id: str,
    connection_manager: ConnectionManager = Depends(get_connection_manager)
):
    """Main WebSocket connection endpoint"""
    client_id = None
    
    try:
        # Accept the connection
        await websocket.accept()
        
        # Register the connection
        client_id = await connection_manager.connect(websocket, user_id)
        
        logger.info(f"WebSocket connection established for user {user_id}, client {client_id}")
        
        # Send welcome message
        welcome_event = SystemNotificationEvent(
            type=EventType.SYSTEM_NOTIFICATION,
            data={
                "message": "Connected to PDF Intelligence Platform",
                "client_id": client_id,
                "server_time": connection_manager._get_current_time(),
                "capabilities": [
                    "processing_progress",
                    "export_updates", 
                    "document_notifications",
                    "zone_updates",
                    "system_alerts"
                ]
            },
            user_id=user_id
        )
        
        await connection_manager.send_personal_message(user_id, welcome_event.model_dump())
        
        # Main message loop
        while True:
            try:
                # Receive message from client
                data = await websocket.receive_text()
                message = json.loads(data)
                
                # Handle different message types
                await handle_client_message(
                    connection_manager,
                    user_id,
                    client_id,
                    message
                )
                
            except WebSocketDisconnect:
                logger.info(f"Client {client_id} disconnected normally")
                break
            except json.JSONDecodeError as e:
                logger.warning(f"Invalid JSON from client {client_id}: {e}")
                await connection_manager.send_personal_message(
                    user_id,
                    {
                        "type": "error",
                        "data": {
                            "error": "Invalid JSON format",
                            "code": "INVALID_JSON"
                        }
                    }
                )
            except Exception as e:
                logger.error(f"Error handling message from {client_id}: {e}")
                await connection_manager.send_personal_message(
                    user_id,
                    {
                        "type": "error", 
                        "data": {
                            "error": "Internal server error",
                            "code": "INTERNAL_ERROR"
                        }
                    }
                )
                
    except Exception as e:
        logger.error(f"WebSocket connection error for user {user_id}: {e}")
    finally:
        # Clean up connection
        if client_id:
            await connection_manager.disconnect(client_id)
            logger.info(f"Cleaned up connection for client {client_id}")


async def handle_client_message(
    connection_manager: ConnectionManager,
    user_id: str,
    client_id: str,
    message: Dict[str, Any]
) -> None:
    """Handle incoming client messages"""
    
    message_type = message.get("type")
    data = message.get("data", {})
    
    try:
        if message_type == "ping":
            # Handle ping/pong for connection health
            await connection_manager.handle_ping(client_id)
            
        elif message_type == "control":
            # Handle control messages (join/leave rooms, etc.)
            await handle_control_message(connection_manager, user_id, client_id, data)
            
        elif message_type == "subscribe":
            # Subscribe to specific event types or rooms
            await handle_subscription(connection_manager, user_id, client_id, data)
            
        elif message_type == "unsubscribe":
            # Unsubscribe from event types or rooms
            await handle_unsubscription(connection_manager, user_id, client_id, data)
            
        elif message_type == "status_request":
            # Send current status information
            await handle_status_request(connection_manager, user_id, client_id, data)
            
        else:
            logger.warning(f"Unknown message type '{message_type}' from client {client_id}")
            await connection_manager.send_personal_message(
                user_id,
                {
                    "type": "error",
                    "data": {
                        "error": f"Unknown message type: {message_type}",
                        "code": "UNKNOWN_MESSAGE_TYPE"
                    }
                }
            )
            
    except Exception as e:
        logger.error(f"Error handling {message_type} message: {e}")
        await connection_manager.send_personal_message(
            user_id,
            {
                "type": "error",
                "data": {
                    "error": f"Error processing {message_type} message",
                    "code": "MESSAGE_PROCESSING_ERROR"
                }
            }
        )


async def handle_control_message(
    connection_manager: ConnectionManager,
    user_id: str,
    client_id: str,
    data: Dict[str, Any]
) -> None:
    """Handle control messages for room management"""
    
    action = data.get("action")
    
    if action == "join_room":
        room_id = data.get("room_id")
        if room_id:
            await connection_manager.join_room(client_id, room_id)
            await connection_manager.send_personal_message(
                user_id,
                {
                    "type": "control_response",
                    "data": {
                        "action": "join_room",
                        "room_id": room_id,
                        "success": True
                    }
                }
            )
        else:
            await connection_manager.send_personal_message(
                user_id,
                {
                    "type": "error",
                    "data": {
                        "error": "Missing room_id for join_room action",
                        "code": "MISSING_ROOM_ID"
                    }
                }
            )
            
    elif action == "leave_room":
        room_id = data.get("room_id")
        if room_id:
            await connection_manager.leave_room(client_id, room_id)
            await connection_manager.send_personal_message(
                user_id,
                {
                    "type": "control_response",
                    "data": {
                        "action": "leave_room",
                        "room_id": room_id,
                        "success": True
                    }
                }
            )
    
    elif action == "get_rooms":
        client_info = connection_manager.get_connection_info(client_id)
        rooms = client_info.get("rooms", []) if client_info else []
        await connection_manager.send_personal_message(
            user_id,
            {
                "type": "control_response",
                "data": {
                    "action": "get_rooms",
                    "rooms": rooms
                }
            }
        )
    
    else:
        await connection_manager.send_personal_message(
            user_id,
            {
                "type": "error",
                "data": {
                    "error": f"Unknown control action: {action}",
                    "code": "UNKNOWN_CONTROL_ACTION"
                }
            }
        )


async def handle_subscription(
    connection_manager: ConnectionManager,
    user_id: str,
    client_id: str,
    data: Dict[str, Any]
) -> None:
    """Handle subscription requests"""
    
    subscription_type = data.get("type")
    
    if subscription_type == "document":
        document_id = data.get("document_id")
        if document_id:
            room_id = f"document_{document_id}"
            await connection_manager.join_room(client_id, room_id)
            
    elif subscription_type == "processing_job":
        job_id = data.get("job_id")
        if job_id:
            room_id = f"job_{job_id}"
            await connection_manager.join_room(client_id, room_id)
            
    elif subscription_type == "export":
        export_id = data.get("export_id")
        if export_id:
            room_id = f"export_{export_id}"
            await connection_manager.join_room(client_id, room_id)
            
    elif subscription_type == "user_updates":
        room_id = f"user_{user_id}"
        await connection_manager.join_room(client_id, room_id)
        
    await connection_manager.send_personal_message(
        user_id,
        {
            "type": "subscription_response",
            "data": {
                "type": subscription_type,
                "success": True,
                "subscribed": True
            }
        }
    )


async def handle_unsubscription(
    connection_manager: ConnectionManager,
    user_id: str,
    client_id: str,
    data: Dict[str, Any]
) -> None:
    """Handle unsubscription requests"""
    
    subscription_type = data.get("type")
    room_id = None
    
    if subscription_type == "document":
        document_id = data.get("document_id")
        if document_id:
            room_id = f"document_{document_id}"
            
    elif subscription_type == "processing_job":
        job_id = data.get("job_id")
        if job_id:
            room_id = f"job_{job_id}"
            
    elif subscription_type == "export":
        export_id = data.get("export_id")
        if export_id:
            room_id = f"export_{export_id}"
            
    elif subscription_type == "user_updates":
        room_id = f"user_{user_id}"
    
    if room_id:
        await connection_manager.leave_room(client_id, room_id)
        
    await connection_manager.send_personal_message(
        user_id,
        {
            "type": "subscription_response",
            "data": {
                "type": subscription_type,
                "success": True,
                "subscribed": False
            }
        }
    )


async def handle_status_request(
    connection_manager: ConnectionManager,
    user_id: str,
    client_id: str,
    data: Dict[str, Any]
) -> None:
    """Handle status information requests"""
    
    status_type = data.get("type", "connection")
    
    if status_type == "connection":
        client_info = connection_manager.get_connection_info(client_id)
        user_connections = connection_manager.get_user_connections(user_id)
        
        await connection_manager.send_personal_message(
            user_id,
            {
                "type": "status_response",
                "data": {
                    "type": "connection",
                    "client_id": client_id,
                    "user_id": user_id,
                    "connected_since": client_info.get("connected_at") if client_info else None,
                    "rooms": client_info.get("rooms", []) if client_info else [],
                    "total_user_connections": len(user_connections)
                }
            }
        )
        
    elif status_type == "server":
        stats = connection_manager.get_statistics()
        
        await connection_manager.send_personal_message(
            user_id,
            {
                "type": "status_response",
                "data": {
                    "type": "server",
                    "total_connections": stats["total_connections"],
                    "total_users": stats["total_users"],
                    "total_rooms": stats["total_rooms"],
                    "messages_sent": stats["messages_sent"],
                    "uptime": stats.get("uptime", 0)
                }
            }
        )


# REST API endpoints for WebSocket management

@router.get("/connections/stats")
async def get_connection_stats(
    connection_manager: ConnectionManager = Depends(get_connection_manager)
):
    """Get WebSocket connection statistics"""
    stats = connection_manager.get_statistics()
    return JSONResponse(content=stats)


@router.get("/connections/{user_id}")
async def get_user_connections(
    user_id: str,
    connection_manager: ConnectionManager = Depends(get_connection_manager)
):
    """Get connections for a specific user"""
    connections = connection_manager.get_user_connections(user_id)
    
    connection_details = []
    for client_id in connections:
        info = connection_manager.get_connection_info(client_id)
        if info:
            connection_details.append({
                "client_id": client_id,
                "connected_at": info.get("connected_at"),
                "rooms": info.get("rooms", []),
                "metadata": info.get("metadata", {})
            })
    
    return JSONResponse(content={
        "user_id": user_id,
        "connection_count": len(connections),
        "connections": connection_details
    })


@router.post("/broadcast")
async def broadcast_message(
    message: Dict[str, Any],
    connection_manager: ConnectionManager = Depends(get_connection_manager)
):
    """Broadcast a message to all connected clients"""
    
    # Create system notification event
    event = SystemNotificationEvent(
        type=EventType.SYSTEM_NOTIFICATION,
        data=message.get("data", {}),
        user_id="system"
    )
    
    await connection_manager.broadcast_to_all(event.model_dump())
    
    stats = connection_manager.get_statistics()
    return JSONResponse(content={
        "message": "Message broadcasted successfully",
        "recipients": stats["total_connections"]
    })


@router.post("/rooms/{room_id}/broadcast")
async def broadcast_to_room(
    room_id: str,
    message: Dict[str, Any],
    connection_manager: ConnectionManager = Depends(get_connection_manager)
):
    """Broadcast a message to all clients in a specific room"""
    
    # Create system notification event
    event = SystemNotificationEvent(
        type=EventType.SYSTEM_NOTIFICATION,
        data=message.get("data", {}),
        user_id="system",
        room_id=room_id
    )
    
    await connection_manager.broadcast_to_room(room_id, event.model_dump())
    
    room_members = connection_manager.get_room_members(room_id)
    return JSONResponse(content={
        "message": f"Message broadcasted to room {room_id}",
        "recipients": len(room_members)
    })


@router.get("/rooms/{room_id}/members")
async def get_room_members(
    room_id: str,
    connection_manager: ConnectionManager = Depends(get_connection_manager)
):
    """Get members of a specific room"""
    members = connection_manager.get_room_members(room_id)
    
    member_details = []
    for client_id in members:
        info = connection_manager.get_connection_info(client_id)
        if info:
            member_details.append({
                "client_id": client_id,
                "user_id": info.get("user_id"),
                "connected_at": info.get("connected_at")
            })
    
    return JSONResponse(content={
        "room_id": room_id,
        "member_count": len(members),
        "members": member_details
    })


@router.delete("/connections/{client_id}")
async def disconnect_client(
    client_id: str,
    connection_manager: ConnectionManager = Depends(get_connection_manager)
):
    """Disconnect a specific client"""
    
    client_info = connection_manager.get_connection_info(client_id)
    if not client_info:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Client {client_id} not found"
        )
    
    await connection_manager.disconnect(client_id)
    
    return JSONResponse(content={
        "message": f"Client {client_id} disconnected successfully"
    }) 