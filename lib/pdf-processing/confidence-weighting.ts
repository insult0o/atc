import { z } from 'zod';
import { ToolConfidenceScore, ContentType, ContentTypeSchema } from './tool-confidence';

// Types and Schemas
export const WeightingFactorSchema = z.object({
  toolPriority: z.number().min(0).max(1),
  historicalPerformance: z.number().min(0).max(1),
  contentTypeMatch: z.number().min(0).max(1),
  successPattern: z.number().min(0).max(1),
  recency: z.number().min(0).max(1),
});

export type WeightingFactor = z.infer<typeof WeightingFactorSchema>;

export const WeightedConfidenceSchema = z.object({
  toolId: z.string(),
  rawConfidence: z.number(),
  weightedConfidence: z.number(),
  weights: WeightingFactorSchema,
  factors: z.object({
    toolPriority: z.number(),
    historicalPerformance: z.number(),
    contentTypeMatch: z.number(),
    successPattern: z.number(),
    recencyBonus: z.number(),
  }),
  trend: z.enum(['improving', 'stable', 'declining']),
  recommendation: z.string(),
});

export type WeightedConfidence = z.infer<typeof WeightedConfidenceSchema>;

export const HistoricalPerformanceSchema = z.object({
  toolId: z.string(),
  contentType: ContentTypeSchema,
  successRate: z.number(),
  averageConfidence: z.number(),
  totalAttempts: z.number(),
  lastUpdated: z.date(),
});

export type HistoricalPerformance = z.infer<typeof HistoricalPerformanceSchema>;

export const SuccessPatternSchema = z.object({
  pattern: z.string(),
  confidence: z.number(),
  occurrences: z.number(),
  lastSeen: z.date(),
});

export type SuccessPattern = z.infer<typeof SuccessPatternSchema>;

// Tool Priority Configuration
const TOOL_PRIORITIES: Record<string, Record<ContentType, number>> = {
  'gpt-4-vision': {
    text: 0.9,
    table: 0.85,
    chart: 0.95,
    diagram: 0.95,
    image: 0.9,
    mixed: 0.9,
  },
  'gpt-4': {
    text: 0.95,
    table: 0.8,
    chart: 0.7,
    diagram: 0.7,
    image: 0.5,
    mixed: 0.85,
  },
  'claude-3': {
    text: 0.93,
    table: 0.82,
    chart: 0.72,
    diagram: 0.73,
    image: 0.55,
    mixed: 0.87,
  },
  'textract': {
    text: 0.85,
    table: 0.9,
    chart: 0.6,
    diagram: 0.6,
    image: 0.7,
    mixed: 0.75,
  },
  'tesseract': {
    text: 0.8,
    table: 0.7,
    chart: 0.5,
    diagram: 0.5,
    image: 0.6,
    mixed: 0.65,
  },
};

// Default weights for different scenarios
const DEFAULT_WEIGHTS: Record<string, WeightingFactor> = {
  balanced: {
    toolPriority: 0.2,
    historicalPerformance: 0.3,
    contentTypeMatch: 0.2,
    successPattern: 0.2,
    recency: 0.1,
  },
  priorityFocused: {
    toolPriority: 0.4,
    historicalPerformance: 0.2,
    contentTypeMatch: 0.2,
    successPattern: 0.1,
    recency: 0.1,
  },
  performanceDriven: {
    toolPriority: 0.1,
    historicalPerformance: 0.4,
    contentTypeMatch: 0.2,
    successPattern: 0.2,
    recency: 0.1,
  },
  adaptive: {
    toolPriority: 0.15,
    historicalPerformance: 0.35,
    contentTypeMatch: 0.25,
    successPattern: 0.15,
    recency: 0.1,
  },
};

export class ConfidenceWeightingEngine {
  private historicalData: Map<string, HistoricalPerformance[]> = new Map();
  private successPatterns: Map<string, SuccessPattern[]> = new Map();
  private performanceTrends: Map<string, number[]> = new Map();

