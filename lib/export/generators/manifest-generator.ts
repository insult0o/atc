/**
 * Zone Manifest Generator
 * Generates comprehensive zone processing reports with detailed metrics
 */

import {
  ZoneManifest,
  ZoneDetails,
  BoundingBox,
  ProcessingEvent,
  CorrectionSummary,
  ProcessingStatistics,
  ToolUsageReport,
  ContentType,
  ProcessingStatus,
  ManifestExportOptions,
  ExportResult,
  ExportError,
  ExportWarning
} from '../schemas';

interface Zone {
  id: string;
  page: number;
  coordinates: BoundingBox;
  content: string;
  contentType: ContentType;
  confidence: number;
  status: ProcessingStatus;
  tool: string;
  processingHistory: Array<{
    timestamp: Date;
    tool: string;
    action: string;
    result: 'success' | 'failure' | 'partial';
    confidence?: number;
    duration: number;
  }>;
  corrections?: Array<{
    id: string;
    timestamp: Date;
    category: 'spelling' | 'formatting' | 'content' | 'structure';
    impact: 'low' | 'medium' | 'high';
  }>;
  metadata?: Record<string, any>;
}

interface Document {
  id: string;
  name: string;
  pageCount: number;
  zones: Zone[];
  processingStartTime: Date;
  processingEndTime: Date;
}

export class ManifestGenerator {
  private options: ManifestExportOptions;
  private statisticsCalculator: StatisticsCalculator;
  private visualGenerator: VisualGenerator;

  constructor(options: Partial<ManifestExportOptions> = {}) {
    this.options = {
      includeVisualPreviews: options.includeVisualPreviews || false,
      detailLevel: options.detailLevel || 'detailed',
      includeProcessingLogs: options.includeProcessingLogs !== false,
      includeCorrections: options.includeCorrections !== false,
      includeMetrics: options.includeMetrics !== false
    };

    this.statisticsCalculator = new StatisticsCalculator();
    this.visualGenerator = new VisualGenerator();
  }

  /**
   * Generate zone manifest from document
   */
  async generateManifest(document: Document): Promise<ExportResult> {
    const startTime = Date.now();
    const errors: ExportError[] = [];
    const warnings: ExportWarning[] = [];

    try {
      // Calculate processing time
      const processingTime = (document.processingEndTime.getTime() - 
                             document.processingStartTime.getTime()) / 1000;

      // Process zones based on detail level
      const zoneDetails = await this.processZones(document.zones, errors, warnings);

      // Calculate statistics
      const statistics = this.options.includeMetrics 
        ? this.statisticsCalculator.calculate(document.zones)
        : this.createMinimalStatistics(document.zones);

      // Generate tool usage report
      const toolUsage = this.generateToolUsageReport(document.zones);

      // Create manifest
      const manifest: ZoneManifest = {
        documentId: document.id,
        documentName: document.name,
        totalPages: document.pageCount,
        totalZones: document.zones.length,
        processingTime,
        exportTimestamp: new Date().toISOString(),
        zones: zoneDetails,
        statistics,
        toolUsage
      };

      // Validate manifest
      const validationResults = this.validateManifest(manifest);
      warnings.push(...validationResults.warnings);

      // Generate visual previews if requested
      if (this.options.includeVisualPreviews) {
        await this.addVisualPreviews(manifest);
      }

      return {
        exportId: `manifest-${document.id}-${Date.now()}`,
        format: 'manifest',
        status: errors.length === 0 ? 'success' : 'partial',
        itemCount: manifest.zones.length,
        errors,
        warnings,
        metadata: {
          processingTime: Date.now() - startTime,
          detailLevel: this.options.detailLevel,
          documentName: document.name,
          manifestSize: JSON.stringify(manifest).length
        }
      };
    } catch (error) {
      return {
        exportId: `manifest-${document.id}-${Date.now()}`,
        format: 'manifest',
        status: 'failure',
        errors: [{
          code: 'GENERATION_FAILED',
          message: 'Failed to generate zone manifest',
          details: error
        }],
        warnings,
        metadata: {
          processingTime: Date.now() - startTime
        }
      };
    }
  }

