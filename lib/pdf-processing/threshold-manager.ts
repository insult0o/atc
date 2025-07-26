import { Zone } from '../../app/components/zones/ZoneManager';
import { ProcessingResult } from './processing-queue';
import { WeightedConfidenceScore } from './confidence-weighting';
import { MergedResult } from './result-merger';

// Dynamic threshold management system
export interface ThresholdConfiguration {
  global: GlobalThresholds;
  byContentType: ContentTypeThresholds;
  byTool: ToolThresholds;
  byQuality: QualityThresholds;
  userPreferences: UserThresholdPreferences;
  adaptiveSettings: AdaptiveThresholdSettings;
}

export interface GlobalThresholds {
  minimum: number;                  // Absolute minimum acceptable (0-1)
  target: number;                   // Target confidence level (0-1)
  optimal: number;                  // Optimal confidence level (0-1)
  reprocessThreshold: number;       // Trigger reprocessing below this (0-1)
  criticalThreshold: number;        // Critical issues below this (0-1)
}

export interface ContentTypeThresholds {
  text: ThresholdSet;
  table: ThresholdSet;
  diagram: ThresholdSet;
  mixed: ThresholdSet;
  header: ThresholdSet;
  footer: ThresholdSet;
  [key: string]: ThresholdSet;      // Allow custom content types
}

export interface ToolThresholds {
  [toolName: string]: ThresholdSet;
}

export interface QualityThresholds {
  coherence: number;
  completeness: number;
  accuracy: number;
  consistency: number;
  structure: number;
}

export interface ThresholdSet {
  minimum: number;                  // Minimum acceptable confidence
  preferred: number;                // Preferred confidence level
  optimal: number;                  // Optimal confidence level
  automatic: boolean;               // Auto-adjust based on performance
  adaptiveAdjustment: boolean;      // Enable adaptive adjustment
  adjustmentRate: number;           // How fast to adjust (0-1)
  history: ThresholdHistory[];      // Historical adjustments
}

export interface ThresholdHistory {
  timestamp: Date;
  previousValue: number;
  newValue: number;
  reason: string;
  performanceImpact: number;
}

export interface UserThresholdPreferences {
  mode: 'conservative' | 'balanced' | 'aggressive' | 'custom';
  customSettings?: CustomThresholdSettings;
  overrides: Map<string, number>;   // Specific overrides
  notifications: NotificationPreferences;
  autoApproval: AutoApprovalSettings;
}

export interface CustomThresholdSettings {
  baseMultiplier: number;           // Multiply all thresholds (0.5-1.5)
  strictnessLevel: number;          // Overall strictness (0-1)
  qualityPriority: QualityPriority;
  speedPriority: number;            // Speed vs quality tradeoff (0-1)
}

export interface QualityPriority {
  accuracy: number;                 // Weight for accuracy (0-1)
  completeness: number;             // Weight for completeness (0-1)
  consistency: number;              // Weight for consistency (0-1)
}

export interface NotificationPreferences {
  notifyBelowThreshold: boolean;
  notifyReprocessing: boolean;
  notifyCriticalIssues: boolean;
  notifyAdaptiveChanges: boolean;
  channels: NotificationChannel[];
}

export interface NotificationChannel {
  type: 'ui' | 'email' | 'webhook' | 'log';
  enabled: boolean;
  config: Record<string, any>;
}

export interface AutoApprovalSettings {
  enabled: boolean;
  minConfidence: number;            // Minimum confidence for auto-approval
  requireAllToolsAboveThreshold: boolean;
  excludeContentTypes: string[];    // Content types to never auto-approve
  maxComplexity: string;            // Maximum complexity for auto-approval
}

export interface AdaptiveThresholdSettings {
  enabled: boolean;
  learningRate: number;             // How fast to adapt (0-1)
  windowSize: number;               // Number of samples for adaptation
  minSamples: number;               // Minimum samples before adapting
  maxAdjustment: number;            // Maximum adjustment per iteration
  stabilityPeriod: number;          // Hours before allowing adjustment
}

export interface ThresholdViolation {
  type: ViolationType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  threshold: number;
  actualValue: number;
  difference: number;
  context: ViolationContext;
  recommendations: string[];
}

export type ViolationType = 
  | 'below_minimum'
  | 'below_target'
  | 'below_reprocess'
  | 'quality_issue'
  | 'tool_failure'
  | 'merge_conflict';

export interface ViolationContext {
  zone: Zone;
  tool?: string;
  contentType: string;
  processingTime: number;
  attemptNumber: number;
}

