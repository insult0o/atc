import React from 'react';
import { Zone } from '../zones/ZoneManager';
import { ProcessingResult } from '../../../lib/pdf-processing/processing-queue';
import { WeightedConfidenceScore } from '../../../lib/pdf-processing/confidence-weighting';
import { ToolConfidenceScore } from '../../../lib/pdf-processing/tool-confidence';

// Confidence visualization components for zones
export interface ConfidenceVisualizerProps {
  zone: Zone;
  results: ProcessingResult[];
  confidenceScores: Map<string, WeightedConfidenceScore>;
  onThresholdChange?: (threshold: number) => void;
  onFilterChange?: (filters: ConfidenceFilters) => void;
}

export interface ConfidenceFilters {
  minConfidence: number;
  maxConfidence: number;
  tools: string[];
  showOnlyLowConfidence: boolean;
  showOnlyHighConfidence: boolean;
}

export interface ConfidenceIndicatorProps {
  confidence: number;
  size?: 'small' | 'medium' | 'large';
  showLabel?: boolean;
  showTooltip?: boolean;
  threshold?: number;
}

export interface ConfidenceHeatmapProps {
  zones: Zone[];
  confidenceData: Map<string, number>;
  onZoneClick?: (zoneId: string) => void;
  colorScale?: 'default' | 'accessible' | 'custom';
  customColors?: ConfidenceColorScale;
}

export interface ConfidenceColorScale {
  veryLow: string;    // 0-20%
  low: string;        // 20-40%
  medium: string;     // 40-60%
  high: string;       // 60-80%
  veryHigh: string;   // 80-100%
}

export interface ConfidenceTrendChartProps {
  historicalData: ConfidenceTrendData[];
  timeRange: TimeRange;
  groupBy: 'tool' | 'contentType' | 'overall';
  showPrediction?: boolean;
}

export interface ConfidenceTrendData {
  timestamp: Date;
  averageConfidence: number;
  toolBreakdown?: Map<string, number>;
  contentTypeBreakdown?: Map<string, number>;
  sampleCount: number;
}

export type TimeRange = '1h' | '24h' | '7d' | '30d' | 'custom';

// Main confidence visualizer component
export const ConfidenceVisualizer: React.FC<ConfidenceVisualizerProps> = ({
  zone,
  results,
  confidenceScores,
  onThresholdChange,
  onFilterChange
}) => {
  const [filters, setFilters] = React.useState<ConfidenceFilters>({
    minConfidence: 0,
    maxConfidence: 1,
    tools: [],
    showOnlyLowConfidence: false,
    showOnlyHighConfidence: false
  });

  const [selectedTool, setSelectedTool] = React.useState<string | null>(null);
  const [showDetails, setShowDetails] = React.useState(false);

  const getConfidenceColor = (confidence: number): string => {
    if (confidence >= 0.8) return 'text-green-600';
    if (confidence >= 0.6) return 'text-blue-600';
    if (confidence >= 0.4) return 'text-yellow-600';
    if (confidence >= 0.2) return 'text-orange-600';
    return 'text-red-600';
  };

  const getConfidenceLabel = (confidence: number): string => {
    if (confidence >= 0.8) return 'Very High';
    if (confidence >= 0.6) return 'High';
    if (confidence >= 0.4) return 'Medium';
    if (confidence >= 0.2) return 'Low';
    return 'Very Low';
  };

  const filteredResults = results.filter(result => {
    const confidence = confidenceScores.get(result.toolName)?.finalScore || 0;
    
    if (confidence < filters.minConfidence || confidence > filters.maxConfidence) {
      return false;
    }
    
    if (filters.tools.length > 0 && !filters.tools.includes(result.toolName)) {
      return false;
    }
    
    if (filters.showOnlyLowConfidence && confidence >= 0.4) {
      return false;
    }
    
    if (filters.showOnlyHighConfidence && confidence < 0.6) {
      return false;
    }
    
    return true;
  });

  return (
    <div className="space-y-4 p-4 bg-white rounded-lg shadow">
      {/* Header with zone info and overall confidence */}
      <div className="flex justify-between items-center border-b pb-2">
        <div>
          <h3 className="text-lg font-semibold">Zone Confidence Analysis</h3>
          <p className="text-sm text-gray-600">
            Type: {zone.type} | Tools: {results.length}
          </p>
        </div>
        <OverallConfidenceIndicator
          results={results}
          confidenceScores={confidenceScores}
        />
      </div>

      {/* Filter controls */}
      <ConfidenceFilterControls
        filters={filters}
        availableTools={results.map(r => r.toolName)}
        onChange={(newFilters) => {
          setFilters(newFilters);
          onFilterChange?.(newFilters);
        }}
      />

      {/* Tool results with confidence */}
      <div className="space-y-2">
        {filteredResults.map((result) => {
          const confidence = confidenceScores.get(result.toolName);
          if (!confidence) return null;

          return (
            <ToolConfidenceCard
              key={result.toolName}
              toolName={result.toolName}
              result={result}
              confidence={confidence}
              isSelected={selectedTool === result.toolName}
              onClick={() => setSelectedTool(result.toolName)}
              onShowDetails={() => setShowDetails(true)}
            />
          );
        })}
      </div>

      {/* Confidence details modal */}
      {showDetails && selectedTool && (
        <ConfidenceDetailsModal
          toolName={selectedTool}
          confidence={confidenceScores.get(selectedTool)!}
          result={results.find(r => r.toolName === selectedTool)!}
          onClose={() => setShowDetails(false)}
        />
      )}
    </div>
  );
};

