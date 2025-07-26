import { Zone } from '../../app/components/zones/ZoneManager';
import { ToolAssignmentResult, AssignedTool } from './tool-assignment';
import { ProcessingResult, ProcessingError, QueuedZone } from './processing-queue';
import { ConfidenceScore } from './confidence-engine';

// Core interfaces for fallback management
export interface FallbackManager {
  shouldFallback(result: ProcessingResult, context: FallbackContext): Promise<FallbackDecision>;
  selectFallbackTool(
    originalTool: string, 
    zone: Zone, 
    error: ProcessingError,
    context: FallbackContext
  ): Promise<FallbackToolSelection>;
  executeRetry(
    zone: QueuedZone, 
    fallbackTool: AssignedTool, 
    attempt: number
  ): Promise<RetryResult>;
  mergeResults(results: ProcessingResult[]): Promise<MergedResult>;
  getStrategy(toolName: string, errorType: string): FallbackStrategy;
}

export interface FallbackDecision {
  shouldFallback: boolean;
  reason: FallbackReason;
  confidence: number;
  urgency: FallbackUrgency;
  recommendedAction: FallbackAction;
  alternatives: FallbackAlternative[];
}

export interface FallbackContext {
  zone: Zone;
  originalToolAssignment: ToolAssignmentResult;
  processingHistory: ProcessingAttempt[];
  systemResources: SystemResourceSnapshot;
  qualityRequirements: QualityRequirements;
  timeConstraints: TimeConstraints;
  userPreferences: UserFallbackPreferences;
}

export interface SystemResourceSnapshot {
  availableMemory: number;
  cpuUtilization: number;
  activeProcessingJobs: number;
  queueLength: number;
  averageWaitTime: number;
}

export interface QualityRequirements {
  minimumAcceptableConfidence: number;
  requireCrossValidation: boolean;
  allowApproximateResults: boolean;
  maxAcceptableErrorRate: number;
}

export interface TimeConstraints {
  maxTotalProcessingTime: number;
  maxRetryTime: number;
  deadlineTimestamp?: Date;
  processingPriority: 'low' | 'medium' | 'high' | 'urgent';
}

export interface UserFallbackPreferences {
  aggressiveness: 'conservative' | 'balanced' | 'aggressive';
  maxRetryAttempts: number;
  allowCostlyFallbacks: boolean;
  preferredFallbackTools: string[];
  restrictedFallbackTools: string[];
}

export type FallbackReason = 
  | 'low_confidence'
  | 'processing_error'
  | 'timeout'
  | 'quality_threshold_not_met'
  | 'validation_failed'
  | 'resource_exhaustion'
  | 'tool_unavailable'
  | 'user_request';

export type FallbackUrgency = 'low' | 'medium' | 'high' | 'critical';

export type FallbackAction = 
  | 'retry_same_tool'
  | 'try_alternative_tool'
  | 'merge_multiple_tools'
  | 'manual_intervention'
  | 'accept_partial_result'
  | 'abort_processing';

export interface FallbackAlternative {
  toolName: string;
  expectedImprovement: number;
  confidence: number;
  estimatedTime: number;
  resourceCost: number;
  riskLevel: 'low' | 'medium' | 'high';
}

export interface FallbackToolSelection {
  selectedTool: AssignedTool;
  selectionReason: string;
  expectedOutcome: ExpectedOutcome;
  fallbackChain: string[];
  resourceRequirements: ResourceRequirement[];
}

export interface ExpectedOutcome {
  successProbability: number;
  expectedConfidence: number;
  estimatedProcessingTime: number;
  qualityImprovement: number;
  riskFactors: RiskFactor[];
}

export interface RiskFactor {
  type: 'performance' | 'quality' | 'resource' | 'time';
  severity: number;
  description: string;
  mitigation?: string;
}

export interface RetryResult {
  success: boolean;
  result?: ProcessingResult;
  error?: ProcessingError;
  nextRecommendation?: RetryRecommendation;
  resourcesUsed: ResourceUsage;
  lessons: RetryLesson[];
}

export interface RetryRecommendation {
  action: 'retry' | 'try_different_tool' | 'escalate' | 'abort';
  reason: string;
  waitTime?: number;
  suggestedTool?: string;
  confidence: number;
}

export interface RetryLesson {
  insight: string;
  applicability: string[];
  confidence: number;
  actionable: boolean;
}

export interface ResourceUsage {
  memoryMB: number;
  cpuTime: number;
  wallClockTime: number;
  networkIO: number;
  diskIO: number;
}

export interface MergedResult {
  content: string;
  confidence: number;
  sources: ResultSource[];
  mergeMethod: MergeMethod;
  qualityMetrics: MergeQualityMetrics;
  conflicts: ResultConflict[];
  reliability: number;
}

export interface ResultSource {
  toolName: string;
  result: ProcessingResult;
  weight: number;
  contributionAreas: string[];
}

export interface MergeQualityMetrics {
  coherence: number;
  completeness: number;
  consistency: number;
  redundancy: number;
  coverage: number;
}

