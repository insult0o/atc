import { useState, useEffect, useCallback, useRef } from 'react';
import { useWebSocket } from './useWebSocket';
import { WeightedConfidenceScore } from '../../lib/pdf-processing/confidence-weighting';

// WebSocket event types for confidence updates
export interface ConfidenceUpdateEvent {
  type: 'confidence:updated';
  data: {
    zoneId: string;
    toolName: string;
    confidence: WeightedConfidenceScore;
    timestamp: Date;
    updateType: 'initial' | 'refinement' | 'correction' | 'final';
  };
}

export interface ConfidenceBatchUpdate {
  updates: ConfidenceUpdateEvent['data'][];
  batchId: string;
  timestamp: Date;
}

export interface UseConfidenceUpdatesOptions {
  documentId: string;
  onUpdate?: (update: ConfidenceUpdateEvent['data']) => void;
  onBatchUpdate?: (batch: ConfidenceBatchUpdate) => void;
  batchWindowMs?: number; // Time window for batching updates
  enableOptimisticUpdates?: boolean;
  transitionDuration?: number; // Duration for smooth transitions
}

export interface ConfidenceUpdateState {
  confidenceScores: Map<string, Map<string, WeightedConfidenceScore>>; // zoneId -> toolName -> score
  pendingUpdates: ConfidenceUpdateEvent['data'][];
  isConnected: boolean;
  error: string | null;
}