  constructor(
    private weights: WeightingFactor = DEFAULT_WEIGHTS.balanced
  ) {}

  /**
   * Calculate weighted confidence for a tool's result
   */
  calculateWeightedConfidence(
    confidence: ToolConfidenceScore,
    contentType: ContentType,
    options?: {
      weights?: WeightingFactor;
      historicalData?: HistoricalPerformance[];
      patterns?: SuccessPattern[];
    }
  ): WeightedConfidence {
    const weights = options?.weights || this.weights;
    
    // Calculate individual factors
    const toolPriority = this.getToolPriority(confidence.toolId, contentType);
    const historicalPerformance = this.getHistoricalPerformance(
      confidence.toolId,
      contentType,
      options?.historicalData
    );
    const contentTypeMatch = this.getContentTypeMatch(
      confidence.toolId,
      contentType
    );
    const successPattern = this.getSuccessPatternScore(
      confidence.toolId,
      confidence.score,
      options?.patterns
    );
    const recencyBonus = this.getRecencyBonus(confidence.timestamp);

    // Calculate weighted confidence
    const weightedConfidence = 
      confidence.score * weights.toolPriority * toolPriority +
      confidence.score * weights.historicalPerformance * historicalPerformance +
      confidence.score * weights.contentTypeMatch * contentTypeMatch +
      confidence.score * weights.successPattern * successPattern +
      confidence.score * weights.recency * recencyBonus;

    const normalizedConfidence = Math.min(1, weightedConfidence);

    // Analyze trend
    const trend = this.analyzeTrend(confidence.toolId, normalizedConfidence);

    // Generate recommendation
    const recommendation = this.generateRecommendation(
      confidence.toolId,
      normalizedConfidence,
      trend,
      {
        toolPriority,
        historicalPerformance,
        contentTypeMatch,
        successPattern,
        recencyBonus,
      }
    );

    return {
      toolId: confidence.toolId,
      rawConfidence: confidence.score,
      weightedConfidence: normalizedConfidence,
      weights,
      factors: {
        toolPriority,
        historicalPerformance,
        contentTypeMatch,
        successPattern,
        recencyBonus,
      },
      trend,
      recommendation,
    };
  }

  /**
   * Calculate weighted confidence for multiple tools and rank them
   */
  rankToolsByWeightedConfidence(
    confidenceScores: ToolConfidenceScore[],
    contentType: ContentType,
    options?: {
      weights?: WeightingFactor;
      topN?: number;
    }
  ): WeightedConfidence[] {
    const weighted = confidenceScores.map(score =>
      this.calculateWeightedConfidence(score, contentType, options)
    );

    // Sort by weighted confidence (descending)
    weighted.sort((a, b) => b.weightedConfidence - a.weightedConfidence);

    return options?.topN ? weighted.slice(0, options.topN) : weighted;
  }

  /**
   * Optimize weights based on historical performance
   */
  optimizeWeights(
    performanceData: Array<{
      toolId: string;
      contentType: ContentType;
      actualSuccess: boolean;
      predictedConfidence: number;
    }>
  ): WeightingFactor {
    // Simple gradient descent optimization
    const currentWeights = { ...this.weights };
    const learningRate = 0.01;
    const iterations = 100;

    for (let i = 0; i < iterations; i++) {
      const gradients = this.calculateGradients(performanceData, currentWeights);
      
      // Update weights
      Object.keys(currentWeights).forEach(key => {
        const k = key as keyof WeightingFactor;
        currentWeights[k] = Math.max(0, Math.min(1, 
          currentWeights[k] - learningRate * gradients[k]
        ));
      });

      // Normalize weights to sum to 1
      const sum = Object.values(currentWeights).reduce((a, b) => a + b, 0);
      Object.keys(currentWeights).forEach(key => {
        const k = key as keyof WeightingFactor;
        currentWeights[k] = currentWeights[k] / sum;
      });
    }

    return currentWeights;
  }

