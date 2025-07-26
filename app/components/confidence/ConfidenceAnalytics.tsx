import React, { useState, useMemo } from 'react';
import { Zone } from '../zones/ZoneManager';
import { ProcessingResult } from '../../../lib/pdf-processing/processing-queue';
import { WeightedConfidence } from '../../../lib/pdf-processing/confidence-weighting';
import { ConfidenceHeatmap } from './ConfidenceVisualizer';

export interface ConfidenceAnalyticsProps {
  zones: Zone[];
  results: ProcessingResult[];
  confidenceScores: Map<string, Map<string, WeightedConfidenceScore>>;
  timeRange?: '1h' | '24h' | '7d' | '30d' | 'all';
  onExport?: (data: AnalyticsExportData) => void;
}

export interface AnalyticsExportData {
  summary: ConfidenceSummary;
  distribution: ConfidenceDistribution[];
  toolPerformance: ToolPerformanceMetrics[];
  trends: ConfidenceTrend[];
  timestamp: Date;
}

export interface ConfidenceSummary {
  averageConfidence: number;
  totalZones: number;
  highConfidenceZones: number;
  lowConfidenceZones: number;
  processingSuccessRate: number;
}

export interface ConfidenceDistribution {
  range: string;
  count: number;
  percentage: number;
}

export interface ToolPerformanceMetrics {
  toolName: string;
  averageConfidence: number;
  processedZones: number;
  successRate: number;
  averageProcessingTime: number;
}

export interface ConfidenceTrend {
  timestamp: Date;
  averageConfidence: number;
  zoneCount: number;
}

