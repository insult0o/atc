import { useEffect, useState } from 'react';
import { documentAPI } from '@/lib/api/documents';

interface ProcessingStatus {
  document_id: string;
  status: string;
  processing_started_at?: string;
  processing_completed_at?: string;
  progress: number;
  current_zone_id?: string;
  total_zones: number;
  completed_zones: number;
  error_message?: string;
  is_complete: boolean;
  processing_status: string;
}

interface UseProcessingStatusOptions {
  pollingInterval?: number;
  onComplete?: (status: ProcessingStatus) => void;
  onError?: (error: Error) => void;
}

export function useProcessingStatus(
  documentId: string | null,
  options: UseProcessingStatusOptions = {}
) {
  const {
    pollingInterval = 2000, // Poll every 2 seconds
    onComplete,
    onError
  } = options;

  const [status, setStatus] = useState<ProcessingStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!documentId) {
      setStatus(null);
      return;
    }

    let intervalId: NodeJS.Timeout;
    let isMounted = true;

    const fetchStatus = async () => {
      if (!isMounted) return;
      
      setIsLoading(true);
      try {
        const statusData = await documentAPI.getDocumentStatus(documentId);
        
        if (isMounted) {
          setStatus(statusData);
          setError(null);
          
          // If processing is complete, stop polling
          if (statusData.is_complete) {
            clearInterval(intervalId);
            onComplete?.(statusData);
          }
        }
      } catch (err) {
        if (isMounted) {
          const error = err instanceof Error ? err : new Error('Failed to fetch status');
          setError(error);
          onError?.(error);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    // Initial fetch
    fetchStatus();

    // Set up polling if not complete
    if (!status?.is_complete) {
      intervalId = setInterval(fetchStatus, pollingInterval);
    }

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, [documentId, pollingInterval, onComplete, onError, status?.is_complete]);

  return {
    status,
    isLoading,
    error,
    progress: status?.progress || 0,
    isComplete: status?.is_complete || false,
    processingStatus: status?.processing_status || 'unknown'
  };
}