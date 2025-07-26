// Task 6: Validation Orchestrator
// Coordinates all validators and makes blocking decisions

import { ExportFormat } from '../schemas/types';
import { Zone } from '../../types/zone';
import { PDFDocument } from '../../types/pdf';
import { SchemaValidator, SchemaValidationResult } from './schema-validator';
import { ZoneValidator, ZoneValidationResult } from './zone-validator';
import { ErrorValidator, ErrorValidationResult, ErrorDetail } from './error-validator';
import { ContentValidator, ContentValidationResult } from './content-validator';
import { MetadataValidator, MetadataValidationResult } from './metadata-validator';
import { ValidationRule, ValidationRuleResult, CustomRulesEngine } from './custom-rules';

export interface ValidationResult {
  valid: boolean;
  score: number;                    // 0-100 quality score
  errors: ValidationError[];
  warnings: ValidationWarning[];
  blockers: BlockingIssue[];
  report: ValidationReport;
}

export interface ValidationError {
  code: string;
  severity: 'error' | 'critical';
  location: string;
  message: string;
  context: any;
  suggestion?: string;
}

export interface ValidationWarning {
  code: string;
  location: string;
  message: string;
  suggestion?: string;
}

export interface BlockingIssue {
  type: 'schema' | 'completeness' | 'error' | 'content' | 'metadata' | 'custom';
  reason: string;
  affectedItems: string[];
  canOverride: boolean;
  overrideRequirements?: string[];
}

export interface ValidationReport {
  summary: {
    overallStatus: 'passed' | 'failed' | 'passed_with_warnings';
    score: number;
    totalItems: number;
    validItems: number;
    invalidItems: number;
    warningCount: number;
  };
  details: {
    schemaValidation: SchemaValidationDetails;
    zoneCompleteness: ZoneCompletenessDetails;
    errorAnalysis: ErrorAnalysisDetails;
    contentValidation: ContentValidationDetails;
    metadataValidation: MetadataValidationDetails;
    customRules: CustomRulesDetails;
  };
  recommendations: string[];
  timestamp: string;
  validatorVersion: string;
}

export interface BlockingDecision {
  shouldBlock: boolean;
  reasons: BlockingReason[];
  overridable: boolean;
  overrideProcess: {
    approvalRequired: boolean;
    approverRoles: string[];
    justificationRequired: boolean;
    auditLog: boolean;
  };
  recommendations: string[];
}

export interface BlockingReason {
  validator: string;
  issue: string;
  severity: 'critical' | 'high' | 'medium';
  details: any;
}

interface SchemaValidationDetails {
  totalChecked: number;
  passedCount: number;
  failedCount: number;
  errorsByType: Map<string, number>;
  commonErrors: string[];
  performanceMs: number;
}

interface ZoneCompletenessDetails {
  totalZones: number;
  processedZones: number;
  failedZones: number;
  pendingZones: number;
  coveragePercentage: number;
  zoneTypeDistribution: Map<string, number>;
  processingDuration: number;
  qualityScore: number;
}

interface ErrorAnalysisDetails {
  totalErrors: number;
  criticalErrors: number;
  errorsByComponent: Map<string, number>;
  errorsByType: Map<string, number>;
  timelineAnalysis: {
    firstError: Date | null;
    lastError: Date | null;
    errorFrequency: number;
  };
  impactAssessment: {
    affectedZones: number;
    dataLossRisk: 'high' | 'medium' | 'low' | 'none';
    processingImpact: 'complete_failure' | 'partial_failure' | 'minimal';
  };
}

interface ContentValidationDetails {
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
    readability: number;
    completeness: number;
    consistency: number;
  };
}

interface MetadataValidationDetails {
  totalFields: number;
  requiredFields: number;
  presentFields: number;
  missingFields: number;
  invalidFields: number;
  completenessPercentage: number;
  qualityScore: number;
  fieldCoverage: Map<string, boolean>;
}

interface CustomRulesDetails {
  totalRules: number;
  passedRules: number;
  failedRules: number;
  ruleResults: Map<string, ValidationRuleResult>;
}

export interface ValidationConfig {
  enabledValidators: {
    schema: boolean;
    zones: boolean;
    errors: boolean;
    content: boolean;
    metadata: boolean;
    customRules: boolean;
  };
  blockingThresholds: {
    minScore: number;
    maxErrors: number;
    maxCriticalErrors: number;
  };
  customRules?: ValidationRule[];
}