export interface ResultConflict {
  area: string;
  conflictingValues: string[];
  severity: 'low' | 'medium' | 'high';
  resolution: string;
  confidence: number;
}

export type MergeMethod = 
  | 'highest_confidence'
  | 'weighted_average'
  | 'consensus_voting'
  | 'expert_system'
  | 'machine_learning'
  | 'hybrid';

// Strategy definitions
export interface FallbackStrategy {
  name: string;
  toolName: string;
  errorTypes: string[];
  fallbackOptions: FallbackOption[];
  retryPolicy: RetryPolicy;
  escalationRules: EscalationRule[];
  resourceLimits: ResourceLimits;
}

export interface FallbackOption {
  toolName: string;
  triggerConditions: TriggerCondition[];
  priority: number;
  expectedImprovement: number;
  resourceCost: number;
  timeEstimate: number;
  successRate: number;
}

export interface TriggerCondition {
  type: 'confidence_threshold' | 'error_type' | 'resource_availability' | 'time_constraint';
  operator: 'lt' | 'gt' | 'eq' | 'contains';
  value: any;
  weight: number;
}

export interface RetryPolicy {
  maxAttempts: number;
  baseDelayMs: number;
  exponentialBackoff: boolean;
  backoffMultiplier: number;
  jitterPercent: number;
  retryableErrors: string[];
}

export interface EscalationRule {
  condition: string;
  action: 'manual_review' | 'expert_intervention' | 'alternative_pipeline' | 'accept_failure';
  threshold: number;
  notificationTargets: string[];
}

export interface ResourceLimits {
  maxMemoryMB: number;
  maxCpuTime: number;
  maxWallClockTime: number;
  maxConcurrentRetries: number;
}

// Main IntelligentFallbackManager implementation
export class IntelligentFallbackManager implements FallbackManager {
  private strategies: Map<string, FallbackStrategy>;
  private performanceHistory: Map<string, PerformanceMetrics>;
  private learningSystem: FallbackLearningSystem;
  private decisionEngine: FallbackDecisionEngine;
  private toolComparator: ToolComparator;

  constructor() {
    this.strategies = this.initializeFallbackStrategies();
    this.performanceHistory = new Map();
    this.learningSystem = new FallbackLearningSystemImpl();
    this.decisionEngine = new FallbackDecisionEngineImpl();
    this.toolComparator = new ToolComparatorImpl();
  }

  async shouldFallback(
    result: ProcessingResult, 
    context: FallbackContext
  ): Promise<FallbackDecision> {
    const decision = await this.decisionEngine.evaluate(result, context);
    
    // Learn from this decision for future improvements
    await this.learningSystem.recordDecision(decision, context);
    
    return decision;
  }

  async selectFallbackTool(
    originalTool: string,
    zone: Zone,
    error: ProcessingError,
    context: FallbackContext
  ): Promise<FallbackToolSelection> {
    // Get available fallback options
    const strategy = this.getStrategy(originalTool, error.type);
    const candidateTools = this.filterCandidateTools(strategy.fallbackOptions, context);

    // Score and rank tools
    const scoredTools = await this.scoreTools(candidateTools, zone, error, context);
    
    if (scoredTools.length === 0) {
      throw new Error('No suitable fallback tools available');
    }

    const selectedTool = scoredTools[0];
    
    return {
      selectedTool: selectedTool.tool,
      selectionReason: selectedTool.reasoning,
      expectedOutcome: selectedTool.expectedOutcome,
      fallbackChain: this.buildFallbackChain(originalTool, selectedTool.tool.name),
      resourceRequirements: selectedTool.tool.configuration.resourceLimits ? [
        {
          type: 'memory',
          amount: selectedTool.tool.configuration.resourceLimits.maxMemoryMB,
          duration: selectedTool.expectedOutcome.estimatedProcessingTime,
          priority: 'high',
          flexible: false
        }
      ] : []
    };
  }

  async executeRetry(
    zone: QueuedZone,
    fallbackTool: AssignedTool,
    attempt: number
  ): Promise<RetryResult> {
    const startTime = performance.now();
    const resourceTracker = new ResourceTracker();
    
    try {
      resourceTracker.start();
      
      // Calculate retry delay
      const retryDelay = this.calculateRetryDelay(attempt, zone.toolAssignment.primaryTool.name);
      if (retryDelay > 0) {
        await this.sleep(retryDelay);
      }

      // Execute processing with fallback tool
      const result = await this.processWithFallbackTool(zone.zone, fallbackTool);
      
      // Analyze result quality
      const qualityAssessment = await this.assessResultQuality(result, zone.zone);
      
      const resourcesUsed = resourceTracker.stop();
      const lessons = await this.extractLessons(zone, fallbackTool, result, attempt);

      return {
        success: qualityAssessment.acceptable,
        result: qualityAssessment.acceptable ? result : undefined,
        error: qualityAssessment.acceptable ? undefined : {
          code: 'QUALITY_THRESHOLD_NOT_MET',
          message: `Result quality ${qualityAssessment.score} below threshold`,
          type: 'validation_error',
          severity: 'medium',
          recoverable: true,
          details: { qualityAssessment },
          timestamp: new Date()
        },
        nextRecommendation: await this.generateNextRecommendation(
          zone, 
          fallbackTool, 
          result, 
          attempt,
          qualityAssessment
        ),
        resourcesUsed,
        lessons
      };

    } catch (error) {
      const resourcesUsed = resourceTracker.stop();
      const processingError = this.wrapError(error, fallbackTool);
      
      return {
        success: false,
        error: processingError,
        nextRecommendation: await this.generateErrorRecoveryRecommendation(
          zone, 
          fallbackTool, 
          processingError, 
          attempt
        ),
        resourcesUsed,
        lessons: await this.extractLessons(zone, fallbackTool, undefined, attempt, processingError)
      };
    }
  }

