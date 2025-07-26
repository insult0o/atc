/**
 * Partial Export Validation System
 * Validates partial export selections for completeness and integrity
 */

import { Zone, ZoneType } from '@/lib/types/zone';
import { ExportSelection, SelectionItem } from '@/app/components/export/SelectionPanel';
import { ExportFormat } from '../schemas/types';

export interface SelectionValidationRules {
  completeness: {
    checkOrphanedContent: boolean;
    checkBrokenReferences: boolean;
    minimumCoverage: number; // Percentage of document
  };
  consistency: {
    requireCompleteSection: boolean;
    requireCompleteTable: boolean;
    requireCompleteParagraph: boolean;
  };
  quality: {
    minimumConfidence: number;
    requireProcessedContent: boolean;
    allowPartiallyProcessed: boolean;
  };
}

export interface ValidationIssue {
  id: string;
  type: 'error' | 'warning' | 'info';
  category: 'completeness' | 'consistency' | 'quality' | 'reference';
  itemId?: string;
  message: string;
  details?: any;
  suggestion?: string;
  canOverride: boolean;
}

export interface PartialValidationResult {
  isValid: boolean;
  score: number;
  issues: ValidationIssue[];
  statistics: {
    totalItems: number;
    validItems: number;
    warningItems: number;
    errorItems: number;
    coverage: number;
    brokenReferences: number;
    orphanedItems: number;
  };
  recommendations: string[];
}

export interface DependencyGraph {
  nodes: Map<string, DependencyNode>;
  edges: DependencyEdge[];
}

interface DependencyNode {
  id: string;
  type: 'zone' | 'page';
  isSelected: boolean;
  dependencies: string[];
  dependents: string[];
}

interface DependencyEdge {
  source: string;
  target: string;
  type: 'requires' | 'references' | 'contains';
  weight: number;
}

export class PartialValidator {
  private rules: SelectionValidationRules;
  private dependencyGraph: DependencyGraph;

  constructor(rules?: Partial<SelectionValidationRules>) {
    this.rules = {
      completeness: {
        checkOrphanedContent: true,
        checkBrokenReferences: true,
        minimumCoverage: 0,
        ...rules?.completeness
      },
      consistency: {
        requireCompleteSection: true,
        requireCompleteTable: true,
        requireCompleteParagraph: false,
        ...rules?.consistency
      },
      quality: {
        minimumConfidence: 0.7,
        requireProcessedContent: true,
        allowPartiallyProcessed: true,
        ...rules?.quality
      }
    };

    this.dependencyGraph = {
      nodes: new Map(),
      edges: []
    };
  }

  /**
   * Validate partial export selection
   */
  async validateSelection(
    selection: ExportSelection,
    allZones: Zone[],
    format: ExportFormat
  ): Promise<PartialValidationResult> {
    const issues: ValidationIssue[] = [];
    const selectedItems = selection.items.filter(item => item.includeInExport);
    
    // Build dependency graph
    this.buildDependencyGraph(selectedItems, allZones);
    
    // Run validation checks
    const completenessIssues = await this.checkCompleteness(selectedItems, allZones);
    const consistencyIssues = await this.checkConsistency(selectedItems, allZones);
    const qualityIssues = await this.checkQuality(selectedItems, allZones);
    const referenceIssues = await this.checkReferences(selectedItems, allZones);
    
    issues.push(...completenessIssues, ...consistencyIssues, ...qualityIssues, ...referenceIssues);
    
    // Calculate statistics
    const statistics = this.calculateStatistics(selectedItems, allZones, issues);
    
    // Generate recommendations
    const recommendations = this.generateRecommendations(issues, statistics);
    
    // Calculate overall score
    const score = this.calculateValidationScore(statistics, issues);
    
    // Determine validity based on format requirements
    const isValid = this.determineValidity(issues, format);
    
    return {
      isValid,
      score,
      issues,
      statistics,
      recommendations
    };
  }

