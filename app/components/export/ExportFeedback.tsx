/**
 * Export Feedback Component
 * Displays success/failure notifications with detailed error reporting
 */

import React, { useState, useEffect } from 'react';
import { X, CheckCircle, AlertCircle, Info, RefreshCw, Download, Eye } from 'lucide-react';

export interface ExportFeedback {
  id: string;
  type: 'success' | 'warning' | 'error' | 'info';
  scope: 'item' | 'batch' | 'export';
  itemId?: string;
  message: string;
  details?: string;
  actions?: FeedbackAction[];
  timestamp: Date;
  persistent?: boolean;
}

export interface FeedbackAction {
  label: string;
  action: 'retry' | 'skip' | 'view_details' | 'download_partial' | 'dismiss';
  enabled: boolean;
  handler: () => void;
}

interface ExportFeedbackProps {
  feedbacks: ExportFeedback[];
  onActionClick: (feedbackId: string, action: string) => void;
  onDismiss: (feedbackId: string) => void;
  maxVisible?: number;
  autoHideDelay?: number;
  position?: 'top-right' | 'bottom-right' | 'top-center' | 'bottom-center';
}

export const ExportFeedbackComponent: React.FC<ExportFeedbackProps> = ({
  feedbacks,
  onActionClick,
  onDismiss,
  maxVisible = 5,
  autoHideDelay = 5000,
  position = 'bottom-right'
}) => {
  const [visibleFeedbacks, setVisibleFeedbacks] = useState<ExportFeedback[]>([]);
  const [expandedDetails, setExpandedDetails] = useState<Set<string>>(new Set());

  useEffect(() => {
    // Update visible feedbacks
    const sorted = [...feedbacks].sort((a, b) => 
      b.timestamp.getTime() - a.timestamp.getTime()
    );
    setVisibleFeedbacks(sorted.slice(0, maxVisible));

    // Auto-hide non-persistent feedbacks
    const timers: NodeJS.Timeout[] = [];
    
    sorted.forEach(feedback => {
      if (!feedback.persistent && feedback.type !== 'error') {
        const timer = setTimeout(() => {
          onDismiss(feedback.id);
        }, autoHideDelay);
        timers.push(timer);
      }
    });

    return () => {
      timers.forEach(timer => clearTimeout(timer));
    };
  }, [feedbacks, maxVisible, autoHideDelay, onDismiss]);

  const getIcon = (type: ExportFeedback['type']) => {
    switch (type) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'warning':
        return <AlertCircle className="w-5 h-5 text-yellow-500" />;
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      case 'info':
        return <Info className="w-5 h-5 text-blue-500" />;
    }
  };

  const getBackgroundColor = (type: ExportFeedback['type']) => {
    switch (type) {
      case 'success':
        return 'bg-green-50 border-green-200';
      case 'warning':
        return 'bg-yellow-50 border-yellow-200';
      case 'error':
        return 'bg-red-50 border-red-200';
      case 'info':
        return 'bg-blue-50 border-blue-200';
    }
  };

  const getActionIcon = (action: FeedbackAction['action']) => {
    switch (action) {
      case 'retry':
        return <RefreshCw className="w-4 h-4" />;
      case 'download_partial':
        return <Download className="w-4 h-4" />;
      case 'view_details':
        return <Eye className="w-4 h-4" />;
      default:
        return null;
    }
  };

  const toggleDetails = (feedbackId: string) => {
    setExpandedDetails(prev => {
      const next = new Set(prev);
      if (next.has(feedbackId)) {
        next.delete(feedbackId);
      } else {
        next.add(feedbackId);
      }
      return next;
    });
  };

  const getPositionClasses = () => {
    switch (position) {
      case 'top-right':
        return 'top-4 right-4';
      case 'bottom-right':
        return 'bottom-4 right-4';
      case 'top-center':
        return 'top-4 left-1/2 -translate-x-1/2';
      case 'bottom-center':
        return 'bottom-4 left-1/2 -translate-x-1/2';
    }
  };

  if (visibleFeedbacks.length === 0) {
    return null;
  }

  return (
    <div className={`fixed ${getPositionClasses()} z-50 space-y-2 max-w-md`}>
      {visibleFeedbacks.map((feedback) => (
        <div
          key={feedback.id}
          className={`
            ${getBackgroundColor(feedback.type)}
            border rounded-lg shadow-lg p-4 
            animate-slideIn transform transition-all duration-300
          `}
        >
          <div className="flex items-start gap-3">
            {getIcon(feedback.type)}
            
            <div className="flex-1">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <p className="font-medium text-gray-900">
                    {feedback.message}
                  </p>
                  
                  {feedback.scope !== 'export' && feedback.itemId && (
                    <p className="text-sm text-gray-600 mt-1">
                      Item: {feedback.itemId}
                    </p>
                  )}
                  
                  {feedback.details && (
                    <>
                      <button
                        onClick={() => toggleDetails(feedback.id)}
                        className="text-sm text-blue-600 hover:text-blue-800 mt-1"
                      >
                        {expandedDetails.has(feedback.id) ? 'Hide' : 'Show'} details
                      </button>
                      
                      {expandedDetails.has(feedback.id) && (
                        <div className="mt-2 p-2 bg-gray-100 rounded text-sm text-gray-700">
                          <pre className="whitespace-pre-wrap">{feedback.details}</pre>
                        </div>
                      )}
                    </>
                  )}
                </div>
                
                <button
                  onClick={() => onDismiss(feedback.id)}
                  className="ml-2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              
              {feedback.actions && feedback.actions.length > 0 && (
                <div className="flex gap-2 mt-3">
                  {feedback.actions.map((action, index) => (
                    <button
                      key={index}
                      onClick={() => {
                        action.handler();
                        onActionClick(feedback.id, action.action);
                      }}
                      disabled={!action.enabled}
                      className={`
                        flex items-center gap-1 px-3 py-1 text-sm rounded
                        ${action.enabled
                          ? 'bg-white border border-gray-300 hover:bg-gray-50'
                          : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        }
                      `}
                    >
                      {getActionIcon(action.action)}
                      {action.label}
                    </button>
                  ))}
                </div>
              )}
              
              <p className="text-xs text-gray-500 mt-2">
                {new Date(feedback.timestamp).toLocaleTimeString()}
              </p>
            </div>
          </div>
        </div>
      ))}
      
      {feedbacks.length > maxVisible && (
        <div className="text-center text-sm text-gray-600 mt-2">
          +{feedbacks.length - maxVisible} more notifications
        </div>
      )}
    </div>
  );
};

