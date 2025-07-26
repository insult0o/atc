/**
 * Partial Export Engine
 * Handles partial data export with reference preservation
 */

import { Zone } from '@/lib/types/zone';
import { ExportSelection, SelectionItem } from '@/app/components/export/SelectionPanel';
import { 
  ExportFormat, 
  ExportOptions, 
  ExportResult,
  ExportError,
  ExportWarning 
} from './schemas/types';
import { ExportManager } from './manager';
import { PartialValidator } from './validation/partial-validator';

export interface PartialExportConfig {
  selection: ExportSelection;
  formats: ExportFormat[];
  options: {
    preserveReferences: boolean;
    includeContext: boolean;
    contextSize: number;
    validateCompleteness: boolean;
    generateManifest: boolean;
  };
  validation: {
    allowOrphaned: boolean;
    minSelectionSize: number;
    requireContiguous: boolean;
  };
}

export interface ReferencePreservation {
  strategy: 'include' | 'placeholder' | 'omit';
  placeholderFormat: {
    type: 'link' | 'note' | 'summary';
    template: string;
    includeMetadata: boolean;
  };
  crossReferences: Map<string, Reference[]>;
  externalReferences: ExternalReference[];
}

export interface Reference {
  sourceId: string;
  targetId: string;
  type: 'zone' | 'page' | 'section';
  relationship: 'contains' | 'references' | 'depends_on';
  required: boolean;
}

export interface ExternalReference {
  sourceId: string;
  targetUrl?: string;
  targetDocument?: string;
  description: string;
}

export interface PartialExportResult extends ExportResult {
  selection: ExportSelection;
  preservedReferences: Map<string, Reference[]>;
  omittedContent: string[];
  contextIncluded: Map<string, string>;
}

export class PartialExportEngine {
  private exportManager: ExportManager;
  private validator: PartialValidator;
  private referenceMap: Map<string, Reference[]>;

  constructor() {
    this.exportManager = new ExportManager();
    this.validator = new PartialValidator();
    this.referenceMap = new Map();
  }

  /**
   * Export partial content based on selection
   */
  async exportPartial(
    document: any,
    config: PartialExportConfig,
    allZones: Zone[]
  ): Promise<Map<ExportFormat, PartialExportResult>> {
    const results = new Map<ExportFormat, PartialExportResult>();
    
    // Validate selection first
    const validationPromises = config.formats.map(format => 
      this.validator.validateSelection(config.selection, allZones, format)
    );
    
    const validationResults = await Promise.all(validationPromises);
    
    // Check for blocking validation errors
    const hasBlockingErrors = validationResults.some(result => 
      !result.isValid && config.validation.allowOrphaned === false
    );
    
    if (hasBlockingErrors) {
      throw new Error('Selection validation failed with blocking errors');
    }
    
    // Build reference map
    this.buildReferenceMap(config.selection, allZones);
    
    // Process each format
    for (const format of config.formats) {
      const result = await this.processFormat(
        document,
        config,
        format,
        allZones
      );
      results.set(format, result);
    }
    
    // Generate partial manifest if requested
    if (config.options.generateManifest) {
      const manifestResult = await this.generatePartialManifest(
        document,
        config,
        results,
        allZones
      );
      results.set('manifest', manifestResult);
    }
    
    return results;
  }

  /**
   * Process export for specific format
   */
  private async processFormat(
    document: any,
    config: PartialExportConfig,
    format: ExportFormat,
    allZones: Zone[]
  ): Promise<PartialExportResult> {
    // Filter document content based on selection
    const partialDocument = this.createPartialDocument(
      document,
      config.selection,
      allZones
    );
    
    // Add context if requested
    if (config.options.includeContext) {
      this.addContext(partialDocument, config, allZones);
    }
    
    // Preserve or handle references
    const preservedReferences = config.options.preserveReferences
      ? await this.preserveReferences(partialDocument, config, allZones)
      : new Map();
    
    // Export using standard export manager
    const sessionId = await this.exportManager.startExport(
      partialDocument,
      [format],
      this.getExportOptions(config)
    );
    
    // Wait for export completion
    const exportResult = await this.waitForExport(sessionId, format);
    
    // Enhance result with partial export metadata
    const partialResult: PartialExportResult = {
      ...exportResult,
      selection: config.selection,
      preservedReferences,
      omittedContent: this.getOmittedContent(document, config.selection, allZones),
      contextIncluded: this.getIncludedContext(partialDocument)
    };
    
    return partialResult;
  }