export interface ReprocessingDecision {
  shouldReprocess: boolean;
  reason: string;
  strategy: ReprocessingStrategy;
  priority: 'low' | 'medium' | 'high' | 'critical';
  estimatedImprovement: number;
}

export interface ReprocessingStrategy {
  method: 'same_tool' | 'alternative_tool' | 'multiple_tools' | 'enhanced_params';
  tools: string[];
  parameters: Record<string, any>;
  maxAttempts: number;
  backoffStrategy: 'none' | 'linear' | 'exponential';
}

export interface ThresholdOptimization {
  currentPerformance: PerformanceMetrics;
  recommendations: OptimizationRecommendation[];
  projectedImprovement: number;
  implementationPlan: ImplementationStep[];
}

export interface PerformanceMetrics {
  averageConfidence: number;
  successRate: number;
  reprocessingRate: number;
  userSatisfaction: number;
  processingEfficiency: number;
}

export interface OptimizationRecommendation {
  type: 'adjust_threshold' | 'change_strategy' | 'update_preferences' | 'tool_config';
  description: string;
  impact: 'low' | 'medium' | 'high';
  effort: 'low' | 'medium' | 'high';
  expectedImprovement: number;
  risks: string[];
}

export interface ImplementationStep {
  action: string;
  target: string;
  oldValue: any;
  newValue: any;
  rollbackPlan: string;
}

// Main threshold manager implementation
export class DynamicThresholdManager {
  private configuration: ThresholdConfiguration;
  private performanceTracker: PerformanceTracker;
  private adaptiveEngine: AdaptiveThresholdEngine;
  private violationHandler: ViolationHandler;
  private optimizationEngine: OptimizationEngine;

  constructor() {
    this.configuration = this.initializeDefaultConfiguration();
    this.performanceTracker = new PerformanceTracker();
    this.adaptiveEngine = new AdaptiveThresholdEngine();
    this.violationHandler = new ViolationHandler();
    this.optimizationEngine = new OptimizationEngine();
  }

  async evaluateResult(
    result: ProcessingResult | MergedResult,
    zone: Zone,
    toolName?: string
  ): Promise<ThresholdEvaluation> {
    const confidence = 'confidence' in result ? result.confidence : 0;
    const contentType = zone.contentType;
    
    // Get applicable thresholds
    const thresholds = this.getApplicableThresholds(contentType, toolName);
    
    // Check for violations
    const violations = this.checkViolations(confidence, thresholds, zone, toolName);
    
    // Determine if reprocessing is needed
    const reprocessingDecision = await this.determineReprocessing(
      violations,
      zone,
      toolName
    );
    
    // Update performance tracking
    await this.performanceTracker.recordResult(
      confidence,
      contentType,
      toolName,
      violations.length > 0
    );
    
    // Trigger adaptive adjustment if enabled
    if (this.configuration.adaptiveSettings.enabled) {
      await this.triggerAdaptiveAdjustment(contentType, toolName);
    }
    
    return {
      passed: violations.length === 0,
      confidence,
      thresholds,
      violations,
      reprocessingDecision,
      recommendations: this.generateRecommendations(violations, confidence, thresholds)
    };
  }

  private getApplicableThresholds(
    contentType: string,
    toolName?: string
  ): ApplicableThresholds {
    const global = this.configuration.global;
    const contentSpecific = this.configuration.byContentType[contentType] || 
      this.getDefaultThresholdSet();
    const toolSpecific = toolName ? 
      this.configuration.byTool[toolName] || this.getDefaultThresholdSet() : null;
    
    // Apply user preferences
    const adjusted = this.applyUserPreferences(
      { global, contentSpecific, toolSpecific },
      this.configuration.userPreferences
    );
    
    return adjusted;
  }