  /**
   * Check completeness of selection
   */
  private async checkCompleteness(
    selectedItems: SelectionItem[],
    allZones: Zone[]
  ): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];
    
    // Check minimum coverage
    if (this.rules.completeness.minimumCoverage > 0) {
      const coverage = (selectedItems.length / allZones.length) * 100;
      if (coverage < this.rules.completeness.minimumCoverage) {
        issues.push({
          id: `completeness_coverage_${Date.now()}`,
          type: 'warning',
          category: 'completeness',
          message: `Selection covers only ${coverage.toFixed(1)}% of the document`,
          details: {
            actual: coverage,
            required: this.rules.completeness.minimumCoverage
          },
          suggestion: `Select additional content to reach ${this.rules.completeness.minimumCoverage}% coverage`,
          canOverride: true
        });
      }
    }
    
    // Check for orphaned content
    if (this.rules.completeness.checkOrphanedContent) {
      const orphans = this.findOrphanedItems(selectedItems);
      orphans.forEach(orphan => {
        issues.push({
          id: `completeness_orphan_${orphan.id}`,
          type: 'warning',
          category: 'completeness',
          itemId: orphan.id,
          message: `Item has missing dependencies`,
          details: {
            missingDeps: orphan.dependencies.filter(dep => 
              !selectedItems.some(item => item.id === dep)
            )
          },
          suggestion: 'Include dependent items or accept incomplete context',
          canOverride: true
        });
      });
    }
    
    // Check for broken references
    if (this.rules.completeness.checkBrokenReferences) {
      const brokenRefs = this.findBrokenReferences(selectedItems, allZones);
      if (brokenRefs.length > 0) {
        issues.push({
          id: `completeness_refs_${Date.now()}`,
          type: 'warning',
          category: 'completeness',
          message: `${brokenRefs.length} references will be broken`,
          details: { brokenReferences: brokenRefs },
          suggestion: 'Include referenced content or update references',
          canOverride: true
        });
      }
    }
    
    return issues;
  }

  /**
   * Check consistency of selection
   */
  private async checkConsistency(
    selectedItems: SelectionItem[],
    allZones: Zone[]
  ): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];
    
    // Group selected zones by type
    const selectedZones = allZones.filter(zone => 
      selectedItems.some(item => item.id === zone.id && item.includeInExport)
    );
    
    // Check for incomplete tables
    if (this.rules.consistency.requireCompleteTable) {
      const tableIssues = this.checkIncompleteTables(selectedZones, allZones);
      issues.push(...tableIssues);
    }
    
    // Check for incomplete sections
    if (this.rules.consistency.requireCompleteSection) {
      const sectionIssues = this.checkIncompleteSections(selectedZones, allZones);
      issues.push(...sectionIssues);
    }
    
    // Check for incomplete paragraphs
    if (this.rules.consistency.requireCompleteParagraph) {
      const paragraphIssues = this.checkIncompleteParagraphs(selectedZones, allZones);
      issues.push(...paragraphIssues);
    }
    
    return issues;
  }

  /**
   * Check quality of selected content
   */
  private async checkQuality(
    selectedItems: SelectionItem[],
    allZones: Zone[]
  ): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];
    
    const selectedZones = allZones.filter(zone => 
      selectedItems.some(item => item.id === zone.id && item.includeInExport)
    );
    
    selectedZones.forEach(zone => {
      // Check confidence threshold
      if (zone.confidence && zone.confidence < this.rules.quality.minimumConfidence) {
        issues.push({
          id: `quality_confidence_${zone.id}`,
          type: 'warning',
          category: 'quality',
          itemId: zone.id,
          message: `Low confidence zone: ${(zone.confidence * 100).toFixed(0)}%`,
          details: {
            confidence: zone.confidence,
            threshold: this.rules.quality.minimumConfidence
          },
          suggestion: 'Review and potentially correct this zone before export',
          canOverride: true
        });
      }
      
      // Check processing status
      if (this.rules.quality.requireProcessedContent) {
        if (zone.status === 'failed' || zone.status === 'error') {
          issues.push({
            id: `quality_processing_${zone.id}`,
            type: 'error',
            category: 'quality',
            itemId: zone.id,
            message: 'Zone processing failed',
            details: {
              status: zone.status,
              error: zone.errorDetails
            },
            suggestion: 'Reprocess or manually correct this zone',
            canOverride: this.rules.quality.allowPartiallyProcessed
          });
        } else if (!['processed', 'completed'].includes(zone.status)) {
          issues.push({
            id: `quality_unprocessed_${zone.id}`,
            type: 'warning',
            category: 'quality',
            itemId: zone.id,
            message: 'Zone not fully processed',
            details: { status: zone.status },
            suggestion: 'Complete processing before export',
            canOverride: this.rules.quality.allowPartiallyProcessed
          });
        }
      }
      
      // Check for empty content
      if (!zone.textContent || zone.textContent.trim().length === 0) {
        issues.push({
          id: `quality_empty_${zone.id}`,
          type: 'error',
          category: 'quality',
          itemId: zone.id,
          message: 'Zone has no text content',
          details: { zoneType: zone.type },
          suggestion: 'Process or remove empty zones',
          canOverride: false
        });
      }
    });
    
    return issues;
  }

  /**
   * Check references between selected items
   */
  private async checkReferences(
    selectedItems: SelectionItem[],
    allZones: Zone[]
  ): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];
    
    // Analyze cross-references
    const selectedIds = new Set(selectedItems.map(item => item.id));
    
    selectedItems.forEach(item => {
      // Check internal references
      const missingRefs = item.dependencies.filter(dep => !selectedIds.has(dep));
      if (missingRefs.length > 0) {
        const dependentZones = allZones.filter(z => missingRefs.includes(z.id));
        const criticalDeps = dependentZones.filter(z => 
          z.type === 'table' || z.type === 'diagram'
        );
        
        if (criticalDeps.length > 0) {
          issues.push({
            id: `reference_critical_${item.id}`,
            type: 'error',
            category: 'reference',
            itemId: item.id,
            message: 'Missing critical dependencies',
            details: {
              missing: criticalDeps.map(z => ({
                id: z.id,
                type: z.type,
                page: z.pageNumber
              }))
            },
            suggestion: 'Include referenced tables and diagrams',
            canOverride: false
          });
        }
      }
    });
    
    // Check for circular dependencies
    const cycles = this.findDependencyCycles(selectedItems);
    if (cycles.length > 0) {
      issues.push({
        id: `reference_cycles_${Date.now()}`,
        type: 'warning',
        category: 'reference',
        message: 'Circular dependencies detected',
        details: { cycles },
        suggestion: 'Review dependency structure',
        canOverride: true
      });
    }
    
    return issues;
  }

  /**
   * Helper methods
   */
  
  private buildDependencyGraph(
    selectedItems: SelectionItem[],
    allZones: Zone[]
  ): void {
    this.dependencyGraph.nodes.clear();
    this.dependencyGraph.edges = [];
    
    // Add nodes
    selectedItems.forEach(item => {
      const node: DependencyNode = {
        id: item.id,
        type: item.type,
        isSelected: item.includeInExport,
        dependencies: item.dependencies,
        dependents: []
      };
      this.dependencyGraph.nodes.set(item.id, node);
    });
    
    // Add edges and update dependents
    selectedItems.forEach(item => {
      item.dependencies.forEach(depId => {
        const depNode = this.dependencyGraph.nodes.get(depId);
        if (depNode) {
          depNode.dependents.push(item.id);
          this.dependencyGraph.edges.push({
            source: item.id,
            target: depId,
            type: 'requires',
            weight: 1
          });
        }
      });
    });
  }

  private findOrphanedItems(selectedItems: SelectionItem[]): SelectionItem[] {
    const selectedIds = new Set(
      selectedItems
        .filter(item => item.includeInExport)
        .map(item => item.id)
    );
    
    return selectedItems.filter(item => {
      if (!item.includeInExport) return false;
      if (item.dependencies.length === 0) return false;
      
      return item.dependencies.some(dep => !selectedIds.has(dep));
    });
  }

  private findBrokenReferences(
    selectedItems: SelectionItem[],
    allZones: Zone[]
  ): Array<{ source: string; target: string; type: string }> {
    const brokenRefs: Array<{ source: string; target: string; type: string }> = [];
    const selectedIds = new Set(selectedItems.map(item => item.id));
    
    selectedItems.forEach(item => {
      // Check text content for references
      const zone = allZones.find(z => z.id === item.id);
      if (zone?.textContent) {
        // Look for figure/table references
        const figureRefs = zone.textContent.match(/(?:Figure|Table|Diagram)\s+\d+/gi) || [];
        figureRefs.forEach(ref => {
          const referencedZone = allZones.find(z => 
            z.textContent?.includes(ref) && z.type !== 'text'
          );
          if (referencedZone && !selectedIds.has(referencedZone.id)) {
            brokenRefs.push({
              source: item.id,
              target: referencedZone.id,
              type: ref.split(' ')[0]
            });
          }
        });
      }
    });
    
    return brokenRefs;
  }

  private checkIncompleteTables(
    selectedZones: Zone[],
    allZones: Zone[]
  ): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const tableZones = selectedZones.filter(z => z.type === 'table');
    
    tableZones.forEach(table => {
      // Find related table zones (multi-part tables)
      const relatedTables = allZones.filter(z => 
        z.type === 'table' &&
        z.pageNumber === table.pageNumber &&
        z.id !== table.id &&
        Math.abs(z.bounds.y - (table.bounds.y + table.bounds.height)) < 50
      );
      
      const missingParts = relatedTables.filter(related => 
        !selectedZones.some(selected => selected.id === related.id)
      );
      
      if (missingParts.length > 0) {
        issues.push({
          id: `consistency_table_${table.id}`,
          type: 'warning',
          category: 'consistency',
          itemId: table.id,
          message: 'Incomplete table selection',
          details: {
            selectedPart: table.id,
            missingParts: missingParts.map(p => p.id)
          },
          suggestion: 'Include all parts of the table',
          canOverride: true
        });
      }
    });
    
    return issues;
  }

  private checkIncompleteSections(
    selectedZones: Zone[],
    allZones: Zone[]
  ): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    
    // Group zones by page
    const pageGroups = new Map<number, Zone[]>();
    selectedZones.forEach(zone => {
      const pageZones = pageGroups.get(zone.pageNumber) || [];
      pageZones.push(zone);
      pageGroups.set(zone.pageNumber, pageZones);
    });
    
    pageGroups.forEach((zones, pageNumber) => {
      const allPageZones = allZones.filter(z => z.pageNumber === pageNumber);
      
      // Check for header without content
      const headers = zones.filter(z => z.type === 'header');
      headers.forEach(header => {
        const followingContent = allPageZones.filter(z => 
          z.bounds.y > header.bounds.y &&
          z.bounds.y < header.bounds.y + 200 && // Within reasonable distance
          z.type === 'text'
        );
        
        const missingContent = followingContent.filter(content => 
          !zones.some(selected => selected.id === content.id)
        );
        
        if (missingContent.length > 0) {
          issues.push({
            id: `consistency_section_${header.id}`,
            type: 'warning',
            category: 'consistency',
            itemId: header.id,
            message: 'Header without complete content',
            details: {
              header: header.id,
              missingContent: missingContent.length
            },
            suggestion: 'Include section content with headers',
            canOverride: true
          });
        }
      });
    });
    
    return issues;
  }

  private checkIncompleteParagraphs(
    selectedZones: Zone[],
    allZones: Zone[]
  ): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    
    selectedZones.forEach(zone => {
      if (zone.type !== 'text') return;
      
      // Check if text appears to be truncated
      const text = zone.textContent || '';
      const endsWithPunctuation = /[.!?]$/.test(text.trim());
      const startsWithLowercase = /^[a-z]/.test(text.trim());
      
      if (!endsWithPunctuation || startsWithLowercase) {
        // Look for adjacent text zones
        const adjacentZones = allZones.filter(z => 
          z.type === 'text' &&
          z.pageNumber === zone.pageNumber &&
          z.id !== zone.id &&
          (
            Math.abs(z.bounds.y - (zone.bounds.y + zone.bounds.height)) < 20 ||
            Math.abs(zone.bounds.y - (z.bounds.y + z.bounds.height)) < 20
          )
        );
        
        const missingAdjacent = adjacentZones.filter(adj => 
          !selectedZones.some(selected => selected.id === adj.id)
        );
        
        if (missingAdjacent.length > 0) {
          issues.push({
            id: `consistency_paragraph_${zone.id}`,
            type: 'info',
            category: 'consistency',
            itemId: zone.id,
            message: 'Potentially incomplete paragraph',
            details: {
              indicators: {
                endsWithPunctuation,
                startsWithLowercase
              }
            },
            suggestion: 'Check for paragraph continuity',
            canOverride: true
          });
        }
      }
    });
    
    return issues;
  }

  private findDependencyCycles(selectedItems: SelectionItem[]): string[][] {
    const cycles: string[][] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    
    const dfs = (itemId: string, path: string[]): void => {
      visited.add(itemId);
      recursionStack.add(itemId);
      
      const item = selectedItems.find(i => i.id === itemId);
      if (item) {
        item.dependencies.forEach(depId => {
          if (!visited.has(depId)) {
            dfs(depId, [...path, depId]);
          } else if (recursionStack.has(depId)) {
            // Found a cycle
            const cycleStart = path.indexOf(depId);
            if (cycleStart !== -1) {
              cycles.push(path.slice(cycleStart));
            }
          }
        });
      }
      
      recursionStack.delete(itemId);
    };
    
    selectedItems.forEach(item => {
      if (!visited.has(item.id)) {
        dfs(item.id, [item.id]);
      }
    });
    
    return cycles;
  }

  private calculateStatistics(
    selectedItems: SelectionItem[],
    allZones: Zone[],
    issues: ValidationIssue[]
  ): PartialValidationResult['statistics'] {
    const selectedCount = selectedItems.filter(item => item.includeInExport).length;
    const coverage = (selectedCount / allZones.length) * 100;
    
    const errorItems = new Set(
      issues
        .filter(issue => issue.type === 'error' && issue.itemId)
        .map(issue => issue.itemId!)
    );
    
    const warningItems = new Set(
      issues
        .filter(issue => issue.type === 'warning' && issue.itemId)
        .map(issue => issue.itemId!)
    );
    
    const validItems = selectedItems.filter(item => 
      item.includeInExport &&
      !errorItems.has(item.id) &&
      !warningItems.has(item.id)
    );
    
    const brokenReferences = issues.filter(issue => 
      issue.category === 'reference' && issue.type === 'error'
    ).length;
    
    const orphanedItems = issues.filter(issue => 
      issue.category === 'completeness' && 
      issue.message.includes('orphan')
    ).length;
    
    return {
      totalItems: selectedCount,
      validItems: validItems.length,
      warningItems: warningItems.size,
      errorItems: errorItems.size,
      coverage,
      brokenReferences,
      orphanedItems
    };
  }

  private generateRecommendations(
    issues: ValidationIssue[],
    statistics: PartialValidationResult['statistics']
  ): string[] {
    const recommendations: string[] = [];
    
    // Coverage recommendations
    if (statistics.coverage < 20) {
      recommendations.push('Consider selecting more content for a comprehensive export');
    }
    
    // Quality recommendations
    const qualityIssues = issues.filter(i => i.category === 'quality');
    if (qualityIssues.length > statistics.totalItems * 0.2) {
      recommendations.push('Review and improve content quality before export');
    }
    
    // Reference recommendations
    if (statistics.brokenReferences > 0) {
      recommendations.push('Include referenced content to maintain document integrity');
    }
    
    // Orphan recommendations
    if (statistics.orphanedItems > 0) {
      recommendations.push('Add dependent items or accept partial context');
    }
    
    // Consistency recommendations
    const consistencyIssues = issues.filter(i => i.category === 'consistency');
    if (consistencyIssues.length > 0) {
      recommendations.push('Complete partial sections for better coherence');
    }
    
    return recommendations;
  }

  private calculateValidationScore(
    statistics: PartialValidationResult['statistics'],
    issues: ValidationIssue[]
  ): number {
    let score = 100;
    
    // Deduct for errors (10 points each)
    score -= statistics.errorItems * 10;
    
    // Deduct for warnings (3 points each)
    score -= statistics.warningItems * 3;
    
    // Deduct for low coverage
    if (statistics.coverage < 50) {
      score -= (50 - statistics.coverage) * 0.5;
    }
    
    // Deduct for broken references
    score -= statistics.brokenReferences * 5;
    
    // Deduct for orphaned items
    score -= statistics.orphanedItems * 2;
    
    return Math.max(0, Math.min(100, score));
  }

  private determineValidity(
    issues: ValidationIssue[],
    format: ExportFormat
  ): boolean {
    // Check for non-overridable errors
    const hasBlockingErrors = issues.some(issue => 
      issue.type === 'error' && !issue.canOverride
    );
    
    if (hasBlockingErrors) return false;
    
    // Format-specific requirements
    switch (format) {
      case 'rag':
        // RAG requires good content quality
        const qualityErrors = issues.filter(i => 
          i.category === 'quality' && i.type === 'error'
        );
        return qualityErrors.length === 0;
        
      case 'jsonl':
        // JSONL is more flexible
        return true;
        
      case 'corrections':
        // Corrections require processed content
        const processingErrors = issues.filter(i => 
          i.message.includes('processing') && i.type === 'error'
        );
        return processingErrors.length === 0;
        
      case 'manifest':
        // Manifest can be generated for any selection
        return true;
        
      default:
        return !hasBlockingErrors;
    }
  }

  /**
   * Update validation rules
   */
  updateRules(rules: Partial<SelectionValidationRules>): void {
    this.rules = {
      ...this.rules,
      ...rules,
      completeness: {
        ...this.rules.completeness,
        ...rules.completeness
      },
      consistency: {
        ...this.rules.consistency,
        ...rules.consistency
      },
      quality: {
        ...this.rules.quality,
        ...rules.quality
      }
    };
  }

  /**
   * Get current validation rules
   */
  getRules(): SelectionValidationRules {
    return { ...this.rules };
  }
}