/**
 * User Corrections Export Generator
 * Exports complete correction history with audit trail
 */

import {
  CorrectionExport,
  CorrectionContent,
  CorrectionCategory,
  ImpactLevel,
  CorrectionsExportOptions,
  ValidationResult,
  ExportResult,
  ExportError,
  ExportWarning
} from '../schemas';

interface UserCorrection {
  id: string;
  zoneId: string;
  documentId: string;
  userId: string;
  timestamp: Date;
  original: {
    content: string;
    confidence: number;
    tool: string;
    processingTime?: number;
    metadata?: Record<string, any>;
  };
  corrected: {
    content: string;
    reason?: string;
    validator?: string;
  };
  category?: CorrectionCategory;
  tags?: string[];
}

interface Document {
  id: string;
  name: string;
  corrections: UserCorrection[];
}

export class CorrectionsGenerator {
  private options: CorrectionsExportOptions;
  private categoryDetector: CategoryDetector;
  private impactAnalyzer: ImpactAnalyzer;

  constructor(options: Partial<CorrectionsExportOptions> = {}) {
    this.options = {
      includeOriginal: options.includeOriginal !== false,
      groupByCategory: options.groupByCategory || false,
      minImpactLevel: options.minImpactLevel || 'low',
      dateRange: options.dateRange,
      includeValidation: options.includeValidation !== false,
      sortBy: options.sortBy || 'timestamp'
    };

    this.categoryDetector = new CategoryDetector();
    this.impactAnalyzer = new ImpactAnalyzer();
  }

