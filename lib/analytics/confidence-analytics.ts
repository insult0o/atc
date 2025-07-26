import { Zone } from '../../app/components/zones/ZoneManager';
import { ProcessingResult } from '../pdf-processing/processing-queue';
import { WeightedConfidenceScore } from '../pdf-processing/confidence-weighting';
import { ToolConfidenceScore } from '../pdf-processing/tool-confidence';
import { ContentType } from '../pdf-processing/content-analyzer';

// Comprehensive confidence analytics system
export interface ConfidenceAnalytics {
  id: string;
  timestamp: Date;
  sessionId: string;
  documentId: string;
  overallMetrics: OverallConfidenceMetrics;
  toolMetrics: Map<string, ToolPerformanceMetrics>;
  contentTypeMetrics: Map<ContentType, ContentTypeMetrics>;
  trends: ConfidenceTrends;
  qualityAlerts: QualityAlert[];
  optimizationSuggestions: OptimizationSuggestion[];
  auditTrail: AuditEntry[];
}

export interface OverallConfidenceMetrics {
  averageConfidence: number;
  medianConfidence: number;
  standardDeviation: number;
  confidenceDistribution: ConfidenceDistribution;
  totalProcessedZones: number;
  successRate: number;
  processingTime: ProcessingTimeMetrics;
  qualityScore: number;
}

export interface ConfidenceDistribution {
  veryLow: number;    // 0-20%
  low: number;        // 20-40%
  medium: number;     // 40-60%
  high: number;       // 60-80%
  veryHigh: number;   // 80-100%
}

export interface ProcessingTimeMetrics {
  average: number;
  median: number;
  p95: number;
  p99: number;
  min: number;
  max: number;
}

export interface ToolPerformanceMetrics {
  toolName: string;
  usageCount: number;
  averageConfidence: number;
  successRate: number;
  averageProcessingTime: number;
  errorRate: number;
  fallbackRate: number;
  confidenceTrend: TrendDirection;
  strengthAreas: ContentType[];
  weaknessAreas: ContentType[];
}

export interface ContentTypeMetrics {
  contentType: ContentType;
  processedCount: number;
  averageConfidence: number;
  bestPerformingTool: string;
  worstPerformingTool: string;
  confidenceRange: { min: number; max: number };
  improvementRate: number;
}

export interface ConfidenceTrends {
  shortTerm: TrendAnalysis;   // Last 24 hours
  mediumTerm: TrendAnalysis;  // Last 7 days
  longTerm: TrendAnalysis;    // Last 30 days
  predictions: TrendPrediction[];
}

export interface TrendAnalysis {
  direction: TrendDirection;
  changePercentage: number;
  volatility: number;
  consistencyScore: number;
  significantEvents: TrendEvent[];
}

export type TrendDirection = 'improving' | 'stable' | 'declining' | 'volatile';

export interface TrendEvent {
  timestamp: Date;
  eventType: 'spike' | 'drop' | 'plateau' | 'recovery';
  magnitude: number;
  affectedTools: string[];
  possibleCause?: string;
}

export interface TrendPrediction {
  timeframe: string;
  predictedConfidence: number;
  confidenceInterval: { lower: number; upper: number };
  reliability: number;
  assumptions: string[];
}

export interface QualityAlert {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  type: AlertType;
  message: string;
  affectedTools: string[];
  affectedContentTypes: ContentType[];
  timestamp: Date;
  resolved: boolean;
  recommendations: string[];
}

export type AlertType = 
  | 'low_confidence_trend'
  | 'high_error_rate'
  | 'tool_degradation'
  | 'processing_slowdown'
  | 'quality_threshold_breach'
  | 'inconsistent_results'
  | 'calibration_drift';

export interface OptimizationSuggestion {
  id: string;
  priority: 'high' | 'medium' | 'low';
  category: OptimizationCategory;
  title: string;
  description: string;
  expectedImpact: {
    confidenceImprovement: number;
    processingTimeReduction: number;
    errorRateReduction: number;
  };
  implementation: string[];
  effort: 'low' | 'medium' | 'high';
}

