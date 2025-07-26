import { DetectedZone, ToolRecommendation, ContentCharacteristics } from './content-analyzer';
import { AssignedTool, ToolCapabilities, ProcessingHistory } from './tool-assignment';

// Core confidence interfaces
export interface ConfidenceScore {
  rawScore: number;           // Tool's native confidence (0-1)
  normalizedScore: number;    // Normalized across tools (0-1)
  weightedScore: number;      // Weighted by multiple factors (0-1)
  contextualScore: number;    // Context-aware adjustments (0-1)
  finalConfidence: number;    // Final calibrated score (0-1)
  explanation: ConfidenceExplanation;
}

export interface ConfidenceExplanation {
  factors: ConfidenceFactor[];
  reasoning: string;
  recommendations: string[];
  alternativeOptions: AlternativeOption[];
}

export interface ConfidenceFactor {
  name: string;
  weight: number;
  contribution: number;
  description: string;
}

export interface AlternativeOption {
  description: string;
  confidence: number;
  tradeoffs: string[];
}

// Calibration interfaces
export interface CalibrationModel {
  toolName: string;
  calibrationCurve: CalibrationPoint[];
  lastUpdated: Date;
  accuracy: number;
  sampleSize: number;
  contentTypeSpecific: Map<string, CalibrationCurve>;
}

export interface CalibrationPoint {
  predictedConfidence: number;
  actualAccuracy: number;
  sampleCount: number;
}

export interface CalibrationCurve {
  points: CalibrationPoint[];
  interpolationMethod: 'linear' | 'spline' | 'polynomial';
  r2Score: number; // Goodness of fit
}

export interface GroundTruthData {
  documentId: string;
  zoneId: string;
  toolName: string;
  predictedConfidence: number;
  actualAccuracy: number;
  contentType: string;
  characteristics: ContentCharacteristics;
  timestamp: Date;
  verificationMethod: 'manual' | 'automated' | 'expert';
}

// Content-aware confidence adjustments
export interface ContentAwareAdjustment {
  contentType: string;
  characteristics: ContentCharacteristics;
  adjustmentFactors: AdjustmentFactor[];
  totalAdjustment: number;
}

export interface AdjustmentFactor {
  name: string;
  condition: (characteristics: ContentCharacteristics) => boolean;
  adjustmentValue: number;
  reasoning: string;
}

// Normalization interfaces
export interface NormalizationStrategy {
  method: 'min-max' | 'z-score' | 'percentile' | 'sigmoid';
  parameters: Record<string, number>;
  toolSpecificParams: Map<string, Record<string, number>>;
}

// Main ToolConfidenceCalculator class
export class ToolConfidenceCalculator {
  private calibrationModels: Map<string, CalibrationModel>;
  private groundTruthDatabase: GroundTruthData[];
  private normalizationStrategy: NormalizationStrategy;
  private contentAdjustments: Map<string, AdjustmentFactor[]>;
  private confidenceCache: Map<string, ConfidenceScore>;
  private learningRate: number = 0.01;

  constructor() {
    this.calibrationModels = new Map();
    this.groundTruthDatabase = [];
    this.normalizationStrategy = this.initializeNormalizationStrategy();
    this.contentAdjustments = this.initializeContentAdjustments();
    this.confidenceCache = new Map();
    this.initializeCalibrationModels();
  }

  /**
   * Calculate comprehensive confidence score for a tool's extraction result
   */
  async calculateConfidence(
    toolName: string,
    zone: DetectedZone,
    extractionResult: any,
    nativeConfidence: number,
    processingHistory?: ProcessingHistory[]
  ): Promise<ConfidenceScore> {
    // Check cache first
    const cacheKey = this.generateCacheKey(toolName, zone.id, nativeConfidence);
    const cached = this.confidenceCache.get(cacheKey);
    if (cached && this.isCacheValid(cached)) {
      return cached;
    }

    // Step 1: Get raw confidence from tool
    const rawScore = this.validateRawScore(nativeConfidence);

    // Step 2: Apply content-aware adjustments
    const contentAdjusted = await this.applyContentAwareAdjustments(
      rawScore, toolName, zone.contentType, zone.characteristics
    );

    // Step 3: Normalize across tools
    const normalized = this.normalizeConfidence(
      contentAdjusted, toolName, zone.contentType
    );

    // Step 4: Apply multi-factor weighting
    const weighted = await this.applyMultiFactorWeighting(
      normalized, toolName, zone, processingHistory
    );

    // Step 5: Apply calibration
    const calibrated = this.applyCalibraton(
      weighted, toolName, zone.contentType
    );

    // Step 6: Generate explanation
    const explanation = this.generateConfidenceExplanation(
      toolName, zone, rawScore, calibrated, processingHistory
    );

    const confidenceScore: ConfidenceScore = {
      rawScore,
      normalizedScore: normalized,
      weightedScore: weighted,
      contextualScore: contentAdjusted,
      finalConfidence: calibrated,
      explanation
    };

    // Cache the result
    this.confidenceCache.set(cacheKey, confidenceScore);

    return confidenceScore;
  }

  /**
   * Update calibration models with new ground truth data
   */
  async updateCalibration(groundTruth: GroundTruthData): Promise<void> {
    // Add to ground truth database
    this.groundTruthDatabase.push(groundTruth);

    // Update tool-specific calibration model
    const model = this.calibrationModels.get(groundTruth.toolName);
    if (model) {
      await this.updateCalibrationModel(model, groundTruth);
    }

    // Clear affected cache entries
    this.invalidateCache(groundTruth.toolName);
  }

