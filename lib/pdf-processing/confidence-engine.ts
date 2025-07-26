import { Zone } from '../../app/components/zones/ZoneManager';
import { ToolAssignmentResult } from './tool-assignment';
import { ProcessingResult } from './processing-queue';

// Core interfaces for confidence calculation
export interface ConfidenceEngine {
  calculateConfidence(result: ProcessingResult, context: ConfidenceContext): Promise<ConfidenceScore>;
  normalizeConfidence(rawScore: number, tool: string, contentType: string): Promise<number>;
  calibrateConfidence(score: number, historicalData: CalibrationData[]): Promise<number>;
  updateCalibration(feedback: ConfidenceFeedback): Promise<void>;
  getConfidenceExplanation(score: ConfidenceScore): ConfidenceExplanation;
}

export interface ConfidenceScore {
  rawScore: number;           // Tool's native confidence (0-1)
  normalizedScore: number;    // Normalized across tools (0-1)
  weightedScore: number;      // Weighted by content characteristics (0-1)
  calibratedScore: number;    // Calibrated using historical data (0-1)
  finalConfidence: number;    // Final confidence score (0-1)
  factors: ConfidenceFactors;
  metadata: ConfidenceMetadata;
}

export interface ConfidenceFactors {
  toolReliability: number;    // Historical tool performance (0-1)
  contentComplexity: number;  // Content analysis difficulty score (0-1)
  contextualClues: number;    // Surrounding content validation (0-1)
  crossValidation: number;    // Agreement with other tools (0-1)
  processingQuality: number;  // Processing artifacts quality (0-1)
  userFeedback: number;       // Historical user validation (0-1)
}

export interface ConfidenceMetadata {
  calculationMethod: string;
  timestamp: Date;
  version: string;
  processingTime: number;
  dataQuality: number;
  uncertaintyRange: [number, number];
}

export interface ConfidenceContext {
  zone: Zone;
  tool: string;
  processingMetrics: ProcessingMetrics;
  historicalPerformance: HistoricalPerformanceData;
  crossValidationResults?: CrossValidationResult[];
  userPreferences: UserConfidencePreferences;
}

export interface ProcessingMetrics {
  processingTime: number;
  memoryUsage: number;
  cpuUsage: number;
  errorCount: number;
  warningCount: number;
  artifactsGenerated: number;
}

export interface HistoricalPerformanceData {
  toolAccuracy: Map<string, number>;
  contentTypePerformance: Map<string, number>;
  recentTrends: PerformanceTrend[];
  calibrationQuality: number;
}

export interface PerformanceTrend {
  period: string;
  metric: string;
  value: number;
  direction: 'improving' | 'stable' | 'declining';
}

export interface CrossValidationResult {
  toolName: string;
  confidence: number;
  agreement: number;
  conflictingAreas: ConflictArea[];
}

export interface ConflictArea {
  location: string;
  discrepancy: number;
  severity: 'low' | 'medium' | 'high';
}

export interface UserConfidencePreferences {
  conservativeMode: boolean;
  minimumAcceptableConfidence: number;
  preferredValidationLevel: 'basic' | 'thorough' | 'exhaustive';
  riskTolerance: 'low' | 'medium' | 'high';
}

export interface CalibrationData {
  predictedConfidence: number;
  actualAccuracy: number;
  toolName: string;
  contentType: string;
  contextFactors: ContextFactor[];
  timestamp: Date;
  validationSource: 'manual' | 'automated' | 'user_feedback';
}

export interface ContextFactor {
  name: string;
  value: number;
  weight: number;
  impact: 'positive' | 'negative' | 'neutral';
}

export interface ConfidenceFeedback {
  resultId: string;
  predictedConfidence: number;
  userRating: number;
  actualAccuracy?: number;
  issues: FeedbackIssue[];
  timestamp: Date;
}

export interface FeedbackIssue {
  type: 'accuracy' | 'completeness' | 'formatting' | 'confidence_mismatch';
  severity: number;
  description: string;
  suggestion?: string;
}

export interface ConfidenceExplanation {
  summary: string;
  factors: ExplanationFactor[];
  reasoning: string[];
  recommendations: string[];
  uncertaintyReasons: string[];
  improvementSuggestions: string[];
}

export interface ExplanationFactor {
  name: string;
  contribution: number;
  explanation: string;
  impact: 'positive' | 'negative' | 'neutral';
}

