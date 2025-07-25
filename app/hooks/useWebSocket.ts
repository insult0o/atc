import { useEffect, useRef, useCallback, useState } from 'react';

interface WebSocketMessage {
  type: string;
  data?: any;
  message?: string;
}

interface UseWebSocketOptions {
  onMessage?: (message: WebSocketMessage) => void;
  onError?: (error: Event) => void;
  reconnectAttempts?: number;
  reconnectInterval?: number;
}

export function useWebSocket(url: string, options: UseWebSocketOptions = {}) {
  const {
    onMessage,
    onError,
    reconnectAttempts = 5,
    reconnectInterval = 1000
  } = options;

  const ws = useRef<WebSocket | null>(null);
  const reconnectCount = useRef(0);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Create WebSocket connection
  const connect = useCallback(() => {
    try {
      ws.current = new WebSocket(url);

      ws.current.onopen = () => {
        console.log('WebSocket connected');
        setIsConnected(true);
        setError(null);
        reconnectCount.current = 0;
      };

      ws.current.onclose = () => {
        console.log('WebSocket closed');
        setIsConnected(false);
        
        // Attempt reconnection
        if (reconnectCount.current < reconnectAttempts) {
          setTimeout(() => {
            reconnectCount.current++;
            connect();
          }, reconnectInterval);
        } else {
          setError('WebSocket connection failed after multiple attempts');
        }
      };

      ws.current.onerror = (event) => {
        console.error('WebSocket error:', event);
        setError('WebSocket error occurred');
        onError?.(event);
      };

      ws.current.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          onMessage?.(message);
        } catch (error) {
          console.error('Message parsing error:', error);
          setError('Invalid message format');
        }
      };
    } catch (error) {
      console.error('WebSocket connection error:', error);
      setError('Failed to establish WebSocket connection');
    }
  }, [url, onMessage, onError, reconnectAttempts, reconnectInterval]);

  // Send message
  const sendMessage = useCallback((message: WebSocketMessage) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(message));
    } else {
      setError('WebSocket is not connected');
    }
  }, []);

  // Connect on mount, cleanup on unmount
  useEffect(() => {
    connect();

    return () => {
      if (ws.current) {
        ws.current.close();
      }
    };
  }, [connect]);

  // Reconnect on URL change
  useEffect(() => {
    if (ws.current) {
      ws.current.close();
      connect();
    }
  }, [url, connect]);

  return {
    isConnected,
    error,
    sendMessage,
    // Expose raw WebSocket for advanced use cases
    webSocket: ws.current
  };
} 