// Individual confidence indicator component
export const ConfidenceIndicator: React.FC<ConfidenceIndicatorProps> = ({
  confidence,
  size = 'medium',
  showLabel = true,
  showTooltip = true,
  threshold = 0.6
}) => {
  const sizeClasses = {
    small: 'w-12 h-12 text-xs',
    medium: 'w-16 h-16 text-sm',
    large: 'w-20 h-20 text-base'
  };

  const isAboveThreshold = confidence >= threshold;
  const percentage = Math.round(confidence * 100);

  return (
    <div className={`relative inline-flex items-center justify-center ${sizeClasses[size]}`}>
      {/* Circular progress */}
      <svg className="transform -rotate-90 w-full h-full">
        <circle
          cx="50%"
          cy="50%"
          r="45%"
          stroke="currentColor"
          strokeWidth="2"
          fill="none"
          className="text-gray-200"
        />
        <circle
          cx="50%"
          cy="50%"
          r="45%"
          stroke="currentColor"
          strokeWidth="3"
          fill="none"
          strokeDasharray={`${confidence * 283} 283`}
          className={getConfidenceColor(confidence)}
        />
      </svg>
      
      {/* Percentage text */}
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={`font-semibold ${getConfidenceColor(confidence)}`}>
          {percentage}%
        </span>
      </div>

      {/* Label */}
      {showLabel && (
        <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 whitespace-nowrap">
          <span className="text-xs text-gray-600">
            {getConfidenceLabel(confidence)}
          </span>
        </div>
      )}

      {/* Tooltip */}
      {showTooltip && (
        <div className="absolute opacity-0 hover:opacity-100 transition-opacity duration-200 bottom-full left-1/2 transform -translate-x-1/2 mb-2 pointer-events-none">
          <div className="bg-gray-900 text-white text-xs rounded py-1 px-2 whitespace-nowrap">
            Confidence: {percentage}%
            {!isAboveThreshold && (
              <span className="block text-yellow-300">
                Below threshold ({Math.round(threshold * 100)}%)
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// Confidence heatmap component
export const ConfidenceHeatmap: React.FC<ConfidenceHeatmapProps> = ({
  zones,
  confidenceData,
  onZoneClick,
  colorScale = 'default',
  customColors
}) => {
  const defaultColors: ConfidenceColorScale = {
    veryLow: '#ef4444',   // red-500
    low: '#f97316',       // orange-500
    medium: '#eab308',    // yellow-500
    high: '#3b82f6',      // blue-500
    veryHigh: '#10b981'   // green-500
  };

  const accessibleColors: ConfidenceColorScale = {
    veryLow: '#991b1b',   // red-800
    low: '#c2410c',       // orange-800
    medium: '#a16207',    // yellow-800
    high: '#1e40af',      // blue-800
    veryHigh: '#14532d'   // green-900
  };

  const colors = customColors || (colorScale === 'accessible' ? accessibleColors : defaultColors);

  const getZoneColor = (confidence: number): string => {
    if (confidence >= 0.8) return colors.veryHigh;
    if (confidence >= 0.6) return colors.high;
    if (confidence >= 0.4) return colors.medium;
    if (confidence >= 0.2) return colors.low;
    return colors.veryLow;
  };

  return (
    <div className="relative w-full h-full">
      {/* Heatmap grid */}
      <div className="grid grid-cols-auto gap-1">
        {zones.map((zone) => {
          const confidence = confidenceData.get(zone.id) || 0;
          const color = getZoneColor(confidence);
          
          return (
            <div
              key={zone.id}
              className="relative cursor-pointer transition-all duration-200 hover:scale-105"
              style={{
                backgroundColor: color,
                opacity: 0.8,
                gridColumn: `span ${Math.max(1, Math.round(zone.bounds.width / 100))}`,
                gridRow: `span ${Math.max(1, Math.round(zone.bounds.height / 100))}`
              }}
              onClick={() => onZoneClick?.(zone.id)}
            >
              {/* Zone label with confidence */}
              <div className="absolute inset-0 flex items-center justify-center p-2">
                <div className="text-white text-xs font-medium text-center">
                  <div>{zone.type}</div>
                  <div>{Math.round(confidence * 100)}%</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="absolute bottom-4 right-4 bg-white p-2 rounded shadow">
        <div className="text-xs font-medium mb-1">Confidence</div>
        {Object.entries(colors).map(([level, color]) => (
          <div key={level} className="flex items-center gap-2 text-xs">
            <div className="w-4 h-4 rounded" style={{ backgroundColor: color }} />
            <span className="capitalize">{level.replace(/([A-Z])/g, ' $1').trim()}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// Helper components
const OverallConfidenceIndicator: React.FC<{
  results: ProcessingResult[];
  confidenceScores: Map<string, WeightedConfidenceScore>;
}> = ({ results, confidenceScores }) => {
  const averageConfidence = results.reduce((sum, result) => {
    const confidence = confidenceScores.get(result.toolName)?.finalScore || 0;
    return sum + confidence;
  }, 0) / results.length;

  return (
    <ConfidenceIndicator
      confidence={averageConfidence}
      size="large"
      showLabel={true}
    />
  );
};

const ConfidenceFilterControls: React.FC<{
  filters: ConfidenceFilters;
  availableTools: string[];
  onChange: (filters: ConfidenceFilters) => void;
}> = ({ filters, availableTools, onChange }) => {
  return (
    <div className="flex flex-wrap gap-4 p-3 bg-gray-50 rounded">
      {/* Confidence range slider */}
      <div className="flex-1 min-w-[200px]">
        <label className="text-sm font-medium text-gray-700">
          Confidence Range: {Math.round(filters.minConfidence * 100)}% - {Math.round(filters.maxConfidence * 100)}%
        </label>
        <div className="flex gap-2 mt-1">
          <input
            type="range"
            min="0"
            max="100"
            value={filters.minConfidence * 100}
            onChange={(e) => onChange({
              ...filters,
              minConfidence: parseInt(e.target.value) / 100
            })}
            className="flex-1"
          />
          <input
            type="range"
            min="0"
            max="100"
            value={filters.maxConfidence * 100}
            onChange={(e) => onChange({
              ...filters,
              maxConfidence: parseInt(e.target.value) / 100
            })}
            className="flex-1"
          />
        </div>
      </div>

      {/* Quick filters */}
      <div className="flex gap-2">
        <button
          className={`px-3 py-1 text-sm rounded ${
            filters.showOnlyLowConfidence
              ? 'bg-orange-500 text-white'
              : 'bg-gray-200 text-gray-700'
          }`}
          onClick={() => onChange({
            ...filters,
            showOnlyLowConfidence: !filters.showOnlyLowConfidence,
            showOnlyHighConfidence: false
          })}
        >
          Low Confidence Only
        </button>
        <button
          className={`px-3 py-1 text-sm rounded ${
            filters.showOnlyHighConfidence
              ? 'bg-green-500 text-white'
              : 'bg-gray-200 text-gray-700'
          }`}
          onClick={() => onChange({
            ...filters,
            showOnlyHighConfidence: !filters.showOnlyHighConfidence,
            showOnlyLowConfidence: false
          })}
        >
          High Confidence Only
        </button>
      </div>
    </div>
  );
};

const ToolConfidenceCard: React.FC<{
  toolName: string;
  result: ProcessingResult;
  confidence: WeightedConfidenceScore;
  isSelected: boolean;
  onClick: () => void;
  onShowDetails: () => void;
}> = ({ toolName, result, confidence, isSelected, onClick, onShowDetails }) => {
  return (
    <div
      className={`p-3 rounded border cursor-pointer transition-all ${
        isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
      }`}
      onClick={onClick}
    >
      <div className="flex justify-between items-center">
        <div className="flex-1">
          <h4 className="font-medium">{toolName}</h4>
          <p className="text-sm text-gray-600">
            Status: {result.status} | Time: {result.processingTime}ms
          </p>
        </div>
        <div className="flex items-center gap-3">
          <ConfidenceIndicator
            confidence={confidence.finalScore}
            size="small"
            showLabel={false}
          />
          <button
            className="text-sm text-blue-600 hover:text-blue-800"
            onClick={(e) => {
              e.stopPropagation();
              onShowDetails();
            }}
          >
            Details
          </button>
        </div>
      </div>
      
      {/* Confidence factors preview */}
      <div className="mt-2 flex flex-wrap gap-2">
        {confidence.explanation.factors.slice(0, 3).map((factor, idx) => (
          <span
            key={idx}
            className="text-xs px-2 py-1 bg-gray-100 rounded"
            title={factor.description}
          >
            {factor.name}: {Math.round(factor.value * 100)}%
          </span>
        ))}
        {confidence.explanation.factors.length > 3 && (
          <span className="text-xs text-gray-500">
            +{confidence.explanation.factors.length - 3} more
          </span>
        )}
      </div>
    </div>
  );
};

const ConfidenceDetailsModal: React.FC<{
  toolName: string;
  confidence: WeightedConfidenceScore;
  result: ProcessingResult;
  onClose: () => void;
}> = ({ toolName, confidence, result, onClose }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-semibold">Confidence Details: {toolName}</h3>
          <button
            className="text-gray-500 hover:text-gray-700"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        {/* Overall confidence */}
        <div className="mb-6 text-center">
          <ConfidenceIndicator
            confidence={confidence.finalScore}
            size="large"
            showLabel={true}
          />
        </div>

        {/* Confidence breakdown */}
        <div className="space-y-4">
          <div>
            <h4 className="font-medium mb-2">Confidence Factors</h4>
            <div className="space-y-2">
              {confidence.explanation.factors.map((factor, idx) => (
                <div key={idx} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                  <div>
                    <div className="font-medium">{factor.name}</div>
                    <div className="text-sm text-gray-600">{factor.description}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium">{Math.round(factor.value * 100)}%</div>
                    <div className="text-sm text-gray-600">
                      Weight: {Math.round(factor.weight * 100)}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Reasoning */}
          <div>
            <h4 className="font-medium mb-2">Analysis</h4>
            <p className="text-sm text-gray-700">{confidence.explanation.reasoning}</p>
          </div>

          {/* Recommendations */}
          {confidence.explanation.recommendations.length > 0 && (
            <div>
              <h4 className="font-medium mb-2">Recommendations</h4>
              <ul className="list-disc list-inside space-y-1">
                {confidence.explanation.recommendations.map((rec, idx) => (
                  <li key={idx} className="text-sm text-gray-700">{rec}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Processing details */}
          <div>
            <h4 className="font-medium mb-2">Processing Details</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>Status: <span className="font-medium">{result.status}</span></div>
              <div>Time: <span className="font-medium">{result.processingTime}ms</span></div>
              <div>Attempts: <span className="font-medium">{result.attempts || 1}</span></div>
              {result.error && (
                <div className="col-span-2">
                  Error: <span className="text-red-600">{result.error}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Export additional utility components
export { ConfidenceTrendChart } from './ConfidenceTrendChart';
export { ConfidenceComparison } from './ConfidenceComparison';
export { ConfidenceThresholdEditor } from './ConfidenceThresholdEditor';