export class ValidationOrchestrator {
  private schemaValidator: SchemaValidator;
  private zoneValidator: ZoneValidator;
  private errorValidator: ErrorValidator;
  private contentValidator: ContentValidator;
  private metadataValidator: MetadataValidator;
  private customRulesEngine: CustomRulesEngine;
  private config: ValidationConfig;

  constructor(config?: Partial<ValidationConfig>) {
    this.config = {
      enabledValidators: {
        schema: true,
        zones: true,
        errors: true,
        content: true,
        metadata: true,
        customRules: true
      },
      blockingThresholds: {
        minScore: 70,
        maxErrors: 10,
        maxCriticalErrors: 0
      },
      ...config
    };

    // Initialize validators
    this.schemaValidator = new SchemaValidator();
    this.zoneValidator = new ZoneValidator();
    this.errorValidator = new ErrorValidator();
    this.contentValidator = new ContentValidator();
    this.metadataValidator = new MetadataValidator();
    this.customRulesEngine = new CustomRulesEngine(this.config.customRules);
  }

  /**
   * Orchestrate validation pipeline
   */
  public async validate(
    format: ExportFormat,
    exportData: any,
    document: PDFDocument,
    zones: Zone[],
    metadata: Record<string, any>,
    processingErrors: ErrorDetail[] = []
  ): Promise<ValidationResult> {
    const startTime = Date.now();
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const blockers: BlockingIssue[] = [];
    
    const validationResults: Record<string, any> = {};

    // 1. Schema Validation
    if (this.config.enabledValidators.schema) {
      const schemaResult = await this.validateSchema(format, exportData);
      validationResults.schema = schemaResult;
      this.processSchemaResults(schemaResult, errors, warnings, blockers);
    }

    // 2. Zone Completeness
    if (this.config.enabledValidators.zones) {
      const zoneResult = await this.validateZones(document, zones);
      validationResults.zones = zoneResult;
      this.processZoneResults(zoneResult, errors, warnings, blockers);
    }

    // 3. Error State Verification
    if (this.config.enabledValidators.errors) {
      const errorResult = await this.validateErrors(document, zones, processingErrors);
      validationResults.errors = errorResult;
      this.processErrorResults(errorResult, errors, warnings, blockers);
    }

    // 4. Content Format Validation
    if (this.config.enabledValidators.content) {
      const contentResult = await this.validateContent(zones, exportData);
      validationResults.content = contentResult;
      this.processContentResults(contentResult, errors, warnings, blockers);
    }

    // 5. Metadata Validation
    if (this.config.enabledValidators.metadata) {
      const metadataResult = await this.validateMetadata(format, metadata, document);
      validationResults.metadata = metadataResult;
      this.processMetadataResults(metadataResult, errors, warnings, blockers);
    }

    // 6. Custom Rules
    if (this.config.enabledValidators.customRules) {
      const customResult = await this.validateCustomRules(format, exportData, metadata);
      validationResults.custom = customResult;
      this.processCustomResults(customResult, errors, warnings, blockers);
    }

    // Calculate overall score
    const score = this.calculateOverallScore(validationResults);

    // Make blocking decision
    const blockingDecision = this.makeBlockingDecision(errors, warnings, blockers, score);
    
    // Generate report
    const report = this.generateReport(
      validationResults,
      errors,
      warnings,
      score,
      exportData,
      Date.now() - startTime
    );

    return {
      valid: !blockingDecision.shouldBlock,
      score,
      errors,
      warnings,
      blockers,
      report
    };
  }

  /**
   * Validate schema
   */
  private async validateSchema(
    format: ExportFormat,
    exportData: any
  ): Promise<SchemaValidationResult> {
    return await this.schemaValidator.validate(format, exportData);
  }

  /**
   * Validate zones
   */
  private async validateZones(
    document: PDFDocument,
    zones: Zone[]
  ): Promise<ZoneValidationResult> {
    return await this.zoneValidator.validate(document, zones);
  }

  /**
   * Validate errors
   */
  private async validateErrors(
    document: PDFDocument,
    zones: Zone[],
    processingErrors: ErrorDetail[]
  ): Promise<ErrorValidationResult> {
    return await this.errorValidator.validate(document, zones, processingErrors);
  }