  async mergeResults(results: ProcessingResult[]): Promise<MergedResult> {
    if (results.length === 0) {
      throw new Error('No results to merge');
    }

    if (results.length === 1) {
      return this.createSingleResultMerge(results[0]);
    }

    // Determine optimal merge method
    const mergeMethod = this.selectMergeMethod(results);
    
    // Execute merge based on method
    switch (mergeMethod) {
      case 'highest_confidence':
        return await this.mergeByHighestConfidence(results);
      case 'weighted_average':
        return await this.mergeByWeightedAverage(results);
      case 'consensus_voting':
        return await this.mergeByCensensus(results);
      case 'expert_system':
        return await this.mergeByExpertSystem(results);
      default:
        return await this.mergeByHighestConfidence(results);
    }
  }

  getStrategy(toolName: string, errorType: string): FallbackStrategy {
    const strategy = this.strategies.get(toolName);
    if (!strategy) {
      return this.getDefaultStrategy(errorType);
    }

    // Check if strategy handles this error type
    if (strategy.errorTypes.includes(errorType) || strategy.errorTypes.includes('*')) {
      return strategy;
    }

    return this.getDefaultStrategy(errorType);
  }

  // Private implementation methods
  private initializeFallbackStrategies(): Map<string, FallbackStrategy> {
    const strategies = new Map<string, FallbackStrategy>();

    // Unstructured strategy
    strategies.set('unstructured', {
      name: 'Unstructured Fallback Strategy',
      toolName: 'unstructured',
      errorTypes: ['*'],
      fallbackOptions: [
        {
          toolName: 'pdfplumber',
          triggerConditions: [
            { type: 'confidence_threshold', operator: 'lt', value: 0.7, weight: 1.0 }
          ],
          priority: 1,
          expectedImprovement: 0.15,
          resourceCost: 1.2,
          timeEstimate: 1500,
          successRate: 0.85
        },
        {
          toolName: 'ocr_engine',
          triggerConditions: [
            { type: 'error_type', operator: 'contains', value: 'text_extraction', weight: 1.0 }
          ],
          priority: 2,
          expectedImprovement: 0.25,
          resourceCost: 2.0,
          timeEstimate: 3000,
          successRate: 0.75
        }
      ],
      retryPolicy: {
        maxAttempts: 3,
        baseDelayMs: 1000,
        exponentialBackoff: true,
        backoffMultiplier: 2.0,
        jitterPercent: 10,
        retryableErrors: ['timeout_error', 'resource_error', 'tool_error']
      },
      escalationRules: [
        {
          condition: 'attempts >= 3 AND confidence < 0.5',
          action: 'manual_review',
          threshold: 0.5,
          notificationTargets: ['quality_team']
        }
      ],
      resourceLimits: {
        maxMemoryMB: 1024,
        maxCpuTime: 30000,
        maxWallClockTime: 60000,
        maxConcurrentRetries: 2
      }
    });

    // PDFPlumber strategy
    strategies.set('pdfplumber', {
      name: 'PDFPlumber Fallback Strategy',
      toolName: 'pdfplumber',
      errorTypes: ['*'],
      fallbackOptions: [
        {
          toolName: 'unstructured',
          triggerConditions: [
            { type: 'error_type', operator: 'eq', value: 'parsing_error', weight: 1.0 }
          ],
          priority: 1,
          expectedImprovement: 0.20,
          resourceCost: 0.8,
          timeEstimate: 1000,
          successRate: 0.90
        },
        {
          toolName: 'camelot',
          triggerConditions: [
            { type: 'confidence_threshold', operator: 'lt', value: 0.6, weight: 0.8 }
          ],
          priority: 2,
          expectedImprovement: 0.30,
          resourceCost: 1.5,
          timeEstimate: 2500,
          successRate: 0.80
        }
      ],
      retryPolicy: {
        maxAttempts: 2,
        baseDelayMs: 500,
        exponentialBackoff: false,
        backoffMultiplier: 1.0,
        jitterPercent: 5,
        retryableErrors: ['timeout_error', 'parsing_error']
      },
      escalationRules: [],
      resourceLimits: {
        maxMemoryMB: 512,
        maxCpuTime: 20000,
        maxWallClockTime: 40000,
        maxConcurrentRetries: 3
      }
    });

    // Camelot strategy
    strategies.set('camelot', {
      name: 'Camelot Fallback Strategy',
      toolName: 'camelot',
      errorTypes: ['*'],
      fallbackOptions: [
        {
          toolName: 'tabula',
          triggerConditions: [
            { type: 'error_type', operator: 'contains', value: 'table', weight: 1.0 }
          ],
          priority: 1,
          expectedImprovement: 0.15,
          resourceCost: 0.9,
          timeEstimate: 1200,
          successRate: 0.85
        },
        {
          toolName: 'pdfplumber',
          triggerConditions: [
            { type: 'confidence_threshold', operator: 'lt', value: 0.8, weight: 0.7 }
          ],
          priority: 2,
          expectedImprovement: 0.10,
          resourceCost: 0.7,
          timeEstimate: 1500,
          successRate: 0.78
        }
      ],
      retryPolicy: {
        maxAttempts: 2,
        baseDelayMs: 2000,
        exponentialBackoff: true,
        backoffMultiplier: 1.5,
        jitterPercent: 15,
        retryableErrors: ['timeout_error', 'memory_error']
      },
      escalationRules: [],
      resourceLimits: {
        maxMemoryMB: 2048,
        maxCpuTime: 60000,
        maxWallClockTime: 120000,
        maxConcurrentRetries: 1
      }
    });

    return strategies;
  }

