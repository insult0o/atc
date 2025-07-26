/**
 * Export History Manager
 * Enhanced history tracking for partial exports
 */

import { ExportFormat } from './schemas/types';
import { ExportSelection } from '@/app/components/export/SelectionPanel';

export interface ExportHistoryRecord {
  id: string;
  documentId: string;
  documentName: string;
  exportType: 'full' | 'partial';
  selection?: ExportSelection;
  formats: ExportFormat[];
  status: 'complete' | 'partial' | 'failed' | 'cancelled';
  metrics: ExportMetrics;
  user?: string;
  timestamp: Date;
  outputs: ExportOutput[];
  tags?: string[];
  notes?: string;
}

export interface ExportMetrics {
  itemsRequested: number;
  itemsExported: number;
  itemsFailed: number;
  itemsSkipped: number;
  processingTime: number;
  outputSize: number;
  validationScore?: number;
  errorCount: number;
  warningCount: number;
}

export interface ExportOutput {
  format: ExportFormat;
  fileId?: string;
  fileName?: string;
  fileSize: number;
  downloadUrl?: string;
  expiresAt?: Date;
  checksum?: string;
}

export interface HistoryFilter {
  documentId?: string;
  exportType?: 'full' | 'partial';
  formats?: ExportFormat[];
  status?: ExportHistoryRecord['status'][];
  dateFrom?: Date;
  dateTo?: Date;
  user?: string;
  tags?: string[];
  searchQuery?: string;
}

export interface HistoryComparison {
  recordA: ExportHistoryRecord;
  recordB: ExportHistoryRecord;
  differences: ComparisonDifference[];
  similarity: number;
}

export interface ComparisonDifference {
  field: string;
  valueA: any;
  valueB: any;
  type: 'added' | 'removed' | 'modified';
  impact: 'high' | 'medium' | 'low';
}

export class ExportHistoryManager {
  private history: Map<string, ExportHistoryRecord>;
  private documentIndex: Map<string, Set<string>>;
  private userIndex: Map<string, Set<string>>;
  private tagIndex: Map<string, Set<string>>;
  private readonly maxHistorySize = 10000;
  private readonly storageKey = 'export_history';

  constructor() {
    this.history = new Map();
    this.documentIndex = new Map();
    this.userIndex = new Map();
    this.tagIndex = new Map();
    this.loadFromStorage();
  }

  /**
   * Add export record to history
   */
  addRecord(record: Omit<ExportHistoryRecord, 'id' | 'timestamp'>): string {
    const id = this.generateRecordId();
    const timestamp = new Date();
    
    const fullRecord: ExportHistoryRecord = {
      ...record,
      id,
      timestamp
    };

    // Add to main storage
    this.history.set(id, fullRecord);

    // Update indices
    this.updateIndices(fullRecord);

    // Enforce size limit
    this.enforceMaxSize();

    // Persist to storage
    this.saveToStorage();

    return id;
  }

  /**
   * Update existing record
   */
  updateRecord(id: string, updates: Partial<ExportHistoryRecord>): boolean {
    const record = this.history.get(id);
    if (!record) return false;

    const updatedRecord = {
      ...record,
      ...updates,
      id: record.id, // Preserve ID
      timestamp: record.timestamp // Preserve original timestamp
    };

    this.history.set(id, updatedRecord);
    this.rebuildIndices();
    this.saveToStorage();

    return true;
  }

  /**
   * Get record by ID
   */
  getRecord(id: string): ExportHistoryRecord | undefined {
    return this.history.get(id);
  }

  /**
   * Get filtered history
   */
  getHistory(filter?: HistoryFilter): ExportHistoryRecord[] {
    let records = Array.from(this.history.values());

    if (filter) {
      records = this.applyFilter(records, filter);
    }

    // Sort by timestamp descending
    records.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    return records;
  }

