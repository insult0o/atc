/**
 * Performance Metrics Logger
 * Tracks detailed timing and resource usage
 */

import { Logger, LogCategory, PerformanceMetrics } from './logger';

export interface DetailedPerformanceLog {
  operation: string;
  operationId: string;
  phases: PerformancePhases;
  resources: ResourceMetrics;
  bottlenecks: Bottleneck[];
  optimizationSuggestions: string[];
  comparison?: PerformanceComparison;
}

export interface PerformancePhases {
  preparation: TimingMetrics;
  validation: TimingMetrics;
  processing: TimingMetrics;
  output: TimingMetrics;
  cleanup: TimingMetrics;
  total: TimingMetrics;
}

export interface TimingMetrics {
  startTime: string;
  endTime: string;
  duration: number;
  breakdown?: Record<string, number>;
  markers?: TimingMarker[];
}

export interface TimingMarker {
  name: string;
  timestamp: string;
  elapsed: number;
  metadata?: any;
}

export interface ResourceMetrics {
  peakMemory: number;
  averageMemory: number;
  memoryDelta: number;
  averageCpu?: number;
  peakCpu?: number;
  diskIO?: IOMetrics;
  networkIO?: IOMetrics;
  gcMetrics?: GCMetrics;
}

export interface IOMetrics {
  bytesRead: number;
  bytesWritten: number;
  operations: number;
  avgLatency?: number;
  throughput?: number;
}

export interface GCMetrics {
  collections: number;
  pauseTime: number;
  heapReclaimed: number;
}

export interface Bottleneck {
  phase: string;
  operation: string;
  duration: number;
  percentage: number; // of total time
  type: 'cpu' | 'memory' | 'io' | 'network' | 'processing';
  severity: 'low' | 'medium' | 'high';
  impact: string;
}

export interface PerformanceComparison {
  baseline?: TimingMetrics;
  previous?: TimingMetrics;
  improvement: number; // percentage
  regression: boolean;
}

export interface PerformanceTrend {
  operation: string;
  samples: number;
  averageDuration: number;
  medianDuration: number;
  p95Duration: number;
  p99Duration: number;
  trend: 'improving' | 'stable' | 'degrading';
  trendMagnitude: number;
}

export class PerformanceLogger {
  private logger: Logger;
  private activeOperations: Map<string, OperationTracker>;
  private performanceHistory: Map<string, PerformanceMetrics[]>;
  private baselineMetrics: Map<string, TimingMetrics>;
  private readonly historyLimit = 1000;

  constructor(logger?: Logger) {
    this.logger = logger || new Logger();
    this.activeOperations = new Map();
    this.performanceHistory = new Map();
    this.baselineMetrics = new Map();
  }

  /**
   * Start performance tracking
   */
  startOperation(operationId: string, operation: string, metadata?: any): void {
    const tracker: OperationTracker = {
      operationId,
      operation,
      startTime: new Date(),
      phases: new Map(),
      resources: {
        startMemory: process.memoryUsage().heapUsed,
        startCpu: process.cpuUsage()
      },
      markers: [],
      metadata
    };

    this.activeOperations.set(operationId, tracker);

    this.logger.debug(
      `Performance tracking started: ${operation}`,
      { operationId, metadata }
    );
  }

  /**
   * Mark phase start
   */
  startPhase(operationId: string, phase: string): void {
    const tracker = this.activeOperations.get(operationId);
    if (!tracker) return;

    const phaseTracker: PhaseTracker = {
      phase,
      startTime: new Date(),
      startMemory: process.memoryUsage().heapUsed
    };

    tracker.phases.set(phase, phaseTracker);
  }

  /**
   * Mark phase end
   */
  endPhase(operationId: string, phase: string, breakdown?: Record<string, number>): void {
    const tracker = this.activeOperations.get(operationId);
    const phaseTracker = tracker?.phases.get(phase);
    if (!tracker || !phaseTracker) return;

    phaseTracker.endTime = new Date();
    phaseTracker.duration = phaseTracker.endTime.getTime() - phaseTracker.startTime.getTime();
    phaseTracker.endMemory = process.memoryUsage().heapUsed;
    phaseTracker.breakdown = breakdown;
  }

  /**
   * Add timing marker
   */
  addMarker(operationId: string, markerName: string, metadata?: any): void {
    const tracker = this.activeOperations.get(operationId);
    if (!tracker) return;

    const elapsed = Date.now() - tracker.startTime.getTime();
    
    tracker.markers.push({
      name: markerName,
      timestamp: new Date().toISOString(),
      elapsed,
      metadata
    });
  }

