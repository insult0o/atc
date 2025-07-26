'use client';

import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingOverlayProps {
  message?: string;
  progress?: number;
  className?: string;
}

export function LoadingOverlay({ 
  message = 'Loading...', 
  progress,
  className = '' 
}: LoadingOverlayProps) {
  return (
    <div className={`absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-50 ${className}`}>
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-sm w-full">
        <div className="flex flex-col items-center">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin mb-4" />
          
          <p className="text-gray-700 font-medium mb-2">{message}</p>
          
          {progress !== undefined && (
            <div className="w-full">
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>Progress</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                <div 
                  className="bg-blue-600 h-full transition-all duration-300 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}