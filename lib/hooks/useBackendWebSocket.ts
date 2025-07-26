/**
 * Enhanced WebSocket hook for real-time backend communication
 */
import { useEffect, useRef, useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

// Event types matching our backend EventType enum
export enum BackendEventType {
  // Connection events
  CONNECTION_ESTABLISHED = 'connection_established',
  CONNECTION_CLOSED = 'connection_closed',
  CONNECTION_FAILED = 'connection_failed',
  
  // User events
  USER_JOINED = 'user_joined',
  USER_LEFT = 'user_left',
  USER_STATUS_CHANGED = 'user_status_changed',
  
  // Processing events
  PROCESSING_STARTED = 'processing_started',
  PROCESSING_PROGRESS = 'processing_progress',
  PROCESSING_COMPLETED = 'processing_completed',
  PROCESSING_FAILED = 'processing_failed',
  PROCESSING_CANCELLED = 'processing_cancelled',
  
  // Zone events
  ZONE_DETECTED = 'zone_detected',
  ZONE_PROCESSED = 'zone_processed',
  ZONE_UPDATED = 'zone_updated',
  ZONE_CONFIDENCE_UPDATED = 'zone_confidence_updated',
  
  // Export events
  EXPORT_STARTED = 'export_started',
  EXPORT_PROGRESS = 'export_progress',
  EXPORT_COMPLETED = 'export_completed',
  EXPORT_FAILED = 'export_failed',
  EXPORT_READY = 'export_ready',
  
  // Document events
  DOCUMENT_UPLOADED = 'document_uploaded',
  DOCUMENT_VALIDATED = 'document_validated',
  DOCUMENT_UPDATED = 'document_updated',
  DOCUMENT_DELETED = 'document_deleted',
  
  // System events
  SYSTEM_NOTIFICATION = 'system_notification',
  ERROR_OCCURRED = 'error_occurred',
  MAINTENANCE_ALERT = 'maintenance_alert'
}

export interface BackendWebSocketEvent {
  id: string;
  type: BackendEventType;
  data: any;
  timestamp: string;
  user_id?: string;
  room_id?: string;
  priority: 'low' | 'normal' | 'high' | 'critical';
}

export interface ProcessingProgressData {
  job_id: string;
  document_id: string;
  stage: string;
  progress_percentage: number;
  current_page: number;
  total_pages: number;
  zones_processed: number;
  zones_detected: number;
  eta_seconds?: number;
  message?: string;
  errors_count: number;
  last_error?: any;
}

export interface ZoneProcessingData {
  job_id: string;
  zone_id: string;
  zone_type: string;
  confidence: number;
  processing_time: number;
  error?: string;
  zones_completed: number;
  zones_total: number;
}

export interface ExportProgressData {
  export_id: string;
  document_id: string;
  progress_percentage: number;
  current_format: string;
  formats_completed: number;
  formats_total: number;
  estimated_completion_time?: string;
  message?: string;
}

export interface ConnectionState {
  isConnected: boolean;
  connectionId?: string;
  userId?: string;
  reconnectAttempts: number;
  lastConnected?: Date;
  serverCapabilities: string[];
}

interface UseBackendWebSocketOptions {
  userId?: string;
  autoConnect?: boolean;
  subscriptions?: {
    documents?: string[];
    jobs?: string[];
    exports?: string[];
    rooms?: string[];
  };
  onProcessingProgress?: (data: ProcessingProgressData) => void;
  onZoneProcessing?: (data: ZoneProcessingData) => void;
  onExportProgress?: (data: ExportProgressData) => void;
  onDocumentEvent?: (event: BackendWebSocketEvent) => void;
  onSystemNotification?: (data: any) => void;
  onError?: (error: string) => void;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}

export function useBackendWebSocket(options: UseBackendWebSocketOptions = {}) {
  const {
    userId = 'anonymous',
    autoConnect = true,
    subscriptions = {},
    onProcessingProgress,
    onZoneProcessing,
    onExportProgress,
    onDocumentEvent,
    onSystemNotification,
    onError,
    reconnectInterval = 5000,
    maxReconnectAttempts = 10
  } = options;

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const queryClient = useQueryClient();
  
  const [connectionState, setConnectionState] = useState<ConnectionState>({
    isConnected: false,
    reconnectAttempts: 0,
    serverCapabilities: []
  });

  const [activeSubscriptions, setActiveSubscriptions] = useState<Set<string>>(new Set());

  // Get WebSocket URL
  const getWebSocketUrl = useCallback(() => {
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || `${wsProtocol}//${window.location.host}`;
    return `${baseUrl.replace(/^http/, 'ws')}/ws/connect?user_id=${userId}`;
  }, [userId]);

  // Handle incoming messages
  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const message: BackendWebSocketEvent = JSON.parse(event.data);
      
      // Handle different event types
      switch (message.type) {
        case BackendEventType.CONNECTION_ESTABLISHED:
          setConnectionState(prev => ({
            ...prev,
            isConnected: true,
            connectionId: message.data.client_id,
            lastConnected: new Date(),
            serverCapabilities: message.data.capabilities || [],
            reconnectAttempts: 0
          }));
          
          // Re-establish subscriptions
          Object.entries(subscriptions).forEach(([type, ids]) => {
            if (ids && ids.length > 0 && type !== 'rooms') {
              ids.forEach(id => {
                subscribeToUpdates(type as 'documents' | 'jobs' | 'exports', id);
              });
            }
          });
          break;

        case BackendEventType.PROCESSING_PROGRESS:
          onProcessingProgress?.(message.data as ProcessingProgressData);
          
          // Invalidate related queries
          queryClient.invalidateQueries({ 
            queryKey: ['processing', message.data.job_id] 
          });
          queryClient.invalidateQueries({ 
            queryKey: ['document', message.data.document_id] 
          });
          break;

        case BackendEventType.ZONE_PROCESSED:
          onZoneProcessing?.(message.data as ZoneProcessingData);
          
          // Invalidate zone queries
          queryClient.invalidateQueries({ 
            queryKey: ['zones', message.data.job_id] 
          });
          break;

        case BackendEventType.EXPORT_PROGRESS:
          onExportProgress?.(message.data as ExportProgressData);
          
          // Invalidate export queries
          queryClient.invalidateQueries({ 
            queryKey: ['export', message.data.export_id] 
          });
          break;

        case BackendEventType.DOCUMENT_UPLOADED:
        case BackendEventType.DOCUMENT_UPDATED:
        case BackendEventType.DOCUMENT_DELETED:
          onDocumentEvent?.(message);
          
          // Invalidate document lists and specific document
          queryClient.invalidateQueries({ queryKey: ['documents'] });
          if (message.data.document_id) {
            queryClient.invalidateQueries({ 
              queryKey: ['document', message.data.document_id] 
            });
          }
          break;

        case BackendEventType.PROCESSING_COMPLETED:
          // Invalidate multiple related queries
          queryClient.invalidateQueries({ 
            queryKey: ['processing', message.data.job_id] 
          });
          queryClient.invalidateQueries({ 
            queryKey: ['document', message.data.document_id] 
          });
          queryClient.invalidateQueries({ 
            queryKey: ['zones', message.data.document_id] 
          });
          break;

        case BackendEventType.EXPORT_COMPLETED:
          queryClient.invalidateQueries({ 
            queryKey: ['export', message.data.export_id] 
          });
          queryClient.invalidateQueries({ 
            queryKey: ['exports', message.data.document_id] 
          });
          break;

        case BackendEventType.SYSTEM_NOTIFICATION:
          onSystemNotification?.(message.data);
          break;

        case BackendEventType.ERROR_OCCURRED:
          onError?.(message.data.error || 'Unknown error occurred');
          break;

        default:
          console.log('Unhandled WebSocket event:', message.type, message.data);
      }
    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
      onError?.('Failed to parse WebSocket message');
    }
  }, [
    subscriptions, 
    onProcessingProgress, 
    onZoneProcessing, 
    onExportProgress, 
    onDocumentEvent, 
    onSystemNotification, 
    onError,
    queryClient
  ]);

  // Connect to WebSocket
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      const url = getWebSocketUrl();
      wsRef.current = new WebSocket(url);

      wsRef.current.onopen = () => {
        console.log('WebSocket connected to backend');
        setConnectionState(prev => ({ ...prev, isConnected: true }));
      };

      wsRef.current.onmessage = handleMessage;

      wsRef.current.onclose = (event) => {
        console.log('WebSocket disconnected:', event.code, event.reason);
        setConnectionState(prev => ({
          ...prev,
          isConnected: false,
          connectionId: undefined
        }));

        // Attempt reconnection if not at limit
        if (connectionState.reconnectAttempts < maxReconnectAttempts) {
          const delay = Math.min(
            reconnectInterval * Math.pow(2, connectionState.reconnectAttempts),
            30000
          );
          
          reconnectTimeoutRef.current = setTimeout(() => {
            setConnectionState(prev => ({
              ...prev,
              reconnectAttempts: prev.reconnectAttempts + 1
            }));
            connect();
          }, delay);
        }
      };

      wsRef.current.onerror = (error) => {
        console.error('WebSocket error:', error);
        onError?.('WebSocket connection error');
      };

    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      onError?.('Failed to create WebSocket connection');
    }
  }, [
    getWebSocketUrl, 
    handleMessage, 
    connectionState.reconnectAttempts, 
    maxReconnectAttempts, 
    reconnectInterval,
    onError
  ]);

  // Disconnect from WebSocket
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close(1000, 'Client disconnect');
      wsRef.current = null;
    }

    setConnectionState(prev => ({
      ...prev,
      isConnected: false,
      connectionId: undefined,
      reconnectAttempts: 0
    }));
  }, []);

  // Send message to server
  const sendMessage = useCallback((type: string, data: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      const message = {
        type,
        data,
        timestamp: new Date().toISOString()
      };
      wsRef.current.send(JSON.stringify(message));
    } else {
      onError?.('WebSocket is not connected');
    }
  }, [onError]);

  // Subscribe to specific updates
  const subscribeToUpdates = useCallback((type: 'documents' | 'jobs' | 'exports', id: string) => {
    const subscriptionKey = `${type}_${id}`;
    
    if (!activeSubscriptions.has(subscriptionKey)) {
      const subscriptionType = {
        documents: 'document',
        jobs: 'processing_job',
        exports: 'export'
      }[type];

      sendMessage('subscribe', {
        type: subscriptionType,
        [`${subscriptionType}_id`]: id
      });

      setActiveSubscriptions(prev => new Set(Array.from(prev).concat(subscriptionKey)));
    }
  }, [sendMessage, activeSubscriptions]);

  // Unsubscribe from updates
  const unsubscribeFromUpdates = useCallback((type: 'documents' | 'jobs' | 'exports', id: string) => {
    const subscriptionKey = `${type}_${id}`;
    
    if (activeSubscriptions.has(subscriptionKey)) {
      const subscriptionType = {
        documents: 'document',
        jobs: 'processing_job',
        exports: 'export'
      }[type];

      sendMessage('unsubscribe', {
        type: subscriptionType,
        [`${subscriptionType}_id`]: id
      });

      setActiveSubscriptions(prev => {
        const newSet = new Set(prev);
        newSet.delete(subscriptionKey);
        return newSet;
      });
    }
  }, [sendMessage, activeSubscriptions]);

  // Get connection status
  const getConnectionStatus = useCallback(() => {
    sendMessage('status_request', { type: 'connection' });
  }, [sendMessage]);

  // Auto-connect on mount if enabled
  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [autoConnect, connect, disconnect]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, []);

  return {
    // Connection state
    ...connectionState,
    
    // Actions
    connect,
    disconnect,
    sendMessage,
    subscribeToUpdates,
    unsubscribeFromUpdates,
    getConnectionStatus,
    
    // Status
    activeSubscriptions: Array.from(activeSubscriptions)
  };
} 