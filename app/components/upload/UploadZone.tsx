import { useCallback, useState, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, File, AlertCircle, Clock, CheckCircle, Sparkles, Zap, Brain } from 'lucide-react';
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
  const [isDragActive, setIsDragActive] = useState(false);

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
        setProcessingStage('🎯 Detecting intelligent zones...');
        if (message.data?.totalZones) {
          setProcessingProgress(20);
        }
        break;
        
      case 'zone_processing_started':
        setProcessingStage('🧠 Processing detected zones with AI...');
        setProcessingProgress(40);
        break;
        
      case 'zone_processing_progress':
        setProcessingStage('✨ Extracting insights...');
        if (message.data?.processingStatus) {
          const { completedZones, totalZones } = message.data.processingStatus;
          const progress = totalZones > 0 ? (completedZones / totalZones) * 60 + 40 : 40;
          setProcessingProgress(Math.min(90, progress));
        }
        break;
        
      case 'document_processing_completed':
        setProcessingStage('🎉 Processing complete! Intelligence extracted.');
        setProcessingProgress(100);
        setIsCompleted(true);
        setTimeout(() => {
          setUploading(false);
        }, 2000);
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

      // Simulate upload progress with modern staging
      setProcessingStage('🚀 Uploading to secure cloud...');
      for (let i = 0; i <= 100; i += 10) {
        setProgress(i);
        await new Promise(resolve => setTimeout(resolve, 120));
      }

      // Start upload and get document ID
      const result = await onUpload(file);
      setDocumentId(result.documentId);
      
      if (enableRealtime) {
        setProcessingStage('🔍 Initializing AI analysis...');
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
        setProcessingStage('✅ Upload complete!');
        setProcessingProgress(100);
        setIsCompleted(true);
        setTimeout(() => {
          setUploading(false);
        }, 1500);
      }
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
      setUploading(false);
    }
  }, [maxSize, onUpload, enableRealtime, sendMessage]);

  const { getRootProps, getInputProps, isDragActive: isDragActiveDropzone } = useDropzone({
    onDrop,
    onDragEnter: () => setIsDragActive(true),
    onDragLeave: () => setIsDragActive(false),
    accept: {
      'application/pdf': ['.pdf']
    },
    maxFiles: 1,
    disabled: uploading
  });

  // Effect to handle drag state
  useEffect(() => {
    setIsDragActive(isDragActiveDropzone);
  }, [isDragActiveDropzone]);

  return (
    <div className="w-full max-w-4xl mx-auto space-y-8">
      {/* Main Upload Zone with Liquid Glass Effect */}
      <div
        {...getRootProps()}
        className={cn(
          // Base styles with glass morphism
          'relative overflow-hidden rounded-3xl border-2 transition-all duration-500 cursor-pointer group',
          'backdrop-blur-xl bg-gradient-to-br from-white/20 via-white/10 to-white/5',
          'dark:from-black/20 dark:via-black/10 dark:to-black/5',
          
          // Border and shadow effects
          isDragActive || uploading
            ? 'border-blue-400/50 shadow-2xl shadow-blue-500/20'
            : 'border-white/30 dark:border-white/20 shadow-xl shadow-black/5',
          
          // Hover effects
          !uploading && 'hover:border-blue-400/40 hover:shadow-2xl hover:shadow-blue-500/10 hover:scale-[1.02]',
          
          // Disabled state
          uploading && 'cursor-not-allowed opacity-80'
        )}
      >
        <input {...getInputProps()} />
        
        {/* Animated Background Gradient */}
        <div className={cn(
          'absolute inset-0 opacity-0 transition-opacity duration-500',
          (isDragActive || uploading) && 'opacity-100'
        )}>
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-purple-500/10 to-pink-500/10 animate-pulse" />
          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-r from-transparent via-white/5 to-transparent animate-pulse delay-300" />
        </div>

        {/* Content Container */}
        <div className="relative z-10 p-12 text-center space-y-8">
          {/* Icon Section with Advanced Animations */}
          <div className="relative">
            {uploading ? (
              <div className="relative">
                <div className="w-24 h-24 mx-auto rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-2xl shadow-blue-500/40 animate-pulse">
                  {isCompleted ? (
                    <CheckCircle className="w-12 h-12 text-white animate-bounce" />
                  ) : processingProgress > 50 ? (
                    <Brain className="w-12 h-12 text-white animate-pulse" />
                  ) : (
                    <Zap className="w-12 h-12 text-white animate-spin" />
                  )}
                </div>
                {/* Floating particles effect */}
                <div className="absolute inset-0 pointer-events-none">
                  <Sparkles className="absolute -top-2 -right-2 w-6 h-6 text-yellow-400 animate-ping" />
                  <Sparkles className="absolute -bottom-2 -left-2 w-4 h-4 text-blue-400 animate-ping delay-300" />
                  <Sparkles className="absolute top-1/2 -left-4 w-5 h-5 text-purple-400 animate-ping delay-700" />
                </div>
              </div>
            ) : (
              <div className={cn(
                'w-24 h-24 mx-auto rounded-2xl flex items-center justify-center transition-all duration-500',
                'bg-gradient-to-br from-slate-100 via-blue-50 to-indigo-100',
                'dark:from-slate-800 dark:via-blue-900 dark:to-indigo-900',
                'shadow-xl shadow-black/10',
                'group-hover:scale-110 group-hover:shadow-2xl group-hover:shadow-blue-500/20',
                isDragActive && 'scale-110 bg-gradient-to-br from-blue-100 via-purple-100 to-pink-100 dark:from-blue-800 dark:via-purple-800 dark:to-pink-800'
              )}>
                <Upload className={cn(
                  'w-12 h-12 transition-all duration-500',
                  isDragActive ? 'text-blue-600 scale-110' : 'text-slate-600 dark:text-slate-400',
                  'group-hover:text-blue-600 dark:group-hover:text-blue-400'
                )} />
              </div>
            )}
          </div>

          {/* Text Content with Enhanced Typography */}
          <div className="space-y-4">
            <h3 className={cn(
              'text-2xl md:text-3xl font-bold transition-all duration-300',
              isDragActive 
                ? 'text-blue-600 dark:text-blue-400' 
                : 'text-slate-800 dark:text-slate-200',
              uploading && 'text-blue-600 dark:text-blue-400'
            )}>
              {isDragActive ? (
                'Drop your PDF here! 🎯'
              ) : uploading ? (
                isCompleted ? 'Intelligence Extracted! ✨' : 'Processing with AI...'
              ) : (
                'Transform Your PDF with AI Intelligence'
              )}
            </h3>
            
            <p className={cn(
              'text-lg transition-all duration-300',
              isDragActive 
                ? 'text-blue-600/80 dark:text-blue-400/80' 
                : 'text-slate-600 dark:text-slate-400'
            )}>
              {isDragActive ? (
                'Release to start AI analysis'
              ) : uploading ? (
                processingStage || 'Preparing for processing...'
              ) : (
                <>
                  Drag & drop your PDF here, or{' '}
                  <span className="text-blue-600 dark:text-blue-400 font-semibold">click to browse</span>
                </>
              )}
            </p>

            {/* File Requirements with Pills */}
            {!uploading && (
              <div className="flex flex-wrap justify-center gap-2">
                <span className="px-3 py-1 text-xs font-medium bg-white/40 dark:bg-black/40 backdrop-blur-sm rounded-full border border-white/30 dark:border-white/20 text-slate-600 dark:text-slate-400">
                  PDF files only
                </span>
                <span className="px-3 py-1 text-xs font-medium bg-white/40 dark:bg-black/40 backdrop-blur-sm rounded-full border border-white/30 dark:border-white/20 text-slate-600 dark:text-slate-400">
                  Max {maxSize / (1024 * 1024)}MB
                </span>
                <span className="px-3 py-1 text-xs font-medium bg-gradient-to-r from-blue-500/20 to-purple-500/20 backdrop-blur-sm rounded-full border border-blue-400/30 text-blue-600 dark:text-blue-400">
                  ✨ AI-Powered
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Edge glow effect */}
        <div className={cn(
          'absolute inset-0 rounded-3xl opacity-0 transition-opacity duration-500 pointer-events-none',
          'bg-gradient-to-r from-blue-500/20 via-transparent to-purple-500/20',
          (isDragActive || uploading) && 'opacity-100'
        )} />
      </div>

      {/* Progress Section with Advanced Animations */}
      {uploading && (
        <div className="space-y-6">
          {/* Upload Progress */}
          <div className="backdrop-blur-xl bg-white/10 dark:bg-black/10 border border-white/20 dark:border-white/10 rounded-2xl p-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
                  Upload Progress
                </span>
                <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
                  {progress.toFixed(0)}%
                </span>
              </div>
              <div className="relative">
                <Progress value={progress} className="h-3 bg-white/20 dark:bg-black/20" />
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-full animate-pulse" />
              </div>
            </div>
          </div>

          {/* Processing Progress (if enabled) */}
          {enableRealtime && processingProgress > 0 && (
            <div className="backdrop-blur-xl bg-white/10 dark:bg-black/10 border border-white/20 dark:border-white/10 rounded-2xl p-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
                    AI Processing
                  </span>
                  <span className="text-sm font-bold text-purple-600 dark:text-purple-400">
                    {processingProgress.toFixed(0)}%
                  </span>
                </div>
                <div className="relative">
                  <Progress value={processingProgress} className="h-3 bg-white/20 dark:bg-black/20" />
                  <div className="absolute inset-0 bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-full animate-pulse" />
                </div>
                {processingStage && (
                  <p className="text-sm text-center text-slate-600 dark:text-slate-400 font-medium">
                    {processingStage}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Real-time Status Indicator */}
          {enableRealtime && (
            <div className="flex items-center justify-center space-x-2 text-sm">
              <div className={cn(
                'w-2 h-2 rounded-full',
                isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'
              )} />
              <span className="text-slate-600 dark:text-slate-400">
                Real-time: {isConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Error Display with Modern Styling */}
      {error && (
        <Alert variant="destructive" className="backdrop-blur-xl bg-red-50/50 dark:bg-red-950/50 border-red-200/50 dark:border-red-800/50">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Upload Error</AlertTitle>
          <AlertDescription className="text-sm">{error}</AlertDescription>
        </Alert>
      )}

      {/* Success State */}
      {isCompleted && (
        <div className="backdrop-blur-xl bg-green-50/50 dark:bg-green-950/50 border border-green-200/50 dark:border-green-800/50 rounded-2xl p-6 text-center">
          <CheckCircle className="w-12 h-12 text-green-600 dark:text-green-400 mx-auto mb-4 animate-bounce" />
          <h3 className="text-lg font-bold text-green-800 dark:text-green-200 mb-2">
            Processing Complete! 🎉
          </h3>
          <p className="text-green-600 dark:text-green-400">
            Your document has been successfully processed and analyzed.
          </p>
        </div>
      )}
    </div>
  );
} 