  private applyUserPreferences(
    thresholds: {
      global: GlobalThresholds;
      contentSpecific: ThresholdSet;
      toolSpecific: ThresholdSet | null;
    },
    preferences: UserThresholdPreferences
  ): ApplicableThresholds {
    let multiplier = 1.0;
    
    switch (preferences.mode) {
      case 'conservative':
        multiplier = 1.2;
        break;
      case 'aggressive':
        multiplier = 0.8;
        break;
      case 'custom':
        multiplier = preferences.customSettings?.baseMultiplier || 1.0;
        break;
    }
    
    // Apply multiplier
    const adjusted: ApplicableThresholds = {
      minimum: Math.min(1, thresholds.global.minimum * multiplier),
      target: Math.min(1, thresholds.global.target * multiplier),
      optimal: Math.min(1, thresholds.global.optimal * multiplier),
      reprocess: Math.min(1, thresholds.global.reprocessThreshold * multiplier),
      critical: Math.min(1, thresholds.global.criticalThreshold * multiplier),
      contentSpecific: Math.min(1, thresholds.contentSpecific.preferred * multiplier),
      toolSpecific: thresholds.toolSpecific ? 
        Math.min(1, thresholds.toolSpecific.preferred * multiplier) : null
    };
    
    // Apply specific overrides
    for (const [key, value] of preferences.overrides) {
      if (key in adjusted) {
        (adjusted as any)[key] = value;
      }
    }
    
    return adjusted;
  }

  private checkViolations(
    confidence: number,
    thresholds: ApplicableThresholds,
    zone: Zone,
    toolName?: string
  ): ThresholdViolation[] {
    const violations: ThresholdViolation[] = [];
    
    // Check critical threshold
    if (confidence < thresholds.critical) {
      violations.push({
        type: 'below_minimum',
        severity: 'critical',
        threshold: thresholds.critical,
        actualValue: confidence,
        difference: thresholds.critical - confidence,
        context: {
          zone,
          tool: toolName,
          contentType: zone.contentType,
          processingTime: 0,
          attemptNumber: 1
        },
        recommendations: [
          'Critical confidence level - manual review required',
          'Consider using multiple tools for verification',
          'Check document quality and preprocessing'
        ]
      });
    }
    
    // Check reprocess threshold
    else if (confidence < thresholds.reprocess) {
      violations.push({
        type: 'below_reprocess',
        severity: 'high',
        threshold: thresholds.reprocess,
        actualValue: confidence,
        difference: thresholds.reprocess - confidence,
        context: {
          zone,
          tool: toolName,
          contentType: zone.contentType,
          processingTime: 0,
          attemptNumber: 1
        },
        recommendations: [
          'Confidence below reprocessing threshold',
          'Try alternative extraction tools',
          'Adjust processing parameters'
        ]
      });
    }
    
    // Check minimum threshold
    else if (confidence < thresholds.minimum) {
      violations.push({
        type: 'below_minimum',
        severity: 'medium',
        threshold: thresholds.minimum,
        actualValue: confidence,
        difference: thresholds.minimum - confidence,
        context: {
          zone,
          tool: toolName,
          contentType: zone.contentType,
          processingTime: 0,
          attemptNumber: 1
        },
        recommendations: [
          'Below minimum acceptable confidence',
          'Review extraction results carefully',
          'Consider manual verification'
        ]
      });
    }
    
    // Check target threshold
    else if (confidence < thresholds.target) {
      violations.push({
        type: 'below_target',
        severity: 'low',
        threshold: thresholds.target,
        actualValue: confidence,
        difference: thresholds.target - confidence,
        context: {
          zone,
          tool: toolName,
          contentType: zone.contentType,
          processingTime: 0,
          attemptNumber: 1
        },
        recommendations: [
          'Below target confidence level',
          'Results acceptable but could be improved',
          'Monitor for patterns'
        ]
      });
    }
    
    return violations;
  }

  private async determineReprocessing(
    violations: ThresholdViolation[],
    zone: Zone,
    toolName?: string
  ): Promise<ReprocessingDecision> {
    // No violations, no reprocessing needed
    if (violations.length === 0) {
      return {
        shouldReprocess: false,
        reason: 'Confidence meets all thresholds',
        strategy: {
          method: 'none',
          tools: [],
          parameters: {},
          maxAttempts: 0,
          backoffStrategy: 'none'
        },
        priority: 'low',
        estimatedImprovement: 0
      };
    }
    
    // Find most severe violation
    const mostSevere = violations.reduce((prev, current) => 
      this.getSeverityScore(current.severity) > this.getSeverityScore(prev.severity) ? current : prev
    );
    
    // Critical violations always trigger reprocessing
    if (mostSevere.severity === 'critical') {
      return {
        shouldReprocess: true,
        reason: 'Critical confidence threshold violation',
        strategy: this.determineReprocessingStrategy(zone, toolName, 'critical'),
        priority: 'critical',
        estimatedImprovement: 0.3
      };
    }
    
    // High severity (below reprocess threshold)
    if (mostSevere.type === 'below_reprocess') {
      return {
        shouldReprocess: true,
        reason: 'Confidence below reprocessing threshold',
        strategy: this.determineReprocessingStrategy(zone, toolName, 'high'),
        priority: 'high',
        estimatedImprovement: 0.2
      };
    }
    
    // Medium severity - check if reprocessing would help
    if (mostSevere.severity === 'medium') {
      const improvement = await this.estimateReprocessingImprovement(zone, toolName);
      
      if (improvement > 0.1) {
        return {
          shouldReprocess: true,
          reason: 'Reprocessing likely to improve results',
          strategy: this.determineReprocessingStrategy(zone, toolName, 'medium'),
          priority: 'medium',
          estimatedImprovement: improvement
        };
      }
    }
    
    // No reprocessing for low severity
    return {
      shouldReprocess: false,
      reason: 'Minor threshold violation - reprocessing not recommended',
      strategy: {
        method: 'none',
        tools: [],
        parameters: {},
        maxAttempts: 0,
        backoffStrategy: 'none'
      },
      priority: 'low',
      estimatedImprovement: 0
    };
  }

