/**
 * Error State Documentation
 * Comprehensive error logging with context and recovery tracking
 */

import { Logger, LogCategory, ErrorDetails } from './logger';

export interface ErrorLog {
  errorId: string;
  errorCode: string;
  errorType: ErrorType;
  message: string;
  stack?: string;
  context: ErrorContext;
  recovery: RecoveryAttempt;
  userImpact: 'none' | 'minimal' | 'moderate' | 'severe';
  timestamp: Date;
  correlationId: string;
}

export type ErrorType = 
  | 'validation_error'
  | 'processing_error'
  | 'resource_error'
  | 'network_error'
  | 'permission_error'
  | 'data_corruption'
  | 'timeout_error'
  | 'configuration_error'
  | 'unknown_error';

export interface ErrorContext {
  operation: string;
  phase: string;
  parameters: Record<string, any>;
  systemState: SystemState;
  previousErrors: ErrorReference[];
  environment: Record<string, any>;
}

export interface SystemState {
  memoryUsage: number;
  cpuUsage?: number;
  activeOperations: number;
  queueDepth: number;
  resourceUtilization: ResourceUtilization;
}

export interface ResourceUtilization {
  memory: { used: number; total: number; percentage: number };
  cpu?: { percentage: number; loadAverage: number[] };
  disk?: { used: number; total: number; percentage: number };
  connections?: { active: number; max: number };
}

export interface RecoveryAttempt {
  attempted: boolean;
  strategy: RecoveryStrategy;
  successful: boolean;
  attempts: number;
  fallback?: string;
  nextAction?: string;
  recoveryTime?: number;
}

export type RecoveryStrategy = 
  | 'retry'
  | 'retry_with_backoff'
  | 'fallback'
  | 'skip'
  | 'abort'
  | 'manual_intervention'
  | 'auto_heal';

export interface ErrorReference {
  errorId: string;
  errorCode: string;
  timestamp: Date;
  resolved: boolean;
}