  private getDefaultStrategy(errorType: string): FallbackStrategy {
    return {
      name: 'Default Fallback Strategy',
      toolName: 'default',
      errorTypes: ['*'],
      fallbackOptions: [
        {
          toolName: 'unstructured',
          triggerConditions: [],
          priority: 1,
          expectedImprovement: 0.10,
          resourceCost: 1.0,
          timeEstimate: 2000,
          successRate: 0.70
        }
      ],
      retryPolicy: {
        maxAttempts: 2,
        baseDelayMs: 1000,
        exponentialBackoff: false,
        backoffMultiplier: 1.0,
        jitterPercent: 10,
        retryableErrors: ['*']
      },
      escalationRules: [],
      resourceLimits: {
        maxMemoryMB: 512,
        maxCpuTime: 30000,
        maxWallClockTime: 60000,
        maxConcurrentRetries: 2
      }
    };
  }

  private filterCandidateTools(
    options: FallbackOption[], 
    context: FallbackContext
  ): FallbackOption[] {
    return options.filter(option => {
      // Check user preferences
      if (context.userPreferences.restrictedFallbackTools.includes(option.toolName)) {
        return false;
      }

      // Check resource availability
      if (option.resourceCost > context.systemResources.availableMemory / 1000) {
        return false;
      }

      // Check time constraints
      if (context.timeConstraints.maxRetryTime && 
          option.timeEstimate > context.timeConstraints.maxRetryTime) {
        return false;
      }

      // Check trigger conditions
      return this.evaluateTriggerConditions(option.triggerConditions, context);
    });
  }

  private evaluateTriggerConditions(
    conditions: TriggerCondition[], 
    context: FallbackContext
  ): boolean {
    if (conditions.length === 0) return true;

    for (const condition of conditions) {
      if (!this.evaluateSingleCondition(condition, context)) {
        return false;
      }
    }
    return true;
  }

  private evaluateSingleCondition(
    condition: TriggerCondition, 
    context: FallbackContext
  ): boolean {
    switch (condition.type) {
      case 'confidence_threshold':
        const latestResult = context.processingHistory[context.processingHistory.length - 1]?.result;
        const confidence = latestResult?.confidence || 0;
        return this.compareValues(confidence, condition.operator, condition.value);
      
      case 'error_type':
        const latestError = context.processingHistory[context.processingHistory.length - 1]?.error;
        const errorType = latestError?.type || '';
        return this.compareValues(errorType, condition.operator, condition.value);
      
      case 'resource_availability':
        return this.compareValues(
          context.systemResources.availableMemory, 
          condition.operator, 
          condition.value
        );
      
      case 'time_constraint':
        const remainingTime = context.timeConstraints.maxTotalProcessingTime;
        return this.compareValues(remainingTime, condition.operator, condition.value);
      
      default:
        return true;
    }
  }

  private compareValues(actual: any, operator: string, expected: any): boolean {
    switch (operator) {
      case 'lt': return actual < expected;
      case 'gt': return actual > expected;
      case 'eq': return actual === expected;
      case 'contains': return String(actual).includes(String(expected));
      default: return true;
    }
  }

