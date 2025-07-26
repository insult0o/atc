import React, { useEffect, useState } from 'react';
import { Zone } from '../zones/ZoneManager';

export type ProcessingStatus = 'idle' | 'pending' | 'processing' | 'completed' | 'failed' | 'warning';

export interface StatusIndicatorProps {
  status: ProcessingStatus;
  progress?: number; // 0-100 for processing status
  message?: string;
  size?: 'small' | 'medium' | 'large';
  showLabel?: boolean;
  animated?: boolean;
  onRetry?: () => void;
}

export interface ZoneStatusBadgeProps {
  zone: Zone;
  showDetails?: boolean;
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  onClick?: () => void;
}

export interface ProcessingProgressProps {
  progress: number;
  status: ProcessingStatus;
  estimatedTime?: number; // seconds
  showPercentage?: boolean;
  compact?: boolean;
}

// Main status indicator component
export const StatusIndicator: React.FC<StatusIndicatorProps> = ({
  status,
  progress,
  message,
  size = 'medium',
  showLabel = true,
  animated = true,
  onRetry
}) => {
  const [animationFrame, setAnimationFrame] = useState(0);

  // Animation loop for processing status
  useEffect(() => {
    if (!animated || status !== 'processing') return;

    const interval = setInterval(() => {
      setAnimationFrame(prev => (prev + 1) % 8);
    }, 200);

    return () => clearInterval(interval);
  }, [animated, status]);

  const sizeClasses = {
    small: 'w-4 h-4',
    medium: 'w-6 h-6',
    large: 'w-8 h-8'
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'idle':
        return (
          <svg className="w-full h-full" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" className="text-gray-400" />
          </svg>
        );
      
      case 'pending':
        return (
          <svg className="w-full h-full" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" className="text-yellow-500" />
            <circle cx="12" cy="12" r="3" fill="currentColor" className="text-yellow-500" />
          </svg>
        );
      
      case 'processing':
        return (
          <svg className="w-full h-full animate-spin" viewBox="0 0 24 24" fill="none">
            <circle 
              cx="12" 
              cy="12" 
              r="10" 
              stroke="currentColor" 
              strokeWidth="2" 
              className="text-gray-200"
            />
            <path
              d="M12 2 A10 10 0 0 1 22 12"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              className="text-blue-500"
            />
            {progress !== undefined && (
              <circle
                cx="12"
                cy="12"
                r="8"
                stroke="currentColor"
                strokeWidth="2"
                fill="none"
                strokeDasharray={`${(progress / 100) * 50.24} 50.24`}
                className="text-blue-600 transform -rotate-90 origin-center"
              />
            )}
          </svg>
        );
      
      case 'completed':
        return (
          <svg className="w-full h-full" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" fill="currentColor" className="text-green-500" />
            <path
              d="M8 12.5L10.5 15L16 9"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        );
      
      case 'failed':
        return (
          <svg className="w-full h-full" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" fill="currentColor" className="text-red-500" />
            <path
              d="M15 9L9 15M9 9L15 15"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        );
      
      case 'warning':
        return (
          <svg className="w-full h-full" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 2L2 20h20L12 2z"
              fill="currentColor"
              className="text-orange-500"
            />
            <text x="12" y="16" textAnchor="middle" fill="white" fontSize="14" fontWeight="bold">!</text>
          </svg>
        );
      
      default:
        return null;
    }
  };

  const getStatusLabel = () => {
    switch (status) {
      case 'idle': return 'Ready';
      case 'pending': return 'Queued';
      case 'processing': return progress !== undefined ? `${progress}%` : 'Processing';
      case 'completed': return 'Complete';
      case 'failed': return 'Failed';
      case 'warning': return 'Warning';
      default: return '';
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'idle': return 'text-gray-500';
      case 'pending': return 'text-yellow-500';
      case 'processing': return 'text-blue-500';
      case 'completed': return 'text-green-500';
      case 'failed': return 'text-red-500';
      case 'warning': return 'text-orange-500';
      default: return 'text-gray-400';
    }
  };

  return (
    <div className="flex items-center gap-2">
      <div className={`${sizeClasses[size]} ${animated && status === 'processing' ? 'animate-pulse' : ''}`}>
        {getStatusIcon()}
      </div>
      
      {showLabel && (
        <div className="flex flex-col">
          <span className={`text-sm font-medium ${getStatusColor()}`}>
            {getStatusLabel()}
          </span>
          {message && (
            <span className="text-xs text-gray-500">{message}</span>
          )}
        </div>
      )}
      
      {status === 'failed' && onRetry && (
        <button
          onClick={onRetry}
          className="text-xs text-blue-600 hover:text-blue-800 underline ml-2"
        >
          Retry
        </button>
      )}
    </div>
  );
};

