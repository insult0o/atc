'use client';

import React, { useState } from 'react';
import { SelectionPanel } from '../components/export/SelectionPanel';
import { ValidationPanel } from '../components/export/ValidationPanel';
import { ExportFeedback } from '../components/export/ExportFeedbackDemo';
import { ExportManager } from '../../lib/export';
import type { Zone } from '@pdf-platform/shared';

// Mock data
const mockZones: Zone[] = [
  {
    id: 'zone-1',
    page: 1,
    coordinates: { x: 50, y: 100, width: 500, height: 200 },
    type: 'text',
    confidence: 0.95,
    status: 'completed',
    content: 'This is the main body text of the document. It contains important information that needs to be exported.',
    characteristics: {
      textDensity: 0.8,
      lineSpacing: 1.5,
      wordSpacing: 1.0,
      fontSizes: [12, 14],
      hasStructure: true,
      hasImages: false,
      complexity: 'medium',
      readingOrder: 1
    }
  },
  {
    id: 'zone-2',
    page: 1,
    coordinates: { x: 50, y: 350, width: 500, height: 300 },
    type: 'table',
    confidence: 0.75,
    status: 'completed',
    content: '| Feature | Status | Score |\n|---------|--------|-------|\n| Export | Ready | 95% |',
    characteristics: {
      textDensity: 0.6,
      lineSpacing: 1.2,
      wordSpacing: 1.5,
      fontSizes: [10, 12],
      hasStructure: true,
      hasImages: false,
      complexity: 'high',
      readingOrder: 2
    }
  },
  {
    id: 'zone-3',
    page: 2,
    coordinates: { x: 100, y: 50, width: 400, height: 150 },
    type: 'header',
    confidence: 0.9,
    status: 'completed',
    content: 'Chapter 2: Export System Features',
    characteristics: {
      textDensity: 0.4,
      lineSpacing: 1.0,
      wordSpacing: 1.2,
      fontSizes: [16, 18],
      hasStructure: false,
      hasImages: false,
      complexity: 'low',
      readingOrder: 3
    }
  }
];

export default function ExportDemo() {
  const [selectedZones, setSelectedZones] = useState<string[]>([]);
  const [exportFormat, setExportFormat] = useState<'rag' | 'jsonl' | 'corrections'>('rag');
  const [exportConfig, setExportConfig] = useState({
    maxTokens: 1000,
    overlap: 100,
    includeMeta: true
  });
  const [validationResults, setValidationResults] = useState<any>(null);
  const [exportStatus, setExportStatus] = useState<'idle' | 'exporting' | 'completed' | 'error'>('idle');
  const [exportResult, setExportResult] = useState<any>(null);

  const handleZoneSelectionChange = (zones: string[]) => {
    setSelectedZones(zones);
  };

  const handleExportFormatChange = (format: any) => {
    setExportFormat(format);
  };

  const handleConfigChange = (config: any) => {
    setExportConfig(config);
  };

  const handleValidation = (results: any) => {
    setValidationResults(results);
  };

  const handleExport = async () => {
    setExportStatus('exporting');
    
    try {
      // Simulate export process
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Mock export result
      const result = {
        format: exportFormat,
        timestamp: new Date().toISOString(),
        zones: selectedZones.length,
        data: exportFormat === 'rag' 
          ? { chunks: 5, totalTokens: 2500 }
          : { lines: selectedZones.length },
        success: true
      };
      
      setExportResult(result);
      setExportStatus('completed');
    } catch (error) {
      setExportStatus('error');
    }
  };

  const handleReset = () => {
    setExportStatus('idle');
    setExportResult(null);
    setSelectedZones([]);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">
          Epic 3: Export System Demo
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Selection Panel */}
          <div className="lg:col-span-1">
            <h2 className="text-xl font-semibold mb-4">1. Select Zones</h2>
            <SelectionPanel
              zones={mockZones}
              pages={[1, 2]} // Pages from mock data
              onSelectionChange={(selection) => {
                handleZoneSelectionChange(Array.from(selection.zoneIds));
              }}
              initialSelection={{
                type: 'zones',
                zoneIds: new Set(selectedZones),
                pageNumbers: new Set(),
                totalCount: selectedZones.length
              }}
            />
          </div>

          {/* Validation Panel */}
          <div className="lg:col-span-1">
            <h2 className="text-xl font-semibold mb-4">2. Validation</h2>
            <ValidationPanel
              validationResult={validationResults}
              onRevalidate={() => {
                // Simulate validation
                const mockValidation = {
                  isValid: selectedZones.length > 0,
                  passed: selectedZones.length > 0,
                  errors: selectedZones.length === 0 ? [{
                    type: 'selection',
                    message: 'No zones selected',
                    severity: 'error' as const
                  }] : [],
                  warnings: [],
                  blockers: [],
                  report: {
                    timestamp: new Date(),
                    duration: 150,
                    totalChecks: 5,
                    passedChecks: selectedZones.length > 0 ? 5 : 4,
                    failedChecks: selectedZones.length > 0 ? 0 : 1
                  }
                };
                handleValidation(mockValidation);
              }}
              isValidating={false}
            />
          </div>

          {/* Export Feedback */}
          <div className="lg:col-span-1">
            <h2 className="text-xl font-semibold mb-4">3. Export Results</h2>
            <ExportFeedback
              status={exportStatus}
              result={exportResult}
              onExport={handleExport}
              onReset={handleReset}
              canExport={selectedZones.length > 0 && (!validationResults || validationResults.isValid)}
            />
          </div>
        </div>

        {/* Status Summary */}
        <div className="mt-12 bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Current Configuration</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Format:</span>
              <p className="font-medium">{exportFormat.toUpperCase()}</p>
            </div>
            <div>
              <span className="text-gray-500">Selected Zones:</span>
              <p className="font-medium">{selectedZones.length}</p>
            </div>
            <div>
              <span className="text-gray-500">Max Tokens:</span>
              <p className="font-medium">{exportConfig.maxTokens}</p>
            </div>
            <div>
              <span className="text-gray-500">Status:</span>
              <p className="font-medium capitalize">{exportStatus}</p>
            </div>
          </div>
        </div>

        {/* Feature List */}
        <div className="mt-8 bg-blue-50 rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4">Epic 3 Features Demonstrated</h3>
          <ul className="space-y-2 text-sm">
            <li className="flex items-center">
              <span className="text-green-500 mr-2">✓</span>
              Zone selection with confidence indicators
            </li>
            <li className="flex items-center">
              <span className="text-green-500 mr-2">✓</span>
              Multiple export formats (RAG, JSONL, Corrections)
            </li>
            <li className="flex items-center">
              <span className="text-green-500 mr-2">✓</span>
              Real-time validation with warnings
            </li>
            <li className="flex items-center">
              <span className="text-green-500 mr-2">✓</span>
              Configuration options per format
            </li>
            <li className="flex items-center">
              <span className="text-green-500 mr-2">✓</span>
              Export progress and feedback
            </li>
            <li className="flex items-center">
              <span className="text-green-500 mr-2">✓</span>
              Success/error state handling
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}