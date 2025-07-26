/**
 * Partial Export Tracking
 * Logs selection details and partial export operations
 */

import { Logger, LogCategory } from './logger';
import { ExportSelection } from '@/app/components/export/SelectionPanel';
import { ExportFormat } from '../schemas/types';

export interface PartialExportLog {
  sessionId: string;
  exportSessionId: string;
  selection: SelectionDetails;
  rationale?: string;
  dependencies: DependencyLog[];
  validation: PartialValidationLog;
  outcome: PartialExportOutcome;
}

export interface SelectionDetails {
  type: 'zones' | 'pages' | 'custom';
  totalAvailable: number;
  totalSelected: number;
  coverage: number; // percentage
  zoneBreakdown?: {
    text: number;
    table: number;
    image: number;
    diagram: number;
    other: number;
  };
  pageRange?: {
    start: number;
    end: number;
    selected: number[];
  };
  selectionMethod: 'manual' | 'auto' | 'filter' | 'search';
  filters?: SelectionFilter[];
}

export interface SelectionFilter {
  type: 'confidence' | 'type' | 'page' | 'content' | 'status';
  operator: 'equals' | 'contains' | 'greater' | 'less' | 'between';
  value: any;
}

export interface DependencyLog {
  itemId: string;
  itemType: string;
  dependencies: string[];
  resolved: string[];
  missing: string[];
  strategy: 'include' | 'placeholder' | 'omit';
}

export interface PartialValidationLog {
  rulesApplied: number;
  rulesPassed: number;
  warnings: string[];
  overrides: string[];
  completenessScore: number;
  integrityScore: number;
}

export interface PartialExportOutcome {
  success: boolean;
  itemsExported: number;
  itemsOmitted: number;
  placeholdersAdded: number;
  contextIncluded: number;
  outputSize: number;
  compressionRatio?: number;
}

export class PartialExportLogger {
  private logger: Logger;
  private activeSelections: Map<string, PartialExportLog>;

  constructor(logger?: Logger) {
    this.logger = logger || new Logger();
    this.activeSelections = new Map();
  }

  /**
   * Log selection creation
   */
  logSelectionCreated(
    sessionId: string,
    exportSessionId: string,
    selection: ExportSelection,
    method: SelectionDetails['selectionMethod'],
    rationale?: string
  ): void {
    const details = this.extractSelectionDetails(selection, method);
    
    const log: PartialExportLog = {
      sessionId,
      exportSessionId,
      selection: details,
      rationale,
      dependencies: [],
      validation: {
        rulesApplied: 0,
        rulesPassed: 0,
        warnings: [],
        overrides: [],
        completenessScore: 100,
        integrityScore: 100
      },
      outcome: {
        success: false,
        itemsExported: 0,
        itemsOmitted: 0,
        placeholdersAdded: 0,
        contextIncluded: 0,
        outputSize: 0
      }
    };

    this.activeSelections.set(sessionId, log);

    this.logger.logExport(
      LogCategory.PARTIAL_SELECTED,
      `Partial export selection created`,
      {
        sessionId,
        exportSessionId,
        selectionType: details.type,
        coverage: `${details.coverage.toFixed(1)}%`,
        itemCount: details.totalSelected,
        method,
        rationale
      }
    );

    // Log detailed breakdown if significant selection
    if (details.coverage < 50) {
      this.logSelectionBreakdown(sessionId, details);
    }
  }