  private async scoreTools(
    candidates: FallbackOption[],
    zone: Zone,
    error: ProcessingError,
    context: FallbackContext
  ): Promise<ScoredTool[]> {
    const scoredTools: ScoredTool[] = [];

    for (const candidate of candidates) {
      const score = await this.calculateToolScore(candidate, zone, error, context);
      const tool = await this.createAssignedTool(candidate, zone);
      
      scoredTools.push({
        tool,
        score,
        reasoning: this.generateScoringReasoning(candidate, score),
        expectedOutcome: {
          successProbability: candidate.successRate,
          expectedConfidence: score.confidence,
          estimatedProcessingTime: candidate.timeEstimate,
          qualityImprovement: candidate.expectedImprovement,
          riskFactors: this.identifyRiskFactors(candidate, context)
        }
      });
    }

    return scoredTools.sort((a, b) => b.score.overall - a.score.overall);
  }

  private async calculateToolScore(
    candidate: FallbackOption,
    zone: Zone,
    error: ProcessingError,
    context: FallbackContext
  ): Promise<ToolScore> {
    // Multi-factor scoring
    const factors = {
      successRate: candidate.successRate,
      expectedImprovement: candidate.expectedImprovement,
      resourceEfficiency: 1 / candidate.resourceCost,
      timeEfficiency: 1 / (candidate.timeEstimate / 1000),
      historicalPerformance: await this.getHistoricalPerformance(candidate.toolName, zone.contentType),
      userPreference: this.getUserPreferenceScore(candidate.toolName, context.userPreferences)
    };

    const weights = {
      successRate: 0.25,
      expectedImprovement: 0.20,
      resourceEfficiency: 0.15,
      timeEfficiency: 0.15,
      historicalPerformance: 0.15,
      userPreference: 0.10
    };

    const overall = Object.entries(factors).reduce((sum, [key, value]) => {
      return sum + value * weights[key as keyof typeof weights];
    }, 0);

    return {
      overall,
      factors,
      confidence: Math.min(0.95, overall * 1.1) // Boost confidence slightly
    };
  }

  private async createAssignedTool(candidate: FallbackOption, zone: Zone): Promise<AssignedTool> {
    return {
      name: candidate.toolName,
      priority: candidate.priority,
      confidence: candidate.successRate,
      expectedAccuracy: candidate.expectedImprovement + 0.7, // Base accuracy
      processingTime: candidate.timeEstimate,
      memoryRequirement: candidate.resourceCost * 100, // Convert to MB
      configuration: {
        parameters: {},
        timeout: candidate.timeEstimate * 2,
        retryAttempts: 1,
        parallelizable: false,
        resourceLimits: {
          maxMemoryMB: candidate.resourceCost * 200,
          maxCpuSeconds: candidate.timeEstimate / 1000,
          maxDiskMB: 100,
          timeoutSeconds: candidate.timeEstimate / 1000 * 2
        }
      },
      capabilities: {
        supportedContentTypes: [zone.contentType],
        maxDocumentSize: 10 * 1024 * 1024,
        accuracyRating: candidate.expectedImprovement + 0.7,
        speedRating: 1 / (candidate.timeEstimate / 1000),
        memoryEfficiency: 1 / candidate.resourceCost,
        complexity: 'medium',
        languages: ['en'],
        specialFeatures: []
      }
    };
  }

  private generateScoringReasoning(candidate: FallbackOption, score: ToolScore): string {
    const reasons: string[] = [];

    if (score.factors.successRate > 0.8) {
      reasons.push(`High success rate (${(score.factors.successRate * 100).toFixed(0)}%)`);
    }

    if (score.factors.expectedImprovement > 0.2) {
      reasons.push(`Significant expected improvement (${(score.factors.expectedImprovement * 100).toFixed(0)}%)`);
    }

    if (score.factors.resourceEfficiency > 0.8) {
      reasons.push('Resource efficient');
    }

    if (score.factors.timeEfficiency > 0.5) {
      reasons.push('Fast processing expected');
    }

    return reasons.join(', ') || 'Standard fallback option';
  }

  private identifyRiskFactors(candidate: FallbackOption, context: FallbackContext): RiskFactor[] {
    const risks: RiskFactor[] = [];

    if (candidate.resourceCost > 2.0) {
      risks.push({
        type: 'resource',
        severity: 0.7,
        description: 'High resource requirements may impact system performance',
        mitigation: 'Monitor resource usage and scale down other processes if needed'
      });
    }

    if (candidate.timeEstimate > context.timeConstraints.maxRetryTime * 0.8) {
      risks.push({
        type: 'time',
        severity: 0.6,
        description: 'Processing time may exceed retry time limits',
        mitigation: 'Consider setting aggressive timeout or using faster alternative'
      });
    }

    if (candidate.successRate < 0.7) {
      risks.push({
        type: 'quality',
        severity: 0.8,
        description: 'Lower success rate increases chance of continued failures'
      });
    }

    return risks;
  }

  private buildFallbackChain(originalTool: string, fallbackTool: string): string[] {
    return [originalTool, fallbackTool];
  }