export type OptimizationCategory = 
  | 'tool_configuration'
  | 'threshold_adjustment'
  | 'workflow_optimization'
  | 'tool_selection'
  | 'parallel_processing'
  | 'caching_strategy'
  | 'model_update';

export interface AuditEntry {
  id: string;
  timestamp: Date;
  action: AuditAction;
  actor: string;
  details: Record<string, any>;
  impact: AuditImpact;
}

export type AuditAction = 
  | 'threshold_change'
  | 'tool_enable_disable'
  | 'configuration_update'
  | 'manual_override'
  | 'calibration_update'
  | 'system_optimization';

export interface AuditImpact {
  affectedZones: number;
  confidenceChange: number;
  performanceChange: number;
}

// Analytics Engine
export class ConfidenceAnalyticsEngine {
  private analyticsData: Map<string, ConfidenceAnalytics> = new Map();
  private historicalData: AnalyticsHistoricalData[] = [];
  private alertThresholds: AlertThresholds;
  private optimizationEngine: OptimizationEngine;

  constructor() {
    this.alertThresholds = this.getDefaultAlertThresholds();
    this.optimizationEngine = new OptimizationEngine();
  }

  // Generate comprehensive analytics
  public generateAnalytics(
    sessionId: string,
    documentId: string,
    results: ProcessingResult[],
    confidenceScores: Map<string, WeightedConfidenceScore>,
    zones: Zone[]
  ): ConfidenceAnalytics {
    const analytics: ConfidenceAnalytics = {
      id: this.generateAnalyticsId(),
      timestamp: new Date(),
      sessionId,
      documentId,
      overallMetrics: this.calculateOverallMetrics(results, confidenceScores),
      toolMetrics: this.calculateToolMetrics(results, confidenceScores),
      contentTypeMetrics: this.calculateContentTypeMetrics(results, confidenceScores, zones),
      trends: this.analyzeTrends(),
      qualityAlerts: this.detectQualityAlerts(results, confidenceScores),
      optimizationSuggestions: this.generateOptimizationSuggestions(results, confidenceScores),
      auditTrail: []
    };

    this.analyticsData.set(analytics.id, analytics);
    this.updateHistoricalData(analytics);

    return analytics;
  }

  // Calculate overall confidence metrics
  private calculateOverallMetrics(
    results: ProcessingResult[],
    confidenceScores: Map<string, WeightedConfidenceScore>
  ): OverallConfidenceMetrics {
    const confidenceValues = Array.from(confidenceScores.values())
      .map(score => score.finalScore);

    const successfulResults = results.filter(r => r.status === 'completed').length;
    const processingTimes = results.map(r => r.processingTime);

    return {
      averageConfidence: this.calculateAverage(confidenceValues),
      medianConfidence: this.calculateMedian(confidenceValues),
      standardDeviation: this.calculateStandardDeviation(confidenceValues),
      confidenceDistribution: this.calculateDistribution(confidenceValues),
      totalProcessedZones: results.length,
      successRate: successfulResults / results.length,
      processingTime: this.calculateProcessingTimeMetrics(processingTimes),
      qualityScore: this.calculateQualityScore(results, confidenceScores)
    };
  }

  // Calculate tool-specific performance metrics
  private calculateToolMetrics(
    results: ProcessingResult[],
    confidenceScores: Map<string, WeightedConfidenceScore>
  ): Map<string, ToolPerformanceMetrics> {
    const toolMetrics = new Map<string, ToolPerformanceMetrics>();
    const toolGroups = this.groupByTool(results);

    toolGroups.forEach((toolResults, toolName) => {
      const confidences = toolResults
        .map(r => confidenceScores.get(toolName)?.finalScore || 0)
        .filter(c => c > 0);

      const successCount = toolResults.filter(r => r.status === 'completed').length;
      const errorCount = toolResults.filter(r => r.status === 'failed').length;
      const fallbackCount = toolResults.filter(r => r.metadata?.isFallback).length;

      toolMetrics.set(toolName, {
        toolName,
        usageCount: toolResults.length,
        averageConfidence: this.calculateAverage(confidences),
        successRate: successCount / toolResults.length,
        averageProcessingTime: this.calculateAverage(
          toolResults.map(r => r.processingTime)
        ),
        errorRate: errorCount / toolResults.length,
        fallbackRate: fallbackCount / toolResults.length,
        confidenceTrend: this.calculateTrend(toolName),
        strengthAreas: this.identifyStrengthAreas(toolName, results, confidenceScores),
        weaknessAreas: this.identifyWeaknessAreas(toolName, results, confidenceScores)
      });
    });

    return toolMetrics;
  }