  /**
   * Create partial document from selection
   */
  private createPartialDocument(
    document: any,
    selection: ExportSelection,
    allZones: Zone[]
  ): any {
    const selectedZoneIds = new Set(selection.zoneIds);
    const selectedPageNumbers = new Set(selection.pageNumbers);
    
    // Filter zones based on selection
    const selectedZones = allZones.filter(zone => {
      if (selection.type === 'all') {
        return true;
      } else if (selection.type === 'zones') {
        return selectedZoneIds.has(zone.id);
      } else if (selection.type === 'pages') {
        return selectedPageNumbers.has(zone.pageNumber);
      }
      return false;
    });
    
    // Create partial document
    return {
      ...document,
      zones: selectedZones,
      pageCount: Math.max(...selectedZones.map(z => z.pageNumber), 0),
      metadata: {
        ...document.metadata,
        isPartial: true,
        selectionType: selection.type,
        selectedCount: selectedZones.length,
        totalCount: allZones.length
      }
    };
  }

  /**
   * Add context to partial document
   */
  private addContext(
    partialDocument: any,
    config: PartialExportConfig,
    allZones: Zone[]
  ): void {
    const contextZones: Zone[] = [];
    const selectedIds = new Set(partialDocument.zones.map((z: Zone) => z.id));
    
    partialDocument.zones.forEach((zone: Zone) => {
      // Find zones that provide context
      const nearbyZones = allZones.filter(z => {
        if (selectedIds.has(z.id)) return false;
        
        // Same page, nearby position
        if (z.pageNumber === zone.pageNumber) {
          const distance = Math.abs(z.bounds.y - zone.bounds.y);
          return distance < config.options.contextSize;
        }
        
        return false;
      });
      
      // Add unique context zones
      nearbyZones.forEach(z => {
        if (!contextZones.some(cz => cz.id === z.id)) {
          contextZones.push({
            ...z,
            isContext: true,
            contextFor: zone.id
          } as Zone);
        }
      });
    });
    
    // Add context zones to document
    partialDocument.zones.push(...contextZones);
    partialDocument.contextZoneIds = contextZones.map(z => z.id);
  }

  /**
   * Preserve references in partial export
   */
  private async preserveReferences(
    partialDocument: any,
    config: PartialExportConfig,
    allZones: Zone[]
  ): Promise<Map<string, Reference[]>> {
    const preservedRefs = new Map<string, Reference[]>();
    const selectedIds = new Set(partialDocument.zones.map((z: Zone) => z.id));
    
    // Check each selected zone for references
    partialDocument.zones.forEach((zone: Zone) => {
      const refs = this.referenceMap.get(zone.id) || [];
      const missingRefs = refs.filter(ref => !selectedIds.has(ref.targetId));
      
      if (missingRefs.length > 0) {
        preservedRefs.set(zone.id, missingRefs);
        
        // Add placeholders based on strategy
        missingRefs.forEach(ref => {
          const targetZone = allZones.find(z => z.id === ref.targetId);
          if (targetZone) {
            this.addReferencePlaceholder(zone, targetZone, ref, config);
          }
        });
      }
    });
    
    return preservedRefs;
  }

  /**
   * Add reference placeholder
   */
  private addReferencePlaceholder(
    sourceZone: Zone,
    targetZone: Zone,
    reference: Reference,
    config: PartialExportConfig
  ): void {
    const preservation = this.getReferencePreservation(config);
    
    if (preservation.strategy === 'placeholder') {
      const placeholder = this.formatPlaceholder(
        targetZone,
        reference,
        preservation.placeholderFormat
      );
      
      // Add placeholder to source zone content
      if (sourceZone.textContent) {
        sourceZone.textContent += `\n\n${placeholder}`;
      }
      
      // Mark as modified
      sourceZone.metadata = {
        ...sourceZone.metadata,
        hasPlaceholders: true,
        modifiedForExport: true
      };
    }
  }

