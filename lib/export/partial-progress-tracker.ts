/**
 * Partial Export Progress Tracker
 * Enhanced progress tracking for partial exports with granular item tracking
 */

import { ExportFormat } from './schemas/types';
import { ExportSelection } from '@/app/components/export/SelectionPanel';

export interface PartialExportProgress {
  exportId: string;
  selection: ExportSelection;
  overall: ProgressMetrics;
  perItem: Map<string, ItemProgress>;
  batches: BatchProgress[];
  estimatedCompletion: Date | null;
  lastUpdate: Date;
}

export interface ProgressMetrics {
  totalItems: number;
  processedItems: number;
  successfulItems: number;
  failedItems: number;
  skippedItems: number;
  bytesProcessed: number;
  totalBytes: number;
  elapsedTime: number;
  remainingTime: number;
  itemsPerSecond: number;
}

export interface ItemProgress {
  itemId: string;
  itemType: 'zone' | 'page';
  status: 'pending' | 'processing' | 'complete' | 'failed' | 'skipped';
  format: ExportFormat;
  startTime?: Date;
  endTime?: Date;
  processingTime?: number;
  bytesProcessed?: number;
  error?: ExportItemError;
  retryCount: number;
  metadata?: Record<string, any>;
}

export interface BatchProgress {
  batchId: string;
  items: string[];
  format: ExportFormat;
  status: 'queued' | 'processing' | 'complete' | 'failed';
  startTime?: Date;
  endTime?: Date;
  successCount: number;
  failureCount: number;
  averageProcessingTime: number;
  throughput: number;
}

export interface ExportItemError {
  code: string;
  message: string;
  recoverable: boolean;
  details?: any;
}

export class PartialProgressTracker {
  private progressMap: Map<string, PartialExportProgress>;
  private updateCallbacks: Map<string, (progress: PartialExportProgress) => void>;
  private metricsHistory: Map<string, ProgressMetrics[]>;
  private readonly maxHistorySize = 100;
  private updateInterval: NodeJS.Timer | null = null;

  constructor() {
    this.progressMap = new Map();
    this.updateCallbacks = new Map();
    this.metricsHistory = new Map();
    this.startUpdateInterval();
  }

  /**
   * Initialize tracking for a partial export
   */
  initializeTracking(
    exportId: string,
    selection: ExportSelection,
    totalItems: number,
    estimatedBytes: number = 0
  ): void {
    const progress: PartialExportProgress = {
      exportId,
      selection,
      overall: {
        totalItems,
        processedItems: 0,
        successfulItems: 0,
        failedItems: 0,
        skippedItems: 0,
        bytesProcessed: 0,
        totalBytes: estimatedBytes,
        elapsedTime: 0,
        remainingTime: 0,
        itemsPerSecond: 0
      },
      perItem: new Map(),
      batches: [],
      estimatedCompletion: null,
      lastUpdate: new Date()
    };

    this.progressMap.set(exportId, progress);
    this.metricsHistory.set(exportId, []);
  }

  /**
   * Update item progress
   */
  updateItemProgress(
    exportId: string,
    itemId: string,
    update: Partial<ItemProgress>
  ): void {
    const progress = this.progressMap.get(exportId);
    if (!progress) return;

    const existingItem = progress.perItem.get(itemId) || {
      itemId,
      itemType: 'zone',
      status: 'pending',
      format: update.format || 'rag',
      retryCount: 0
    };

    const updatedItem: ItemProgress = {
      ...existingItem,
      ...update
    };

    // Update timestamps
    if (update.status === 'processing' && !updatedItem.startTime) {
      updatedItem.startTime = new Date();
    } else if (['complete', 'failed', 'skipped'].includes(update.status || '')) {
      updatedItem.endTime = new Date();
      if (updatedItem.startTime) {
        updatedItem.processingTime = updatedItem.endTime.getTime() - updatedItem.startTime.getTime();
      }
    }

    progress.perItem.set(itemId, updatedItem);
    
    // Update overall metrics
    this.updateOverallMetrics(progress);
    
    // Trigger callback
    this.notifyUpdate(exportId, progress);
  }

