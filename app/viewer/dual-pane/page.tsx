'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { DualPaneViewer } from '../../components/viewer/DualPaneViewer';
import { useDocument } from '../../hooks/useDocument';
import { useZones } from '../../hooks/useZones';
import { useWebSocket } from '../../hooks/useWebSocket';
import type { Zone } from '@pdf-platform/shared';
import type { ExtractedContent } from '../../components/viewer/DualPaneViewer';

// Component that uses useSearchParams
function DualPaneViewerContent() {
  const searchParams = useSearchParams();
  const documentIdFromUrl = searchParams.get('document');
  const [documentId] = useState(documentIdFromUrl || 'example-doc-123');
  const [extractedContent, setExtractedContent] = useState<ExtractedContent[]>([]);
  
  // Mock data for demonstration
  const mockZones: Zone[] = [
    {
      id: 'zone-1',
      page: 1,
      coordinates: { x: 50, y: 100, width: 500, height: 200 },
      type: 'text',
      confidence: 0.95,
      status: 'completed',
      characteristics: {
        textDensity: 0.8,
        lineSpacing: 1.5,
        wordSpacing: 1.0,
        fontSizes: [12, 14],
        hasStructure: true,
        hasImages: false,
        complexity: 'medium',
        readingOrder: 1
      },
      userModified: false,
      lastModified: new Date()
    },
    {
      id: 'zone-2',
      page: 1,
      coordinates: { x: 50, y: 350, width: 500, height: 300 },
      type: 'table',
      confidence: 0.75,
      status: 'completed',
      characteristics: {
        textDensity: 0.6,
        lineSpacing: 1.2,
        wordSpacing: 1.5,
        fontSizes: [10, 12],
        hasStructure: true,
        hasImages: false,
        complexity: 'high',
        readingOrder: 2
      },
      userModified: false,
      lastModified: new Date()
    },
    {
      id: 'zone-3',
      page: 2,
      coordinates: { x: 100, y: 50, width: 400, height: 150 },
      type: 'header',
      confidence: 0.65,
      status: 'completed',
      characteristics: {
        textDensity: 0.4,
        lineSpacing: 1.0,
        wordSpacing: 1.2,
        fontSizes: [16, 18],
        hasStructure: false,
        hasImages: false,
        complexity: 'low',
        readingOrder: 3
      },
      userModified: false,
      lastModified: new Date()
    }
  ];

  // Mock extracted content
  useEffect(() => {
    const mockContent: ExtractedContent[] = [
      {
        zoneId: 'zone-1',
        content: `Introduction to PDF Intelligence Platform

This document demonstrates the advanced dual-pane viewer functionality that enables side-by-side viewing of original PDF content and extracted text. The synchronized scrolling ensures seamless navigation between the source document and processed content.

Key Features:
• Real-time zone highlighting
• Synchronized scrolling between panes
• Interactive zone selection
• Confidence-based visual indicators`,
        formatting: {
          fontSize: 14,
          fontFamily: 'Inter, sans-serif',
          alignment: 'left',
          lineHeight: 1.6
        },
        confidence: 0.95
      },
      {
        zoneId: 'zone-2',
        content: JSON.stringify([
          { Feature: 'Zone Detection', Accuracy: '95%', Speed: 'Fast' },
          { Feature: 'Text Extraction', Accuracy: '92%', Speed: 'Medium' },
          { Feature: 'Table Recognition', Accuracy: '88%', Speed: 'Slow' },
          { Feature: 'Layout Analysis', Accuracy: '90%', Speed: 'Fast' }
        ]),
        formatting: {
          fontSize: 12,
          fontFamily: 'monospace'
        },
        confidence: 0.75
      },
      {
        zoneId: 'zone-3',
        content: 'Chapter 2: Advanced Features',
        formatting: {
          fontSize: 18,
          fontFamily: 'Inter, sans-serif',
          bold: true,
          alignment: 'center'
        },
        confidence: 0.65
      }
    ];
    
    setExtractedContent(mockContent);
  }, []);

  const handleZoneSelect = (zoneId: string) => {
    console.log('Zone selected:', zoneId);
  };

  const handleContentEdit = (zoneId: string, content: string) => {
    console.log('Content edited:', { zoneId, content });
    
    // Update extracted content
    setExtractedContent(prev => 
      prev.map(item => 
        item.zoneId === zoneId 
          ? { ...item, content }
          : item
      )
    );
  };

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 dark:from-slate-950 dark:via-blue-950/30 dark:to-indigo-950/20">
      <header className="backdrop-blur-xl bg-white/10 dark:bg-black/10 border-b border-white/20 dark:border-white/10 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 dark:from-blue-400 dark:via-purple-400 dark:to-indigo-400 bg-clip-text text-transparent">
              🔍 Dual-Pane PDF Viewer
            </h1>
            <p className="text-slate-600 dark:text-slate-400 mt-1">
              {documentIdFromUrl ? `Document: ${documentId}` : 'Demo Mode - Story 2.1: Sophisticated dual-pane interface with synchronized scrolling'}
            </p>
          </div>
          {documentIdFromUrl && (
            <div className="backdrop-blur-sm bg-green-500/20 border border-green-500/30 text-green-700 dark:text-green-300 px-3 py-1 rounded-lg text-sm font-medium">
              ✅ Live Document
            </div>
          )}
        </div>
      </header>
      
      <main className="flex-1 overflow-hidden">
        <DualPaneViewer
          documentId={documentId}
          zones={mockZones}
          extractedContent={extractedContent}
          onZoneSelect={handleZoneSelect}
          onContentEdit={handleContentEdit}
        />
      </main>
    </div>
  );
}

// Main page component with Suspense boundary
export default function DualPaneViewerPage() {
  return (
    <Suspense fallback={
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading viewer...</p>
        </div>
      </div>
    }>
      <DualPaneViewerContent />
    </Suspense>
  );
}