export interface ErrorPattern {
  pattern: string;
  count: number;
  firstSeen: Date;
  lastSeen: Date;
  affectedOperations: string[];
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export class ErrorLogger {
  private logger: Logger;
  private errorHistory: Map<string, ErrorLog>;
  private errorPatterns: Map<string, ErrorPattern>;
  private recoveryStrategies: Map<string, RecoveryStrategy>;
  private readonly maxHistorySize = 1000;

  constructor(logger?: Logger) {
    this.logger = logger || new Logger();
    this.errorHistory = new Map();
    this.errorPatterns = new Map();
    this.recoveryStrategies = this.initializeRecoveryStrategies();
  }

  /**
   * Log comprehensive error
   */
  logError(
    error: Error | any,
    context: Partial<ErrorContext>,
    impact?: ErrorLog['userImpact']
  ): string {
    const errorLog = this.createErrorLog(error, context, impact);
    
    // Store in history
    this.errorHistory.set(errorLog.errorId, errorLog);
    this.enforceHistoryLimit();

    // Update patterns
    this.updateErrorPatterns(errorLog);

    // Log based on severity
    if (errorLog.userImpact === 'severe') {
      this.logger.critical(
        `Critical error: ${errorLog.message}`,
        error,
        {
          errorId: errorLog.errorId,
          errorCode: errorLog.errorCode,
          context: errorLog.context,
          impact: errorLog.userImpact
        }
      );
    } else {
      this.logger.error(
        errorLog.message,
        error,
        {
          errorId: errorLog.errorId,
          errorCode: errorLog.errorCode,
          context: errorLog.context,
          impact: errorLog.userImpact,
          recovery: errorLog.recovery
        }
      );
    }

    // Log system state if resource-related
    if (this.isResourceError(errorLog)) {
      this.logSystemState(errorLog);
    }

    return errorLog.errorId;
  }

  /**
   * Log error recovery attempt
   */
  logRecoveryAttempt(
    errorId: string,
    strategy: RecoveryStrategy,
    successful: boolean,
    details?: any
  ): void {
    const errorLog = this.errorHistory.get(errorId);
    if (!errorLog) return;

    errorLog.recovery = {
      attempted: true,
      strategy,
      successful,
      attempts: (errorLog.recovery?.attempts || 0) + 1,
      recoveryTime: details?.duration,
      nextAction: details?.nextAction
    };

    this.logger.logExport(
      successful ? LogCategory.ERROR_RECOVERED : LogCategory.ERROR_OCCURRED,
      `Error recovery ${successful ? 'successful' : 'failed'}`,
      {
        errorId,
        strategy,
        attempts: errorLog.recovery.attempts,
        duration: details?.duration,
        details
      }
    );

    // Update pattern if recovery successful
    if (successful) {
      this.updatePatternResolution(errorLog.errorCode);
    }
  }

  /**
   * Log error patterns
   */
  logErrorPattern(patternId: string, details: string): void {
    const pattern = this.errorPatterns.get(patternId);
    if (!pattern) return;

    this.logger.warn(
      `Error pattern detected: ${patternId}`,
      {
        pattern: pattern.pattern,
        occurrences: pattern.count,
        timespan: Date.now() - pattern.firstSeen.getTime(),
        severity: pattern.severity,
        affectedOperations: pattern.affectedOperations,
        details
      }
    );

    // Alert if critical pattern
    if (pattern.severity === 'critical' && pattern.count > 5) {
      this.logger.critical(
        `Critical error pattern requires attention`,
        new Error(`Pattern ${patternId} exceeded threshold`),
        { pattern, threshold: 5 }
      );
    }
  }

  /**
   * Analyze error trends
   */
  analyzeErrorTrends(timeWindowMs: number = 3600000): {
    totalErrors: number;
    errorsByType: Record<ErrorType, number>;
    errorsByImpact: Record<string, number>;
    topPatterns: ErrorPattern[];
    recoveryRate: number;
    trends: ErrorTrend[];
  } {
    const cutoff = Date.now() - timeWindowMs;
    const recentErrors = Array.from(this.errorHistory.values())
      .filter(e => e.timestamp.getTime() > cutoff);

    const analysis = {
      totalErrors: recentErrors.length,
      errorsByType: {} as Record<ErrorType, number>,
      errorsByImpact: {} as Record<string, number>,
      topPatterns: [] as ErrorPattern[],
      recoveryRate: 0,
      trends: [] as ErrorTrend[]
    };

    // Count by type
    recentErrors.forEach(error => {
      analysis.errorsByType[error.errorType] = (analysis.errorsByType[error.errorType] || 0) + 1;
      analysis.errorsByImpact[error.userImpact] = (analysis.errorsByImpact[error.userImpact] || 0) + 1;
    });

    // Calculate recovery rate
    const recoveryAttempts = recentErrors.filter(e => e.recovery.attempted);
    const successfulRecoveries = recoveryAttempts.filter(e => e.recovery.successful);
    analysis.recoveryRate = recoveryAttempts.length > 0 
      ? (successfulRecoveries.length / recoveryAttempts.length) * 100 
      : 0;

    // Get top patterns
    analysis.topPatterns = Array.from(this.errorPatterns.values())
      .filter(p => p.lastSeen.getTime() > cutoff)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Identify trends
    analysis.trends = this.identifyTrends(recentErrors);

    return analysis;
  }

  /**
   * Get error categorization
   */
  categorizeError(error: Error | any): {
    type: ErrorType;
    code: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    category: string;
  } {
    const errorMessage = error?.message?.toLowerCase() || '';
    const errorCode = error?.code || 'UNKNOWN';

    let type: ErrorType = 'unknown_error';
    let severity: 'low' | 'medium' | 'high' | 'critical' = 'medium';
    let category = 'general';

    // Categorize by error patterns
    if (errorMessage.includes('validation') || errorCode.includes('VALID')) {
      type = 'validation_error';
      severity = 'low';
      category = 'data_quality';
    } else if (errorMessage.includes('memory') || errorMessage.includes('heap')) {
      type = 'resource_error';
      severity = 'high';
      category = 'system_resources';
    } else if (errorMessage.includes('timeout') || errorCode === 'ETIMEDOUT') {
      type = 'timeout_error';
      severity = 'medium';
      category = 'performance';
    } else if (errorMessage.includes('permission') || errorCode === 'EACCES') {
      type = 'permission_error';
      severity = 'high';
      category = 'security';
    } else if (errorMessage.includes('corrupt') || errorMessage.includes('invalid data')) {
      type = 'data_corruption';
      severity = 'critical';
      category = 'data_integrity';
    }

    return { type, code: errorCode, severity, category };
  }

  /**
   * Private helper methods
   */

  private createErrorLog(
    error: Error | any,
    context: Partial<ErrorContext>,
    impact?: ErrorLog['userImpact']
  ): ErrorLog {
    const categorization = this.categorizeError(error);
    const errorId = this.generateErrorId();
    
    const errorLog: ErrorLog = {
      errorId,
      errorCode: categorization.code,
      errorType: categorization.type,
      message: error?.message || 'Unknown error',
      stack: error?.stack,
      context: {
        operation: context.operation || 'unknown',
        phase: context.phase || 'unknown',
        parameters: context.parameters || {},
        systemState: context.systemState || this.captureSystemState(),
        previousErrors: context.previousErrors || this.getRecentErrors(5),
        environment: context.environment || {}
      },
      recovery: {
        attempted: false,
        strategy: this.determineRecoveryStrategy(categorization.type),
        successful: false,
        attempts: 0
      },
      userImpact: impact || this.assessUserImpact(categorization),
      timestamp: new Date(),
      correlationId: this.logger['correlationId'] || 'unknown'
    };

    return errorLog;
  }

  private captureSystemState(): SystemState {
    const memUsage = process.memoryUsage();
    
    return {
      memoryUsage: memUsage.heapUsed,
      activeOperations: 0, // Would be tracked by the system
      queueDepth: 0, // Would be tracked by queue manager
      resourceUtilization: {
        memory: {
          used: memUsage.heapUsed,
          total: memUsage.heapTotal,
          percentage: (memUsage.heapUsed / memUsage.heapTotal) * 100
        }
      }
    };
  }

  private getRecentErrors(count: number): ErrorReference[] {
    return Array.from(this.errorHistory.values())
      .slice(-count)
      .map(e => ({
        errorId: e.errorId,
        errorCode: e.errorCode,
        timestamp: e.timestamp,
        resolved: e.recovery.successful
      }));
  }

  private updateErrorPatterns(errorLog: ErrorLog): void {
    const patternKey = `${errorLog.errorType}_${errorLog.context.operation}`;
    const pattern = this.errorPatterns.get(patternKey) || {
      pattern: patternKey,
      count: 0,
      firstSeen: errorLog.timestamp,
      lastSeen: errorLog.timestamp,
      affectedOperations: [],
      severity: 'low'
    };

    pattern.count++;
    pattern.lastSeen = errorLog.timestamp;
    
    if (!pattern.affectedOperations.includes(errorLog.context.operation)) {
      pattern.affectedOperations.push(errorLog.context.operation);
    }

    // Update severity based on frequency
    if (pattern.count > 50) pattern.severity = 'critical';
    else if (pattern.count > 20) pattern.severity = 'high';
    else if (pattern.count > 10) pattern.severity = 'medium';

    this.errorPatterns.set(patternKey, pattern);
  }

  private updatePatternResolution(errorCode: string): void {
    // Mark patterns as potentially resolved
    this.errorPatterns.forEach((pattern, key) => {
      if (key.includes(errorCode)) {
        pattern.count = Math.max(0, pattern.count - 1);
      }
    });
  }

  private isResourceError(errorLog: ErrorLog): boolean {
    return errorLog.errorType === 'resource_error' ||
           errorLog.message.toLowerCase().includes('memory') ||
           errorLog.message.toLowerCase().includes('disk space');
  }

  private logSystemState(errorLog: ErrorLog): void {
    this.logger.warn(
      'System resource state at error',
      {
        errorId: errorLog.errorId,
        systemState: errorLog.context.systemState,
        threshold: {
          memory: '80%',
          cpu: '90%'
        }
      }
    );
  }

  private determineRecoveryStrategy(errorType: ErrorType): RecoveryStrategy {
    return this.recoveryStrategies.get(errorType) || 'abort';
  }

  private initializeRecoveryStrategies(): Map<string, RecoveryStrategy> {
    return new Map([
      ['validation_error', 'skip'],
      ['processing_error', 'retry'],
      ['resource_error', 'retry_with_backoff'],
      ['network_error', 'retry_with_backoff'],
      ['permission_error', 'manual_intervention'],
      ['data_corruption', 'abort'],
      ['timeout_error', 'retry'],
      ['configuration_error', 'manual_intervention'],
      ['unknown_error', 'fallback']
    ]);
  }

  private assessUserImpact(categorization: any): ErrorLog['userImpact'] {
    if (categorization.severity === 'critical') return 'severe';
    if (categorization.severity === 'high') return 'moderate';
    if (categorization.category === 'data_integrity') return 'severe';
    if (categorization.category === 'security') return 'moderate';
    return 'minimal';
  }

  private identifyTrends(errors: ErrorLog[]): ErrorTrend[] {
    const trends: ErrorTrend[] = [];
    
    // Group errors by hour
    const hourlyGroups = new Map<number, ErrorLog[]>();
    errors.forEach(error => {
      const hour = Math.floor(error.timestamp.getTime() / (1000 * 60 * 60));
      if (!hourlyGroups.has(hour)) {
        hourlyGroups.set(hour, []);
      }
      hourlyGroups.get(hour)!.push(error);
    });

    // Analyze trends
    const hours = Array.from(hourlyGroups.keys()).sort();
    for (let i = 1; i < hours.length; i++) {
      const current = hourlyGroups.get(hours[i])!.length;
      const previous = hourlyGroups.get(hours[i - 1])!.length;
      
      if (current > previous * 1.5) {
        trends.push({
          type: 'spike',
          startTime: new Date(hours[i - 1] * 1000 * 60 * 60),
          endTime: new Date(hours[i] * 1000 * 60 * 60),
          magnitude: current / previous,
          affectedTypes: this.getAffectedTypes(hourlyGroups.get(hours[i])!)
        });
      }
    }

    return trends;
  }

  private getAffectedTypes(errors: ErrorLog[]): ErrorType[] {
    const types = new Set<ErrorType>();
    errors.forEach(e => types.add(e.errorType));
    return Array.from(types);
  }

  private enforceHistoryLimit(): void {
    if (this.errorHistory.size > this.maxHistorySize) {
      const sorted = Array.from(this.errorHistory.entries())
        .sort((a, b) => a[1].timestamp.getTime() - b[1].timestamp.getTime());
      
      const toRemove = sorted.slice(0, this.errorHistory.size - this.maxHistorySize);
      toRemove.forEach(([id]) => this.errorHistory.delete(id));
    }
  }

  private generateErrorId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Clear old errors
   */
  clearOldErrors(olderThanMs: number = 86400000): number {
    const cutoff = Date.now() - olderThanMs;
    let cleared = 0;

    Array.from(this.errorHistory.entries()).forEach(([id, error]) => {
      if (error.timestamp.getTime() < cutoff) {
        this.errorHistory.delete(id);
        cleared++;
      }
    });

    return cleared;
  }
}

interface ErrorTrend {
  type: 'spike' | 'increase' | 'decrease';
  startTime: Date;
  endTime: Date;
  magnitude: number;
  affectedTypes: ErrorType[];
}