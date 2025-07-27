import { useState, useCallback, useRef } from 'react';
import { useWebSocketContext, WebSocketEventType } from '@/providers/websocket-provider';

interface OptimisticUpdate<T> {
  id: string;
  data: T;
  timestamp: number;
  confirmed: boolean;
}

export function useOptimisticUpdates<T extends { id: string }>(
  initialData: T[],
  documentId: string
) {
  const [data, setData] = useState<T[]>(initialData);
  const [pendingUpdates, setPendingUpdates] = useState<Map<string, OptimisticUpdate<T>>>(new Map());
  const { sendZoneUpdate, subscribe } = useWebSocketContext();
  const versionRef = useRef(0);

  // Apply optimistic update
  const applyOptimisticUpdate = useCallback((item: T, action: 'create' | 'update' | 'delete') => {
    const updateId = `${item.id}-${Date.now()}`;
    
    // Apply update immediately
    setData(prevData => {
      switch (action) {
        case 'create':
          return [...prevData, item];
        case 'update':
          return prevData.map(d => d.id === item.id ? item : d);
        case 'delete':
          return prevData.filter(d => d.id !== item.id);
        default:
          return prevData;
      }
    });

    // Track pending update
    setPendingUpdates(prev => new Map(prev).set(updateId, {
      id: updateId,
      data: item,
      timestamp: Date.now(),
      confirmed: false
    }));

    // Send update through WebSocket
    sendZoneUpdate(
      documentId,
      item.id,
      action,
      item,
      versionRef.current
    );

    return updateId;
  }, [documentId, sendZoneUpdate]);

  // Handle server confirmation
  const confirmUpdate = useCallback((updateId: string) => {
    setPendingUpdates(prev => {
      const updated = new Map(prev);
      const update = updated.get(updateId);
      if (update) {
        update.confirmed = true;
        updated.set(updateId, update);
      }
      return updated;
    });
    versionRef.current += 1;
  }, []);

  // Handle server rejection (rollback)
  const rollbackUpdate = useCallback((updateId: string) => {
    const update = pendingUpdates.get(updateId);
    if (!update) return;

    // Rollback the optimistic update
    setData(prevData => {
      // This is simplified - in a real app, you'd need to track the previous state
      return prevData.filter(d => d.id !== update.data.id);
    });

    // Remove from pending
    setPendingUpdates(prev => {
      const updated = new Map(prev);
      updated.delete(updateId);
      return updated;
    });
  }, [pendingUpdates]);

  // Subscribe to real-time updates
  React.useEffect(() => {
    const unsubscribeCreated = subscribe(WebSocketEventType.ZONE_CREATED, (eventData) => {
      if (!pendingUpdates.has(eventData.update_id)) {
        // This is a remote update, apply it
        setData(prev => [...prev, eventData.zone_data]);
      } else {
        // Confirm our optimistic update
        confirmUpdate(eventData.update_id);
      }
    });

    const unsubscribeUpdated = subscribe(WebSocketEventType.ZONE_UPDATED, (eventData) => {
      if (!pendingUpdates.has(eventData.update_id)) {
        // Remote update
        setData(prev => prev.map(d => d.id === eventData.zone_id ? eventData.zone_data : d));
      } else {
        confirmUpdate(eventData.update_id);
      }
    });

    const unsubscribeDeleted = subscribe(WebSocketEventType.ZONE_DELETED, (eventData) => {
      if (!pendingUpdates.has(eventData.update_id)) {
        // Remote delete
        setData(prev => prev.filter(d => d.id !== eventData.zone_id));
      } else {
        confirmUpdate(eventData.update_id);
      }
    });

    const unsubscribeConflict = subscribe(WebSocketEventType.COLLABORATION_CONFLICT, (eventData) => {
      // Handle conflicts by rolling back optimistic updates
      if (eventData.update_id && pendingUpdates.has(eventData.update_id)) {
        rollbackUpdate(eventData.update_id);
      }
    });

    // Cleanup old pending updates
    const cleanupInterval = setInterval(() => {
      const now = Date.now();
      const timeout = 30000; // 30 seconds

      setPendingUpdates(prev => {
        const updated = new Map(prev);
        updated.forEach((update, id) => {
          if (!update.confirmed && now - update.timestamp > timeout) {
            // Timeout - assume failed
            rollbackUpdate(id);
          }
        });
        return updated;
      });
    }, 5000);

    return () => {
      unsubscribeCreated();
      unsubscribeUpdated();
      unsubscribeDeleted();
      unsubscribeConflict();
      clearInterval(cleanupInterval);
    };
  }, [subscribe, confirmUpdate, rollbackUpdate, pendingUpdates]);

  return {
    data,
    pendingUpdates: Array.from(pendingUpdates.values()),
    applyOptimisticUpdate,
    isAnyPending: pendingUpdates.size > 0
  };
}