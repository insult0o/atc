import { ProcessingError } from './processing-queue';
import { Zone } from '../../app/components/zones/ZoneManager';
import { AssignedTool } from './tool-assignment';

// Core interfaces for error handling and recovery
export interface ErrorHandler {
  handleError(error: ProcessingError, context: ErrorContext): Promise<ErrorHandlingResult>;
  classifyError(error: any, context: ErrorContext): ProcessingError;
  getRecoveryStrategy(error: ProcessingError, context: ErrorContext): Promise<RecoveryStrategy>;
  executeRecovery(strategy: RecoveryStrategy, context: ErrorContext): Promise<RecoveryResult>;
  recordErrorMetrics(error: ProcessingError, recovery: RecoveryResult): Promise<void>;
  getErrorPattern(errors: ProcessingError[]): ErrorPattern | null;
}

export interface ErrorContext {
  zoneId: string;
  zone: Zone;
  tool: AssignedTool;
  attempt: number;
  previousErrors: ProcessingError[];
  systemState: SystemErrorState;
  resourceState: ResourceErrorState;
  userPreferences: UserErrorPreferences;
  processingMetadata: ProcessingErrorMetadata;
}

export interface SystemErrorState {
  memoryUsage: number;
  cpuUsage: number;
  diskSpace: number;
  activeConnections: number;
  queueLength: number;
  errorRate: number;
  systemLoad: number;
  lastMaintenanceWindow: Date;
}

export interface ResourceErrorState {
  availableMemory: number;
  availableCpu: number;
  availableDisk: number;
  networkLatency: number;
  toolAvailability: Map<string, boolean>;
  resourceBottlenecks: ResourceBottleneck[];
}

export interface ResourceBottleneck {
  type: 'memory' | 'cpu' | 'disk' | 'network' | 'tool';
  severity: number;
  description: string;
  estimatedDuration: number;
}

export interface UserErrorPreferences {
  tolerance: 'low' | 'medium' | 'high';
  retryStrategy: 'aggressive' | 'conservative' | 'adaptive';
  notificationLevel: 'all' | 'critical' | 'none';
  maxRetryTime: number;
  allowCostlyRecovery: boolean;
  preferredFallbackTools: string[];
}

export interface ProcessingErrorMetadata {
  processingTime: number;
  memoryUsed: number;
  cpuUsed: number;
  networkCalls: number;
  diskOperations: number;
  toolVersion: string;
  environmentInfo: EnvironmentInfo;
}

export interface EnvironmentInfo {
  nodeVersion: string;
  platform: string;
  architecture: string;
  memoryTotal: number;
  cpuCores: number;
  diskSpace: number;
}

export interface ErrorHandlingResult {
  success: boolean;
  action: ErrorAction;
  strategy: RecoveryStrategy;
  result?: RecoveryResult;
  recommendations: ErrorRecommendation[];
  escalation?: EscalationPlan;
  metrics: ErrorHandlingMetrics;
}

export type ErrorAction = 
  | 'retry_immediately'
  | 'retry_with_backoff'
  | 'switch_tool'
  | 'reduce_resources'
  | 'increase_resources'
  | 'skip_zone'
  | 'abort_processing'
  | 'escalate_to_manual'
  | 'apply_workaround'
  | 'wait_for_resources';

export interface RecoveryStrategy {
  id: string;
  name: string;
  description: string;
  actions: RecoveryAction[];
  estimatedDuration: number;
  successProbability: number;
  resourceCost: number;
  riskLevel: 'low' | 'medium' | 'high';
  prerequisites: string[];
  fallbackStrategies: string[];
}

export interface RecoveryAction {
  type: RecoveryActionType;
  parameters: Record<string, any>;
  timeout: number;
  retryable: boolean;
  rollbackAction?: RecoveryAction;
}

export type RecoveryActionType =
  | 'restart_tool'
  | 'clear_cache'
  | 'increase_memory'
  | 'reduce_memory'
  | 'switch_algorithm'
  | 'apply_patch'
  | 'wait_for_condition'
  | 'notify_administrator'
  | 'checkpoint_state'
  | 'rollback_state';

export interface RecoveryResult {
  success: boolean;
  actionsExecuted: ExecutedAction[];
  timeTaken: number;
  resourcesUsed: ResourceUsage;
  sideEffects: SideEffect[];
  newRecommendations: string[];
}

export interface ExecutedAction {
  action: RecoveryAction;
  success: boolean;
  error?: string;
  timeTaken: number;
  result?: any;
}

export interface SideEffect {
  type: 'performance_impact' | 'resource_usage' | 'data_change' | 'system_state';
  description: string;
  severity: 'low' | 'medium' | 'high';
  duration: number;
  reversible: boolean;
}

