"""
Conflict resolution for collaborative editing
"""

from typing import Dict, Any, Optional, List, Tuple
from datetime import datetime
import logging
from enum import Enum

from ..models.zone import Zone

logger = logging.getLogger(__name__)


class ConflictType(str, Enum):
    """Types of conflicts that can occur"""
    CONCURRENT_EDIT = "concurrent_edit"
    DELETE_WHILE_EDITING = "delete_while_editing"
    VERSION_MISMATCH = "version_mismatch"
    LOCKED_ZONE = "locked_zone"


class ConflictResolutionStrategy(str, Enum):
    """Strategies for resolving conflicts"""
    LAST_WRITE_WINS = "last_write_wins"
    MERGE = "merge"
    MANUAL = "manual"
    LOCK_BASED = "lock_based"


class ConflictResolver:
    """Handles conflict resolution for collaborative zone editing"""
    
    def __init__(self):
        self.zone_versions: Dict[str, int] = {}
        self.zone_locks: Dict[str, str] = {}  # zone_id -> user_id
        self.conflict_history: List[Dict[str, Any]] = []
    
    def detect_conflict(
        self,
        zone_id: str,
        local_version: int,
        remote_version: int,
        local_changes: Dict[str, Any],
        remote_changes: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        """Detect if there's a conflict between local and remote changes"""
        
        # Check version mismatch
        if local_version != remote_version:
            return {
                "type": ConflictType.VERSION_MISMATCH,
                "local_version": local_version,
                "remote_version": remote_version,
                "severity": "high"
            }
        
        # Check if zone is locked by another user
        if zone_id in self.zone_locks:
            return {
                "type": ConflictType.LOCKED_ZONE,
                "locked_by": self.zone_locks[zone_id],
                "severity": "medium"
            }
        
        # Check for concurrent edits on same fields
        conflicting_fields = []
        for field in local_changes:
            if field in remote_changes and local_changes[field] != remote_changes[field]:
                conflicting_fields.append(field)
        
        if conflicting_fields:
            return {
                "type": ConflictType.CONCURRENT_EDIT,
                "conflicting_fields": conflicting_fields,
                "severity": "high"
            }
        
        return None
    
    def resolve_conflict(
        self,
        conflict: Dict[str, Any],
        local_changes: Dict[str, Any],
        remote_changes: Dict[str, Any],
        strategy: ConflictResolutionStrategy = ConflictResolutionStrategy.LAST_WRITE_WINS
    ) -> Tuple[Dict[str, Any], bool]:
        """
        Resolve a conflict based on the specified strategy
        Returns: (resolved_changes, requires_user_intervention)
        """
        
        if strategy == ConflictResolutionStrategy.LAST_WRITE_WINS:
            # Remote changes win (last write wins)
            return remote_changes, False
        
        elif strategy == ConflictResolutionStrategy.MERGE:
            # Attempt to merge non-conflicting changes
            merged = {}
            requires_intervention = False
            
            # Add all remote changes
            merged.update(remote_changes)
            
            # Add local changes that don't conflict
            for field, value in local_changes.items():
                if field not in remote_changes:
                    merged[field] = value
                elif field in conflict.get("conflicting_fields", []):
                    # For conflicting fields, prefer remote but flag for review
                    requires_intervention = True
                    merged[f"{field}_local"] = value
                    merged[f"{field}_conflict"] = True
            
            return merged, requires_intervention
        
        elif strategy == ConflictResolutionStrategy.LOCK_BASED:
            # Check if the user has the lock
            if conflict["type"] == ConflictType.LOCKED_ZONE:
                # Cannot proceed without lock
                return {}, True
            return local_changes, False
        
        else:  # MANUAL
            # Require user intervention
            return {
                "local_changes": local_changes,
                "remote_changes": remote_changes,
                "conflict": conflict
            }, True
    
    def acquire_lock(self, zone_id: str, user_id: str) -> bool:
        """Acquire a lock on a zone for exclusive editing"""
        if zone_id in self.zone_locks and self.zone_locks[zone_id] != user_id:
            return False
        
        self.zone_locks[zone_id] = user_id
        logger.info(f"Lock acquired on zone {zone_id} by user {user_id}")
        return True
    
    def release_lock(self, zone_id: str, user_id: str) -> bool:
        """Release a lock on a zone"""
        if zone_id in self.zone_locks and self.zone_locks[zone_id] == user_id:
            del self.zone_locks[zone_id]
            logger.info(f"Lock released on zone {zone_id} by user {user_id}")
            return True
        return False
    
    def is_locked(self, zone_id: str) -> Optional[str]:
        """Check if a zone is locked and by whom"""
        return self.zone_locks.get(zone_id)
    
    def update_version(self, zone_id: str, version: int):
        """Update the version number for a zone"""
        self.zone_versions[zone_id] = version
    
    def get_version(self, zone_id: str) -> int:
        """Get the current version number for a zone"""
        return self.zone_versions.get(zone_id, 0)
    
    def record_conflict(
        self,
        zone_id: str,
        conflict_type: ConflictType,
        users_involved: List[str],
        resolution: Dict[str, Any]
    ):
        """Record a conflict for history and analytics"""
        self.conflict_history.append({
            "zone_id": zone_id,
            "timestamp": datetime.utcnow().isoformat(),
            "conflict_type": conflict_type,
            "users_involved": users_involved,
            "resolution": resolution
        })
    
    def get_conflict_history(self, zone_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get conflict history, optionally filtered by zone"""
        if zone_id:
            return [c for c in self.conflict_history if c["zone_id"] == zone_id]
        return self.conflict_history
    
    def suggest_resolution(
        self,
        conflict: Dict[str, Any],
        local_changes: Dict[str, Any],
        remote_changes: Dict[str, Any],
        zone_metadata: Optional[Dict[str, Any]] = None
    ) -> str:
        """Suggest a resolution strategy based on conflict type and context"""
        
        if conflict["type"] == ConflictType.LOCKED_ZONE:
            return "Wait for the lock to be released or request edit access"
        
        elif conflict["type"] == ConflictType.VERSION_MISMATCH:
            if conflict["remote_version"] > conflict["local_version"]:
                return "Update to the latest version before making changes"
            else:
                return "Your changes are based on a newer version - proceed with caution"
        
        elif conflict["type"] == ConflictType.CONCURRENT_EDIT:
            conflicting_fields = conflict.get("conflicting_fields", [])
            
            # Check if conflicts are on critical fields
            critical_fields = ["content", "type", "confidence_score"]
            if any(field in critical_fields for field in conflicting_fields):
                return "Manual review required - critical fields have conflicting changes"
            else:
                return "Non-critical fields conflict - automatic merge recommended"
        
        return "Manual review recommended"


# Global conflict resolver instance
conflict_resolver = ConflictResolver()