  // Calculate content type specific metrics
  private calculateContentTypeMetrics(
    results: ProcessingResult[],
    confidenceScores: Map<string, WeightedConfidenceScore>,
    zones: Zone[]
  ): Map<ContentType, ContentTypeMetrics> {
    const contentMetrics = new Map<ContentType, ContentTypeMetrics>();
    const contentTypes: ContentType[] = ['text', 'table', 'image', 'chart', 'mixed'];

    contentTypes.forEach(contentType => {
      const relevantZones = zones.filter(z => z.type === contentType);
      const relevantResults = results.filter((r, idx) => 
        zones[idx]?.type === contentType
      );

      if (relevantResults.length === 0) return;

      const toolConfidences = new Map<string, number[]>();
      relevantResults.forEach(result => {
        const confidence = confidenceScores.get(result.toolName)?.finalScore || 0;
        if (!toolConfidences.has(result.toolName)) {
          toolConfidences.set(result.toolName, []);
        }
        toolConfidences.get(result.toolName)!.push(confidence);
      });

      const avgConfidenceByTool = new Map<string, number>();
      toolConfidences.forEach((confidences, tool) => {
        avgConfidenceByTool.set(tool, this.calculateAverage(confidences));
      });

      const sortedTools = Array.from(avgConfidenceByTool.entries())
        .sort((a, b) => b[1] - a[1]);

      const allConfidences = Array.from(toolConfidences.values()).flat();

      contentMetrics.set(contentType, {
        contentType,
        processedCount: relevantResults.length,
        averageConfidence: this.calculateAverage(allConfidences),
        bestPerformingTool: sortedTools[0]?.[0] || 'none',
        worstPerformingTool: sortedTools[sortedTools.length - 1]?.[0] || 'none',
        confidenceRange: {
          min: Math.min(...allConfidences),
          max: Math.max(...allConfidences)
        },
        improvementRate: this.calculateImprovementRate(contentType)
      });
    });

    return contentMetrics;
  }

  // Analyze confidence trends
  private analyzeTrends(): ConfidenceTrends {
    return {
      shortTerm: this.analyzeTrendPeriod(24 * 60 * 60 * 1000), // 24 hours
      mediumTerm: this.analyzeTrendPeriod(7 * 24 * 60 * 60 * 1000), // 7 days
      longTerm: this.analyzeTrendPeriod(30 * 24 * 60 * 60 * 1000), // 30 days
      predictions: this.generatePredictions()
    };
  }

  // Analyze trends for a specific period
  private analyzeTrendPeriod(periodMs: number): TrendAnalysis {
    const now = Date.now();
    const relevantData = this.historicalData.filter(
      data => now - data.timestamp.getTime() <= periodMs
    );

    if (relevantData.length < 2) {
      return {
        direction: 'stable',
        changePercentage: 0,
        volatility: 0,
        consistencyScore: 1,
        significantEvents: []
      };
    }

    const confidences = relevantData.map(d => d.averageConfidence);
    const firstHalf = confidences.slice(0, Math.floor(confidences.length / 2));
    const secondHalf = confidences.slice(Math.floor(confidences.length / 2));

    const firstAvg = this.calculateAverage(firstHalf);
    const secondAvg = this.calculateAverage(secondHalf);
    const changePercentage = ((secondAvg - firstAvg) / firstAvg) * 100;

    const volatility = this.calculateVolatility(confidences);
    const consistencyScore = 1 - volatility;

    let direction: TrendDirection;
    if (Math.abs(changePercentage) < 5) {
      direction = volatility > 0.3 ? 'volatile' : 'stable';
    } else {
      direction = changePercentage > 0 ? 'improving' : 'declining';
    }

    return {
      direction,
      changePercentage,
      volatility,
      consistencyScore,
      significantEvents: this.detectSignificantEvents(relevantData)
    };
  }

