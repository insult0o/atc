import React, { useState, useEffect, useRef } from 'react';
import { WeightedConfidenceScore } from '../../../lib/pdf-processing/confidence-weighting';
import { ProcessingResult } from '../../../lib/pdf-processing/processing-queue';
import { ConfidenceVisualConfig } from './ConfidenceVisualizer';

// Confidence details interface matching story spec
export interface ConfidenceDetails {
  overallScore: number;
  breakdown: {
    toolConfidence: number;
    contentQuality: number;
    historicalPerformance: number;
    contextualFactors: number;
  };
  tool: {
    name: string;
    version: string;
    processingTime: number;
  };
  suggestions: string[];
  history?: ConfidenceHistoryPoint[];
}

export interface ConfidenceHistoryPoint {
  timestamp: Date;
  score: number;
  event: string;
}

export interface ConfidenceTooltipProps {
  confidence: WeightedConfidenceScore;
  result: ProcessingResult;
  toolName: string;
  position: { x: number; y: number };
  visible: boolean;
  onClose?: () => void;
  visualConfig?: ConfidenceVisualConfig;
  isMobile?: boolean;
}

export const ConfidenceTooltip: React.FC<ConfidenceTooltipProps> = ({
  confidence,
  result,
  toolName,
  position,
  visible,
  onClose,
  visualConfig,
  isMobile = false
}) => {
  const [showHistory, setShowHistory] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [adjustedPosition, setAdjustedPosition] = useState(position);

  // Generate confidence details from the weighted score
  const generateConfidenceDetails = (): ConfidenceDetails => {
    const factors = confidence.explanation.factors;
    
    // Extract specific factor values or use defaults
    const toolConfidence = factors.find(f => f.name === 'Tool Confidence')?.value || confidence.finalScore;
    const contentQuality = factors.find(f => f.name === 'Content Quality')?.value || 0.75;
    const historicalPerformance = factors.find(f => f.name === 'Historical Performance')?.value || 0.8;
    const contextualFactors = factors.find(f => f.name === 'Contextual Factors')?.value || 0.7;

    return {
      overallScore: confidence.finalScore,
      breakdown: {
        toolConfidence,
        contentQuality,
        historicalPerformance,
        contextualFactors
      },
      tool: {
        name: toolName,
        version: '1.0.0', // This would come from tool metadata in real implementation
        processingTime: result.processingTime
      },
      suggestions: confidence.explanation.recommendations,
      history: generateMockHistory() // In real implementation, this would come from a history service
    };
  };

  // Mock history generation - replace with real data
  const generateMockHistory = (): ConfidenceHistoryPoint[] => {
    const now = new Date();
    return [
      { timestamp: new Date(now.getTime() - 3600000), score: 0.75, event: 'Initial processing' },
      { timestamp: new Date(now.getTime() - 1800000), score: 0.82, event: 'Quality check passed' },
      { timestamp: now, score: confidence.finalScore, event: 'Current assessment' }
    ];
  };

  const details = generateConfidenceDetails();

  // Adjust tooltip position to stay within viewport
  useEffect(() => {
    if (!tooltipRef.current || !visible) return;

    const rect = tooltipRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let newX = position.x;
    let newY = position.y;

    // Adjust horizontal position
    if (rect.right > viewportWidth) {
      newX = position.x - rect.width - 10;
    }

    // Adjust vertical position
    if (rect.bottom > viewportHeight) {
      newY = position.y - rect.height - 10;
    }

    setAdjustedPosition({ x: newX, y: newY });
  }, [position, visible]);

  if (!visible) return null;

  // Mobile bottom sheet variant
  if (isMobile) {
    return (
      <div className="fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-2xl shadow-2xl animate-slide-up">
        <div className="p-4 max-h-[70vh] overflow-y-auto">
          <div className="flex justify-between items-start mb-4">
            <h3 className="text-lg font-semibold">Confidence Details</h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>
          <TooltipContent details={details} confidence={confidence} showHistory={showHistory} setShowHistory={setShowHistory} />
        </div>
      </div>
    );
  }

  // Desktop floating tooltip
  return (
    <div
      ref={tooltipRef}
      className="fixed z-50 bg-white rounded-lg shadow-2xl border border-gray-200 animate-fade-in"
      style={{
        left: `${adjustedPosition.x}px`,
        top: `${adjustedPosition.y}px`,
        minWidth: '320px',
        maxWidth: '400px'
      }}
    >
      <TooltipContent 
        details={details} 
        confidence={confidence} 
        showHistory={showHistory} 
        setShowHistory={setShowHistory} 
        onClose={onClose}
      />
    </div>
  );
};