  /**
   * Batch update calibration with multiple ground truth samples
   */
  async batchUpdateCalibration(groundTruthBatch: GroundTruthData[]): Promise<void> {
    // Group by tool for efficient updates
    const groupedByTool = this.groupByTool(groundTruthBatch);

    for (const [toolName, samples] of groupedByTool.entries()) {
      const model = this.calibrationModels.get(toolName);
      if (model) {
        await this.batchUpdateCalibrationModel(model, samples);
      }
    }

    // Add all to database
    this.groundTruthDatabase.push(...groundTruthBatch);
    
    // Clear cache
    this.confidenceCache.clear();
  }

  /**
   * Get calibration accuracy metrics for a tool
   */
  getCalibrationMetrics(toolName: string): CalibrationMetrics {
    const model = this.calibrationModels.get(toolName);
    if (!model) {
      throw new Error(`No calibration model found for tool: ${toolName}`);
    }

    const recentSamples = this.getRecentGroundTruth(toolName, 100);
    const metrics = this.calculateCalibrationMetrics(model, recentSamples);

    return metrics;
  }

  // Private helper methods

  private initializeNormalizationStrategy(): NormalizationStrategy {
    return {
      method: 'sigmoid',
      parameters: {
        center: 0.7,
        scale: 10
      },
      toolSpecificParams: new Map([
        ['unstructured', { center: 0.85, scale: 12 }],
        ['pdfplumber', { center: 0.80, scale: 10 }],
        ['camelot', { center: 0.90, scale: 15 }],
        ['tabula', { center: 0.75, scale: 8 }],
        ['visual_analyzer', { center: 0.65, scale: 8 }],
        ['ocr_engine', { center: 0.70, scale: 10 }]
      ])
    };
  }

  private initializeContentAdjustments(): Map<string, AdjustmentFactor[]> {
    const adjustments = new Map<string, AdjustmentFactor[]>();

    // Text content adjustments
    adjustments.set('text', [
      {
        name: 'high_text_density',
        condition: (chars) => chars.textDensity > 0.8,
        adjustmentValue: 0.05,
        reasoning: 'Dense text typically extracts with higher accuracy'
      },
      {
        name: 'consistent_formatting',
        condition: (chars) => chars.fontSizes.length <= 2,
        adjustmentValue: 0.03,
        reasoning: 'Consistent formatting improves extraction reliability'
      },
      {
        name: 'structured_content',
        condition: (chars) => chars.hasStructure,
        adjustmentValue: 0.04,
        reasoning: 'Structured content has clear parsing patterns'
      }
    ]);

    // Table content adjustments
    adjustments.set('table', [
      {
        name: 'simple_structure',
        condition: (chars) => chars.complexity === 'low',
        adjustmentValue: 0.06,
        reasoning: 'Simple tables extract more reliably'
      },
      {
        name: 'regular_spacing',
        condition: (chars) => chars.lineSpacing < 20 && chars.lineSpacing > 10,
        adjustmentValue: 0.04,
        reasoning: 'Regular spacing indicates well-formed tables'
      }
    ]);

    // Diagram content adjustments
    adjustments.set('diagram', [
      {
        name: 'low_complexity',
        condition: (chars) => chars.complexity === 'low',
        adjustmentValue: 0.08,
        reasoning: 'Simple diagrams are easier to process'
      },
      {
        name: 'has_text_labels',
        condition: (chars) => chars.textDensity > 0.1,
        adjustmentValue: -0.05,
        reasoning: 'Text in diagrams can complicate visual analysis'
      }
    ]);

    return adjustments;
  }

  private initializeCalibrationModels(): void {
    const tools = ['unstructured', 'pdfplumber', 'camelot', 'tabula', 'visual_analyzer', 'ocr_engine'];
    
    for (const toolName of tools) {
      this.calibrationModels.set(toolName, {
        toolName,
        calibrationCurve: this.getDefaultCalibrationCurve(),
        lastUpdated: new Date(),
        accuracy: 0.85,
        sampleSize: 0,
        contentTypeSpecific: new Map()
      });
    }
  }

  private getDefaultCalibrationCurve(): CalibrationPoint[] {
    // Default linear calibration (no adjustment)
    return [
      { predictedConfidence: 0.0, actualAccuracy: 0.0, sampleCount: 1 },
      { predictedConfidence: 0.2, actualAccuracy: 0.2, sampleCount: 1 },
      { predictedConfidence: 0.4, actualAccuracy: 0.4, sampleCount: 1 },
      { predictedConfidence: 0.6, actualAccuracy: 0.6, sampleCount: 1 },
      { predictedConfidence: 0.8, actualAccuracy: 0.8, sampleCount: 1 },
      { predictedConfidence: 1.0, actualAccuracy: 1.0, sampleCount: 1 }
    ];
  }

  private validateRawScore(score: number): number {
    if (isNaN(score) || score < 0) return 0;
    if (score > 1) return 1;
    return score;
  }

