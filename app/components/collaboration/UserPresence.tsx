'use client';

import React from 'react';
import { useWebSocketContext } from '@/providers/websocket-provider';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export function UserPresence() {
  const { activeUsers, currentUser, connectionStatus } = useWebSocketContext();

  const getUserInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div
      className="flex items-center gap-2 p-2"
      data-testid="user-presence-container"
    >
      {/* Connection status indicator */}
      <div
        className="flex items-center gap-2"
        data-testid="connection-status"
      >
        <div
          className={cn(
            "w-2 h-2 rounded-full",
            connectionStatus === 'connected' && "bg-green-500",
            connectionStatus === 'connecting' && "bg-yellow-500 animate-pulse",
            connectionStatus === 'disconnected' && "bg-red-500",
            connectionStatus === 'error' && "bg-red-500"
          )}
          data-testid="connection-indicator"
        />
        <span className="text-xs text-muted-foreground">
          {connectionStatus === 'connected' && 'Connected'}
          {connectionStatus === 'connecting' && 'Connecting...'}
          {connectionStatus === 'disconnected' && 'Disconnected'}
          {connectionStatus === 'error' && 'Connection Error'}
        </span>
      </div>

      {/* Separator */}
      <div className="w-px h-6 bg-border" />

      {/* Current user */}
      {currentUser && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div
                className="flex items-center gap-2"
                data-testid="current-user"
              >
                <Avatar
                  className="w-8 h-8 ring-2"
                  style={{ '--tw-ring-color': currentUser.user_color } as any}
                >
                  <AvatarImage src={currentUser.user_avatar} />
                  <AvatarFallback
                    style={{ backgroundColor: currentUser.user_color }}
                  >
                    {getUserInitials(currentUser.user_name)}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm font-medium">You</span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>{currentUser.user_name}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}

      {/* Active users */}
      {activeUsers.size > 0 && (
        <>
          <div className="w-px h-6 bg-border" />
          <div
            className="flex items-center -space-x-2"
            data-testid="active-users"
          >
            {Array.from(activeUsers.values()).slice(0, 5).map((user) => (
              <TooltipProvider key={user.user_id}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Avatar
                      className="w-8 h-8 ring-2 ring-background cursor-pointer"
                      style={{ '--tw-ring-offset-color': user.user_color } as any}
                      data-testid={`user-avatar-${user.user_id}`}
                    >
                      <AvatarImage src={user.user_avatar} />
                      <AvatarFallback
                        style={{ backgroundColor: user.user_color }}
                      >
                        {getUserInitials(user.user_name)}
                      </AvatarFallback>
                    </Avatar>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{user.user_name}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ))}
            
            {activeUsers.size > 5 && (
              <div
                className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium"
                data-testid="more-users"
              >
                +{activeUsers.size - 5}
              </div>
            )}
          </div>
          
          <span
            className="text-sm text-muted-foreground ml-2"
            data-testid="user-count"
          >
            {activeUsers.size} {activeUsers.size === 1 ? 'collaborator' : 'collaborators'}
          </span>
        </>
      )}
    </div>
  );
}