// Tool-specific confidence calculators
export interface ToolConfidenceCalculator {
  calculateRawConfidence(result: ProcessingResult, zone: Zone): Promise<number>;
  getNormalizationFactors(): NormalizationFactors;
  getReliabilityScore(): number;
  getSupportedMetrics(): string[];
}

export interface NormalizationFactors {
  bias: number;               // Tool bias adjustment (-1 to 1)
  variance: number;           // Confidence variance (0-1)
  scaleFactor: number;        // Linear scale adjustment (0-2)
  offsetFactor: number;       // Offset adjustment (-0.5 to 0.5)
}

// Content-aware confidence adjustments
export interface ContentConfidenceAdjuster {
  adjustForContentType(confidence: number, contentType: string): number;
  adjustForComplexity(confidence: number, complexity: string): number;
  adjustForQuality(confidence: number, qualityIndicators: QualityIndicator[]): number;
}

export interface QualityIndicator {
  name: string;
  value: number;
  weight: number;
  threshold: number;
}

// Calibration system
export interface ConfidenceCalibrator {
  calibrate(confidence: number, context: CalibrationContext): Promise<number>;
  updateModel(feedback: ConfidenceFeedback[]): Promise<void>;
  getCalibrationQuality(): CalibrationQuality;
  exportModel(): CalibrationModel;
  importModel(model: CalibrationModel): Promise<void>;
}

export interface CalibrationContext {
  toolName: string;
  contentType: string;
  complexity: string;
  historicalAccuracy: number;
  recentPerformance: number;
}

export interface CalibrationQuality {
  reliability: number;        // How well calibrated (0-1)
  coverage: number;          // Data coverage (0-1)
  recency: number;           // How recent the data (0-1)
  sampleSize: number;        // Number of calibration points
  lastUpdated: Date;
}

export interface CalibrationModel {
  version: string;
  algorithm: string;
  parameters: Record<string, number>;
  trainingData: CalibrationData[];
  validationMetrics: ValidationMetrics;
  createdAt: Date;
}

export interface ValidationMetrics {
  mse: number;               // Mean squared error
  mae: number;               // Mean absolute error
  r2: number;                // R-squared
  calibrationError: number;   // Expected calibration error
}

// Main AdvancedConfidenceEngine implementation
export class AdvancedConfidenceEngine implements ConfidenceEngine {
  private toolCalculators: Map<string, ToolConfidenceCalculator>;
  private contentAdjuster: ContentConfidenceAdjuster;
  private calibrator: ConfidenceCalibrator;
  private historicalData: Map<string, CalibrationData[]>;
  private normalizationCache: Map<string, NormalizationFactors>;

  constructor() {
    this.toolCalculators = this.initializeToolCalculators();
    this.contentAdjuster = new ContentConfidenceAdjusterImpl();
    this.calibrator = new ConfidenceCalibratorImpl();
    this.historicalData = new Map();
    this.normalizationCache = new Map();
  }

  async calculateConfidence(
    result: ProcessingResult, 
    context: ConfidenceContext
  ): Promise<ConfidenceScore> {
    const startTime = performance.now();

    try {
      // Step 1: Calculate raw confidence from tool
      const rawScore = await this.calculateRawConfidence(result, context);

      // Step 2: Normalize across tools
      const normalizedScore = await this.normalizeConfidence(
        rawScore, 
        context.tool, 
        context.zone.contentType
      );

      // Step 3: Apply content-aware weighting
      const weightedScore = await this.applyContentWeighting(
        normalizedScore, 
        context
      );

      // Step 4: Apply historical calibration
      const calibratedScore = await this.calibrateConfidence(
        weightedScore, 
        this.getRelevantCalibrationData(context)
      );

      // Step 5: Calculate confidence factors
      const factors = await this.calculateConfidenceFactors(result, context);

      // Step 6: Calculate final confidence
      const finalConfidence = await this.calculateFinalConfidence(
        calibratedScore, 
        factors, 
        context
      );

      const processingTime = performance.now() - startTime;

      return {
        rawScore,
        normalizedScore,
        weightedScore,
        calibratedScore,
        finalConfidence,
        factors,
        metadata: {
          calculationMethod: 'advanced_multi_factor',
          timestamp: new Date(),
          version: '2.0.0',
          processingTime,
          dataQuality: this.assessDataQuality(context),
          uncertaintyRange: this.calculateUncertaintyRange(finalConfidence, factors)
        }
      };

    } catch (error) {
      console.error('Confidence calculation failed:', error);
      
      // Return conservative fallback confidence
      return this.createFallbackConfidence(result, context);
    }
  }