  private async applyContentAwareAdjustments(
    rawScore: number,
    toolName: string,
    contentType: string,
    characteristics: ContentCharacteristics
  ): Promise<number> {
    const adjustments = this.contentAdjustments.get(contentType) || [];
    let totalAdjustment = 0;

    for (const adjustment of adjustments) {
      if (adjustment.condition(characteristics)) {
        totalAdjustment += adjustment.adjustmentValue;
      }
    }

    // Tool-specific adjustments
    totalAdjustment += this.getToolSpecificAdjustment(toolName, contentType, characteristics);

    // Apply adjustments with bounds
    const adjusted = rawScore + totalAdjustment;
    return Math.max(0, Math.min(1, adjusted));
  }

  private getToolSpecificAdjustment(
    toolName: string,
    contentType: string,
    characteristics: ContentCharacteristics
  ): number {
    // Tool-specific adjustments based on known strengths/weaknesses
    const adjustments: Record<string, Record<string, number>> = {
      unstructured: {
        text: 0.05,
        mixed: 0.03,
        table: -0.05,
        diagram: -0.10
      },
      camelot: {
        table: 0.08,
        text: -0.10,
        diagram: -0.15,
        mixed: -0.05
      },
      visual_analyzer: {
        diagram: 0.10,
        table: -0.05,
        text: -0.15,
        mixed: -0.08
      }
    };

    return adjustments[toolName]?.[contentType] || 0;
  }

  private normalizeConfidence(
    score: number,
    toolName: string,
    contentType: string
  ): number {
    const params = this.normalizationStrategy.toolSpecificParams.get(toolName) ||
                  this.normalizationStrategy.parameters;

    switch (this.normalizationStrategy.method) {
      case 'sigmoid':
        return this.sigmoidNormalization(score, params.center, params.scale);
      
      case 'min-max':
        return this.minMaxNormalization(score, toolName);
      
      case 'z-score':
        return this.zScoreNormalization(score, toolName, contentType);
      
      case 'percentile':
        return this.percentileNormalization(score, toolName, contentType);
      
      default:
        return score;
    }
  }

  private sigmoidNormalization(x: number, center: number, scale: number): number {
    // Sigmoid function: 1 / (1 + e^(-scale * (x - center)))
    const exponent = -scale * (x - center);
    return 1 / (1 + Math.exp(exponent));
  }

  private minMaxNormalization(score: number, toolName: string): number {
    // Get min/max from historical data
    const toolHistory = this.getToolHistoricalStats(toolName);
    const min = toolHistory.minConfidence || 0;
    const max = toolHistory.maxConfidence || 1;
    
    if (max === min) return 0.5;
    return (score - min) / (max - min);
  }

  private zScoreNormalization(score: number, toolName: string, contentType: string): number {
    const stats = this.getToolContentStats(toolName, contentType);
    const mean = stats.meanConfidence || 0.5;
    const stdDev = stats.stdDevConfidence || 0.15;
    
    if (stdDev === 0) return 0.5;
    
    // Convert z-score to 0-1 range using cumulative normal distribution
    const zScore = (score - mean) / stdDev;
    return this.cumulativeNormalDistribution(zScore);
  }

  private percentileNormalization(score: number, toolName: string, contentType: string): number {
    const historicalScores = this.getHistoricalScores(toolName, contentType);
    if (historicalScores.length === 0) return score;

    const sortedScores = [...historicalScores].sort((a, b) => a - b);
    let percentile = 0;

    for (let i = 0; i < sortedScores.length; i++) {
      if (score <= sortedScores[i]) {
        percentile = i / sortedScores.length;
        break;
      }
    }

    return percentile;
  }

  private cumulativeNormalDistribution(z: number): number {
    // Approximation of the cumulative normal distribution
    const sign = z >= 0 ? 1 : -1;
    z = Math.abs(z) / Math.sqrt(2);
    
    const a1 = 0.278393;
    const a2 = 0.230389;
    const a3 = 0.000972;
    const a4 = 0.078108;
    
    const denominator = 1 + a1 * z + a2 * z * z + a3 * z * z * z + a4 * z * z * z * z;
    const erf = 1 - 1 / (denominator * denominator * denominator * denominator);
    
    return 0.5 * (1 + sign * erf);
  }

  private async applyMultiFactorWeighting(
    normalizedScore: number,
    toolName: string,
    zone: DetectedZone,
    processingHistory?: ProcessingHistory[]
  ): Promise<number> {
    const factors: WeightingFactor[] = [];

    // Factor 1: Tool priority for content type
    const toolPriority = this.getToolPriorityWeight(toolName, zone.contentType);
    factors.push({
      name: 'tool_priority',
      weight: 0.3,
      value: toolPriority
    });

    // Factor 2: Historical performance
    const historicalPerformance = await this.getHistoricalPerformanceWeight(
      toolName, zone.contentType, processingHistory
    );
    factors.push({
      name: 'historical_performance',
      weight: 0.25,
      value: historicalPerformance
    });

    // Factor 3: Content complexity match
    const complexityMatch = this.getComplexityMatchWeight(
      toolName, zone.characteristics.complexity
    );
    factors.push({
      name: 'complexity_match',
      weight: 0.2,
      value: complexityMatch
    });

    // Factor 4: Zone confidence
    factors.push({
      name: 'zone_confidence',
      weight: 0.15,
      value: zone.confidence
    });

    // Factor 5: Tool recommendation score
    const toolRecommendation = zone.recommendedTools.find(t => t.toolName === toolName);
    factors.push({
      name: 'recommendation_score',
      weight: 0.1,
      value: toolRecommendation?.suitabilityScore || 0.5
    });

    // Calculate weighted score
    let weightedScore = 0;
    let totalWeight = 0;

    for (const factor of factors) {
      weightedScore += factor.value * factor.weight;
      totalWeight += factor.weight;
    }

    // Combine with normalized score
    const combinedScore = (normalizedScore * 0.7) + (weightedScore * 0.3);
    return Math.max(0, Math.min(1, combinedScore));
  }

