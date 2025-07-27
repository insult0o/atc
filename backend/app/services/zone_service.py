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
        redis_client: Optional[redis.Redis] = None
    ):
        self.db_pool = db_pool
        self.supabase = supabase_client
        self.redis = redis_client
        self._demo_zones = {}  # For demo mode
        
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
                    params.append(zone_type.value)
                
                if status:
                    conditions.append(f"status = ${len(params) + 1}")
                    params.append(status.value)
                
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
                by_type[zone.zone_type.value] = by_type.get(zone.zone_type.value, 0) + 1
                by_status[zone.status.value] = by_status.get(zone.status.value, 0) + 1
                if zone.confidence is not None:
                    total_confidence += zone.confidence
                    confidence_count += 1
            
            average_confidence = total_confidence / confidence_count if confidence_count > 0 else None
            
            # Convert to response models
            zone_responses = []
            for zone in zones:
                zone_response = ZoneResponse(
                    **zone.model_dump(),
                    content_preview=self._get_content_preview(zone.content),
                    word_count=self._get_word_count(zone.content),
                    character_count=len(zone.content) if zone.content else 0
                )
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
            
            zone = Zone(
                id=zone_id,
                created_at=now,
                updated_at=now,
                **zone_data.model_dump()
            )
            
            if self.db_pool:
                # Production mode
                async with self.db_pool.acquire() as conn:
                    await conn.execute("""
                        INSERT INTO zones (
                            id, document_id, zone_index, page_number,
                            zone_type, coordinates, content, confidence,
                            processing_tool, status, metadata,
                            created_at, updated_at
                        ) VALUES (
                            $1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, $10,
                            $11::jsonb, $12, $13
                        )
                    """,
                    zone.id, zone.document_id, zone.zone_index, zone.page_number,
                    zone.zone_type.value, json.dumps(zone.coordinates.model_dump()),
                    zone.content, zone.confidence, zone.processing_tool,
                    zone.status.value, json.dumps(zone.metadata),
                    zone.created_at, zone.updated_at
                    )
            else:
                # Demo mode
                self._demo_zones[zone_id] = zone
            
            logger.info(f"Created zone {zone_id} for document {zone.document_id}")
            
            return ZoneResponse(
                **zone.model_dump(),
                content_preview=self._get_content_preview(zone.content),
                word_count=self._get_word_count(zone.content),
                character_count=len(zone.content) if zone.content else 0
            )
            
        except Exception as e:
            logger.error(f"Error creating zone: {str(e)}")
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
            
            return ZoneResponse(
                **zone.model_dump(),
                content_preview=self._get_content_preview(zone.content),
                word_count=self._get_word_count(zone.content),
                character_count=len(zone.content) if zone.content else 0
            )
            
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
            
            return ZoneResponse(
                **zone.model_dump(),
                content_preview=self._get_content_preview(zone.content),
                word_count=self._get_word_count(zone.content),
                character_count=len(zone.content) if zone.content else 0
            )
            
        except ZoneNotFoundError:
            raise
        except Exception as e:
            logger.error(f"Error updating zone {zone_id}: {str(e)}")
            raise
    
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
                    zone_type = zone.zone_type.value
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