export interface ResourceUsage {
  memoryMB: number;
  cpuSeconds: number;
  diskMB: number;
  networkKB: number;
}

export interface ErrorRecommendation {
  type: 'immediate' | 'future' | 'system' | 'process';
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  actionItems: string[];
  estimatedImpact: string;
}

export interface EscalationPlan {
  level: EscalationLevel;
  reason: string;
  notificationTargets: NotificationTarget[];
  escalationActions: EscalationAction[];
  timeToEscalate: number;
}

export type EscalationLevel = 'tier1' | 'tier2' | 'tier3' | 'management' | 'emergency';

export interface NotificationTarget {
  type: 'email' | 'slack' | 'sms' | 'dashboard';
  recipient: string;
  urgency: 'low' | 'medium' | 'high' | 'critical';
}

export interface EscalationAction {
  action: string;
  automated: boolean;
  requiredApproval: boolean;
  estimatedTime: number;
}

export interface ErrorHandlingMetrics {
  classificationTime: number;
  strategySelectionTime: number;
  recoveryExecutionTime: number;
  totalHandlingTime: number;
  resourcesConsumed: ResourceUsage;
  successRate: number;
}

export interface ErrorPattern {
  id: string;
  name: string;
  description: string;
  frequency: number;
  severity: number;
  commonCauses: string[];
  recommendedSolutions: string[];
  preventionMeasures: string[];
  lastOccurrence: Date;
}

// Error classification and categorization
export interface ErrorClassification {
  category: ErrorCategory;
  severity: ErrorSeverity;
  recoverability: ErrorRecoverability;
  urgency: ErrorUrgency;
  impact: ErrorImpact;
  confidence: number;
}

export type ErrorCategory = 
  | 'tool_error'
  | 'resource_error'
  | 'network_error'
  | 'timeout_error'
  | 'validation_error'
  | 'configuration_error'
  | 'system_error'
  | 'user_error'
  | 'data_error';

export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

export type ErrorRecoverability = 'recoverable' | 'partially_recoverable' | 'non_recoverable';

export type ErrorUrgency = 'low' | 'medium' | 'high' | 'immediate';

export interface ErrorImpact {
  scope: 'zone' | 'document' | 'queue' | 'system';
  userFacing: boolean;
  dataLoss: boolean;
  performanceImpact: number;
  costImpact: number;
}

// Main ComprehensiveErrorHandler implementation
export class ComprehensiveErrorHandler implements ErrorHandler {
  private errorPatterns: Map<string, ErrorPattern>;
  private recoveryStrategies: Map<string, RecoveryStrategy>;
  private errorMetrics: Map<string, ErrorMetrics>;
  private classificationRules: ErrorClassificationRule[];
  private recoverabilityAnalyzer: RecoverabilityAnalyzer;
  private strategySelector: StrategySelector;
  private recoveryExecutor: RecoveryExecutor;

  constructor() {
    this.errorPatterns = new Map();
    this.recoveryStrategies = this.initializeRecoveryStrategies();
    this.errorMetrics = new Map();
    this.classificationRules = this.initializeClassificationRules();
    this.recoverabilityAnalyzer = new RecoverabilityAnalyzerImpl();
    this.strategySelector = new StrategySelectorImpl();
    this.recoveryExecutor = new RecoveryExecutorImpl();
  }

  async handleError(
    error: ProcessingError, 
    context: ErrorContext
  ): Promise<ErrorHandlingResult> {
    const startTime = performance.now();

    try {
      // Step 1: Classify the error if not already classified
      const classifiedError = error.code ? error : this.classifyError(error, context);
      
      // Step 2: Analyze recoverability
      const recoverability = await this.recoverabilityAnalyzer.analyze(classifiedError, context);
      
      // Step 3: Get recovery strategy
      const strategy = await this.getRecoveryStrategy(classifiedError, context);
      
      // Step 4: Execute recovery if strategy is available
      let result: RecoveryResult | undefined;
      if (strategy && recoverability.recoverable) {
        result = await this.executeRecovery(strategy, context);
      }

      // Step 5: Generate recommendations
      const recommendations = await this.generateRecommendations(
        classifiedError, 
        context, 
        strategy, 
        result
      );

      // Step 6: Determine if escalation is needed
      const escalation = await this.determineEscalation(
        classifiedError, 
        context, 
        result
      );

      // Step 7: Record metrics
      const metrics = this.calculateMetrics(startTime, result);
      await this.recordErrorMetrics(classifiedError, result || this.createFailedRecoveryResult());

      return {
        success: result?.success || false,
        action: this.determineAction(strategy, result),
        strategy,
        result,
        recommendations,
        escalation,
        metrics
      };

    } catch (handlingError) {
      console.error('Error in error handling:', handlingError);
      
      return this.createFallbackErrorHandlingResult(error, context, startTime);
    }
  }

