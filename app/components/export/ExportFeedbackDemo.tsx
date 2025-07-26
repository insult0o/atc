/**
 * Export Feedback Demo Component
 * Simplified version for the export demo page
 */

import React from 'react';
import { Download, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';

interface ExportFeedbackProps {
  status: 'idle' | 'exporting' | 'completed' | 'error';
  result: any;
  onExport: () => void;
  onReset: () => void;
  canExport: boolean;
}

export const ExportFeedback: React.FC<ExportFeedbackProps> = ({
  status,
  result,
  onExport,
  onReset,
  canExport
}) => {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      {/* Status Display */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-3">Export Status</h3>
        
        {status === 'idle' && (
          <div className="flex items-center text-gray-600">
            <AlertCircle className="w-5 h-5 mr-2" />
            <span>Ready to export</span>
          </div>
        )}
        
        {status === 'exporting' && (
          <div className="flex items-center text-blue-600">
            <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
            <span>Exporting...</span>
          </div>
        )}
        
        {status === 'completed' && (
          <div className="flex items-center text-green-600">
            <CheckCircle className="w-5 h-5 mr-2" />
            <span>Export completed successfully!</span>
          </div>
        )}
        
        {status === 'error' && (
          <div className="flex items-center text-red-600">
            <AlertCircle className="w-5 h-5 mr-2" />
            <span>Export failed</span>
          </div>
        )}
      </div>

      {/* Result Display */}
      {result && status === 'completed' && (
        <div className="mb-6 p-4 bg-gray-50 rounded">
          <h4 className="font-medium mb-2">Export Result</h4>
          <div className="text-sm space-y-1">
            <div>Format: <span className="font-medium">{result.format.toUpperCase()}</span></div>
            <div>Zones: <span className="font-medium">{result.zones}</span></div>
            {result.data && (
              <>
                {result.data.chunks && (
                  <div>Chunks: <span className="font-medium">{result.data.chunks}</span></div>
                )}
                {result.data.totalTokens && (
                  <div>Tokens: <span className="font-medium">{result.data.totalTokens}</span></div>
                )}
                {result.data.lines && (
                  <div>Lines: <span className="font-medium">{result.data.lines}</span></div>
                )}
              </>
            )}
            <div className="text-xs text-gray-500 mt-2">
              {new Date(result.timestamp).toLocaleString()}
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="space-y-2">
        {(status === 'idle' || status === 'error') && (
          <button
            onClick={onExport}
            disabled={!canExport}
            className={`
              w-full px-4 py-2 rounded flex items-center justify-center gap-2
              ${canExport 
                ? 'bg-blue-500 text-white hover:bg-blue-600' 
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }
            `}
          >
            <Download className="w-4 h-4" />
            Export
          </button>
        )}
        
        {status === 'exporting' && (
          <button
            disabled
            className="w-full px-4 py-2 bg-gray-200 text-gray-400 rounded cursor-not-allowed"
          >
            Exporting...
          </button>
        )}
        
        {(status === 'completed' || status === 'error') && (
          <button
            onClick={onReset}
            className="w-full px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
          >
            Reset
          </button>
        )}
      </div>

      {/* Help Text */}
      {status === 'idle' && !canExport && (
        <p className="text-sm text-gray-500 mt-3">
          Select at least one zone to enable export
        </p>
      )}
    </div>
  );
};