  private async calculateRawConfidence(
    result: ProcessingResult, 
    context: ConfidenceContext
  ): Promise<number> {
    const calculator = this.toolCalculators.get(context.tool);
    
    if (calculator) {
      return await calculator.calculateRawConfidence(result, context.zone);
    }

    // Fallback to result confidence if no specific calculator
    return result.confidence || 0.5;
  }

  async normalizeConfidence(
    rawScore: number, 
    tool: string, 
    contentType: string
  ): Promise<number> {
    const cacheKey = `${tool}_${contentType}`;
    let factors = this.normalizationCache.get(cacheKey);

    if (!factors) {
      factors = await this.calculateNormalizationFactors(tool, contentType);
      this.normalizationCache.set(cacheKey, factors);
    }

    // Apply normalization transformation
    let normalized = rawScore;
    
    // Apply scale factor
    normalized *= factors.scaleFactor;
    
    // Apply offset
    normalized += factors.offsetFactor;
    
    // Apply bias correction
    normalized = this.correctBias(normalized, factors.bias);
    
    // Clamp to [0, 1]
    return Math.max(0, Math.min(1, normalized));
  }

  private correctBias(score: number, bias: number): number {
    // Apply sigmoid-based bias correction
    const correctionFactor = 1 / (1 + Math.exp(-bias * 10));
    return score * (2 * correctionFactor - 1) + (1 - correctionFactor);
  }

  private async applyContentWeighting(
    score: number, 
    context: ConfidenceContext
  ): Promise<number> {
    let weighted = score;

    // Adjust for content type
    weighted = this.contentAdjuster.adjustForContentType(
      weighted, 
      context.zone.contentType
    );

    // Adjust for complexity
    weighted = this.contentAdjuster.adjustForComplexity(
      weighted, 
      context.zone.characteristics.complexity
    );

    // Adjust for quality indicators
    const qualityIndicators = this.extractQualityIndicators(context);
    weighted = this.contentAdjuster.adjustForQuality(weighted, qualityIndicators);

    return Math.max(0, Math.min(1, weighted));
  }

  async calibrateConfidence(
    score: number, 
    historicalData: CalibrationData[]
  ): Promise<number> {
    if (historicalData.length === 0) {
      return score;
    }

    return await this.calibrator.calibrate(score, {
      toolName: historicalData[0].toolName,
      contentType: historicalData[0].contentType,
      complexity: 'medium', // Simplified
      historicalAccuracy: this.calculateAverageAccuracy(historicalData),
      recentPerformance: this.calculateRecentPerformance(historicalData)
    });
  }

  private async calculateConfidenceFactors(
    result: ProcessingResult, 
    context: ConfidenceContext
  ): Promise<ConfidenceFactors> {
    return {
      toolReliability: await this.calculateToolReliability(context.tool),
      contentComplexity: this.calculateContentComplexity(context.zone),
      contextualClues: await this.calculateContextualClues(context),
      crossValidation: this.calculateCrossValidation(context.crossValidationResults),
      processingQuality: this.calculateProcessingQuality(result, context.processingMetrics),
      userFeedback: await this.calculateUserFeedbackScore(context.tool, context.zone.contentType)
    };
  }

  private async calculateFinalConfidence(
    calibratedScore: number, 
    factors: ConfidenceFactors, 
    context: ConfidenceContext
  ): Promise<number> {
    // Weighted combination of calibrated score and factors
    const weights = this.getFactorWeights(context.userPreferences);
    
    let finalScore = calibratedScore * weights.baseScore;
    finalScore += factors.toolReliability * weights.toolReliability;
    finalScore += factors.contentComplexity * weights.contentComplexity;
    finalScore += factors.contextualClues * weights.contextualClues;
    finalScore += factors.crossValidation * weights.crossValidation;
    finalScore += factors.processingQuality * weights.processingQuality;
    finalScore += factors.userFeedback * weights.userFeedback;

    // Apply user preference adjustments
    if (context.userPreferences.conservativeMode) {
      finalScore *= 0.9; // Be more conservative
    }

    return Math.max(0, Math.min(1, finalScore));
  }

  private getFactorWeights(preferences: UserConfidencePreferences) {
    const baseWeights = {
      baseScore: 0.4,
      toolReliability: 0.15,
      contentComplexity: 0.1,
      contextualClues: 0.1,
      crossValidation: 0.1,
      processingQuality: 0.1,
      userFeedback: 0.05
    };

    // Adjust weights based on preferences
    if (preferences.riskTolerance === 'low') {
      baseWeights.toolReliability += 0.1;
      baseWeights.crossValidation += 0.05;
      baseWeights.baseScore -= 0.15;
    }

    return baseWeights;
  }

