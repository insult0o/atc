/**
 * Schema Validation Utilities
 * Provides JSON schema validation for all export formats
 */

import Ajv, { ErrorObject } from 'ajv';
import addFormats from 'ajv-formats';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  ExportFormat,
  RAGChunk,
  FineTuningExample,
  CorrectionExport,
  ZoneManifest,
  ExportLog,
  ExportError,
  ExportWarning
} from './types';

// Initialize AJV with strict validation
const ajv = new Ajv({
  strict: true,
  allErrors: true,
  verbose: true,
  coerceTypes: false,
  strictTypes: true
});

// Add format validators (date-time, uri, etc.)
addFormats(ajv);

// Schema cache
const schemaCache = new Map<ExportFormat, any>();

/**
 * Load schema from file system
 */
function loadSchema(format: ExportFormat): any {
  if (schemaCache.has(format)) {
    return schemaCache.get(format);
  }

  const schemaMap: Record<ExportFormat, string> = {
    'rag': 'rag-schema.json',
    'jsonl': 'jsonl-schema.json',
    'corrections': 'corrections-schema.json',
    'manifest': 'manifest-schema.json',
    'log': 'log-schema.json'
  };

  const schemaPath = join(__dirname, schemaMap[format]);
  const schemaContent = readFileSync(schemaPath, 'utf-8');
  const schema = JSON.parse(schemaContent);
  
  schemaCache.set(format, schema);
  return schema;
}

/**
 * Validation result interface
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  suggestions: string[];
}

export interface ValidationError {
  path: string;
  message: string;
  value?: any;
  keyword?: string;
}

export interface ValidationWarning {
  path: string;
  message: string;
  suggestion?: string;
}

/**
 * Convert AJV errors to our validation format
 */
function formatAjvErrors(errors: ErrorObject[] | null | undefined): ValidationError[] {
  if (!errors) return [];
  
  return errors.map(error => ({
    path: error.instancePath || '/',
    message: error.message || 'Validation error',
    value: error.data,
    keyword: error.keyword
  }));
}

/**
 * Check for data quality warnings
 */
function checkDataQuality(format: ExportFormat, data: any): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];

  switch (format) {
    case 'rag':
      const ragChunk = data as RAGChunk;
      
      // Check chunk size
      if (ragChunk.content.length < 100) {
        warnings.push({
          path: '/content',
          message: 'Chunk content is very short (< 100 characters)',
          suggestion: 'Consider increasing chunk size for better context'
        });
      }
      
      if (ragChunk.content.length > 8192) {
        warnings.push({
          path: '/content',
          message: 'Chunk content is very large (> 8192 characters)',
          suggestion: 'Consider reducing chunk size for better processing'
        });
      }
      
      // Check confidence
      if (ragChunk.metadata.confidence < 0.5) {
        warnings.push({
          path: '/metadata/confidence',
          message: 'Low confidence score detected',
          suggestion: 'Review content accuracy or consider reprocessing'
        });
      }
      
      // Check embeddings
      if (!ragChunk.embeddings || ragChunk.embeddings.length === 0) {
        warnings.push({
          path: '/embeddings',
          message: 'No embeddings provided',
          suggestion: 'Add embeddings for better RAG performance'
        });
      }
      break;

    case 'jsonl':
      const example = data as FineTuningExample;
      
      // Check message balance
      const userMessages = example.messages.filter(m => m.role === 'user').length;
      const assistantMessages = example.messages.filter(m => m.role === 'assistant').length;
      
      if (Math.abs(userMessages - assistantMessages) > 1) {
        warnings.push({
          path: '/messages',
          message: 'Unbalanced conversation flow',
          suggestion: 'Ensure equal number of user and assistant messages'
        });
      }
      
      // Check quality score
      if (example.metadata.quality_score < 0.7) {
        warnings.push({
          path: '/metadata/quality_score',
          message: 'Low quality score for training example',
          suggestion: 'Consider filtering out low-quality examples'
        });
      }
      
      // Check token count
      if (example.metadata.tokens && example.metadata.tokens > 4096) {
        warnings.push({
          path: '/metadata/tokens',
          message: 'High token count may exceed model limits',
          suggestion: 'Consider splitting into smaller examples'
        });
      }
      break;

    case 'corrections':
      const correction = data as CorrectionExport;
      
      // Check confidence change
      if (correction.confidence_change < 0) {
        warnings.push({
          path: '/confidence_change',
          message: 'Negative confidence change after correction',
          suggestion: 'Verify correction accuracy'
        });
      }
      
      // Check content similarity
      if (correction.original.content === correction.corrected.content) {
        warnings.push({
          path: '/corrected/content',
          message: 'No actual change in content',
          suggestion: 'Remove unnecessary correction entries'
        });
      }
      break;

    case 'manifest':
      const manifest = data as ZoneManifest;
      
      // Check processing efficiency
      if (manifest.processingTime > 300) {
        warnings.push({
          path: '/processingTime',
          message: 'Long processing time detected (> 5 minutes)',
          suggestion: 'Consider optimizing processing pipeline'
        });
      }
      
      // Check error rate
      const errorZones = manifest.zones.filter(z => z.status === 'error').length;
      const errorRate = errorZones / manifest.totalZones;
      
      if (errorRate > 0.1) {
        warnings.push({
          path: '/zones',
          message: `High error rate: ${(errorRate * 100).toFixed(1)}% of zones failed`,
          suggestion: 'Review processing tools and error handling'
        });
      }
      break;

    case 'log':
      const log = data as ExportLog;
      
      // Check error count
      if (log.errors.length > 10) {
        warnings.push({
          path: '/errors',
          message: 'High number of errors in export',
          suggestion: 'Review error patterns and improve error handling'
        });
      }
      
      // Check export success rate
      const successRate = log.summary.successfulExports / log.summary.totalItems;
      if (successRate < 0.9) {
        warnings.push({
          path: '/summary',
          message: `Low export success rate: ${(successRate * 100).toFixed(1)}%`,
          suggestion: 'Investigate failed exports and improve reliability'
        });
      }
      break;
  }

  return warnings;
}

