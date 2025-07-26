/**
 * Export Operation Logger
 * Tracks all export operations with detailed metadata
 */

import { Logger, LogCategory, LogMetadata } from './logger';
import { ExportFormat } from '../schemas/types';
import { ExportSelection } from '@/app/components/export/SelectionPanel';

export interface ExportOperationMetadata extends LogMetadata {
  sessionId: string;
  documentName: string;
  documentSize?: number;
  exportType: 'full' | 'partial';
  formats: ExportFormat[];
  selection?: ExportSelection;
  configuration: {
    validation: boolean;
    compression: boolean;
    includeMetadata: boolean;
    preserveReferences?: boolean;
  };
  userAction?: {
    type: 'initiate' | 'cancel' | 'retry' | 'override';
    reason?: string;
    timestamp: string;
  };
}

export interface ExportProgress {
  phase: 'queued' | 'preparing' | 'validating' | 'processing' | 'finalizing' | 'complete';
  percentage: number;
  itemsProcessed: number;
  totalItems: number;
  currentOperation?: string;
}

export interface ExportResult {
  success: boolean;
  duration: number;
  outputSize: number;
  formats: Record<ExportFormat, FormatResult>;
  errors?: string[];
  warnings?: string[];
}

export interface FormatResult {
  success: boolean;
  fileSize: number;
  itemCount: number;
  processingTime: number;
  validationScore?: number;
}

export class ExportLogger {
  private logger: Logger;
  private activeExports: Map<string, ExportOperationMetadata>;

  constructor(logger?: Logger) {
    this.logger = logger || new Logger({ contextDefaults: { category: LogCategory.EXPORT_INITIATED } });
    this.activeExports = new Map();
  }

  /**
   * Log export initiation
   */
  logExportInitiated(metadata: ExportOperationMetadata): void {
    this.activeExports.set(metadata.sessionId, metadata);

    this.logger.setContext({
      userId: metadata.userId,
      documentId: metadata.documentId,
    });

    this.logger.logExport(
      LogCategory.EXPORT_INITIATED,
      `Export initiated for document: ${metadata.documentName}`,
      {
        sessionId: metadata.sessionId,
        exportType: metadata.exportType,
        formats: metadata.formats,
        documentSize: metadata.documentSize,
        configuration: metadata.configuration,
        selection: metadata.selection ? {
          type: metadata.selection.type,
          itemCount: metadata.selection.totalCount,
          coverage: metadata.selection.totalCount
        } : undefined
      }
    );

    // Log user action if provided
    if (metadata.userAction) {
      this.logUserAction(metadata.sessionId, metadata.userAction);
    }
  }

  /**
   * Log export progress milestones
   */
  logExportProgress(sessionId: string, progress: ExportProgress): void {
    const metadata = this.activeExports.get(sessionId);
    if (!metadata) return;

    const milestone = this.isProgressMilestone(progress);
    if (!milestone) return;

    this.logger.logExport(
      LogCategory.PERFORMANCE_MILESTONE,
      `Export progress: ${progress.phase} (${progress.percentage}%)`,
      {
        sessionId,
        phase: progress.phase,
        percentage: progress.percentage,
        itemsProcessed: progress.itemsProcessed,
        totalItems: progress.totalItems,
        currentOperation: progress.currentOperation,
        estimatedTimeRemaining: this.estimateTimeRemaining(sessionId, progress)
      }
    );
  }

  /**
   * Log export completion
   */
  logExportCompleted(sessionId: string, result: ExportResult): void {
    const metadata = this.activeExports.get(sessionId);
    if (!metadata) return;

    const completionMetadata = {
      sessionId,
      success: result.success,
      duration: result.duration,
      outputSize: result.outputSize,
      formats: result.formats,
      errors: result.errors?.length || 0,
      warnings: result.warnings?.length || 0,
      performance: {
        itemsPerSecond: metadata.selection 
          ? (metadata.selection.totalCount / result.duration) * 1000
          : undefined,
        throughputMBps: metadata.documentSize 
          ? (metadata.documentSize / result.duration / 1024 / 1024) * 1000
          : undefined
      }
    };

    this.logger.logExport(
      result.success ? LogCategory.EXPORT_COMPLETED : LogCategory.EXPORT_FAILED,
      `Export ${result.success ? 'completed' : 'failed'} for document: ${metadata.documentName}`,
      completionMetadata
    );

    // Log performance metrics
    this.logger.logPerformance(
      'export_operation',
      {
        duration: result.duration,
        memoryUsed: process.memoryUsage().heapUsed,
        processingTime: result.duration
      },
      { sessionId, formatBreakdown: this.getFormatBreakdown(result.formats) }
    );

    // Log any errors
    if (result.errors && result.errors.length > 0) {
      result.errors.forEach(error => {
        this.logger.error(`Export error: ${error}`, undefined, { sessionId });
      });
    }

    // Clean up
    this.activeExports.delete(sessionId);
  }