  private calculateRetryDelay(attempt: number, toolName: string): number {
    const strategy = this.strategies.get(toolName) || this.getDefaultStrategy('*');
    const policy = strategy.retryPolicy;

    let delay = policy.baseDelayMs;

    if (policy.exponentialBackoff) {
      delay *= Math.pow(policy.backoffMultiplier, attempt - 1);
    }

    // Add jitter
    const jitterRange = delay * (policy.jitterPercent / 100);
    const jitter = (Math.random() - 0.5) * 2 * jitterRange;
    
    return Math.max(0, delay + jitter);
  }

  private async processWithFallbackTool(zone: Zone, tool: AssignedTool): Promise<ProcessingResult> {
    // Simulate fallback tool processing
    const processingTime = tool.processingTime + Math.random() * 500;
    
    await this.sleep(processingTime);

    // Simulate improved result from fallback
    const baseConfidence = 0.6 + Math.random() * 0.25;
    const confidenceBoost = tool.expectedAccuracy - 0.7; // Improvement over base

    return {
      content: this.generateFallbackContent(zone, tool),
      confidence: Math.min(0.95, baseConfidence + confidenceBoost),
      metadata: {
        toolName: tool.name,
        toolVersion: '1.0.0',
        processingTime,
        memoryUsed: tool.memoryRequirement,
        parameters: tool.configuration.parameters,
        timestamp: new Date()
      },
      artifacts: [],
      qualityScore: baseConfidence + confidenceBoost * 0.8,
      validationResults: [{
        validator: 'fallback_validator',
        passed: true,
        score: baseConfidence + confidenceBoost,
        issues: []
      }]
    };
  }

  private generateFallbackContent(zone: Zone, tool: AssignedTool): string {
    return `Fallback extraction from zone ${zone.id} using ${tool.name} - improved content quality`;
  }

  private async assessResultQuality(result: ProcessingResult, zone: Zone): Promise<QualityAssessment> {
    const score = (result.confidence + result.qualityScore) / 2;
    const threshold = 0.6; // Minimum acceptable quality
    
    return {
      score,
      acceptable: score >= threshold,
      issues: score < threshold ? ['Quality below acceptable threshold'] : [],
      recommendations: score < 0.8 ? ['Consider additional validation'] : []
    };
  }

  private async extractLessons(
    zone: QueuedZone,
    tool: AssignedTool,
    result?: ProcessingResult,
    attempt?: number,
    error?: ProcessingError
  ): Promise<RetryLesson[]> {
    const lessons: RetryLesson[] = [];

    if (error) {
      lessons.push({
        insight: `Tool ${tool.name} failed on ${zone.zone.contentType} content`,
        applicability: [zone.zone.contentType],
        confidence: 0.8,
        actionable: true
      });
    }

    if (result && result.confidence > 0.8) {
      lessons.push({
        insight: `Tool ${tool.name} performs well on ${zone.zone.contentType} content`,
        applicability: [zone.zone.contentType],
        confidence: 0.9,
        actionable: true
      });
    }

    return lessons;
  }

  private async generateNextRecommendation(
    zone: QueuedZone,
    tool: AssignedTool,
    result: ProcessingResult,
    attempt: number,
    quality: QualityAssessment
  ): Promise<RetryRecommendation> {
    if (quality.acceptable) {
      return {
        action: 'retry',
        reason: 'Result quality acceptable',
        confidence: 0.9
      };
    }

    if (attempt >= 3) {
      return {
        action: 'escalate',
        reason: 'Maximum retry attempts reached',
        confidence: 0.8
      };
    }

    return {
      action: 'try_different_tool',
      reason: 'Current tool not producing acceptable quality',
      suggestedTool: this.suggestAlternativeTool(tool.name, zone.zone.contentType),
      confidence: 0.7
    };
  }

  private async generateErrorRecoveryRecommendation(
    zone: QueuedZone,
    tool: AssignedTool,
    error: ProcessingError,
    attempt: number
  ): Promise<RetryRecommendation> {
    if (error.recoverable && attempt < 3) {
      return {
        action: 'retry',
        reason: 'Error is recoverable, retry recommended',
        waitTime: this.calculateRetryDelay(attempt + 1, tool.name),
        confidence: 0.6
      };
    }

    return {
      action: 'try_different_tool',
      reason: `Non-recoverable error: ${error.message}`,
      suggestedTool: this.suggestAlternativeTool(tool.name, zone.zone.contentType),
      confidence: 0.8
    };
  }

  private suggestAlternativeTool(currentTool: string, contentType: string): string {
    const alternatives: Record<string, string[]> = {
      'unstructured': ['pdfplumber', 'ocr_engine'],
      'pdfplumber': ['unstructured', 'camelot'],
      'camelot': ['tabula', 'pdfplumber'],
      'tabula': ['camelot', 'pdfplumber']
    };

    const options = alternatives[currentTool] || ['unstructured'];
    return options[0]; // Return first alternative
  }

  private wrapError(error: any, tool: AssignedTool): ProcessingError {
    return {
      code: 'FALLBACK_PROCESSING_ERROR',
      message: error instanceof Error ? error.message : 'Fallback processing failed',
      type: 'tool_error',
      severity: 'medium',
      recoverable: true,
      details: { 
        originalError: error,
        toolName: tool.name,
        toolConfiguration: tool.configuration
      },
      timestamp: new Date()
    };
  }

