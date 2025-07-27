'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { useWebSocket } from '@/hooks/useWebSocket';
import { toast } from 'sonner';

// WebSocket event types matching backend
export enum WebSocketEventType {
  // Connection events
  CONNECTION_ESTABLISHED = 'connection_established',
  CONNECTION_LOST = 'connection_lost',
  RECONNECTED = 'reconnected',
  PING = 'ping',
  PONG = 'pong',
  
  // User events
  USER_JOINED = 'user.joined',
  USER_LEFT = 'user.left',
  USER_PRESENCE_UPDATE = 'user.presence.update',
  USER_CURSOR_MOVED = 'user.cursor.moved',
  USER_SELECTION_CHANGED = 'user.selection.changed',
  
  // Zone events
  ZONE_CREATED = 'zone.created',
  ZONE_UPDATED = 'zone.updated',
  ZONE_DELETED = 'zone.deleted',
  ZONE_LOCKED = 'zone.locked',
  ZONE_UNLOCKED = 'zone.unlocked',
  
  // Processing events
  PROCESSING_PROGRESS = 'processing_progress',
  DOCUMENT_PROCESSING_PROGRESS = 'document.processing.progress',
  
  // Export events
  EXPORT_PROGRESS = 'export.progress',
  
  // Collaboration events
  COLLABORATION_CONFLICT = 'collaboration.conflict',
  
  // System events
  SYSTEM_NOTIFICATION = 'system_notification',
  ERROR_OCCURRED = 'error_occurred'
}

interface User {
  user_id: string;
  user_name: string;
  user_color?: string;
  user_avatar?: string;
  client_id?: string;
  cursor_position?: { x: number; y: number; page?: number };
  selection?: { start: number; end: number; page?: number };
}

interface WebSocketContextType {
  isConnected: boolean;
  connectionError: string | null;
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'error';
  
  // User management
  activeUsers: Map<string, User>;
  currentUser: User | null;
  
  // Room management
  joinRoom: (roomId: string) => void;
  leaveRoom: (roomId: string) => void;
  currentRooms: Set<string>;
  
  // Collaborative features
  sendCursorPosition: (documentId: string, position: { x: number; y: number; page?: number }) => void;
  sendSelectionChange: (documentId: string, selection: { start: number; end: number; page?: number }) => void;
  sendZoneUpdate: (documentId: string, zoneId: string, action: string, data: any, version?: number) => void;
  
  // Event subscriptions
  subscribe: (eventType: WebSocketEventType, callback: (data: any) => void) => () => void;
  
  // Connection management
  reconnect: () => void;
  
  // Message sending
  sendMessage: (type: string, data: any) => void;
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);

export function useWebSocketContext() {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocketContext must be used within WebSocketProvider');
  }
  return context;
}

interface WebSocketProviderProps {
  children: React.ReactNode;
  userId: string;
  userName?: string;
  userAvatar?: string;
}