  private determineReprocessingStrategy(
    zone: Zone,
    currentTool?: string,
    severity: string
  ): ReprocessingStrategy {
    const contentType = zone.contentType;
    
    // For critical issues, try multiple tools
    if (severity === 'critical') {
      return {
        method: 'multiple_tools',
        tools: this.getAlternativeTools(contentType, currentTool),
        parameters: {
          enhanced: true,
          quality: 'high',
          timeout: 30000
        },
        maxAttempts: 3,
        backoffStrategy: 'exponential'
      };
    }
    
    // For high severity, try alternative tool
    if (severity === 'high') {
      const alternatives = this.getAlternativeTools(contentType, currentTool);
      return {
        method: 'alternative_tool',
        tools: alternatives.slice(0, 1),
        parameters: {
          quality: 'high'
        },
        maxAttempts: 2,
        backoffStrategy: 'linear'
      };
    }
    
    // For medium, try same tool with enhanced params
    return {
      method: 'enhanced_params',
      tools: currentTool ? [currentTool] : [],
      parameters: {
        enhanced: true,
        denoise: true,
        ocr_confidence: 0.8
      },
      maxAttempts: 1,
      backoffStrategy: 'none'
    };
  }

  private getAlternativeTools(contentType: string, exclude?: string): string[] {
    const toolsByContent: Record<string, string[]> = {
      'text': ['unstructured', 'pdfplumber', 'pymupdf'],
      'table': ['camelot', 'tabula', 'pdfplumber'],
      'diagram': ['visual_analyzer', 'unstructured'],
      'mixed': ['unstructured', 'pdfplumber', 'visual_analyzer']
    };
    
    const tools = toolsByContent[contentType] || ['unstructured'];
    return tools.filter(t => t !== exclude);
  }

  private async estimateReprocessingImprovement(
    zone: Zone,
    toolName?: string
  ): Promise<number> {
    // Estimate based on historical data
    const historicalImprovement = await this.performanceTracker.getAverageImprovement(
      zone.contentType,
      toolName
    );
    
    // Adjust based on zone characteristics
    let estimate = historicalImprovement;
    
    if (zone.characteristics.complexity === 'high') {
      estimate *= 0.8; // Less improvement expected for complex content
    }
    
    if (zone.characteristics.hasStructure) {
      estimate *= 1.1; // More improvement possible with structure
    }
    
    return Math.min(0.5, Math.max(0, estimate));
  }

  private getSeverityScore(severity: string): number {
    const scores: Record<string, number> = {
      'low': 1,
      'medium': 2,
      'high': 3,
      'critical': 4
    };
    return scores[severity] || 0;
  }

  private generateRecommendations(
    violations: ThresholdViolation[],
    confidence: number,
    thresholds: ApplicableThresholds
  ): string[] {
    const recommendations: string[] = [];
    
    // Add violation-specific recommendations
    for (const violation of violations) {
      recommendations.push(...violation.recommendations);
    }
    
    // Add general recommendations
    if (confidence < thresholds.target) {
      const gap = thresholds.target - confidence;
      if (gap > 0.2) {
        recommendations.push('Large confidence gap - consider document preprocessing');
      }
    }
    
    // Add threshold adjustment recommendations
    if (violations.length > 0 && this.configuration.adaptiveSettings.enabled) {
      recommendations.push('Adaptive threshold adjustment may help improve results');
    }
    
    return [...new Set(recommendations)]; // Remove duplicates
  }

