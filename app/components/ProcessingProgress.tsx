'use client';

import React from 'react';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Clock, AlertCircle, Loader2 } from 'lucide-react';
import { useProcessingStatus } from '@/app/hooks/useProcessingStatus';

interface ProcessingProgressProps {
  documentId: string | null;
  onComplete?: () => void;
  className?: string;
}

export function ProcessingProgress({ 
  documentId, 
  onComplete,
  className = ''
}: ProcessingProgressProps) {
  const { status, isLoading, error, progress, isComplete } = useProcessingStatus(
    documentId,
    {
      onComplete: () => {
        onComplete?.();
      }
    }
  );

  if (!documentId || (!status && !isLoading)) {
    return null;
  }

  const getStatusIcon = () => {
    if (error) return <AlertCircle className="w-5 h-5 text-red-500" />;
    if (isComplete) return <CheckCircle className="w-5 h-5 text-green-500" />;
    if (isLoading) return <Loader2 className="w-5 h-5 animate-spin" />;
    return <Clock className="w-5 h-5 text-blue-500" />;
  };

  const getStatusText = () => {
    if (error) return 'Processing Failed';
    if (isComplete) return 'Processing Complete';
    if (status?.processing_status === 'processing') return 'Processing Document...';
    if (status?.processing_status === 'queued') return 'Queued for Processing';
    return 'Initializing...';
  };

  const getStatusBadgeVariant = () => {
    if (error) return 'destructive';
    if (isComplete) return 'success';
    return 'default';
  };

  return (
    <Card 
      className={`${className} ${isComplete ? 'border-green-500/50' : ''}`}
      data-testid="processing-progress"
    >
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            {getStatusIcon()}
            <span>{getStatusText()}</span>
          </div>
          <Badge 
            variant={getStatusBadgeVariant() as any}
            data-testid={isComplete ? 'processing-complete' : 'processing-status'}
          >
            {status?.processing_status || 'Unknown'}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-medium">{Math.round(progress)}%</span>
          </div>
          <Progress 
            value={progress} 
            className="h-2"
            data-testid="processing-progress-bar"
          />
        </div>
        
        {status && (
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Zones Processed</span>
              <p className="font-medium">
                {status.completed_zones} / {status.total_zones}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">Status</span>
              <p className="font-medium capitalize">
                {status.processing_status}
              </p>
            </div>
          </div>
        )}
        
        {error && (
          <div 
            className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-3 rounded-md"
            data-testid="processing-error"
          >
            {error.message || 'An error occurred during processing'}
          </div>
        )}
      </CardContent>
    </Card>
  );
}