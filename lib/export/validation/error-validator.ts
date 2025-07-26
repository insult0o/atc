// Task 3: Error State Verification
// Detects and validates error states across all components

import { Zone } from '../../types/zone';
import { PDFDocument } from '../../types/pdf';

export interface ErrorThresholds {
  maxCriticalErrors: number;          // Block if exceeded
  maxTotalErrors: number;             // Block if exceeded
  errorRateThreshold: number;         // Error % that triggers block
  allowedErrorTypes: string[];        // Non-blocking error types
  errorImpactScoring: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
}

export interface ErrorValidationResult {
  valid: boolean;
  errorCount: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    total: number;
  };
  errorRate: number;
  impactScore: number;
  blockingErrors: ErrorDetail[];
  recoverableErrors: ErrorDetail[];
  errorDistribution: Map<string, number>;
}

export interface ErrorDetail {
  id: string;
  component: string;
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  message: string;
  timestamp: Date;
  context: Record<string, any>;
  recoverable: boolean;
  retryCount?: number;
  resolution?: string;
}

export interface ErrorAnalysisDetails {
  totalErrors: number;
  criticalErrors: number;
  errorsByComponent: Map<string, number>;
  errorsByType: Map<string, number>;
  timelineAnalysis: {
    firstError: Date | null;
    lastError: Date | null;
    errorFrequency: number; // errors per minute
  };
  impactAssessment: {
    affectedZones: number;
    dataLossRisk: 'high' | 'medium' | 'low' | 'none';
    processingImpact: 'complete_failure' | 'partial_failure' | 'minimal';
  };
}

export class ErrorValidator {
  private config: ErrorThresholds;
  private errorLog: ErrorDetail[] = [];

  constructor(config?: Partial<ErrorThresholds>) {
    this.config = {
      maxCriticalErrors: 0,
      maxTotalErrors: 10,
      errorRateThreshold: 5, // 5% error rate
      allowedErrorTypes: [
        'timeout_recoverable',
        'rate_limit',
        'temporary_network',
        'ocr_confidence_low'
      ],
      errorImpactScoring: {
        critical: 100,
        high: 50,
        medium: 20,
        low: 5
      },
      ...config
    };
  }

  /**
   * Validate error state for an export
   */
  public async validate(
    document: PDFDocument,
    zones: Zone[],
    processingErrors: ErrorDetail[]
  ): Promise<ErrorValidationResult> {
    // Collect all errors
    const allErrors = this.collectAllErrors(document, zones, processingErrors);
    
    // Categorize errors
    const errorCount = this.categorizeErrors(allErrors);
    
    // Calculate error rate
    const errorRate = this.calculateErrorRate(zones, allErrors);
    
    // Calculate impact score
    const impactScore = this.calculateImpactScore(allErrors);
    
    // Identify blocking errors
    const { blockingErrors, recoverableErrors } = this.classifyErrors(allErrors);
    
    // Create error distribution
    const errorDistribution = this.createErrorDistribution(allErrors);
    
    // Determine validity
    const valid = this.isValid(errorCount, errorRate, blockingErrors);

    return {
      valid,
      errorCount,
      errorRate,
      impactScore,
      blockingErrors,
      recoverableErrors,
      errorDistribution
    };
  }

  /**
   * Collect all errors from various sources
   */
  private collectAllErrors(
    document: PDFDocument,
    zones: Zone[],
    processingErrors: ErrorDetail[]
  ): ErrorDetail[] {
    const errors: ErrorDetail[] = [...processingErrors];

    // Collect zone errors
    zones.forEach(zone => {
      if (zone.status === 'failed' || zone.status === 'error') {
        errors.push({
          id: `zone_error_${zone.id}`,
          component: 'zone_processing',
          type: zone.errorDetails?.type || 'unknown',
          severity: this.determineZoneErrorSeverity(zone),
          message: zone.errorDetails?.message || 'Zone processing failed',
          timestamp: zone.errorDetails?.timestamp || new Date(),
          context: {
            zoneId: zone.id,
            zoneType: zone.type,
            pageNumber: zone.pageNumber
          },
          recoverable: zone.errorDetails?.recoverable ?? false
        });
      }
    });

    // Check document-level errors
    if (document.processingStatus === 'failed') {
      errors.push({
        id: `doc_error_${document.id}`,
        component: 'document_processing',
        type: 'document_failure',
        severity: 'critical',
        message: 'Document processing failed',
        timestamp: new Date(),
        context: {
          documentId: document.id,
          filename: document.filename
        },
        recoverable: false
      });
    }

    return errors;
  }

  /**
   * Determine severity of zone error
   */
  private determineZoneErrorSeverity(zone: Zone): 'critical' | 'high' | 'medium' | 'low' {
    // Critical zones
    if (zone.type === 'table' || zone.type === 'diagram') {
      return 'high';
    }
    
    // Large zones
    const area = zone.bounds.width * zone.bounds.height;
    if (area > 10000) {
      return 'high';
    }
    
    // Header/footer zones
    if (zone.type === 'header' || zone.type === 'footer') {
      return 'low';
    }
    
    return 'medium';
  }

  /**
   * Categorize errors by severity
   */
  private categorizeErrors(errors: ErrorDetail[]): ErrorValidationResult['errorCount'] {
    const count = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      total: errors.length
    };

    errors.forEach(error => {
      count[error.severity]++;
    });