/**
 * Generate improvement suggestions
 */
function generateSuggestions(format: ExportFormat, errors: ValidationError[], warnings: ValidationWarning[]): string[] {
  const suggestions: string[] = [];
  
  // Error-based suggestions
  const missingFields = errors.filter(e => e.keyword === 'required');
  if (missingFields.length > 0) {
    suggestions.push(`Add missing required fields: ${missingFields.map(e => e.path).join(', ')}`);
  }
  
  const typeErrors = errors.filter(e => e.keyword === 'type');
  if (typeErrors.length > 0) {
    suggestions.push('Fix data type mismatches in your export data');
  }
  
  // Format-specific suggestions
  if (format === 'rag' && warnings.some(w => w.path.includes('embeddings'))) {
    suggestions.push('Consider using an embedding service to generate vector embeddings');
  }
  
  if (format === 'jsonl' && warnings.some(w => w.path.includes('quality_score'))) {
    suggestions.push('Implement quality filtering to improve training data');
  }
  
  if (format === 'manifest' && warnings.some(w => w.message.includes('error rate'))) {
    suggestions.push('Add retry logic for failed zone processing');
  }
  
  return suggestions;
}

/**
 * Main validation function
 */
export function validateExportData(format: ExportFormat, data: any): ValidationResult {
  try {
    // Load schema
    const schema = loadSchema(format);
    
    // Compile validator
    const validate = ajv.compile(schema);
    
    // Validate data
    const valid = validate(data);
    
    // Format errors
    const errors = formatAjvErrors(validate.errors);
    
    // Check data quality
    const warnings = valid ? checkDataQuality(format, data) : [];
    
    // Generate suggestions
    const suggestions = generateSuggestions(format, errors, warnings);
    
    return {
      valid,
      errors,
      warnings,
      suggestions
    };
  } catch (error) {
    return {
      valid: false,
      errors: [{
        path: '/',
        message: `Schema validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      }],
      warnings: [],
      suggestions: ['Ensure schema files are properly installed']
    };
  }
}

/**
 * Batch validation for multiple items
 */
export function validateBatch(format: ExportFormat, items: any[]): {
  results: ValidationResult[];
  summary: {
    total: number;
    valid: number;
    invalid: number;
    warnings: number;
  };
} {
  const results = items.map(item => validateExportData(format, item));
  
  return {
    results,
    summary: {
      total: items.length,
      valid: results.filter(r => r.valid).length,
      invalid: results.filter(r => !r.valid).length,
      warnings: results.reduce((sum, r) => sum + r.warnings.length, 0)
    }
  };
}

/**
 * Validate export file structure
 */
export function validateExportStructure(
  exports: Record<ExportFormat, any[]>
): Record<ExportFormat, ValidationResult[]> {
  const results: Record<ExportFormat, ValidationResult[]> = {} as any;
  
  for (const [format, items] of Object.entries(exports)) {
    results[format as ExportFormat] = items.map(item => 
      validateExportData(format as ExportFormat, item)
    );
  }
  
  return results;
}

/**
 * Export validation result as report
 */
export function generateValidationReport(results: ValidationResult[]): string {
  const report: string[] = [
    '# Export Validation Report',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    '## Summary',
    `- Total Items: ${results.length}`,
    `- Valid: ${results.filter(r => r.valid).length}`,
    `- Invalid: ${results.filter(r => !r.valid).length}`,
    `- Total Warnings: ${results.reduce((sum, r) => sum + r.warnings.length, 0)}`,
    '',
    '## Details',
    ''
  ];
  
  results.forEach((result, index) => {
    report.push(`### Item ${index + 1}`);
    report.push(`Status: ${result.valid ? '✅ Valid' : '❌ Invalid'}`);
    
    if (result.errors.length > 0) {
      report.push('', '#### Errors:');
      result.errors.forEach(error => {
        report.push(`- ${error.path}: ${error.message}`);
      });
    }
    
    if (result.warnings.length > 0) {
      report.push('', '#### Warnings:');
      result.warnings.forEach(warning => {
        report.push(`- ${warning.path}: ${warning.message}`);
        if (warning.suggestion) {
          report.push(`  💡 ${warning.suggestion}`);
        }
      });
    }
    
    if (result.suggestions.length > 0) {
      report.push('', '#### Suggestions:');
      result.suggestions.forEach(suggestion => {
        report.push(`- ${suggestion}`);
      });
    }
    
    report.push('');
  });
  
  return report.join('\n');
}