  private async triggerAdaptiveAdjustment(
    contentType: string,
    toolName?: string
  ): Promise<void> {
    const settings = this.configuration.adaptiveSettings;
    
    // Check if we have enough samples
    const sampleCount = await this.performanceTracker.getSampleCount(contentType, toolName);
    if (sampleCount < settings.minSamples) {
      return;
    }
    
    // Check stability period
    const lastAdjustment = await this.adaptiveEngine.getLastAdjustmentTime(contentType, toolName);
    const hoursSinceAdjustment = (Date.now() - lastAdjustment) / (1000 * 60 * 60);
    
    if (hoursSinceAdjustment < settings.stabilityPeriod) {
      return;
    }
    
    // Calculate new thresholds
    const performance = await this.performanceTracker.getRecentPerformance(
      contentType,
      toolName,
      settings.windowSize
    );
    
    const adjustments = await this.adaptiveEngine.calculateAdjustments(
      performance,
      this.getThresholdSet(contentType, toolName),
      settings
    );
    
    // Apply adjustments
    if (adjustments.length > 0) {
      await this.applyThresholdAdjustments(adjustments, contentType, toolName);
    }
  }

  private getThresholdSet(contentType: string, toolName?: string): ThresholdSet {
    if (toolName && this.configuration.byTool[toolName]) {
      return this.configuration.byTool[toolName];
    }
    return this.configuration.byContentType[contentType] || this.getDefaultThresholdSet();
  }

  private async applyThresholdAdjustments(
    adjustments: ThresholdAdjustment[],
    contentType: string,
    toolName?: string
  ): Promise<void> {
    for (const adjustment of adjustments) {
      const targetSet = toolName ? 
        this.configuration.byTool[toolName] :
        this.configuration.byContentType[contentType];
      
      if (targetSet) {
        // Record history
        targetSet.history.push({
          timestamp: new Date(),
          previousValue: targetSet[adjustment.field as keyof ThresholdSet] as number,
          newValue: adjustment.newValue,
          reason: adjustment.reason,
          performanceImpact: adjustment.expectedImpact
        });
        
        // Apply adjustment
        (targetSet as any)[adjustment.field] = adjustment.newValue;
        
        // Notify if enabled
        if (this.configuration.userPreferences.notifications.notifyAdaptiveChanges) {
          await this.sendNotification('threshold_adjusted', {
            contentType,
            toolName,
            adjustment
          });
        }
      }
    }
  }

  private async sendNotification(type: string, data: any): Promise<void> {
    // Implementation would send notifications through configured channels
    console.log(`Notification: ${type}`, data);
  }

  // Public methods
  async getConfiguration(): Promise<ThresholdConfiguration> {
    return { ...this.configuration };
  }

  async updateConfiguration(updates: Partial<ThresholdConfiguration>): Promise<void> {
    Object.assign(this.configuration, updates);
  }

  async updateUserPreferences(preferences: UserThresholdPreferences): Promise<void> {
    this.configuration.userPreferences = preferences;
  }

  async getOptimizationRecommendations(): Promise<ThresholdOptimization> {
    const performance = await this.performanceTracker.getOverallPerformance();
    const recommendations = await this.optimizationEngine.generateRecommendations(
      performance,
      this.configuration
    );
    
    return recommendations;
  }

  async checkAutoApproval(
    result: ProcessingResult | MergedResult,
    zone: Zone
  ): Promise<boolean> {
    const settings = this.configuration.userPreferences.autoApproval;
    
    if (!settings.enabled) {
      return false;
    }
    
    const confidence = 'confidence' in result ? result.confidence : 0;
    
    // Check confidence threshold
    if (confidence < settings.minConfidence) {
      return false;
    }
    
    // Check excluded content types
    if (settings.excludeContentTypes.includes(zone.contentType)) {
      return false;
    }
    
    // Check complexity
    if (zone.characteristics.complexity > settings.maxComplexity) {
      return false;
    }
    
    // Check all tools requirement
    if (settings.requireAllToolsAboveThreshold && 'contributingSources' in result) {
      const allAbove = result.contributingSources.every(
        source => source.confidence.finalConfidence >= settings.minConfidence
      );
      if (!allAbove) {
        return false;
      }
    }
    
    return true;
  }