  /**
   * Process zones based on detail level
   */
  private async processZones(
    zones: Zone[], 
    errors: ExportError[], 
    warnings: ExportWarning[]
  ): Promise<ZoneDetails[]> {
    const details: ZoneDetails[] = [];

    for (const zone of zones) {
      try {
        const zoneDetail = await this.createZoneDetails(zone);
        details.push(zoneDetail);

        // Check for zone issues
        if (zone.status === 'error') {
          warnings.push({
            code: 'ZONE_PROCESSING_ERROR',
            message: `Zone ${zone.id} failed processing`,
            item: zone.id,
            suggestion: 'Review processing logs for error details'
          });
        }

        if (zone.confidence < 0.5) {
          warnings.push({
            code: 'LOW_ZONE_CONFIDENCE',
            message: `Zone ${zone.id} has low confidence`,
            item: zone.id,
            suggestion: 'Consider manual review or reprocessing'
          });
        }
      } catch (error) {
        errors.push({
          code: 'ZONE_DETAIL_ERROR',
          message: `Failed to process zone ${zone.id}`,
          item: zone.id,
          details: error
        });
      }
    }

    return details;
  }

  /**
   * Create detailed zone information
   */
  private async createZoneDetails(zone: Zone): Promise<ZoneDetails> {
    const details: ZoneDetails = {
      id: zone.id,
      page: zone.page,
      coordinates: zone.coordinates,
      contentType: zone.contentType,
      content: this.getZoneContent(zone),
      confidence: zone.confidence,
      status: zone.status,
      tool: zone.tool,
      processingHistory: this.getProcessingHistory(zone),
      metadata: this.getZoneMetadata(zone)
    };

    // Add corrections if included
    if (this.options.includeCorrections && zone.corrections) {
      details.corrections = zone.corrections.map(c => ({
        correctionId: c.id,
        timestamp: c.timestamp.toISOString(),
        category: c.category,
        impact: c.impact
      }));
    }

    return details;
  }

  /**
   * Get zone content based on detail level
   */
  private getZoneContent(zone: Zone): string {
    switch (this.options.detailLevel) {
      case 'summary':
        // Return truncated content
        return zone.content.length > 100 
          ? zone.content.substring(0, 100) + '...'
          : zone.content;
      
      case 'detailed':
        // Return full content up to reasonable limit
        return zone.content.length > 5000
          ? zone.content.substring(0, 5000) + '...'
          : zone.content;
      
      case 'verbose':
        // Return full content
        return zone.content;
      
      default:
        return zone.content;
    }
  }

  /**
   * Get processing history based on options
   */
  private getProcessingHistory(zone: Zone): ProcessingEvent[] {
    if (!this.options.includeProcessingLogs) {
      return [];
    }

    return zone.processingHistory.map(event => ({
      timestamp: event.timestamp.toISOString(),
      tool: event.tool,
      action: event.action,
      result: event.result,
      confidence: event.confidence,
      duration: event.duration
    }));
  }

  /**
   * Get zone metadata based on detail level
   */
  private getZoneMetadata(zone: Zone): Record<string, any> {
    const metadata: Record<string, any> = {};

    if (this.options.detailLevel === 'summary') {
      // Minimal metadata
      metadata.processed = true;
      metadata.hasCorrections = (zone.corrections?.length || 0) > 0;
    } else {
      // Full metadata
      Object.assign(metadata, zone.metadata || {});
      
      // Add computed metadata
      metadata.processingAttempts = zone.processingHistory.length;
      metadata.successfulProcessing = zone.processingHistory.some(h => h.result === 'success');
      metadata.averageConfidence = this.calculateAverageConfidence(zone.processingHistory);
      
      if (zone.contentType === 'table') {
        metadata.estimatedRows = this.estimateTableRows(zone.content);
        metadata.estimatedColumns = this.estimateTableColumns(zone.content);
      }
    }

    return metadata;
  }