  /**
   * Update batch progress
   */
  updateBatchProgress(
    exportId: string,
    batchId: string,
    update: Partial<BatchProgress>
  ): void {
    const progress = this.progressMap.get(exportId);
    if (!progress) return;

    const batchIndex = progress.batches.findIndex(b => b.batchId === batchId);
    
    if (batchIndex === -1) {
      // New batch
      const newBatch: BatchProgress = {
        batchId,
        items: update.items || [],
        format: update.format || 'rag',
        status: update.status || 'queued',
        successCount: 0,
        failureCount: 0,
        averageProcessingTime: 0,
        throughput: 0,
        ...update
      };

      if (update.status === 'processing' && !newBatch.startTime) {
        newBatch.startTime = new Date();
      }

      progress.batches.push(newBatch);
    } else {
      // Update existing batch
      const existingBatch = progress.batches[batchIndex];
      const updatedBatch = { ...existingBatch, ...update };

      if (update.status === 'processing' && !updatedBatch.startTime) {
        updatedBatch.startTime = new Date();
      } else if (['complete', 'failed'].includes(update.status || '')) {
        updatedBatch.endTime = new Date();
        if (updatedBatch.startTime) {
          const duration = updatedBatch.endTime.getTime() - updatedBatch.startTime.getTime();
          const itemCount = updatedBatch.successCount + updatedBatch.failureCount;
          updatedBatch.averageProcessingTime = itemCount > 0 ? duration / itemCount : 0;
          updatedBatch.throughput = duration > 0 ? (itemCount / duration) * 1000 : 0;
        }
      }

      progress.batches[batchIndex] = updatedBatch;
    }

    this.notifyUpdate(exportId, progress);
  }

  /**
   * Get current progress
   */
  getProgress(exportId: string): PartialExportProgress | undefined {
    return this.progressMap.get(exportId);
  }

  /**
   * Get all active exports
   */
  getActiveExports(): PartialExportProgress[] {
    return Array.from(this.progressMap.values()).filter(
      p => !['complete', 'failed', 'cancelled'].includes(
        this.getOverallStatus(p)
      )
    );
  }

  /**
   * Register progress callback
   */
  onProgressUpdate(
    exportId: string,
    callback: (progress: PartialExportProgress) => void
  ): void {
    this.updateCallbacks.set(exportId, callback);
  }

  /**
   * Remove progress callback
   */
  removeCallback(exportId: string): void {
    this.updateCallbacks.delete(exportId);
  }

  /**
   * Mark export as complete
   */
  markComplete(exportId: string): void {
    const progress = this.progressMap.get(exportId);
    if (!progress) return;

    // Mark any pending items as skipped
    progress.perItem.forEach((item, itemId) => {
      if (item.status === 'pending' || item.status === 'processing') {
        this.updateItemProgress(exportId, itemId, { status: 'skipped' });
      }
    });

    // Update final metrics
    this.updateOverallMetrics(progress);
    progress.estimatedCompletion = new Date();
    
    this.notifyUpdate(exportId, progress);
    
    // Clean up after delay
    setTimeout(() => {
      this.progressMap.delete(exportId);
      this.updateCallbacks.delete(exportId);
      this.metricsHistory.delete(exportId);
    }, 300000); // 5 minutes
  }

  /**
   * Handle export failure
   */
  markFailed(exportId: string, error: ExportItemError): void {
    const progress = this.progressMap.get(exportId);
    if (!progress) return;

    // Mark all processing items as failed
    progress.perItem.forEach((item, itemId) => {
      if (item.status === 'processing') {
        this.updateItemProgress(exportId, itemId, { 
          status: 'failed',
          error 
        });
      }
    });

    this.notifyUpdate(exportId, progress);
  }

  /**
   * Cancel export
   */
  cancelExport(exportId: string): void {
    const progress = this.progressMap.get(exportId);
    if (!progress) return;

    // Mark processing items as skipped
    progress.perItem.forEach((item, itemId) => {
      if (['pending', 'processing'].includes(item.status)) {
        this.updateItemProgress(exportId, itemId, { status: 'skipped' });
      }
    });

    this.markComplete(exportId);
  }