  private initializeDefaultConfiguration(): ThresholdConfiguration {
    return {
      global: {
        minimum: 0.6,
        target: 0.75,
        optimal: 0.85,
        reprocessThreshold: 0.5,
        criticalThreshold: 0.4
      },
      byContentType: {
        text: this.createContentThresholdSet(0.7, 0.8, 0.9),
        table: this.createContentThresholdSet(0.65, 0.75, 0.85),
        diagram: this.createContentThresholdSet(0.6, 0.7, 0.8),
        mixed: this.createContentThresholdSet(0.65, 0.75, 0.85),
        header: this.createContentThresholdSet(0.75, 0.85, 0.95),
        footer: this.createContentThresholdSet(0.75, 0.85, 0.95)
      },
      byTool: {
        unstructured: this.createToolThresholdSet(0.7, 0.8, 0.9),
        pdfplumber: this.createToolThresholdSet(0.65, 0.75, 0.85),
        camelot: this.createToolThresholdSet(0.7, 0.8, 0.9),
        tabula: this.createToolThresholdSet(0.65, 0.75, 0.85),
        visual_analyzer: this.createToolThresholdSet(0.6, 0.7, 0.8)
      },
      byQuality: {
        coherence: 0.7,
        completeness: 0.75,
        accuracy: 0.8,
        consistency: 0.7,
        structure: 0.65
      },
      userPreferences: {
        mode: 'balanced',
        overrides: new Map(),
        notifications: {
          notifyBelowThreshold: true,
          notifyReprocessing: true,
          notifyCriticalIssues: true,
          notifyAdaptiveChanges: false,
          channels: [
            {
              type: 'ui',
              enabled: true,
              config: {}
            }
          ]
        },
        autoApproval: {
          enabled: false,
          minConfidence: 0.8,
          requireAllToolsAboveThreshold: false,
          excludeContentTypes: ['diagram'],
          maxComplexity: 'medium'
        }
      },
      adaptiveSettings: {
        enabled: true,
        learningRate: 0.01,
        windowSize: 100,
        minSamples: 50,
        maxAdjustment: 0.1,
        stabilityPeriod: 24
      }
    };
  }

  private createContentThresholdSet(min: number, pref: number, opt: number): ThresholdSet {
    return {
      minimum: min,
      preferred: pref,
      optimal: opt,
      automatic: true,
      adaptiveAdjustment: true,
      adjustmentRate: 0.05,
      history: []
    };
  }

  private createToolThresholdSet(min: number, pref: number, opt: number): ThresholdSet {
    return {
      minimum: min,
      preferred: pref,
      optimal: opt,
      automatic: true,
      adaptiveAdjustment: true,
      adjustmentRate: 0.03,
      history: []
    };
  }

  private getDefaultThresholdSet(): ThresholdSet {
    return this.createContentThresholdSet(0.6, 0.75, 0.85);
  }
}

// Supporting classes
class PerformanceTracker {
  private performanceData: Map<string, PerformanceData[]> = new Map();

  async recordResult(
    confidence: number,
    contentType: string,
    toolName?: string,
    violated: boolean = false
  ): Promise<void> {
    const key = this.getKey(contentType, toolName);
    
    if (!this.performanceData.has(key)) {
      this.performanceData.set(key, []);
    }
    
    this.performanceData.get(key)!.push({
      timestamp: new Date(),
      confidence,
      violated,
      reprocessed: false,
      finalConfidence: confidence
    });
    
    // Keep only recent data
    const data = this.performanceData.get(key)!;
    if (data.length > 1000) {
      data.splice(0, data.length - 1000);
    }
  }

  async getSampleCount(contentType: string, toolName?: string): Promise<number> {
    const key = this.getKey(contentType, toolName);
    return this.performanceData.get(key)?.length || 0;
  }

  async getRecentPerformance(
    contentType: string,
    toolName?: string,
    windowSize: number
  ): Promise<RecentPerformance> {
    const key = this.getKey(contentType, toolName);
    const data = this.performanceData.get(key) || [];
    const recent = data.slice(-windowSize);
    
    if (recent.length === 0) {
      return {
        averageConfidence: 0.7,
        violationRate: 0,
        successRate: 1,
        trend: 'stable'
      };
    }
    
    const avgConfidence = recent.reduce((sum, d) => sum + d.confidence, 0) / recent.length;
    const violations = recent.filter(d => d.violated).length;
    const violationRate = violations / recent.length;
    const successRate = 1 - violationRate;
    
    // Calculate trend
    const firstHalf = recent.slice(0, recent.length / 2);
    const secondHalf = recent.slice(recent.length / 2);
    
    const firstAvg = firstHalf.reduce((sum, d) => sum + d.confidence, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, d) => sum + d.confidence, 0) / secondHalf.length;
    