  /**
   * Update historical performance data
   */
  updateHistoricalPerformance(
    toolId: string,
    contentType: ContentType,
    success: boolean,
    confidence: number
  ): void {
    const key = `${toolId}-${contentType}`;
    const history = this.historicalData.get(key) || [];
    
    const existing = history.find(h => h.toolId === toolId);
    if (existing) {
      existing.totalAttempts++;
      existing.successRate = (existing.successRate * (existing.totalAttempts - 1) + 
        (success ? 1 : 0)) / existing.totalAttempts;
      existing.averageConfidence = (existing.averageConfidence * 
        (existing.totalAttempts - 1) + confidence) / existing.totalAttempts;
      existing.lastUpdated = new Date();
    } else {
      history.push({
        toolId,
        contentType,
        successRate: success ? 1 : 0,
        averageConfidence: confidence,
        totalAttempts: 1,
        lastUpdated: new Date(),
      });
    }
    
    this.historicalData.set(key, history);
  }

  /**
   * Detect and store success patterns
   */
  detectSuccessPatterns(
    toolId: string,
    features: Record<string, any>,
    success: boolean,
    confidence: number
  ): void {
    const pattern = this.extractPattern(features);
    const patterns = this.successPatterns.get(toolId) || [];
    
    const existing = patterns.find(p => p.pattern === pattern);
    if (existing) {
      existing.occurrences++;
      existing.confidence = (existing.confidence * (existing.occurrences - 1) + 
        (success ? confidence : 0)) / existing.occurrences;
      existing.lastSeen = new Date();
    } else if (success) {
      patterns.push({
        pattern,
        confidence,
        occurrences: 1,
        lastSeen: new Date(),
      });
    }
    
    this.successPatterns.set(toolId, patterns);
  }

  /**
   * Adaptive weight adjustment based on recent performance
   */
  adaptWeights(
    recentPerformance: Array<{
      prediction: WeightedConfidence;
      actual: boolean;
    }>,
    adaptationRate: number = 0.1
  ): WeightingFactor {
    const errors = recentPerformance.map(p => ({
      error: Math.abs((p.actual ? 1 : 0) - p.prediction.weightedConfidence),
      factors: p.prediction.factors,
      weights: p.prediction.weights,
    }));

    const avgError = errors.reduce((sum, e) => sum + e.error, 0) / errors.length;
    
    // Only adapt if error is significant
    if (avgError > 0.1) {
      const newWeights = { ...this.weights };
      
      // Adjust weights based on factor performance
      errors.forEach(e => {
        const factorErrors = this.calculateFactorErrors(e);
        Object.keys(factorErrors).forEach(key => {
          const k = key as keyof WeightingFactor;
          newWeights[k] = Math.max(0, Math.min(1,
            newWeights[k] + adaptationRate * factorErrors[k]
          ));
        });
      });

      // Normalize
      const sum = Object.values(newWeights).reduce((a, b) => a + b, 0);
      Object.keys(newWeights).forEach(key => {
        const k = key as keyof WeightingFactor;
        newWeights[k] = newWeights[k] / sum;
      });

      this.weights = newWeights;
    }

    return this.weights;
  }

  // Private helper methods
  private getToolPriority(toolId: string, contentType: ContentType): number {
    return TOOL_PRIORITIES[toolId]?.[contentType] || 0.5;
  }

  private getHistoricalPerformance(
    toolId: string,
    contentType: ContentType,
    historicalData?: HistoricalPerformance[]
  ): number {
    const key = `${toolId}-${contentType}`;
    const history = historicalData || this.historicalData.get(key) || [];
    const performance = history.find(h => h.toolId === toolId);
    
    if (!performance || performance.totalAttempts < 5) {
      return 0.5; // Neutral if insufficient data
    }
    
    return performance.successRate;
  }

  private getContentTypeMatch(toolId: string, contentType: ContentType): number {
    const priority = this.getToolPriority(toolId, contentType);
    return priority > 0.8 ? 1.0 : priority > 0.6 ? 0.8 : 0.6;
  }