  private getToolPriorityWeight(toolName: string, contentType: string): number {
    const priorities: Record<string, Record<string, number>> = {
      text: { unstructured: 1.0, pdfplumber: 0.8, tabula: 0.3, camelot: 0.3 },
      table: { camelot: 1.0, tabula: 0.9, pdfplumber: 0.7, unstructured: 0.4 },
      diagram: { visual_analyzer: 1.0, ocr_engine: 0.8, unstructured: 0.3 },
      mixed: { unstructured: 0.9, pdfplumber: 0.8, camelot: 0.5, tabula: 0.4 }
    };

    return priorities[contentType]?.[toolName] || 0.5;
  }

  private async getHistoricalPerformanceWeight(
    toolName: string,
    contentType: string,
    processingHistory?: ProcessingHistory[]
  ): Promise<number> {
    if (!processingHistory || processingHistory.length === 0) {
      return 0.7; // Default neutral weight
    }

    // Filter relevant history
    const relevantHistory = processingHistory.filter(h => 
      h.toolName === toolName && h.contentType === contentType
    );

    if (relevantHistory.length === 0) return 0.7;

    // Calculate weighted average of recent performance
    let weightedSum = 0;
    let weightTotal = 0;
    const now = Date.now();

    for (let i = 0; i < relevantHistory.length; i++) {
      const history = relevantHistory[i];
      const age = now - history.timestamp.getTime();
      const ageWeight = Math.exp(-age / (30 * 24 * 60 * 60 * 1000)); // 30-day half-life
      
      const performanceScore = history.success ? history.accuracy : 0;
      weightedSum += performanceScore * ageWeight;
      weightTotal += ageWeight;
    }

    return weightTotal > 0 ? weightedSum / weightTotal : 0.7;
  }

  private getComplexityMatchWeight(toolName: string, complexity: string): number {
    const complexityMatches: Record<string, Record<string, number>> = {
      unstructured: { low: 1.0, medium: 0.9, high: 0.7 },
      pdfplumber: { low: 0.9, medium: 1.0, high: 0.8 },
      camelot: { low: 0.7, medium: 0.9, high: 1.0 },
      tabula: { low: 1.0, medium: 0.8, high: 0.6 },
      visual_analyzer: { low: 0.6, medium: 0.8, high: 1.0 },
      ocr_engine: { low: 0.8, medium: 0.9, high: 0.9 }
    };

    return complexityMatches[toolName]?.[complexity] || 0.8;
  }

  private applyCalibraton(
    weightedScore: number,
    toolName: string,
    contentType: string
  ): number {
    const model = this.calibrationModels.get(toolName);
    if (!model) return weightedScore;

    // Try content-specific calibration first
    const contentCalibration = model.contentTypeSpecific.get(contentType);
    const calibrationCurve = contentCalibration?.points || model.calibrationCurve;

    return this.interpolateCalibration(weightedScore, calibrationCurve);
  }

  private interpolateCalibration(
    predictedConfidence: number,
    calibrationCurve: CalibrationPoint[]
  ): number {
    if (calibrationCurve.length < 2) return predictedConfidence;

    // Find surrounding points
    let lowerPoint: CalibrationPoint | null = null;
    let upperPoint: CalibrationPoint | null = null;

    for (let i = 0; i < calibrationCurve.length - 1; i++) {
      if (calibrationCurve[i].predictedConfidence <= predictedConfidence &&
          calibrationCurve[i + 1].predictedConfidence >= predictedConfidence) {
        lowerPoint = calibrationCurve[i];
        upperPoint = calibrationCurve[i + 1];
        break;
      }
    }

    if (!lowerPoint || !upperPoint) {
      // Handle edge cases
      if (predictedConfidence <= calibrationCurve[0].predictedConfidence) {
        return calibrationCurve[0].actualAccuracy;
      }
      if (predictedConfidence >= calibrationCurve[calibrationCurve.length - 1].predictedConfidence) {
        return calibrationCurve[calibrationCurve.length - 1].actualAccuracy;
      }
      return predictedConfidence;
    }

    // Linear interpolation
    const range = upperPoint.predictedConfidence - lowerPoint.predictedConfidence;
    const position = (predictedConfidence - lowerPoint.predictedConfidence) / range;
    const calibrated = lowerPoint.actualAccuracy + 
                      position * (upperPoint.actualAccuracy - lowerPoint.actualAccuracy);

    return Math.max(0, Math.min(1, calibrated));
  }