  /**
   * End operation and log results
   */
  endOperation(operationId: string, suggestions?: string[]): DetailedPerformanceLog | undefined {
    const tracker = this.activeOperations.get(operationId);
    if (!tracker) return undefined;

    const endTime = new Date();
    const totalDuration = endTime.getTime() - tracker.startTime.getTime();

    // Build performance phases
    const phases = this.buildPhases(tracker, totalDuration);

    // Collect resource metrics
    const resources = this.collectResourceMetrics(tracker);

    // Identify bottlenecks
    const bottlenecks = this.identifyBottlenecks(phases, resources);

    // Generate optimization suggestions
    const optimizationSuggestions = [
      ...this.generateSuggestions(bottlenecks, resources),
      ...(suggestions || [])
    ];

    // Compare with baseline/previous
    const comparison = this.comparePerformance(tracker.operation, phases.total);

    const performanceLog: DetailedPerformanceLog = {
      operation: tracker.operation,
      operationId,
      phases,
      resources,
      bottlenecks,
      optimizationSuggestions,
      comparison
    };

    // Log the performance data
    this.logger.logPerformance(
      tracker.operation,
      {
        duration: totalDuration,
        memoryUsed: resources.peakMemory,
        processingTime: phases.processing.duration,
        validationTime: phases.validation.duration
      },
      {
        operationId,
        phases: this.summarizePhases(phases),
        bottlenecks: bottlenecks.map(b => `${b.phase}: ${b.duration}ms (${b.percentage}%)`),
        resourceUtilization: {
          memoryDelta: `${(resources.memoryDelta / 1024 / 1024).toFixed(2)}MB`,
          peakMemory: `${(resources.peakMemory / 1024 / 1024).toFixed(2)}MB`
        }
      }
    );

    // Log critical bottlenecks
    bottlenecks.filter(b => b.severity === 'high').forEach(bottleneck => {
      this.logger.warn(
        `Performance bottleneck detected`,
        {
          operationId,
          bottleneck,
          suggestion: this.getBottleneckSuggestion(bottleneck)
        }
      );
    });

    // Update history
    this.updatePerformanceHistory(tracker.operation, {
      duration: totalDuration,
      memoryUsed: resources.peakMemory,
      processingTime: phases.processing.duration
    });

    // Clean up
    this.activeOperations.delete(operationId);

    return performanceLog;
  }

  /**
   * Log resource usage snapshot
   */
  logResourceSnapshot(operationId: string, label: string): void {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    this.logger.debug(
      `Resource snapshot: ${label}`,
      {
        operationId,
        memory: {
          heapUsed: `${(memUsage.heapUsed / 1024 / 1024).toFixed(2)}MB`,
          heapTotal: `${(memUsage.heapTotal / 1024 / 1024).toFixed(2)}MB`,
          external: `${(memUsage.external / 1024 / 1024).toFixed(2)}MB`,
          rss: `${(memUsage.rss / 1024 / 1024).toFixed(2)}MB`
        },
        cpu: {
          user: cpuUsage.user,
          system: cpuUsage.system
        }
      }
    );
  }

  /**
   * Get performance trends
   */
  getPerformanceTrends(operation?: string): PerformanceTrend[] {
    const trends: PerformanceTrend[] = [];
    
    const operations = operation 
      ? [operation] 
      : Array.from(this.performanceHistory.keys());

    operations.forEach(op => {
      const history = this.performanceHistory.get(op);
      if (!history || history.length < 5) return;

      const trend = this.calculateTrend(history);
      trends.push({
        operation: op,
        ...trend
      });
    });

    return trends;
  }

  /**
   * Set performance baseline
   */
  setBaseline(operation: string, metrics: TimingMetrics): void {
    this.baselineMetrics.set(operation, metrics);
    
    this.logger.info(
      `Performance baseline set for ${operation}`,
      {
        duration: metrics.duration,
        timestamp: metrics.startTime
      }
    );
  }

  /**
   * Private helper methods
   */