  private getSuccessPatternScore(
    toolId: string,
    confidence: number,
    patterns?: SuccessPattern[]
  ): number {
    const toolPatterns = patterns || this.successPatterns.get(toolId) || [];
    if (toolPatterns.length === 0) return 0.5;
    
    // Find similar patterns
    const relevantPatterns = toolPatterns.filter(p => 
      Math.abs(p.confidence - confidence) < 0.1
    );
    
    if (relevantPatterns.length === 0) return 0.5;
    
    const avgConfidence = relevantPatterns.reduce((sum, p) => 
      sum + p.confidence, 0) / relevantPatterns.length;
    
    return avgConfidence;
  }

  private getRecencyBonus(timestamp: Date): number {
    const now = new Date();
    const ageInHours = (now.getTime() - timestamp.getTime()) / (1000 * 60 * 60);
    
    if (ageInHours < 1) return 1.0;
    if (ageInHours < 24) return 0.9;
    if (ageInHours < 168) return 0.8; // 1 week
    return 0.7;
  }

  private analyzeTrend(toolId: string, confidence: number): 'improving' | 'stable' | 'declining' {
    const trends = this.performanceTrends.get(toolId) || [];
    trends.push(confidence);
    
    // Keep last 10 measurements
    if (trends.length > 10) trends.shift();
    this.performanceTrends.set(toolId, trends);
    
    if (trends.length < 3) return 'stable';
    
    // Simple linear regression
    const n = trends.length;
    const sumX = (n * (n + 1)) / 2;
    const sumY = trends.reduce((sum, y) => sum + y, 0);
    const sumXY = trends.reduce((sum, y, i) => sum + y * (i + 1), 0);
    const sumX2 = (n * (n + 1) * (2 * n + 1)) / 6;
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    
    if (slope > 0.01) return 'improving';
    if (slope < -0.01) return 'declining';
    return 'stable';
  }

  private generateRecommendation(
    toolId: string,
    confidence: number,
    trend: string,
    factors: Record<string, number>
  ): string {
    const recommendations: string[] = [];
    
    if (confidence > 0.8) {
      recommendations.push(`High confidence (${(confidence * 100).toFixed(1)}%) - recommended for use`);
    } else if (confidence > 0.6) {
      recommendations.push(`Moderate confidence (${(confidence * 100).toFixed(1)}%) - consider with validation`);
    } else {
      recommendations.push(`Low confidence (${(confidence * 100).toFixed(1)}%) - use with caution`);
    }
    
    if (trend === 'improving') {
      recommendations.push('Performance is improving over time');
    } else if (trend === 'declining') {
      recommendations.push('Performance is declining - investigate issues');
    }
    
    // Factor-specific recommendations
    if (factors.historicalPerformance < 0.5) {
      recommendations.push('Historical performance is below average');
    }
    if (factors.contentTypeMatch < 0.6) {
      recommendations.push('Tool may not be optimal for this content type');
    }
    
    return recommendations.join('. ');
  }

  private calculateGradients(
    data: Array<{
      toolId: string;
      contentType: ContentType;
      actualSuccess: boolean;
      predictedConfidence: number;
    }>,
    weights: WeightingFactor
  ): WeightingFactor {
    const gradients: WeightingFactor = {
      toolPriority: 0,
      historicalPerformance: 0,
      contentTypeMatch: 0,
      successPattern: 0,
      recency: 0,
    };
    
    data.forEach(d => {
      const error = (d.actualSuccess ? 1 : 0) - d.predictedConfidence;
      
      // Simplified gradient calculation
      Object.keys(gradients).forEach(key => {
        const k = key as keyof WeightingFactor;
        gradients[k] += error * 0.1; // Simplified - in practice would be more complex
      });
    });
    
    // Average gradients
    Object.keys(gradients).forEach(key => {
      const k = key as keyof WeightingFactor;
      gradients[k] = gradients[k] / data.length;
    });
    
    return gradients;
  }

  private extractPattern(features: Record<string, any>): string {
    // Simple pattern extraction - in practice would be more sophisticated
    const relevantFeatures = ['contentType', 'complexity', 'quality'];
    const pattern = relevantFeatures
      .map(f => `${f}:${features[f]}`)
      .join('|');
    return pattern;
  }

