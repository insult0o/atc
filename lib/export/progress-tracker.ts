/**
 * Export Progress Tracking System
 * Provides real-time progress monitoring with cancellation support
 */

import { EventEmitter } from 'events';
import {
  ExportFormat,
  ExportResult,
  ExportError,
  ExportWarning
} from './schemas';

export type ExportStatus = 'preparing' | 'processing' | 'validating' | 'writing' | 'complete' | 'error' | 'cancelled';

export interface ExportProgress {
  exportId: string;
  format: ExportFormat;
  status: ExportStatus;
  progress: {
    current: number;
    total: number;
    percentage: number;
  };
  timing: {
    startTime: string;
    estimatedCompletion: string;
    processingRate: number;
    elapsedTime: number;
  };
  details: {
    currentItem: string;
    processedItems: string[];
    errors: ExportError[];
    warnings: ExportWarning[];
  };
}

export interface ProgressUpdate {
  exportId: string;
  format: ExportFormat;
  type: 'progress' | 'status' | 'error' | 'warning' | 'complete';
  data: any;
}

export interface ExportTask {
  id: string;
  format: ExportFormat;
  totalItems: number;
  processFunction: () => Promise<ExportResult>;
  cancelled?: boolean;
}

export class ExportProgressTracker extends EventEmitter {
  private activeExports: Map<string, ExportProgress>;
  private exportTasks: Map<string, ExportTask>;
  private progressHistory: Map<string, ProgressUpdate[]>;
  private processingRates: Map<string, number[]>;
  private updateInterval: NodeJS.Timer | null = null;
  private persistenceEnabled: boolean;

  constructor(options: { persistenceEnabled?: boolean } = {}) {
    super();
    this.activeExports = new Map();
    this.exportTasks = new Map();
    this.progressHistory = new Map();
    this.processingRates = new Map();
    this.persistenceEnabled = options.persistenceEnabled || false;

    // Start update interval for time estimations
    this.startUpdateInterval();
  }

  /**
   * Track a new export operation
   */
  trackExport(task: ExportTask): void {
    const initialProgress: ExportProgress = {
      exportId: task.id,
      format: task.format,
      status: 'preparing',
      progress: {
        current: 0,
        total: task.totalItems,
        percentage: 0
      },
      timing: {
        startTime: new Date().toISOString(),
        estimatedCompletion: 'Calculating...',
        processingRate: 0,
        elapsedTime: 0
      },
      details: {
        currentItem: 'Preparing export...',
        processedItems: [],
        errors: [],
        warnings: []
      }
    };

    this.activeExports.set(task.id, initialProgress);
    this.exportTasks.set(task.id, task);
    this.progressHistory.set(task.id, []);
    this.processingRates.set(task.id, []);

    // Emit initial progress
    this.emitProgress(task.id);

    // Persist if enabled
    if (this.persistenceEnabled) {
      this.persistProgress(task.id);
    }
  }

  /**
   * Update export progress
   */
  updateProgress(
    exportId: string, 
    updates: Partial<{
      current: number;
      currentItem: string;
      status: ExportStatus;
    }>
  ): void {
    const progress = this.activeExports.get(exportId);
    if (!progress) return;

    // Update current progress
    if (updates.current !== undefined) {
      progress.progress.current = updates.current;
      progress.progress.percentage = Math.round((updates.current / progress.progress.total) * 100);
      
      // Track processing rate
      this.updateProcessingRate(exportId, updates.current);
    }

    // Update current item
    if (updates.currentItem) {
      progress.details.currentItem = updates.currentItem;
      if (updates.current !== undefined) {
        progress.details.processedItems.push(updates.currentItem);
      }
    }

    // Update status
    if (updates.status) {
      progress.status = updates.status;
    }

    // Update timing estimates
    this.updateTimingEstimates(exportId);

    // Record update
    this.recordUpdate(exportId, 'progress', updates);

    // Emit progress update
    this.emitProgress(exportId);
  }

  /**
   * Add error to export
   */
  addError(exportId: string, error: ExportError): void {
    const progress = this.activeExports.get(exportId);
    if (!progress) return;

    progress.details.errors.push(error);
    this.recordUpdate(exportId, 'error', error);
    this.emitProgress(exportId);
  }

  /**
   * Add warning to export
   */
  addWarning(exportId: string, warning: ExportWarning): void {
    const progress = this.activeExports.get(exportId);
    if (!progress) return;

    progress.details.warnings.push(warning);
    this.recordUpdate(exportId, 'warning', warning);
    this.emitProgress(exportId);
  }

