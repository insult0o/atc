'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useWebSocketContext, WebSocketEventType } from '@/providers/websocket-provider';
import { Zone } from '@/lib/types/zone';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Lock, Unlock, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface CollaborativeZoneEditorProps {
  zone: Zone;
  documentId: string;
  onUpdate: (updates: Partial<Zone>) => void;
  className?: string;
}

export function CollaborativeZoneEditor({
  zone,
  documentId,
  onUpdate,
  className
}: CollaborativeZoneEditorProps) {
  const { activeUsers, currentUser, sendZoneUpdate, subscribe } = useWebSocketContext();
  const [isLocked, setIsLocked] = useState(false);
  const [lockedBy, setLockedBy] = useState<string | null>(null);
  const [hasConflict, setHasConflict] = useState(false);
  const [version, setVersion] = useState(0);
  const [isEditing, setIsEditing] = useState(false);

  // Subscribe to zone events
  useEffect(() => {
    const unsubscribeLocked = subscribe(WebSocketEventType.ZONE_LOCKED, (data) => {
      if (data.zone_id === zone.id) {
        setIsLocked(true);
        setLockedBy(data.user_id);
        if (data.user_id !== currentUser?.user_id) {
          const user = activeUsers.get(data.user_id);
          toast.info(`${user?.user_name || 'Someone'} is editing this zone`);
        }
      }
    });

    const unsubscribeUnlocked = subscribe(WebSocketEventType.ZONE_UNLOCKED, (data) => {
      if (data.zone_id === zone.id) {
        setIsLocked(false);
        setLockedBy(null);
      }
    });

    const unsubscribeUpdated = subscribe(WebSocketEventType.ZONE_UPDATED, (data) => {
      if (data.zone_id === zone.id && data.user_id !== currentUser?.user_id) {
        // Zone was updated by another user
        setVersion(data.version || version + 1);
        const user = activeUsers.get(data.user_id);
        toast.info(`${user?.user_name || 'Someone'} updated this zone`);
      }
    });

    const unsubscribeConflict = subscribe(WebSocketEventType.COLLABORATION_CONFLICT, (data) => {
      if (data.zone_id === zone.id) {
        setHasConflict(true);
      }
    });

    return () => {
      unsubscribeLocked();
      unsubscribeUnlocked();
      unsubscribeUpdated();
      unsubscribeConflict();
    };
  }, [zone.id, currentUser, activeUsers, subscribe, version]);

  const handleLockToggle = useCallback(() => {
    if (isLocked && lockedBy === currentUser?.user_id) {
      // Unlock
      sendZoneUpdate(documentId, zone.id, 'unlock', {});
      setIsEditing(false);
    } else if (!isLocked) {
      // Lock
      sendZoneUpdate(documentId, zone.id, 'lock', {});
      setIsEditing(true);
    }
  }, [isLocked, lockedBy, currentUser, sendZoneUpdate, documentId, zone.id]);

  const handleContentChange = useCallback((newContent: string) => {
    if (!isEditing || (isLocked && lockedBy !== currentUser?.user_id)) {
      return;
    }

    // Optimistic update
    onUpdate({ content: newContent });

    // Send update through WebSocket
    sendZoneUpdate(
      documentId,
      zone.id,
      'update',
      { content: newContent },
      version
    );
  }, [isEditing, isLocked, lockedBy, currentUser, onUpdate, sendZoneUpdate, documentId, zone.id, version]);

  const canEdit = !isLocked || lockedBy === currentUser?.user_id;
  const isLockedByOther = isLocked && lockedBy !== currentUser?.user_id;
  const lockingUser = isLockedByOther ? activeUsers.get(lockedBy!) : null;

  return (
    <Card
      className={cn(
        "p-4 transition-all",
        isLockedByOther && "opacity-75",
        hasConflict && "border-red-500",
        className
      )}
      data-testid={`collaborative-zone-${zone.id}`}
    >
      <div className="space-y-4">
        {/* Zone header with lock status */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="font-medium">Zone {zone.zone_index}</h3>
            {isLocked && (
              <div
                className="flex items-center gap-1 text-sm"
                style={{ color: lockingUser?.user_color }}
                data-testid="zone-lock-indicator"
              >
                <Lock className="w-4 h-4" />
                <span>{lockingUser?.user_name || 'Locked'}</span>
              </div>
            )}
          </div>

          <Button
            variant={isLocked && lockedBy === currentUser?.user_id ? "destructive" : "outline"}
            size="sm"
            onClick={handleLockToggle}
            disabled={isLockedByOther}
            data-testid="zone-lock-button"
          >
            {isLocked && lockedBy === currentUser?.user_id ? (
              <>
                <Unlock className="w-4 h-4 mr-1" />
                Unlock
              </>
            ) : (
              <>
                <Lock className="w-4 h-4 mr-1" />
                Lock to Edit
              </>
            )}
          </Button>
        </div>

        {/* Conflict warning */}
        {hasConflict && (
          <Alert variant="destructive" data-testid="conflict-alert">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              This zone has conflicting changes. Please refresh to see the latest version.
            </AlertDescription>
          </Alert>
        )}

        {/* Zone content editor */}
        <div className="relative">
          <textarea
            value={zone.content}
            onChange={(e) => handleContentChange(e.target.value)}
            disabled={!canEdit || !isEditing}
            className={cn(
              "w-full min-h-[100px] p-2 border rounded",
              !canEdit && "bg-gray-100 cursor-not-allowed",
              isEditing && "ring-2 ring-primary"
            )}
            placeholder="Zone content..."
            data-testid="zone-content-editor"
          />
          
          {/* Show who's editing */}
          {isLockedByOther && lockingUser && (
            <div
              className="absolute -top-2 -right-2 px-2 py-1 text-xs rounded-full text-white"
              style={{ backgroundColor: lockingUser.user_color }}
              data-testid="editing-user-indicator"
            >
              {lockingUser.user_name} is editing
            </div>
          )}
        </div>

        {/* Zone metadata */}
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span>Type: {zone.zone_type}</span>
          <span>Confidence: {(zone.confidence_score * 100).toFixed(1)}%</span>
          <span>Version: {version}</span>
        </div>
      </div>
    </Card>
  );
}