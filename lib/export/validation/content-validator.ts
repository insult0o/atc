// Task 4: Content Format Validator
// Validates text formatting, table structure, and content patterns

import { Zone } from '../../types/zone';

export interface ContentValidationPatterns {
  text: {
    minLength: number;
    maxLength: number;
    encoding: 'utf-8' | 'ascii';
    allowedCharacters: RegExp;
    paragraphStructure: RegExp;
  };
  table: {
    minRows: number;
    minColumns: number;
    headerRequired: boolean;
    cellContentPattern: RegExp;
    consistencyChecks: boolean;
  };
  numeric: {
    format: RegExp;
    range?: { min: number; max: number };
    precision?: number;
  };
}

export interface ContentValidationResult {
  valid: boolean;
  score: number;
  issues: ContentIssue[];
  statistics: ContentStatistics;
  suggestions: string[];
}

export interface ContentIssue {
  type: 'encoding' | 'format' | 'structure' | 'consistency' | 'length' | 'pattern';
  severity: 'error' | 'warning';
  location: {
    zoneId?: string;
    line?: number;
    column?: number;
    path?: string;
  };
  message: string;
  expected?: any;
  actual?: any;
}

export interface ContentStatistics {
  totalCharacters: number;
  totalWords: number;
  totalLines: number;
  averageLineLength: number;
  languageDetected?: string;
  encodingDetected: string;
  specialCharacterCount: number;
  numericValueCount: number;
  tableCount: number;
  malformedSections: number;
}

export interface ContentValidationDetails {
  textValidation: {
    validCount: number;
    invalidCount: number;
    encodingErrors: number;
    truncatedSections: number;
  };
  tableValidation: {
    validTables: number;
    invalidTables: number;
    structuralIssues: string[];
  };
  patternMatches: {
    expectedPatterns: number;
    matchedPatterns: number;
    missingPatterns: string[];
  };
  qualityMetrics: {
    readability: number; // 0-100
    completeness: number; // 0-100
    consistency: number; // 0-100
  };
}

interface TableStructure {
  rows: string[][];
  headers?: string[];
  columnCount: number;
  rowCount: number;
}

export class ContentValidator {
  private config: ContentValidationPatterns;

  constructor(config?: Partial<ContentValidationPatterns>) {
    this.config = {
      text: {
        minLength: 1,
        maxLength: 1000000, // 1MB of text
        encoding: 'utf-8',
        allowedCharacters: /^[\x00-\x7F\u0080-\uFFFF]*$/, // ASCII + Unicode
        paragraphStructure: /^.+(\n\n.+)*$/
      },
      table: {
        minRows: 1,
        minColumns: 2,
        headerRequired: true,
        cellContentPattern: /^[^\n\r]*$/,
        consistencyChecks: true
      },
      numeric: {
        format: /^-?\d+(\.\d+)?$/,
        range: { min: -999999999, max: 999999999 },
        precision: 6
      },
      ...config
    };
  }

  /**
   * Validate content format
   */
  public async validate(
    zones: Zone[],
    extractedContent: Map<string, any>
  ): Promise<ContentValidationResult> {
    const issues: ContentIssue[] = [];
    const statistics = this.collectStatistics(zones, extractedContent);
    
    // Validate text content
    const textIssues = this.validateTextContent(zones, extractedContent);
    issues.push(...textIssues);

    // Validate table structures
    const tableIssues = this.validateTableContent(zones, extractedContent);
    issues.push(...tableIssues);

    // Validate numeric formats
    const numericIssues = this.validateNumericContent(extractedContent);
    issues.push(...numericIssues);

    // Validate content patterns
    const patternIssues = this.validateContentPatterns(extractedContent);
    issues.push(...patternIssues);

    // Calculate validation score
    const score = this.calculateValidationScore(issues, statistics);

    // Generate suggestions
    const suggestions = this.generateSuggestions(issues, statistics);

    return {
      valid: issues.filter(i => i.severity === 'error').length === 0,
      score,
      issues,
      statistics,
      suggestions
    };
  }

