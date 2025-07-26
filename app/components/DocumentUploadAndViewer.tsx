'use client';

import React, { useState, useCallback } from 'react';
import { AlertTriangle, RefreshCw, X } from 'lucide-react';
import { UploadZone } from './upload/UploadZone';
import { PDFViewer } from './viewer/PDFViewer';
import { useDocument } from '../hooks/useDocument';
import { Button } from '../../components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '../../components/ui/alert';
import { ErrorBoundary } from './error-boundary';
import type { CreateZoneRequest } from '@pdf-platform/shared';

interface DocumentUploadAndViewerProps {
  className?: string;
}

type ViewState = 'upload' | 'processing' | 'viewing' | 'error';

interface ErrorInfo {
  type: 'upload' | 'processing' | 'viewer' | 'network';
  message: string;
  retryable: boolean;
  details?: string;
}

export function DocumentUploadAndViewer({ className }: DocumentUploadAndViewerProps) {
  const [viewState, setViewState] = useState<ViewState>('upload');
  const [currentDocumentId, setCurrentDocumentId] = useState<string | null>(null);
  const [selectedZone, setSelectedZone] = useState<string | undefined>();
  const [errorInfo, setErrorInfo] = useState<ErrorInfo | null>(null);
  const [confidenceThreshold, setConfidenceThreshold] = useState(0.7);

  // Document management hook
  const {
    document,
    zones,
    processing,
    isLoading,
    isProcessing,
    isConnected,
    hasError,
    error,
    processingProgress,
    uploadDocument,
    updateZoneContent,
    reprocessZone,
    refetch,
    reset,
    getZonesByPage,
    isUploading,
    isUpdatingZone,
    isReprocessing
  } = useDocument(currentDocumentId || undefined, {
    enableRealtime: true,
    autoRefresh: true
  });

  // Handle file upload
  const handleUpload = useCallback(async (file: File) => {
    try {
      setErrorInfo(null);
      setViewState('processing');
      
      const result = await uploadDocument(file);
      setCurrentDocumentId(result.document.id);
      
      // Wait for processing to complete or timeout
      setTimeout(() => {
        if (result.document.status === 'uploaded' || result.document.status === 'processing') {
          setViewState('viewing');
        }
      }, 1000);
      
      return { documentId: result.document.id, document: result.document };
      
    } catch (error) {
      console.error('Upload failed:', error);
      const errorInfo: ErrorInfo = {
        type: 'upload',
        message: error instanceof Error ? error.message : 'Upload failed',
        retryable: true,
        details: 'Please check your file and try again'
      };
      setErrorInfo(errorInfo);
      setViewState('error');
      throw error;
    }
  }, [uploadDocument]);

  // Handle zone selection
  const handleZoneSelect = useCallback((zoneId: string) => {
    setSelectedZone(zoneId);
  }, []);

  // Handle zone creation
  const handleZoneCreate = useCallback(async (zoneRequest: CreateZoneRequest) => {
    try {
      console.log('Creating new zone:', zoneRequest);
      // TODO: Implement zone creation API call
      // For now, just log the request
    } catch (error) {
      console.error('Zone creation failed:', error);
      const errorInfo: ErrorInfo = {
        type: 'processing',
        message: 'Failed to create zone',
        retryable: true,
        details: error instanceof Error ? error.message : 'Unknown error'
      };
      setErrorInfo(errorInfo);
    }
  }, []);

  // Handle zone content updates
  const handleZoneContentUpdate = useCallback(async (zoneId: string, content: string) => {
    try {
      await updateZoneContent(zoneId, content);
    } catch (error) {
      console.error('Zone update failed:', error);
      const errorInfo: ErrorInfo = {
        type: 'processing',
        message: 'Failed to update zone content',
        retryable: true,
        details: error instanceof Error ? error.message : 'Unknown error'
      };
      setErrorInfo(errorInfo);
    }
  }, [updateZoneContent]);

  // Handle zone reprocessing
  const handleZoneReprocess = useCallback(async (zoneId: string, tool?: string) => {
    try {
      await reprocessZone(zoneId, tool);
    } catch (error) {
      console.error('Zone reprocessing failed:', error);
      const errorInfo: ErrorInfo = {
        type: 'processing',
        message: 'Failed to reprocess zone',
        retryable: true,
        details: error instanceof Error ? error.message : 'Unknown error'
      };
      setErrorInfo(errorInfo);
    }
  }, [reprocessZone]);

  // Handle retry operations
  const handleRetry = useCallback(() => {
    setErrorInfo(null);
    
    if (currentDocumentId) {
      refetch();
      setViewState('viewing');
    } else {
      setViewState('upload');
    }
  }, [currentDocumentId, refetch]);

  // Handle reset to start over
  const handleReset = useCallback(() => {
    reset();
    setCurrentDocumentId(null);
    setSelectedZone(undefined);
    setErrorInfo(null);
    setViewState('upload');
  }, [reset]);

  // Monitor for errors and connection issues
  React.useEffect(() => {
    if (hasError && error) {
      const errorInfo: ErrorInfo = {
        type: 'network',
        message: typeof error === 'string' ? error : 'An error occurred',
        retryable: true,
        details: 'Check your connection and try again'
      };
      setErrorInfo(errorInfo);
      setViewState('error');
    }
  }, [hasError, error]);

  // Monitor connection status
  React.useEffect(() => {
    if (!isConnected && currentDocumentId) {
      const errorInfo: ErrorInfo = {
        type: 'network',
        message: 'Lost connection to server',
        retryable: true,
        details: 'Real-time updates are unavailable'
      };
      setErrorInfo(errorInfo);
    }
  }, [isConnected, currentDocumentId]);

  // Render upload state
  if (viewState === 'upload') {
    return (
      <div className={`max-w-4xl mx-auto p-6 ${className}`}>
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            PDF Intelligence Platform
          </h1>
          <p className="text-gray-600">
            Upload a PDF to extract and process its content with AI-powered tools
          </p>
        </div>
        
        <ErrorBoundary>
          <UploadZone 
            onUpload={handleUpload}
            enableRealtime={true}
          />
        </ErrorBoundary>
      </div>
    );
  }

  // Render error state
  if (viewState === 'error' && errorInfo) {
    return (
      <div className={`max-w-4xl mx-auto p-6 ${className}`}>
        <Alert variant="destructive" className="mb-6">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error: {errorInfo.message}</AlertTitle>
          <AlertDescription>
            {errorInfo.details}
          </AlertDescription>
        </Alert>
        
        <div className="flex gap-4 justify-center">
          {errorInfo.retryable && (
            <Button onClick={handleRetry} className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4" />
              Retry
            </Button>
          )}
          <Button variant="outline" onClick={handleReset} className="flex items-center gap-2">
            <X className="w-4 h-4" />
            Start Over
          </Button>
        </div>
      </div>
    );
  }

  // Render processing state
  if (viewState === 'processing' || isLoading) {
    return (
      <div className={`max-w-4xl mx-auto p-6 ${className}`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold mb-2">Processing Document</h2>
          <p className="text-gray-600 mb-4">
            {isProcessing ? `Processing zones... ${Math.round(processingProgress)}% complete` : 'Initializing...'}
          </p>
          
          {processing.estimatedTimeRemaining > 0 && (
            <p className="text-sm text-gray-500">
              Estimated time remaining: {processing.estimatedTimeRemaining} seconds
            </p>
          )}
        </div>
      </div>
    );
  }

  // Render viewing state
  if (viewState === 'viewing' && document) {
    return (
      <ErrorBoundary>
        <div className={`h-screen flex flex-col ${className}`}>
          {/* Header */}
          <div className="border-b bg-background p-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-lg font-semibold">{document.name}</h1>
                <p className="text-sm text-muted-foreground">
                  {zones.length} zones detected • {Math.round(processingProgress)}% processed
                </p>
              </div>
              
              <div className="flex items-center gap-4">
                {!isConnected && (
                  <Alert className="w-auto">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>Connection lost</AlertDescription>
                  </Alert>
                )}
                
                <Button variant="outline" onClick={handleReset}>
                  Upload New Document
                </Button>
              </div>
            </div>
          </div>

          {/* PDF Viewer */}
          <div className="flex-1 overflow-hidden">
            <PDFViewer
              pdfUrl={document.filePath}
              zones={zones}
              selectedZone={selectedZone}
              onZoneSelect={handleZoneSelect}
              onZoneCreate={handleZoneCreate}
              confidenceThreshold={confidenceThreshold}
            />
          </div>

          {/* Status bar */}
          {(isUploading || isUpdatingZone || isReprocessing) && (
            <div className="border-t bg-muted p-2">
              <div className="flex items-center gap-2 text-sm">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                {isUploading && 'Uploading...'}
                {isUpdatingZone && 'Updating zone...'}
                {isReprocessing && 'Reprocessing zone...'}
              </div>
            </div>
          )}
        </div>
      </ErrorBoundary>
    );
  }

  return null;
} 