  /**
   * Generate correction exports from document
   */
  async generateExports(document: Document): Promise<ExportResult> {
    const startTime = Date.now();
    const exports: CorrectionExport[] = [];
    const errors: ExportError[] = [];
    const warnings: ExportWarning[] = [];

    try {
      // Filter corrections by date range if specified
      let corrections = this.filterByDateRange(document.corrections);
      
      if (corrections.length === 0) {
        warnings.push({
          code: 'NO_CORRECTIONS',
          message: 'No corrections found for the specified criteria',
          suggestion: 'Adjust date range or check if corrections exist'
        });
      }

      // Process each correction
      for (const correction of corrections) {
        try {
          const correctionExport = await this.processCorrectionforExport(correction);
          
          // Filter by impact level
          if (this.meetsImpactThreshold(correctionExport.impact)) {
            exports.push(correctionExport);
          }
        } catch (error) {
          errors.push({
            code: 'CORRECTION_PROCESSING_ERROR',
            message: `Failed to process correction ${correction.id}`,
            item: correction.id,
            details: error
          });
        }
      }

      // Sort exports
      const sortedExports = this.sortExports(exports);

      // Group by category if requested
      const finalExports = this.options.groupByCategory 
        ? this.groupByCategory(sortedExports)
        : sortedExports;

      // Validate exports
      const validationResults = this.validateExports(finalExports);
      warnings.push(...validationResults.warnings);

      // Generate statistics
      const statistics = this.generateStatistics(finalExports);

      return {
        exportId: `corrections-${document.id}-${Date.now()}`,
        format: 'corrections',
        status: errors.length === 0 ? 'success' : 'partial',
        itemCount: finalExports.length,
        errors,
        warnings,
        metadata: {
          processingTime: Date.now() - startTime,
          statistics,
          dateRange: this.options.dateRange,
          documentName: document.name
        }
      };
    } catch (error) {
      return {
        exportId: `corrections-${document.id}-${Date.now()}`,
        format: 'corrections',
        status: 'failure',
        errors: [{
          code: 'GENERATION_FAILED',
          message: 'Failed to generate corrections export',
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
   * Process a single correction for export
   */
  private async processCorrectionforExport(correction: UserCorrection): Promise<CorrectionExport> {
    // Detect category if not provided
    const category = correction.category || this.categoryDetector.detectCategory(
      correction.original.content,
      correction.corrected.content
    );

    // Analyze impact
    const impact = this.impactAnalyzer.analyzeImpact(
      correction.original,
      correction.corrected,
      category
    );

    // Calculate confidence change
    const correctedConfidence = correction.corrected.validator ? 0.95 : 1.0;
    const confidenceChange = correctedConfidence - correction.original.confidence;

    // Create corrected content object
    const correctedContent: CorrectionContent = {
      content: correction.corrected.content,
      confidence: correctedConfidence,
      tool: correction.corrected.validator || 'manual',
      metadata: {
        reason: correction.corrected.reason,
        timestamp: correction.timestamp.toISOString()
      }
    };

    // Validate if requested
    let validation: ValidationResult | undefined;
    if (this.options.includeValidation) {
      validation = await this.validateCorrection(correction);
    }

    const correctionExport: CorrectionExport = {
      id: correction.id,
      timestamp: correction.timestamp.toISOString(),
      userId: correction.userId,
      documentId: correction.documentId,
      zoneId: correction.zoneId,
      original: correction.original,
      corrected: correctedContent,
      category,
      impact,
      confidence_change: confidenceChange,
      validation
    };

    return correctionExport;
  }

  /**
   * Filter corrections by date range
   */
  private filterByDateRange(corrections: UserCorrection[]): UserCorrection[] {
    if (!this.options.dateRange) {
      return corrections;
    }

    const { start, end } = this.options.dateRange;
    return corrections.filter(c => 
      c.timestamp >= start && c.timestamp <= end
    );
  }

  /**
   * Check if impact meets threshold
   */
  private meetsImpactThreshold(impact: ImpactLevel): boolean {
    const levels: ImpactLevel[] = ['low', 'medium', 'high'];
    const thresholdIndex = levels.indexOf(this.options.minImpactLevel);
    const impactIndex = levels.indexOf(impact);
    return impactIndex >= thresholdIndex;
  }

  /**
   * Sort exports based on option
   */
  private sortExports(exports: CorrectionExport[]): CorrectionExport[] {
    const sorted = [...exports];
    
    switch (this.options.sortBy) {
      case 'timestamp':
        return sorted.sort((a, b) => 
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
      
      case 'impact':
        const impactOrder = { high: 3, medium: 2, low: 1 };
        return sorted.sort((a, b) => 
          impactOrder[b.impact] - impactOrder[a.impact]
        );
      
      case 'category':
        return sorted.sort((a, b) => 
          a.category.localeCompare(b.category)
        );
      
      default:
        return sorted;
    }
  }

  /**
   * Group exports by category
   */
  private groupByCategory(exports: CorrectionExport[]): CorrectionExport[] {
    const grouped = new Map<CorrectionCategory, CorrectionExport[]>();
    
    // Group corrections
    exports.forEach(exp => {
      const categoryExports = grouped.get(exp.category) || [];
      categoryExports.push(exp);
      grouped.set(exp.category, categoryExports);
    });
    
    // Flatten back to array
    const result: CorrectionExport[] = [];
    grouped.forEach(categoryExports => {
      result.push(...categoryExports);
    });
    
    return result;
  }

  /**
   * Validate correction accuracy
   */
  private async validateCorrection(correction: UserCorrection): Promise<ValidationResult> {
    const validator = new CorrectionValidator();
    return validator.validate(correction);
  }

  /**
   * Validate exports
   */
  private validateExports(exports: CorrectionExport[]): { warnings: ExportWarning[] } {
    const warnings: ExportWarning[] = [];
    
    exports.forEach((exp, index) => {
      // Check for no actual change
      if (exp.original.content === exp.corrected.content) {
        warnings.push({
          code: 'NO_CONTENT_CHANGE',
          message: `Correction ${exp.id} has no content change`,
          item: exp.id,
          suggestion: 'Remove unnecessary corrections'
        });
      }
      
      // Check for negative confidence change
      if (exp.confidence_change < 0) {
        warnings.push({
          code: 'NEGATIVE_CONFIDENCE_CHANGE',
          message: `Correction ${exp.id} decreased confidence`,
          item: exp.id,
          suggestion: 'Verify correction accuracy'
        });
      }
      
      // Check for very long corrections
      if (exp.corrected.content.length > 5000) {
        warnings.push({
          code: 'LARGE_CORRECTION',
          message: `Correction ${exp.id} has very long content`,
          item: exp.id,
          suggestion: 'Consider breaking into smaller corrections'
        });
      }
    });
    
    return { warnings };
  }

  /**
   * Generate statistics about corrections
   */
  private generateStatistics(exports: CorrectionExport[]): Record<string, any> {
    const stats = {
      totalCorrections: exports.length,
      byCategory: {} as Record<CorrectionCategory, number>,
      byImpact: {} as Record<ImpactLevel, number>,
      averageConfidenceChange: 0,
      mostCommonCategory: '' as CorrectionCategory,
      timeRange: {
        earliest: '',
        latest: ''
      },
      userContributions: new Map<string, number>()
    };
    
    // Initialize counters
    const categories: CorrectionCategory[] = ['spelling', 'formatting', 'content', 'structure'];
    const impacts: ImpactLevel[] = ['low', 'medium', 'high'];
    
    categories.forEach(cat => stats.byCategory[cat] = 0);
    impacts.forEach(imp => stats.byImpact[imp] = 0);
    
    // Calculate statistics
    let totalConfidenceChange = 0;
    let earliestDate = new Date();
    let latestDate = new Date(0);
    
    exports.forEach(exp => {
      // Category counts
      stats.byCategory[exp.category]++;
      
      // Impact counts
      stats.byImpact[exp.impact]++;
      
      // Confidence change
      totalConfidenceChange += exp.confidence_change;
      
      // Time range
      const timestamp = new Date(exp.timestamp);
      if (timestamp < earliestDate) earliestDate = timestamp;
      if (timestamp > latestDate) latestDate = timestamp;
      
      // User contributions
      const userCount = stats.userContributions.get(exp.userId) || 0;
      stats.userContributions.set(exp.userId, userCount + 1);
    });
    
    // Calculate averages and find most common
    if (exports.length > 0) {
      stats.averageConfidenceChange = totalConfidenceChange / exports.length;
      
      // Find most common category
      let maxCount = 0;
      categories.forEach(cat => {
        if (stats.byCategory[cat] > maxCount) {
          maxCount = stats.byCategory[cat];
          stats.mostCommonCategory = cat;
        }
      });
      
      stats.timeRange.earliest = earliestDate.toISOString();
      stats.timeRange.latest = latestDate.toISOString();
    }
    
    // Convert user contributions to object
    const userContributions: Record<string, number> = {};
    stats.userContributions.forEach((count, userId) => {
      userContributions[userId] = count;
    });
    
    return {
      ...stats,
      userContributions
    };
  }

  /**
   * Export corrections to file
   */
  async exportToFile(corrections: CorrectionExport[], filePath: string): Promise<void> {
    const fs = await import('fs/promises');
    
    if (this.options.groupByCategory) {
      // Export as grouped JSON
      const grouped: Record<CorrectionCategory, CorrectionExport[]> = {
        spelling: [],
        formatting: [],
        content: [],
        structure: []
      };
      
      corrections.forEach(c => {
        grouped[c.category].push(c);
      });
      
      await fs.writeFile(filePath, JSON.stringify(grouped, null, 2), 'utf-8');
    } else {
      // Export as JSONL
      const lines = corrections.map(c => JSON.stringify(c));
      await fs.writeFile(filePath, lines.join('\n'), 'utf-8');
    }
  }
}

/**
 * Category detection utility
 */
class CategoryDetector {
  detectCategory(original: string, corrected: string): CorrectionCategory {
    const originalLower = original.toLowerCase();
    const correctedLower = corrected.toLowerCase();
    
    // Spelling: minor character changes
    if (this.isSpellingCorrection(originalLower, correctedLower)) {
      return 'spelling';
    }
    
    // Formatting: whitespace, punctuation, capitalization
    if (this.isFormattingCorrection(original, corrected)) {
      return 'formatting';
    }
    
    // Structure: significant reorganization
    if (this.isStructureCorrection(original, corrected)) {
      return 'structure';
    }
    
    // Default to content for other changes
    return 'content';
  }
  
  private isSpellingCorrection(original: string, corrected: string): boolean {
    // Calculate edit distance
    const distance = this.levenshteinDistance(original, corrected);
    const maxLength = Math.max(original.length, corrected.length);
    
    // Spelling corrections typically have small edit distance relative to length
    return distance > 0 && distance / maxLength < 0.2;
  }
  
  private isFormattingCorrection(original: string, corrected: string): boolean {
    // Remove all whitespace and punctuation for comparison
    const normalizeForFormatting = (text: string) => 
      text.replace(/[\s\.,;:!?\-"'()]/g, '').toLowerCase();
    
    const originalNorm = normalizeForFormatting(original);
    const correctedNorm = normalizeForFormatting(corrected);
    
    // If normalized versions are the same, it's formatting
    return originalNorm === correctedNorm && original !== corrected;
  }
  
  private isStructureCorrection(original: string, corrected: string): boolean {
    // Check for significant length changes
    const lengthRatio = corrected.length / original.length;
    if (lengthRatio < 0.5 || lengthRatio > 2.0) {
      return true;
    }
    
    // Check for paragraph/line count changes
    const originalLines = original.split('\n').length;
    const correctedLines = corrected.split('\n').length;
    
    return Math.abs(originalLines - correctedLines) > 2;
  }
  
  private levenshteinDistance(a: string, b: string): number {
    const matrix: number[][] = [];
    
    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[b.length][a.length];
  }
}

/**
 * Impact analysis utility
 */
class ImpactAnalyzer {
  analyzeImpact(
    original: { content: string; confidence: number },
    corrected: { content: string },
    category: CorrectionCategory
  ): ImpactLevel {
    // Category-based initial assessment
    const categoryImpact: Record<CorrectionCategory, ImpactLevel> = {
      spelling: 'low',
      formatting: 'low',
      content: 'medium',
      structure: 'high'
    };
    
    let impact = categoryImpact[category];
    
    // Adjust based on content significance
    const contentChange = Math.abs(original.content.length - corrected.content.length);
    const changeRatio = contentChange / original.content.length;
    
    if (changeRatio > 0.5) {
      // Significant change, upgrade impact
      impact = impact === 'low' ? 'medium' : 'high';
    }
    
    // Adjust based on original confidence
    if (original.confidence < 0.5 && category === 'content') {
      // Low confidence content corrections are high impact
      impact = 'high';
    }
    
    return impact;
  }
}

/**
 * Correction validation utility
 */
class CorrectionValidator {
  async validate(correction: UserCorrection): Promise<ValidationResult> {
    const issues: string[] = [];
    const suggestions: string[] = [];
    let score = 1.0;
    
    // Check content validity
    if (correction.corrected.content.trim().length === 0) {
      issues.push('Corrected content is empty');
      score -= 0.5;
    }
    
    // Check for common issues
    if (correction.corrected.content.includes('{{') || correction.corrected.content.includes('}}')) {
      issues.push('Corrected content contains template markers');
      suggestions.push('Remove or replace template markers with actual content');
      score -= 0.2;
    }
    
    // Check for encoding issues
    if (/[\uFFFD\u0000-\u001F]/.test(correction.corrected.content)) {
      issues.push('Corrected content contains invalid characters');
      suggestions.push('Clean up encoding issues in the corrected text');
      score -= 0.3;
    }
    
    // Generate suggestions based on issues
    if (issues.length === 0) {
      suggestions.push('Correction appears valid');
    }
    
    return {
      validator: 'rule-based',
      score: Math.max(0, score),
      issues,
      suggestions
    };
  }
}