  classifyError(error: any, context: ErrorContext): ProcessingError {
    const originalError = error instanceof Error ? error : new Error(String(error));
    
    // Apply classification rules
    const classification = this.applyClassificationRules(originalError, context);
    
    return {
      code: this.generateErrorCode(classification),
      message: originalError.message || 'Unknown error occurred',
      type: classification.category,
      severity: classification.severity,
      recoverable: classification.recoverability !== 'non_recoverable',
      details: {
        classification,
        originalError,
        context: {
          zoneId: context.zoneId,
          toolName: context.tool.name,
          attempt: context.attempt
        },
        systemState: context.systemState,
        resourceState: context.resourceState
      },
      timestamp: new Date()
    };
  }

  async getRecoveryStrategy(
    error: ProcessingError, 
    context: ErrorContext
  ): Promise<RecoveryStrategy> {
    // Select strategy based on error characteristics and context
    return await this.strategySelector.selectStrategy(error, context, this.recoveryStrategies);
  }

  async executeRecovery(
    strategy: RecoveryStrategy, 
    context: ErrorContext
  ): Promise<RecoveryResult> {
    return await this.recoveryExecutor.execute(strategy, context);
  }

  async recordErrorMetrics(
    error: ProcessingError, 
    recovery: RecoveryResult
  ): Promise<void> {
    const key = `${error.type}_${error.severity}`;
    
    if (!this.errorMetrics.has(key)) {
      this.errorMetrics.set(key, {
        count: 0,
        totalRecoveryTime: 0,
        successfulRecoveries: 0,
        lastOccurrence: new Date()
      });
    }

    const metrics = this.errorMetrics.get(key)!;
    metrics.count++;
    metrics.totalRecoveryTime += recovery.timeTaken;
    if (recovery.success) {
      metrics.successfulRecoveries++;
    }
    metrics.lastOccurrence = new Date();

    // Update error patterns
    await this.updateErrorPatterns(error, recovery);
  }

  getErrorPattern(errors: ProcessingError[]): ErrorPattern | null {
    if (errors.length < 2) return null;

    // Analyze error sequence for patterns
    const patternAnalysis = this.analyzeErrorSequence(errors);
    
    if (patternAnalysis.confidence > 0.7) {
      return this.createErrorPattern(patternAnalysis, errors);
    }

    return null;
  }

  // Private implementation methods
  private initializeRecoveryStrategies(): Map<string, RecoveryStrategy> {
    const strategies = new Map<string, RecoveryStrategy>();

    // Memory error recovery
    strategies.set('memory_recovery', {
      id: 'memory_recovery',
      name: 'Memory Error Recovery',
      description: 'Reduce memory usage and retry processing',
      actions: [
        {
          type: 'clear_cache',
          parameters: { scope: 'tool_cache' },
          timeout: 5000,
          retryable: true
        },
        {
          type: 'reduce_memory',
          parameters: { reduction_factor: 0.8 },
          timeout: 1000,
          retryable: false
        },
        {
          type: 'restart_tool',
          parameters: { clean_start: true },
          timeout: 10000,
          retryable: true
        }
      ],
      estimatedDuration: 15000,
      successProbability: 0.8,
      resourceCost: 0.5,
      riskLevel: 'low',
      prerequisites: ['available_alternative_memory'],
      fallbackStrategies: ['tool_switch_recovery']
    });

    // Tool error recovery
    strategies.set('tool_recovery', {
      id: 'tool_recovery',
      name: 'Tool Error Recovery',
      description: 'Restart tool with different configuration',
      actions: [
        {
          type: 'restart_tool',
          parameters: { configuration: 'safe_mode' },
          timeout: 10000,
          retryable: true
        },
        {
          type: 'switch_algorithm',
          parameters: { algorithm: 'fallback' },
          timeout: 2000,
          retryable: false
        }
      ],
      estimatedDuration: 12000,
      successProbability: 0.75,
      resourceCost: 1.0,
      riskLevel: 'medium',
      prerequisites: [],
      fallbackStrategies: ['alternative_tool_recovery']
    });

    // Timeout error recovery
    strategies.set('timeout_recovery', {
      id: 'timeout_recovery',
      name: 'Timeout Error Recovery',
      description: 'Increase timeout and optimize processing',
      actions: [
        {
          type: 'increase_memory',
          parameters: { factor: 1.5 },
          timeout: 5000,
          retryable: true
        },
        {
          type: 'switch_algorithm',
          parameters: { algorithm: 'optimized' },
          timeout: 2000,
          retryable: false
        }
      ],
      estimatedDuration: 8000,
      successProbability: 0.7,
      resourceCost: 1.5,
      riskLevel: 'medium',
      prerequisites: ['sufficient_resources'],
      fallbackStrategies: ['chunked_processing_recovery']
    });

    // Resource exhaustion recovery
    strategies.set('resource_recovery', {
      id: 'resource_recovery',
      name: 'Resource Exhaustion Recovery',
      description: 'Wait for resources and optimize usage',
      actions: [
        {
          type: 'wait_for_condition',
          parameters: { 
            condition: 'resource_availability',
            timeout: 30000,
            check_interval: 5000
          },
          timeout: 30000,
          retryable: false
        },
        {
          type: 'reduce_memory',
          parameters: { reduction_factor: 0.6 },
          timeout: 1000,
          retryable: false
        }
      ],
      estimatedDuration: 35000,
      successProbability: 0.9,
      resourceCost: 0.3,
      riskLevel: 'low',
      prerequisites: [],
      fallbackStrategies: ['delayed_processing_recovery']
    });

    // Network error recovery
    strategies.set('network_recovery', {
      id: 'network_recovery',
      name: 'Network Error Recovery',
      description: 'Retry with exponential backoff and local processing',
      actions: [
        {
          type: 'wait_for_condition',
          parameters: {
            condition: 'network_connectivity',
            timeout: 10000,
            check_interval: 2000
          },
          timeout: 10000,
          retryable: true
        }
      ],
      estimatedDuration: 12000,
      successProbability: 0.85,
      resourceCost: 0.1,
      riskLevel: 'low',
      prerequisites: [],
      fallbackStrategies: ['offline_processing_recovery']
    });

    return strategies;
  }