  /**
   * Generate tool usage report
   */
  private generateToolUsageReport(zones: Zone[]): ToolUsageReport[] {
    const toolStats = new Map<string, {
      invocations: number;
      successCount: number;
      failureCount: number;
      totalTime: number;
      confidenceSum: number;
      confidenceCount: number;
      contentTypes: Set<ContentType>;
    }>();

    // Aggregate tool statistics
    zones.forEach(zone => {
      zone.processingHistory.forEach(event => {
        let stats = toolStats.get(event.tool);
        if (!stats) {
          stats = {
            invocations: 0,
            successCount: 0,
            failureCount: 0,
            totalTime: 0,
            confidenceSum: 0,
            confidenceCount: 0,
            contentTypes: new Set()
          };
          toolStats.set(event.tool, stats);
        }

        stats.invocations++;
        stats.totalTime += event.duration;
        stats.contentTypes.add(zone.contentType);

        if (event.result === 'success') {
          stats.successCount++;
          if (event.confidence !== undefined) {
            stats.confidenceSum += event.confidence;
            stats.confidenceCount++;
          }
        } else if (event.result === 'failure') {
          stats.failureCount++;
        }
      });
    });

    // Convert to report format
    const reports: ToolUsageReport[] = [];
    toolStats.forEach((stats, tool) => {
      reports.push({
        tool,
        invocations: stats.invocations,
        successCount: stats.successCount,
        failureCount: stats.failureCount,
        averageProcessingTime: stats.totalTime / stats.invocations,
        averageConfidence: stats.confidenceCount > 0 
          ? stats.confidenceSum / stats.confidenceCount 
          : 0,
        contentTypes: Array.from(stats.contentTypes)
      });
    });

    // Sort by invocation count
    return reports.sort((a, b) => b.invocations - a.invocations);
  }

  /**
   * Create minimal statistics for summary mode
   */
  private createMinimalStatistics(zones: Zone[]): ProcessingStatistics {
    const totalZones = zones.length;
    const completedZones = zones.filter(z => z.status === 'completed').length;
    const totalConfidence = zones.reduce((sum, z) => sum + z.confidence, 0);

    return {
      averageConfidence: totalZones > 0 ? totalConfidence / totalZones : 0,
      confidenceDistribution: {},
      processingTimeByTool: {},
      successRate: totalZones > 0 ? completedZones / totalZones : 0,
      correctionRate: 0,
      contentTypeDistribution: {
        text: zones.filter(z => z.contentType === 'text').length,
        table: zones.filter(z => z.contentType === 'table').length,
        diagram: zones.filter(z => z.contentType === 'diagram').length,
        mixed: zones.filter(z => z.contentType === 'mixed').length
      }
    };
  }

  /**
   * Validate manifest
   */
  private validateManifest(manifest: ZoneManifest): { warnings: ExportWarning[] } {
    const warnings: ExportWarning[] = [];

    // Check for high error rate
    const errorZones = manifest.zones.filter(z => z.status === 'error').length;
    const errorRate = errorZones / manifest.totalZones;
    
    if (errorRate > 0.1) {
      warnings.push({
        code: 'HIGH_ERROR_RATE',
        message: `${(errorRate * 100).toFixed(1)}% of zones failed processing`,
        suggestion: 'Review failed zones and consider reprocessing'
      });
    }

    // Check processing time
    if (manifest.processingTime > 300) {
      warnings.push({
        code: 'LONG_PROCESSING_TIME',
        message: `Processing took ${manifest.processingTime.toFixed(1)} seconds`,
        suggestion: 'Consider optimizing processing pipeline'
      });
    }

    // Check for zones with no content
    const emptyZones = manifest.zones.filter(z => !z.content || z.content.trim() === '').length;
    if (emptyZones > 0) {
      warnings.push({
        code: 'EMPTY_ZONES',
        message: `${emptyZones} zones have no content`,
        suggestion: 'Verify zone detection and extraction'
      });
    }

    return { warnings };
  }