  /**
   * Validate content
   */
  private async validateContent(
    zones: Zone[],
    exportData: any
  ): Promise<ContentValidationResult> {
    const extractedContent = new Map<string, any>();
    
    // Extract content from export data
    if (exportData.chunks) {
      exportData.chunks.forEach((chunk: any, index: number) => {
        extractedContent.set(`chunk_${index}`, chunk.content);
      });
    }
    
    if (exportData.tables) {
      exportData.tables.forEach((table: any, index: number) => {
        extractedContent.set(`table_${index}`, table);
      });
    }

    return await this.contentValidator.validate(zones, extractedContent);
  }

  /**
   * Validate metadata
   */
  private async validateMetadata(
    format: ExportFormat,
    metadata: Record<string, any>,
    document: PDFDocument
  ): Promise<MetadataValidationResult> {
    const documentContext = {
      pageCount: document.pages.length,
      tableCount: 0, // Would need to count from zones
      imageCount: 0  // Would need to count from zones
    };

    return await this.metadataValidator.validate(format, metadata, documentContext);
  }

  /**
   * Validate custom rules
   */
  private async validateCustomRules(
    format: ExportFormat,
    exportData: any,
    metadata: Record<string, any>
  ): Promise<Map<string, ValidationRuleResult>> {
    const data = { ...exportData, metadata };
    return await this.customRulesEngine.executeRules(data, format);
  }

  /**
   * Process schema validation results
   */
  private processSchemaResults(
    result: SchemaValidationResult,
    errors: ValidationError[],
    warnings: ValidationWarning[],
    blockers: BlockingIssue[]
  ): void {
    if (!result.valid) {
      result.errors.forEach(error => {
        errors.push({
          code: `schema.${error.keyword}`,
          severity: 'error',
          location: error.path || 'root',
          message: error.message,
          context: error.params,
          suggestion: this.getSuggestionForSchemaError(error)
        });
      });

      blockers.push({
        type: 'schema',
        reason: 'Schema validation failed',
        affectedItems: result.errors.map(e => e.path),
        canOverride: false
      });
    }
  }

  /**
   * Process zone validation results
   */
  private processZoneResults(
    result: ZoneValidationResult,
    errors: ValidationError[],
    warnings: ValidationWarning[],
    blockers: BlockingIssue[]
  ): void {
    if (!result.valid) {
      if (result.missingZoneTypes.length > 0) {
        errors.push({
          code: 'zone.missing_types',
          severity: 'error',
          location: 'zones',
          message: `Missing required zone types: ${result.missingZoneTypes.join(', ')}`,
          context: { missingTypes: result.missingZoneTypes }
        });
      }

      if (result.processedPercentage < 95) {
        blockers.push({
          type: 'completeness',
          reason: `Only ${result.processedPercentage.toFixed(1)}% of zones processed`,
          affectedItems: result.failedZones.map(z => z.zoneId),
          canOverride: true,
          overrideRequirements: ['supervisor_approval', 'justification']
        });
      }
    }

    result.recommendations.forEach(rec => {
      warnings.push({
        code: 'zone.recommendation',
        location: 'zones',
        message: rec
      });
    });
  }

  /**
   * Process error validation results
   */
  private processErrorResults(
    result: ErrorValidationResult,
    errors: ValidationError[],
    warnings: ValidationWarning[],
    blockers: BlockingIssue[]
  ): void {
    if (!result.valid) {
      if (result.errorCount.critical > 0) {
        errors.push({
          code: 'error.critical',
          severity: 'critical',
          location: 'processing',
          message: `${result.errorCount.critical} critical errors detected`,
          context: { criticalErrors: result.blockingErrors }
        });

        blockers.push({
          type: 'error',
          reason: 'Critical errors present',
          affectedItems: result.blockingErrors.map(e => e.id),
          canOverride: false
        });
      }

      if (result.errorRate > 5) {
        warnings.push({
          code: 'error.high_rate',
          location: 'processing',
          message: `High error rate: ${result.errorRate.toFixed(1)}%`,
          suggestion: 'Review processing configuration and retry'
        });
      }
    }
  }

