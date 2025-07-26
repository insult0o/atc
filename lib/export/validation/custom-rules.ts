// Task 7: Custom Validation Rules Engine
// Implements custom rule definition and execution framework

import { ExportFormat } from '../schemas/types';

export interface ValidationRule {
  id: string;
  name: string;
  description: string;
  type: 'schema' | 'business' | 'quality' | 'custom';
  applies_to: ExportFormat[];
  priority: number;
  implementation: (data: any) => ValidationRuleResult;
  config: Record<string, any>;
  override_allowed: boolean;
  override_approval_required: boolean;
}

export interface ValidationRuleResult {
  passed: boolean;
  score: number;
  issues: ValidationIssue[];
  metrics: Record<string, number>;
}

export interface ValidationIssue {
  severity: 'critical' | 'error' | 'warning' | 'info';
  path: string;
  message: string;
  context?: Record<string, any>;
  suggestion?: string;
}

export interface RuleExecutionContext {
  format: ExportFormat;
  timestamp: Date;
  documentId?: string;
  metadata?: Record<string, any>;
}

export interface RuleConflict {
  rule1: string;
  rule2: string;
  type: 'contradiction' | 'overlap' | 'dependency';
  resolution: 'priority' | 'merge' | 'skip';
}

export class CustomRulesEngine {
  private rules: Map<string, ValidationRule> = new Map();
  private rulesByFormat: Map<ExportFormat, Set<string>> = new Map();
  private executionOrder: string[] = [];

  constructor(initialRules?: ValidationRule[]) {
    if (initialRules) {
      initialRules.forEach(rule => this.addRule(rule));
    }
    this.initializeBuiltInRules();
  }

