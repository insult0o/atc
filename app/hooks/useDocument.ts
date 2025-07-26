import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useDocumentStore } from '../stores/document-store';
import { useWebSocket } from './useWebSocket';
import { useEffect, useCallback } from 'react';
import type { Document, Zone, ProcessingStatus } from '@pdf-platform/shared';

interface DocumentResponse {
  document: Document;
  zones: Zone[];
  processingStatus: ProcessingStatus;
}

interface UploadOptions {
  autoProcess?: boolean;
  confidenceThreshold?: number;
}

interface UseDocumentOptions {
  enableRealtime?: boolean;
  autoRefresh?: boolean;
}

export function useDocument(documentId?: string, options: UseDocumentOptions = {}) {
  const { enableRealtime = true, autoRefresh = true } = options;
  const queryClient = useQueryClient();
  const documentStore = useDocumentStore();

  // WebSocket connection for real-time updates
  const { isConnected, sendMessage } = useWebSocket(
    documentId ? `/api/ws?documentId=${documentId}` : '',
    {
      onMessage: handleWebSocketMessage,
      onError: (error) => {
        console.error('WebSocket error:', error);
        documentStore.setError('Real-time connection lost');
      }
    }
  );

  // Handle WebSocket messages
  function handleWebSocketMessage(message: { type: string; data?: any; message?: string }) {
    console.log('WebSocket message received:', message);
    
    switch (message.type) {
      case 'zone_detected':
        // New zone detected during processing
        if (message.data?.zone) {
          documentStore.addZone(message.data.zone);
          // Invalidate queries to refresh data
          queryClient.invalidateQueries({ queryKey: ['document', documentId] });
        }
        break;

      case 'zone_processing_started':
        // Zone processing began
        if (message.data?.zoneId) {
          documentStore.updateZone(message.data.zoneId, { 
            status: 'processing' 
          });
        }
        break;

      case 'zone_processing_progress':
        // Processing progress update
        if (message.data?.processingStatus) {
          documentStore.setProcessing(message.data.processingStatus);
        }
        break;

      case 'zone_processing_completed':
        // Zone processing finished
        if (message.data?.zone) {
          documentStore.updateZone(message.data.zone.id, {
            ...message.data.zone,
            status: 'completed'
          });
        }
        break;

      case 'zone_manual_override':
        // User made manual edit to zone
        if (message.data?.zone) {
          documentStore.updateZone(message.data.zone.id, {
            ...message.data.zone,
            status: 'manual_override'
          });
        }
        break;

      case 'document_export_ready':
        // Export generation completed
        queryClient.invalidateQueries({ queryKey: ['exports', documentId] });
        break;

      case 'system_error':
        // Processing error occurred
        documentStore.setError(message.data?.error || 'Processing error occurred');
        break;

      default:
        console.warn('Unknown WebSocket message type:', message.type);
    }
  }

  // Fetch document data
  const documentQuery = useQuery({
    queryKey: ['document', documentId],
    queryFn: async (): Promise<DocumentResponse> => {
      if (!documentId) throw new Error('Document ID required');
      
      const response = await fetch(`/api/documents/${documentId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch document');
      }
      
      return response.json();
    },
    enabled: !!documentId,
    staleTime: autoRefresh ? 30000 : Infinity, // 30 seconds
    refetchInterval: autoRefresh ? 60000 : false, // 1 minute
  });

  // Upload document mutation
  const uploadMutation = useMutation({
    mutationFn: async (file: File): Promise<DocumentResponse> => {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch('/api/documents/upload', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error('Upload failed');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      // Update store with new document data
      documentStore.setDocument(data.document);
      documentStore.zones = data.zones;
      documentStore.setProcessing(data.processingStatus);
      
      // Update React Query cache
      queryClient.setQueryData(['document', data.document.id], data);
      
      // Start real-time updates if enabled
      if (enableRealtime && sendMessage) {
        sendMessage({
          type: 'subscribe_document',
          data: { documentId: data.document.id }
        });
      }
    },
    onError: (error) => {
      documentStore.setError(error instanceof Error ? error.message : 'Upload failed');
    }
  });

  // Update zone content mutation
  const updateZoneMutation = useMutation({
    mutationFn: async ({ 
      zoneId, 
      content, 
      reprocess 
    }: { 
      zoneId: string; 
      content?: string; 
      reprocess?: boolean;
    }) => {
      const response = await fetch(`/api/zones/${zoneId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content, reprocess }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to update zone');
      }
      
      return response.json();
    },
    onMutate: async ({ zoneId, content }) => {
      // Optimistic update
      if (content) {
        documentStore.updateZone(zoneId, { 
          content,
          status: 'manual_override',
          lastUpdated: new Date()
        });
      }
    },
    onError: (error, variables) => {
      // Revert optimistic update on error
      queryClient.invalidateQueries({ queryKey: ['document', documentId] });
      documentStore.setError(error instanceof Error ? error.message : 'Update failed');
    }
  });

  // Reprocess zone mutation
  const reprocessZoneMutation = useMutation({
    mutationFn: async ({ zoneId, tool }: { zoneId: string; tool?: string }) => {
      const response = await fetch(`/api/zones/${zoneId}/reprocess`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ tool }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to reprocess zone');
      }
      
      return response.json();
    },
    onMutate: async ({ zoneId }) => {
      // Optimistic update to show processing state
      documentStore.updateZone(zoneId, { 
        status: 'processing',
        lastUpdated: new Date()
      });
    },
    onError: (error) => {
      documentStore.setError(error instanceof Error ? error.message : 'Reprocessing failed');
    }
  });

  // Sync React Query data with Zustand store
  useEffect(() => {
    if (documentQuery.data) {
      documentStore.setDocument(documentQuery.data.document);
      documentStore.zones = documentQuery.data.zones;
      documentStore.setProcessing(documentQuery.data.processingStatus);
    }
  }, [documentQuery.data, documentStore]);

  // Handle query errors
  useEffect(() => {
    if (documentQuery.error) {
      documentStore.setError(
        documentQuery.error instanceof Error 
          ? documentQuery.error.message 
          : 'Failed to load document'
      );
    }
  }, [documentQuery.error, documentStore]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (documentId && enableRealtime && sendMessage) {
        sendMessage({
          type: 'unsubscribe_document',
          data: { documentId }
        });
      }
    };
  }, [documentId, enableRealtime, sendMessage]);

  // Zone management helpers
  const updateZoneContent = useCallback((zoneId: string, content: string) => {
    updateZoneMutation.mutate({ zoneId, content });
  }, [updateZoneMutation]);

  const reprocessZone = useCallback((zoneId: string, tool?: string) => {
    reprocessZoneMutation.mutate({ zoneId, tool });
  }, [reprocessZoneMutation]);

  const uploadDocument = useCallback((file: File) => {
    documentStore.reset(); // Clear previous state
    return uploadMutation.mutateAsync(file);
  }, [uploadMutation, documentStore]);

  // Computed values
  const isLoading = documentQuery.isLoading || uploadMutation.isPending;
  const isProcessing = documentStore.processing.currentlyProcessing.length > 0;
  const hasError = !!documentStore.error || !!documentQuery.error;
  
  const processingProgress = documentStore.processing.totalZones > 0
    ? (documentStore.processing.completedZones / documentStore.processing.totalZones) * 100
    : 0;

  return {
    // Data
    document: documentStore.document,
    zones: documentStore.zones,
    processing: documentStore.processing,
    
    // State
    isLoading,
    isProcessing,
    isConnected: enableRealtime ? isConnected : true,
    hasError,
    error: documentStore.error || documentQuery.error,
    processingProgress,
    
    // Actions
    uploadDocument,
    updateZoneContent,
    reprocessZone,
    refetch: documentQuery.refetch,
    reset: documentStore.reset,
    
    // Zone helpers
    getZonesByPage: useCallback((page: number) => 
      documentStore.zones.filter(zone => zone.page === page), 
      [documentStore.zones]
    ),
    
    getZoneById: useCallback((zoneId: string) => 
      documentStore.zones.find(zone => zone.id === zoneId), 
      [documentStore.zones]
    ),
    
    getLowConfidenceZones: useCallback((threshold: number) => 
      documentStore.zones.filter(zone => zone.confidence < threshold), 
      [documentStore.zones]
    ),
    
    // Mutation states for UI feedback
    isUploading: uploadMutation.isPending,
    isUpdatingZone: updateZoneMutation.isPending,
    isReprocessing: reprocessZoneMutation.isPending,
  };
} 