  private buildPhases(tracker: OperationTracker, totalDuration: number): PerformancePhases {
    const phases: PerformancePhases = {
      preparation: this.getPhaseMetrics(tracker, 'preparation'),
      validation: this.getPhaseMetrics(tracker, 'validation'),
      processing: this.getPhaseMetrics(tracker, 'processing'),
      output: this.getPhaseMetrics(tracker, 'output'),
      cleanup: this.getPhaseMetrics(tracker, 'cleanup'),
      total: {
        startTime: tracker.startTime.toISOString(),
        endTime: new Date().toISOString(),
        duration: totalDuration,
        markers: tracker.markers
      }
    };

    return phases;
  }

  private getPhaseMetrics(tracker: OperationTracker, phaseName: string): TimingMetrics {
    const phase = tracker.phases.get(phaseName);
    
    if (!phase || !phase.endTime) {
      return {
        startTime: '',
        endTime: '',
        duration: 0
      };
    }

    return {
      startTime: phase.startTime.toISOString(),
      endTime: phase.endTime.toISOString(),
      duration: phase.duration || 0,
      breakdown: phase.breakdown
    };
  }

  private collectResourceMetrics(tracker: OperationTracker): ResourceMetrics {
    const currentMemory = process.memoryUsage().heapUsed;
    const memoryDelta = currentMemory - tracker.resources.startMemory;

    // Calculate peak memory from phase data
    let peakMemory = currentMemory;
    let totalMemory = 0;
    let memoryCount = 0;

    tracker.phases.forEach(phase => {
      if (phase.endMemory) {
        peakMemory = Math.max(peakMemory, phase.endMemory);
        totalMemory += phase.endMemory;
        memoryCount++;
      }
    });

    const averageMemory = memoryCount > 0 ? totalMemory / memoryCount : currentMemory;

    // CPU metrics (simplified)
    const currentCpu = process.cpuUsage();
    const cpuUser = currentCpu.user - tracker.resources.startCpu.user;
    const cpuSystem = currentCpu.system - tracker.resources.startCpu.system;
    const cpuTotal = cpuUser + cpuSystem;

    return {
      peakMemory,
      averageMemory,
      memoryDelta,
      averageCpu: tracker.startTime ? cpuTotal / (Date.now() - tracker.startTime.getTime()) : 0
    };
  }

  private identifyBottlenecks(
    phases: PerformancePhases,
    resources: ResourceMetrics
  ): Bottleneck[] {
    const bottlenecks: Bottleneck[] = [];
    const totalDuration = phases.total.duration;

    // Check each phase
    Object.entries(phases).forEach(([phaseName, metrics]) => {
      if (phaseName === 'total' || metrics.duration === 0) return;

      const percentage = (metrics.duration / totalDuration) * 100;
      
      if (percentage > 30) {
        bottlenecks.push({
          phase: phaseName,
          operation: 'phase_execution',
          duration: metrics.duration,
          percentage,
          type: this.determineBottleneckType(phaseName, resources),
          severity: percentage > 50 ? 'high' : percentage > 40 ? 'medium' : 'low',
          impact: `${phaseName} phase consuming ${percentage.toFixed(1)}% of total time`
        });
      }
    });

    // Check memory usage
    if (resources.memoryDelta > 100 * 1024 * 1024) { // 100MB
      bottlenecks.push({
        phase: 'overall',
        operation: 'memory_usage',
        duration: 0,
        percentage: 0,
        type: 'memory',
        severity: resources.memoryDelta > 500 * 1024 * 1024 ? 'high' : 'medium',
        impact: `High memory consumption: ${(resources.memoryDelta / 1024 / 1024).toFixed(2)}MB`
      });
    }

    return bottlenecks.sort((a, b) => b.percentage - a.percentage);
  }

  private determineBottleneckType(
    phaseName: string,
    resources: ResourceMetrics
  ): Bottleneck['type'] {
    switch (phaseName) {
      case 'validation':
        return 'processing';
      case 'processing':
        return resources.averageCpu && resources.averageCpu > 80 ? 'cpu' : 'processing';
      case 'output':
        return 'io';
      default:
        return 'processing';
    }
  }

  private generateSuggestions(
    bottlenecks: Bottleneck[],
    resources: ResourceMetrics
  ): string[] {
    const suggestions: string[] = [];

    bottlenecks.forEach(bottleneck => {
      const suggestion = this.getBottleneckSuggestion(bottleneck);
      if (suggestion) suggestions.push(suggestion);
    });

    // Memory suggestions
    if (resources.memoryDelta > 200 * 1024 * 1024) {
      suggestions.push('Consider implementing streaming or chunked processing to reduce memory usage');
    }

    if (resources.peakMemory > 1024 * 1024 * 1024) {
      suggestions.push('Peak memory usage exceeds 1GB - optimize data structures');
    }

    return suggestions;
  }