  /**
   * Initialize built-in validation rules
   */
  private initializeBuiltInRules(): void {
    // RAG-specific rules
    this.addRule({
      id: 'rag_chunk_size',
      name: 'RAG Chunk Size Validation',
      description: 'Ensures RAG chunks are within optimal size range',
      type: 'quality',
      applies_to: ['rag'],
      priority: 10,
      implementation: (data: any) => {
        const issues: ValidationIssue[] = [];
        const metrics: Record<string, number> = {
          totalChunks: 0,
          oversizedChunks: 0,
          undersizedChunks: 0
        };

        if (data.chunks && Array.isArray(data.chunks)) {
          metrics.totalChunks = data.chunks.length;
          
          data.chunks.forEach((chunk: any, index: number) => {
            const chunkSize = chunk.content?.length || 0;
            
            if (chunkSize > 2000) {
              metrics.oversizedChunks++;
              issues.push({
                severity: 'warning',
                path: `chunks[${index}]`,
                message: `Chunk size (${chunkSize}) exceeds recommended maximum of 2000 characters`,
                suggestion: 'Consider splitting large chunks for better retrieval performance'
              });
            }
            
            if (chunkSize < 100) {
              metrics.undersizedChunks++;
              issues.push({
                severity: 'warning',
                path: `chunks[${index}]`,
                message: `Chunk size (${chunkSize}) below recommended minimum of 100 characters`,
                suggestion: 'Consider merging small chunks to improve context'
              });
            }
          });
        }

        const score = metrics.totalChunks > 0 ? 
          ((metrics.totalChunks - metrics.oversizedChunks - metrics.undersizedChunks) / metrics.totalChunks) * 100 : 0;

        return {
          passed: metrics.oversizedChunks === 0 && metrics.undersizedChunks === 0,
          score,
          issues,
          metrics
        };
      },
      config: {
        minChunkSize: 100,
        maxChunkSize: 2000
      },
      override_allowed: true,
      override_approval_required: false
    });

    // Table completeness rule
    this.addRule({
      id: 'table_completeness',
      name: 'Table Data Completeness',
      description: 'Validates table data completeness and structure',
      type: 'quality',
      applies_to: ['jsonl', 'corrections'],
      priority: 15,
      implementation: (data: any) => {
        const issues: ValidationIssue[] = [];
        const metrics: Record<string, number> = {
          totalTables: 0,
          incompleteTables: 0,
          emptyTables: 0,
          malformedTables: 0
        };

        const checkTable = (table: any, path: string) => {
          if (!table || typeof table !== 'object') {
            metrics.malformedTables++;
            issues.push({
              severity: 'error',
              path,
              message: 'Invalid table structure'
            });
            return;
          }

          if (Array.isArray(table.data) && table.data.length === 0) {
            metrics.emptyTables++;
            issues.push({
              severity: 'warning',
              path,
              message: 'Empty table detected'
            });
          }

          // Check for incomplete rows
          if (Array.isArray(table.data)) {
            const expectedColumns = table.headers?.length || 
              (table.data[0] ? Object.keys(table.data[0]).length : 0);
            
            table.data.forEach((row: any, rowIndex: number) => {
              const columnCount = Array.isArray(row) ? row.length : Object.keys(row).length;
              if (columnCount < expectedColumns) {
                metrics.incompleteTables++;
                issues.push({
                  severity: 'error',
                  path: `${path}.data[${rowIndex}]`,
                  message: `Incomplete row: expected ${expectedColumns} columns, found ${columnCount}`
                });
              }
            });
          }
        };

        // Check tables in different locations
        if (data.tables && Array.isArray(data.tables)) {
          metrics.totalTables = data.tables.length;
          data.tables.forEach((table: any, index: number) => {
            checkTable(table, `tables[${index}]`);
          });
        }

        const score = metrics.totalTables > 0 ?
          ((metrics.totalTables - metrics.incompleteTables - metrics.emptyTables - metrics.malformedTables) / metrics.totalTables) * 100 : 100;

        return {
          passed: metrics.incompleteTables === 0 && metrics.malformedTables === 0,
          score,
          issues,
          metrics
        };
      },
      config: {},
      override_allowed: true,
      override_approval_required: true
    });

    // Confidence threshold rule
    this.addRule({
      id: 'confidence_threshold',
      name: 'Minimum Confidence Threshold',
      description: 'Ensures all extracted content meets minimum confidence requirements',
      type: 'quality',
      applies_to: ['rag', 'jsonl', 'corrections'],
      priority: 20,
      implementation: (data: any) => {
        const issues: ValidationIssue[] = [];
        const metrics: Record<string, number> = {
          totalItems: 0,
          lowConfidenceItems: 0,
          averageConfidence: 0
        };

        const minConfidence = 0.7;
        let confidenceSum = 0;

        const checkConfidence = (item: any, path: string) => {
          if (typeof item.confidence === 'number') {
            metrics.totalItems++;
            confidenceSum += item.confidence;
            
            if (item.confidence < minConfidence) {
              metrics.lowConfidenceItems++;
              issues.push({
                severity: 'warning',
                path,
                message: `Low confidence score: ${item.confidence.toFixed(2)}`,
                context: { threshold: minConfidence, actual: item.confidence },
                suggestion: 'Consider manual review or reprocessing with different parameters'
              });
            }
          }
        };

        // Check various data structures
        if (data.chunks && Array.isArray(data.chunks)) {
          data.chunks.forEach((chunk: any, index: number) => {
            checkConfidence(chunk, `chunks[${index}]`);
          });
        }

        if (data.corrections && Array.isArray(data.corrections)) {
          data.corrections.forEach((correction: any, index: number) => {
            checkConfidence(correction, `corrections[${index}]`);
          });
        }

        metrics.averageConfidence = metrics.totalItems > 0 ? 
          confidenceSum / metrics.totalItems : 1;

        const score = metrics.averageConfidence * 100;

        return {
          passed: metrics.lowConfidenceItems === 0,
          score,
          issues,
          metrics
        };
      },
      config: {
        minConfidence: 0.7
      },
      override_allowed: true,
      override_approval_required: false
    });

    // Data consistency rule
    this.addRule({
      id: 'data_consistency',
      name: 'Cross-Reference Data Consistency',
      description: 'Validates consistency across related data points',
      type: 'business',
      applies_to: ['manifest', 'log'],
      priority: 25,
      implementation: (data: any) => {
        const issues: ValidationIssue[] = [];
        const metrics: Record<string, number> = {
          totalReferences: 0,
          brokenReferences: 0,
          duplicateIds: 0
        };

        const seenIds = new Set<string>();
        const referencedIds = new Set<string>();

        // Check manifest files
        if (data.files && Array.isArray(data.files)) {
          data.files.forEach((file: any, index: number) => {
            if (file.id) {
              if (seenIds.has(file.id)) {
                metrics.duplicateIds++;
                issues.push({
                  severity: 'error',
                  path: `files[${index}].id`,
                  message: `Duplicate file ID: ${file.id}`
                });
              }
              seenIds.add(file.id);
            }

            // Check internal references
            if (file.references && Array.isArray(file.references)) {
              file.references.forEach((ref: string) => {
                metrics.totalReferences++;
                referencedIds.add(ref);
              });
            }
          });
        }

        // Check for broken references
        referencedIds.forEach(refId => {
          if (!seenIds.has(refId)) {
            metrics.brokenReferences++;
            issues.push({
              severity: 'error',
              path: 'references',
              message: `Broken reference to non-existent ID: ${refId}`
            });
          }
        });

        const score = metrics.totalReferences > 0 ?
          ((metrics.totalReferences - metrics.brokenReferences) / metrics.totalReferences) * 100 : 100;

        return {
          passed: metrics.brokenReferences === 0 && metrics.duplicateIds === 0,
          score,
          issues,
          metrics
        };
      },
      config: {},
      override_allowed: false,
      override_approval_required: true
    });
  }