  /**
   * Process content validation results
   */
  private processContentResults(
    result: ContentValidationResult,
    errors: ValidationError[],
    warnings: ValidationWarning[],
    blockers: BlockingIssue[]
  ): void {
    const errorIssues = result.issues.filter(i => i.severity === 'error');
    const warningIssues = result.issues.filter(i => i.severity === 'warning');

    errorIssues.forEach(issue => {
      errors.push({
        code: `content.${issue.type}`,
        severity: 'error',
        location: issue.location.path || issue.location.zoneId || 'unknown',
        message: issue.message,
        context: { expected: issue.expected, actual: issue.actual }
      });
    });

    warningIssues.forEach(issue => {
      warnings.push({
        code: `content.${issue.type}`,
        location: issue.location.path || issue.location.zoneId || 'unknown',
        message: issue.message
      });
    });

    if (errorIssues.length > 0) {
      blockers.push({
        type: 'content',
        reason: 'Content format validation failed',
        affectedItems: errorIssues.map(i => 
          i.location.zoneId || i.location.path || 'unknown'
        ),
        canOverride: true,
        overrideRequirements: ['manual_review', 'data_team_approval']
      });
    }
  }

  /**
   * Process metadata validation results
   */
  private processMetadataResults(
    result: MetadataValidationResult,
    errors: ValidationError[],
    warnings: ValidationWarning[],
    blockers: BlockingIssue[]
  ): void {
    if (!result.valid) {
      result.missingRequired.forEach(field => {
        errors.push({
          code: 'metadata.missing_required',
          severity: 'error',
          location: `metadata.${field}`,
          message: `Required metadata field missing: ${field}`,
          context: { field }
        });
      });

      result.invalidFormats.forEach(formatError => {
        errors.push({
          code: 'metadata.invalid_format',
          severity: 'error',
          location: `metadata.${formatError.field}`,
          message: formatError.message,
          context: { 
            field: formatError.field,
            expected: formatError.expectedFormat,
            actual: formatError.value
          }
        });
      });

      blockers.push({
        type: 'metadata',
        reason: 'Required metadata missing or invalid',
        affectedItems: [...result.missingRequired, ...result.invalidFormats.map(e => e.field)],
        canOverride: false
      });
    }

    result.warnings.forEach(warning => {
      warnings.push({
        code: 'metadata.warning',
        location: 'metadata',
        message: warning
      });
    });
  }

  /**
   * Process custom rule results
   */
  private processCustomResults(
    results: Map<string, ValidationRuleResult>,
    errors: ValidationError[],
    warnings: ValidationWarning[],
    blockers: BlockingIssue[]
  ): void {
    results.forEach((result, ruleId) => {
      if (!result.passed) {
        result.issues.forEach(issue => {
          if (issue.severity === 'critical' || issue.severity === 'error') {
            errors.push({
              code: `custom.${ruleId}`,
              severity: issue.severity === 'critical' ? 'critical' : 'error',
              location: issue.path || 'unknown',
              message: issue.message,
              context: { rule: ruleId, ...issue.context }
            });
          } else {
            warnings.push({
              code: `custom.${ruleId}`,
              location: issue.path || 'unknown',
              message: issue.message
            });
          }
        });

        const rule = this.customRulesEngine.getRule(ruleId);
        if (rule && !rule.override_allowed) {
          blockers.push({
            type: 'custom',
            reason: `Custom rule '${rule.name}' failed`,
            affectedItems: result.issues.map(i => i.path || 'unknown'),
            canOverride: false
          });
        }
      }
    });
  }

  /**
   * Calculate overall validation score
   */
  private calculateOverallScore(results: Record<string, any>): number {
    const weights = {
      schema: 0.25,
      zones: 0.20,
      errors: 0.20,
      content: 0.15,
      metadata: 0.10,
      custom: 0.10
    };

    let totalScore = 0;
    let totalWeight = 0;

    if (results.schema) {
      const schemaScore = results.schema.valid ? 100 : 0;
      totalScore += schemaScore * weights.schema;
      totalWeight += weights.schema;
    }

    if (results.zones) {
      totalScore += results.zones.completenessScore * weights.zones;
      totalWeight += weights.zones;
    }

    if (results.errors) {
      const errorScore = results.errors.valid ? 100 : 
                        Math.max(0, 100 - (results.errors.impactScore / 10));
      totalScore += errorScore * weights.errors;
      totalWeight += weights.errors;
    }

    if (results.content) {
      totalScore += results.content.score * weights.content;
      totalWeight += weights.content;
    }

    if (results.metadata) {
      totalScore += results.metadata.completenessScore * weights.metadata;
      totalWeight += weights.metadata;
    }

    if (results.custom) {
      const passedRules = Array.from(results.custom.values()).filter(r => r.passed).length;
      const customScore = (passedRules / results.custom.size) * 100;
      totalScore += customScore * weights.custom;
      totalWeight += weights.custom;
    }

    return totalWeight > 0 ? Math.round(totalScore / totalWeight) : 0;
  }