  private initializeClassificationRules(): ErrorClassificationRule[] {
    return [
      {
        pattern: /out of memory|memory.*allocation|heap.*overflow/i,
        classification: {
          category: 'resource_error',
          severity: 'high',
          recoverability: 'recoverable',
          urgency: 'high',
          impact: {
            scope: 'zone',
            userFacing: false,
            dataLoss: false,
            performanceImpact: 0.8,
            costImpact: 0.3
          },
          confidence: 0.9
        }
      },
      {
        pattern: /timeout|time.*out|exceeded.*time/i,
        classification: {
          category: 'timeout_error',
          severity: 'medium',
          recoverability: 'recoverable',
          urgency: 'medium',
          impact: {
            scope: 'zone',
            userFacing: true,
            dataLoss: false,
            performanceImpact: 0.6,
            costImpact: 0.2
          },
          confidence: 0.85
        }
      },
      {
        pattern: /network|connection|fetch|http|ssl/i,
        classification: {
          category: 'network_error',
          severity: 'medium',
          recoverability: 'recoverable',
          urgency: 'medium',
          impact: {
            scope: 'system',
            userFacing: true,
            dataLoss: false,
            performanceImpact: 0.7,
            costImpact: 0.1
          },
          confidence: 0.8
        }
      },
      {
        pattern: /tool.*error|processing.*failed|extraction.*error/i,
        classification: {
          category: 'tool_error',
          severity: 'medium',
          recoverability: 'recoverable',
          urgency: 'medium',
          impact: {
            scope: 'zone',
            userFacing: false,
            dataLoss: false,
            performanceImpact: 0.5,
            costImpact: 0.4
          },
          confidence: 0.75
        }
      },
      {
        pattern: /validation.*failed|invalid.*data|corrupt/i,
        classification: {
          category: 'validation_error',
          severity: 'high',
          recoverability: 'partially_recoverable',
          urgency: 'high',
          impact: {
            scope: 'document',
            userFacing: true,
            dataLoss: true,
            performanceImpact: 0.4,
            costImpact: 0.8
          },
          confidence: 0.9
        }
      },
      {
        pattern: /permission|authorization|access.*denied/i,
        classification: {
          category: 'configuration_error',
          severity: 'high',
          recoverability: 'non_recoverable',
          urgency: 'immediate',
          impact: {
            scope: 'system',
            userFacing: true,
            dataLoss: false,
            performanceImpact: 1.0,
            costImpact: 0.0
          },
          confidence: 0.95
        }
      }
    ];
  }

  private applyClassificationRules(
    error: Error, 
    context: ErrorContext
  ): ErrorClassification {
    // Try to match against known patterns
    for (const rule of this.classificationRules) {
      if (rule.pattern.test(error.message)) {
        return rule.classification;
      }
    }

    // Apply context-based classification
    return this.contextBasedClassification(error, context);
  }