  private calculateFactorErrors(error: {
    error: number;
    factors: Record<string, number>;
    weights: WeightingFactor;
  }): WeightingFactor {
    const factorErrors: WeightingFactor = {
      toolPriority: 0,
      historicalPerformance: 0,
      contentTypeMatch: 0,
      successPattern: 0,
      recency: 0,
    };
    
    // Attribute error to factors based on their contribution
    const totalContribution = Object.keys(error.weights).reduce((sum, key) => {
      const k = key as keyof WeightingFactor;
      return sum + error.weights[k] * error.factors[k];
    }, 0);
    
    Object.keys(factorErrors).forEach(key => {
      const k = key as keyof WeightingFactor;
      const contribution = error.weights[k] * error.factors[k];
      factorErrors[k] = -error.error * (contribution / totalContribution);
    });
    
    return factorErrors;
  }

  /**
   * Export current state for persistence
   */
  exportState() {
    return {
      weights: this.weights,
      historicalData: Array.from(this.historicalData.entries()),
      successPatterns: Array.from(this.successPatterns.entries()),
      performanceTrends: Array.from(this.performanceTrends.entries()),
    };
  }

  /**
   * Import state from persistence
   */
  importState(state: any) {
    if (state.weights) this.weights = state.weights;
    if (state.historicalData) {
      this.historicalData = new Map(state.historicalData);
    }
    if (state.successPatterns) {
      this.successPatterns = new Map(state.successPatterns);
    }
    if (state.performanceTrends) {
      this.performanceTrends = new Map(state.performanceTrends);
    }
  }
}

// Export pre-configured engines for common scenarios
export const createBalancedEngine = () => 
  new ConfidenceWeightingEngine(DEFAULT_WEIGHTS.balanced);

export const createPriorityEngine = () => 
  new ConfidenceWeightingEngine(DEFAULT_WEIGHTS.priorityFocused);

export const createPerformanceEngine = () => 
  new ConfidenceWeightingEngine(DEFAULT_WEIGHTS.performanceDriven);

export const createAdaptiveEngine = () => 
  new ConfidenceWeightingEngine(DEFAULT_WEIGHTS.adaptive);

// Utility function to analyze confidence distribution
export function analyzeConfidenceDistribution(
  weightedScores: WeightedConfidence[]
): {
  mean: number;
  median: number;
  stdDev: number;
  range: { min: number; max: number };
  distribution: Record<string, number>;
} {
  const scores = weightedScores.map(s => s.weightedConfidence);
  const n = scores.length;
  
  if (n === 0) {
    return {
      mean: 0,
      median: 0,
      stdDev: 0,
      range: { min: 0, max: 0 },
      distribution: {},
    };
  }
  
  // Sort for median
  const sorted = [...scores].sort((a, b) => a - b);
  
  const mean = scores.reduce((sum, s) => sum + s, 0) / n;
  const median = n % 2 === 0 
    ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2 
    : sorted[Math.floor(n / 2)];
  
  const variance = scores.reduce((sum, s) => sum + Math.pow(s - mean, 2), 0) / n;
  const stdDev = Math.sqrt(variance);
  
  const range = {
    min: Math.min(...scores),
    max: Math.max(...scores),
  };
  
  // Create distribution buckets
  const distribution: Record<string, number> = {
    'very_low': 0,    // 0-0.2
    'low': 0,         // 0.2-0.4
    'moderate': 0,    // 0.4-0.6
    'high': 0,        // 0.6-0.8
    'very_high': 0,   // 0.8-1.0
  };
  
  scores.forEach(score => {
    if (score < 0.2) distribution.very_low++;
    else if (score < 0.4) distribution.low++;
    else if (score < 0.6) distribution.moderate++;
    else if (score < 0.8) distribution.high++;
    else distribution.very_high++;
  });
  
  return { mean, median, stdDev, range, distribution };
}