  private generateConfidenceExplanation(
    toolName: string,
    zone: DetectedZone,
    rawScore: number,
    finalScore: number,
    processingHistory?: ProcessingHistory[]
  ): ConfidenceExplanation {
    const factors: ConfidenceFactor[] = [];
    
    // Raw score factor
    factors.push({
      name: 'Native Tool Confidence',
      weight: 0.3,
      contribution: rawScore * 0.3,
      description: `Tool's self-reported confidence: ${(rawScore * 100).toFixed(1)}%`
    });

    // Content type match
    const contentMatch = this.getToolPriorityWeight(toolName, zone.contentType);
    factors.push({
      name: 'Content Type Suitability',
      weight: 0.25,
      contribution: contentMatch * 0.25,
      description: `Tool's suitability for ${zone.contentType} content: ${(contentMatch * 100).toFixed(1)}%`
    });

    // Zone quality
    factors.push({
      name: 'Zone Detection Quality',
      weight: 0.15,
      contribution: zone.confidence * 0.15,
      description: `Zone detection confidence: ${(zone.confidence * 100).toFixed(1)}%`
    });

    // Historical performance
    if (processingHistory && processingHistory.length > 0) {
      const historicalScore = this.calculateHistoricalScore(toolName, zone.contentType, processingHistory);
      factors.push({
        name: 'Historical Performance',
        weight: 0.2,
        contribution: historicalScore * 0.2,
        description: `Past performance on similar content: ${(historicalScore * 100).toFixed(1)}%`
      });
    }

    // Calibration adjustment
    const calibrationAdjustment = finalScore - (rawScore * 0.7 + 0.3 * contentMatch);
    factors.push({
      name: 'Calibration Adjustment',
      weight: 0.1,
      contribution: Math.abs(calibrationAdjustment),
      description: `Calibration ${calibrationAdjustment >= 0 ? 'boost' : 'reduction'}: ${Math.abs(calibrationAdjustment * 100).toFixed(1)}%`
    });

    // Generate reasoning
    const reasoning = this.generateReasoning(toolName, zone, factors, finalScore);
    const recommendations = this.generateRecommendations(toolName, zone, finalScore, factors);
    const alternatives = this.generateAlternatives(toolName, zone, finalScore);

    return {
      factors,
      reasoning,
      recommendations,
      alternativeOptions: alternatives
    };
  }

  private generateReasoning(
    toolName: string,
    zone: DetectedZone,
    factors: ConfidenceFactor[],
    finalScore: number
  ): string {
    const confidenceLevel = finalScore >= 0.9 ? 'very high' :
                          finalScore >= 0.8 ? 'high' :
                          finalScore >= 0.7 ? 'moderate' :
                          finalScore >= 0.6 ? 'fair' : 'low';

    const topFactors = [...factors]
      .sort((a, b) => b.contribution - a.contribution)
      .slice(0, 2);

    let reasoning = `The ${confidenceLevel} confidence score of ${(finalScore * 100).toFixed(1)}% `;
    reasoning += `is primarily driven by ${topFactors[0].name.toLowerCase()} `;
    reasoning += `(${(topFactors[0].contribution * 100).toFixed(1)}% contribution) `;
    reasoning += `and ${topFactors[1].name.toLowerCase()} `;
    reasoning += `(${(topFactors[1].contribution * 100).toFixed(1)}% contribution). `;

    if (zone.characteristics.complexity === 'high') {
      reasoning += `The high complexity of the content may impact extraction accuracy. `;
    }

    if (finalScore < 0.7) {
      reasoning += `Consider using alternative tools or manual review for this zone.`;
    }

    return reasoning;
  }

  private generateRecommendations(
    toolName: string,
    zone: DetectedZone,
    finalScore: number,
    factors: ConfidenceFactor[]
  ): string[] {
    const recommendations: string[] = [];

    if (finalScore < 0.6) {
      recommendations.push('Consider manual review for this extraction');
      recommendations.push('Try multiple tools and compare results');
    } else if (finalScore < 0.8) {
      recommendations.push('Spot-check extraction results for accuracy');
      
      const lowFactors = factors.filter(f => f.contribution < f.weight * 0.6);
      if (lowFactors.length > 0) {
        recommendations.push(`Improve ${lowFactors[0].name.toLowerCase()} for better confidence`);
      }
    }

    if (zone.characteristics.complexity === 'high' && toolName !== 'camelot') {
      recommendations.push('Complex content may benefit from specialized tools');
    }

    if (zone.contentType === 'table' && !['camelot', 'tabula'].includes(toolName)) {
      recommendations.push('Consider using dedicated table extraction tools');
    }

    return recommendations;
  }

  private generateAlternatives(
    toolName: string,
    zone: DetectedZone,
    currentConfidence: number
  ): AlternativeOption[] {
    const alternatives: AlternativeOption[] = [];

    // Multi-tool consensus
    alternatives.push({
      description: 'Use multiple tools and merge results',
      confidence: Math.min(0.95, currentConfidence + 0.15),
      tradeoffs: ['Increased processing time', 'Higher resource usage', 'Complex result merging']
    });

    // Specialized tool alternatives
    if (zone.contentType === 'table' && toolName !== 'camelot') {
      alternatives.push({
        description: 'Use Camelot for advanced table extraction',
        confidence: 0.9,
        tradeoffs: ['Slower processing', 'Higher memory usage']
      });
    }

    if (zone.contentType === 'text' && toolName !== 'unstructured') {
      alternatives.push({
        description: 'Use Unstructured for general text extraction',
        confidence: 0.85,
        tradeoffs: ['May miss specialized formatting']
      });
    }

    // Manual review option
    if (currentConfidence < 0.7) {
      alternatives.push({
        description: 'Manual review and correction',
        confidence: 0.99,
        tradeoffs: ['Requires human time', 'Not scalable', 'Delays processing']
      });
    }

    return alternatives;
  }

  // Calibration update methods

