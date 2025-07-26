import React from 'react';
import { WeightedConfidenceScore } from '../../../lib/pdf-processing/confidence-weighting';

export interface ConfidenceComparisonProps {
  scores: Map<string, WeightedConfidenceScore>;
  toolNames: string[];
  highlightBest?: boolean;
}

export const ConfidenceComparison: React.FC<ConfidenceComparisonProps> = ({
  scores,
  toolNames,
  highlightBest = true
}) => {
  const bestScore = Math.max(...Array.from(scores.values()).map(s => s.finalScore));

  return (
    <div className="confidence-comparison space-y-2">
      <h4 className="text-sm font-medium text-gray-700">Tool Comparison</h4>
      {toolNames.map(toolName => {
        const score = scores.get(toolName);
        if (!score) return null;

        const isBest = highlightBest && score.finalScore === bestScore;

        return (
          <div
            key={toolName}
            className={`p-2 rounded ${isBest ? 'bg-green-50 border border-green-300' : 'bg-gray-50'}`}
          >
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">{toolName}</span>
              <span className={`text-sm ${isBest ? 'text-green-700 font-bold' : 'text-gray-700'}`}>
                {Math.round(score.finalScore * 100)}%
              </span>
            </div>
            <div className="mt-1 h-1.5 bg-gray-200 rounded-full">
              <div
                className={`h-full rounded-full ${isBest ? 'bg-green-500' : 'bg-blue-500'}`}
                style={{ width: `${score.finalScore * 100}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};