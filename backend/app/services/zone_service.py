"""
Zone management service for handling zone CRUD operations
"""

import logging
from typing import List, Optional, Dict, Any, Tuple
from uuid import UUID, uuid4
from datetime import datetime
import json
import asyncpg
from supabase import Client
import redis.asyncio as redis

from app.models.zone import (
    Zone, ZoneCreate, ZoneUpdate, ZoneResponse,
    ZoneReprocessRequest, ZoneSplitRequest, ZoneMergeRequest,
    ZoneSplitResponse, ZoneMergeResponse, ZoneListResponse,
    ZoneBatchUpdateRequest, ZoneBatchUpdateResponse
)
from app.models.processing import ZoneType, ZoneStatus, ZoneCoordinates
from app.middleware.errors import (
    ZoneNotFoundError, InvalidZoneOperationError,
    ZoneProcessingError
)

logger = logging.getLogger(__name__)

class ZoneService:
    """Service for managing document zones"""
    
    def __init__(
        self,
        db_pool: Optional[asyncpg.Pool] = None,
        supabase_client: Optional[Client] = None,
        redis_client: Optional[redis.Redis] = None,
        connection_manager: Optional[Any] = None,
        conflict_resolver: Optional[Any] = None
    ):
        self.db_pool = db_pool
        self.supabase = supabase_client
        self.redis = redis_client
        self._demo_zones = {}  # For demo mode
        self.connection_manager = connection_manager
        self.conflict_resolver = conflict_resolver
        self._zone_versions = {}  # Track zone versions for optimistic locking
        
    async def get_zones_by_document(
        self,
        document_id: UUID,
        zone_type: Optional[ZoneType] = None,
        status: Optional[ZoneStatus] = None,
        page_number: Optional[int] = None
    ) -> ZoneListResponse:
        """Get all zones for a document with optional filters"""
        try:
            zones = []
            
            if self.db_pool:
                # Production mode with database
                query = """
                    SELECT * FROM zones 
                    WHERE document_id = $1
                """
                params = [document_id]
                conditions = []
                
                if zone_type:
                    conditions.append(f"zone_type = ${len(params) + 1}")
                    params.append(zone_type.value if hasattr(zone_type, 'value') else zone_type)
                
                if status:
                    conditions.append(f"status = ${len(params) + 1}")
                    params.append(status.value if hasattr(status, 'value') else status)
                
                if page_number:
                    conditions.append(f"page_number = ${len(params) + 1}")
                    params.append(page_number)
                
                if conditions:
                    query += " AND " + " AND ".join(conditions)
                
                query += " ORDER BY page_number, zone_index"
                
                async with self.db_pool.acquire() as conn:
                    rows = await conn.fetch(query, *params)
                    zones = [Zone(**dict(row)) for row in rows]
            else:
                # Demo mode
                zones = [
                    zone for zone in self._demo_zones.values()
                    if zone.document_id == document_id
                    and (not zone_type or zone.zone_type == zone_type)
                    and (not status or zone.status == status)
                    and (not page_number or zone.page_number == page_number)
                ]
                zones.sort(key=lambda z: (z.page_number, z.zone_index))
            
            # Calculate statistics
            by_type = {}
            by_status = {}
            total_confidence = 0
            confidence_count = 0
            
            for zone in zones:
                zone_type_key = zone.zone_type.value if hasattr(zone.zone_type, 'value') else str(zone.zone_type)
                status_key = zone.status.value if hasattr(zone.status, 'value') else str(zone.status)
                by_type[zone_type_key] = by_type.get(zone_type_key, 0) + 1
                by_status[status_key] = by_status.get(status_key, 0) + 1
                if zone.confidence is not None:
                    total_confidence += zone.confidence
                    confidence_count += 1
            
            average_confidence = total_confidence / confidence_count if confidence_count > 0 else None
            
            # Convert to response models
            zone_responses = []
            for zone in zones:
                zone_response = ZoneResponse(**zone.model_dump())
                zone_responses.append(zone_response)
            
            return ZoneListResponse(
                zones=zone_responses,
                total=len(zones),
                by_type=by_type,
                by_status=by_status,
                average_confidence=average_confidence
            )
            
        except Exception as e:
            logger.error(f"Error fetching zones for document {document_id}: {str(e)}")
            raise
    
    async def create_zone(self, zone_data: ZoneCreate) -> ZoneResponse:
        """Create a new zone"""
        try:
            zone_id = uuid4()
            now = datetime.utcnow()
            
            # Create zone in demo mode (no database for now)
            zone = Zone(
                id=zone_id,
                created_at=now,
                updated_at=now,
                document_id=zone_data.document_id,
                zone_index=zone_data.zone_index,
                page_number=zone_data.page_number,
                zone_type=zone_data.zone_type,
                coordinates=zone_data.coordinates,
                content=zone_data.content,
                confidence=zone_data.confidence,
                processing_tool=zone_data.processing_tool,
                status=ZoneStatus.COMPLETED,  # Mark as completed for demo
                metadata=zone_data.metadata
            )
            
            # Force demo mode for Epic 6 testing
            self._demo_zones[zone_id] = zone
            
            logger.info(f"Created zone {zone_id} for document {zone.document_id}")
            
            # Create response manually to avoid enum issues
            return ZoneResponse(
                id=zone.id,
                created_at=zone.created_at,
                updated_at=zone.updated_at,
                document_id=zone.document_id,
                zone_index=zone.zone_index,
                page_number=zone.page_number,
                zone_type=zone.zone_type,
                coordinates=zone.coordinates,
                content=zone.content,
                confidence=zone.confidence,
                processing_tool=zone.processing_tool,
                status=zone.status,
                metadata=zone.metadata,
                content_preview=zone.content[:100] + ('...' if zone.content and len(zone.content) > 100 else '') if zone.content else 'No content',
                word_count=len(zone.content.split()) if zone.content else 0,
                character_count=len(zone.content) if zone.content else 0
            )
            
        except Exception as e:
            import traceback
            error_msg = f"Error creating zone: {str(e)}"
            traceback_msg = traceback.format_exc()
            logger.error(error_msg)
            logger.error(f"Traceback: {traceback_msg}")
            print(f"ZONE ERROR: {error_msg}")
            print(f"ZONE TRACEBACK: {traceback_msg}")
            raise
    
    async def get_zone(self, zone_id: UUID) -> ZoneResponse:
        """Get a specific zone by ID"""
        try:
            zone = None
            
            if self.db_pool:
                async with self.db_pool.acquire() as conn:
                    row = await conn.fetchrow(
                        "SELECT * FROM zones WHERE id = $1",
                        zone_id
                    )
                    if row:
                        zone_dict = dict(row)
                        zone_dict['coordinates'] = ZoneCoordinates(**zone_dict['coordinates'])
                        zone = Zone(**zone_dict)
            else:
                zone = self._demo_zones.get(zone_id)
            
            if not zone:
                raise ZoneNotFoundError(zone_id)
            
            return ZoneResponse(**zone.model_dump())
            
        except ZoneNotFoundError:
            raise
        except Exception as e:
            logger.error(f"Error fetching zone {zone_id}: {str(e)}")
            raise
    
    async def update_zone(
        self,
        zone_id: UUID,
        zone_update: ZoneUpdate
    ) -> ZoneResponse:
        """Update a zone"""
        try:
            # Get existing zone
            existing_zone = await self._get_zone_internal(zone_id)
            if not existing_zone:
                raise ZoneNotFoundError(zone_id)
            
            # Update fields
            update_data = zone_update.model_dump(exclude_none=True)
            update_data['updated_at'] = datetime.utcnow()
            
            if self.db_pool:
                # Build dynamic update query
                set_clauses = []
                params = [zone_id]
                param_count = 2
                
                for field, value in update_data.items():
                    if field == 'coordinates':
                        set_clauses.append(f"{field} = ${param_count}::jsonb")
                        params.append(json.dumps(value.model_dump() if hasattr(value, 'model_dump') else value))
                    elif field == 'metadata':
                        set_clauses.append(f"{field} = ${param_count}::jsonb")
                        params.append(json.dumps(value))
                    elif field in ['zone_type', 'status']:
                        set_clauses.append(f"{field} = ${param_count}")
                        params.append(value.value if hasattr(value, 'value') else value)
                    else:
                        set_clauses.append(f"{field} = ${param_count}")
                        params.append(value)
                    param_count += 1
                
                query = f"""
                    UPDATE zones 
                    SET {', '.join(set_clauses)}
                    WHERE id = $1
                    RETURNING *
                """
                
                async with self.db_pool.acquire() as conn:
                    row = await conn.fetchrow(query, *params)
                    zone_dict = dict(row)
                    zone_dict['coordinates'] = ZoneCoordinates(**zone_dict['coordinates'])
                    zone = Zone(**zone_dict)
            else:
                # Demo mode
                for field, value in update_data.items():
                    setattr(existing_zone, field, value)
                zone = existing_zone
                self._demo_zones[zone_id] = zone
            
            # Clear cache if Redis is available
            if self.redis:
                await self._clear_zone_cache(zone_id, zone.document_id)
            
            logger.info(f"Updated zone {zone_id}")
            
            return ZoneResponse(**zone.model_dump())
            
        except ZoneNotFoundError:
            raise
        except Exception as e:
            logger.error(f"Error updating zone {zone_id}: {str(e)}")
            raise
    
    async def update_zone_collaborative(
        self,
        zone_id: UUID,
        zone_update: ZoneUpdate,
        user_id: str,
        client_id: str,
        version: Optional[int] = None
    ) -> Tuple[ZoneResponse, Optional[Dict[str, Any]]]:
        """Update a zone with collaborative features and conflict detection"""
        try:
            # Get existing zone
            existing_zone = await self._get_zone_internal(zone_id)
            if not existing_zone:
                raise ZoneNotFoundError(zone_id)
            
            # Check for conflicts if we have a conflict resolver
            conflict = None
            if self.conflict_resolver and version is not None:
                current_version = self._zone_versions.get(str(zone_id), 0)
                
                if version < current_version:
                    # Detect conflict
                    local_changes = zone_update.model_dump(exclude_none=True)
                    
                    conflict = self.conflict_resolver.detect_conflict(
                        str(zone_id),
                        version,
                        current_version,
                        local_changes,
                        {}  # Would need to track remote changes
                    )
                    
                    if conflict:
                        # Try to resolve
                        from ..websocket.conflict_resolver import ConflictResolutionStrategy
                        resolved_changes, requires_intervention = self.conflict_resolver.resolve_conflict(
                            conflict,
                            local_changes,
                            {},
                            ConflictResolutionStrategy.MERGE
                        )
                        
                        if requires_intervention:
                            # Return conflict info without updating
                            return None, {
                                "conflict": conflict,
                                "local_changes": local_changes,
                                "current_version": current_version,
                                "requires_intervention": True
                            }
                        
                        # Use resolved changes
                        zone_update = ZoneUpdate(**resolved_changes)
            
            # Perform the update
            updated_zone = await self.update_zone(zone_id, zone_update)
            
            # Update version
            new_version = self._zone_versions.get(str(zone_id), 0) + 1
            self._zone_versions[str(zone_id)] = new_version
            
            # Broadcast update if we have a connection manager
            if self.connection_manager:
                await self.connection_manager.broadcast_zone_update(
                    client_id,
                    str(existing_zone.document_id),
                    str(zone_id),
                    "update",
                    zone_update.model_dump(exclude_none=True),
                    new_version
                )
            
            # Record conflict resolution if there was one
            if self.conflict_resolver and conflict:
                self.conflict_resolver.record_conflict(
                    str(zone_id),
                    conflict["type"],
                    [user_id],
                    {"strategy": "merge", "version": new_version}
                )
            
            return updated_zone, conflict
            
        except Exception as e:
            logger.error(f"Error in collaborative zone update {zone_id}: {str(e)}")
            raise
    
    async def lock_zone(self, zone_id: UUID, user_id: str) -> bool:
        """Lock a zone for exclusive editing"""
        if self.conflict_resolver:
            success = self.conflict_resolver.acquire_lock(str(zone_id), user_id)
            
            if success and self.connection_manager:
                # Broadcast lock event
                zone = await self._get_zone_internal(zone_id)
                if zone:
                    from ..websocket.events import ZoneCollaborationEvent, EventType
                    
                    await self.connection_manager.broadcast_to_room(
                        f"document_{zone.document_id}",
                        ZoneCollaborationEvent(
                            event_type=EventType.ZONE_LOCKED,
                            document_id=str(zone.document_id),
                            zone_id=str(zone_id),
                            user_id=user_id,
                            action="lock",
                            locked_by=user_id
                        )
                    )
            
            return success
        return True
    
    async def unlock_zone(self, zone_id: UUID, user_id: str) -> bool:
        """Unlock a zone"""
        if self.conflict_resolver:
            success = self.conflict_resolver.release_lock(str(zone_id), user_id)
            
            if success and self.connection_manager:
                # Broadcast unlock event
                zone = await self._get_zone_internal(zone_id)
                if zone:
                    from ..websocket.events import ZoneCollaborationEvent, EventType
                    
                    await self.connection_manager.broadcast_to_room(
                        f"document_{zone.document_id}",
                        ZoneCollaborationEvent(
                            event_type=EventType.ZONE_UNLOCKED,
                            document_id=str(zone.document_id),
                            zone_id=str(zone_id),
                            user_id=user_id,
                            action="unlock"
                        )
                    )
            
            return success
        return True
    
    async def delete_zone(self, zone_id: UUID) -> bool:
        """Delete a zone"""
        try:
            zone = await self._get_zone_internal(zone_id)
            if not zone:
                raise ZoneNotFoundError(zone_id)
            
            if self.db_pool:
                async with self.db_pool.acquire() as conn:
                    await conn.execute(
                        "DELETE FROM zones WHERE id = $1",
                        zone_id
                    )
            else:
                del self._demo_zones[zone_id]
            
            # Clear cache
            if self.redis:
                await self._clear_zone_cache(zone_id, zone.document_id)
            
            logger.info(f"Deleted zone {zone_id}")
            return True
            
        except ZoneNotFoundError:
            raise
        except Exception as e:
            logger.error(f"Error deleting zone {zone_id}: {str(e)}")
            raise
    
    async def reprocess_zone(
        self,
        zone_id: UUID,
        request: ZoneReprocessRequest
    ) -> ZoneResponse:
        """Reprocess a zone with specified tools"""
        try:
            zone = await self._get_zone_internal(zone_id)
            if not zone:
                raise ZoneNotFoundError(zone_id)
            
            # Check if zone can be reprocessed
            if zone.status == ZoneStatus.PROCESSING:
                raise InvalidZoneOperationError(
                    "Cannot reprocess zone that is currently being processed"
                )
            
            if not request.force_update and zone.status == ZoneStatus.COMPLETED:
                logger.info(f"Zone {zone_id} already processed, skipping reprocess")
                return await self.get_zone(zone_id)
            
            # Update zone status to processing
            await self.update_zone(
                zone_id,
                ZoneUpdate(
                    status=ZoneStatus.PROCESSING,
                    metadata={
                        **zone.metadata,
                        "reprocess_requested_at": datetime.utcnow().isoformat(),
                        "reprocess_tools": request.tools,
                        "reprocess_options": request.options
                    }
                )
            )
            
            # TODO: Trigger actual reprocessing job
            # For now, we'll just simulate completion
            logger.info(f"Zone {zone_id} queued for reprocessing with tools: {request.tools}")
            
            # Simulate processing completion
            await self.update_zone(
                zone_id,
                ZoneUpdate(
                    status=ZoneStatus.COMPLETED,
                    processing_tool=request.tools[0] if request.tools else "auto",
                    confidence=0.95,  # Simulated confidence
                    content="Reprocessed content placeholder",  # Simulated content
                    metadata={
                        **zone.metadata,
                        "reprocess_completed_at": datetime.utcnow().isoformat()
                    }
                )
            )
            
            return await self.get_zone(zone_id)
            
        except (ZoneNotFoundError, InvalidZoneOperationError):
            raise
        except Exception as e:
            logger.error(f"Error reprocessing zone {zone_id}: {str(e)}")
            raise ZoneProcessingError(f"Failed to reprocess zone: {str(e)}")
    
    async def split_zone(
        self,
        zone_id: UUID,
        request: ZoneSplitRequest
    ) -> ZoneSplitResponse:
        """Split a zone into multiple zones"""
        try:
            zone = await self._get_zone_internal(zone_id)
            if not zone:
                raise ZoneNotFoundError(zone_id)
            
            # Calculate split coordinates
            new_coordinates = self._calculate_split_coordinates(
                zone.coordinates,
                request.split_type,
                request.split_position,
                request.split_count
            )
            
            # Create new zones
            new_zones = []
            for i, coords in enumerate(new_coordinates):
                # Calculate new zone index
                new_zone_index = zone.zone_index * 100 + i + 1  # Avoid index conflicts
                
                # Create new zone
                zone_data = ZoneCreate(
                    document_id=zone.document_id,
                    zone_index=new_zone_index,
                    page_number=zone.page_number,
                    zone_type=zone.zone_type,
                    coordinates=coords,
                    content=None,  # Content will need to be reprocessed
                    confidence=None,
                    processing_tool=None,
                    metadata={
                        **zone.metadata,
                        "split_from_zone": str(zone_id),
                        "split_index": i,
                        "split_type": request.split_type,
                        "split_at": datetime.utcnow().isoformat()
                    }
                )
                
                new_zone = await self.create_zone(zone_data)
                new_zones.append(new_zone)
            
            # Delete original zone
            await self.delete_zone(zone_id)
            
            logger.info(f"Split zone {zone_id} into {len(new_zones)} zones")
            
            return ZoneSplitResponse(
                original_zone_id=zone_id,
                new_zones=new_zones,
                split_metadata={
                    "split_type": request.split_type,
                    "split_count": len(new_zones),
                    "split_at": datetime.utcnow().isoformat()
                }
            )
            
        except ZoneNotFoundError:
            raise
        except Exception as e:
            logger.error(f"Error splitting zone {zone_id}: {str(e)}")
            raise InvalidZoneOperationError(f"Failed to split zone: {str(e)}")
    
    async def merge_zones(
        self,
        request: ZoneMergeRequest
    ) -> ZoneMergeResponse:
        """Merge multiple zones into one"""
        try:
            # Fetch all zones to merge
            zones = []
            for zone_id in request.zone_ids:
                zone = await self._get_zone_internal(zone_id)
                if not zone:
                    raise ZoneNotFoundError(zone_id)
                zones.append(zone)
            
            # Validate zones can be merged
            document_id = zones[0].document_id
            page_number = zones[0].page_number
            
            for zone in zones[1:]:
                if zone.document_id != document_id:
                    raise InvalidZoneOperationError(
                        "Cannot merge zones from different documents"
                    )
                if zone.page_number != page_number:
                    raise InvalidZoneOperationError(
                        "Cannot merge zones from different pages"
                    )
            
            # Calculate merged coordinates
            merged_coords = self._calculate_merged_coordinates(
                [z.coordinates for z in zones]
            )
            
            # Merge content
            merged_content = self._merge_content(
                zones,
                request.merge_strategy,
                request.preserve_formatting
            )
            
            # Calculate average confidence
            confidences = [z.confidence for z in zones if z.confidence is not None]
            avg_confidence = sum(confidences) / len(confidences) if confidences else None
            
            # Create merged zone
            merged_zone_data = ZoneCreate(
                document_id=document_id,
                zone_index=min(z.zone_index for z in zones),
                page_number=page_number,
                zone_type=self._determine_merged_type(zones),
                coordinates=merged_coords,
                content=merged_content,
                confidence=avg_confidence,
                processing_tool="merge",
                metadata={
                    "merged_from_zones": [str(z.id) for z in zones],
                    "merge_strategy": request.merge_strategy,
                    "merged_at": datetime.utcnow().isoformat(),
                    "original_metadata": [z.metadata for z in zones]
                }
            )
            
            merged_zone = await self.create_zone(merged_zone_data)
            
            # Delete original zones
            for zone_id in request.zone_ids:
                await self.delete_zone(zone_id)
            
            logger.info(f"Merged {len(zones)} zones into zone {merged_zone.id}")
            
            return ZoneMergeResponse(
                merged_zone=merged_zone,
                original_zone_ids=request.zone_ids,
                merge_metadata={
                    "merge_strategy": request.merge_strategy,
                    "zones_merged": len(zones),
                    "merged_at": datetime.utcnow().isoformat()
                }
            )
            
        except (ZoneNotFoundError, InvalidZoneOperationError):
            raise
        except Exception as e:
            logger.error(f"Error merging zones: {str(e)}")
            raise InvalidZoneOperationError(f"Failed to merge zones: {str(e)}")
    
    async def batch_update_zones(
        self,
        request: ZoneBatchUpdateRequest
    ) -> ZoneBatchUpdateResponse:
        """Batch update multiple zones"""
        updated_zones = []
        failed_zones = []
        
        for zone_id in request.zone_ids:
            try:
                # Create ZoneUpdate from the update data
                zone_update = ZoneUpdate(**request.update_data)
                
                # Update the zone
                await self.update_zone(zone_id, zone_update)
                updated_zones.append(zone_id)
                
            except Exception as e:
                logger.error(f"Failed to update zone {zone_id}: {str(e)}")
                failed_zones.append({
                    "zone_id": str(zone_id),
                    "error": str(e)
                })
        
        return ZoneBatchUpdateResponse(
            updated_count=len(updated_zones),
            failed_count=len(failed_zones),
            updated_zones=updated_zones,
            failed_zones=failed_zones
        )
    
    # Helper methods
    async def _get_zone_internal(self, zone_id: UUID) -> Optional[Zone]:
        """Internal method to get zone without converting to response"""
        if self.db_pool:
            async with self.db_pool.acquire() as conn:
                row = await conn.fetchrow(
                    "SELECT * FROM zones WHERE id = $1",
                    zone_id
                )
                if row:
                    zone_dict = dict(row)
                    zone_dict['coordinates'] = ZoneCoordinates(**zone_dict['coordinates'])
                    return Zone(**zone_dict)
        else:
            return self._demo_zones.get(zone_id)
        return None
    
    def _get_content_preview(self, content: Optional[str]) -> str:
        """Get preview of zone content"""
        if not content:
            return "No content extracted"
        return content[:100] + ('...' if len(content) > 100 else '')
    
    def _get_word_count(self, content: Optional[str]) -> int:
        """Get word count of content"""
        if not content:
            return 0
        return len(content.split())
    
    def _calculate_split_coordinates(
        self,
        original: ZoneCoordinates,
        split_type: str,
        split_position: Optional[float],
        split_count: Optional[int]
    ) -> List[ZoneCoordinates]:
        """Calculate coordinates for split zones"""
        coords_list = []
        
        if split_type == "horizontal":
            if split_position:
                # Split at specific position
                split_y = original.y + (original.height * split_position)
                
                # Top zone
                coords_list.append(ZoneCoordinates(
                    x=original.x,
                    y=original.y,
                    width=original.width,
                    height=split_y - original.y,
                    page_width=original.page_width,
                    page_height=original.page_height
                ))
                
                # Bottom zone
                coords_list.append(ZoneCoordinates(
                    x=original.x,
                    y=split_y,
                    width=original.width,
                    height=original.y + original.height - split_y,
                    page_width=original.page_width,
                    page_height=original.page_height
                ))
            else:
                # Split into equal parts
                count = split_count or 2
                height_per_zone = original.height / count
                
                for i in range(count):
                    coords_list.append(ZoneCoordinates(
                        x=original.x,
                        y=original.y + (i * height_per_zone),
                        width=original.width,
                        height=height_per_zone,
                        page_width=original.page_width,
                        page_height=original.page_height
                    ))
        
        elif split_type == "vertical":
            if split_position:
                # Split at specific position
                split_x = original.x + (original.width * split_position)
                
                # Left zone
                coords_list.append(ZoneCoordinates(
                    x=original.x,
                    y=original.y,
                    width=split_x - original.x,
                    height=original.height,
                    page_width=original.page_width,
                    page_height=original.page_height
                ))
                
                # Right zone
                coords_list.append(ZoneCoordinates(
                    x=split_x,
                    y=original.y,
                    width=original.x + original.width - split_x,
                    height=original.height,
                    page_width=original.page_width,
                    page_height=original.page_height
                ))
            else:
                # Split into equal parts
                count = split_count or 2
                width_per_zone = original.width / count
                
                for i in range(count):
                    coords_list.append(ZoneCoordinates(
                        x=original.x + (i * width_per_zone),
                        y=original.y,
                        width=width_per_zone,
                        height=original.height,
                        page_width=original.page_width,
                        page_height=original.page_height
                    ))
        
        elif split_type == "auto":
            # For auto split, we'll just do a simple 2x2 grid for now
            # In a real implementation, this would use ML to detect natural boundaries
            coords_list = [
                # Top-left
                ZoneCoordinates(
                    x=original.x,
                    y=original.y,
                    width=original.width / 2,
                    height=original.height / 2,
                    page_width=original.page_width,
                    page_height=original.page_height
                ),
                # Top-right
                ZoneCoordinates(
                    x=original.x + original.width / 2,
                    y=original.y,
                    width=original.width / 2,
                    height=original.height / 2,
                    page_width=original.page_width,
                    page_height=original.page_height
                ),
                # Bottom-left
                ZoneCoordinates(
                    x=original.x,
                    y=original.y + original.height / 2,
                    width=original.width / 2,
                    height=original.height / 2,
                    page_width=original.page_width,
                    page_height=original.page_height
                ),
                # Bottom-right
                ZoneCoordinates(
                    x=original.x + original.width / 2,
                    y=original.y + original.height / 2,
                    width=original.width / 2,
                    height=original.height / 2,
                    page_width=original.page_width,
                    page_height=original.page_height
                )
            ]
        
        return coords_list
    
    def _calculate_merged_coordinates(
        self,
        coords_list: List[ZoneCoordinates]
    ) -> ZoneCoordinates:
        """Calculate bounding box for merged zones"""
        if not coords_list:
            raise ValueError("No coordinates to merge")
        
        min_x = min(c.x for c in coords_list)
        min_y = min(c.y for c in coords_list)
        max_x = max(c.x + c.width for c in coords_list)
        max_y = max(c.y + c.height for c in coords_list)
        
        return ZoneCoordinates(
            x=min_x,
            y=min_y,
            width=max_x - min_x,
            height=max_y - min_y,
            page_width=coords_list[0].page_width,
            page_height=coords_list[0].page_height
        )
    
    def _merge_content(
        self,
        zones: List[Zone],
        strategy: str,
        preserve_formatting: bool
    ) -> Optional[str]:
        """Merge content from multiple zones"""
        contents = [z.content for z in zones if z.content]
        
        if not contents:
            return None
        
        if strategy == "concatenate":
            # Simple concatenation with newlines
            separator = "\n\n" if preserve_formatting else " "
            return separator.join(contents)
        
        elif strategy == "smart":
            # Smart merge based on zone types
            # Group by zone type and merge appropriately
            grouped = {}
            for zone in zones:
                if zone.content:
                    zone_type = zone.zone_type.value if hasattr(zone.zone_type, 'value') else str(zone.zone_type)
                    if zone_type not in grouped:
                        grouped[zone_type] = []
                    grouped[zone_type].append(zone.content)
            
            # Merge each group
            merged_parts = []
            for zone_type, contents in grouped.items():
                if zone_type == "text":
                    merged_parts.append("\n\n".join(contents))
                elif zone_type == "table":
                    # For tables, try to preserve structure
                    merged_parts.append("\n".join(contents))
                else:
                    merged_parts.append("\n".join(contents))
            
            return "\n\n".join(merged_parts)
        
        elif strategy == "preserve_layout":
            # Sort zones by position and merge
            sorted_zones = sorted(zones, key=lambda z: (z.coordinates.y, z.coordinates.x))
            contents = [z.content for z in sorted_zones if z.content]
            return "\n".join(contents)
        
        return "\n".join(contents)
    
    def _determine_merged_type(self, zones: List[Zone]) -> ZoneType:
        """Determine the type for merged zone"""
        # Count zone types
        type_counts = {}
        for zone in zones:
            zone_type = zone.zone_type
            type_counts[zone_type] = type_counts.get(zone_type, 0) + 1
        
        # Return most common type
        if type_counts:
            return max(type_counts.items(), key=lambda x: x[1])[0]
        
        return ZoneType.UNKNOWN
    
    async def _clear_zone_cache(self, zone_id: UUID, document_id: UUID):
        """Clear zone-related cache entries"""
        if not self.redis:
            return
        
        try:
            # Clear specific zone cache
            await self.redis.delete(f"zone:{zone_id}")
            
            # Clear document zones cache
            await self.redis.delete(f"document:{document_id}:zones")
            
        except Exception as e:
            logger.warning(f"Failed to clear zone cache: {e}")