  private async getHistoricalPerformance(toolName: string, contentType: string): Promise<number> {
    const key = `${toolName}_${contentType}`;
    const metrics = this.performanceHistory.get(key);
    return metrics?.successRate || 0.7; // Default performance
  }

  private getUserPreferenceScore(toolName: string, preferences: UserFallbackPreferences): number {
    if (preferences.preferredFallbackTools.includes(toolName)) {
      return 1.0;
    }
    
    if (preferences.restrictedFallbackTools.includes(toolName)) {
      return 0.0;
    }
    
    return 0.5; // Neutral
  }

  // Result merging implementations
  private createSingleResultMerge(result: ProcessingResult): MergedResult {
    return {
      content: result.content,
      confidence: result.confidence,
      sources: [{
        toolName: result.metadata.toolName,
        result,
        weight: 1.0,
        contributionAreas: ['full_content']
      }],
      mergeMethod: 'highest_confidence',
      qualityMetrics: {
        coherence: 1.0,
        completeness: 1.0,
        consistency: 1.0,
        redundancy: 0.0,
        coverage: 1.0
      },
      conflicts: [],
      reliability: result.confidence
    };
  }

  private selectMergeMethod(results: ProcessingResult[]): MergeMethod {
    // Simple heuristic for merge method selection
    const confidenceRange = Math.max(...results.map(r => r.confidence)) - 
                           Math.min(...results.map(r => r.confidence));
    
    if (confidenceRange < 0.1) {
      return 'consensus_voting'; // Similar confidence levels
    } else if (confidenceRange > 0.3) {
      return 'highest_confidence'; // Clear winner
    } else {
      return 'weighted_average'; // Moderate differences
    }
  }

  private async mergeByHighestConfidence(results: ProcessingResult[]): Promise<MergedResult> {
    const bestResult = results.reduce((best, current) => 
      current.confidence > best.confidence ? current : best
    );

    return this.createSingleResultMerge(bestResult);
  }

  private async mergeByWeightedAverage(results: ProcessingResult[]): Promise<MergedResult> {
    const totalWeight = results.reduce((sum, r) => sum + r.confidence, 0);
    const weights = results.map(r => r.confidence / totalWeight);

    // Simple content concatenation with weights (in real implementation would be more sophisticated)
    const mergedContent = results
      .map((r, i) => `[Weight: ${weights[i].toFixed(2)}] ${r.content}`)
      .join('\n\n');

    const weightedConfidence = results.reduce((sum, r, i) => sum + r.confidence * weights[i], 0);

    return {
      content: mergedContent,
      confidence: weightedConfidence,
      sources: results.map((r, i) => ({
        toolName: r.metadata.toolName,
        result: r,
        weight: weights[i],
        contributionAreas: ['content']
      })),
      mergeMethod: 'weighted_average',
      qualityMetrics: {
        coherence: 0.8,
        completeness: 0.9,
        consistency: 0.85,
        redundancy: 0.3,
        coverage: 0.95
      },
      conflicts: [],
      reliability: weightedConfidence
    };
  }

  private async mergeByCensensus(results: ProcessingResult[]): Promise<MergedResult> {
    // Simplified consensus - take majority characteristics
    const avgConfidence = results.reduce((sum, r) => sum + r.confidence, 0) / results.length;
    
    const consensusContent = `Consensus result from ${results.length} tools:\n` +
      results.map(r => r.content).join('\n---\n');

    return {
      content: consensusContent,
      confidence: avgConfidence,
      sources: results.map(r => ({
        toolName: r.metadata.toolName,
        result: r,
        weight: 1 / results.length,
        contributionAreas: ['content']
      })),
      mergeMethod: 'consensus_voting',
      qualityMetrics: {
        coherence: 0.9,
        completeness: 0.95,
        consistency: 0.9,
        redundancy: 0.5,
        coverage: 0.98
      },
      conflicts: [],
      reliability: avgConfidence
    };
  }