  // Detect quality alerts
  private detectQualityAlerts(
    results: ProcessingResult[],
    confidenceScores: Map<string, WeightedConfidenceScore>
  ): QualityAlert[] {
    const alerts: QualityAlert[] = [];

    // Check for low confidence trend
    const avgConfidence = this.calculateAverage(
      Array.from(confidenceScores.values()).map(s => s.finalScore)
    );
    
    if (avgConfidence < this.alertThresholds.lowConfidence) {
      alerts.push({
        id: this.generateAlertId(),
        severity: 'high',
        type: 'low_confidence_trend',
        message: `Average confidence (${(avgConfidence * 100).toFixed(1)}%) is below threshold`,
        affectedTools: Array.from(confidenceScores.keys()),
        affectedContentTypes: ['text', 'table', 'image', 'chart', 'mixed'],
        timestamp: new Date(),
        resolved: false,
        recommendations: [
          'Review tool configurations',
          'Check document quality',
          'Consider alternative tools',
          'Verify zone detection accuracy'
        ]
      });
    }

    // Check for high error rate
    const errorRate = results.filter(r => r.status === 'failed').length / results.length;
    if (errorRate > this.alertThresholds.highErrorRate) {
      alerts.push({
        id: this.generateAlertId(),
        severity: 'critical',
        type: 'high_error_rate',
        message: `Error rate (${(errorRate * 100).toFixed(1)}%) exceeds threshold`,
        affectedTools: results
          .filter(r => r.status === 'failed')
          .map(r => r.toolName),
        affectedContentTypes: ['text', 'table', 'image', 'chart', 'mixed'],
        timestamp: new Date(),
        resolved: false,
        recommendations: [
          'Check tool availability',
          'Review error logs',
          'Verify API credentials',
          'Implement retry logic'
        ]
      });
    }

    return alerts;
  }

  // Generate optimization suggestions
  private generateOptimizationSuggestions(
    results: ProcessingResult[],
    confidenceScores: Map<string, WeightedConfidenceScore>
  ): OptimizationSuggestion[] {
    return this.optimizationEngine.generateSuggestions(
      results,
      confidenceScores,
      this.historicalData
    );
  }