  async updateCalibration(feedback: ConfidenceFeedback): Promise<void> {
    // Convert feedback to calibration data
    const calibrationData: CalibrationData = {
      predictedConfidence: feedback.predictedConfidence,
      actualAccuracy: feedback.actualAccuracy || feedback.userRating / 5, // Convert 1-5 to 0-1
      toolName: 'unknown', // Would be tracked in real implementation
      contentType: 'unknown',
      contextFactors: [],
      timestamp: feedback.timestamp,
      validationSource: 'user_feedback'
    };

    // Update calibrator model
    await this.calibrator.updateModel([feedback]);

    // Store historical data
    const key = `${calibrationData.toolName}_${calibrationData.contentType}`;
    if (!this.historicalData.has(key)) {
      this.historicalData.set(key, []);
    }
    this.historicalData.get(key)!.push(calibrationData);

    // Limit historical data size
    const data = this.historicalData.get(key)!;
    if (data.length > 1000) {
      data.splice(0, data.length - 1000);
    }
  }

  getConfidenceExplanation(score: ConfidenceScore): ConfidenceExplanation {
    const factors = this.analyzeFactorContributions(score);
    
    return {
      summary: this.generateConfidenceSummary(score),
      factors,
      reasoning: this.generateReasoning(score),
      recommendations: this.generateRecommendations(score),
      uncertaintyReasons: this.identifyUncertaintyReasons(score),
      improvementSuggestions: this.generateImprovementSuggestions(score)
    };
  }

  // Private helper methods
  private initializeToolCalculators(): Map<string, ToolConfidenceCalculator> {
    const calculators = new Map<string, ToolConfidenceCalculator>();
    
    calculators.set('unstructured', new UnstructuredConfidenceCalculator());
    calculators.set('pdfplumber', new PDFPlumberConfidenceCalculator());
    calculators.set('camelot', new CamelotConfidenceCalculator());
    calculators.set('tabula', new TabulaConfidenceCalculator());
    calculators.set('visual_analyzer', new VisualAnalyzerConfidenceCalculator());
    
    return calculators;
  }

  private async calculateNormalizationFactors(
    tool: string, 
    contentType: string
  ): Promise<NormalizationFactors> {
    // Get tool-specific normalization from historical performance
    const historicalData = this.getRelevantHistoricalData(tool, contentType);
    
    if (historicalData.length === 0) {
      return {
        bias: 0,
        variance: 0.1,
        scaleFactor: 1.0,
        offsetFactor: 0
      };
    }

    // Calculate statistics from historical data
    const predictions = historicalData.map(d => d.predictedConfidence);
    const actuals = historicalData.map(d => d.actualAccuracy);
    
    const meanPrediction = predictions.reduce((a, b) => a + b) / predictions.length;
    const meanActual = actuals.reduce((a, b) => a + b) / actuals.length;
    
    return {
      bias: meanPrediction - meanActual,
      variance: this.calculateVariance(predictions),
      scaleFactor: Math.min(2.0, Math.max(0.5, meanActual / meanPrediction)),
      offsetFactor: Math.max(-0.5, Math.min(0.5, meanActual - meanPrediction))
    };
  }

  private calculateVariance(values: number[]): number {
    const mean = values.reduce((a, b) => a + b) / values.length;
    const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
    return squaredDiffs.reduce((a, b) => a + b) / squaredDiffs.length;
  }

  private extractQualityIndicators(context: ConfidenceContext): QualityIndicator[] {
    return [
      {
        name: 'processing_time',
        value: context.processingMetrics.processingTime,
        weight: 0.2,
        threshold: 5000 // 5 seconds
      },
      {
        name: 'memory_efficiency',
        value: 1 - (context.processingMetrics.memoryUsage / 1000), // Normalize
        weight: 0.1,
        threshold: 0.8
      },
      {
        name: 'error_rate',
        value: 1 - context.processingMetrics.errorCount,
        weight: 0.3,
        threshold: 0.95
      },
      {
        name: 'artifact_quality',
        value: Math.min(1, context.processingMetrics.artifactsGenerated / 5),
        weight: 0.4,
        threshold: 0.6
      }
    ];
  }

  private getRelevantCalibrationData(context: ConfidenceContext): CalibrationData[] {
    const key = `${context.tool}_${context.zone.contentType}`;
    return this.historicalData.get(key) || [];
  }

