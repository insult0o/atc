import { useCallback, useState, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, File, AlertCircle, Clock, CheckCircle } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { Progress } from '../../../components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '../../../components/ui/alert';
import { useWebSocket } from '../../hooks/useWebSocket';

interface UploadZoneProps {
  onUpload: (file: File) => Promise<{ documentId: string; document: any }>;
  maxSize?: number;
  enableRealtime?: boolean;
}

export function UploadZone({ onUpload, maxSize = 100 * 1024 * 1024, enableRealtime = true }: UploadZoneProps) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [processingStage, setProcessingStage] = useState<string>('');
  const [processingProgress, setProcessingProgress] = useState(0);
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [isCompleted, setIsCompleted] = useState(false);

  // WebSocket connection for real-time processing updates
  const { isConnected, sendMessage } = useWebSocket(
    documentId ? `/api/ws?documentId=${documentId}` : '',
    {
      onMessage: handleWebSocketMessage,
      onError: (error) => {
        console.error('WebSocket error during upload:', error);
      }
    }
  );

  // Handle WebSocket messages for processing updates
  function handleWebSocketMessage(message: { type: string; data?: any; message?: string }) {
    console.log('Upload WebSocket message:', message);
    
    switch (message.type) {
      case 'zone_detected':
        setProcessingStage('Detecting content zones...');
        if (message.data?.totalZones) {
          setProcessingProgress(20); // Zone detection started
        }
        break;
        
      case 'zone_processing_started':
        setProcessingStage('Processing detected zones...');
        setProcessingProgress(40);
        break;
        
      case 'zone_processing_progress':
        setProcessingStage('Extracting content...');
        if (message.data?.processingStatus) {
          const { completedZones, totalZones } = message.data.processingStatus;
          const progress = totalZones > 0 ? (completedZones / totalZones) * 60 + 40 : 40;
          setProcessingProgress(Math.min(90, progress));
        }
        break;
        
      case 'document_processing_completed':
        setProcessingStage('Processing complete!');
        setProcessingProgress(100);
        setIsCompleted(true);
        setTimeout(() => {
          setUploading(false);
        }, 1500);
        break;
        
      case 'system_error':
        setError(message.data?.error || 'Processing error occurred');
        setUploading(false);
        break;
    }
  }

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    try {
      setError(null);
      setUploading(true);
      setProgress(0);
      setProcessingProgress(0);
      setProcessingStage('');
      setIsCompleted(false);
      setDocumentId(null);

      // Validate file type
      if (file.type !== 'application/pdf') {
        throw new Error('Please upload a PDF file');
      }

      // Validate file size
      if (file.size > maxSize) {
        throw new Error(`File size exceeds ${maxSize / (1024 * 1024)}MB limit`);
      }

      // Simulate upload progress
      setProcessingStage('Uploading file...');
      for (let i = 0; i <= 100; i += 10) {
        setProgress(i);
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Start upload and get document ID
      const result = await onUpload(file);
      setDocumentId(result.documentId);
      
      if (enableRealtime) {
        setProcessingStage('Initializing processing...');
        setProcessingProgress(10);
        
        // Subscribe to processing updates
        if (sendMessage) {
          sendMessage({
            type: 'subscribe_document',
            data: { documentId: result.documentId }
          });
        }
      } else {
        // If real-time is disabled, mark as completed immediately
        setProcessingStage('Upload complete!');
        setProcessingProgress(100);
        setIsCompleted(true);
        setTimeout(() => {
          setUploading(false);
        }, 1000);
      }
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
      setUploading(false);
    }
  }, [maxSize, onUpload, enableRealtime, sendMessage]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf']
    },
    maxFiles: 1,
    disabled: uploading
  });

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div
        {...getRootProps()}
        className={cn(
          'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
          isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25',
          uploading && 'opacity-50 cursor-not-allowed'
        )}
      >
        <input {...getInputProps()} />
        
        <div className="flex flex-col items-center gap-4">
          {uploading ? (
            <Upload className="w-12 h-12 text-muted-foreground animate-bounce" />
          ) : (
            <File className="w-12 h-12 text-muted-foreground" />
          )}
          
          <div className="text-lg font-medium">
            {isDragActive ? (
              'Drop the PDF here'
            ) : uploading ? (
              'Uploading...'
            ) : (
              <>
                Drag & drop your PDF here, or <span className="text-primary">browse</span>
              </>
            )}
          </div>
          
          <p className="text-sm text-muted-foreground">
            PDF files only, up to {maxSize / (1024 * 1024)}MB
          </p>
        </div>
      </div>

      {uploading && (
        <div className="mt-4">
          <Progress value={progress} className="h-2" />
          <p className="mt-2 text-sm text-center text-muted-foreground">
            Uploading... {progress.toFixed(0)}%
          </p>
        </div>
      )}

      {error && (
        <Alert variant="destructive" className="mt-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
} 