  /**
   * Add visual previews to manifest
   */
  private async addVisualPreviews(manifest: ZoneManifest): Promise<void> {
    // Placeholder for visual generation
    // In production, this would generate actual visual representations
    for (const zone of manifest.zones) {
      zone.metadata = zone.metadata || {};
      zone.metadata.visualPreview = await this.visualGenerator.generatePreview(zone);
    }
  }

  /**
   * Helper methods
   */
  
  private calculateAverageConfidence(history: Array<{ confidence?: number }>): number {
    const confidences = history
      .filter(h => h.confidence !== undefined)
      .map(h => h.confidence!);
    
    if (confidences.length === 0) return 0;
    return confidences.reduce((sum, c) => sum + c, 0) / confidences.length;
  }

  private estimateTableRows(content: string): number {
    return content.split('\n').filter(line => line.trim()).length;
  }

  private estimateTableColumns(content: string): number {
    const firstLine = content.split('\n')[0];
    if (!firstLine) return 0;
    
    // Count pipe separators or tabs
    const pipes = (firstLine.match(/\|/g) || []).length;
    const tabs = (firstLine.match(/\t/g) || []).length;
    
    return Math.max(pipes > 0 ? pipes - 1 : 0, tabs + 1);
  }

  /**
   * Export manifest to file
   */
  async exportToFile(manifest: ZoneManifest, filePath: string): Promise<void> {
    const fs = await import('fs/promises');
    await fs.writeFile(filePath, JSON.stringify(manifest, null, 2), 'utf-8');
  }
}

/**
 * Statistics calculator
 */
class StatisticsCalculator {
  calculate(zones: Zone[]): ProcessingStatistics {
    const statistics: ProcessingStatistics = {
      averageConfidence: 0,
      confidenceDistribution: {},
      processingTimeByTool: {},
      successRate: 0,
      correctionRate: 0,
      contentTypeDistribution: {
        text: 0,
        table: 0,
        diagram: 0,
        mixed: 0
      }
    };

    if (zones.length === 0) return statistics;

    // Calculate confidence statistics
    const confidences = zones.map(z => z.confidence);
    statistics.averageConfidence = confidences.reduce((sum, c) => sum + c, 0) / confidences.length;

    // Create confidence distribution
    const buckets = ['0.0-0.2', '0.2-0.4', '0.4-0.6', '0.6-0.8', '0.8-1.0'];
    buckets.forEach(bucket => {
      statistics.confidenceDistribution[bucket] = 0;
    });

    confidences.forEach(confidence => {
      const bucketIndex = Math.min(Math.floor(confidence * 5), 4);
      const bucket = buckets[bucketIndex];
      statistics.confidenceDistribution[bucket]++;
    });

    // Calculate processing time by tool
    const toolTimes = new Map<string, number>();
    zones.forEach(zone => {
      zone.processingHistory.forEach(event => {
        const currentTime = toolTimes.get(event.tool) || 0;
        toolTimes.set(event.tool, currentTime + event.duration);
      });
    });

    toolTimes.forEach((time, tool) => {
      statistics.processingTimeByTool[tool] = time;
    });

    // Calculate success rate
    const successfulZones = zones.filter(z => z.status === 'completed').length;
    statistics.successRate = successfulZones / zones.length;

    // Calculate correction rate
    const correctedZones = zones.filter(z => z.corrections && z.corrections.length > 0).length;
    statistics.correctionRate = correctedZones / zones.length;

    // Content type distribution
    zones.forEach(zone => {
      statistics.contentTypeDistribution[zone.contentType]++;
    });

    return statistics;
  }
}

/**
 * Visual preview generator (placeholder)
 */
class VisualGenerator {
  async generatePreview(zone: ZoneDetails): Promise<string> {
    // In production, this would generate actual visual representations
    // For now, return a placeholder description
    return `Visual preview for ${zone.contentType} zone at page ${zone.page}`;
  }
}