  /**
   * Get progress statistics
   */
  getStatistics(exportId: string): {
    completionPercentage: number;
    successRate: number;
    failureRate: number;
    averageItemTime: number;
    estimatedTimeRemaining: number;
    throughput: number;
  } | undefined {
    const progress = this.progressMap.get(exportId);
    if (!progress) return undefined;

    const { overall } = progress;
    const completionPercentage = overall.totalItems > 0
      ? (overall.processedItems / overall.totalItems) * 100
      : 0;

    const successRate = overall.processedItems > 0
      ? (overall.successfulItems / overall.processedItems) * 100
      : 0;

    const failureRate = overall.processedItems > 0
      ? (overall.failedItems / overall.processedItems) * 100
      : 0;

    // Calculate average processing time
    let totalProcessingTime = 0;
    let processedCount = 0;
    progress.perItem.forEach(item => {
      if (item.processingTime) {
        totalProcessingTime += item.processingTime;
        processedCount++;
      }
    });

    const averageItemTime = processedCount > 0
      ? totalProcessingTime / processedCount
      : 0;

    const remainingItems = overall.totalItems - overall.processedItems;
    const estimatedTimeRemaining = averageItemTime * remainingItems;

    const throughput = overall.elapsedTime > 0
      ? (overall.processedItems / overall.elapsedTime) * 1000
      : 0;

    return {
      completionPercentage,
      successRate,
      failureRate,
      averageItemTime,
      estimatedTimeRemaining,
      throughput
    };
  }

  /**
   * Private methods
   */

  private updateOverallMetrics(progress: PartialExportProgress): void {
    const metrics = progress.overall;
    
    // Count items by status
    let processed = 0;
    let successful = 0;
    let failed = 0;
    let skipped = 0;
    let bytesProcessed = 0;

    progress.perItem.forEach(item => {
      if (['complete', 'failed', 'skipped'].includes(item.status)) {
        processed++;
      }
      if (item.status === 'complete') {
        successful++;
      } else if (item.status === 'failed') {
        failed++;
      } else if (item.status === 'skipped') {
        skipped++;
      }
      if (item.bytesProcessed) {
        bytesProcessed += item.bytesProcessed;
      }
    });

    metrics.processedItems = processed;
    metrics.successfulItems = successful;
    metrics.failedItems = failed;
    metrics.skippedItems = skipped;
    metrics.bytesProcessed = bytesProcessed;

    // Calculate elapsed time
    const firstStartTime = Array.from(progress.perItem.values())
      .filter(item => item.startTime)
      .map(item => item.startTime!.getTime())
      .sort()[0];

    if (firstStartTime) {
      metrics.elapsedTime = Date.now() - firstStartTime;
      metrics.itemsPerSecond = metrics.elapsedTime > 0
        ? (processed / metrics.elapsedTime) * 1000
        : 0;

      // Estimate remaining time
      if (metrics.itemsPerSecond > 0) {
        const remainingItems = metrics.totalItems - processed;
        metrics.remainingTime = (remainingItems / metrics.itemsPerSecond) * 1000;
        progress.estimatedCompletion = new Date(Date.now() + metrics.remainingTime);
      }
    }

    // Store metrics history
    const history = this.metricsHistory.get(progress.exportId) || [];
    history.push({ ...metrics });
    if (history.length > this.maxHistorySize) {
      history.shift();
    }
    this.metricsHistory.set(progress.exportId, history);

    progress.lastUpdate = new Date();
  }

  private getOverallStatus(progress: PartialExportProgress): string {
    const { overall } = progress;
    
    if (overall.processedItems === 0) {
      return 'pending';
    } else if (overall.processedItems < overall.totalItems) {
      return 'processing';
    } else if (overall.failedItems === 0) {
      return 'complete';
    } else if (overall.successfulItems === 0) {
      return 'failed';
    } else {
      return 'partial';
    }
  }

  private notifyUpdate(exportId: string, progress: PartialExportProgress): void {
    const callback = this.updateCallbacks.get(exportId);
    if (callback) {
      callback(progress);
    }
  }

  private startUpdateInterval(): void {
    // Periodic updates for active exports
    this.updateInterval = setInterval(() => {
      this.getActiveExports().forEach(progress => {
        this.updateOverallMetrics(progress);
        this.notifyUpdate(progress.exportId, progress);
      });
    }, 1000); // Update every second
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
    this.progressMap.clear();
    this.updateCallbacks.clear();
    this.metricsHistory.clear();
  }
}