  // Helper methods
  private calculateAverage(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  private calculateMedian(values: number[]): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];
  }

  private calculateStandardDeviation(values: number[]): number {
    if (values.length === 0) return 0;
    const avg = this.calculateAverage(values);
    const squaredDiffs = values.map(val => Math.pow(val - avg, 2));
    return Math.sqrt(this.calculateAverage(squaredDiffs));
  }

  private calculateDistribution(values: number[]): ConfidenceDistribution {
    const distribution: ConfidenceDistribution = {
      veryLow: 0,
      low: 0,
      medium: 0,
      high: 0,
      veryHigh: 0
    };

    values.forEach(value => {
      if (value >= 0.8) distribution.veryHigh++;
      else if (value >= 0.6) distribution.high++;
      else if (value >= 0.4) distribution.medium++;
      else if (value >= 0.2) distribution.low++;
      else distribution.veryLow++;
    });

    // Convert to percentages
    const total = values.length || 1;
    Object.keys(distribution).forEach(key => {
      distribution[key as keyof ConfidenceDistribution] = 
        (distribution[key as keyof ConfidenceDistribution] / total) * 100;
    });

    return distribution;
  }

  private calculateProcessingTimeMetrics(times: number[]): ProcessingTimeMetrics {
    if (times.length === 0) {
      return {
        average: 0,
        median: 0,
        p95: 0,
        p99: 0,
        min: 0,
        max: 0
      };
    }

    const sorted = [...times].sort((a, b) => a - b);
    return {
      average: this.calculateAverage(times),
      median: this.calculateMedian(times),
      p95: sorted[Math.floor(sorted.length * 0.95)] || sorted[sorted.length - 1],
      p99: sorted[Math.floor(sorted.length * 0.99)] || sorted[sorted.length - 1],
      min: sorted[0],
      max: sorted[sorted.length - 1]
    };
  }

  private calculateQualityScore(
    results: ProcessingResult[],
    confidenceScores: Map<string, WeightedConfidenceScore>
  ): number {
    const factors = {
      avgConfidence: this.calculateAverage(
        Array.from(confidenceScores.values()).map(s => s.finalScore)
      ),
      successRate: results.filter(r => r.status === 'completed').length / results.length,
      processingEfficiency: 1 - (
        this.calculateAverage(results.map(r => r.processingTime)) / 10000
      ), // Normalize to 10 seconds
      consistencyScore: 1 - this.calculateVolatility(
        Array.from(confidenceScores.values()).map(s => s.finalScore)
      )
    };

    // Weighted quality score
    return (
      factors.avgConfidence * 0.4 +
      factors.successRate * 0.3 +
      factors.processingEfficiency * 0.15 +
      factors.consistencyScore * 0.15
    );
  }

  private calculateVolatility(values: number[]): number {
    if (values.length < 2) return 0;
    const stdDev = this.calculateStandardDeviation(values);
    const avg = this.calculateAverage(values);
    return avg > 0 ? stdDev / avg : 0; // Coefficient of variation
  }

  private groupByTool(results: ProcessingResult[]): Map<string, ProcessingResult[]> {
    const groups = new Map<string, ProcessingResult[]>();
    results.forEach(result => {
      if (!groups.has(result.toolName)) {
        groups.set(result.toolName, []);
      }
      groups.get(result.toolName)!.push(result);
    });
    return groups;
  }

  private calculateTrend(toolName: string): TrendDirection {
    // Simplified trend calculation - in production, use historical data
    return 'stable';
  }

  private identifyStrengthAreas(
    toolName: string,
    results: ProcessingResult[],
    confidenceScores: Map<string, WeightedConfidenceScore>
  ): ContentType[] {
    // Identify content types where this tool performs well
    return ['text']; // Simplified - implement based on actual performance
  }

  private identifyWeaknessAreas(
    toolName: string,
    results: ProcessingResult[],
    confidenceScores: Map<string, WeightedConfidenceScore>
  ): ContentType[] {
    // Identify content types where this tool performs poorly
    return []; // Simplified - implement based on actual performance
  }

  private calculateImprovementRate(contentType: ContentType): number {
    // Calculate improvement rate over time for this content type
    return 0.05; // 5% improvement - simplified
  }

  private detectSignificantEvents(data: AnalyticsHistoricalData[]): TrendEvent[] {
    // Detect spikes, drops, etc. in the data
    return []; // Simplified implementation
  }

  private generatePredictions(): TrendPrediction[] {
    // Generate predictions based on historical trends
    return [{
      timeframe: 'Next 24 hours',
      predictedConfidence: 0.75,
      confidenceInterval: { lower: 0.70, upper: 0.80 },
      reliability: 0.85,
      assumptions: [
        'Current tool configuration remains stable',
        'Document quality remains consistent',
        'No major system changes'
      ]
    }];
  }

  private updateHistoricalData(analytics: ConfidenceAnalytics): void {
    this.historicalData.push({
      timestamp: analytics.timestamp,
      averageConfidence: analytics.overallMetrics.averageConfidence,
      documentId: analytics.documentId,
      qualityScore: analytics.overallMetrics.qualityScore
    });

    // Keep only last 30 days of data
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    this.historicalData = this.historicalData.filter(
      data => data.timestamp.getTime() > thirtyDaysAgo
    );
  }

  private getDefaultAlertThresholds(): AlertThresholds {
    return {
      lowConfidence: 0.5,
      highErrorRate: 0.2,
      slowProcessing: 5000, // 5 seconds
      inconsistencyThreshold: 0.3
    };
  }

  private generateAnalyticsId(): string {
    return `analytics_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateAlertId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Public methods for external access
  public getAnalytics(id: string): ConfidenceAnalytics | undefined {
    return this.analyticsData.get(id);
  }

  public getHistoricalTrends(period: 'day' | 'week' | 'month'): TrendAnalysis {
    const periodMs = {
      day: 24 * 60 * 60 * 1000,
      week: 7 * 24 * 60 * 60 * 1000,
      month: 30 * 24 * 60 * 60 * 1000
    };
    return this.analyzeTrendPeriod(periodMs[period]);
  }

  public exportAnalyticsReport(
    sessionId: string,
    format: 'json' | 'csv' | 'pdf'
  ): string | Blob {
    const sessionAnalytics = Array.from(this.analyticsData.values())
      .filter(a => a.sessionId === sessionId);

    switch (format) {
      case 'json':
        return JSON.stringify(sessionAnalytics, null, 2);
      case 'csv':
        return this.convertToCSV(sessionAnalytics);
      case 'pdf':
        return this.generatePDFReport(sessionAnalytics);
    }
  }

  private convertToCSV(analytics: ConfidenceAnalytics[]): string {
    // Simplified CSV conversion
    const headers = [
      'Timestamp',
      'Document ID',
      'Average Confidence',
      'Success Rate',
      'Quality Score'
    ];
    
    const rows = analytics.map(a => [
      a.timestamp.toISOString(),
      a.documentId,
      a.overallMetrics.averageConfidence.toFixed(3),
      a.overallMetrics.successRate.toFixed(3),
      a.overallMetrics.qualityScore.toFixed(3)
    ]);

    return [headers, ...rows].map(row => row.join(',')).join('\n');
  }

  private generatePDFReport(analytics: ConfidenceAnalytics[]): Blob {
    // Placeholder for PDF generation
    const content = JSON.stringify(analytics, null, 2);
    return new Blob([content], { type: 'application/pdf' });
  }
}

// Supporting interfaces
interface AlertThresholds {
  lowConfidence: number;
  highErrorRate: number;
  slowProcessing: number;
  inconsistencyThreshold: number;
}

interface AnalyticsHistoricalData {
  timestamp: Date;
  averageConfidence: number;
  documentId: string;
  qualityScore: number;
}

// Optimization Engine
class OptimizationEngine {
  generateSuggestions(
    results: ProcessingResult[],
    confidenceScores: Map<string, WeightedConfidenceScore>,
    historicalData: AnalyticsHistoricalData[]
  ): OptimizationSuggestion[] {
    const suggestions: OptimizationSuggestion[] = [];

    // Check for parallel processing opportunities
    const avgProcessingTime = results.reduce((sum, r) => sum + r.processingTime, 0) / results.length;
    if (avgProcessingTime > 2000) {
      suggestions.push({
        id: this.generateSuggestionId(),
        priority: 'high',
        category: 'parallel_processing',
        title: 'Enable Parallel Processing',
        description: 'Processing times are high. Enable parallel processing for independent zones.',
        expectedImpact: {
          confidenceImprovement: 0,
          processingTimeReduction: 0.5,
          errorRateReduction: 0
        },
        implementation: [
          'Configure parallel processing in orchestrator',
          'Set appropriate concurrency limits',
          'Monitor resource usage'
        ],
        effort: 'low'
      });
    }

    // Check for tool selection optimization
    const toolPerformance = this.analyzeToolPerformance(results, confidenceScores);
    toolPerformance.forEach((perf, contentType) => {
      if (perf.improvementPotential > 0.1) {
        suggestions.push({
          id: this.generateSuggestionId(),
          priority: 'medium',
          category: 'tool_selection',
          title: `Optimize Tool Selection for ${contentType}`,
          description: `Switch primary tool for ${contentType} content to ${perf.recommendedTool}`,
          expectedImpact: {
            confidenceImprovement: perf.improvementPotential,
            processingTimeReduction: 0,
            errorRateReduction: 0
          },
          implementation: [
            `Update tool priorities for ${contentType}`,
            `Adjust confidence thresholds`,
            'Test with sample documents'
          ],
          effort: 'medium'
        });
      }
    });

    return suggestions;
  }

  private analyzeToolPerformance(
    results: ProcessingResult[],
    confidenceScores: Map<string, WeightedConfidenceScore>
  ): Map<string, { recommendedTool: string; improvementPotential: number }> {
    // Simplified analysis - in production, use more sophisticated algorithms
    return new Map([
      ['text', { recommendedTool: 'gpt-4-vision', improvementPotential: 0.15 }]
    ]);
  }

  private generateSuggestionId(): string {
    return `suggestion_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Export singleton instance
export const confidenceAnalytics = new ConfidenceAnalyticsEngine();