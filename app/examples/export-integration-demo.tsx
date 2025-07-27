'use client';

import React, { useState } from 'react';
import { ExportDialog } from '@/components/export/ExportDialog';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import type { Zone } from '@/lib/types/zone';

// Mock data for demonstration
const mockZones: Zone[] = [
  {
    id: '1',
    documentId: 'doc123',
    pageNumber: 1,
    type: 'text',
    content: 'This is a sample text zone from the first page.',
    confidence: 0.95,
    bbox: { x1: 100, y1: 100, x2: 400, y2: 150 },
    metadata: {},
    status: 'extracted'
  },
  {
    id: '2',
    documentId: 'doc123',
    pageNumber: 1,
    type: 'table',
    content: 'Table data here',
    confidence: 0.88,
    bbox: { x1: 100, y1: 200, x2: 500, y2: 400 },
    metadata: { rows: 5, columns: 3 },
    status: 'extracted'
  },
  {
    id: '3',
    documentId: 'doc123',
    pageNumber: 2,
    type: 'text',
    content: 'Second page content with more details.',
    confidence: 0.92,
    bbox: { x1: 100, y1: 100, x2: 400, y2: 200 },
    metadata: {},
    status: 'extracted'
  }
];

export default function ExportIntegrationDemo() {
  const [exportDialogOpen, setExportDialogOpen] = useState(false);

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6">Export System Integration Demo</h1>
      
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Document Information</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-600">Document ID:</span>
            <p className="font-medium">doc123</p>
          </div>
          <div>
            <span className="text-gray-600">Total Zones:</span>
            <p className="font-medium">{mockZones.length}</p>
          </div>
          <div>
            <span className="text-gray-600">Pages:</span>
            <p className="font-medium">2</p>
          </div>
          <div>
            <span className="text-gray-600">Status:</span>
            <p className="font-medium text-green-600">Processed</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Export Options</h2>
        <p className="text-gray-600 mb-4">
          Click the button below to open the export dialog and configure your export settings.
        </p>
        
        <Button 
          onClick={() => setExportDialogOpen(true)}
          className="flex items-center gap-2"
          data-testid="open-export-dialog"
        >
          <Download className="w-4 h-4" />
          Export Document
        </Button>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Features Demonstrated</h2>
        <ul className="space-y-2 text-sm">
          <li className="flex items-start gap-2">
            <span className="text-green-600">✓</span>
            <span>Zone selection with multiple modes (individual zones, pages, all)</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-green-600">✓</span>
            <span>Multiple export formats (JSON, JSONL, CSV, TXT, Markdown)</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-green-600">✓</span>
            <span>Real-time export preview for each format</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-green-600">✓</span>
            <span>Export validation with warnings and suggestions</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-green-600">✓</span>
            <span>Configurable export options (metadata, timestamps, etc.)</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-green-600">✓</span>
            <span>Progress tracking for export generation</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-green-600">✓</span>
            <span>Download functionality for completed exports</span>
          </li>
        </ul>
      </div>

      <ExportDialog
        open={exportDialogOpen}
        onOpenChange={setExportDialogOpen}
        documentId="doc123"
        zones={mockZones}
        pages={[1, 2]}
      />
    </div>
  );
}