  private contextBasedClassification(
    error: Error, 
    context: ErrorContext
  ): ErrorClassification {
    // Default classification based on context
    let category: ErrorCategory = 'system_error';
    let severity: ErrorSeverity = 'medium';
    let recoverability: ErrorRecoverability = 'recoverable';

    // Analyze system state
    if (context.systemState.memoryUsage > 0.9) {
      category = 'resource_error';
      severity = 'high';
    } else if (context.systemState.errorRate > 0.5) {
      category = 'system_error';
      severity = 'high';
    } else if (context.attempt > 2) {
      severity = 'high';
      recoverability = 'partially_recoverable';
    }

    return {
      category,
      severity,
      recoverability,
      urgency: severity === 'high' ? 'high' : 'medium',
      impact: {
        scope: 'zone',
        userFacing: false,
        dataLoss: false,
        performanceImpact: 0.5,
        costImpact: 0.3
      },
      confidence: 0.6
    };
  }

  private generateErrorCode(classification: ErrorClassification): string {
    const categoryCode = classification.category.toUpperCase().replace('_', '');
    const severityCode = classification.severity.charAt(0).toUpperCase();
    const timestamp = Date.now().toString().slice(-6);
    
    return `${categoryCode}_${severityCode}_${timestamp}`;
  }

  private async generateRecommendations(
    error: ProcessingError,
    context: ErrorContext,
    strategy: RecoveryStrategy,
    result?: RecoveryResult
  ): Promise<ErrorRecommendation[]> {
    const recommendations: ErrorRecommendation[] = [];

    // Immediate recommendations
    if (!result?.success) {
      recommendations.push({
        type: 'immediate',
        priority: 'high',
        title: 'Immediate Action Required',
        description: 'Processing failed and recovery was unsuccessful',
        actionItems: [
          'Review error details and context',
          'Check system resources and availability',
          'Consider manual intervention'
        ],
        estimatedImpact: 'High - may require user intervention'
      });
    }

    // Future recommendations based on error patterns
    if (context.previousErrors.length > 0) {
      const pattern = this.getErrorPattern([...context.previousErrors, error]);
      if (pattern) {
        recommendations.push({
          type: 'future',
          priority: 'medium',
          title: 'Prevent Recurring Issues',
          description: `Detected error pattern: ${pattern.name}`,
          actionItems: pattern.preventionMeasures,
          estimatedImpact: 'Medium - improve overall reliability'
        });
      }
    }

    // System recommendations
    if (context.systemState.errorRate > 0.1) {
      recommendations.push({
        type: 'system',
        priority: 'high',
        title: 'System Health Concern',
        description: 'High system error rate detected',
        actionItems: [
          'Monitor system resources',
          'Review recent system changes',
          'Consider scaling resources'
        ],
        estimatedImpact: 'High - affects overall system reliability'
      });
    }

    // Process recommendations
    recommendations.push({
      type: 'process',
      priority: 'medium',
      title: 'Process Improvement',
      description: 'Optimize processing configuration',
      actionItems: [
        'Review tool configuration',
        'Optimize resource allocation',
        'Update error handling rules'
      ],
      estimatedImpact: 'Medium - improve processing efficiency'
    });

    return recommendations;
  }

  private async determineEscalation(
    error: ProcessingError,
    context: ErrorContext,
    result?: RecoveryResult
  ): Promise<EscalationPlan | undefined> {
    // Escalate if recovery failed and error is critical
    if (error.severity === 'critical' || (error.severity === 'high' && !result?.success)) {
      return {
        level: 'tier2',
        reason: `Critical error ${error.code} could not be recovered`,
        notificationTargets: [
          {
            type: 'email',
            recipient: 'support@example.com',
            urgency: 'high'
          },
          {
            type: 'dashboard',
            recipient: 'operations_dashboard',
            urgency: 'high'
          }
        ],
        escalationActions: [
          {
            action: 'Create incident ticket',
            automated: true,
            requiredApproval: false,
            estimatedTime: 5
          },
          {
            action: 'Notify on-call engineer',
            automated: true,
            requiredApproval: false,
            estimatedTime: 1
          }
        ],
        timeToEscalate: 0 // Immediate
      };
    }

    // Escalate if repeated failures
    if (context.attempt > 3 && context.previousErrors.length > 2) {
      return {
        level: 'tier1',
        reason: 'Multiple consecutive failures detected',
        notificationTargets: [
          {
            type: 'slack',
            recipient: '#processing-alerts',
            urgency: 'medium'
          }
        ],
        escalationActions: [
          {
            action: 'Review processing logs',
            automated: false,
            requiredApproval: false,
            estimatedTime: 15
          }
        ],
        timeToEscalate: 300000 // 5 minutes
      };
    }

    return undefined;
  }