  private getRelevantHistoricalData(tool: string, contentType: string): CalibrationData[] {
    const key = `${tool}_${contentType}`;
    return this.historicalData.get(key) || [];
  }

  private calculateAverageAccuracy(data: CalibrationData[]): number {
    if (data.length === 0) return 0.5;
    return data.reduce((sum, d) => sum + d.actualAccuracy, 0) / data.length;
  }

  private calculateRecentPerformance(data: CalibrationData[]): number {
    const recentData = data
      .filter(d => Date.now() - d.timestamp.getTime() < 30 * 24 * 60 * 60 * 1000) // Last 30 days
      .slice(-50); // Last 50 points

    if (recentData.length === 0) return 0.5;
    return recentData.reduce((sum, d) => sum + d.actualAccuracy, 0) / recentData.length;
  }

  private async calculateToolReliability(tool: string): Promise<number> {
    const historicalData = Array.from(this.historicalData.values())
      .flat()
      .filter(d => d.toolName === tool);

    if (historicalData.length === 0) return 0.7; // Default reliability

    const accuracySum = historicalData.reduce((sum, d) => sum + d.actualAccuracy, 0);
    return accuracySum / historicalData.length;
  }

  private calculateContentComplexity(zone: Zone): number {
    const complexity = zone.characteristics.complexity;
    const complexityMap = { 'low': 0.8, 'medium': 0.6, 'high': 0.4 };
    return complexityMap[complexity] || 0.6;
  }

  private async calculateContextualClues(context: ConfidenceContext): Promise<number> {
    // Analyze surrounding content, document structure, etc.
    let score = 0.5;

    // Boost if zone has clear structure
    if (context.zone.characteristics.hasStructure) {
      score += 0.2;
    }

    // Boost if high text density (clear content)
    if (context.zone.characteristics.textDensity > 0.7) {
      score += 0.15;
    }

    // Reduce if mixed content (harder to validate)
    if (context.zone.contentType === 'mixed') {
      score -= 0.1;
    }

    return Math.max(0, Math.min(1, score));
  }

  private calculateCrossValidation(results?: CrossValidationResult[]): number {
    if (!results || results.length === 0) return 0.5;

    const agreements = results.map(r => r.agreement);
    return agreements.reduce((sum, a) => sum + a, 0) / agreements.length;
  }

  private calculateProcessingQuality(
    result: ProcessingResult, 
    metrics: ProcessingMetrics
  ): number {
    let score = 0.5;

    // Quality based on result validation
    if (result.validationResults.length > 0) {
      const validationScore = result.validationResults.reduce((sum, v) => sum + v.score, 0) / result.validationResults.length;
      score = validationScore * 0.7 + score * 0.3;
    }

    // Adjust based on processing metrics
    if (metrics.errorCount === 0) score += 0.1;
    if (metrics.warningCount === 0) score += 0.05;
    if (metrics.processingTime < 2000) score += 0.05; // Fast processing
    
    return Math.max(0, Math.min(1, score));
  }

  private async calculateUserFeedbackScore(tool: string, contentType: string): Promise<number> {
    const feedbackData = this.getRelevantHistoricalData(tool, contentType)
      .filter(d => d.validationSource === 'user_feedback')
      .slice(-20); // Recent feedback

    if (feedbackData.length === 0) return 0.5;

    return feedbackData.reduce((sum, d) => sum + d.actualAccuracy, 0) / feedbackData.length;
  }

  private assessDataQuality(context: ConfidenceContext): number {
    let quality = 0.5;

    // Historical data availability
    const historicalData = this.getRelevantCalibrationData(context);
    if (historicalData.length > 10) quality += 0.2;
    if (historicalData.length > 50) quality += 0.1;

    // Recent data availability
    const recentData = historicalData.filter(d => 
      Date.now() - d.timestamp.getTime() < 7 * 24 * 60 * 60 * 1000 // Last 7 days
    );
    if (recentData.length > 5) quality += 0.1;

    // Cross-validation availability
    if (context.crossValidationResults && context.crossValidationResults.length > 0) {
      quality += 0.1;
    }

    return Math.max(0, Math.min(1, quality));
  }

  private calculateUncertaintyRange(confidence: number, factors: ConfidenceFactors): [number, number] {
    // Calculate uncertainty based on confidence factors
    let uncertainty = 0.1; // Base uncertainty

    // Increase uncertainty for low reliability
    if (factors.toolReliability < 0.7) uncertainty += 0.1;
    if (factors.crossValidation < 0.5) uncertainty += 0.05;
    if (factors.processingQuality < 0.8) uncertainty += 0.05;

    const lowerBound = Math.max(0, confidence - uncertainty);
    const upperBound = Math.min(1, confidence + uncertainty);

    return [lowerBound, upperBound];
  }

