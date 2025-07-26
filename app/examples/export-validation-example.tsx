// Example: Using the Export Validation System

'use client'

import React, { useState } from 'react'
import { ExportManager } from '@/lib/export/manager'
import { ValidationPanel, OverrideRequestModal } from '@/app/components/export/ValidationPanel'
import { ExportFormat } from '@/lib/export/schemas/types'
import { Zone } from '@/lib/types/zone'

// Example component demonstrating export validation
export function ExportValidationExample() {
  const [exportManager] = useState(() => new ExportManager())
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [validationResults, setValidationResults] = useState<any>(null)
  const [showOverrideModal, setShowOverrideModal] = useState(false)
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('rag')
  const [isValidating, setIsValidating] = useState(false)

  // Sample document with zones
  const sampleDocument = {
    id: 'doc_123',
    name: 'sample-document.pdf',
    pageCount: 10,
    pages: Array.from({ length: 10 }, (_, i) => ({
      pageNumber: i + 1,
      width: 612,
      height: 792,
      rotation: 0
    })),
    zones: [
      {
        id: 'zone_001',
        pageNumber: 1,
        bounds: { x: 50, y: 50, width: 500, height: 100 },
        type: 'text' as const,
        status: 'processed' as const,
        confidence: 0.95,
        textContent: 'This is a sample text zone with high confidence.',
        userModified: false,
        lastModified: new Date()
      },
      {
        id: 'zone_002',
        pageNumber: 1,
        bounds: { x: 50, y: 200, width: 500, height: 200 },
        type: 'table' as const,
        status: 'processed' as const,
        confidence: 0.85,
        userModified: false,
        lastModified: new Date()
      },
      {
        id: 'zone_003',
        pageNumber: 2,
        bounds: { x: 50, y: 50, width: 500, height: 100 },
        type: 'text' as const,
        status: 'failed' as const,
        confidence: 0.3,
        errorDetails: {
          type: 'ocr_failure',
          message: 'OCR confidence too low',
          timestamp: new Date(),
          recoverable: true
        },
        userModified: false,
        lastModified: new Date()
      }
    ] as Zone[]
  }

  const handleExport = async () => {
    try {
      setIsValidating(true)
      
      // Start export with validation enabled
      const newSessionId = await exportManager.startExport(
        sampleDocument,
        [selectedFormat],
        {
          validation: {
            enabled: true,
            stopOnError: true,
            customRules: []
          }
        }
      )
      
      setSessionId(newSessionId)
      
      // Simulate waiting for export to complete
      setTimeout(async () => {
        const session = exportManager.getExportResults(newSessionId)
        if (session) {
          const validationMap = exportManager.getValidationResults(newSessionId)
          if (validationMap) {
            const result = validationMap.get(selectedFormat)
            setValidationResults(result)
          }
        }
        setIsValidating(false)
      }, 3000)
      
    } catch (error) {
      console.error('Export failed:', error)
      setIsValidating(false)
    }
  }

  const handleOverrideRequest = (blockers: any[]) => {
    setShowOverrideModal(true)
  }

  const handleOverrideSubmit = async (justification: string) => {
    if (sessionId) {
      const approved = await exportManager.requestValidationOverride(
        sessionId,
        selectedFormat,
        justification,
        'user@example.com'
      )
      
      if (approved) {
        alert('Override approved! Export can proceed.')
      } else {
        alert('Override request requires additional approval.')
      }
    }
    setShowOverrideModal(false)
  }

  const handleRevalidate = async () => {
    // Re-run validation
    handleExport()
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Export Validation Example</h1>
      
      {/* Export Controls */}
      <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
        <h2 className="text-lg font-medium mb-4">Export Configuration</h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Export Format
            </label>
            <select
              value={selectedFormat}
              onChange={(e) => setSelectedFormat(e.target.value as ExportFormat)}
              className="w-full px-3 py-2 border rounded-md"
            >
              <option value="rag">RAG (Retrieval-Augmented Generation)</option>
              <option value="jsonl">JSONL (Training Data)</option>
              <option value="corrections">Corrections</option>
              <option value="manifest">Manifest</option>
            </select>
          </div>
          
          <div>
            <button
              onClick={handleExport}
              disabled={isValidating}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {isValidating ? 'Validating...' : 'Export with Validation'}
            </button>
          </div>
        </div>
      </div>

      {/* Document Info */}
      <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
        <h2 className="text-lg font-medium mb-4">Document Information</h2>
        <dl className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-gray-500">Document Name:</dt>
            <dd className="font-medium">{sampleDocument.name}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Page Count:</dt>
            <dd className="font-medium">{sampleDocument.pageCount}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Total Zones:</dt>
            <dd className="font-medium">{sampleDocument.zones.length}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Failed Zones:</dt>
            <dd className="font-medium text-red-600">
              {sampleDocument.zones.filter(z => z.status === 'failed').length}
            </dd>
          </div>
        </dl>
      </div>

      {/* Validation Results */}
      <ValidationPanel
        validationResult={validationResults}
        onOverrideRequest={handleOverrideRequest}
        onRevalidate={handleRevalidate}
        isValidating={isValidating}
        className="mb-6"
      />

      {/* Override Modal */}
      {showOverrideModal && validationResults && (
        <OverrideRequestModal
          blockers={validationResults.blockers}
          onSubmit={handleOverrideSubmit}
          onCancel={() => setShowOverrideModal(false)}
        />
      )}

      {/* Example Validation Scenarios */}
      <div className="bg-gray-50 rounded-lg border p-6">
        <h3 className="font-medium mb-3">Example Validation Scenarios</h3>
        <div className="space-y-3 text-sm text-gray-600">
          <div className="flex items-start">
            <div className="w-2 h-2 bg-red-500 rounded-full mt-1.5 mr-2"></div>
            <div>
              <strong>Schema Validation Failure:</strong> Export data doesn't match the required JSON schema
            </div>
          </div>
          <div className="flex items-start">
            <div className="w-2 h-2 bg-yellow-500 rounded-full mt-1.5 mr-2"></div>
            <div>
              <strong>Zone Completeness Warning:</strong> Some zones failed processing or have low confidence
            </div>
          </div>
          <div className="flex items-start">
            <div className="w-2 h-2 bg-orange-500 rounded-full mt-1.5 mr-2"></div>
            <div>
              <strong>Content Format Issues:</strong> Invalid characters or encoding problems detected
            </div>
          </div>
          <div className="flex items-start">
            <div className="w-2 h-2 bg-blue-500 rounded-full mt-1.5 mr-2"></div>
            <div>
              <strong>Metadata Completeness:</strong> Missing recommended metadata fields
            </div>
          </div>
          <div className="flex items-start">
            <div className="w-2 h-2 bg-purple-500 rounded-full mt-1.5 mr-2"></div>
            <div>
              <strong>Custom Rule Validation:</strong> Business-specific rules like chunk size limits
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Example of programmatic validation
export async function validateExportProgrammatically() {
  const exportManager = new ExportManager()
  
  const document = {
    id: 'doc_456',
    name: 'test-document.pdf',
    pageCount: 5,
    zones: [] as Zone[]
  }
  
  // Start export
  const sessionId = await exportManager.startExport(
    document,
    ['rag', 'jsonl'],
    {
      validation: {
        enabled: true,
        stopOnError: false,
        customRules: [
          {
            id: 'min_chunks',
            name: 'Minimum Chunks Required',
            description: 'Ensure at least 5 chunks are generated',
            type: 'business',
            applies_to: ['rag'],
            priority: 10,
            config: {
              minChunks: 5
            }
          }
        ]
      }
    }
  )
  
  // Monitor progress
  const checkProgress = setInterval(() => {
    const progress = exportManager.getExportProgress(sessionId)
    console.log('Export progress:', progress)
    
    const session = exportManager.getExportResults(sessionId)
    if (session?.endTime) {
      clearInterval(checkProgress)
      
      // Get validation results
      const validationResults = exportManager.getValidationResults(sessionId)
      validationResults?.forEach((result, format) => {
        console.log(`Validation for ${format}:`, {
          valid: result.valid,
          score: result.score,
          errors: result.errors.length,
          warnings: result.warnings.length,
          blockers: result.blockers.length
        })
      })
    }
  }, 1000)
  
  return sessionId
}