  /**
   * Format placeholder for missing reference
   */
  private formatPlaceholder(
    targetZone: Zone,
    reference: Reference,
    format: ReferencePreservation['placeholderFormat']
  ): string {
    const templates: Record<string, string> = {
      link: `[See ${reference.type} on page ${targetZone.pageNumber}]`,
      note: `Note: ${reference.type} "${targetZone.textContent?.substring(0, 50)}..." omitted from this export`,
      summary: `${reference.type} Summary: ${targetZone.textContent?.substring(0, 100)}...`
    };
    
    let placeholder = templates[format.type] || templates.note;
    
    if (format.includeMetadata) {
      placeholder += ` (ID: ${targetZone.id}, Confidence: ${targetZone.confidence || 'N/A'})`;
    }
    
    return placeholder;
  }

  /**
   * Build reference map from zones
   */
  private buildReferenceMap(selection: ExportSelection, allZones: Zone[]): void {
    this.referenceMap.clear();
    
    // Build dependencies map
    allZones.forEach(zone => {
      if (zone.dependencies && zone.dependencies.length > 0) {
        const refs: Reference[] = zone.dependencies.map(depId => ({
          sourceId: zone.id,
          targetId: depId,
          type: 'zone',
          relationship: 'depends_on',
          required: true
        }));
        
        this.referenceMap.set(zone.id, refs);
      }
    });
    
    // Analyze text references
    allZones.forEach(zone => {
      if (zone.textContent) {
        const textRefs = this.extractTextReferences(zone, allZones);
        const existing = this.referenceMap.get(zone.id) || [];
        this.referenceMap.set(zone.id, [...existing, ...textRefs]);
      }
    });
  }