export function WebSocketProvider({ children, userId, userName, userAvatar }: WebSocketProviderProps) {
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('connecting');
  const [activeUsers, setActiveUsers] = useState<Map<string, User>>(new Map());
  const [currentRooms, setCurrentRooms] = useState<Set<string>>(new Set());
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  
  const eventListeners = useRef<Map<WebSocketEventType, Set<(data: any) => void>>>(new Map());
  const clientId = useRef<string | null>(null);

  // Construct WebSocket URL
  const wsUrl = process.env.NEXT_PUBLIC_WS_URL || `ws://localhost:8000/ws/connect?user_id=${userId}`;

  const { isConnected, error, sendMessage, webSocket } = useWebSocket(wsUrl, {
    onMessage: handleMessage,
    onError: (error) => {
      console.error('WebSocket error:', error);
      setConnectionStatus('error');
      toast.error('Connection error. Trying to reconnect...');
    },
    reconnectAttempts: 10,
    reconnectInterval: 2000
  });

  // Update connection status
  useEffect(() => {
    if (isConnected) {
      setConnectionStatus('connected');
      toast.success('Connected to collaboration server');
    } else if (error) {
      setConnectionStatus('error');
    } else {
      setConnectionStatus('disconnected');
    }
  }, [isConnected, error]);

  // Handle incoming WebSocket messages
  function handleMessage(message: any) {
    const eventType = message.type as WebSocketEventType;
    const data = message.data || {};

    // Handle connection established
    if (eventType === WebSocketEventType.CONNECTION_ESTABLISHED) {
      clientId.current = data.client_id;
      const user: User = {
        user_id: userId,
        user_name: userName || `User ${userId.slice(0, 8)}`,
        user_avatar: userAvatar,
        user_color: data.user_color,
        client_id: data.client_id
      };
      setCurrentUser(user);
    }

    // Handle user presence updates
    if (eventType === WebSocketEventType.USER_JOINED) {
      const user: User = {
        user_id: data.user_id,
        user_name: data.user_name,
        user_color: data.user_color,
        user_avatar: data.user_avatar
      };
      setActiveUsers(prev => new Map(prev).set(data.user_id, user));
      toast.info(`${data.user_name} joined the document`);
    }

    if (eventType === WebSocketEventType.USER_LEFT) {
      setActiveUsers(prev => {
        const updated = new Map(prev);
        updated.delete(data.user_id);
        return updated;
      });
      toast.info(`${data.user_name} left the document`);
    }

    if (eventType === WebSocketEventType.USER_PRESENCE_UPDATE) {
      const members = data.members || [];
      const updatedUsers = new Map<string, User>();
      members.forEach((member: any) => {
        if (member.user_id !== userId) {
          updatedUsers.set(member.user_id, {
            user_id: member.user_id,
            user_name: member.user_name,
            user_color: member.user_color,
            user_avatar: member.user_avatar,
            client_id: member.client_id
          });
        }
      });
      setActiveUsers(updatedUsers);
    }

    // Handle cursor and selection updates
    if (eventType === WebSocketEventType.USER_CURSOR_MOVED) {
      setActiveUsers(prev => {
        const updated = new Map(prev);
        const user = updated.get(data.user_id);
        if (user) {
          user.cursor_position = data.cursor_position;
          updated.set(data.user_id, { ...user });
        }
        return updated;
      });
    }

    if (eventType === WebSocketEventType.USER_SELECTION_CHANGED) {
      setActiveUsers(prev => {
        const updated = new Map(prev);
        const user = updated.get(data.user_id);
        if (user) {
          user.selection = data.selection;
          updated.set(data.user_id, { ...user });
        }
        return updated;
      });
    }

    // Handle collaboration conflicts
    if (eventType === WebSocketEventType.COLLABORATION_CONFLICT) {
      toast.error('Edit conflict detected', {
        description: data.suggested_resolution || 'Please refresh to see the latest changes',
        action: {
          label: 'Refresh',
          onClick: () => window.location.reload()
        }
      });
    }

    // Notify event listeners
    const listeners = eventListeners.current.get(eventType);
    if (listeners) {
      listeners.forEach(callback => callback(data));
    }
  }

  // Subscribe to events
  const subscribe = useCallback((eventType: WebSocketEventType, callback: (data: any) => void) => {
    if (!eventListeners.current.has(eventType)) {
      eventListeners.current.set(eventType, new Set());
    }
    eventListeners.current.get(eventType)!.add(callback);

    // Return unsubscribe function
    return () => {
      const listeners = eventListeners.current.get(eventType);
      if (listeners) {
        listeners.delete(callback);
      }
    };
  }, []);

  // Room management
  const joinRoom = useCallback((roomId: string) => {
    sendMessage({
      type: 'subscribe',
      data: {
        type: 'document',
        document_id: roomId
      }
    });
    setCurrentRooms(prev => new Set(prev).add(roomId));
  }, [sendMessage]);

  const leaveRoom = useCallback((roomId: string) => {
    sendMessage({
      type: 'unsubscribe',
      data: {
        type: 'document',
        document_id: roomId
      }
    });
    setCurrentRooms(prev => {
      const updated = new Set(prev);
      updated.delete(roomId);
      return updated;
    });
  }, [sendMessage]);

  // Collaborative features
  const sendCursorPosition = useCallback((documentId: string, position: { x: number; y: number; page?: number }) => {
    sendMessage({
      type: 'cursor_move',
      data: {
        document_id: documentId,
        cursor_position: position
      }
    });
  }, [sendMessage]);

  const sendSelectionChange = useCallback((documentId: string, selection: { start: number; end: number; page?: number }) => {
    sendMessage({
      type: 'selection_change',
      data: {
        document_id: documentId,
        selection
      }
    });
  }, [sendMessage]);

  const sendZoneUpdate = useCallback((documentId: string, zoneId: string, action: string, zoneData: any, version?: number) => {
    sendMessage({
      type: 'zone_update',
      data: {
        document_id: documentId,
        zone_id: zoneId,
        action,
        zone_data: zoneData,
        version
      }
    });
  }, [sendMessage]);

  const reconnect = useCallback(() => {
    if (webSocket && webSocket.readyState === WebSocket.CLOSED) {
      window.location.reload();
    }
  }, [webSocket]);

  const value: WebSocketContextType = {
    isConnected,
    connectionError: error,
    connectionStatus,
    activeUsers,
    currentUser,
    joinRoom,
    leaveRoom,
    currentRooms,
    sendCursorPosition,
    sendSelectionChange,
    sendZoneUpdate,
    subscribe,
    reconnect,
    sendMessage
  };

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
}