// Zone status badge component
export const ZoneStatusBadge: React.FC<ZoneStatusBadgeProps> = ({
  zone,
  showDetails = false,
  position = 'top-right',
  onClick
}) => {
  const getPositionClasses = () => {
    switch (position) {
      case 'top-left': return 'top-1 left-1';
      case 'top-right': return 'top-1 right-1';
      case 'bottom-left': return 'bottom-1 left-1';
      case 'bottom-right': return 'bottom-1 right-1';
      default: return 'top-1 right-1';
    }
  };

  const mapZoneStatus = (): ProcessingStatus => {
    switch (zone.status) {
      case 'detected': return 'idle';
      case 'confirmed': return 'pending';
      case 'processing': return 'processing';
      case 'completed': return 'completed';
      case 'failed': return 'failed';
      default: return 'idle';
    }
  };

  return (
    <div
      className={`absolute ${getPositionClasses()} bg-white rounded-full shadow-md p-1 cursor-pointer hover:scale-110 transition-transform`}
      onClick={onClick}
    >
      <StatusIndicator
        status={mapZoneStatus()}
        size="small"
        showLabel={false}
        animated={true}
      />
      
      {showDetails && (
        <div className="absolute top-full mt-1 right-0 bg-white rounded shadow-lg p-2 min-w-[120px] z-10">
          <div className="text-xs">
            <div className="font-medium mb-1">Zone {zone.id.slice(0, 8)}</div>
            <div className="text-gray-600">Status: {zone.status}</div>
            <div className="text-gray-600">Type: {zone.contentType}</div>
            <div className="text-gray-600">Confidence: {Math.round(zone.confidence * 100)}%</div>
          </div>
        </div>
      )}
    </div>
  );
};

// Processing progress component
export const ProcessingProgress: React.FC<ProcessingProgressProps> = ({
  progress,
  status,
  estimatedTime,
  showPercentage = true,
  compact = false
}) => {
  const [elapsedTime, setElapsedTime] = useState(0);

  useEffect(() => {
    if (status !== 'processing') return;

    const interval = setInterval(() => {
      setElapsedTime(prev => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [status]);

  const formatTime = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}m ${secs}s`;
  };

  if (compact) {
    return (
      <div className="relative w-full h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className="absolute top-0 left-0 h-full bg-blue-500 transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
        {status === 'processing' && (
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-30 animate-shimmer" />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center text-sm">
        <div className="flex items-center gap-2">
          <StatusIndicator status={status} size="small" showLabel={false} />
          <span className="font-medium">Processing</span>
        </div>
        <div className="text-gray-600">
          {showPercentage && <span>{progress}%</span>}
          {estimatedTime && (
            <span className="ml-2">
              ETA: {formatTime(Math.max(0, estimatedTime - elapsedTime))}
            </span>
          )}
        </div>
      </div>
      
      <div className="relative w-full h-3 bg-gray-200 rounded-full overflow-hidden">
        <div
          className="absolute top-0 left-0 h-full bg-gradient-to-r from-blue-400 to-blue-600 transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
        {status === 'processing' && (
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-20 animate-shimmer" />
        )}
      </div>
      
      {elapsedTime > 0 && (
        <div className="text-xs text-gray-500">
          Elapsed: {formatTime(elapsedTime)}
        </div>
      )}
    </div>
  );
};

// Status summary component for multiple zones
export interface StatusSummaryProps {
  zones: Zone[];
  showCounts?: boolean;
  compact?: boolean;
}

export const StatusSummary: React.FC<StatusSummaryProps> = ({
  zones,
  showCounts = true,
  compact = false
}) => {
  const statusCounts = zones.reduce((acc, zone) => {
    acc[zone.status] = (acc[zone.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const statusOrder: Zone['status'][] = ['completed', 'processing', 'confirmed', 'detected', 'failed'];

  if (compact) {
    return (
      <div className="flex items-center gap-1">
        {statusOrder.map(status => {
          const count = statusCounts[status] || 0;
          if (count === 0) return null;
          
          return (
            <div key={status} className="flex items-center" title={`${count} ${status}`}>
              <StatusIndicator
                status={status === 'detected' ? 'idle' : status === 'confirmed' ? 'pending' : status as ProcessingStatus}
                size="small"
                showLabel={false}
              />
              {showCounts && <span className="text-xs ml-0.5">{count}</span>}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2">
      {statusOrder.map(status => {
        const count = statusCounts[status] || 0;
        
        return (
          <div key={status} className="flex items-center justify-between p-2 bg-gray-50 rounded">
            <StatusIndicator
              status={status === 'detected' ? 'idle' : status === 'confirmed' ? 'pending' : status as ProcessingStatus}
              size="small"
              showLabel={true}
            />
            {showCounts && (
              <span className="text-sm font-medium">{count}</span>
            )}
          </div>
        );
      })}
    </div>
  );
};

// Add animation styles (include in your CSS)
export const statusIndicatorStyles = `
@keyframes shimmer {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}

.animate-shimmer {
  animation: shimmer 2s infinite;
}
`;

export default StatusIndicator;