  private async updateCalibrationModel(
    model: CalibrationModel,
    groundTruth: GroundTruthData
  ): Promise<void> {
    // Find the appropriate calibration point
    const curveIndex = this.findCalibrationIndex(
      model.calibrationCurve, 
      groundTruth.predictedConfidence
    );

    if (curveIndex >= 0) {
      const point = model.calibrationCurve[curveIndex];
      
      // Update with exponential moving average
      const alpha = this.learningRate;
      point.actualAccuracy = (1 - alpha) * point.actualAccuracy + alpha * groundTruth.actualAccuracy;
      point.sampleCount += 1;
    } else {
      // Add new calibration point
      this.insertCalibrationPoint(model.calibrationCurve, {
        predictedConfidence: groundTruth.predictedConfidence,
        actualAccuracy: groundTruth.actualAccuracy,
        sampleCount: 1
      });
    }

    // Update content-specific calibration
    this.updateContentSpecificCalibration(model, groundTruth);

    // Update model metadata
    model.lastUpdated = new Date();
    model.sampleSize += 1;
    model.accuracy = this.calculateModelAccuracy(model);
  }

  private async batchUpdateCalibrationModel(
    model: CalibrationModel,
    samples: GroundTruthData[]
  ): Promise<void> {
    // Group samples by predicted confidence ranges
    const confidenceRanges = this.groupByConfidenceRange(samples);

    for (const [range, rangeSamples] of confidenceRanges.entries()) {
      const avgPredicted = rangeSamples.reduce((sum, s) => sum + s.predictedConfidence, 0) / rangeSamples.length;
      const avgActual = rangeSamples.reduce((sum, s) => sum + s.actualAccuracy, 0) / rangeSamples.length;

      const curveIndex = this.findCalibrationIndex(model.calibrationCurve, avgPredicted);
      
      if (curveIndex >= 0) {
        const point = model.calibrationCurve[curveIndex];
        const totalSamples = point.sampleCount + rangeSamples.length;
        
        // Weighted average update
        point.actualAccuracy = (point.actualAccuracy * point.sampleCount + avgActual * rangeSamples.length) / totalSamples;
        point.sampleCount = totalSamples;
      } else {
        this.insertCalibrationPoint(model.calibrationCurve, {
          predictedConfidence: avgPredicted,
          actualAccuracy: avgActual,
          sampleCount: rangeSamples.length
        });
      }
    }

    // Smooth calibration curve
    this.smoothCalibrationCurve(model.calibrationCurve);

    // Update model metadata
    model.lastUpdated = new Date();
    model.sampleSize += samples.length;
    model.accuracy = this.calculateModelAccuracy(model);
  }

  private findCalibrationIndex(curve: CalibrationPoint[], confidence: number): number {
    const tolerance = 0.05; // 5% tolerance
    
    for (let i = 0; i < curve.length; i++) {
      if (Math.abs(curve[i].predictedConfidence - confidence) < tolerance) {
        return i;
      }
    }
    
    return -1;
  }

  private insertCalibrationPoint(curve: CalibrationPoint[], point: CalibrationPoint): void {
    // Insert in sorted order
    let insertIndex = curve.length;
    
    for (let i = 0; i < curve.length; i++) {
      if (curve[i].predictedConfidence > point.predictedConfidence) {
        insertIndex = i;
        break;
      }
    }
    
    curve.splice(insertIndex, 0, point);
  }

  private updateContentSpecificCalibration(
    model: CalibrationModel,
    groundTruth: GroundTruthData
  ): void {
    let contentCurve = model.contentTypeSpecific.get(groundTruth.contentType);
    
    if (!contentCurve) {
      contentCurve = {
        points: this.getDefaultCalibrationCurve(),
        interpolationMethod: 'linear',
        r2Score: 0
      };
      model.contentTypeSpecific.set(groundTruth.contentType, contentCurve);
    }

    // Update content-specific curve
    const curveIndex = this.findCalibrationIndex(
      contentCurve.points,
      groundTruth.predictedConfidence
    );

    if (curveIndex >= 0) {
      const point = contentCurve.points[curveIndex];
      const alpha = this.learningRate * 2; // Faster learning for content-specific
      point.actualAccuracy = (1 - alpha) * point.actualAccuracy + alpha * groundTruth.actualAccuracy;
      point.sampleCount += 1;
    } else {
      this.insertCalibrationPoint(contentCurve.points, {
        predictedConfidence: groundTruth.predictedConfidence,
        actualAccuracy: groundTruth.actualAccuracy,
        sampleCount: 1
      });
    }

    // Update R² score
    contentCurve.r2Score = this.calculateR2Score(contentCurve.points);
  }

  private smoothCalibrationCurve(curve: CalibrationPoint[]): void {
    if (curve.length < 3) return;

    // Apply simple moving average smoothing
    const smoothed = [...curve];
    
    for (let i = 1; i < curve.length - 1; i++) {
      const weights = [0.25, 0.5, 0.25];
      const windowStart = Math.max(0, i - 1);
      const windowEnd = Math.min(curve.length - 1, i + 1);
      
      let weightedSum = 0;
      let weightTotal = 0;
      
      for (let j = windowStart; j <= windowEnd; j++) {
        const weight = weights[j - windowStart];
        weightedSum += curve[j].actualAccuracy * weight;
        weightTotal += weight;
      }
      
      smoothed[i].actualAccuracy = weightedSum / weightTotal;
    }

    // Update curve
    for (let i = 0; i < curve.length; i++) {
      curve[i].actualAccuracy = smoothed[i].actualAccuracy;
    }
  }