  /**
   * Make blocking decision
   */
  private makeBlockingDecision(
    errors: ValidationError[],
    warnings: ValidationWarning[],
    blockers: BlockingIssue[],
    score: number
  ): BlockingDecision {
    const reasons: BlockingReason[] = [];
    
    // Check score threshold
    if (score < this.config.blockingThresholds.minScore) {
      reasons.push({
        validator: 'orchestrator',
        issue: `Overall score (${score}) below threshold (${this.config.blockingThresholds.minScore})`,
        severity: 'high',
        details: { score, threshold: this.config.blockingThresholds.minScore }
      });
    }

    // Check error counts
    const criticalErrors = errors.filter(e => e.severity === 'critical');
    if (criticalErrors.length > this.config.blockingThresholds.maxCriticalErrors) {
      reasons.push({
        validator: 'orchestrator',
        issue: `Critical error count (${criticalErrors.length}) exceeds threshold`,
        severity: 'critical',
        details: { count: criticalErrors.length, threshold: this.config.blockingThresholds.maxCriticalErrors }
      });
    }

    if (errors.length > this.config.blockingThresholds.maxErrors) {
      reasons.push({
        validator: 'orchestrator',
        issue: `Total error count (${errors.length}) exceeds threshold`,
        severity: 'high',
        details: { count: errors.length, threshold: this.config.blockingThresholds.maxErrors }
      });
    }

    // Add blocker reasons
    blockers.forEach(blocker => {
      reasons.push({
        validator: blocker.type,
        issue: blocker.reason,
        severity: blocker.canOverride ? 'medium' : 'critical',
        details: blocker
      });
    });

    const shouldBlock = reasons.length > 0;
    const hasNonOverridableBlockers = blockers.some(b => !b.canOverride);
    
    return {
      shouldBlock,
      reasons,
      overridable: shouldBlock && !hasNonOverridableBlockers,
      overrideProcess: {
        approvalRequired: true,
        approverRoles: ['supervisor', 'data_team_lead'],
        justificationRequired: true,
        auditLog: true
      },
      recommendations: this.generateBlockingRecommendations(reasons)
    };
  }

  /**
   * Generate validation report
   */
  private generateReport(
    results: Record<string, any>,
    errors: ValidationError[],
    warnings: ValidationWarning[],
    score: number,
    exportData: any,
    durationMs: number
  ): ValidationReport {
    const totalItems = Array.isArray(exportData) ? exportData.length : 1;
    const validItems = totalItems - errors.length;
    
    const status = errors.length === 0 ? 'passed' :
                  errors.some(e => e.severity === 'critical') ? 'failed' :
                  'passed_with_warnings';

    return {
      summary: {
        overallStatus: status,
        score,
        totalItems,
        validItems,
        invalidItems: errors.length,
        warningCount: warnings.length
      },
      details: {
        schemaValidation: results.schema ? {
          totalChecked: 1,
          passedCount: results.schema.valid ? 1 : 0,
          failedCount: results.schema.valid ? 0 : 1,
          errorsByType: new Map(),
          commonErrors: results.schema.errors.map(e => e.message),
          performanceMs: 0
        } : this.getEmptySchemaDetails(),
        zoneCompleteness: results.zones ? 
          this.zoneValidator.getDetails(results.zones.zones || []) :
          this.getEmptyZoneDetails(),
        errorAnalysis: results.errors ?
          this.errorValidator.analyzeErrors(results.errors.blockingErrors || []) :
          this.getEmptyErrorDetails(),
        contentValidation: results.content ?
          this.contentValidator.getDetails(results.content.issues || [], results.content.statistics || {}) :
          this.getEmptyContentDetails(),
        metadataValidation: results.metadata ?
          this.metadataValidator.getDetails('rag', results.metadata.metadata || {}) :
          this.getEmptyMetadataDetails(),
        customRules: results.custom ? {
          totalRules: results.custom.size,
          passedRules: Array.from(results.custom.values()).filter(r => r.passed).length,
          failedRules: Array.from(results.custom.values()).filter(r => !r.passed).length,
          ruleResults: results.custom
        } : this.getEmptyCustomDetails()
      },
      recommendations: this.generateRecommendations(results, errors, warnings),
      timestamp: new Date().toISOString(),
      validatorVersion: '1.0.0'
    };
  }