  private async mergeByExpertSystem(results: ProcessingResult[]): Promise<MergedResult> {
    // Expert system would use domain knowledge - simplified here
    return await this.mergeByHighestConfidence(results);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Supporting classes and interfaces
interface PerformanceMetrics {
  successRate: number;
  averageConfidence: number;
  averageProcessingTime: number;
  errorRate: number;
  lastUpdated: Date;
}

interface ProcessingAttempt {
  result?: ProcessingResult;
  error?: ProcessingError;
  timestamp: Date;
}

interface ScoredTool {
  tool: AssignedTool;
  score: ToolScore;
  reasoning: string;
  expectedOutcome: ExpectedOutcome;
}

interface ToolScore {
  overall: number;
  factors: Record<string, number>;
  confidence: number;
}

interface QualityAssessment {
  score: number;
  acceptable: boolean;
  issues: string[];
  recommendations: string[];
}

interface ResourceRequirement {
  type: string;
  amount: number;
  duration: number;
  priority: string;
  flexible: boolean;
}

class ResourceTracker {
  private startTime: number = 0;
  private startMemory: number = 0;

  start(): void {
    this.startTime = performance.now();
    this.startMemory = process.memoryUsage().heapUsed / 1024 / 1024; // MB
  }

  stop(): ResourceUsage {
    const endTime = performance.now();
    const endMemory = process.memoryUsage().heapUsed / 1024 / 1024;

    return {
      memoryMB: Math.max(0, endMemory - this.startMemory),
      cpuTime: endTime - this.startTime,
      wallClockTime: endTime - this.startTime,
      networkIO: 0, // Would track actual network usage
      diskIO: 0     // Would track actual disk usage
    };
  }
}

// Supporting system implementations
class FallbackLearningSystemImpl {
  async recordDecision(decision: FallbackDecision, context: FallbackContext): Promise<void> {
    // Record decision for future learning
    console.log(`Recorded fallback decision: ${decision.recommendedAction} (confidence: ${decision.confidence})`);
  }
}

class FallbackDecisionEngineImpl {
  async evaluate(result: ProcessingResult, context: FallbackContext): Promise<FallbackDecision> {
    const shouldFallback = this.shouldTriggerFallback(result, context);
    
    return {
      shouldFallback,
      reason: shouldFallback ? this.determineFallbackReason(result, context) : 'quality_acceptable',
      confidence: this.calculateDecisionConfidence(result, context),
      urgency: this.assessUrgency(result, context),
      recommendedAction: this.recommendAction(result, context, shouldFallback),
      alternatives: await this.generateAlternatives(context)
    };
  }

  private shouldTriggerFallback(result: ProcessingResult, context: FallbackContext): boolean {
    // Check confidence threshold
    if (result.confidence < context.qualityRequirements.minimumAcceptableConfidence) {
      return true;
    }

    // Check validation results
    if (result.validationResults.some(v => !v.passed)) {
      return true;
    }

    // Check quality score
    if (result.qualityScore < 0.7) {
      return true;
    }

    return false;
  }

  private determineFallbackReason(result: ProcessingResult, context: FallbackContext): FallbackReason {
    if (result.confidence < context.qualityRequirements.minimumAcceptableConfidence) {
      return 'low_confidence';
    }

    if (result.validationResults.some(v => !v.passed)) {
      return 'validation_failed';
    }

    if (result.qualityScore < 0.7) {
      return 'quality_threshold_not_met';
    }

    return 'low_confidence';
  }

  private calculateDecisionConfidence(result: ProcessingResult, context: FallbackContext): number {
    // Higher confidence when result is clearly bad or clearly good
    const deviation = Math.abs(result.confidence - context.qualityRequirements.minimumAcceptableConfidence);
    return Math.min(0.95, 0.6 + deviation);
  }

  private assessUrgency(result: ProcessingResult, context: FallbackContext): FallbackUrgency {
    if (context.timeConstraints.processingPriority === 'urgent') {
      return 'critical';
    }

    if (result.confidence < 0.3) {
      return 'high';
    }

    if (result.confidence < 0.6) {
      return 'medium';
    }

    return 'low';
  }

  private recommendAction(
    result: ProcessingResult, 
    context: FallbackContext, 
    shouldFallback: boolean
  ): FallbackAction {
    if (!shouldFallback) {
      return 'accept_partial_result';
    }

    if (context.processingHistory.length >= 3) {
      return 'manual_intervention';
    }

    if (result.confidence < 0.3) {
      return 'try_alternative_tool';
    }

    return 'retry_same_tool';
  }

  private async generateAlternatives(context: FallbackContext): Promise<FallbackAlternative[]> {
    const alternatives: FallbackAlternative[] = [
      {
        toolName: 'unstructured',
        expectedImprovement: 0.15,
        confidence: 0.8,
        estimatedTime: 2000,
        resourceCost: 1.0,
        riskLevel: 'low'
      },
      {
        toolName: 'pdfplumber',
        expectedImprovement: 0.10,
        confidence: 0.75,
        estimatedTime: 1500,
        resourceCost: 0.8,
        riskLevel: 'low'
      }
    ];

    return alternatives.filter(alt => 
      !context.userPreferences.restrictedFallbackTools.includes(alt.toolName)
    );
  }
}

class ToolComparatorImpl {
  compareTools(tool1: string, tool2: string, contentType: string): number {
    // Simplified tool comparison
    const scores: Record<string, Record<string, number>> = {
      'unstructured': { text: 0.9, table: 0.7, diagram: 0.6 },
      'pdfplumber': { text: 0.8, table: 0.8, diagram: 0.4 },
      'camelot': { text: 0.5, table: 0.95, diagram: 0.3 }
    };

    const score1 = scores[tool1]?.[contentType] || 0.5;
    const score2 = scores[tool2]?.[contentType] || 0.5;

    return score1 - score2;
  }
}

// Export default instance
export const fallbackManager = new IntelligentFallbackManager(); 