  private createFallbackConfidence(
    result: ProcessingResult, 
    context: ConfidenceContext
  ): ConfidenceScore {
    const fallbackScore = result.confidence || 0.5;

    return {
      rawScore: fallbackScore,
      normalizedScore: fallbackScore,
      weightedScore: fallbackScore,
      calibratedScore: fallbackScore,
      finalConfidence: fallbackScore,
      factors: {
        toolReliability: 0.5,
        contentComplexity: 0.5,
        contextualClues: 0.5,
        crossValidation: 0.5,
        processingQuality: 0.5,
        userFeedback: 0.5
      },
      metadata: {
        calculationMethod: 'fallback',
        timestamp: new Date(),
        version: '2.0.0',
        processingTime: 0,
        dataQuality: 0.3,
        uncertaintyRange: [fallbackScore - 0.2, fallbackScore + 0.2]
      }
    };
  }

  private analyzeFactorContributions(score: ConfidenceScore): ExplanationFactor[] {
    return [
      {
        name: 'Tool Reliability',
        contribution: score.factors.toolReliability,
        explanation: `Based on historical performance of this tool`,
        impact: score.factors.toolReliability > 0.7 ? 'positive' : 'negative'
      },
      {
        name: 'Content Complexity',
        contribution: score.factors.contentComplexity,
        explanation: `Content difficulty assessment`,
        impact: score.factors.contentComplexity > 0.6 ? 'positive' : 'negative'
      },
      {
        name: 'Processing Quality',
        contribution: score.factors.processingQuality,
        explanation: `Quality of processing execution`,
        impact: score.factors.processingQuality > 0.8 ? 'positive' : 'negative'
      }
    ];
  }

  private generateConfidenceSummary(score: ConfidenceScore): string {
    if (score.finalConfidence > 0.9) {
      return 'Very high confidence - result is highly reliable';
    } else if (score.finalConfidence > 0.7) {
      return 'Good confidence - result is generally reliable';
    } else if (score.finalConfidence > 0.5) {
      return 'Moderate confidence - result may need review';
    } else {
      return 'Low confidence - result requires manual verification';
    }
  }

  private generateReasoning(score: ConfidenceScore): string[] {
    const reasoning: string[] = [];

    if (score.factors.toolReliability > 0.8) {
      reasoning.push('Tool has excellent historical performance');
    }

    if (score.factors.crossValidation > 0.7) {
      reasoning.push('Multiple tools agree on the result');
    }

    if (score.factors.processingQuality > 0.8) {
      reasoning.push('Processing completed without issues');
    }

    return reasoning;
  }

  private generateRecommendations(score: ConfidenceScore): string[] {
    const recommendations: string[] = [];

    if (score.finalConfidence < 0.7) {
      recommendations.push('Consider manual review of this result');
    }

    if (score.factors.crossValidation < 0.5) {
      recommendations.push('Try processing with alternative tools');
    }

    if (score.factors.toolReliability < 0.6) {
      recommendations.push('Consider using a more reliable tool for this content type');
    }

    return recommendations;
  }

  private identifyUncertaintyReasons(score: ConfidenceScore): string[] {
    const reasons: string[] = [];

    if (score.factors.toolReliability < 0.6) {
      reasons.push('Limited historical performance data for this tool');
    }

    if (score.factors.contentComplexity < 0.5) {
      reasons.push('Content is complex and challenging to process');
    }

    if (score.metadata.dataQuality < 0.5) {
      reasons.push('Limited calibration data available');
    }

    return reasons;
  }

  private generateImprovementSuggestions(score: ConfidenceScore): string[] {
    const suggestions: string[] = [];

    if (score.factors.userFeedback < 0.6) {
      suggestions.push('Provide feedback to improve future predictions');
    }

    if (score.factors.crossValidation < 0.7) {
      suggestions.push('Process with multiple tools for better validation');
    }

    suggestions.push('Review and validate results to improve system learning');

    return suggestions;
  }
}

// Tool-specific confidence calculators
class UnstructuredConfidenceCalculator implements ToolConfidenceCalculator {
  async calculateRawConfidence(result: ProcessingResult, zone: Zone): Promise<number> {
    let confidence = result.confidence || 0.8;

    // Boost for text content (unstructured excels at this)
    if (zone.contentType === 'text') {
      confidence += 0.1;
    }

    // Reduce for complex tables
    if (zone.contentType === 'table' && zone.characteristics.complexity === 'high') {
      confidence -= 0.2;
    }

    return Math.max(0, Math.min(1, confidence));
  }