  private calculateMetrics(startTime: number, result?: RecoveryResult): ErrorHandlingMetrics {
    const totalTime = performance.now() - startTime;
    
    return {
      classificationTime: 50, // Mock timing
      strategySelectionTime: 30,
      recoveryExecutionTime: result?.timeTaken || 0,
      totalHandlingTime: totalTime,
      resourcesConsumed: result?.resourcesUsed || {
        memoryMB: 0,
        cpuSeconds: 0,
        diskMB: 0,
        networkKB: 0
      },
      successRate: result?.success ? 1.0 : 0.0
    };
  }

  private createFailedRecoveryResult(): RecoveryResult {
    return {
      success: false,
      actionsExecuted: [],
      timeTaken: 0,
      resourcesUsed: {
        memoryMB: 0,
        cpuSeconds: 0,
        diskMB: 0,
        networkKB: 0
      },
      sideEffects: [],
      newRecommendations: ['Manual intervention required']
    };
  }

  private determineAction(strategy: RecoveryStrategy, result?: RecoveryResult): ErrorAction {
    if (!result) {
      return 'escalate_to_manual';
    }

    if (result.success) {
      return 'retry_immediately';
    }

    if (strategy.fallbackStrategies.length > 0) {
      return 'switch_tool';
    }

    return 'escalate_to_manual';
  }

  private createFallbackErrorHandlingResult(
    error: ProcessingError,
    context: ErrorContext,
    startTime: number
  ): ErrorHandlingResult {
    return {
      success: false,
      action: 'escalate_to_manual',
      strategy: {
        id: 'fallback',
        name: 'Fallback Strategy',
        description: 'Error handling failed, manual intervention required',
        actions: [],
        estimatedDuration: 0,
        successProbability: 0,
        resourceCost: 0,
        riskLevel: 'high',
        prerequisites: [],
        fallbackStrategies: []
      },
      recommendations: [{
        type: 'immediate',
        priority: 'critical',
        title: 'Error Handling Failed',
        description: 'Automatic error handling failed, manual review required',
        actionItems: ['Review error logs', 'Contact support'],
        estimatedImpact: 'Critical - immediate attention required'
      }],
      escalation: {
        level: 'emergency',
        reason: 'Error handling system failure',
        notificationTargets: [
          {
            type: 'email',
            recipient: 'emergency@example.com',
            urgency: 'critical'
          }
        ],
        escalationActions: [
          {
            action: 'Emergency response',
            automated: true,
            requiredApproval: false,
            estimatedTime: 0
          }
        ],
        timeToEscalate: 0
      },
      metrics: {
        classificationTime: 0,
        strategySelectionTime: 0,
        recoveryExecutionTime: 0,
        totalHandlingTime: performance.now() - startTime,
        resourcesConsumed: {
          memoryMB: 0,
          cpuSeconds: 0,
          diskMB: 0,
          networkKB: 0
        },
        successRate: 0
      }
    };
  }

  private async updateErrorPatterns(
    error: ProcessingError, 
    recovery: RecoveryResult
  ): Promise<void> {
    const patternKey = `${error.type}_${error.severity}`;
    
    if (!this.errorPatterns.has(patternKey)) {
      this.errorPatterns.set(patternKey, {
        id: patternKey,
        name: `${error.type} Pattern`,
        description: `Pattern for ${error.type} errors with ${error.severity} severity`,
        frequency: 0,
        severity: this.convertSeverityToNumber(error.severity),
        commonCauses: [],
        recommendedSolutions: [],
        preventionMeasures: [],
        lastOccurrence: new Date()
      });
    }

    const pattern = this.errorPatterns.get(patternKey)!;
    pattern.frequency++;
    pattern.lastOccurrence = new Date();

    // Update recommendations based on recovery result
    if (recovery.success && recovery.newRecommendations.length > 0) {
      pattern.recommendedSolutions.push(...recovery.newRecommendations);
    }
  }

  private convertSeverityToNumber(severity: string): number {
    const severityMap = { 'low': 1, 'medium': 2, 'high': 3, 'critical': 4 };
    return severityMap[severity as keyof typeof severityMap] || 2;
  }

  private analyzeErrorSequence(errors: ProcessingError[]): PatternAnalysis {
    const recentErrors = errors.slice(-5); // Analyze last 5 errors
    
    // Simple pattern detection
    const typePattern = recentErrors.map(e => e.type).join(',');
    const severityPattern = recentErrors.map(e => e.severity).join(',');
    
    // Check for recurring patterns
    const typeConsistency = this.calculateConsistency(recentErrors.map(e => e.type));
    const severityConsistency = this.calculateConsistency(recentErrors.map(e => e.severity));
    
    const confidence = (typeConsistency + severityConsistency) / 2;
    
    return {
      typePattern,
      severityPattern,
      confidence,
      frequency: recentErrors.length,
      timespan: recentErrors[recentErrors.length - 1].timestamp.getTime() - recentErrors[0].timestamp.getTime()
    };
  }

