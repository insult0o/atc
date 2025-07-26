/**
 * Validation Logging System
 * Tracks validation rule execution and results
 */

import { Logger, LogCategory } from './logger';
import { ExportFormat } from '../schemas/types';

export interface ValidationLog {
  ruleId: string;
  ruleName: string;
  result: 'pass' | 'fail' | 'warning' | 'skipped';
  details: {
    input: any;
    expected: any;
    actual: any;
    deviations: string[];
  };
  impact: 'blocking' | 'non-blocking';
  suggestions: string[];
  executionTime: number;
  metadata?: any;
}

export interface ValidationSession {
  sessionId: string;
  exportSessionId: string;
  format: ExportFormat;
  startTime: Date;
  endTime?: Date;
  rules: ValidationLog[];
  overrides: ValidationOverride[];
  summary?: ValidationSummary;
}

export interface ValidationOverride {
  ruleId: string;
  reason: string;
  approvedBy: string;
  approvedAt: Date;
  riskLevel: 'low' | 'medium' | 'high';
  conditions?: string[];
}

export interface ValidationSummary {
  totalRules: number;
  passed: number;
  failed: number;
  warnings: number;
  skipped: number;
  overridden: number;
  executionTime: number;
  score: number;
  blocking: boolean;
}

export class ValidationLogger {
  private logger: Logger;
  private sessions: Map<string, ValidationSession>;
  private ruleMetrics: Map<string, RuleMetrics>;

  constructor(logger?: Logger) {
    this.logger = logger || new Logger({ contextDefaults: { category: LogCategory.VALIDATION_STARTED } });
    this.sessions = new Map();
    this.ruleMetrics = new Map();
  }

  /**
   * Start validation session
   */
  startValidationSession(
    sessionId: string,
    exportSessionId: string,
    format: ExportFormat,
    metadata?: any
  ): void {
    const session: ValidationSession = {
      sessionId,
      exportSessionId,
      format,
      startTime: new Date(),
      rules: [],
      overrides: []
    };

    this.sessions.set(sessionId, session);

    this.logger.logValidation(
      LogCategory.VALIDATION_STARTED,
      `Validation started for ${format} export`,
      {
        sessionId,
        exportSessionId,
        format,
        ...metadata
      }
    );
  }

  /**
   * Log validation rule execution
   */
  logRuleExecution(sessionId: string, rule: ValidationLog): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.rules.push(rule);
    this.updateRuleMetrics(rule);

    const logLevel = rule.result === 'fail' && rule.impact === 'blocking' ? 'error' : 'info';
    const category = rule.result === 'pass' 
      ? LogCategory.VALIDATION_PASSED 
      : LogCategory.VALIDATION_FAILED;

    this.logger.logValidation(
      category,
      `Validation rule ${rule.ruleName}: ${rule.result}`,
      {
        sessionId,
        ruleId: rule.ruleId,
        ruleName: rule.ruleName,
        result: rule.result,
        impact: rule.impact,
        executionTime: rule.executionTime,
        deviations: rule.details.deviations,
        suggestions: rule.suggestions
      }
    );