  /**
   * Generate suggestions for schema errors
   */
  private getSuggestionForSchemaError(error: any): string {
    switch (error.keyword) {
      case 'required':
        return `Add the missing field '${error.params.missingProperty}' to the export data`;
      case 'type':
        return `Ensure the value at ${error.instancePath} is of type ${error.params.type}`;
      case 'format':
        return `Format the value at ${error.instancePath} according to ${error.params.format} format`;
      default:
        return 'Review the schema requirements and adjust the data accordingly';
    }
  }

  /**
   * Generate blocking recommendations
   */
  private generateBlockingRecommendations(reasons: BlockingReason[]): string[] {
    const recommendations: string[] = [];
    
    const criticalReasons = reasons.filter(r => r.severity === 'critical');
    if (criticalReasons.length > 0) {
      recommendations.push('Address all critical issues before retrying export');
    }
    
    const schemaReasons = reasons.filter(r => r.validator === 'schema');
    if (schemaReasons.length > 0) {
      recommendations.push('Ensure export data conforms to the required schema');
    }
    
    const errorReasons = reasons.filter(r => r.validator === 'error');
    if (errorReasons.length > 0) {
      recommendations.push('Investigate and resolve processing errors');
    }
    
    return recommendations;
  }

  /**
   * Generate overall recommendations
   */
  private generateRecommendations(
    results: Record<string, any>,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): string[] {
    const recommendations: string[] = [];
    
    if (errors.length > 5) {
      recommendations.push('Multiple validation errors detected - consider reviewing export configuration');
    }
    
    if (results.zones && results.zones.processedPercentage < 100) {
      recommendations.push('Some zones remain unprocessed - complete zone processing for better results');
    }
    
    if (results.content && results.content.score < 80) {
      recommendations.push('Content quality could be improved - review extraction settings');
    }
    
    if (warnings.length > 10) {
      recommendations.push(`${warnings.length} warnings detected - review for potential improvements`);
    }
    
    return recommendations;
  }

  // Empty detail generators for when validators are disabled
  private getEmptySchemaDetails(): SchemaValidationDetails {
    return {
      totalChecked: 0,
      passedCount: 0,
      failedCount: 0,
      errorsByType: new Map(),
      commonErrors: [],
      performanceMs: 0
    };
  }

  private getEmptyZoneDetails(): ZoneCompletenessDetails {
    return {
      totalZones: 0,
      processedZones: 0,
      failedZones: 0,
      pendingZones: 0,
      coveragePercentage: 0,
      zoneTypeDistribution: new Map(),
      processingDuration: 0,
      qualityScore: 0
    };
  }

  private getEmptyErrorDetails(): ErrorAnalysisDetails {
    return {
      totalErrors: 0,
      criticalErrors: 0,
      errorsByComponent: new Map(),
      errorsByType: new Map(),
      timelineAnalysis: {
        firstError: null,
        lastError: null,
        errorFrequency: 0
      },
      impactAssessment: {
        affectedZones: 0,
        dataLossRisk: 'none',
        processingImpact: 'minimal'
      }
    };
  }

  private getEmptyContentDetails(): ContentValidationDetails {
    return {
      textValidation: {
        validCount: 0,
        invalidCount: 0,
        encodingErrors: 0,
        truncatedSections: 0
      },
      tableValidation: {
        validTables: 0,
        invalidTables: 0,
        structuralIssues: []
      },
      patternMatches: {
        expectedPatterns: 0,
        matchedPatterns: 0,
        missingPatterns: []
      },
      qualityMetrics: {
        readability: 0,
        completeness: 0,
        consistency: 0
      }
    };
  }

  private getEmptyMetadataDetails(): MetadataValidationDetails {
    return {
      totalFields: 0,
      requiredFields: 0,
      presentFields: 0,
      missingFields: 0,
      invalidFields: 0,
      completenessPercentage: 0,
      qualityScore: 0,
      fieldCoverage: new Map()
    };
  }

  private getEmptyCustomDetails(): CustomRulesDetails {
    return {
      totalRules: 0,
      passedRules: 0,
      failedRules: 0,
      ruleResults: new Map()
    };
  }
}

// Export singleton instance
export const validationOrchestrator = new ValidationOrchestrator();