  getNormalizationFactors(): NormalizationFactors {
    return {
      bias: 0.05,        // Slightly optimistic
      variance: 0.15,
      scaleFactor: 0.95,
      offsetFactor: 0.02
    };
  }

  getReliabilityScore(): number {
    return 0.85;
  }

  getSupportedMetrics(): string[] {
    return ['text_extraction', 'layout_analysis', 'structure_detection'];
  }
}

class PDFPlumberConfidenceCalculator implements ToolConfidenceCalculator {
  async calculateRawConfidence(result: ProcessingResult, zone: Zone): Promise<number> {
    let confidence = result.confidence || 0.75;

    if (zone.contentType === 'table') {
      confidence += 0.1;
    }

    if (zone.characteristics.hasStructure) {
      confidence += 0.05;
    }

    return Math.max(0, Math.min(1, confidence));
  }

  getNormalizationFactors(): NormalizationFactors {
    return {
      bias: -0.02,
      variance: 0.12,
      scaleFactor: 1.05,
      offsetFactor: -0.01
    };
  }

  getReliabilityScore(): number {
    return 0.78;
  }

  getSupportedMetrics(): string[] {
    return ['table_extraction', 'coordinate_precision', 'text_positioning'];
  }
}

class CamelotConfidenceCalculator implements ToolConfidenceCalculator {
  async calculateRawConfidence(result: ProcessingResult, zone: Zone): Promise<number> {
    let confidence = result.confidence || 0.85;

    if (zone.contentType === 'table') {
      confidence += 0.15; // Camelot specializes in tables
    } else {
      confidence -= 0.3; // Not good for non-tables
    }

    return Math.max(0, Math.min(1, confidence));
  }

  getNormalizationFactors(): NormalizationFactors {
    return {
      bias: 0.1,         // Optimistic for tables
      variance: 0.2,
      scaleFactor: 0.9,
      offsetFactor: 0.05
    };
  }

  getReliabilityScore(): number {
    return 0.92; // Very reliable for tables
  }

  getSupportedMetrics(): string[] {
    return ['table_structure', 'cell_detection', 'border_analysis'];
  }
}

class TabulaConfidenceCalculator implements ToolConfidenceCalculator {
  async calculateRawConfidence(result: ProcessingResult, zone: Zone): Promise<number> {
    let confidence = result.confidence || 0.80;

    if (zone.contentType === 'table') {
      confidence += 0.1;
    }

    return Math.max(0, Math.min(1, confidence));
  }

  getNormalizationFactors(): NormalizationFactors {
    return {
      bias: 0.03,
      variance: 0.18,
      scaleFactor: 1.0,
      offsetFactor: 0.0
    };
  }

  getReliabilityScore(): number {
    return 0.82;
  }

  getSupportedMetrics(): string[] {
    return ['table_extraction', 'stream_detection'];
  }
}

class VisualAnalyzerConfidenceCalculator implements ToolConfidenceCalculator {
  async calculateRawConfidence(result: ProcessingResult, zone: Zone): Promise<number> {
    let confidence = result.confidence || 0.65;

    if (zone.contentType === 'diagram') {
      confidence += 0.2;
    }

    if (zone.characteristics.hasImages) {
      confidence += 0.1;
    }

    return Math.max(0, Math.min(1, confidence));
  }

  getNormalizationFactors(): NormalizationFactors {
    return {
      bias: -0.1,        // Conservative for visual content
      variance: 0.25,
      scaleFactor: 1.1,
      offsetFactor: -0.05
    };
  }

  getReliabilityScore(): number {
    return 0.70; // Lower reliability due to complexity
  }

  getSupportedMetrics(): string[] {
    return ['image_analysis', 'visual_recognition', 'ocr_confidence'];
  }
}

// Supporting implementations
class ContentConfidenceAdjusterImpl implements ContentConfidenceAdjuster {
  adjustForContentType(confidence: number, contentType: string): number {
    const adjustments = {
      'text': 0.05,
      'table': 0.0,
      'diagram': -0.1,
      'mixed': -0.05,
      'header': 0.02,
      'footer': 0.02
    };

    return confidence + (adjustments[contentType as keyof typeof adjustments] || 0);
  }

