'use client';

import { CheckCircle, Wifi } from 'lucide-react';

interface StatusIndicatorProps {
  isConnected?: boolean;
  status?: string;
}

export function StatusIndicator({ isConnected = true, status = 'Ready' }: StatusIndicatorProps) {
  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div className={`
        flex items-center space-x-2 px-4 py-2 rounded-full backdrop-blur-xl shadow-lg transition-all duration-300
        ${isConnected 
          ? 'bg-green-500/20 border border-green-500/30 text-green-700 dark:text-green-300' 
          : 'bg-red-500/20 border border-red-500/30 text-red-700 dark:text-red-300'
        }
      `}>
        {isConnected ? (
          <CheckCircle className="w-4 h-4" />
        ) : (
          <Wifi className="w-4 h-4" />
        )}
        <span className="text-sm font-medium">
          {isConnected ? status : 'Connecting...'}
        </span>
      </div>
    </div>
  );
} 