  /**
   * Add a validation rule
   */
  public addRule(rule: ValidationRule): void {
    // Validate rule
    if (!rule.id || !rule.name || !rule.implementation) {
      throw new Error('Invalid rule: missing required fields');
    }

    // Check for conflicts
    const conflicts = this.detectConflicts(rule);
    if (conflicts.length > 0) {
      this.resolveConflicts(rule, conflicts);
    }

    // Add rule
    this.rules.set(rule.id, rule);

    // Update format index
    rule.applies_to.forEach(format => {
      if (!this.rulesByFormat.has(format)) {
        this.rulesByFormat.set(format, new Set());
      }
      this.rulesByFormat.get(format)!.add(rule.id);
    });

    // Update execution order
    this.updateExecutionOrder();
  }

  /**
   * Remove a validation rule
   */
  public removeRule(ruleId: string): boolean {
    const rule = this.rules.get(ruleId);
    if (!rule) return false;

    // Remove from format index
    rule.applies_to.forEach(format => {
      this.rulesByFormat.get(format)?.delete(ruleId);
    });

    // Remove rule
    this.rules.delete(ruleId);

    // Update execution order
    this.updateExecutionOrder();

    return true;
  }

  /**
   * Execute rules for given data and format
   */
  public async executeRules(
    data: any,
    format: ExportFormat,
    context?: Partial<RuleExecutionContext>
  ): Promise<Map<string, ValidationRuleResult>> {
    const results = new Map<string, ValidationRuleResult>();
    const formatRules = this.rulesByFormat.get(format) || new Set();
    
    const executionContext: RuleExecutionContext = {
      format,
      timestamp: new Date(),
      ...context
    };

    // Execute rules in priority order
    for (const ruleId of this.executionOrder) {
      if (formatRules.has(ruleId)) {
        const rule = this.rules.get(ruleId)!;
        
        try {
          const result = await this.executeRule(rule, data, executionContext);
          results.set(ruleId, result);
        } catch (error) {
          // Handle rule execution errors
          results.set(ruleId, {
            passed: false,
            score: 0,
            issues: [{
              severity: 'critical',
              path: '',
              message: `Rule execution failed: ${error}`,
              context: { error: error instanceof Error ? error.message : String(error) }
            }],
            metrics: {}
          });
        }
      }
    }

    return results;
  }