  /**
   * Mark export as complete
   */
  completeExport(exportId: string, result: ExportResult): void {
    const progress = this.activeExports.get(exportId);
    if (!progress) return;

    progress.status = 'complete';
    progress.progress.current = progress.progress.total;
    progress.progress.percentage = 100;
    progress.details.currentItem = 'Export completed';

    // Add any final errors/warnings from result
    if (result.errors) {
      progress.details.errors.push(...result.errors);
    }
    if (result.warnings) {
      progress.details.warnings.push(...result.warnings);
    }

    this.recordUpdate(exportId, 'complete', result);
    this.emitProgress(exportId);

    // Clean up after delay
    setTimeout(() => this.cleanupExport(exportId), 60000); // Keep for 1 minute
  }

  /**
   * Cancel an export operation
   */
  async cancelExport(exportId: string): Promise<boolean> {
    const task = this.exportTasks.get(exportId);
    const progress = this.activeExports.get(exportId);
    
    if (!task || !progress) return false;

    // Mark as cancelled
    task.cancelled = true;
    progress.status = 'cancelled';
    progress.details.currentItem = 'Export cancelled by user';

    this.recordUpdate(exportId, 'status', 'cancelled');
    this.emitProgress(exportId);

    // Clean up
    this.cleanupExport(exportId);
    
    return true;
  }

  /**
   * Get current progress for an export
   */
  getProgress(exportId: string): ExportProgress | undefined {
    return this.activeExports.get(exportId);
  }

  /**
   * Get all active exports
   */
  getActiveExports(): ExportProgress[] {
    return Array.from(this.activeExports.values());
  }

  /**
   * Get progress history for an export
   */
  getProgressHistory(exportId: string): ProgressUpdate[] {
    return this.progressHistory.get(exportId) || [];
  }

  /**
   * Check if export is cancelled
   */
  isCancelled(exportId: string): boolean {
    const task = this.exportTasks.get(exportId);
    return task?.cancelled || false;
  }

  /**
   * Update processing rate tracking
   */
  private updateProcessingRate(exportId: string, current: number): void {
    const progress = this.activeExports.get(exportId);
    const rates = this.processingRates.get(exportId);
    
    if (!progress || !rates) return;

    const elapsedSeconds = this.getElapsedSeconds(progress.timing.startTime);
    if (elapsedSeconds > 0) {
      const rate = current / elapsedSeconds;
      rates.push(rate);
      
      // Keep only last 10 rates for moving average
      if (rates.length > 10) {
        rates.shift();
      }
      
      // Calculate average rate
      progress.timing.processingRate = rates.reduce((a, b) => a + b, 0) / rates.length;
    }
  }

  /**
   * Update timing estimates
   */
  private updateTimingEstimates(exportId: string): void {
    const progress = this.activeExports.get(exportId);
    if (!progress) return;

    // Update elapsed time
    progress.timing.elapsedTime = this.getElapsedSeconds(progress.timing.startTime);

    // Calculate estimated completion
    if (progress.timing.processingRate > 0 && progress.progress.current < progress.progress.total) {
      const remaining = progress.progress.total - progress.progress.current;
      const estimatedSeconds = remaining / progress.timing.processingRate;
      
      const completionTime = new Date();
      completionTime.setSeconds(completionTime.getSeconds() + estimatedSeconds);
      
      progress.timing.estimatedCompletion = this.formatEstimatedTime(estimatedSeconds);
    } else if (progress.progress.current >= progress.progress.total) {
      progress.timing.estimatedCompletion = 'Complete';
    }
  }

  /**
   * Format estimated time remaining
   */
  private formatEstimatedTime(seconds: number): string {
    if (seconds < 60) {
      return `${Math.round(seconds)}s`;
    } else if (seconds < 3600) {
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = Math.round(seconds % 60);
      return `${minutes}m ${remainingSeconds}s`;
    } else {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      return `${hours}h ${minutes}m`;
    }
  }

  /**
   * Get elapsed seconds since start time
   */
  private getElapsedSeconds(startTime: string): number {
    const start = new Date(startTime);
    const now = new Date();
    return (now.getTime() - start.getTime()) / 1000;
  }

  /**
   * Emit progress update
   */
  private emitProgress(exportId: string): void {
    const progress = this.activeExports.get(exportId);
    if (!progress) return;

    this.emit('progress', {
      exportId,
      progress: { ...progress }
    });

    // Emit specific events
    if (progress.status === 'complete') {
      this.emit('complete', { exportId, progress });
    } else if (progress.status === 'error') {
      this.emit('error', { exportId, progress });
    } else if (progress.status === 'cancelled') {
      this.emit('cancelled', { exportId, progress });
    }
  }