    return count;
  }

  /**
   * Calculate error rate
   */
  private calculateErrorRate(zones: Zone[], errors: ErrorDetail[]): number {
    const totalOperations = zones.length + 1; // zones + document
    return (errors.length / totalOperations) * 100;
  }

  /**
   * Calculate impact score
   */
  private calculateImpactScore(errors: ErrorDetail[]): number {
    return errors.reduce((score, error) => {
      return score + this.config.errorImpactScoring[error.severity];
    }, 0);
  }

  /**
   * Classify errors as blocking or recoverable
   */
  private classifyErrors(
    errors: ErrorDetail[]
  ): { blockingErrors: ErrorDetail[]; recoverableErrors: ErrorDetail[] } {
    const blockingErrors: ErrorDetail[] = [];
    const recoverableErrors: ErrorDetail[] = [];

    errors.forEach(error => {
      if (error.recoverable && this.config.allowedErrorTypes.includes(error.type)) {
        recoverableErrors.push(error);
      } else if (error.severity === 'critical' || !error.recoverable) {
        blockingErrors.push(error);
      } else {
        recoverableErrors.push(error);
      }
    });

    return { blockingErrors, recoverableErrors };
  }

  /**
   * Create error distribution map
   */
  private createErrorDistribution(errors: ErrorDetail[]): Map<string, number> {
    const distribution = new Map<string, number>();

    errors.forEach(error => {
      const key = `${error.component}:${error.type}`;
      distribution.set(key, (distribution.get(key) || 0) + 1);
    });

    return distribution;
  }

  /**
   * Determine if validation passes
   */
  private isValid(
    errorCount: ErrorValidationResult['errorCount'],
    errorRate: number,
    blockingErrors: ErrorDetail[]
  ): boolean {
    // Check critical error threshold
    if (errorCount.critical > this.config.maxCriticalErrors) {
      return false;
    }

    // Check total error threshold
    if (errorCount.total > this.config.maxTotalErrors) {
      return false;
    }

    // Check error rate threshold
    if (errorRate > this.config.errorRateThreshold) {
      return false;
    }

    // Check for blocking errors
    if (blockingErrors.length > 0) {
      return false;
    }

    return true;
  }

  /**
   * Get detailed error analysis
   */
  public analyzeErrors(errors: ErrorDetail[]): ErrorAnalysisDetails {
    const errorsByComponent = new Map<string, number>();
    const errorsByType = new Map<string, number>();
    let firstError: Date | null = null;
    let lastError: Date | null = null;

    errors.forEach(error => {
      // Component distribution
      errorsByComponent.set(
        error.component, 
        (errorsByComponent.get(error.component) || 0) + 1
      );

      // Type distribution
      errorsByType.set(
        error.type,
        (errorsByType.get(error.type) || 0) + 1
      );

      // Timeline
      if (!firstError || error.timestamp < firstError) {
        firstError = error.timestamp;
      }
      if (!lastError || error.timestamp > lastError) {
        lastError = error.timestamp;
      }
    });

    // Calculate error frequency
    let errorFrequency = 0;
    if (firstError && lastError) {
      const durationMinutes = (lastError.getTime() - firstError.getTime()) / 60000;
      errorFrequency = durationMinutes > 0 ? errors.length / durationMinutes : 0;
    }

    // Assess impact
    const criticalErrors = errors.filter(e => e.severity === 'critical').length;
    const affectedZones = errors.filter(e => e.component === 'zone_processing').length;
    
    const dataLossRisk = criticalErrors > 0 ? 'high' :
                        affectedZones > 5 ? 'medium' :
                        affectedZones > 0 ? 'low' : 'none';
    
    const processingImpact = criticalErrors > 0 ? 'complete_failure' :
                           affectedZones > 10 ? 'partial_failure' : 'minimal';

    return {
      totalErrors: errors.length,
      criticalErrors,
      errorsByComponent,
      errorsByType,
      timelineAnalysis: {
        firstError,
        lastError,
        errorFrequency
      },
      impactAssessment: {
        affectedZones,
        dataLossRisk,
        processingImpact
      }
    };
  }

  /**
   * Check for specific error patterns
   */
  public checkErrorPatterns(errors: ErrorDetail[]): {
    hasSystematicFailure: boolean;
    hasTimeoutCluster: boolean;
    hasMemoryIssues: boolean;
    recommendations: string[];
  } {
    const recommendations: string[] = [];
    
    // Check for systematic failures
    const componentErrors = new Map<string, number>();
    errors.forEach(e => {
      componentErrors.set(e.component, (componentErrors.get(e.component) || 0) + 1);
    });
    
    const hasSystematicFailure = Array.from(componentErrors.values()).some(count => count > 5);
    if (hasSystematicFailure) {
      recommendations.push('Systematic failures detected - check component health');
    }

    // Check for timeout clusters
    const timeoutErrors = errors.filter(e => e.type.includes('timeout'));
    const hasTimeoutCluster = timeoutErrors.length > 3;
    if (hasTimeoutCluster) {
      recommendations.push('Multiple timeouts detected - consider increasing timeout limits');
    }

    // Check for memory issues
    const memoryErrors = errors.filter(e => 
      e.message.toLowerCase().includes('memory') || 
      e.type.includes('oom')
    );
    const hasMemoryIssues = memoryErrors.length > 0;
    if (hasMemoryIssues) {
      recommendations.push('Memory issues detected - optimize processing or increase resources');
    }

    return {
      hasSystematicFailure,
      hasTimeoutCluster,
      hasMemoryIssues,
      recommendations
    };
  }

  /**
   * Add error to internal log
   */
  public logError(error: ErrorDetail): void {
    this.errorLog.push(error);
  }

  /**
   * Get error history
   */
  public getErrorHistory(): ErrorDetail[] {
    return [...this.errorLog];
  }

  /**
   * Clear error log
   */
  public clearErrorLog(): void {
    this.errorLog = [];
  }
}

// Export singleton instance
export const errorValidator = new ErrorValidator();