  /**
   * Log export failure
   */
  logExportFailed(sessionId: string, error: Error, context?: any): void {
    const metadata = this.activeExports.get(sessionId);
    if (!metadata) return;

    this.logger.error(
      `Export failed for document: ${metadata.documentName}`,
      error,
      {
        sessionId,
        exportType: metadata.exportType,
        formats: metadata.formats,
        errorCode: error.name,
        errorMessage: error.message,
        context,
        userImpact: this.assessUserImpact(error)
      }
    );

    // Log as critical if severe impact
    if (this.assessUserImpact(error) === 'severe') {
      this.logger.critical(
        `Critical export failure - data loss risk`,
        error,
        { sessionId, documentId: metadata.documentId }
      );
    }

    // Clean up
    this.activeExports.delete(sessionId);
  }

  /**
   * Log user actions
   */
  logUserAction(sessionId: string, action: ExportOperationMetadata['userAction']): void {
    if (!action) return;

    this.logger.logAudit(
      `User action: ${action.type}`,
      {
        sessionId,
        actionType: action.type,
        reason: action.reason,
        timestamp: action.timestamp
      }
    );

    // Log specific action types
    switch (action.type) {
      case 'cancel':
        this.logger.info(`Export cancelled by user`, { sessionId, reason: action.reason });
        break;
      
      case 'retry':
        this.logger.info(`Export retry requested`, { sessionId, reason: action.reason });
        break;
      
      case 'override':
        this.logger.warn(`Validation override requested`, { sessionId, reason: action.reason });
        break;
    }
  }

  /**
   * Log export configuration changes
   */
  logConfigurationChange(sessionId: string, changes: any): void {
    const metadata = this.activeExports.get(sessionId);
    if (!metadata) return;

    this.logger.logAudit(
      'Export configuration modified',
      {
        sessionId,
        changes,
        previousConfig: metadata.configuration,
        timestamp: new Date().toISOString()
      }
    );
  }

  /**
   * Log export queue status
   */
  logQueueStatus(queueStats: {
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    avgWaitTime: number;
  }): void {
    this.logger.logPerformance(
      'export_queue_status',
      {
        duration: 0,
        memoryUsed: process.memoryUsage().heapUsed,
        queueTime: queueStats.avgWaitTime
      },
      {
        queueDepth: queueStats.pending + queueStats.processing,
        ...queueStats
      }
    );
  }

  /**
   * Private helper methods
   */

  private isProgressMilestone(progress: ExportProgress): boolean {
    // Log at key percentages and phase changes
    const milestonePercentages = [0, 25, 50, 75, 90, 100];
    return milestonePercentages.includes(progress.percentage) ||
           ['validating', 'processing', 'complete'].includes(progress.phase);
  }

  private estimateTimeRemaining(sessionId: string, progress: ExportProgress): number {
    // Simple estimation based on current progress
    if (progress.percentage === 0 || progress.percentage === 100) return 0;
    
    const metadata = this.activeExports.get(sessionId);
    if (!metadata) return 0;

    const elapsedTime = Date.now() - new Date(metadata.timestamp || '').getTime();
    const estimatedTotal = elapsedTime / (progress.percentage / 100);
    return Math.max(0, estimatedTotal - elapsedTime);
  }

  private assessUserImpact(error: Error): 'none' | 'minimal' | 'moderate' | 'severe' {
    const errorMessage = error.message.toLowerCase();
    
    if (errorMessage.includes('cancelled') || errorMessage.includes('timeout')) {
      return 'minimal';
    }
    
    if (errorMessage.includes('validation') || errorMessage.includes('format')) {
      return 'moderate';
    }
    
    if (errorMessage.includes('corrupt') || errorMessage.includes('data loss')) {
      return 'severe';
    }
    
    return 'moderate';
  }

  private getFormatBreakdown(formats: Record<ExportFormat, FormatResult>): any {
    const breakdown: any = {};
    
    Object.entries(formats).forEach(([format, result]) => {
      breakdown[format] = {
        success: result.success,
        processingTimeMs: result.processingTime,
        outputSizeBytes: result.fileSize,
        itemCount: result.itemCount
      };
    });
    
    return breakdown;
  }

  /**
   * Get active export count
   */
  getActiveExportCount(): number {
    return this.activeExports.size;
  }

  /**
   * Get export metadata
   */
  getExportMetadata(sessionId: string): ExportOperationMetadata | undefined {
    return this.activeExports.get(sessionId);
  }

  /**
   * Clear completed exports
   */
  clearCompletedExports(): void {
    // In practice, this would clean up based on completion status
    this.activeExports.clear();
  }
}