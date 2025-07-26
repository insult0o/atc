// Task 1: Schema Validation Engine
// Implements JSON schema validator using AJV with custom format validators

import Ajv, { ErrorObject, ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';
import { ExportFormat } from '../schemas/types';
import { loadSchema } from '../schemas';

export interface SchemaValidationConfig {
  schemas: Map<ExportFormat, any>;
  strictMode: boolean;
  allowAdditionalProperties: boolean;
  customFormats: {
    timestamp: RegExp;
    uuid: RegExp;
    confidence: { min: number; max: number };
  };
  coerceTypes: boolean;
  removeAdditional: boolean;
}

export interface SchemaValidationResult {
  valid: boolean;
  errors: SchemaValidationError[];
  validatedData?: any;
}

export interface SchemaValidationError {
  path: string;
  message: string;
  keyword: string;
  params: any;
  schemaPath: string;
  data?: any;
}

export interface SchemaValidationDetails {
  totalChecked: number;
  passedCount: number;
  failedCount: number;
  errorsByType: Map<string, number>;
  commonErrors: string[];
  performanceMs: number;
}

export class SchemaValidator {
  private ajv: Ajv;
  private validators: Map<ExportFormat, ValidateFunction> = new Map();
  private config: SchemaValidationConfig;

  constructor(config?: Partial<SchemaValidationConfig>) {
    this.config = {
      schemas: new Map(),
      strictMode: true,
      allowAdditionalProperties: false,
      customFormats: {
        timestamp: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/,
        uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
        confidence: { min: 0, max: 1 }
      },
      coerceTypes: false,
      removeAdditional: false,
      ...config
    };

    // Initialize AJV with configuration
    this.ajv = new Ajv({
      strict: this.config.strictMode,
      allErrors: true,
      verbose: true,
      coerceTypes: this.config.coerceTypes,
      removeAdditional: this.config.removeAdditional,
      useDefaults: true,
      discriminator: true
    });

    // Add standard formats
    addFormats(this.ajv);

    // Add custom formats
    this.registerCustomFormats();

    // Load schemas for all export formats
    this.loadSchemas();
  }

  /**
   * Register custom format validators
   */
  private registerCustomFormats(): void {
    // Timestamp format
    this.ajv.addFormat('timestamp', {
      validate: (data: string) => {
        return this.config.customFormats.timestamp.test(data);
      }
    });

    // UUID format
    this.ajv.addFormat('uuid', {
      validate: (data: string) => {
        return this.config.customFormats.uuid.test(data);
      }
    });

    // Confidence score format
    this.ajv.addFormat('confidence', {
      type: 'number',
      validate: (data: number) => {
        return data >= this.config.customFormats.confidence.min && 
               data <= this.config.customFormats.confidence.max;
      }
    });

    // Zone ID format
    this.ajv.addFormat('zone-id', {
      validate: (data: string) => {
        return /^zone_[a-zA-Z0-9_]+$/.test(data);
      }
    });

    // File path format
    this.ajv.addFormat('file-path', {
      validate: (data: string) => {
        return /^[a-zA-Z0-9_\-./\\]+$/.test(data);
      }
    });
  }

  /**
   * Load schemas for all export formats
   */
  private async loadSchemas(): Promise<void> {
    const formats: ExportFormat[] = ['rag', 'jsonl', 'corrections', 'manifest', 'log'];
    
    for (const format of formats) {
      try {
        const schema = await loadSchema(format);
        if (schema) {
          this.config.schemas.set(format, schema);
          const validator = this.ajv.compile(schema);
          this.validators.set(format, validator);
        }
      } catch (error) {
        console.error(`Failed to load schema for format ${format}:`, error);
      }
    }
  }

  /**
   * Validate data against schema for specific format
   */
  public async validate(
    format: ExportFormat, 
    data: any
  ): Promise<SchemaValidationResult> {
    const validator = this.validators.get(format);
    
    if (!validator) {
      return {
        valid: false,
        errors: [{
          path: '',
          message: `No schema validator found for format: ${format}`,
          keyword: 'missing_validator',
          params: { format },
          schemaPath: ''
        }]
      };
    }

    const valid = validator(data);
    
    if (valid) {
      return {
        valid: true,
        errors: [],
        validatedData: data
      };
    }

    // Format validation errors
    const errors = this.formatErrors(validator.errors || []);
    
    return {
      valid: false,
      errors
    };
  }

  /**
   * Batch validate multiple items
   */
  public async validateBatch(
    format: ExportFormat,
    items: any[]
  ): Promise<{
    results: SchemaValidationResult[];
    summary: SchemaValidationDetails;
  }> {
    const startTime = Date.now();
    const results: SchemaValidationResult[] = [];
    const errorsByType = new Map<string, number>();
    const allErrors: string[] = [];

    for (const item of items) {
      const result = await this.validate(format, item);
      results.push(result);

      // Collect error statistics
      for (const error of result.errors) {
        const count = errorsByType.get(error.keyword) || 0;
        errorsByType.set(error.keyword, count + 1);
        allErrors.push(error.message);
      }
    }

    // Find common errors
    const errorCounts = new Map<string, number>();
    allErrors.forEach(error => {
      errorCounts.set(error, (errorCounts.get(error) || 0) + 1);
    });
    
    const commonErrors = Array.from(errorCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([error]) => error);

    const passedCount = results.filter(r => r.valid).length;

    return {
      results,
      summary: {
        totalChecked: items.length,
        passedCount,
        failedCount: items.length - passedCount,
        errorsByType,
        commonErrors,
        performanceMs: Date.now() - startTime
      }
    };
  }

  /**
   * Format AJV errors into readable format
   */
  private formatErrors(errors: ErrorObject[]): SchemaValidationError[] {
    return errors.map(error => {
      let message = '';
      
      switch (error.keyword) {
        case 'required':
          message = `Missing required field: ${error.params.missingProperty}`;
          break;
        case 'type':
          message = `Invalid type at ${error.instancePath}: expected ${error.params.type}`;
          break;
        case 'format':
          message = `Invalid format at ${error.instancePath}: expected ${error.params.format}`;
          break;
        case 'minimum':
        case 'maximum':
          message = `Value at ${error.instancePath} must be ${error.keyword} ${error.params.limit}`;
          break;
        case 'pattern':
          message = `Value at ${error.instancePath} does not match pattern ${error.params.pattern}`;
          break;
        case 'additionalProperties':
          message = `Unexpected property: ${error.params.additionalProperty}`;
          break;
        default:
          message = error.message || `Validation error: ${error.keyword}`;
      }

      return {
        path: error.instancePath,
        message,
        keyword: error.keyword,
        params: error.params,
        schemaPath: error.schemaPath,
        data: error.data
      };
    });
  }

  /**
   * Add or update a schema
   */
  public addSchema(format: ExportFormat, schema: any): void {
    this.config.schemas.set(format, schema);
    const validator = this.ajv.compile(schema);
    this.validators.set(format, validator);
  }

  /**
   * Get validation errors for debugging
   */
  public getLastErrors(): ErrorObject[] | null {
    return this.ajv.errors;
  }

  /**
   * Clear all cached validators
   */
  public clearCache(): void {
    this.validators.clear();
    this.ajv.removeSchema();
  }
}

// Export singleton instance
export const schemaValidator = new SchemaValidator();