  private calculateConsistency(values: string[]): number {
    if (values.length <= 1) return 0;
    
    const uniqueValues = new Set(values);
    return 1 - (uniqueValues.size - 1) / (values.length - 1);
  }

  private createErrorPattern(analysis: PatternAnalysis, errors: ProcessingError[]): ErrorPattern {
    const mostCommonType = this.getMostCommon(errors.map(e => e.type));
    const mostCommonSeverity = this.getMostCommon(errors.map(e => e.severity));
    
    return {
      id: `pattern_${Date.now()}`,
      name: `${mostCommonType} Pattern`,
      description: `Recurring ${mostCommonType} errors with ${mostCommonSeverity} severity`,
      frequency: analysis.frequency,
      severity: this.convertSeverityToNumber(mostCommonSeverity),
      commonCauses: this.extractCommonCauses(errors),
      recommendedSolutions: this.generatePatternSolutions(mostCommonType),
      preventionMeasures: this.generatePreventionMeasures(mostCommonType),
      lastOccurrence: errors[errors.length - 1].timestamp
    };
  }

  private getMostCommon(values: string[]): string {
    const counts: Record<string, number> = {};
    values.forEach(value => {
      counts[value] = (counts[value] || 0) + 1;
    });
    
    return Object.entries(counts).reduce((a, b) => counts[a[0]] > counts[b[0]] ? a : b)[0];
  }

  private extractCommonCauses(errors: ProcessingError[]): string[] {
    // Simplified cause extraction
    const causes = new Set<string>();
    
    errors.forEach(error => {
      if (error.details?.classification?.category) {
        causes.add(`${error.details.classification.category} related issues`);
      }
    });
    
    return Array.from(causes);
  }

  private generatePatternSolutions(errorType: string): string[] {
    const solutions: Record<string, string[]> = {
      'tool_error': ['Update tool configuration', 'Switch to alternative tool', 'Restart processing service'],
      'resource_error': ['Increase memory allocation', 'Scale system resources', 'Optimize processing logic'],
      'network_error': ['Check network connectivity', 'Implement retry logic', 'Use local processing'],
      'timeout_error': ['Increase timeout values', 'Optimize processing speed', 'Implement chunked processing']
    };
    
    return solutions[errorType] || ['Review error logs', 'Contact technical support'];
  }

  private generatePreventionMeasures(errorType: string): string[] {
    const measures: Record<string, string[]> = {
      'tool_error': ['Regular tool updates', 'Configuration validation', 'Tool health monitoring'],
      'resource_error': ['Resource monitoring', 'Capacity planning', 'Resource optimization'],
      'network_error': ['Network monitoring', 'Redundant connections', 'Local caching'],
      'timeout_error': ['Performance monitoring', 'Load balancing', 'Processing optimization']
    };
    
    return measures[errorType] || ['Regular system monitoring', 'Preventive maintenance'];
  }

  // Public utility methods
  getErrorStatistics(): ErrorStatistics {
    const stats: ErrorStatistics = {
      totalErrors: 0,
      errorsByType: {},
      errorsBySeverity: {},
      recoverySuccessRate: 0,
      averageRecoveryTime: 0
    };

    this.errorMetrics.forEach((metrics, key) => {
      stats.totalErrors += metrics.count;
      
      const [type, severity] = key.split('_');
      stats.errorsByType[type] = (stats.errorsByType[type] || 0) + metrics.count;
      stats.errorsBySeverity[severity] = (stats.errorsBySeverity[severity] || 0) + metrics.count;
    });

    // Calculate recovery success rate
    const totalRecoveries = Array.from(this.errorMetrics.values()).reduce((sum, m) => sum + m.count, 0);
    const successfulRecoveries = Array.from(this.errorMetrics.values()).reduce((sum, m) => sum + m.successfulRecoveries, 0);
    
    stats.recoverySuccessRate = totalRecoveries > 0 ? successfulRecoveries / totalRecoveries : 0;
    
    // Calculate average recovery time
    const totalRecoveryTime = Array.from(this.errorMetrics.values()).reduce((sum, m) => sum + m.totalRecoveryTime, 0);
    stats.averageRecoveryTime = totalRecoveries > 0 ? totalRecoveryTime / totalRecoveries : 0;

    return stats;
  }

  exportErrorData(): ErrorExportData {
    return {
      patterns: Array.from(this.errorPatterns.values()),
      metrics: Array.from(this.errorMetrics.entries()),
      strategies: Array.from(this.recoveryStrategies.values()),
      exportTimestamp: new Date()
    };
  }