export function useConfidenceUpdates({
  documentId,
  onUpdate,
  onBatchUpdate,
  batchWindowMs = 100,
  enableOptimisticUpdates = true,
  transitionDuration = 300
}: UseConfidenceUpdatesOptions) {
  const [state, setState] = useState<ConfidenceUpdateState>({
    confidenceScores: new Map(),
    pendingUpdates: [],
    isConnected: false,
    error: null
  });

  const batchTimerRef = useRef<NodeJS.Timeout | null>(null);
  const updateQueueRef = useRef<ConfidenceUpdateEvent['data'][]>([]);
  const optimisticUpdatesRef = useRef<Map<string, WeightedConfidenceScore>>(new Map());

  // WebSocket URL - adjust based on your environment
  const wsUrl = process.env.NEXT_PUBLIC_WS_URL || `ws://localhost:3000/api/ws?documentId=${documentId}`;

  // Handle incoming WebSocket messages
  const handleWebSocketMessage = useCallback((message: any) => {
    if (message.type === 'confidence:updated') {
      const update = message.data as ConfidenceUpdateEvent['data'];
      
      // Add to update queue
      updateQueueRef.current.push(update);

      // Trigger individual update callback if provided
      onUpdate?.(update);

      // Reset batch timer and schedule batch processing
      if (batchTimerRef.current) {
        clearTimeout(batchTimerRef.current);
      }

      batchTimerRef.current = setTimeout(() => {
        processBatchedUpdates();
      }, batchWindowMs);
    }
  }, [onUpdate, batchWindowMs]);

  // Process batched updates
  const processBatchedUpdates = useCallback(() => {
    const updates = [...updateQueueRef.current];
    updateQueueRef.current = [];

    if (updates.length === 0) return;

    // Create batch update
    const batch: ConfidenceBatchUpdate = {
      updates,
      batchId: generateBatchId(),
      timestamp: new Date()
    };

    // Update state with batched updates
    setState(prev => {
      const newScores = new Map(prev.confidenceScores);

      updates.forEach(update => {
        if (!newScores.has(update.zoneId)) {
          newScores.set(update.zoneId, new Map());
        }
        
        const zoneScores = newScores.get(update.zoneId)!;
        zoneScores.set(update.toolName, update.confidence);
      });

      return {
        ...prev,
        confidenceScores: newScores,
        pendingUpdates: []
      };
    });

    // Trigger batch update callback
    onBatchUpdate?.(batch);
  }, [onBatchUpdate]);

  // WebSocket connection
  const { isConnected, error, sendMessage } = useWebSocket(wsUrl, {
    onMessage: handleWebSocketMessage,
    onError: (error) => {
      setState(prev => ({ ...prev, error: 'WebSocket connection error' }));
    }
  });

  // Update connection state
  useEffect(() => {
    setState(prev => ({ ...prev, isConnected, error }));
  }, [isConnected, error]);

  // Subscribe to confidence updates for the document
  useEffect(() => {
    if (isConnected) {
      sendMessage({
        type: 'subscribe',
        data: {
          channel: 'confidence',
          documentId
        }
      });

      return () => {
        sendMessage({
          type: 'unsubscribe',
          data: {
            channel: 'confidence',
            documentId
          }
        });
      };
    }
  }, [isConnected, documentId, sendMessage]);

  // Clean up batch timer on unmount
  useEffect(() => {
    return () => {
      if (batchTimerRef.current) {
        clearTimeout(batchTimerRef.current);
      }
    };
  }, []);

  // Get confidence score for a specific zone and tool
  const getConfidenceScore = useCallback((zoneId: string, toolName: string): WeightedConfidenceScore | null => {
    const zoneScores = state.confidenceScores.get(zoneId);
    if (!zoneScores) return null;
    return zoneScores.get(toolName) || null;
  }, [state.confidenceScores]);

  // Get all confidence scores for a zone
  const getZoneConfidenceScores = useCallback((zoneId: string): Map<string, WeightedConfidenceScore> => {
    return state.confidenceScores.get(zoneId) || new Map();
  }, [state.confidenceScores]);

  // Optimistic update function
  const applyOptimisticUpdate = useCallback((
    zoneId: string,
    toolName: string,
    confidence: WeightedConfidenceScore
  ) => {
    if (!enableOptimisticUpdates) return;

    const key = `${zoneId}-${toolName}`;
    optimisticUpdatesRef.current.set(key, confidence);

    // Update state optimistically
    setState(prev => {
      const newScores = new Map(prev.confidenceScores);
      
      if (!newScores.has(zoneId)) {
        newScores.set(zoneId, new Map());
      }
      
      const zoneScores = newScores.get(zoneId)!;
      zoneScores.set(toolName, confidence);

      return {
        ...prev,
        confidenceScores: newScores
      };
    });

    // Send update to server
    sendMessage({
      type: 'confidence:update',
      data: {
        zoneId,
        toolName,
        confidence,
        timestamp: new Date()
      }
    });
  }, [enableOptimisticUpdates, sendMessage]);

  // Rollback optimistic update
  const rollbackOptimisticUpdate = useCallback((
    zoneId: string,
    toolName: string,
    previousConfidence?: WeightedConfidenceScore
  ) => {
    const key = `${zoneId}-${toolName}`;
    optimisticUpdatesRef.current.delete(key);

    setState(prev => {
      const newScores = new Map(prev.confidenceScores);
      const zoneScores = newScores.get(zoneId);

      if (zoneScores) {
        if (previousConfidence) {
          zoneScores.set(toolName, previousConfidence);
        } else {
          zoneScores.delete(toolName);
        }
      }

      return {
        ...prev,
        confidenceScores: newScores
      };
    });
  }, []);

  // Get transition styles for smooth updates
  const getTransitionStyle = useCallback((confidence: number): React.CSSProperties => {
    return {
      transition: `all ${transitionDuration}ms ease-in-out`,
      opacity: confidence,
      transform: `scale(${0.95 + confidence * 0.05})`
    };
  }, [transitionDuration]);

  // Calculate aggregate confidence for a zone
  const getZoneAggregateConfidence = useCallback((zoneId: string): number => {
    const scores = getZoneConfidenceScores(zoneId);
    if (scores.size === 0) return 0;

    let totalWeightedScore = 0;
    let totalWeight = 0;

    scores.forEach(score => {
      totalWeightedScore += score.finalScore * score.weight;
      totalWeight += score.weight;
    });

    return totalWeight > 0 ? totalWeightedScore / totalWeight : 0;
  }, [getZoneConfidenceScores]);

  // Get confidence trend for a zone
  const getConfidenceTrend = useCallback((zoneId: string, toolName: string): 'improving' | 'declining' | 'stable' => {
    // This would be implemented with historical data tracking
    // For now, return 'stable' as a placeholder
    return 'stable';
  }, []);

  return {
    // State
    confidenceScores: state.confidenceScores,
    pendingUpdates: state.pendingUpdates,
    isConnected: state.isConnected,
    error: state.error,

    // Functions
    getConfidenceScore,
    getZoneConfidenceScores,
    getZoneAggregateConfidence,
    applyOptimisticUpdate,
    rollbackOptimisticUpdate,
    getTransitionStyle,
    getConfidenceTrend,

    // Utilities
    processBatchedUpdates
  };
}

// Helper function to generate batch IDs
function generateBatchId(): string {
  return `batch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Export types and interfaces
export type { ConfidenceUpdateEvent, ConfidenceBatchUpdate, UseConfidenceUpdatesOptions, ConfidenceUpdateState };