    // Log detailed failure information
    if (rule.result === 'fail') {
      this.logValidationFailure(sessionId, rule);
    }
  }

  /**
   * Log validation failure details
   */
  private logValidationFailure(sessionId: string, rule: ValidationLog): void {
    this.logger.warn(
      `Validation failure: ${rule.ruleName}`,
      {
        sessionId,
        ruleId: rule.ruleId,
        details: {
          expected: this.sanitizeValue(rule.details.expected),
          actual: this.sanitizeValue(rule.details.actual),
          deviations: rule.details.deviations
        },
        impact: rule.impact,
        suggestions: rule.suggestions,
        canOverride: rule.impact === 'non-blocking'
      }
    );
  }

  /**
   * Log validation override
   */
  logValidationOverride(sessionId: string, override: ValidationOverride): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.overrides.push(override);

    this.logger.logValidation(
      LogCategory.VALIDATION_OVERRIDDEN,
      `Validation rule overridden: ${override.ruleId}`,
      {
        sessionId,
        ruleId: override.ruleId,
        reason: override.reason,
        approvedBy: override.approvedBy,
        approvedAt: override.approvedAt,
        riskLevel: override.riskLevel,
        conditions: override.conditions
      }
    );

    // Log audit event for compliance
    this.logger.logAudit(
      'Validation override approved',
      {
        sessionId,
        override,
        timestamp: new Date().toISOString()
      }
    );
  }

  /**
   * Complete validation session
   */
  completeValidationSession(sessionId: string): ValidationSummary | undefined {
    const session = this.sessions.get(sessionId);
    if (!session) return undefined;

    session.endTime = new Date();
    const summary = this.generateSummary(session);
    session.summary = summary;

    const category = summary.blocking 
      ? LogCategory.VALIDATION_FAILED 
      : LogCategory.VALIDATION_PASSED;

    this.logger.logValidation(
      category,
      `Validation completed for ${session.format} export`,
      {
        sessionId,
        exportSessionId: session.exportSessionId,
        format: session.format,
        summary,
        duration: session.endTime.getTime() - session.startTime.getTime()
      }
    );

    // Log performance metrics
    this.logger.logPerformance(
      'validation_session',
      {
        duration: summary.executionTime,
        memoryUsed: process.memoryUsage().heapUsed,
        validationTime: summary.executionTime
      },
      {
        sessionId,
        ruleCount: summary.totalRules,
        avgRuleTime: summary.totalRules > 0 
          ? summary.executionTime / summary.totalRules 
          : 0
      }
    );

    return summary;
  }

  /**
   * Log schema validation results
   */
  logSchemaValidation(
    sessionId: string,
    schemaName: string,
    valid: boolean,
    errors?: any[]
  ): void {
    const rule: ValidationLog = {
      ruleId: `schema_${schemaName}`,
      ruleName: `Schema Validation: ${schemaName}`,
      result: valid ? 'pass' : 'fail',
      details: {
        input: 'document',
        expected: 'valid schema',
        actual: valid ? 'valid' : 'invalid',
        deviations: errors?.map(e => e.message || String(e)) || []
      },
      impact: 'blocking',
      suggestions: errors?.map(e => `Fix: ${e.dataPath} ${e.message}`) || [],
      executionTime: 0
    };

    this.logRuleExecution(sessionId, rule);
  }

  /**
   * Log custom validation rule
   */
  logCustomRule(
    sessionId: string,
    ruleName: string,
    result: boolean,
    details?: any
  ): void {
    const rule: ValidationLog = {
      ruleId: `custom_${ruleName.toLowerCase().replace(/\s+/g, '_')}`,
      ruleName,
      result: result ? 'pass' : 'fail',
      details: {
        input: details?.input || 'custom data',
        expected: details?.expected || 'valid',
        actual: details?.actual || (result ? 'valid' : 'invalid'),
        deviations: details?.deviations || []
      },
      impact: details?.impact || 'non-blocking',
      suggestions: details?.suggestions || [],
      executionTime: details?.executionTime || 0,
      metadata: details?.metadata
    };

    this.logRuleExecution(sessionId, rule);
  }

  /**
   * Get validation metrics
   */
  getValidationMetrics(): {
    ruleMetrics: Map<string, RuleMetrics>;
    sessionStats: SessionStats;
  } {
    return {
      ruleMetrics: new Map(this.ruleMetrics),
      sessionStats: this.calculateSessionStats()
    };
  }

  /**
   * Private helper methods
   */

  private generateSummary(session: ValidationSession): ValidationSummary {
    const summary: ValidationSummary = {
      totalRules: session.rules.length,
      passed: 0,
      failed: 0,
      warnings: 0,
      skipped: 0,
      overridden: session.overrides.length,
      executionTime: 0,
      score: 100,
      blocking: false
    };

    session.rules.forEach(rule => {
      switch (rule.result) {
        case 'pass':
          summary.passed++;
          break;
        case 'fail':
          summary.failed++;
          if (rule.impact === 'blocking') {
            summary.blocking = true;
          }
          break;
        case 'warning':
          summary.warnings++;
          break;
        case 'skipped':
          summary.skipped++;
          break;
      }

      summary.executionTime += rule.executionTime;
    });

    // Calculate score
    if (summary.totalRules > 0) {
      const failedWeight = 10;
      const warningWeight = 3;
      const deductions = (summary.failed * failedWeight) + (summary.warnings * warningWeight);
      summary.score = Math.max(0, 100 - deductions);
    }

    // Check if any non-overridden blocking rules failed
    const blockingFailed = session.rules.filter(r => 
      r.result === 'fail' && 
      r.impact === 'blocking' &&
      !session.overrides.some(o => o.ruleId === r.ruleId)
    );

    summary.blocking = blockingFailed.length > 0;

    return summary;
  }

  private updateRuleMetrics(rule: ValidationLog): void {
    const metrics = this.ruleMetrics.get(rule.ruleId) || {
      ruleId: rule.ruleId,
      ruleName: rule.ruleName,
      totalExecutions: 0,
      passes: 0,
      failures: 0,
      warnings: 0,
      avgExecutionTime: 0,
      lastExecuted: new Date()
    };

    metrics.totalExecutions++;
    
    switch (rule.result) {
      case 'pass':
        metrics.passes++;
        break;
      case 'fail':
        metrics.failures++;
        break;
      case 'warning':
        metrics.warnings++;
        break;
    }

    // Update average execution time
    metrics.avgExecutionTime = 
      (metrics.avgExecutionTime * (metrics.totalExecutions - 1) + rule.executionTime) / 
      metrics.totalExecutions;

    metrics.lastExecuted = new Date();

    this.ruleMetrics.set(rule.ruleId, metrics);
  }

  private calculateSessionStats(): SessionStats {
    const stats: SessionStats = {
      totalSessions: this.sessions.size,
      successfulSessions: 0,
      failedSessions: 0,
      avgValidationTime: 0,
      avgRulesPerSession: 0,
      avgScore: 0
    };

    let totalTime = 0;
    let totalRules = 0;
    let totalScore = 0;
    let completedSessions = 0;

    this.sessions.forEach(session => {
      if (session.summary) {
        completedSessions++;
        
        if (session.summary.blocking) {
          stats.failedSessions++;
        } else {
          stats.successfulSessions++;
        }

        totalTime += session.summary.executionTime;
        totalRules += session.summary.totalRules;
        totalScore += session.summary.score;
      }
    });

    if (completedSessions > 0) {
      stats.avgValidationTime = totalTime / completedSessions;
      stats.avgRulesPerSession = totalRules / completedSessions;
      stats.avgScore = totalScore / completedSessions;
    }

    return stats;
  }

  private sanitizeValue(value: any): any {
    // Basic sanitization for logging
    if (typeof value === 'string' && value.length > 1000) {
      return value.substring(0, 1000) + '... (truncated)';
    }
    
    if (typeof value === 'object' && value !== null) {
      const str = JSON.stringify(value);
      if (str.length > 1000) {
        return str.substring(0, 1000) + '... (truncated)';
      }
    }
    
    return value;
  }

  /**
   * Clear old sessions
   */
  clearOldSessions(olderThanMs: number = 3600000): number {
    const cutoff = Date.now() - olderThanMs;
    let cleared = 0;

    Array.from(this.sessions.entries()).forEach(([id, session]) => {
      if (session.startTime.getTime() < cutoff) {
        this.sessions.delete(id);
        cleared++;
      }
    });

    return cleared;
  }
}

interface RuleMetrics {
  ruleId: string;
  ruleName: string;
  totalExecutions: number;
  passes: number;
  failures: number;
  warnings: number;
  avgExecutionTime: number;
  lastExecuted: Date;
}

interface SessionStats {
  totalSessions: number;
  successfulSessions: number;
  failedSessions: number;
  avgValidationTime: number;
  avgRulesPerSession: number;
  avgScore: number;
}