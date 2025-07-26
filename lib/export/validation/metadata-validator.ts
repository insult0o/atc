// Task 5: Metadata Completeness Validator
// Validates required metadata fields and formats

import { ExportFormat } from '../schemas/types';

export interface MetadataRequirements {
  required: {
    global: string[];     // Required for all exports
    perFormat: Map<ExportFormat, string[]>;
  };
  optional: {
    recommended: string[];
    conditional: Array<{
      condition: string;
      requiredFields: string[];
    }>;
  };
  validation: {
    timestampFormat: string;
    uuidVersion: number;
    confidenceRange: [number, number];
  };
}

export interface MetadataValidationResult {
  valid: boolean;
  completenessScore: number;
  missingRequired: string[];
  missingRecommended: string[];
  invalidFormats: MetadataFormatError[];
  warnings: string[];
}

export interface MetadataFormatError {
  field: string;
  value: any;
  expectedFormat: string;
  message: string;
}

export interface MetadataValidationDetails {
  totalFields: number;
  requiredFields: number;
  presentFields: number;
  missingFields: number;
  invalidFields: number;
  completenessPercentage: number;
  qualityScore: number;
  fieldCoverage: Map<string, boolean>;
}

export class MetadataValidator {
  private config: MetadataRequirements;

  constructor(config?: Partial<MetadataRequirements>) {
    this.config = {
      required: {
        global: [
          'document_id',
          'timestamp',
          'version',
          'format',
          'processing_status'
        ],
        perFormat: new Map([
          ['rag', ['chunks', 'embeddings_config', 'chunk_metadata']],
          ['jsonl', ['schema_version', 'record_count']],
          ['corrections', ['original_values', 'corrected_values', 'confidence_scores']],
          ['manifest', ['files', 'total_size', 'created_at']],
          ['log', ['entries', 'severity_levels', 'time_range']]
        ])
      },
      optional: {
        recommended: [
          'author',
          'title',
          'description',
          'tags',
          'language',
          'source_file',
          'processing_duration'
        ],
        conditional: [
          {
            condition: 'has_tables',
            requiredFields: ['table_count', 'table_extraction_method']
          },
          {
            condition: 'has_images',
            requiredFields: ['image_count', 'image_formats']
          },
          {
            condition: 'multi_page',
            requiredFields: ['page_count', 'page_range']
          }
        ]
      },
      validation: {
        timestampFormat: 'ISO8601',
        uuidVersion: 4,
        confidenceRange: [0, 1]
      },
      ...config
    };
  }

  /**
   * Validate metadata completeness
   */
  public async validate(
    format: ExportFormat,
    metadata: Record<string, any>,
    documentContext?: Record<string, any>
  ): Promise<MetadataValidationResult> {
    const missingRequired: string[] = [];
    const missingRecommended: string[] = [];
    const invalidFormats: MetadataFormatError[] = [];
    const warnings: string[] = [];

    // Check global required fields
    for (const field of this.config.required.global) {
      if (!(field in metadata) || metadata[field] === null || metadata[field] === undefined) {
        missingRequired.push(field);
      }
    }

    // Check format-specific required fields
    const formatRequirements = this.config.required.perFormat.get(format);
    if (formatRequirements) {
      for (const field of formatRequirements) {
        if (!(field in metadata) || metadata[field] === null || metadata[field] === undefined) {
          missingRequired.push(field);
        }
      }
    }

    // Check recommended fields
    for (const field of this.config.optional.recommended) {
      if (!(field in metadata)) {
        missingRecommended.push(field);
        warnings.push(`Recommended field '${field}' is missing`);
      }
    }

    // Check conditional requirements
    if (documentContext) {
      for (const conditional of this.config.optional.conditional) {
        if (this.evaluateCondition(conditional.condition, documentContext)) {
          for (const field of conditional.requiredFields) {
            if (!(field in metadata)) {
              missingRequired.push(field);
              warnings.push(`Field '${field}' is required when ${conditional.condition}`);
            }
          }
        }
      }
    }

    // Validate field formats
    const formatErrors = this.validateFieldFormats(metadata);
    invalidFormats.push(...formatErrors);

    // Calculate completeness score
    const completenessScore = this.calculateCompletenessScore(
      metadata,
      missingRequired,
      missingRecommended,
      invalidFormats
    );

    return {
      valid: missingRequired.length === 0 && invalidFormats.length === 0,
      completenessScore,
      missingRequired,
      missingRecommended,
      invalidFormats,
      warnings
    };
  }

