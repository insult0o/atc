import { WebSocket } from 'ws';
import { NextResponse } from 'next/server';

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

// WebSocket upgrade handler
export async function GET(request: Request) {
  try {
    const { socket: ws, response } = await WebSocket.accept({
      request,
      path: '/api/ws',
    });

    // Generate unique client ID
    const clientId = Math.random().toString(36).substring(7);

    // Add connection to manager
    manager.addConnection(clientId, ws);

    // Handle messages
    ws.on('message', async (data: string) => {
      try {
        const message = JSON.parse(data);
        
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
      } catch (error) {
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
    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      manager.removeConnection(clientId);
      manager.cleanup();
    });

    return response;
  } catch (error) {
    console.error('WebSocket setup error:', error);
    return new NextResponse('WebSocket upgrade failed', { status: 500 });
  }
} 