  /**
   * Collect content statistics
   */
  private collectStatistics(
    zones: Zone[],
    extractedContent: Map<string, any>
  ): ContentStatistics {
    let totalCharacters = 0;
    let totalWords = 0;
    let totalLines = 0;
    let specialCharacterCount = 0;
    let numericValueCount = 0;
    let tableCount = 0;
    let malformedSections = 0;

    zones.forEach(zone => {
      if (zone.textContent) {
        totalCharacters += zone.textContent.length;
        totalWords += zone.textContent.split(/\s+/).filter(w => w.length > 0).length;
        totalLines += zone.textContent.split('\n').length;
        
        // Count special characters
        const specialChars = zone.textContent.match(/[^\w\s]/g);
        specialCharacterCount += specialChars ? specialChars.length : 0;
        
        // Count numeric values
        const numbers = zone.textContent.match(/\d+(\.\d+)?/g);
        numericValueCount += numbers ? numbers.length : 0;
      }

      if (zone.type === 'table') {
        tableCount++;
      }
    });

    const averageLineLength = totalLines > 0 ? totalCharacters / totalLines : 0;

    // Detect encoding (simplified)
    const hasUnicode = Array.from(extractedContent.values()).some(content => {
      if (typeof content === 'string') {
        return /[^\x00-\x7F]/.test(content);
      }
      return false;
    });

    return {
      totalCharacters,
      totalWords,
      totalLines,
      averageLineLength,
      encodingDetected: hasUnicode ? 'utf-8' : 'ascii',
      specialCharacterCount,
      numericValueCount,
      tableCount,
      malformedSections
    };
  }

  /**
   * Validate text content
   */
  private validateTextContent(
    zones: Zone[],
    extractedContent: Map<string, any>
  ): ContentIssue[] {
    const issues: ContentIssue[] = [];

    zones.forEach(zone => {
      if (zone.type === 'text' && zone.textContent) {
        // Check length constraints
        if (zone.textContent.length < this.config.text.minLength) {
          issues.push({
            type: 'length',
            severity: 'warning',
            location: { zoneId: zone.id },
            message: `Text content too short (${zone.textContent.length} chars)`,
            expected: this.config.text.minLength,
            actual: zone.textContent.length
          });
        }

        if (zone.textContent.length > this.config.text.maxLength) {
          issues.push({
            type: 'length',
            severity: 'error',
            location: { zoneId: zone.id },
            message: `Text content exceeds maximum length`,
            expected: this.config.text.maxLength,
            actual: zone.textContent.length
          });
        }

        // Check character encoding
        if (!this.config.text.allowedCharacters.test(zone.textContent)) {
          issues.push({
            type: 'encoding',
            severity: 'error',
            location: { zoneId: zone.id },
            message: 'Invalid characters detected in text content'
          });
        }

        // Check for common encoding issues
        const encodingIssues = this.detectEncodingIssues(zone.textContent);
        issues.push(...encodingIssues.map(issue => ({
          type: 'encoding' as const,
          severity: 'warning' as const,
          location: { zoneId: zone.id },
          message: issue
        })));
      }
    });

    return issues;
  }

  /**
   * Validate table content
   */
  private validateTableContent(
    zones: Zone[],
    extractedContent: Map<string, any>
  ): ContentIssue[] {
    const issues: ContentIssue[] = [];

    zones.forEach(zone => {
      if (zone.type === 'table') {
        const tableData = extractedContent.get(`table_${zone.id}`);
        if (tableData) {
          const table = this.parseTableStructure(tableData);
          
          // Check minimum dimensions
          if (table.rowCount < this.config.table.minRows) {
            issues.push({
              type: 'structure',
              severity: 'warning',
              location: { zoneId: zone.id },
              message: `Table has too few rows (${table.rowCount})`,
              expected: this.config.table.minRows,
              actual: table.rowCount
            });
          }

          if (table.columnCount < this.config.table.minColumns) {
            issues.push({
              type: 'structure',
              severity: 'warning',
              location: { zoneId: zone.id },
              message: `Table has too few columns (${table.columnCount})`,
              expected: this.config.table.minColumns,
              actual: table.columnCount
            });
          }

          // Check header requirement
          if (this.config.table.headerRequired && !table.headers) {
            issues.push({
              type: 'structure',
              severity: 'error',
              location: { zoneId: zone.id },
              message: 'Table missing required headers'
            });
          }

          // Check consistency
          if (this.config.table.consistencyChecks) {
            const consistencyIssues = this.checkTableConsistency(table, zone.id);
            issues.push(...consistencyIssues);
          }
        }
      }
    });

    return issues;
  }