  /**
   * Evaluate conditional requirement
   */
  private evaluateCondition(condition: string, context: Record<string, any>): boolean {
    switch (condition) {
      case 'has_tables':
        return context.tableCount > 0;
      case 'has_images':
        return context.imageCount > 0;
      case 'multi_page':
        return context.pageCount > 1;
      default:
        return false;
    }
  }

  /**
   * Validate field formats
   */
  private validateFieldFormats(metadata: Record<string, any>): MetadataFormatError[] {
    const errors: MetadataFormatError[] = [];

    // Validate timestamp fields
    const timestampFields = ['timestamp', 'created_at', 'updated_at', 'processing_start', 'processing_end'];
    for (const field of timestampFields) {
      if (field in metadata) {
        if (!this.isValidTimestamp(metadata[field])) {
          errors.push({
            field,
            value: metadata[field],
            expectedFormat: this.config.validation.timestampFormat,
            message: `Invalid timestamp format for field '${field}'`
          });
        }
      }
    }

    // Validate UUID fields
    const uuidFields = ['document_id', 'export_id', 'session_id'];
    for (const field of uuidFields) {
      if (field in metadata) {
        if (!this.isValidUUID(metadata[field])) {
          errors.push({
            field,
            value: metadata[field],
            expectedFormat: `UUID v${this.config.validation.uuidVersion}`,
            message: `Invalid UUID format for field '${field}'`
          });
        }
      }
    }

    // Validate confidence scores
    const confidenceFields = ['confidence', 'confidence_score', 'extraction_confidence'];
    for (const field of confidenceFields) {
      if (field in metadata) {
        const value = metadata[field];
        if (typeof value !== 'number' || 
            value < this.config.validation.confidenceRange[0] || 
            value > this.config.validation.confidenceRange[1]) {
          errors.push({
            field,
            value,
            expectedFormat: `Number between ${this.config.validation.confidenceRange[0]} and ${this.config.validation.confidenceRange[1]}`,
            message: `Invalid confidence score for field '${field}'`
          });
        }
      }
    }

    // Validate version fields
    if ('version' in metadata) {
      if (!Number.isInteger(metadata.version) || metadata.version < 1) {
        errors.push({
          field: 'version',
          value: metadata.version,
          expectedFormat: 'Positive integer',
          message: 'Version must be a positive integer'
        });
      }
    }

    // Validate array fields
    const arrayFields = ['chunks', 'files', 'entries', 'tags'];
    for (const field of arrayFields) {
      if (field in metadata && !Array.isArray(metadata[field])) {
        errors.push({
          field,
          value: metadata[field],
          expectedFormat: 'Array',
          message: `Field '${field}' must be an array`
        });
      }
    }

    return errors;
  }

  /**
   * Validate ISO8601 timestamp
   */
  private isValidTimestamp(value: any): boolean {
    if (typeof value !== 'string') return false;
    
    const iso8601Regex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/;
    if (!iso8601Regex.test(value)) return false;
    
    const date = new Date(value);
    return !isNaN(date.getTime());
  }

  /**
   * Validate UUID v4
   */
  private isValidUUID(value: any): boolean {
    if (typeof value !== 'string') return false;
    
    const uuidV4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidV4Regex.test(value);
  }

  /**
   * Calculate completeness score
   */
  private calculateCompletenessScore(
    metadata: Record<string, any>,
    missingRequired: string[],
    missingRecommended: string[],
    invalidFormats: MetadataFormatError[]
  ): number {
    const totalRequired = this.config.required.global.length;
    const totalRecommended = this.config.optional.recommended.length;
    
    // Weight: required fields 70%, recommended fields 20%, format validity 10%
    const requiredScore = ((totalRequired - missingRequired.length) / totalRequired) * 70;
    const recommendedScore = ((totalRecommended - missingRecommended.length) / totalRecommended) * 20;
    const formatScore = invalidFormats.length === 0 ? 10 : 0;
    
    return Math.round(requiredScore + recommendedScore + formatScore);
  }

