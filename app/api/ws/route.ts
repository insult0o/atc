import { WebSocketServer, WebSocket } from 'ws';
import { NextRequest } from 'next/server';

// Connection manager for WebSocket clients
class ConnectionManager {
  private connections: Map<string, WebSocket>;

  constructor() {
    this.connections = new Map();
  }

  addConnection(id: string, ws: WebSocket) {
    this.connections.set(id, ws);
  }

  removeConnection(id: string) {
    this.connections.delete(id);
  }

  getConnection(id: string): WebSocket | undefined {
    return this.connections.get(id);
  }

  broadcast(message: any) {
    this.connections.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message));
      }
    });
  }

  sendTo(id: string, message: any) {
    const ws = this.getConnection(id);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  cleanup() {
    this.connections.forEach((ws, id) => {
      if (ws.readyState === WebSocket.CLOSED) {
        this.removeConnection(id);
      }
    });
  }
}

// Create connection manager instance
const manager = new ConnectionManager();

// WebSocket server instance
let wss: WebSocketServer | null = null;

// Initialize WebSocket server
function initializeWebSocketServer() {
  if (!wss) {
    wss = new WebSocketServer({ noServer: true });
    
    wss.on('connection', (ws: WebSocket) => {
      // Generate unique client ID
      const clientId = Math.random().toString(36).substring(7);

      // Add connection to manager
      manager.addConnection(clientId, ws);

      // Handle messages
      ws.on('message', async (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString());
          
          // Handle different message types
          switch (message.type) {
            case 'upload_progress':
              // Broadcast progress to all clients
              manager.broadcast({
                type: 'progress_update',
                data: message.data
              });
              break;

            case 'processing_status':
              // Send processing status to specific client
              manager.sendTo(clientId, {
                type: 'status_update',
                data: message.data
              });
              break;

            default:
              console.warn(`Unknown message type: ${message.type}`);
          }
        } catch (error: unknown) {
          console.error('Message handling error:', error);
          ws.send(JSON.stringify({
            type: 'error',
            message: 'Invalid message format'
          }));
        }
      });

      // Handle connection close
      ws.on('close', () => {
        manager.removeConnection(clientId);
        manager.cleanup();
      });

      // Handle errors
      ws.on('error', (error: Error) => {
        console.error('WebSocket error:', error);
        manager.removeConnection(clientId);
        manager.cleanup();
      });
    });
  }
  
  return wss;
}

// WebSocket upgrade handler
export async function GET(request: NextRequest) {
  try {
    // For Next.js API routes, WebSocket upgrades need to be handled differently
    // This is a simplified implementation that returns connection info
    // In production, you'd typically use a separate WebSocket server or service
    
    const wss = initializeWebSocketServer();
    
    return new Response(JSON.stringify({
      message: 'WebSocket endpoint available',
      status: 'ready',
      endpoint: '/api/ws'
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
  } catch (error: unknown) {
    console.error('WebSocket setup error:', error);
    return new Response('WebSocket setup failed', { status: 500 });
  }
}

// Export the WebSocket server for external use
export { wss, manager }; 