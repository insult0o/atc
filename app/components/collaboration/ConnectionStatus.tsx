'use client';

import React from 'react';
import { useWebSocketContext } from '@/providers/websocket-provider';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Wifi, WifiOff, RefreshCw, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export function ConnectionStatus() {
  const { connectionStatus, connectionError, reconnect } = useWebSocketContext();

  if (connectionStatus === 'connected') {
    return null; // Don't show anything when connected
  }

  return (
    <div
      className="fixed bottom-4 right-4 z-50"
      data-testid="connection-status-banner"
    >
      <Alert
        variant={connectionStatus === 'error' ? 'destructive' : 'default'}
        className={cn(
          "flex items-center gap-3 pr-3",
          connectionStatus === 'connecting' && "border-yellow-500 bg-yellow-50",
          connectionStatus === 'disconnected' && "border-orange-500 bg-orange-50"
        )}
      >
        {connectionStatus === 'connecting' && (
          <>
            <RefreshCw className="h-4 w-4 animate-spin" />
            <AlertDescription>Connecting to collaboration server...</AlertDescription>
          </>
        )}
        
        {connectionStatus === 'disconnected' && (
          <>
            <WifiOff className="h-4 w-4" />
            <AlertDescription className="flex-1">
              Disconnected from server
            </AlertDescription>
            <Button
              size="sm"
              variant="outline"
              onClick={reconnect}
              data-testid="reconnect-button"
            >
              Reconnect
            </Button>
          </>
        )}
        
        {connectionStatus === 'error' && (
          <>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="flex-1">
              {connectionError || 'Connection error occurred'}
            </AlertDescription>
            <Button
              size="sm"
              variant="outline"
              onClick={reconnect}
              data-testid="retry-button"
            >
              Retry
            </Button>
          </>
        )}
      </Alert>
    </div>
  );
}

// Minimal connection indicator for embedding in other components
export function ConnectionIndicator({ className }: { className?: string }) {
  const { connectionStatus } = useWebSocketContext();

  return (
    <div
      className={cn("flex items-center gap-2", className)}
      data-testid="connection-indicator-mini"
    >
      <div
        className={cn(
          "w-2 h-2 rounded-full transition-colors",
          connectionStatus === 'connected' && "bg-green-500",
          connectionStatus === 'connecting' && "bg-yellow-500 animate-pulse",
          connectionStatus === 'disconnected' && "bg-orange-500",
          connectionStatus === 'error' && "bg-red-500"
        )}
      />
      <span className="text-xs text-muted-foreground capitalize">
        {connectionStatus}
      </span>
    </div>
  );
}