    let trend: 'improving' | 'stable' | 'declining';
    if (secondAvg > firstAvg + 0.05) trend = 'improving';
    else if (secondAvg < firstAvg - 0.05) trend = 'declining';
    else trend = 'stable';
    
    return {
      averageConfidence: avgConfidence,
      violationRate,
      successRate,
      trend
    };
  }

  async getAverageImprovement(contentType: string, toolName?: string): Promise<number> {
    const key = this.getKey(contentType, toolName);
    const data = this.performanceData.get(key) || [];
    
    // Find reprocessed entries and calculate improvement
    let totalImprovement = 0;
    let count = 0;
    
    for (let i = 1; i < data.length; i++) {
      if (data[i].reprocessed && data[i-1].violated) {
        const improvement = data[i].finalConfidence - data[i-1].confidence;
        totalImprovement += improvement;
        count++;
      }
    }
    
    return count > 0 ? totalImprovement / count : 0.15; // Default 15% improvement
  }

  async getOverallPerformance(): Promise<PerformanceMetrics> {
    let totalConfidence = 0;
    let totalSamples = 0;
    let totalViolations = 0;
    let totalReprocessed = 0;
    
    for (const data of this.performanceData.values()) {
      for (const sample of data) {
        totalConfidence += sample.confidence;
        totalSamples++;
        if (sample.violated) totalViolations++;
        if (sample.reprocessed) totalReprocessed++;
      }
    }
    
    if (totalSamples === 0) {
      return {
        averageConfidence: 0.7,
        successRate: 0.75,
        reprocessingRate: 0.1,
        userSatisfaction: 0.8,
        processingEfficiency: 0.85
      };
    }
    
    return {
      averageConfidence: totalConfidence / totalSamples,
      successRate: 1 - (totalViolations / totalSamples),
      reprocessingRate: totalReprocessed / totalSamples,
      userSatisfaction: 0.8, // Would be from user feedback
      processingEfficiency: 1 - (totalReprocessed / totalSamples) * 0.5
    };
  }

  private getKey(contentType: string, toolName?: string): string {
    return toolName ? `${contentType}_${toolName}` : contentType;
  }
}

class AdaptiveThresholdEngine {
  private adjustmentHistory: Map<string, Date> = new Map();

  async getLastAdjustmentTime(contentType: string, toolName?: string): Promise<number> {
    const key = this.getKey(contentType, toolName);
    const lastTime = this.adjustmentHistory.get(key);
    return lastTime ? lastTime.getTime() : 0;
  }

  async calculateAdjustments(
    performance: RecentPerformance,
    currentThresholds: ThresholdSet,
    settings: AdaptiveThresholdSettings
  ): Promise<ThresholdAdjustment[]> {
    const adjustments: ThresholdAdjustment[] = [];
    
    // Adjust minimum threshold based on success rate
    if (performance.successRate < 0.7 && currentThresholds.minimum > 0.5) {
      // Lower threshold if too many failures
      const adjustment = Math.min(
        settings.maxAdjustment,
        settings.learningRate * (0.7 - performance.successRate)
      );
      
      adjustments.push({
        field: 'minimum',
        oldValue: currentThresholds.minimum,
        newValue: Math.max(0.5, currentThresholds.minimum - adjustment),
        reason: 'High failure rate - lowering minimum threshold',
        expectedImpact: 0.1
      });
    } else if (performance.successRate > 0.95 && performance.averageConfidence > currentThresholds.preferred) {
      // Raise threshold if consistently exceeding
      const adjustment = Math.min(
        settings.maxAdjustment,
        settings.learningRate * (performance.averageConfidence - currentThresholds.preferred)
      );
      
      adjustments.push({
        field: 'minimum',
        oldValue: currentThresholds.minimum,
        newValue: Math.min(0.9, currentThresholds.minimum + adjustment),
        reason: 'Consistently high performance - raising minimum threshold',
        expectedImpact: 0.05
      });
    }
    
    // Adjust preferred threshold based on average confidence
    if (performance.trend === 'improving' && performance.averageConfidence > currentThresholds.preferred) {
      const adjustment = Math.min(
        settings.maxAdjustment / 2,
        settings.learningRate * 0.5
      );
      
      adjustments.push({
        field: 'preferred',
        oldValue: currentThresholds.preferred,
        newValue: Math.min(0.95, currentThresholds.preferred + adjustment),
        reason: 'Improving trend - raising preferred threshold',
        expectedImpact: 0.03
      });
    }
    
    // Record adjustment time
    if (adjustments.length > 0) {
      const key = this.getKey('', ''); // Simplified
      this.adjustmentHistory.set(key, new Date());
    }
    
    return adjustments;
  }