  /**
   * Execute a single rule
   */
  private async executeRule(
    rule: ValidationRule,
    data: any,
    context: RuleExecutionContext
  ): Promise<ValidationRuleResult> {
    // Prepare data with context
    const enrichedData = {
      ...data,
      _context: context,
      _config: rule.config
    };

    // Execute rule
    const result = rule.implementation(enrichedData);

    // Validate result
    if (!this.isValidResult(result)) {
      throw new Error('Invalid rule result structure');
    }

    return result;
  }

  /**
   * Detect rule conflicts
   */
  private detectConflicts(newRule: ValidationRule): RuleConflict[] {
    const conflicts: RuleConflict[] = [];

    this.rules.forEach((existingRule, ruleId) => {
      // Check for overlapping formats
      const overlappingFormats = newRule.applies_to.filter(format => 
        existingRule.applies_to.includes(format)
      );

      if (overlappingFormats.length > 0) {
        // Check for same type and similar priority
        if (existingRule.type === newRule.type && 
            Math.abs(existingRule.priority - newRule.priority) < 5) {
          conflicts.push({
            rule1: existingRule.id,
            rule2: newRule.id,
            type: 'overlap',
            resolution: 'priority'
          });
        }

        // Check for contradictory rules
        if (this.areRulesContradictory(existingRule, newRule)) {
          conflicts.push({
            rule1: existingRule.id,
            rule2: newRule.id,
            type: 'contradiction',
            resolution: 'skip'
          });
        }
      }
    });

    return conflicts;
  }

  /**
   * Check if rules are contradictory
   */
  private areRulesContradictory(rule1: ValidationRule, rule2: ValidationRule): boolean {
    // Simplified contradiction detection
    // In practice, this would be more sophisticated
    if (rule1.id.includes('min') && rule2.id.includes('max')) {
      const field1 = rule1.id.replace('min_', '').replace('max_', '');
      const field2 = rule2.id.replace('min_', '').replace('max_', '');
      return field1 === field2;
    }
    return false;
  }

  /**
   * Resolve rule conflicts
   */
  private resolveConflicts(newRule: ValidationRule, conflicts: RuleConflict[]): void {
    conflicts.forEach(conflict => {
      switch (conflict.resolution) {
        case 'priority':
          // Adjust priority to avoid overlap
          const existingRule = this.rules.get(conflict.rule1);
          if (existingRule && existingRule.priority === newRule.priority) {
            newRule.priority = existingRule.priority + 1;
          }
          break;
        
        case 'merge':
          // Would implement rule merging logic
          console.warn(`Rule conflict detected: ${conflict.rule1} vs ${conflict.rule2}`);
          break;
        
        case 'skip':
          throw new Error(`Cannot add rule ${newRule.id}: conflicts with ${conflict.rule1}`);
      }
    });
  }

  /**
   * Update rule execution order based on priority
   */
  private updateExecutionOrder(): void {
    this.executionOrder = Array.from(this.rules.keys()).sort((a, b) => {
      const ruleA = this.rules.get(a)!;
      const ruleB = this.rules.get(b)!;
      return ruleA.priority - ruleB.priority;
    });
  }

  /**
   * Validate rule result structure
   */
  private isValidResult(result: any): result is ValidationRuleResult {
    return (
      typeof result === 'object' &&
      typeof result.passed === 'boolean' &&
      typeof result.score === 'number' &&
      Array.isArray(result.issues) &&
      typeof result.metrics === 'object'
    );
  }

  /**
   * Get rule by ID
   */
  public getRule(ruleId: string): ValidationRule | undefined {
    return this.rules.get(ruleId);
  }

  /**
   * Get all rules
   */
  public getAllRules(): ValidationRule[] {
    return Array.from(this.rules.values());
  }