  /**
   * Extract references from text content
   */
  private extractTextReferences(zone: Zone, allZones: Zone[]): Reference[] {
    const refs: Reference[] = [];
    const text = zone.textContent || '';
    
    // Look for figure/table references
    const patterns = [
      /(?:Figure|Fig\.?)\s+(\d+)/gi,
      /(?:Table|Tbl\.?)\s+(\d+)/gi,
      /(?:Diagram|Diag\.?)\s+(\d+)/gi
    ];
    
    patterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const refText = match[0];
        const refNum = match[1];
        
        // Find matching zone
        const targetZone = allZones.find(z => 
          z.type !== 'text' && 
          (z.textContent?.includes(refText) || z.metadata?.label === refText)
        );
        
        if (targetZone) {
          refs.push({
            sourceId: zone.id,
            targetId: targetZone.id,
            type: targetZone.type as 'zone',
            relationship: 'references',
            required: false
          });
        }
      }
    });
    
    return refs;
  }

  /**
   * Get reference preservation configuration
   */
  private getReferencePreservation(config: PartialExportConfig): ReferencePreservation {
    return {
      strategy: config.options.preserveReferences ? 'placeholder' : 'omit',
      placeholderFormat: {
        type: 'note',
        template: '[Reference omitted]',
        includeMetadata: true
      },
      crossReferences: this.referenceMap,
      externalReferences: []
    };
  }

  /**
   * Get export options for partial export
   */
  private getExportOptions(config: PartialExportConfig): ExportOptions {
    return {
      formats: {
        rag: {
          chunk_size: 1000,
          chunk_overlap: 100,
          include_metadata: true,
          preserve_structure: config.options.preserveReferences
        },
        jsonl: {
          max_examples: 1000,
          include_confidence: true,
          format_version: 2
        },
        corrections: {
          include_all_fields: true,
          group_by_page: false
        },
        manifest: {
          include_statistics: true,
          include_processing_details: true
        }
      },
      validation: {
        enabled: config.options.validateCompleteness,
        stopOnError: false
      },
      output: {
        format: 'json',
        compression: false,
        include_timestamp: true
      }
    };
  }

  /**
   * Wait for export to complete
   */
  private async waitForExport(
    sessionId: string, 
    format: ExportFormat
  ): Promise<ExportResult> {
    const maxWaitTime = 300000; // 5 minutes
    const checkInterval = 1000; // 1 second
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWaitTime) {
      const session = this.exportManager.getExportResults(sessionId);
      
      if (session && session.results.has(format)) {
        return session.results.get(format)!;
      }
      
      if (session?.endTime) {
        // Export completed but format not found
        throw new Error(`Export completed but format ${format} not found`);
      }
      
      // Wait before next check
      await new Promise(resolve => setTimeout(resolve, checkInterval));
    }
    
    throw new Error('Export timeout');
  }

  /**
   * Get list of omitted content
   */
  private getOmittedContent(
    document: any,
    selection: ExportSelection,
    allZones: Zone[]
  ): string[] {
    const selectedIds = new Set(selection.zoneIds);
    const omitted: string[] = [];
    
    allZones.forEach(zone => {
      if (!selectedIds.has(zone.id)) {
        omitted.push(`${zone.type} on page ${zone.pageNumber} (${zone.id})`);
      }
    });
    
    return omitted;
  }

  /**
   * Get included context mapping
   */
  private getIncludedContext(partialDocument: any): Map<string, string> {
    const contextMap = new Map<string, string>();
    
    if (partialDocument.contextZoneIds) {
      partialDocument.zones.forEach((zone: Zone) => {
        if (partialDocument.contextZoneIds.includes(zone.id)) {
          const contextFor = (zone as any).contextFor;
          contextMap.set(zone.id, contextFor || 'general');
        }
      });
    }
    
    return contextMap;
  }

  /**
   * Generate partial manifest
   */
  private async generatePartialManifest(
    document: any,
    config: PartialExportConfig,
    results: Map<ExportFormat, PartialExportResult>,
    allZones: Zone[]
  ): Promise<PartialExportResult> {
    const manifest = {
      document_id: document.id,
      document_name: document.name,
      export_type: 'partial',
      selection: {
        type: config.selection.type,
        zone_count: config.selection.zoneIds.size,
        page_count: config.selection.pageNumbers.size,
        total_selected: config.selection.totalCount,
        total_available: allZones.length,
        coverage: (config.selection.totalCount / allZones.length) * 100
      },
      formats_exported: Array.from(results.keys()),
      export_config: {
        preserve_references: config.options.preserveReferences,
        include_context: config.options.includeContext,
        context_size: config.options.contextSize
      },
      validation: {
        completeness_checked: config.options.validateCompleteness,
        allow_orphaned: config.validation.allowOrphaned,
        min_selection_size: config.validation.minSelectionSize
      },
      timestamp: new Date().toISOString()
    };
    
    return {
      exportId: `manifest-${Date.now()}`,
      format: 'manifest',
      status: 'success',
      data: manifest,
      errors: [],
      warnings: [],
      metadata: {
        isPartial: true,
        selectionType: config.selection.type
      },
      selection: config.selection,
      preservedReferences: new Map(),
      omittedContent: [],
      contextIncluded: new Map()
    };
  }

  /**
   * Validate partial export configuration
   */
  validateConfig(config: PartialExportConfig): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    // Validate selection
    if (!config.selection || config.selection.totalCount === 0) {
      errors.push('No items selected for export');
    }
    
    // Validate formats
    if (!config.formats || config.formats.length === 0) {
      errors.push('No export formats specified');
    }
    
    // Validate options
    if (config.options.includeContext && config.options.contextSize <= 0) {
      errors.push('Context size must be positive when including context');
    }
    
    // Validate minimum selection size
    if (config.validation.minSelectionSize > 0 && 
        config.selection.totalCount < config.validation.minSelectionSize) {
      errors.push(`Selection size (${config.selection.totalCount}) is below minimum (${config.validation.minSelectionSize})`);
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.exportManager.destroy();
    this.referenceMap.clear();
  }
}