// Main analytics dashboard component
export const ConfidenceAnalytics: React.FC<ConfidenceAnalyticsProps> = ({
  zones,
  results,
  confidenceScores,
  timeRange = 'all',
  onExport
}) => {
  const [selectedView, setSelectedView] = useState<'overview' | 'distribution' | 'heatmap' | 'trends' | 'tools'>('overview');
  const [selectedTool, setSelectedTool] = useState<string | null>(null);

  // Calculate analytics data
  const analyticsData = useMemo(() => {
    const summary = calculateSummary(zones, confidenceScores);
    const distribution = calculateDistribution(zones, confidenceScores);
    const toolPerformance = calculateToolPerformance(results, confidenceScores);
    const trends = generateTrends(zones, confidenceScores, timeRange);

    return {
      summary,
      distribution,
      toolPerformance,
      trends
    };
  }, [zones, results, confidenceScores, timeRange]);

  const handleExport = () => {
    const exportData: AnalyticsExportData = {
      ...analyticsData,
      timestamp: new Date()
    };
    onExport?.(exportData);
  };

  return (
    <div className="bg-white rounded-lg shadow-lg">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">Confidence Analytics</h2>
          <div className="flex items-center gap-4">
            <select
              value={timeRange}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm"
            >
              <option value="1h">Last Hour</option>
              <option value="24h">Last 24 Hours</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="all">All Time</option>
            </select>
            <button
              onClick={handleExport}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium"
            >
              Export Data
            </button>
          </div>
        </div>

        {/* View tabs */}
        <div className="mt-4 flex gap-2">
          {['overview', 'distribution', 'heatmap', 'trends', 'tools'].map((view) => (
            <button
              key={view}
              onClick={() => setSelectedView(view as any)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                selectedView === view
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              {view.charAt(0).toUpperCase() + view.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {selectedView === 'overview' && (
          <OverviewSection summary={analyticsData.summary} />
        )}

        {selectedView === 'distribution' && (
          <DistributionChart distribution={analyticsData.distribution} />
        )}

        {selectedView === 'heatmap' && (
          <HeatmapSection zones={zones} confidenceScores={confidenceScores} />
        )}

        {selectedView === 'trends' && (
          <TrendsChart trends={analyticsData.trends} />
        )}

        {selectedView === 'tools' && (
          <ToolPerformanceSection
            toolPerformance={analyticsData.toolPerformance}
            selectedTool={selectedTool}
            onToolSelect={setSelectedTool}
          />
        )}
      </div>
    </div>
  );
};

// Overview section component
const OverviewSection: React.FC<{ summary: ConfidenceSummary }> = ({ summary }) => {
  const metrics = [
    {
      label: 'Average Confidence',
      value: `${Math.round(summary.averageConfidence * 100)}%`,
      color: getConfidenceColor(summary.averageConfidence),
      icon: '📊'
    },
    {
      label: 'Total Zones',
      value: summary.totalZones.toString(),
      color: 'text-gray-700',
      icon: '📦'
    },
    {
      label: 'High Confidence',
      value: `${summary.highConfidenceZones} (${Math.round((summary.highConfidenceZones / summary.totalZones) * 100)}%)`,
      color: 'text-green-600',
      icon: '✅'
    },
    {
      label: 'Low Confidence',
      value: `${summary.lowConfidenceZones} (${Math.round((summary.lowConfidenceZones / summary.totalZones) * 100)}%)`,
      color: 'text-red-600',
      icon: '⚠️'
    },
    {
      label: 'Success Rate',
      value: `${Math.round(summary.processingSuccessRate * 100)}%`,
      color: getConfidenceColor(summary.processingSuccessRate),
      icon: '🎯'
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {metrics.map((metric, index) => (
        <div key={index} className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">{metric.label}</span>
            <span className="text-2xl">{metric.icon}</span>
          </div>
          <div className={`text-2xl font-bold ${metric.color}`}>
            {metric.value}
          </div>
        </div>
      ))}
    </div>
  );
};

// Distribution chart component
const DistributionChart: React.FC<{ distribution: ConfidenceDistribution[] }> = ({ distribution }) => {
  const maxCount = Math.max(...distribution.map(d => d.count));

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900">Confidence Distribution</h3>
      
      <div className="space-y-3">
        {distribution.map((item, index) => (
          <div key={index} className="flex items-center gap-4">
            <div className="w-24 text-sm text-gray-600 text-right">{item.range}</div>
            <div className="flex-1 relative">
              <div className="h-8 bg-gray-200 rounded-md overflow-hidden">
                <div
                  className="h-full transition-all duration-500"
                  style={{
                    width: `${(item.count / maxCount) * 100}%`,
                    backgroundColor: getDistributionColor(index, distribution.length)
                  }}
                />
              </div>
              <div className="absolute inset-0 flex items-center px-2">
                <span className="text-sm font-medium text-gray-700">
                  {item.count} zones ({item.percentage}%)
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Summary statistics */}
      <div className="mt-6 pt-6 border-t border-gray-200">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-sm text-gray-600">Median</div>
            <div className="text-lg font-semibold">
              {calculateMedian(distribution)}%
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-600">Mode</div>
            <div className="text-lg font-semibold">
              {calculateMode(distribution)}
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-600">Std Dev</div>
            <div className="text-lg font-semibold">
              {calculateStdDev(distribution).toFixed(1)}%
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Heatmap section component
const HeatmapSection: React.FC<{
  zones: Zone[];
  confidenceScores: Map<string, Map<string, WeightedConfidenceScore>>;
}> = ({ zones, confidenceScores }) => {
  // Calculate zone confidence data
  const confidenceData = useMemo(() => {
    const data = new Map<string, number>();
    
    zones.forEach(zone => {
      const zoneScores = confidenceScores.get(zone.id);
      if (zoneScores) {
        // Calculate average confidence for the zone
        const scores = Array.from(zoneScores.values());
        const avgConfidence = scores.reduce((sum, score) => sum + score.finalScore, 0) / scores.length;
        data.set(zone.id, avgConfidence);
      } else {
        data.set(zone.id, zone.confidence);
      }
    });
    
    return data;
  }, [zones, confidenceScores]);

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900">Zone Confidence Heatmap</h3>
      
      <div className="bg-gray-50 rounded-lg p-4" style={{ minHeight: '400px' }}>
        <ConfidenceHeatmap
          zones={zones}
          confidenceData={confidenceData}
          onZoneClick={(zoneId) => console.log('Zone clicked:', zoneId)}
          colorScale="default"
        />
      </div>
    </div>
  );
};

// Trends chart component
const TrendsChart: React.FC<{ trends: ConfidenceTrend[] }> = ({ trends }) => {
  const maxConfidence = Math.max(...trends.map(t => t.averageConfidence));
  const minConfidence = Math.min(...trends.map(t => t.averageConfidence));

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900">Confidence Trends</h3>
      
      <div className="relative" style={{ height: '300px' }}>
        <svg className="w-full h-full" viewBox="0 0 800 300" preserveAspectRatio="none">
          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map(y => (
            <line
              key={y}
              x1="0"
              y1={300 - y * 300}
              x2="800"
              y2={300 - y * 300}
              stroke="#E5E7EB"
              strokeWidth="1"
            />
          ))}
          
          {/* Trend line */}
          <polyline
            points={trends.map((trend, i) => 
              `${(i / (trends.length - 1)) * 800},${300 - ((trend.averageConfidence - minConfidence) / (maxConfidence - minConfidence)) * 280}`
            ).join(' ')}
            fill="none"
            stroke="#3B82F6"
            strokeWidth="2"
          />
          
          {/* Data points */}
          {trends.map((trend, i) => (
            <circle
              key={i}
              cx={(i / (trends.length - 1)) * 800}
              cy={300 - ((trend.averageConfidence - minConfidence) / (maxConfidence - minConfidence)) * 280}
              r="4"
              fill="#3B82F6"
            />
          ))}
        </svg>
        
        {/* Y-axis labels */}
        <div className="absolute left-0 top-0 h-full flex flex-col justify-between text-xs text-gray-500">
          <span>100%</span>
          <span>75%</span>
          <span>50%</span>
          <span>25%</span>
          <span>0%</span>
        </div>
      </div>
      
      {/* Trend summary */}
      <div className="bg-gray-50 rounded-lg p-4">
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <span className="text-gray-600">Trend:</span>
            <span className={`ml-2 font-medium ${getTrendDirection(trends)}`}>
              {getTrendLabel(trends)}
            </span>
          </div>
          <div>
            <span className="text-gray-600">Change:</span>
            <span className="ml-2 font-medium">
              {getTrendChange(trends)}%
            </span>
          </div>
          <div>
            <span className="text-gray-600">Volatility:</span>
            <span className="ml-2 font-medium">
              {getVolatility(trends)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

// Tool performance section component
const ToolPerformanceSection: React.FC<{
  toolPerformance: ToolPerformanceMetrics[];
  selectedTool: string | null;
  onToolSelect: (tool: string | null) => void;
}> = ({ toolPerformance, selectedTool, onToolSelect }) => {
  const selectedMetrics = selectedTool 
    ? toolPerformance.find(t => t.toolName === selectedTool)
    : null;

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900">Tool Performance Comparison</h3>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tool list */}
        <div className="space-y-2">
          {toolPerformance.map(tool => (
            <div
              key={tool.toolName}
              onClick={() => onToolSelect(tool.toolName === selectedTool ? null : tool.toolName)}
              className={`p-4 rounded-lg border cursor-pointer transition-all ${
                selectedTool === tool.toolName
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium">{tool.toolName}</span>
                <span className={`text-sm font-semibold ${getConfidenceColor(tool.averageConfidence)}`}>
                  {Math.round(tool.averageConfidence * 100)}%
                </span>
              </div>
              
              <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
                <div>Zones: {tool.processedZones}</div>
                <div>Success: {Math.round(tool.successRate * 100)}%</div>
              </div>
              
              <div className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-400 to-blue-600"
                  style={{ width: `${tool.averageConfidence * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
        
        {/* Selected tool details */}
        {selectedMetrics && (
          <div className="bg-gray-50 rounded-lg p-6">
            <h4 className="text-lg font-semibold mb-4">{selectedMetrics.toolName} Details</h4>
            
            <div className="space-y-4">
              <div>
                <div className="text-sm text-gray-600">Average Confidence</div>
                <div className="text-2xl font-bold text-gray-900">
                  {Math.round(selectedMetrics.averageConfidence * 100)}%
                </div>
              </div>
              
              <div>
                <div className="text-sm text-gray-600">Processing Time</div>
                <div className="text-lg font-semibold text-gray-900">
                  {selectedMetrics.averageProcessingTime.toFixed(0)}ms
                </div>
              </div>
              
              <div>
                <div className="text-sm text-gray-600">Efficiency Score</div>
                <div className="text-lg font-semibold text-gray-900">
                  {calculateEfficiencyScore(selectedMetrics).toFixed(1)}/10
                </div>
              </div>
              
              <div className="pt-4 border-t border-gray-200">
                <div className="text-sm text-gray-600 mb-2">Performance Breakdown</div>
                <div className="space-y-2">
                  <PerformanceBar label="Speed" value={1 - (selectedMetrics.averageProcessingTime / 5000)} />
                  <PerformanceBar label="Accuracy" value={selectedMetrics.averageConfidence} />
                  <PerformanceBar label="Reliability" value={selectedMetrics.successRate} />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Performance bar component
const PerformanceBar: React.FC<{ label: string; value: number }> = ({ label, value }) => {
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-gray-600 w-20">{label}</span>
      <div className="flex-1 h-4 bg-gray-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-green-400 to-green-600 transition-all duration-500"
          style={{ width: `${value * 100}%` }}
        />
      </div>
      <span className="text-sm font-medium text-gray-700 w-12 text-right">
        {Math.round(value * 100)}%
      </span>
    </div>
  );
};

// Helper functions
function calculateSummary(zones: Zone[], confidenceScores: Map<string, Map<string, WeightedConfidenceScore>>): ConfidenceSummary {
  let totalConfidence = 0;
  let highConfidenceCount = 0;
  let lowConfidenceCount = 0;
  let successCount = 0;

  zones.forEach(zone => {
    const zoneScores = confidenceScores.get(zone.id);
    let confidence = zone.confidence;
    
    if (zoneScores && zoneScores.size > 0) {
      const scores = Array.from(zoneScores.values());
      confidence = scores.reduce((sum, score) => sum + score.finalScore, 0) / scores.length;
    }
    
    totalConfidence += confidence;
    if (confidence >= 0.8) highConfidenceCount++;
    if (confidence < 0.4) lowConfidenceCount++;
    if (zone.status === 'completed') successCount++;
  });

  return {
    averageConfidence: zones.length > 0 ? totalConfidence / zones.length : 0,
    totalZones: zones.length,
    highConfidenceZones: highConfidenceCount,
    lowConfidenceZones: lowConfidenceCount,
    processingSuccessRate: zones.length > 0 ? successCount / zones.length : 0
  };
}

function calculateDistribution(zones: Zone[], confidenceScores: Map<string, Map<string, WeightedConfidenceScore>>): ConfidenceDistribution[] {
  const ranges = [
    { range: '0-20%', min: 0, max: 0.2 },
    { range: '20-40%', min: 0.2, max: 0.4 },
    { range: '40-60%', min: 0.4, max: 0.6 },
    { range: '60-80%', min: 0.6, max: 0.8 },
    { range: '80-100%', min: 0.8, max: 1.0 }
  ];

  const distribution = ranges.map(range => ({
    range: range.range,
    count: 0,
    percentage: 0
  }));

  zones.forEach(zone => {
    const zoneScores = confidenceScores.get(zone.id);
    let confidence = zone.confidence;
    
    if (zoneScores && zoneScores.size > 0) {
      const scores = Array.from(zoneScores.values());
      confidence = scores.reduce((sum, score) => sum + score.finalScore, 0) / scores.length;
    }

    const rangeIndex = ranges.findIndex(r => confidence >= r.min && confidence < r.max);
    if (rangeIndex !== -1) {
      distribution[rangeIndex].count++;
    }
  });

  // Calculate percentages
  distribution.forEach(item => {
    item.percentage = zones.length > 0 ? Math.round((item.count / zones.length) * 100) : 0;
  });

  return distribution;
}

function calculateToolPerformance(results: ProcessingResult[], confidenceScores: Map<string, Map<string, WeightedConfidenceScore>>): ToolPerformanceMetrics[] {
  const toolMetrics = new Map<string, ToolPerformanceMetrics>();

  results.forEach(result => {
    const existing = toolMetrics.get(result.toolName) || {
      toolName: result.toolName,
      averageConfidence: 0,
      processedZones: 0,
      successRate: 0,
      averageProcessingTime: 0,
      totalConfidence: 0,
      successCount: 0,
      totalTime: 0
    };

    existing.processedZones++;
    existing.totalTime += result.processingTime;
    
    if (result.status === 'success') {
      existing.successCount++;
    }

    // Get confidence score for this result
    const zoneScores = confidenceScores.get(result.zoneId || '');
    if (zoneScores) {
      const score = zoneScores.get(result.toolName);
      if (score) {
        existing.totalConfidence += score.finalScore;
      }
    }

    toolMetrics.set(result.toolName, existing);
  });

  // Calculate averages
  return Array.from(toolMetrics.values()).map(metrics => ({
    toolName: metrics.toolName,
    averageConfidence: metrics.processedZones > 0 ? metrics.totalConfidence / metrics.processedZones : 0,
    processedZones: metrics.processedZones,
    successRate: metrics.processedZones > 0 ? metrics.successCount / metrics.processedZones : 0,
    averageProcessingTime: metrics.processedZones > 0 ? metrics.totalTime / metrics.processedZones : 0
  }));
}

function generateTrends(zones: Zone[], confidenceScores: Map<string, Map<string, WeightedConfidenceScore>>, timeRange: string): ConfidenceTrend[] {
  // This is a mock implementation - in real app, this would use actual historical data
  const trends: ConfidenceTrend[] = [];
  const points = timeRange === '1h' ? 12 : timeRange === '24h' ? 24 : timeRange === '7d' ? 7 : 30;
  
  for (let i = 0; i < points; i++) {
    const timestamp = new Date();
    timestamp.setHours(timestamp.getHours() - (points - i));
    
    trends.push({
      timestamp,
      averageConfidence: 0.6 + Math.random() * 0.3,
      zoneCount: Math.floor(zones.length * (0.8 + Math.random() * 0.2))
    });
  }
  
  return trends;
}

// Utility functions
function getConfidenceColor(confidence: number): string {
  if (confidence >= 0.8) return 'text-green-600';
  if (confidence >= 0.6) return 'text-blue-600';
  if (confidence >= 0.4) return 'text-yellow-600';
  return 'text-red-600';
}

function getDistributionColor(index: number, total: number): string {
  const colors = ['#EF4444', '#F97316', '#EAB308', '#3B82F6', '#10B981'];
  return colors[index] || '#6B7280';
}

function calculateMedian(distribution: ConfidenceDistribution[]): number {
  // Simplified median calculation
  const total = distribution.reduce((sum, d) => sum + d.count, 0);
  let cumulative = 0;
  
  for (const d of distribution) {
    cumulative += d.count;
    if (cumulative >= total / 2) {
      return parseInt(d.range.split('-')[0]);
    }
  }
  
  return 50;
}

function calculateMode(distribution: ConfidenceDistribution[]): string {
  const maxCount = Math.max(...distribution.map(d => d.count));
  const mode = distribution.find(d => d.count === maxCount);
  return mode?.range || 'N/A';
}

function calculateStdDev(distribution: ConfidenceDistribution[]): number {
  // Simplified standard deviation calculation
  return 15.5; // Mock value
}

function getTrendDirection(trends: ConfidenceTrend[]): string {
  if (trends.length < 2) return 'text-gray-600';
  
  const first = trends[0].averageConfidence;
  const last = trends[trends.length - 1].averageConfidence;
  
  if (last > first * 1.05) return 'text-green-600';
  if (last < first * 0.95) return 'text-red-600';
  return 'text-gray-600';
}

function getTrendLabel(trends: ConfidenceTrend[]): string {
  if (trends.length < 2) return 'Stable';
  
  const first = trends[0].averageConfidence;
  const last = trends[trends.length - 1].averageConfidence;
  
  if (last > first * 1.05) return 'Improving';
  if (last < first * 0.95) return 'Declining';
  return 'Stable';
}

function getTrendChange(trends: ConfidenceTrend[]): string {
  if (trends.length < 2) return '0';
  
  const first = trends[0].averageConfidence;
  const last = trends[trends.length - 1].averageConfidence;
  const change = ((last - first) / first) * 100;
  
  return (change >= 0 ? '+' : '') + change.toFixed(1);
}

function getVolatility(trends: ConfidenceTrend[]): string {
  // Calculate standard deviation of changes
  if (trends.length < 2) return 'Low';
  
  const changes = [];
  for (let i = 1; i < trends.length; i++) {
    changes.push(Math.abs(trends[i].averageConfidence - trends[i-1].averageConfidence));
  }
  
  const avgChange = changes.reduce((sum, c) => sum + c, 0) / changes.length;
  
  if (avgChange < 0.02) return 'Low';
  if (avgChange < 0.05) return 'Medium';
  return 'High';
}

function calculateEfficiencyScore(metrics: ToolPerformanceMetrics): number {
  // Weighted score: 40% confidence, 30% success rate, 30% speed
  const speedScore = Math.max(0, 1 - (metrics.averageProcessingTime / 5000));
  const score = (metrics.averageConfidence * 0.4) + (metrics.successRate * 0.3) + (speedScore * 0.3);
  return score * 10;
}

export default ConfidenceAnalytics;