  adjustForComplexity(confidence: number, complexity: string): number {
    const adjustments = {
      'low': 0.1,
      'medium': 0.0,
      'high': -0.15
    };

    return confidence + (adjustments[complexity as keyof typeof adjustments] || 0);
  }

  adjustForQuality(confidence: number, indicators: QualityIndicator[]): number {
    let adjustment = 0;

    for (const indicator of indicators) {
      const performance = indicator.value / indicator.threshold;
      if (performance > 1) {
        adjustment += indicator.weight * 0.05; // Good performance
      } else if (performance < 0.5) {
        adjustment -= indicator.weight * 0.1; // Poor performance
      }
    }

    return Math.max(0, Math.min(1, confidence + adjustment));
  }
}

class ConfidenceCalibratorImpl implements ConfidenceCalibrator {
  private model: CalibrationModel;

  constructor() {
    this.model = this.initializeModel();
  }

  async calibrate(confidence: number, context: CalibrationContext): Promise<number> {
    // Simple isotonic regression calibration
    const calibrated = this.applyIsotonicCalibration(confidence, context);
    return Math.max(0, Math.min(1, calibrated));
  }

  async updateModel(feedback: ConfidenceFeedback[]): Promise<void> {
    // Update calibration model with new feedback
    for (const fb of feedback) {
      this.model.trainingData.push({
        predictedConfidence: fb.predictedConfidence,
        actualAccuracy: fb.actualAccuracy || fb.userRating / 5,
        toolName: 'unknown',
        contentType: 'unknown',
        contextFactors: [],
        timestamp: fb.timestamp,
        validationSource: 'user_feedback'
      });
    }

    // Retrain model (simplified)
    this.retrainModel();
  }

  getCalibrationQuality(): CalibrationQuality {
    return {
      reliability: 0.85,
      coverage: 0.7,
      recency: 0.8,
      sampleSize: this.model.trainingData.length,
      lastUpdated: new Date()
    };
  }

  exportModel(): CalibrationModel {
    return { ...this.model };
  }

  async importModel(model: CalibrationModel): Promise<void> {
    this.model = { ...model };
  }

  private initializeModel(): CalibrationModel {
    return {
      version: '1.0.0',
      algorithm: 'isotonic_regression',
      parameters: {
        smoothing: 0.1,
        regularization: 0.01
      },
      trainingData: [],
      validationMetrics: {
        mse: 0.1,
        mae: 0.08,
        r2: 0.75,
        calibrationError: 0.05
      },
      createdAt: new Date()
    };
  }

  private applyIsotonicCalibration(confidence: number, context: CalibrationContext): number {
    // Simplified isotonic calibration
    if (this.model.trainingData.length < 10) {
      return confidence; // Not enough data for calibration
    }

    // Find similar historical points
    const similarPoints = this.model.trainingData
      .filter(d => Math.abs(d.predictedConfidence - confidence) < 0.1)
      .slice(-20); // Recent similar points

    if (similarPoints.length === 0) {
      return confidence;
    }

    // Calculate calibrated value
    const avgActual = similarPoints.reduce((sum, p) => sum + p.actualAccuracy, 0) / similarPoints.length;
    const avgPredicted = similarPoints.reduce((sum, p) => sum + p.predictedConfidence, 0) / similarPoints.length;

    // Simple linear adjustment
    const adjustment = avgActual - avgPredicted;
    return confidence + adjustment * 0.5; // Dampen the adjustment
  }

  private retrainModel(): void {
    // Simplified model retraining
    if (this.model.trainingData.length > 1000) {
      // Keep only recent data
      this.model.trainingData = this.model.trainingData.slice(-1000);
    }

    // Update validation metrics (simplified)
    this.updateValidationMetrics();
  }

  private updateValidationMetrics(): void {
    const data = this.model.trainingData.slice(-100); // Recent data for validation
    
    if (data.length < 10) return;

    const predictions = data.map(d => d.predictedConfidence);
    const actuals = data.map(d => d.actualAccuracy);

    // Calculate MSE
    const mse = data.reduce((sum, d) => {
      const error = d.predictedConfidence - d.actualAccuracy;
      return sum + error * error;
    }, 0) / data.length;

    // Calculate MAE
    const mae = data.reduce((sum, d) => {
      return sum + Math.abs(d.predictedConfidence - d.actualAccuracy);
    }, 0) / data.length;

    // Update metrics
    this.model.validationMetrics.mse = mse;
    this.model.validationMetrics.mae = mae;
    this.model.validationMetrics.calibrationError = mae; // Simplified
  }
}

// Export default instance
export const confidenceEngine = new AdvancedConfidenceEngine(); 