  private calculateModelAccuracy(model: CalibrationModel): number {
    // Calculate mean absolute calibration error
    let totalError = 0;
    let totalWeight = 0;

    for (const point of model.calibrationCurve) {
      const error = Math.abs(point.predictedConfidence - point.actualAccuracy);
      const weight = Math.log(point.sampleCount + 1); // Weight by log of sample count
      
      totalError += error * weight;
      totalWeight += weight;
    }

    const meanError = totalWeight > 0 ? totalError / totalWeight : 0;
    return 1 - meanError; // Convert error to accuracy
  }

  private calculateR2Score(points: CalibrationPoint[]): number {
    if (points.length < 2) return 0;

    const n = points.length;
    const predictions = points.map(p => p.predictedConfidence);
    const actuals = points.map(p => p.actualAccuracy);

    // Calculate means
    const meanActual = actuals.reduce((sum, a) => sum + a, 0) / n;

    // Calculate SS_tot and SS_res
    let ssTot = 0;
    let ssRes = 0;

    for (let i = 0; i < n; i++) {
      ssTot += Math.pow(actuals[i] - meanActual, 2);
      ssRes += Math.pow(actuals[i] - predictions[i], 2);
    }

    return ssTot === 0 ? 0 : 1 - (ssRes / ssTot);
  }

  // Helper methods for metrics calculation

  private calculateCalibrationMetrics(
    model: CalibrationModel,
    recentSamples: GroundTruthData[]
  ): CalibrationMetrics {
    const metrics: CalibrationMetrics = {
      calibrationError: 0,
      reliability: 0,
      discrimination: 0,
      sharpness: 0,
      brier_score: 0,
      modelAccuracy: model.accuracy,
      sampleSize: model.sampleSize,
      lastUpdated: model.lastUpdated
    };

    if (recentSamples.length === 0) return metrics;

    // Expected Calibration Error (ECE)
    metrics.calibrationError = this.calculateECE(recentSamples);

    // Reliability (how consistent predictions are)
    metrics.reliability = this.calculateReliability(recentSamples);

    // Discrimination (ability to separate good/bad predictions)
    metrics.discrimination = this.calculateDiscrimination(recentSamples);

    // Sharpness (confidence distribution spread)
    metrics.sharpness = this.calculateSharpness(recentSamples);

    // Brier Score
    metrics.brier_score = this.calculateBrierScore(recentSamples);

    return metrics;
  }

  private calculateECE(samples: GroundTruthData[]): number {
    // Bin samples by confidence
    const bins = 10;
    const binSize = 1.0 / bins;
    const binData: { sum: number; count: number; avgConfidence: number }[] = 
      Array(bins).fill(null).map(() => ({ sum: 0, count: 0, avgConfidence: 0 }));

    for (const sample of samples) {
      const binIndex = Math.min(Math.floor(sample.predictedConfidence / binSize), bins - 1);
      binData[binIndex].sum += sample.actualAccuracy;
      binData[binIndex].count += 1;
      binData[binIndex].avgConfidence += sample.predictedConfidence;
    }

    // Calculate ECE
    let ece = 0;
    const totalSamples = samples.length;

    for (const bin of binData) {
      if (bin.count > 0) {
        const avgAccuracy = bin.sum / bin.count;
        const avgConfidence = bin.avgConfidence / bin.count;
        const binWeight = bin.count / totalSamples;
        
        ece += binWeight * Math.abs(avgAccuracy - avgConfidence);
      }
    }

    return ece;
  }

  private calculateReliability(samples: GroundTruthData[]): number {
    // Group by similar confidence levels
    const groups = this.groupBySimilarConfidence(samples);
    let totalVariance = 0;
    let totalWeight = 0;

    for (const group of groups.values()) {
      if (group.length > 1) {
        const accuracies = group.map(s => s.actualAccuracy);
        const variance = this.calculateVariance(accuracies);
        const weight = group.length;
        
        totalVariance += variance * weight;
        totalWeight += weight;
      }
    }

    // Convert variance to reliability (lower variance = higher reliability)
    const avgVariance = totalWeight > 0 ? totalVariance / totalWeight : 0;
    return 1 - Math.min(avgVariance, 1);
  }

  private calculateDiscrimination(samples: GroundTruthData[]): number {
    // Sort by predicted confidence
    const sorted = [...samples].sort((a, b) => b.predictedConfidence - a.predictedConfidence);
    
    // Calculate AUC-like metric
    let truePositiveSum = 0;
    let falsePositiveSum = 0;
    const threshold = 0.7; // Consider > 70% accuracy as "correct"

    for (let i = 0; i < sorted.length; i++) {
      const isCorrect = sorted[i].actualAccuracy > threshold;
      
      if (isCorrect) {
        truePositiveSum += sorted.length - i;
      } else {
        falsePositiveSum += sorted.length - i;
      }
    }

    const totalPairs = (sorted.length * (sorted.length - 1)) / 2;
    return totalPairs > 0 ? truePositiveSum / totalPairs : 0;
  }

  private calculateSharpness(samples: GroundTruthData[]): number {
    const confidences = samples.map(s => s.predictedConfidence);
    return this.calculateStandardDeviation(confidences);
  }