  /**
   * Get history for specific document
   */
  getDocumentHistory(documentId: string): ExportHistoryRecord[] {
    const recordIds = this.documentIndex.get(documentId) || new Set();
    return Array.from(recordIds)
      .map(id => this.history.get(id))
      .filter((record): record is ExportHistoryRecord => record !== undefined)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Compare two export records
   */
  compareRecords(recordIdA: string, recordIdB: string): HistoryComparison | null {
    const recordA = this.history.get(recordIdA);
    const recordB = this.history.get(recordIdB);

    if (!recordA || !recordB) return null;

    const differences: ComparisonDifference[] = [];

    // Compare export type
    if (recordA.exportType !== recordB.exportType) {
      differences.push({
        field: 'exportType',
        valueA: recordA.exportType,
        valueB: recordB.exportType,
        type: 'modified',
        impact: 'high'
      });
    }

    // Compare selection (for partial exports)
    if (recordA.selection || recordB.selection) {
      const selectionDiff = this.compareSelections(recordA.selection, recordB.selection);
      differences.push(...selectionDiff);
    }

    // Compare formats
    const formatsA = new Set(recordA.formats);
    const formatsB = new Set(recordB.formats);
    
    recordA.formats.forEach(format => {
      if (!formatsB.has(format)) {
        differences.push({
          field: 'formats',
          valueA: format,
          valueB: null,
          type: 'removed',
          impact: 'medium'
        });
      }
    });

    recordB.formats.forEach(format => {
      if (!formatsA.has(format)) {
        differences.push({
          field: 'formats',
          valueA: null,
          valueB: format,
          type: 'added',
          impact: 'medium'
        });
      }
    });

    // Compare metrics
    const metricsDiff = this.compareMetrics(recordA.metrics, recordB.metrics);
    differences.push(...metricsDiff);

    // Calculate similarity score
    const similarity = this.calculateSimilarity(recordA, recordB, differences);

    return {
      recordA,
      recordB,
      differences,
      similarity
    };
  }

  /**
   * Search history
   */
  searchHistory(query: string): ExportHistoryRecord[] {
    const normalizedQuery = query.toLowerCase();
    
    return Array.from(this.history.values()).filter(record => {
      // Search in document name
      if (record.documentName.toLowerCase().includes(normalizedQuery)) {
        return true;
      }

      // Search in tags
      if (record.tags?.some(tag => tag.toLowerCase().includes(normalizedQuery))) {
        return true;
      }

      // Search in notes
      if (record.notes?.toLowerCase().includes(normalizedQuery)) {
        return true;
      }

      // Search in user
      if (record.user?.toLowerCase().includes(normalizedQuery)) {
        return true;
      }

      return false;
    });
  }

  /**
   * Get export statistics
   */
  getStatistics(filter?: HistoryFilter): {
    totalExports: number;
    fullExports: number;
    partialExports: number;
    successRate: number;
    averageProcessingTime: number;
    totalOutputSize: number;
    formatDistribution: Map<ExportFormat, number>;
    statusDistribution: Map<string, number>;
    exportsByDay: Map<string, number>;
  } {
    const records = filter ? this.applyFilter(Array.from(this.history.values()), filter) : Array.from(this.history.values());

    const stats = {
      totalExports: records.length,
      fullExports: 0,
      partialExports: 0,
      successRate: 0,
      averageProcessingTime: 0,
      totalOutputSize: 0,
      formatDistribution: new Map<ExportFormat, number>(),
      statusDistribution: new Map<string, number>(),
      exportsByDay: new Map<string, number>()
    };

    let totalProcessingTime = 0;
    let successCount = 0;

    records.forEach(record => {
      // Export type
      if (record.exportType === 'full') {
        stats.fullExports++;
      } else {
        stats.partialExports++;
      }

      // Success rate
      if (record.status === 'complete') {
        successCount++;
      }

      // Processing time
      totalProcessingTime += record.metrics.processingTime;

      // Output size
      stats.totalOutputSize += record.metrics.outputSize;

      // Format distribution
      record.formats.forEach(format => {
        stats.formatDistribution.set(
          format,
          (stats.formatDistribution.get(format) || 0) + 1
        );
      });

      // Status distribution
      stats.statusDistribution.set(
        record.status,
        (stats.statusDistribution.get(record.status) || 0) + 1
      );

      // Exports by day
      const day = record.timestamp.toISOString().split('T')[0];
      stats.exportsByDay.set(
        day,
        (stats.exportsByDay.get(day) || 0) + 1
      );
    });

    stats.successRate = records.length > 0 ? (successCount / records.length) * 100 : 0;
    stats.averageProcessingTime = records.length > 0 ? totalProcessingTime / records.length : 0;

    return stats;
  }

  /**
   * Delete old records
   */
  deleteOldRecords(daysToKeep: number): number {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const toDelete: string[] = [];

    this.history.forEach((record, id) => {
      if (record.timestamp < cutoffDate) {
        toDelete.push(id);
      }
    });

    toDelete.forEach(id => {
      this.history.delete(id);
    });

    if (toDelete.length > 0) {
      this.rebuildIndices();
      this.saveToStorage();
    }

    return toDelete.length;
  }

  /**
   * Export history data
   */
  exportData(): string {
    const data = {
      version: 1,
      exportDate: new Date().toISOString(),
      records: Array.from(this.history.values())
    };

    return JSON.stringify(data, null, 2);
  }

  /**
   * Import history data
   */
  importData(jsonData: string): { imported: number; errors: number } {
    let imported = 0;
    let errors = 0;

    try {
      const data = JSON.parse(jsonData);
      
      if (data.version !== 1) {
        throw new Error('Unsupported data version');
      }

      data.records.forEach((record: any) => {
        try {
          // Convert dates
          record.timestamp = new Date(record.timestamp);
          record.outputs.forEach((output: any) => {
            if (output.expiresAt) {
              output.expiresAt = new Date(output.expiresAt);
            }
          });

          this.history.set(record.id, record);
          imported++;
        } catch (e) {
          errors++;
        }
      });

      this.rebuildIndices();
      this.saveToStorage();
    } catch (e) {
      console.error('Import failed:', e);
      errors++;
    }

    return { imported, errors };
  }

  /**
   * Private methods
   */

  private generateRecordId(): string {
    return `export_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private updateIndices(record: ExportHistoryRecord): void {
    // Document index
    if (!this.documentIndex.has(record.documentId)) {
      this.documentIndex.set(record.documentId, new Set());
    }
    this.documentIndex.get(record.documentId)!.add(record.id);

    // User index
    if (record.user) {
      if (!this.userIndex.has(record.user)) {
        this.userIndex.set(record.user, new Set());
      }
      this.userIndex.get(record.user)!.add(record.id);
    }

    // Tag index
    record.tags?.forEach(tag => {
      if (!this.tagIndex.has(tag)) {
        this.tagIndex.set(tag, new Set());
      }
      this.tagIndex.get(tag)!.add(record.id);
    });
  }

  private rebuildIndices(): void {
    this.documentIndex.clear();
    this.userIndex.clear();
    this.tagIndex.clear();

    this.history.forEach(record => {
      this.updateIndices(record);
    });
  }

  private applyFilter(records: ExportHistoryRecord[], filter: HistoryFilter): ExportHistoryRecord[] {
    return records.filter(record => {
      if (filter.documentId && record.documentId !== filter.documentId) {
        return false;
      }

      if (filter.exportType && record.exportType !== filter.exportType) {
        return false;
      }

      if (filter.formats && filter.formats.length > 0) {
        const hasFormat = filter.formats.some(format => record.formats.includes(format));
        if (!hasFormat) return false;
      }

      if (filter.status && filter.status.length > 0) {
        if (!filter.status.includes(record.status)) return false;
      }

      if (filter.dateFrom && record.timestamp < filter.dateFrom) {
        return false;
      }

      if (filter.dateTo && record.timestamp > filter.dateTo) {
        return false;
      }

      if (filter.user && record.user !== filter.user) {
        return false;
      }

      if (filter.tags && filter.tags.length > 0) {
        const hasTags = filter.tags.every(tag => record.tags?.includes(tag));
        if (!hasTags) return false;
      }

      if (filter.searchQuery) {
        return this.matchesSearchQuery(record, filter.searchQuery);
      }

      return true;
    });
  }

  private matchesSearchQuery(record: ExportHistoryRecord, query: string): boolean {
    const normalizedQuery = query.toLowerCase();
    return (
      record.documentName.toLowerCase().includes(normalizedQuery) ||
      record.tags?.some(tag => tag.toLowerCase().includes(normalizedQuery)) ||
      record.notes?.toLowerCase().includes(normalizedQuery) ||
      record.user?.toLowerCase().includes(normalizedQuery)
    );
  }

  private compareSelections(
    selectionA?: ExportSelection,
    selectionB?: ExportSelection
  ): ComparisonDifference[] {
    const differences: ComparisonDifference[] = [];

    if (!selectionA && !selectionB) return differences;

    if (!selectionA || !selectionB) {
      differences.push({
        field: 'selection',
        valueA: selectionA,
        valueB: selectionB,
        type: selectionA ? 'removed' : 'added',
        impact: 'high'
      });
      return differences;
    }

    if (selectionA.type !== selectionB.type) {
      differences.push({
        field: 'selection.type',
        valueA: selectionA.type,
        valueB: selectionB.type,
        type: 'modified',
        impact: 'high'
      });
    }

    const itemDiff = Math.abs(selectionA.totalCount - selectionB.totalCount);
    if (itemDiff > 0) {
      differences.push({
        field: 'selection.totalCount',
        valueA: selectionA.totalCount,
        valueB: selectionB.totalCount,
        type: 'modified',
        impact: itemDiff > 10 ? 'high' : 'medium'
      });
    }

    return differences;
  }

  private compareMetrics(
    metricsA: ExportMetrics,
    metricsB: ExportMetrics
  ): ComparisonDifference[] {
    const differences: ComparisonDifference[] = [];

    const fields: Array<keyof ExportMetrics> = [
      'itemsExported', 'itemsFailed', 'errorCount', 'warningCount'
    ];

    fields.forEach(field => {
      if (metricsA[field] !== metricsB[field]) {
        differences.push({
          field: `metrics.${field}`,
          valueA: metricsA[field],
          valueB: metricsB[field],
          type: 'modified',
          impact: field.includes('Failed') || field.includes('error') ? 'high' : 'low'
        });
      }
    });

    return differences;
  }

  private calculateSimilarity(
    recordA: ExportHistoryRecord,
    recordB: ExportHistoryRecord,
    differences: ComparisonDifference[]
  ): number {
    let score = 100;

    differences.forEach(diff => {
      switch (diff.impact) {
        case 'high':
          score -= 20;
          break;
        case 'medium':
          score -= 10;
          break;
        case 'low':
          score -= 5;
          break;
      }
    });

    // Additional factors
    if (recordA.documentId !== recordB.documentId) {
      score -= 50;
    }

    const timeDiff = Math.abs(recordA.timestamp.getTime() - recordB.timestamp.getTime());
    const daysDiff = timeDiff / (1000 * 60 * 60 * 24);
    if (daysDiff > 30) {
      score -= 10;
    }

    return Math.max(0, score);
  }

  private enforceMaxSize(): void {
    if (this.history.size <= this.maxHistorySize) return;

    // Remove oldest records
    const sorted = Array.from(this.history.entries())
      .sort((a, b) => a[1].timestamp.getTime() - b[1].timestamp.getTime());

    const toRemove = sorted.slice(0, this.history.size - this.maxHistorySize);
    toRemove.forEach(([id]) => {
      this.history.delete(id);
    });

    this.rebuildIndices();
  }

  private saveToStorage(): void {
    try {
      const data = {
        records: Array.from(this.history.entries())
      };
      localStorage.setItem(this.storageKey, JSON.stringify(data));
    } catch (e) {
      console.error('Failed to save history:', e);
    }
  }

  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (!stored) return;

      const data = JSON.parse(stored);
      data.records.forEach(([id, record]: [string, any]) => {
        // Convert dates
        record.timestamp = new Date(record.timestamp);
        record.outputs.forEach((output: any) => {
          if (output.expiresAt) {
            output.expiresAt = new Date(output.expiresAt);
          }
        });

        this.history.set(id, record);
      });

      this.rebuildIndices();
    } catch (e) {
      console.error('Failed to load history:', e);
    }
  }

  /**
   * Clear all history
   */
  clearHistory(): void {
    this.history.clear();
    this.documentIndex.clear();
    this.userIndex.clear();
    this.tagIndex.clear();
    localStorage.removeItem(this.storageKey);
  }
}