  /**
   * Get rules for format
   */
  public getRulesForFormat(format: ExportFormat): ValidationRule[] {
    const ruleIds = this.rulesByFormat.get(format) || new Set();
    return Array.from(ruleIds).map(id => this.rules.get(id)!).filter(Boolean);
  }

  /**
   * Create rule from configuration
   */
  public createRuleFromConfig(config: {
    id: string;
    name: string;
    description: string;
    type: ValidationRule['type'];
    applies_to: ExportFormat[];
    priority: number;
    config: Record<string, any>;
    validations: Array<{
      field: string;
      operator: 'equals' | 'contains' | 'gt' | 'lt' | 'regex' | 'exists';
      value?: any;
      severity: ValidationIssue['severity'];
      message: string;
    }>;
  }): ValidationRule {
    return {
      ...config,
      implementation: (data: any) => {
        const issues: ValidationIssue[] = [];
        const metrics: Record<string, number> = {
          totalChecks: config.validations.length,
          passedChecks: 0
        };

        config.validations.forEach(validation => {
          const fieldValue = this.getFieldValue(data, validation.field);
          const passed = this.evaluateCondition(
            fieldValue,
            validation.operator,
            validation.value
          );

          if (passed) {
            metrics.passedChecks++;
          } else {
            issues.push({
              severity: validation.severity,
              path: validation.field,
              message: validation.message,
              context: {
                expected: validation.value,
                actual: fieldValue,
                operator: validation.operator
              }
            });
          }
        });

        const score = (metrics.passedChecks / metrics.totalChecks) * 100;

        return {
          passed: metrics.passedChecks === metrics.totalChecks,
          score,
          issues,
          metrics
        };
      },
      override_allowed: true,
      override_approval_required: false
    };
  }

  /**
   * Get field value from nested object
   */
  private getFieldValue(data: any, path: string): any {
    const parts = path.split('.');
    let value = data;
    
    for (const part of parts) {
      if (value === null || value === undefined) {
        return undefined;
      }
      
      // Handle array indices
      const arrayMatch = part.match(/^(\w+)\[(\d+)\]$/);
      if (arrayMatch) {
        value = value[arrayMatch[1]];
        if (Array.isArray(value)) {
          value = value[parseInt(arrayMatch[2])];
        }
      } else {
        value = value[part];
      }
    }
    
    return value;
  }

  /**
   * Evaluate condition
   */
  private evaluateCondition(value: any, operator: string, expected: any): boolean {
    switch (operator) {
      case 'equals':
        return value === expected;
      case 'contains':
        return String(value).includes(String(expected));
      case 'gt':
        return Number(value) > Number(expected);
      case 'lt':
        return Number(value) < Number(expected);
      case 'regex':
        return new RegExp(expected).test(String(value));
      case 'exists':
        return value !== null && value !== undefined;
      default:
        return false;
    }
  }

  /**
   * Export rules configuration
   */
  public exportRules(): string {
    const rulesConfig = Array.from(this.rules.values()).map(rule => ({
      id: rule.id,
      name: rule.name,
      description: rule.description,
      type: rule.type,
      applies_to: rule.applies_to,
      priority: rule.priority,
      config: rule.config,
      override_allowed: rule.override_allowed,
      override_approval_required: rule.override_approval_required
    }));

    return JSON.stringify(rulesConfig, null, 2);
  }

  /**
   * Import rules configuration
   */
  public importRules(configJson: string): void {
    const rulesConfig = JSON.parse(configJson);
    
    if (!Array.isArray(rulesConfig)) {
      throw new Error('Invalid rules configuration format');
    }

    rulesConfig.forEach(config => {
      // Note: Implementation functions need to be recreated
      // This is a limitation of JSON serialization
      console.warn(`Rule ${config.id} imported without implementation - needs to be defined`);
    });
  }
}

// Export singleton instance
export const customRulesEngine = new CustomRulesEngine();