  /**
   * Get detailed metadata validation information
   */
  public getDetails(
    format: ExportFormat,
    metadata: Record<string, any>
  ): MetadataValidationDetails {
    const allFields = [
      ...this.config.required.global,
      ...(this.config.required.perFormat.get(format) || []),
      ...this.config.optional.recommended
    ];
    
    const uniqueFields = [...new Set(allFields)];
    const fieldCoverage = new Map<string, boolean>();
    
    let presentFields = 0;
    uniqueFields.forEach(field => {
      const isPresent = field in metadata && 
                       metadata[field] !== null && 
                       metadata[field] !== undefined;
      fieldCoverage.set(field, isPresent);
      if (isPresent) presentFields++;
    });
    
    const requiredCount = this.config.required.global.length + 
                         (this.config.required.perFormat.get(format)?.length || 0);
    
    const invalidFields = this.validateFieldFormats(metadata).length;
    
    return {
      totalFields: uniqueFields.length,
      requiredFields: requiredCount,
      presentFields,
      missingFields: uniqueFields.length - presentFields,
      invalidFields,
      completenessPercentage: (presentFields / uniqueFields.length) * 100,
      qualityScore: this.calculateQualityScore(metadata, fieldCoverage),
      fieldCoverage
    };
  }

  /**
   * Calculate metadata quality score
   */
  private calculateQualityScore(
    metadata: Record<string, any>,
    fieldCoverage: Map<string, boolean>
  ): number {
    let score = 0;
    let factors = 0;
    
    // Check completeness
    const coverageScore = Array.from(fieldCoverage.values())
      .filter(v => v).length / fieldCoverage.size;
    score += coverageScore * 40;
    factors += 40;
    
    // Check data richness
    if (metadata.description && metadata.description.length > 50) {
      score += 10;
    }
    if (metadata.tags && Array.isArray(metadata.tags) && metadata.tags.length > 0) {
      score += 10;
    }
    factors += 20;
    
    // Check consistency
    let consistencyScore = 20;
    if (metadata.created_at && metadata.updated_at) {
      const created = new Date(metadata.created_at);
      const updated = new Date(metadata.updated_at);
      if (updated < created) {
        consistencyScore -= 10;
      }
    }
    score += consistencyScore;
    factors += 20;
    
    // Check format validity
    const formatErrors = this.validateFieldFormats(metadata);
    const formatScore = Math.max(0, 20 - (formatErrors.length * 5));
    score += formatScore;
    factors += 20;
    
    return Math.round((score / factors) * 100);
  }

  /**
   * Generate metadata template
   */
  public generateTemplate(format: ExportFormat): Record<string, any> {
    const template: Record<string, any> = {};
    
    // Add global required fields
    this.config.required.global.forEach(field => {
      template[field] = this.getFieldDefault(field);
    });
    
    // Add format-specific required fields
    const formatFields = this.config.required.perFormat.get(format);
    if (formatFields) {
      formatFields.forEach(field => {
        template[field] = this.getFieldDefault(field);
      });
    }
    
    // Add recommended fields
    this.config.optional.recommended.forEach(field => {
      template[field] = this.getFieldDefault(field);
    });
    
    return template;
  }

  /**
   * Get default value for field
   */
  private getFieldDefault(field: string): any {
    switch (field) {
      case 'timestamp':
      case 'created_at':
      case 'updated_at':
        return new Date().toISOString();
      case 'version':
        return 1;
      case 'format':
        return 'unknown';
      case 'processing_status':
        return 'pending';
      case 'chunks':
      case 'files':
      case 'entries':
      case 'tags':
        return [];
      case 'confidence':
      case 'confidence_score':
        return 1.0;
      case 'document_id':
      case 'export_id':
        return this.generateUUID();
      default:
        return null;
    }
  }

  /**
   * Generate UUID v4
   */
  private generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  /**
   * Validate metadata against schema
   */
  public async validateAgainstSchema(
    metadata: Record<string, any>,
    schema: any
  ): Promise<{
    valid: boolean;
    errors: string[];
  }> {
    // This would integrate with the schema validator
    // For now, return a simple validation
    return {
      valid: true,
      errors: []
    };
  }
}

// Export singleton instance
export const metadataValidator = new MetadataValidator();