  /**
   * Validate numeric content
   */
  private validateNumericContent(extractedContent: Map<string, any>): ContentIssue[] {
    const issues: ContentIssue[] = [];

    extractedContent.forEach((content, key) => {
      if (typeof content === 'string') {
        // Find all numeric values
        const numericMatches = content.match(/-?\d+(\.\d+)?/g) || [];
        
        numericMatches.forEach(match => {
          const num = parseFloat(match);
          
          // Check format
          if (!this.config.numeric.format.test(match)) {
            issues.push({
              type: 'format',
              severity: 'warning',
              location: { path: key },
              message: `Invalid numeric format: ${match}`
            });
          }

          // Check range
          if (this.config.numeric.range) {
            if (num < this.config.numeric.range.min || num > this.config.numeric.range.max) {
              issues.push({
                type: 'pattern',
                severity: 'warning',
                location: { path: key },
                message: `Numeric value out of range: ${num}`,
                expected: this.config.numeric.range,
                actual: num
              });
            }
          }

          // Check precision
          if (this.config.numeric.precision !== undefined) {
            const decimalPlaces = (match.split('.')[1] || '').length;
            if (decimalPlaces > this.config.numeric.precision) {
              issues.push({
                type: 'format',
                severity: 'warning',
                location: { path: key },
                message: `Numeric precision exceeds limit: ${decimalPlaces} decimal places`,
                expected: this.config.numeric.precision,
                actual: decimalPlaces
              });
            }
          }
        });
      }
    });

    return issues;
  }