  private calculateBrierScore(samples: GroundTruthData[]): number {
    let sum = 0;
    
    for (const sample of samples) {
      const diff = sample.predictedConfidence - sample.actualAccuracy;
      sum += diff * diff;
    }
    
    return samples.length > 0 ? sum / samples.length : 0;
  }

  // Utility methods

  private generateCacheKey(toolName: string, zoneId: string, confidence: number): string {
    return `${toolName}-${zoneId}-${confidence.toFixed(3)}`;
  }

  private isCacheValid(cached: ConfidenceScore): boolean {
    // Cache is valid for 5 minutes
    const cacheTimeout = 5 * 60 * 1000;
    return true; // Simplified - would check timestamp in real implementation
  }

  private invalidateCache(toolName?: string): void {
    if (toolName) {
      // Invalidate only entries for specific tool
      for (const key of this.confidenceCache.keys()) {
        if (key.startsWith(toolName)) {
          this.confidenceCache.delete(key);
        }
      }
    } else {
      this.confidenceCache.clear();
    }
  }

  private groupByTool(samples: GroundTruthData[]): Map<string, GroundTruthData[]> {
    const groups = new Map<string, GroundTruthData[]>();
    
    for (const sample of samples) {
      const toolSamples = groups.get(sample.toolName) || [];
      toolSamples.push(sample);
      groups.set(sample.toolName, toolSamples);
    }
    
    return groups;
  }

  private groupByConfidenceRange(samples: GroundTruthData[]): Map<string, GroundTruthData[]> {
    const rangeSize = 0.1;
    const groups = new Map<string, GroundTruthData[]>();
    
    for (const sample of samples) {
      const rangeIndex = Math.floor(sample.predictedConfidence / rangeSize);
      const rangeKey = `${rangeIndex * rangeSize}-${(rangeIndex + 1) * rangeSize}`;
      
      const rangeSamples = groups.get(rangeKey) || [];
      rangeSamples.push(sample);
      groups.set(rangeKey, rangeSamples);
    }
    
    return groups;
  }

  private groupBySimilarConfidence(samples: GroundTruthData[]): Map<string, GroundTruthData[]> {
    const tolerance = 0.05;
    const groups = new Map<string, GroundTruthData[]>();
    
    for (const sample of samples) {
      let foundGroup = false;
      
      for (const [key, group] of groups.entries()) {
        const groupConfidence = parseFloat(key);
        if (Math.abs(sample.predictedConfidence - groupConfidence) < tolerance) {
          group.push(sample);
          foundGroup = true;
          break;
        }
      }
      
      if (!foundGroup) {
        groups.set(sample.predictedConfidence.toString(), [sample]);
      }
    }
    
    return groups;
  }

  private getRecentGroundTruth(toolName: string, limit: number): GroundTruthData[] {
    return this.groundTruthDatabase
      .filter(gt => gt.toolName === toolName)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  private getToolHistoricalStats(toolName: string): any {
    const toolSamples = this.groundTruthDatabase.filter(gt => gt.toolName === toolName);
    
    if (toolSamples.length === 0) {
      return { minConfidence: 0, maxConfidence: 1 };
    }

    const confidences = toolSamples.map(s => s.predictedConfidence);
    return {
      minConfidence: Math.min(...confidences),
      maxConfidence: Math.max(...confidences)
    };
  }

  private getToolContentStats(toolName: string, contentType: string): any {
    const samples = this.groundTruthDatabase.filter(
      gt => gt.toolName === toolName && gt.contentType === contentType
    );

    if (samples.length === 0) {
      return { meanConfidence: 0.5, stdDevConfidence: 0.15 };
    }

    const confidences = samples.map(s => s.predictedConfidence);
    const mean = this.calculateMean(confidences);
    const stdDev = this.calculateStandardDeviation(confidences);

    return { meanConfidence: mean, stdDevConfidence: stdDev };
  }

  private getHistoricalScores(toolName: string, contentType: string): number[] {
    return this.groundTruthDatabase
      .filter(gt => gt.toolName === toolName && gt.contentType === contentType)
      .map(gt => gt.predictedConfidence);
  }

  private calculateHistoricalScore(
    toolName: string,
    contentType: string,
    processingHistory: ProcessingHistory[]
  ): number {
    const relevant = processingHistory.filter(
      h => h.toolName === toolName && h.contentType === contentType
    );

    if (relevant.length === 0) return 0.7;

    const scores = relevant.map(h => h.success ? h.accuracy : 0);
    return this.calculateMean(scores);
  }

  private calculateMean(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, v) => sum + v, 0) / values.length;
  }

  private calculateVariance(values: number[]): number {
    if (values.length === 0) return 0;
    
    const mean = this.calculateMean(values);
    const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
    return this.calculateMean(squaredDiffs);
  }

  private calculateStandardDeviation(values: number[]): number {
    return Math.sqrt(this.calculateVariance(values));
  }
}

// Supporting interfaces
interface WeightingFactor {
  name: string;
  weight: number;
  value: number;
}

interface CalibrationMetrics {
  calibrationError: number;      // Expected Calibration Error
  reliability: number;           // Consistency of predictions
  discrimination: number;        // Ability to separate good/bad
  sharpness: number;            // Confidence distribution spread
  brier_score: number;          // Overall accuracy metric
  modelAccuracy: number;
  sampleSize: number;
  lastUpdated: Date;
}

// Export default instance
export const toolConfidenceCalculator = new ToolConfidenceCalculator();