// Tooltip content component
const TooltipContent: React.FC<{
  details: ConfidenceDetails;
  confidence: WeightedConfidenceScore;
  showHistory: boolean;
  setShowHistory: (show: boolean) => void;
  onClose?: () => void;
}> = ({ details, confidence, showHistory, setShowHistory, onClose }) => {
  return (
    <div className="p-4">
      {/* Header */}
      <div className="flex justify-between items-center mb-3">
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${getScoreColorClass(details.overallScore)}`} />
          <span className="font-semibold text-lg">
            {Math.round(details.overallScore * 100)}% Confidence
          </span>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-sm"
          >
            ✕
          </button>
        )}
      </div>

      {/* Confidence Breakdown */}
      <div className="space-y-2 mb-4">
        <h4 className="text-sm font-medium text-gray-700">Confidence Breakdown</h4>
        {Object.entries(details.breakdown).map(([key, value]) => (
          <ConfidenceBreakdownItem
            key={key}
            label={formatLabel(key)}
            value={value}
            description={getFactorDescription(key)}
          />
        ))}
      </div>

      {/* Tool Information */}
      <div className="border-t pt-3 mb-3">
        <h4 className="text-sm font-medium text-gray-700 mb-2">Extraction Details</h4>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <span className="text-gray-500">Tool:</span>
            <span className="ml-1 font-medium">{details.tool.name}</span>
          </div>
          <div>
            <span className="text-gray-500">Version:</span>
            <span className="ml-1 font-medium">{details.tool.version}</span>
          </div>
          <div>
            <span className="text-gray-500">Processing:</span>
            <span className="ml-1 font-medium">{details.tool.processingTime}ms</span>
          </div>
          <div>
            <span className="text-gray-500">Method:</span>
            <span className="ml-1 font-medium">{confidence.method}</span>
          </div>
        </div>
      </div>

      {/* History/Trend Indicator */}
      <div className="border-t pt-3">
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="flex items-center justify-between w-full text-sm font-medium text-gray-700 hover:text-gray-900"
        >
          <span>Confidence History</span>
          <svg
            className={`w-4 h-4 transform transition-transform ${showHistory ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        
        {showHistory && details.history && (
          <div className="mt-2 space-y-1">
            {details.history.map((point, idx) => (
              <div key={idx} className="flex items-center justify-between text-sm">
                <span className="text-gray-500">
                  {new Date(point.timestamp).toLocaleTimeString()}
                </span>
                <span className={`font-medium ${getScoreColorClass(point.score)}`}>
                  {Math.round(point.score * 100)}%
                </span>
                <span className="text-gray-600 text-xs">{point.event}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Suggestions */}
      {details.suggestions.length > 0 && (
        <div className="border-t pt-3 mt-3">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Recommendations</h4>
          <ul className="space-y-1">
            {details.suggestions.map((suggestion, idx) => (
              <li key={idx} className="text-sm text-gray-600 flex items-start">
                <span className="text-blue-500 mr-1">•</span>
                {suggestion}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

// Confidence breakdown item component
const ConfidenceBreakdownItem: React.FC<{
  label: string;
  value: number;
  description: string;
}> = ({ label, value, description }) => {
  const percentage = Math.round(value * 100);
  
  return (
    <div className="group">
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-600 group-hover:text-gray-800">{label}</span>
        <span className={`text-sm font-medium ${getScoreColorClass(value)}`}>
          {percentage}%
        </span>
      </div>
      <div className="mt-1 bg-gray-200 rounded-full h-1.5">
        <div
          className={`h-full rounded-full transition-all duration-300 ${getScoreBackgroundClass(value)}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <p className="text-xs text-gray-500 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {description}
      </p>
    </div>
  );
};

// Helper functions
const getScoreColorClass = (score: number): string => {
  if (score >= 0.8) return 'text-green-600';
  if (score >= 0.6) return 'text-blue-600';
  if (score >= 0.4) return 'text-yellow-600';
  return 'text-red-600';
};

const getScoreBackgroundClass = (score: number): string => {
  if (score >= 0.8) return 'bg-green-500';
  if (score >= 0.6) return 'bg-blue-500';
  if (score >= 0.4) return 'bg-yellow-500';
  return 'bg-red-500';
};

const formatLabel = (key: string): string => {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase())
    .trim();
};

const getFactorDescription = (key: string): string => {
  const descriptions: Record<string, string> = {
    toolConfidence: 'How confident the extraction tool is in its results',
    contentQuality: 'Quality assessment of the source content',
    historicalPerformance: 'Past performance of this tool on similar content',
    contextualFactors: 'Context-specific confidence adjustments'
  };
  return descriptions[key] || 'Confidence factor';
};

// Add CSS animations (add to your global CSS or Tailwind config)
const tooltipStyles = `
@keyframes fade-in {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

@keyframes slide-up {
  from {
    transform: translateY(100%);
  }
  to {
    transform: translateY(0);
  }
}

.animate-fade-in {
  animation: fade-in 0.2s ease-out;
}

.animate-slide-up {
  animation: slide-up 0.3s ease-out;
}
`;

export default ConfidenceTooltip;