  /**
   * Log zone/page selection details
   */
  logSelectionDetails(
    sessionId: string,
    zones: Array<{ id: string; type: string; confidence?: number }>,
    pages: number[]
  ): void {
    const log = this.activeSelections.get(sessionId);
    if (!log) return;

    // Analyze zone distribution
    const zoneTypes = zones.reduce((acc, zone) => {
      acc[zone.type] = (acc[zone.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Analyze confidence distribution
    const confidenceBuckets = {
      high: zones.filter(z => (z.confidence || 0) >= 0.8).length,
      medium: zones.filter(z => (z.confidence || 0) >= 0.5 && (z.confidence || 0) < 0.8).length,
      low: zones.filter(z => (z.confidence || 0) < 0.5).length
    };

    this.logger.info(
      'Selection details analyzed',
      {
        sessionId,
        zoneCount: zones.length,
        pageCount: pages.length,
        zoneTypes,
        confidenceDistribution: confidenceBuckets,
        avgConfidence: zones.reduce((sum, z) => sum + (z.confidence || 0), 0) / zones.length
      }
    );
  }

  /**
   * Log dependency resolution
   */
  logDependencyResolution(
    sessionId: string,
    dependencies: DependencyLog[]
  ): void {
    const log = this.activeSelections.get(sessionId);
    if (!log) return;

    log.dependencies = dependencies;

    const totalDeps = dependencies.reduce((sum, d) => sum + d.dependencies.length, 0);
    const resolvedDeps = dependencies.reduce((sum, d) => sum + d.resolved.length, 0);
    const missingDeps = dependencies.reduce((sum, d) => sum + d.missing.length, 0);

    this.logger.info(
      'Dependencies resolved for partial export',
      {
        sessionId,
        totalDependencies: totalDeps,
        resolved: resolvedDeps,
        missing: missingDeps,
        resolutionRate: totalDeps > 0 ? (resolvedDeps / totalDeps * 100).toFixed(1) + '%' : '100%',
        strategies: this.summarizeStrategies(dependencies)
      }
    );

    // Warn about missing critical dependencies
    const criticalMissing = dependencies.filter(d => 
      d.missing.length > 0 && ['table', 'diagram'].includes(d.itemType)
    );

    if (criticalMissing.length > 0) {
      this.logger.warn(
        'Critical dependencies missing',
        {
          sessionId,
          criticalItems: criticalMissing.map(d => ({
            id: d.itemId,
            type: d.itemType,
            missing: d.missing
          }))
        }
      );
    }
  }

  /**
   * Log partial validation results
   */
  logPartialValidation(
    sessionId: string,
    validation: PartialValidationLog
  ): void {
    const log = this.activeSelections.get(sessionId);
    if (!log) return;

    log.validation = validation;

    const passRate = validation.rulesApplied > 0 
      ? (validation.rulesPassed / validation.rulesApplied * 100).toFixed(1)
      : '100';

    this.logger.logValidation(
      validation.warnings.length > 0 ? LogCategory.VALIDATION_FAILED : LogCategory.VALIDATION_PASSED,
      'Partial export validation completed',
      {
        sessionId,
        rulesApplied: validation.rulesApplied,
        passRate: `${passRate}%`,
        warnings: validation.warnings.length,
        overrides: validation.overrides.length,
        scores: {
          completeness: validation.completenessScore,
          integrity: validation.integrityScore
        }
      }
    );

    // Log specific warnings
    validation.warnings.forEach(warning => {
      this.logger.warn(`Partial export warning: ${warning}`, { sessionId });
    });
  }

  /**
   * Log partial export completion
   */
  logPartialExportCompleted(
    sessionId: string,
    outcome: PartialExportOutcome,
    format: ExportFormat
  ): void {
    const log = this.activeSelections.get(sessionId);
    if (!log) return;

    log.outcome = outcome;

    this.logger.logExport(
      outcome.success ? LogCategory.PARTIAL_EXPORTED : LogCategory.EXPORT_FAILED,
      `Partial export ${outcome.success ? 'completed' : 'failed'}`,
      {
        sessionId,
        exportSessionId: log.exportSessionId,
        format,
        selection: {
          type: log.selection.type,
          coverage: log.selection.coverage,
          selected: log.selection.totalSelected
        },
        outcome: {
          itemsExported: outcome.itemsExported,
          itemsOmitted: outcome.itemsOmitted,
          placeholders: outcome.placeholdersAdded,
          context: outcome.contextIncluded,
          outputSize: outcome.outputSize,
          compressionRatio: outcome.compressionRatio
        },
        validation: {
          completeness: log.validation.completenessScore,
          integrity: log.validation.integrityScore
        }
      }
    );

    // Log performance metrics for partial export
    this.logger.logPerformance(
      'partial_export',
      {
        duration: 0, // Would be calculated from timestamps
        memoryUsed: process.memoryUsage().heapUsed,
        processingTime: 0
      },
      {
        sessionId,
        itemsProcessed: outcome.itemsExported,
        efficiency: this.calculateEfficiency(log, outcome)
      }
    );
  }

  /**
   * Log selection rationale
   */
  logSelectionRationale(
    sessionId: string,
    rationale: string,
    userId?: string
  ): void {
    const log = this.activeSelections.get(sessionId);
    if (!log) return;

    log.rationale = rationale;

    this.logger.logAudit(
      'Partial export rationale documented',
      {
        sessionId,
        rationale,
        userId,
        timestamp: new Date().toISOString()
      }
    );
  }

  /**
   * Private helper methods
   */

  private extractSelectionDetails(
    selection: ExportSelection,
    method: SelectionDetails['selectionMethod']
  ): SelectionDetails {
    const details: SelectionDetails = {
      type: selection.type === 'all' ? 'zones' : selection.type,
      totalAvailable: 0, // Would be provided by caller
      totalSelected: selection.totalCount,
      coverage: 0,
      selectionMethod: method
    };

    // Calculate zone breakdown if available
    if (selection.items) {
      const zoneBreakdown: any = {};
      selection.items.forEach(item => {
        if (item.type === 'zone') {
          // Would need actual zone type from item
          zoneBreakdown[item.type] = (zoneBreakdown[item.type] || 0) + 1;
        }
      });
      details.zoneBreakdown = zoneBreakdown;
    }

    // Extract page range if page-based selection
    if (selection.type === 'pages' && selection.pageNumbers.size > 0) {
      const pages = Array.from(selection.pageNumbers).sort((a, b) => a - b);
      details.pageRange = {
        start: pages[0],
        end: pages[pages.length - 1],
        selected: pages
      };
    }

    return details;
  }

  private logSelectionBreakdown(sessionId: string, details: SelectionDetails): void {
    this.logger.info(
      'Partial selection breakdown',
      {
        sessionId,
        coverage: `${details.coverage.toFixed(1)}%`,
        distribution: details.zoneBreakdown,
        pageRange: details.pageRange,
        filters: details.filters?.map(f => `${f.type} ${f.operator} ${f.value}`)
      }
    );
  }

  private summarizeStrategies(dependencies: DependencyLog[]): Record<string, number> {
    const strategies: Record<string, number> = {
      include: 0,
      placeholder: 0,
      omit: 0
    };

    dependencies.forEach(dep => {
      strategies[dep.strategy] = (strategies[dep.strategy] || 0) + 1;
    });

    return strategies;
  }

  private calculateEfficiency(log: PartialExportLog, outcome: PartialExportOutcome): number {
    // Calculate efficiency based on selection vs export ratio
    const selectionRatio = log.selection.totalSelected / (log.selection.totalAvailable || 1);
    const exportRatio = outcome.itemsExported / (log.selection.totalSelected || 1);
    const compressionFactor = outcome.compressionRatio || 1;
    
    return (exportRatio * compressionFactor * 100) / selectionRatio;
  }

  /**
   * Get selection statistics
   */
  getSelectionStats(): {
    totalSelections: number;
    avgCoverage: number;
    commonTypes: Record<string, number>;
    avgDependencies: number;
  } {
    const selections = Array.from(this.activeSelections.values());
    
    const stats = {
      totalSelections: selections.length,
      avgCoverage: 0,
      commonTypes: {} as Record<string, number>,
      avgDependencies: 0
    };

    if (selections.length === 0) return stats;

    // Calculate averages
    let totalCoverage = 0;
    let totalDeps = 0;

    selections.forEach(sel => {
      totalCoverage += sel.selection.coverage;
      totalDeps += sel.dependencies.length;
      
      // Track selection types
      stats.commonTypes[sel.selection.type] = (stats.commonTypes[sel.selection.type] || 0) + 1;
    });

    stats.avgCoverage = totalCoverage / selections.length;
    stats.avgDependencies = totalDeps / selections.length;

    return stats;
  }

  /**
   * Clear completed selections
   */
  clearCompletedSelections(): void {
    // Would filter based on completion status
    this.activeSelections.clear();
  }
}