  private getKey(contentType: string, toolName?: string): string {
    return toolName ? `${contentType}_${toolName}` : contentType;
  }
}

class ViolationHandler {
  handleViolation(violation: ThresholdViolation): void {
    // Log violation
    console.warn('Threshold violation:', violation);
    
    // Additional handling based on severity
    if (violation.severity === 'critical') {
      // Critical violations might trigger alerts
      this.handleCriticalViolation(violation);
    }
  }

  private handleCriticalViolation(violation: ThresholdViolation): void {
    // Implement critical violation handling
    console.error('CRITICAL threshold violation detected:', violation);
  }
}

class OptimizationEngine {
  async generateRecommendations(
    performance: PerformanceMetrics,
    configuration: ThresholdConfiguration
  ): Promise<ThresholdOptimization> {
    const recommendations: OptimizationRecommendation[] = [];
    
    // Check if thresholds are too strict
    if (performance.successRate < 0.7) {
      recommendations.push({
        type: 'adjust_threshold',
        description: 'Lower minimum thresholds to reduce failures',
        impact: 'high',
        effort: 'low',
        expectedImprovement: 0.2,
        risks: ['May accept lower quality results']
      });
    }
    
    // Check if reprocessing rate is high
    if (performance.reprocessingRate > 0.2) {
      recommendations.push({
        type: 'change_strategy',
        description: 'Adjust reprocessing strategy to be more selective',
        impact: 'medium',
        effort: 'medium',
        expectedImprovement: 0.15,
        risks: ['Some low-confidence results may not be improved']
      });
    }
    
    // Check if adaptive settings could help
    if (!configuration.adaptiveSettings.enabled && performance.averageConfidence < 0.75) {
      recommendations.push({
        type: 'update_preferences',
        description: 'Enable adaptive threshold adjustment',
        impact: 'high',
        effort: 'low',
        expectedImprovement: 0.1,
        risks: ['Thresholds will change automatically']
      });
    }
    
    const implementationPlan = this.createImplementationPlan(recommendations, configuration);
    
    return {
      currentPerformance: performance,
      recommendations,
      projectedImprovement: recommendations.reduce((sum, r) => sum + r.expectedImprovement, 0),
      implementationPlan
    };
  }

  private createImplementationPlan(
    recommendations: OptimizationRecommendation[],
    configuration: ThresholdConfiguration
  ): ImplementationStep[] {
    const steps: ImplementationStep[] = [];
    
    for (const rec of recommendations) {
      switch (rec.type) {
        case 'adjust_threshold':
          steps.push({
            action: 'Update global minimum threshold',
            target: 'configuration.global.minimum',
            oldValue: configuration.global.minimum,
            newValue: configuration.global.minimum * 0.9,
            rollbackPlan: 'Restore original threshold value'
          });
          break;
          
        case 'update_preferences':
          steps.push({
            action: 'Enable adaptive settings',
            target: 'configuration.adaptiveSettings.enabled',
            oldValue: configuration.adaptiveSettings.enabled,
            newValue: true,
            rollbackPlan: 'Disable adaptive settings'
          });
          break;
      }
    }
    
    return steps;
  }
}

// Helper interfaces
interface ThresholdEvaluation {
  passed: boolean;
  confidence: number;
  thresholds: ApplicableThresholds;
  violations: ThresholdViolation[];
  reprocessingDecision: ReprocessingDecision;
  recommendations: string[];
}

interface ApplicableThresholds {
  minimum: number;
  target: number;
  optimal: number;
  reprocess: number;
  critical: number;
  contentSpecific: number;
  toolSpecific: number | null;
}

interface PerformanceData {
  timestamp: Date;
  confidence: number;
  violated: boolean;
  reprocessed: boolean;
  finalConfidence: number;
}

interface RecentPerformance {
  averageConfidence: number;
  violationRate: number;
  successRate: number;
  trend: 'improving' | 'stable' | 'declining';
}

interface ThresholdAdjustment {
  field: string;
  oldValue: number;
  newValue: number;
  reason: string;
  expectedImpact: number;
}

// Export singleton instance
export const thresholdManager = new DynamicThresholdManager();