  /**
   * Validate content patterns
   */
  private validateContentPatterns(extractedContent: Map<string, any>): ContentIssue[] {
    const issues: ContentIssue[] = [];

    // Check for expected patterns (dates, emails, URLs, etc.)
    const patterns = {
      date: /\d{4}-\d{2}-\d{2}/g,
      email: /[\w.-]+@[\w.-]+\.\w+/g,
      url: /https?:\/\/[^\s]+/g,
      phone: /[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{4,6}/g
    };

    extractedContent.forEach((content, key) => {
      if (typeof content === 'string') {
        // Check for malformed URLs
        const urls = content.match(patterns.url) || [];
        urls.forEach(url => {
          try {
            new URL(url);
          } catch {
            issues.push({
              type: 'pattern',
              severity: 'warning',
              location: { path: key },
              message: `Malformed URL detected: ${url}`
            });
          }
        });

        // Check for malformed emails
        const emails = content.match(patterns.email) || [];
        emails.forEach(email => {
          if (!this.isValidEmail(email)) {
            issues.push({
              type: 'pattern',
              severity: 'warning',
              location: { path: key },
              message: `Invalid email format: ${email}`
            });
          }
        });
      }
    });

    return issues;
  }

  /**
   * Parse table structure from data
   */
  private parseTableStructure(tableData: any): TableStructure {
    if (Array.isArray(tableData)) {
      const headers = tableData[0] && typeof tableData[0] === 'object' ? 
                     Object.keys(tableData[0]) : undefined;
      
      return {
        rows: tableData.map(row => 
          Array.isArray(row) ? row : Object.values(row)
        ),
        headers,
        columnCount: headers ? headers.length : 
                    (tableData[0] ? Object.keys(tableData[0]).length : 0),
        rowCount: tableData.length
      };
    }

    return {
      rows: [],
      columnCount: 0,
      rowCount: 0
    };
  }

  /**
   * Check table consistency
   */
  private checkTableConsistency(table: TableStructure, zoneId: string): ContentIssue[] {
    const issues: ContentIssue[] = [];

    // Check column count consistency
    const columnCounts = table.rows.map(row => row.length);
    const uniqueCounts = [...new Set(columnCounts)];
    
    if (uniqueCounts.length > 1) {
      issues.push({
        type: 'consistency',
        severity: 'error',
        location: { zoneId },
        message: 'Inconsistent column count across table rows',
        expected: table.columnCount,
        actual: uniqueCounts
      });
    }

    // Check for empty cells
    let emptyCells = 0;
    table.rows.forEach((row, rowIndex) => {
      row.forEach((cell, colIndex) => {
        if (!cell || cell.toString().trim() === '') {
          emptyCells++;
        }
      });
    });

    if (emptyCells > table.rows.length * table.columnCount * 0.2) {
      issues.push({
        type: 'consistency',
        severity: 'warning',
        location: { zoneId },
        message: `High number of empty cells in table (${emptyCells})`
      });
    }

    return issues;
  }

  /**
   * Detect common encoding issues
   */
  private detectEncodingIssues(text: string): string[] {
    const issues: string[] = [];

    // Check for replacement characters
    if (text.includes('\ufffd')) {
      issues.push('Replacement characters detected (possible encoding error)');
    }

    // Check for mojibake patterns
    if (/[ÃƒÂ¢â‚¬â„¢]+/.test(text)) {
      issues.push('Possible character encoding corruption detected');
    }

    // Check for control characters
    if (/[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(text)) {
      issues.push('Control characters detected in text');
    }

    return issues;
  }

  /**
   * Validate email format
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Calculate validation score
   */
  private calculateValidationScore(
    issues: ContentIssue[],
    statistics: ContentStatistics
  ): number {
    let score = 100;

    // Deduct points for issues
    issues.forEach(issue => {
      if (issue.severity === 'error') {
        score -= 10;
      } else {
        score -= 2;
      }
    });

    // Bonus for good statistics
    if (statistics.malformedSections === 0) {
      score += 5;
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Generate suggestions
   */
  private generateSuggestions(
    issues: ContentIssue[],
    statistics: ContentStatistics
  ): string[] {
    const suggestions: string[] = [];

    // Encoding suggestions
    const encodingIssues = issues.filter(i => i.type === 'encoding');
    if (encodingIssues.length > 0) {
      suggestions.push('Review character encoding settings for text extraction');
    }

    // Table suggestions
    const tableIssues = issues.filter(i => i.type === 'structure');
    if (tableIssues.length > 0) {
      suggestions.push('Consider reviewing table extraction parameters');
    }

    // Content suggestions
    if (statistics.malformedSections > 0) {
      suggestions.push('Some content sections appear malformed - manual review recommended');
    }

    return suggestions;
  }

  /**
   * Get detailed validation information
   */
  public getDetails(
    issues: ContentIssue[],
    statistics: ContentStatistics
  ): ContentValidationDetails {
    const textIssues = issues.filter(i => 
      i.type === 'encoding' || i.type === 'length'
    );
    
    const tableIssues = issues.filter(i => 
      i.type === 'structure' || i.type === 'consistency'
    );

    return {
      textValidation: {
        validCount: statistics.totalCharacters > 0 ? 1 : 0,
        invalidCount: textIssues.filter(i => i.severity === 'error').length,
        encodingErrors: textIssues.filter(i => i.type === 'encoding').length,
        truncatedSections: textIssues.filter(i => 
          i.type === 'length' && i.message.includes('exceeds')
        ).length
      },
      tableValidation: {
        validTables: statistics.tableCount - tableIssues.length,
        invalidTables: tableIssues.length,
        structuralIssues: [...new Set(tableIssues.map(i => i.message))]
      },
      patternMatches: {
        expectedPatterns: 4, // date, email, url, phone
        matchedPatterns: 0, // Would need to track this
        missingPatterns: []
      },
      qualityMetrics: {
        readability: this.calculateReadability(statistics),
        completeness: 100 - (issues.length * 2),
        consistency: 100 - (issues.filter(i => i.type === 'consistency').length * 10)
      }
    };
  }

  /**
   * Calculate readability score
   */
  private calculateReadability(statistics: ContentStatistics): number {
    // Simple readability heuristic
    const avgWordLength = statistics.totalCharacters / statistics.totalWords;
    const avgWordsPerLine = statistics.totalWords / statistics.totalLines;
    
    // Ideal ranges
    const idealWordLength = 5;
    const idealWordsPerLine = 10;
    
    const wordLengthScore = 100 - Math.abs(avgWordLength - idealWordLength) * 10;
    const lineScore = 100 - Math.abs(avgWordsPerLine - idealWordsPerLine) * 2;
    
    return Math.max(0, Math.min(100, (wordLengthScore + lineScore) / 2));
  }
}

// Export singleton instance
export const contentValidator = new ContentValidator();