  /**
   * Record update in history
   */
  private recordUpdate(exportId: string, type: ProgressUpdate['type'], data: any): void {
    const history = this.progressHistory.get(exportId);
    if (!history) return;

    const update: ProgressUpdate = {
      exportId,
      format: this.activeExports.get(exportId)?.format || 'rag',
      type,
      data
    };

    history.push(update);

    // Limit history size
    if (history.length > 100) {
      history.shift();
    }
  }

  /**
   * Persist progress to storage
   */
  private async persistProgress(exportId: string): Promise<void> {
    if (!this.persistenceEnabled) return;

    try {
      const progress = this.activeExports.get(exportId);
      if (!progress) return;

      // In production, this would save to database or file
      // For now, we'll use localStorage if available
      if (typeof window !== 'undefined' && window.localStorage) {
        const key = `export-progress-${exportId}`;
        window.localStorage.setItem(key, JSON.stringify(progress));
      }
    } catch (error) {
      console.error('Failed to persist progress:', error);
    }
  }

  /**
   * Restore progress from storage
   */
  async restoreProgress(exportId: string): Promise<ExportProgress | null> {
    if (!this.persistenceEnabled) return null;

    try {
      // In production, this would load from database
      if (typeof window !== 'undefined' && window.localStorage) {
        const key = `export-progress-${exportId}`;
        const stored = window.localStorage.getItem(key);
        if (stored) {
          return JSON.parse(stored);
        }
      }
    } catch (error) {
      console.error('Failed to restore progress:', error);
    }

    return null;
  }

  /**
   * Clean up completed export
   */
  private cleanupExport(exportId: string): void {
    this.activeExports.delete(exportId);
    this.exportTasks.delete(exportId);
    this.processingRates.delete(exportId);
    
    // Keep history for a while
    setTimeout(() => {
      this.progressHistory.delete(exportId);
    }, 300000); // 5 minutes

    // Clean up persisted data
    if (this.persistenceEnabled && typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(`export-progress-${exportId}`);
    }
  }

  /**
   * Start update interval for timing
   */
  private startUpdateInterval(): void {
    this.updateInterval = setInterval(() => {
      // Update timing for all active exports
      this.activeExports.forEach((progress, exportId) => {
        if (progress.status === 'processing') {
          this.updateTimingEstimates(exportId);
          this.emitProgress(exportId);
        }
      });
    }, 1000); // Update every second
  }

  /**
   * Stop update interval
   */
  destroy(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    
    this.removeAllListeners();
    this.activeExports.clear();
    this.exportTasks.clear();
    this.progressHistory.clear();
    this.processingRates.clear();
  }
}

/**
 * Create a progress-aware export wrapper
 */
export function createProgressAwareExport<T>(
  tracker: ExportProgressTracker,
  exportId: string,
  format: ExportFormat,
  items: T[],
  processItem: (item: T, index: number) => Promise<any>
): () => Promise<ExportResult> {
  return async () => {
    const results: any[] = [];
    const errors: ExportError[] = [];
    const warnings: ExportWarning[] = [];

    tracker.updateProgress(exportId, { status: 'processing' });

    for (let i = 0; i < items.length; i++) {
      // Check for cancellation
      if (tracker.isCancelled(exportId)) {
        throw new Error('Export cancelled');
      }

      try {
        tracker.updateProgress(exportId, {
          current: i,
          currentItem: `Processing item ${i + 1} of ${items.length}`
        });

        const result = await processItem(items[i], i);
        results.push(result);
      } catch (error) {
        const exportError: ExportError = {
          code: 'ITEM_PROCESSING_ERROR',
          message: `Failed to process item ${i}`,
          item: `item-${i}`,
          details: error
        };
        errors.push(exportError);
        tracker.addError(exportId, exportError);
      }
    }

    tracker.updateProgress(exportId, { status: 'validating' });

    // Validation phase
    tracker.updateProgress(exportId, { 
      status: 'writing',
      currentItem: 'Writing export files...'
    });

    const exportResult: ExportResult = {
      exportId,
      format,
      status: errors.length === 0 ? 'success' : 'partial',
      itemCount: results.length,
      errors,
      warnings,
      metadata: {
        processedItems: results.length,
        totalItems: items.length
      }
    };

    tracker.completeExport(exportId, exportResult);
    return exportResult;
  };
}