// Summary component for export completion
interface ExportSummaryProps {
  totalItems: number;
  successCount: number;
  failureCount: number;
  warningCount: number;
  duration: number;
  onViewDetails: () => void;
  onDownloadReport: () => void;
  onRetryFailed?: () => void;
}

export const ExportSummary: React.FC<ExportSummaryProps> = ({
  totalItems,
  successCount,
  failureCount,
  warningCount,
  duration,
  onViewDetails,
  onDownloadReport,
  onRetryFailed
}) => {
  const successRate = totalItems > 0 ? (successCount / totalItems) * 100 : 0;
  const hasFailures = failureCount > 0;
  const hasWarnings = warningCount > 0;

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <h3 className="text-lg font-semibold mb-4">Export Summary</h3>
      
      <div className="space-y-3">
        <div className="flex justify-between">
          <span className="text-gray-600">Total Items:</span>
          <span className="font-medium">{totalItems}</span>
        </div>
        
        <div className="flex justify-between">
          <span className="text-gray-600">Successful:</span>
          <span className="font-medium text-green-600">{successCount}</span>
        </div>
        
        {hasFailures && (
          <div className="flex justify-between">
            <span className="text-gray-600">Failed:</span>
            <span className="font-medium text-red-600">{failureCount}</span>
          </div>
        )}
        
        {hasWarnings && (
          <div className="flex justify-between">
            <span className="text-gray-600">Warnings:</span>
            <span className="font-medium text-yellow-600">{warningCount}</span>
          </div>
        )}
        
        <div className="flex justify-between">
          <span className="text-gray-600">Success Rate:</span>
          <span className="font-medium">{successRate.toFixed(1)}%</span>
        </div>
        
        <div className="flex justify-between">
          <span className="text-gray-600">Duration:</span>
          <span className="font-medium">{formatDuration(duration)}</span>
        </div>
      </div>
      
      <div className="mt-6 space-y-2">
        <button
          onClick={onViewDetails}
          className="w-full px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          View Detailed Report
        </button>
        
        <button
          onClick={onDownloadReport}
          className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
        >
          Download Report
        </button>
        
        {hasFailures && onRetryFailed && (
          <button
            onClick={onRetryFailed}
            className="w-full px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600"
          >
            Retry Failed Items
          </button>
        )}
      </div>
    </div>
  );
};

// Utility function to format duration
function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}