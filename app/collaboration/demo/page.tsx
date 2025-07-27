'use client';

import React, { useState, useRef } from 'react';
import { WebSocketProvider } from '@/providers/websocket-provider';
import { UserPresence } from '@/components/collaboration/UserPresence';
import { CursorTracker } from '@/components/collaboration/CursorTracker';
import { CollaborativeZoneEditor } from '@/components/collaboration/CollaborativeZoneEditor';
import { ConnectionStatus } from '@/components/collaboration/ConnectionStatus';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useOptimisticUpdates } from '@/hooks/useOptimisticUpdates';

// Mock data
const mockZones = [
  {
    id: 'zone-1',
    zone_index: 1,
    zone_type: 'text',
    content: 'This is a sample text zone that can be edited collaboratively.',
    confidence_score: 0.95,
    page_number: 1,
    coordinates: { x: 0, y: 0, width: 100, height: 50 }
  },
  {
    id: 'zone-2',
    zone_index: 2,
    zone_type: 'table',
    content: 'This is a table zone with tabular data.',
    confidence_score: 0.88,
    page_number: 1,
    coordinates: { x: 0, y: 60, width: 100, height: 80 }
  }
];

function CollaborationDemo() {
  const [documentId] = useState('demo-doc-123');
  const containerRef = useRef<HTMLDivElement>(null);
  const { data: zones, applyOptimisticUpdate } = useOptimisticUpdates(mockZones, documentId);

  const handleZoneUpdate = (zoneId: string, updates: any) => {
    const zone = zones.find(z => z.id === zoneId);
    if (zone) {
      applyOptimisticUpdate({ ...zone, ...updates }, 'update');
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Connection status banner */}
      <ConnectionStatus />

      {/* Header with user presence */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-2">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">Collaborative Editing Demo</h1>
            <UserPresence />
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="container mx-auto p-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Document viewer with cursor tracking */}
          <Card>
            <CardHeader>
              <CardTitle>Document Viewer</CardTitle>
              <CardDescription>
                Move your cursor to see real-time cursor tracking
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div
                ref={containerRef}
                className="relative w-full h-[600px] border rounded-lg bg-white overflow-auto"
                data-testid="document-viewer"
              >
                <CursorTracker
                  documentId={documentId}
                  containerRef={containerRef}
                  currentPage={1}
                />
                
                {/* Render zones */}
                <div className="p-4 space-y-4">
                  {zones.map((zone) => (
                    <div
                      key={zone.id}
                      className="p-4 border rounded hover:bg-gray-50 transition-colors"
                      data-testid={`zone-${zone.id}`}
                    >
                      <div className="text-sm text-gray-500 mb-1">
                        Zone {zone.zone_index} - {zone.zone_type}
                      </div>
                      <div className="text-base">{zone.content}</div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Zone editors */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Zone Editors</CardTitle>
                <CardDescription>
                  Lock zones for exclusive editing with real-time updates
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {zones.map((zone) => (
                  <CollaborativeZoneEditor
                    key={zone.id}
                    zone={zone}
                    documentId={documentId}
                    onUpdate={(updates) => handleZoneUpdate(zone.id, updates)}
                  />
                ))}
              </CardContent>
            </Card>

            {/* Instructions */}
            <Card>
              <CardHeader>
                <CardTitle>How to Test</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p>1. Open this page in multiple browser windows/tabs</p>
                <p>2. Use different user IDs in the URL (?userId=user1, ?userId=user2)</p>
                <p>3. Watch real-time cursor movements in the document viewer</p>
                <p>4. Lock a zone in one window and see it locked in others</p>
                <p>5. Edit zones and see updates propagate instantly</p>
                <p>6. Try editing the same zone simultaneously to see conflict resolution</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

// Wrapper component to provide WebSocket context
export default function CollaborationDemoPage() {
  // Get user ID from URL params or generate one
  const userId = typeof window !== 'undefined' 
    ? new URLSearchParams(window.location.search).get('userId') || `user-${Math.random().toString(36).substr(2, 9)}`
    : 'demo-user';

  const userName = typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('userName') || `User ${userId.slice(-4)}`
    : 'Demo User';

  return (
    <WebSocketProvider
      userId={userId}
      userName={userName}
    >
      <CollaborationDemo />
    </WebSocketProvider>
  );
}