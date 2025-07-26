"""
Message queuing and reliability system for WebSocket communications
"""
import asyncio
import json
import logging
import time
from collections import defaultdict, deque
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Callable
from enum import Enum
from dataclasses import dataclass, asdict
import msgpack

from .events import WebSocketEvent, EventType


class MessagePriority(int, Enum):
    """Message priority levels"""
    LOW = 1
    NORMAL = 2
    HIGH = 3
    CRITICAL = 4


class MessageStatus(str, Enum):
    """Message delivery status"""
    PENDING = "pending"
    DELIVERED = "delivered"
    FAILED = "failed"
    EXPIRED = "expired"


@dataclass
class QueuedMessage:
    """A message in the delivery queue"""
    id: str
    event: WebSocketEvent
    target_type: str  # "user", "room", "broadcast"
    target_id: Optional[str]
    priority: MessagePriority
    created_at: datetime
    expires_at: Optional[datetime]
    retry_count: int = 0
    max_retries: int = 3
    status: MessageStatus = MessageStatus.PENDING
    last_attempt: Optional[datetime] = None
    delivery_callback: Optional[Callable] = None
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization"""
        data = asdict(self)
        data['created_at'] = self.created_at.isoformat()
        data['expires_at'] = self.expires_at.isoformat() if self.expires_at else None
        data['last_attempt'] = self.last_attempt.isoformat() if self.last_attempt else None
        data['event'] = self.event.model_dump()
        del data['delivery_callback']  # Can't serialize callbacks
        return data
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'QueuedMessage':
        """Create from dictionary"""
        event_data = data.pop('event')
        event = WebSocketEvent(**event_data)
        
        created_at = datetime.fromisoformat(data['created_at'])
        expires_at = datetime.fromisoformat(data['expires_at']) if data['expires_at'] else None
        last_attempt = datetime.fromisoformat(data['last_attempt']) if data['last_attempt'] else None
        
        return cls(
            event=event,
            created_at=created_at,
            expires_at=expires_at,
            last_attempt=last_attempt,
            **{k: v for k, v in data.items() if k not in ['event', 'created_at', 'expires_at', 'last_attempt']}
        )


class MessageQueue:
    """
    High-performance message queue with reliability features
    """
    
    def __init__(
        self,
        max_queue_size: int = 10000,
        default_ttl: int = 3600,  # 1 hour
        batch_size: int = 100,
        flush_interval: float = 0.1,  # 100ms
        enable_persistence: bool = False,
        redis_client=None
    ):
        self.max_queue_size = max_queue_size
        self.default_ttl = default_ttl
        self.batch_size = batch_size
        self.flush_interval = flush_interval
        self.enable_persistence = enable_persistence
        self.redis_client = redis_client
        
        # Priority queues for different message types
        self.priority_queues: Dict[MessagePriority, deque] = {
            priority: deque() for priority in MessagePriority
        }
        
        # Message tracking
        self.pending_messages: Dict[str, QueuedMessage] = {}
        self.failed_messages: Dict[str, QueuedMessage] = {}
        self.message_history: deque = deque(maxlen=1000)
        
        # Performance metrics
        self.metrics = {
            "messages_queued": 0,
            "messages_delivered": 0,
            "messages_failed": 0,
            "messages_expired": 0,
            "average_delivery_time": 0.0,
            "queue_size": 0,
            "throughput_per_second": 0.0
        }
        
        # Rate limiting
        self.rate_limits: Dict[str, Dict[str, Any]] = defaultdict(lambda: {
            "count": 0,
            "window_start": time.time(),
            "limit": 100,  # messages per minute
            "window": 60
        })
        
        self.logger = logging.getLogger(__name__)
        
        # Background tasks
        self._processor_task: Optional[asyncio.Task] = None
        self._cleanup_task: Optional[asyncio.Task] = None
        self._metrics_task: Optional[asyncio.Task] = None
        self._running = False
        
    async def start(self) -> None:
        """Start the message queue processing"""
        if self._running:
            return
            
        self._running = True
        self._processor_task = asyncio.create_task(self._process_queue())
        self._cleanup_task = asyncio.create_task(self._cleanup_expired())
        self._metrics_task = asyncio.create_task(self._update_metrics())
        
        self.logger.info("Message queue started")
        
    async def stop(self) -> None:
        """Stop the message queue processing"""
        self._running = False
        
        if self._processor_task:
            self._processor_task.cancel()
        if self._cleanup_task:
            self._cleanup_task.cancel()
        if self._metrics_task:
            self._metrics_task.cancel()
            
        # Process remaining messages
        await self._flush_remaining_messages()
        
        self.logger.info("Message queue stopped")
        
    async def enqueue(
        self,
        event: WebSocketEvent,
        target_type: str,
        target_id: Optional[str] = None,
        priority: MessagePriority = MessagePriority.NORMAL,
        ttl: Optional[int] = None,
        delivery_callback: Optional[Callable] = None
    ) -> str:
        """Add a message to the queue"""
        
        # Check rate limiting
        if not self._check_rate_limit(target_id or "global"):
            raise Exception(f"Rate limit exceeded for {target_id or 'global'}")
        
        # Check queue size
        if self._get_total_queue_size() >= self.max_queue_size:
            # Remove lowest priority messages
            await self._evict_low_priority_messages()
        
        # Create queued message
        message_id = f"msg_{int(time.time() * 1000)}_{len(self.pending_messages)}"
        expires_at = None
        if ttl or self.default_ttl:
            expires_at = datetime.utcnow() + timedelta(seconds=ttl or self.default_ttl)
        
        queued_msg = QueuedMessage(
            id=message_id,
            event=event,
            target_type=target_type,
            target_id=target_id,
            priority=priority,
            created_at=datetime.utcnow(),
            expires_at=expires_at,
            delivery_callback=delivery_callback
        )
        
        # Add to appropriate priority queue
        self.priority_queues[priority].append(queued_msg)
        self.pending_messages[message_id] = queued_msg
        
        # Update metrics
        self.metrics["messages_queued"] += 1
        self.metrics["queue_size"] = self._get_total_queue_size()
        
        # Persist if enabled
        if self.enable_persistence and self.redis_client:
            await self._persist_message(queued_msg)
        
        self.logger.debug(f"Message {message_id} queued with priority {priority.name}")
        return message_id
    
    async def get_next_batch(self) -> List[QueuedMessage]:
        """Get the next batch of messages to process"""
        batch = []
        
        # Process in priority order
        for priority in sorted(MessagePriority, key=lambda x: x.value, reverse=True):
            queue = self.priority_queues[priority]
            
            while queue and len(batch) < self.batch_size:
                message = queue.popleft()
                
                # Check if message is expired
                if message.expires_at and datetime.utcnow() > message.expires_at:
                    await self._mark_expired(message)
                    continue
                
                batch.append(message)
                
        return batch
    
    async def mark_delivered(self, message_id: str, delivery_time: float = None) -> None:
        """Mark a message as successfully delivered"""
        if message_id not in self.pending_messages:
            return
            
        message = self.pending_messages[message_id]
        message.status = MessageStatus.DELIVERED
        message.last_attempt = datetime.utcnow()
        
        # Calculate delivery time
        if delivery_time is None:
            delivery_time = (datetime.utcnow() - message.created_at).total_seconds()
        
        # Update metrics
        self.metrics["messages_delivered"] += 1
        self._update_average_delivery_time(delivery_time)
        
        # Call delivery callback
        if message.delivery_callback:
            try:
                await message.delivery_callback(message, True)
            except Exception as e:
                self.logger.error(f"Error in delivery callback: {e}")
        
        # Move to history and clean up
        self.message_history.append(message)
        del self.pending_messages[message_id]
        
        # Remove from persistence
        if self.enable_persistence and self.redis_client:
            await self._remove_persisted_message(message_id)
    
    async def mark_failed(self, message_id: str, error: str = None) -> None:
        """Mark a message as failed to deliver"""
        if message_id not in self.pending_messages:
            return
            
        message = self.pending_messages[message_id]
        message.retry_count += 1
        message.last_attempt = datetime.utcnow()
        
        # Check if we should retry
        if message.retry_count < message.max_retries:
            # Re-queue with exponential backoff
            delay = min(2 ** message.retry_count, 60)  # Max 60 seconds
            asyncio.create_task(self._requeue_after_delay(message, delay))
            self.logger.debug(f"Message {message_id} will be retried in {delay}s")
        else:
            # Mark as permanently failed
            message.status = MessageStatus.FAILED
            self.failed_messages[message_id] = message
            del self.pending_messages[message_id]
            
            self.metrics["messages_failed"] += 1
            
            # Call delivery callback
            if message.delivery_callback:
                try:
                    await message.delivery_callback(message, False)
                except Exception as e:
                    self.logger.error(f"Error in failure callback: {e}")
            
            self.logger.warning(f"Message {message_id} permanently failed after {message.retry_count} retries")
    
    async def get_queue_stats(self) -> Dict[str, Any]:
        """Get queue statistics"""
        return {
            **self.metrics,
            "queue_size_by_priority": {
                priority.name: len(queue) 
                for priority, queue in self.priority_queues.items()
            },
            "pending_messages": len(self.pending_messages),
            "failed_messages": len(self.failed_messages),
            "uptime": time.time() - getattr(self, '_start_time', time.time())
        }
    
    def _check_rate_limit(self, identifier: str) -> bool:
        """Check if identifier is within rate limits"""
        now = time.time()
        limit_info = self.rate_limits[identifier]
        
        # Reset window if expired
        if now - limit_info["window_start"] > limit_info["window"]:
            limit_info["count"] = 0
            limit_info["window_start"] = now
        
        # Check limit
        if limit_info["count"] >= limit_info["limit"]:
            return False
        
        limit_info["count"] += 1
        return True
    
    def _get_total_queue_size(self) -> int:
        """Get total size across all priority queues"""
        return sum(len(queue) for queue in self.priority_queues.values())
    
    async def _evict_low_priority_messages(self) -> None:
        """Remove low priority messages to make room"""
        for priority in [MessagePriority.LOW, MessagePriority.NORMAL]:
            queue = self.priority_queues[priority]
            if queue:
                evicted = queue.popleft()
                if evicted.id in self.pending_messages:
                    del self.pending_messages[evicted.id]
                self.logger.debug(f"Evicted message {evicted.id} due to queue size limit")
                return
    
    async def _mark_expired(self, message: QueuedMessage) -> None:
        """Mark a message as expired"""
        message.status = MessageStatus.EXPIRED
        
        if message.id in self.pending_messages:
            del self.pending_messages[message.id]
        
        self.metrics["messages_expired"] += 1
        self.logger.debug(f"Message {message.id} expired")
    
    async def _requeue_after_delay(self, message: QueuedMessage, delay: float) -> None:
        """Re-queue a message after a delay"""
        await asyncio.sleep(delay)
        
        if self._running and message.id in self.pending_messages:
            # Lower priority for retries
            retry_priority = MessagePriority.LOW if message.priority != MessagePriority.CRITICAL else MessagePriority.NORMAL
            self.priority_queues[retry_priority].append(message)
    
    def _update_average_delivery_time(self, delivery_time: float) -> None:
        """Update the average delivery time metric"""
        current_avg = self.metrics["average_delivery_time"]
        delivered_count = self.metrics["messages_delivered"]
        
        if delivered_count == 1:
            self.metrics["average_delivery_time"] = delivery_time
        else:
            # Exponential moving average
            alpha = 0.1
            self.metrics["average_delivery_time"] = alpha * delivery_time + (1 - alpha) * current_avg
    
    async def _process_queue(self) -> None:
        """Main queue processing loop"""
        self._start_time = time.time()
        
        while self._running:
            try:
                batch = await self.get_next_batch()
                
                if batch:
                    # Process batch (this would be implemented by the connection manager)
                    for message in batch:
                        # Mark as attempted
                        message.last_attempt = datetime.utcnow()
                        
                    # Note: Actual delivery happens in ConnectionManager
                    # This just prepares the batch
                    
                await asyncio.sleep(self.flush_interval)
                
            except Exception as e:
                self.logger.error(f"Error in queue processor: {e}")
                await asyncio.sleep(1)  # Back off on error
    
    async def _cleanup_expired(self) -> None:
        """Clean up expired messages"""
        while self._running:
            try:
                now = datetime.utcnow()
                expired_ids = []
                
                for message_id, message in self.pending_messages.items():
                    if message.expires_at and now > message.expires_at:
                        expired_ids.append(message_id)
                
                for message_id in expired_ids:
                    message = self.pending_messages[message_id]
                    await self._mark_expired(message)
                
                # Clean up old failed messages
                old_failed = [
                    msg_id for msg_id, msg in self.failed_messages.items()
                    if (now - msg.created_at).total_seconds() > 86400  # 24 hours
                ]
                
                for msg_id in old_failed:
                    del self.failed_messages[msg_id]
                
                await asyncio.sleep(60)  # Run every minute
                
            except Exception as e:
                self.logger.error(f"Error in cleanup task: {e}")
                await asyncio.sleep(60)
    
    async def _update_metrics(self) -> None:
        """Update performance metrics"""
        last_delivered = 0
        
        while self._running:
            try:
                # Calculate throughput
                current_delivered = self.metrics["messages_delivered"]
                throughput = current_delivered - last_delivered  # Messages per update interval
                self.metrics["throughput_per_second"] = throughput / 10  # 10 second intervals
                last_delivered = current_delivered
                
                # Update queue size
                self.metrics["queue_size"] = self._get_total_queue_size()
                
                await asyncio.sleep(10)  # Update every 10 seconds
                
            except Exception as e:
                self.logger.error(f"Error updating metrics: {e}")
                await asyncio.sleep(10)
    
    async def _flush_remaining_messages(self) -> None:
        """Process any remaining messages before shutdown"""
        try:
            while self._get_total_queue_size() > 0:
                batch = await self.get_next_batch()
                if not batch:
                    break
                # Note: In real implementation, this would trigger delivery
                await asyncio.sleep(0.01)
        except Exception as e:
            self.logger.error(f"Error flushing messages: {e}")
    
    async def _persist_message(self, message: QueuedMessage) -> None:
        """Persist message to Redis for reliability"""
        if not self.redis_client:
            return
            
        try:
            key = f"websocket:queue:{message.id}"
            data = msgpack.packb(message.to_dict())
            await self.redis_client.setex(key, self.default_ttl, data)
        except Exception as e:
            self.logger.error(f"Failed to persist message {message.id}: {e}")
    
    async def _remove_persisted_message(self, message_id: str) -> None:
        """Remove persisted message from Redis"""
        if not self.redis_client:
            return
            
        try:
            key = f"websocket:queue:{message_id}"
            await self.redis_client.delete(key)
        except Exception as e:
            self.logger.error(f"Failed to remove persisted message {message_id}: {e}")
            
    async def restore_from_persistence(self) -> int:
        """Restore messages from Redis persistence"""
        if not self.redis_client:
            return 0
            
        try:
            pattern = "websocket:queue:*"
            keys = await self.redis_client.keys(pattern)
            restored = 0
            
            for key in keys:
                try:
                    data = await self.redis_client.get(key)
                    if data:
                        message_dict = msgpack.unpackb(data)
                        message = QueuedMessage.from_dict(message_dict)
                        
                        # Re-queue if not expired
                        if not message.expires_at or datetime.utcnow() < message.expires_at:
                            self.priority_queues[message.priority].append(message)
                            self.pending_messages[message.id] = message
                            restored += 1
                        else:
                            # Clean up expired persisted message
                            await self.redis_client.delete(key)
                            
                except Exception as e:
                    self.logger.error(f"Failed to restore message from {key}: {e}")
                    
            self.logger.info(f"Restored {restored} messages from persistence")
            return restored
            
        except Exception as e:
            self.logger.error(f"Failed to restore from persistence: {e}")
            return 0 