  private getBottleneckSuggestion(bottleneck: Bottleneck): string {
    const suggestions: Record<string, Record<string, string>> = {
      validation: {
        high: 'Consider parallel validation or caching validation results',
        medium: 'Optimize validation rules or skip non-critical validations',
        low: 'Review validation logic for optimization opportunities'
      },
      processing: {
        high: 'Implement batch processing or use worker threads',
        medium: 'Consider caching intermediate results',
        low: 'Profile processing logic for optimization'
      },
      output: {
        high: 'Use streaming output or compression',
        medium: 'Batch write operations',
        low: 'Consider async I/O operations'
      }
    };

    return suggestions[bottleneck.phase]?.[bottleneck.severity] || 
           `Optimize ${bottleneck.phase} phase to improve performance`;
  }

  private comparePerformance(
    operation: string,
    current: TimingMetrics
  ): PerformanceComparison | undefined {
    const baseline = this.baselineMetrics.get(operation);
    const history = this.performanceHistory.get(operation);
    const previous = history && history.length > 0 ? history[history.length - 1] : undefined;

    if (!baseline && !previous) return undefined;

    const comparison: PerformanceComparison = {
      baseline: baseline,
      previous: previous ? {
        startTime: '',
        endTime: '',
        duration: previous.duration
      } : undefined,
      improvement: 0,
      regression: false
    };

    const compareAgainst = baseline || (previous ? { duration: previous.duration } : null);
    if (compareAgainst) {
      comparison.improvement = ((compareAgainst.duration - current.duration) / compareAgainst.duration) * 100;
      comparison.regression = comparison.improvement < -10; // 10% regression threshold
    }

    return comparison;
  }

  private summarizePhases(phases: PerformancePhases): Record<string, string> {
    const summary: Record<string, string> = {};
    
    Object.entries(phases).forEach(([name, metrics]) => {
      if (name !== 'total' && metrics.duration > 0) {
        summary[name] = `${metrics.duration}ms`;
      }
    });
    
    return summary;
  }

  private updatePerformanceHistory(operation: string, metrics: PerformanceMetrics): void {
    const history = this.performanceHistory.get(operation) || [];
    history.push(metrics);
    
    // Maintain history limit
    if (history.length > this.historyLimit) {
      history.splice(0, history.length - this.historyLimit);
    }
    
    this.performanceHistory.set(operation, history);
  }

  private calculateTrend(history: PerformanceMetrics[]): Omit<PerformanceTrend, 'operation'> {
    const durations = history.map(h => h.duration).sort((a, b) => a - b);
    const samples = durations.length;
    
    const sum = durations.reduce((acc, d) => acc + d, 0);
    const averageDuration = sum / samples;
    const medianDuration = durations[Math.floor(samples / 2)];
    const p95Duration = durations[Math.floor(samples * 0.95)];
    const p99Duration = durations[Math.floor(samples * 0.99)];

    // Calculate trend
    const recentAvg = durations.slice(-10).reduce((acc, d) => acc + d, 0) / Math.min(10, samples);
    const oldAvg = durations.slice(0, 10).reduce((acc, d) => acc + d, 0) / Math.min(10, samples);
    
    const trendMagnitude = ((recentAvg - oldAvg) / oldAvg) * 100;
    let trend: 'improving' | 'stable' | 'degrading' = 'stable';
    
    if (trendMagnitude < -10) trend = 'improving';
    else if (trendMagnitude > 10) trend = 'degrading';

    return {
      samples,
      averageDuration,
      medianDuration,
      p95Duration,
      p99Duration,
      trend,
      trendMagnitude
    };
  }

  /**
   * Clear old performance data
   */
  clearOldData(olderThanMs: number = 86400000): void {
    // In practice, would filter based on timestamps
    this.performanceHistory.clear();
    this.activeOperations.clear();
  }
}

interface OperationTracker {
  operationId: string;
  operation: string;
  startTime: Date;
  phases: Map<string, PhaseTracker>;
  resources: {
    startMemory: number;
    startCpu: NodeJS.CpuUsage;
  };
  markers: TimingMarker[];
  metadata?: any;
}

interface PhaseTracker {
  phase: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  startMemory: number;
  endMemory?: number;
  breakdown?: Record<string, number>;
}