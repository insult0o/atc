/**
 * Export Schemas Module
 * Central export point for all schema-related types and utilities
 */

// Export all types
export * from './types';

// Export validation utilities
export {
  validateExportData,
  validateBatch,
  validateExportStructure,
  generateValidationReport,
  type ValidationResult,
  type ValidationError,
  type ValidationWarning
} from './validator';

// Export format constants
export const EXPORT_FORMATS = ['rag', 'jsonl', 'corrections', 'manifest', 'log'] as const;

// Export default configurations
export const DEFAULT_EXPORT_CONFIG = {
  rag: {
    chunkSize: 1024,
    overlapPercentage: 0.1,
    includeEmbeddings: false,
    metadataFields: ['source', 'pageNumber', 'confidence', 'contentType'],
    chunkingStrategy: 'token' as const,
    maxChunkSize: 2048,
    minChunkSize: 100
  },
  jsonl: {
    qualityThreshold: 0.7,
    maxExamplesPerDocument: 100,
    conversationStyle: 'qa' as const,
    systemPrompt: 'You are a helpful assistant that extracts and explains information from documents.',
    includeLowQuality: false,
    balanceExamples: true
  },
  corrections: {
    includeOriginal: true,
    groupByCategory: false,
    minImpactLevel: 'low' as const,
    includeValidation: true,
    sortBy: 'timestamp' as const
  },
  manifest: {
    includeVisualPreviews: false,
    detailLevel: 'detailed' as const,
    includeProcessingLogs: true,
    includeCorrections: true,
    includeMetrics: true
  },
  log: {
    format: 'markdown' as const,
    includeDebugInfo: false,
    sectionsToInclude: ['summary', 'exports', 'errors', 'warnings'],
    maxErrorDetails: 10,
    timestampFormat: 'ISO'
  }
};

// Export schema file mappings
export const SCHEMA_FILES = {
  rag: 'rag-schema.json',
  jsonl: 'jsonl-schema.json',
  corrections: 'corrections-schema.json',
  manifest: 'manifest-schema.json',
  log: 'log-schema.json'
} as const;

// Export error codes
export const EXPORT_ERROR_CODES = {
  // Validation errors
  INVALID_FORMAT: 'INVALID_FORMAT',
  MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',
  TYPE_MISMATCH: 'TYPE_MISMATCH',
  CONSTRAINT_VIOLATION: 'CONSTRAINT_VIOLATION',
  
  // Processing errors
  CHUNK_TOO_SMALL: 'CHUNK_TOO_SMALL',
  CHUNK_TOO_LARGE: 'CHUNK_TOO_LARGE',
  QUALITY_THRESHOLD_NOT_MET: 'QUALITY_THRESHOLD_NOT_MET',
  PROCESSING_FAILED: 'PROCESSING_FAILED',
  
  // Export errors
  FILE_WRITE_ERROR: 'FILE_WRITE_ERROR',
  COMPRESSION_ERROR: 'COMPRESSION_ERROR',
  SIZE_LIMIT_EXCEEDED: 'SIZE_LIMIT_EXCEEDED',
  EXPORT_CANCELLED: 'EXPORT_CANCELLED'
} as const;

// Export warning codes
export const EXPORT_WARNING_CODES = {
  LOW_CONFIDENCE: 'LOW_CONFIDENCE',
  MISSING_EMBEDDINGS: 'MISSING_EMBEDDINGS',
  UNBALANCED_CONVERSATION: 'UNBALANCED_CONVERSATION',
  HIGH_TOKEN_COUNT: 'HIGH_TOKEN_COUNT',
  NO_CONTENT_CHANGE: 'NO_CONTENT_CHANGE',
  HIGH_ERROR_RATE: 'HIGH_ERROR_RATE',
  LONG_PROCESSING_TIME: 'LONG_PROCESSING_TIME'
} as const;