  async importErrorData(data: ErrorExportData): Promise<void> {
    // Import patterns
    data.patterns.forEach(pattern => {
      this.errorPatterns.set(pattern.id, pattern);
    });

    // Import metrics
    data.metrics.forEach(([key, metrics]) => {
      this.errorMetrics.set(key, metrics);
    });

    console.log(`Imported error data: ${data.patterns.length} patterns, ${data.metrics.length} metrics`);
  }
}

// Supporting interfaces and implementations
interface ErrorClassificationRule {
  pattern: RegExp;
  classification: ErrorClassification;
}

interface ErrorMetrics {
  count: number;
  totalRecoveryTime: number;
  successfulRecoveries: number;
  lastOccurrence: Date;
}

interface PatternAnalysis {
  typePattern: string;
  severityPattern: string;
  confidence: number;
  frequency: number;
  timespan: number;
}

interface ErrorStatistics {
  totalErrors: number;
  errorsByType: Record<string, number>;
  errorsBySeverity: Record<string, number>;
  recoverySuccessRate: number;
  averageRecoveryTime: number;
}

interface ErrorExportData {
  patterns: ErrorPattern[];
  metrics: [string, ErrorMetrics][];
  strategies: RecoveryStrategy[];
  exportTimestamp: Date;
}

class RecoverabilityAnalyzerImpl implements RecoverabilityAnalyzer {
  async analyze(error: ProcessingError, context: ErrorContext): Promise<RecoverabilityAssessment> {
    return {
      recoverable: error.recoverable,
      confidence: 0.8,
      factors: ['error_type', 'system_state', 'previous_attempts'],
      limitations: [],
      recommendedActions: ['apply_recovery_strategy']
    };
  }
}

class StrategySelectorImpl implements StrategySelector {
  async selectStrategy(
    error: ProcessingError,
    context: ErrorContext,
    strategies: Map<string, RecoveryStrategy>
  ): Promise<RecoveryStrategy> {
    // Simple strategy selection based on error type
    const strategyMap: Record<string, string> = {
      'resource_error': 'memory_recovery',
      'tool_error': 'tool_recovery',
      'timeout_error': 'timeout_recovery',
      'network_error': 'network_recovery'
    };

    const strategyId = strategyMap[error.type] || 'tool_recovery';
    return strategies.get(strategyId) || strategies.values().next().value;
  }
}

class RecoveryExecutorImpl implements RecoveryExecutor {
  async execute(strategy: RecoveryStrategy, context: ErrorContext): Promise<RecoveryResult> {
    const startTime = performance.now();
    const executedActions: ExecutedAction[] = [];
    let success = true;

    for (const action of strategy.actions) {
      const actionResult = await this.executeAction(action, context);
      executedActions.push(actionResult);
      
      if (!actionResult.success && !action.retryable) {
        success = false;
        break;
      }
    }

    return {
      success,
      actionsExecuted: executedActions,
      timeTaken: performance.now() - startTime,
      resourcesUsed: {
        memoryMB: 10, // Mock usage
        cpuSeconds: 0.1,
        diskMB: 1,
        networkKB: 0
      },
      sideEffects: [],
      newRecommendations: success ? ['Recovery completed successfully'] : ['Recovery failed, consider manual intervention']
    };
  }

  private async executeAction(action: RecoveryAction, context: ErrorContext): Promise<ExecutedAction> {
    const startTime = performance.now();
    
    try {
      // Simulate action execution
      await new Promise(resolve => setTimeout(resolve, Math.random() * 1000));
      
      return {
        action,
        success: Math.random() > 0.2, // 80% success rate
        timeTaken: performance.now() - startTime,
        result: { message: `${action.type} completed` }
      };
    } catch (error) {
      return {
        action,
        success: false,
        error: error instanceof Error ? error.message : 'Action failed',
        timeTaken: performance.now() - startTime
      };
    }
  }
}

// Supporting interface definitions
interface RecoverabilityAnalyzer {
  analyze(error: ProcessingError, context: ErrorContext): Promise<RecoverabilityAssessment>;
}

interface RecoverabilityAssessment {
  recoverable: boolean;
  confidence: number;
  factors: string[];
  limitations: string[];
  recommendedActions: string[];
}

interface StrategySelector {
  selectStrategy(
    error: ProcessingError,
    context: ErrorContext,
    strategies: Map<string, RecoveryStrategy>
  ): Promise<RecoveryStrategy>;
}

interface RecoveryExecutor {
  execute(strategy: RecoveryStrategy, context: ErrorContext): Promise<RecoveryResult>;
}

// Export default instance
export const errorHandler = new ComprehensiveErrorHandler(); 