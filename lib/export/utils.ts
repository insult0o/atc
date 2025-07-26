/**
 * Export Utilities
 * Common utility functions for export operations
 */

import {
  ExportFormat,
  ExportResult,
  ExportOptions,
  ExportError,
  ExportWarning
} from './schemas';

interface Document {
  id: string;
  name: string;
  pageCount: number;
  zones: any[];
  corrections?: any[];
}

interface ExportSession {
  sessionId: string;
  documentId: string;
  documentName: string;
  formats: ExportFormat[];
  options: ExportOptions;
  startTime: Date;
  endTime?: Date;
  results: Map<ExportFormat, ExportResult>;
  errors: ExportError[];
  warnings: ExportWarning[];
}

/**
 * Create a new export session
 */
export function createExportSession(
  documentId: string,
  documentName: string,
  formats: ExportFormat[],
  options: ExportOptions
): ExportSession {
  return {
    sessionId: generateSessionId(),
    documentId,
    documentName,
    formats,
    options,
    startTime: new Date(),
    results: new Map(),
    errors: [],
    warnings: []
  };
}

/**
 * Validate if document is ready for export
 */
export function validateExportReadiness(document: Document, formats: ExportFormat[]): {
  ready: boolean;
  blockers: string[];
  warnings: string[];
} {
  const blockers: string[] = [];
  const warnings: string[] = [];

  // Check basic document requirements
  if (!document.zones || document.zones.length === 0) {
    blockers.push('Document has no processed zones');
  }

  // Check format-specific requirements
  formats.forEach(format => {
    switch (format) {
      case 'rag':
        const textZones = document.zones.filter(z => z.contentType === 'text' && z.content);
        if (textZones.length === 0) {
          blockers.push('No text content available for RAG export');
        }
        break;

      case 'jsonl':
        const qualityZones = document.zones.filter(z => z.confidence > 0.5);
        if (qualityZones.length < 5) {
          warnings.push('Limited high-quality content for training data generation');
        }
        break;

      case 'corrections':
        if (!document.corrections || document.corrections.length === 0) {
          blockers.push('No corrections available for export');
        }
        break;

      case 'manifest':
        // Manifest can always be generated
        break;

      case 'log':
        // Log can always be generated
        break;
    }
  });

  // Check processing status
  const processingZones = document.zones.filter(z => z.status === 'processing');
  if (processingZones.length > 0) {
    warnings.push(`${processingZones.length} zones are still processing`);
  }

  const errorZones = document.zones.filter(z => z.status === 'error');
  if (errorZones.length > 0) {
    warnings.push(`${errorZones.length} zones failed processing`);
  }

  return {
    ready: blockers.length === 0,
    blockers,
    warnings
  };
}

/**
 * Calculate estimated export size
 */
export function calculateExportSize(document: Document, formats: ExportFormat[]): {
  estimatedSize: number;
  breakdown: Record<ExportFormat, number>;
} {
  const breakdown: Record<ExportFormat, number> = {} as any;
  let totalSize = 0;

  formats.forEach(format => {
    let formatSize = 0;

    switch (format) {
      case 'rag':
        // Estimate based on content size + metadata overhead
        const totalContent = document.zones.reduce((sum, z) => sum + (z.content?.length || 0), 0);
        formatSize = totalContent * 1.5; // 50% overhead for metadata
        break;

      case 'jsonl':
        // Estimate based on conversation pairs
        const estimatedPairs = document.zones.length * 2;
        formatSize = estimatedPairs * 300; // Average 300 chars per training example
        break;

      case 'corrections':
        const correctionCount = document.corrections?.length || 0;
        formatSize = correctionCount * 500; // Average 500 chars per correction
        break;

      case 'manifest':
        // Base manifest + zone details
        formatSize = 10000 + (document.zones.length * 200); // Base + 200 chars per zone
        break;

      case 'log':
        // Estimate log size based on export complexity
        formatSize = 5000 + (formats.length * 1000); // Base + per format
        break;
    }

    breakdown[format] = formatSize;
    totalSize += formatSize;
  });

  return {
    estimatedSize: totalSize,
    breakdown
  };
}

/**
 * Format export results for display
 */
export function formatExportResults(session: ExportSession): {
  summary: string;
  details: Array<{
    format: ExportFormat;
    status: string;
    itemCount: number;
    fileSize?: number;
    errors: number;
    warnings: number;
    duration?: number;
  }>;
  overallStatus: 'success' | 'partial' | 'failure';
} {
  const details = Array.from(session.results.entries()).map(([format, result]) => ({
    format,
    status: result.status,
    itemCount: result.itemCount || 0,
    fileSize: result.fileSize,
    errors: result.errors?.length || 0,
    warnings: result.warnings?.length || 0,
    duration: result.metadata?.processingTime
  }));

  const totalErrors = details.reduce((sum, d) => sum + d.errors, 0);
  const totalItems = details.reduce((sum, d) => sum + d.itemCount, 0);
  const successfulFormats = details.filter(d => d.status === 'success').length;

  let overallStatus: 'success' | 'partial' | 'failure';
  if (successfulFormats === details.length) {
    overallStatus = 'success';
  } else if (successfulFormats > 0) {
    overallStatus = 'partial';
  } else {
    overallStatus = 'failure';
  }

  const duration = session.endTime && session.startTime 
    ? (session.endTime.getTime() - session.startTime.getTime()) / 1000
    : undefined;

  const summary = [
    `Exported ${totalItems.toLocaleString()} items`,
    `${successfulFormats}/${details.length} formats successful`,
    duration ? `in ${duration.toFixed(1)}s` : 'in progress',
    totalErrors > 0 ? `with ${totalErrors} errors` : ''
  ].filter(Boolean).join(' ');

  return {
    summary,
    details,
    overallStatus
  };
}

/**
 * Generate session ID
 */
function generateSessionId(): string {
  return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(unitIndex > 0 ? 1 : 0)}${units[unitIndex]}`;
}

/**
 * Format duration for display
 */
export function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${seconds.toFixed(1)}s`;
  } else if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.round(seconds % 60);
    return `${minutes}m ${remainingSeconds}s`;
  } else {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  }
}

/**
 * Create export file name
 */
export function createExportFileName(
  pattern: string,
  variables: {
    documentName: string;
    format: ExportFormat;
    timestamp?: string;
    sessionId?: string;
  }
): string {
  const timestamp = variables.timestamp || new Date().toISOString().replace(/[:.]/g, '-');
  
  return pattern
    .replace('{documentName}', sanitizeFileName(variables.documentName))
    .replace('{format}', variables.format)
    .replace('{timestamp}', timestamp)
    .replace('{sessionId}', variables.sessionId || 'unknown');
}

/**
 * Sanitize file name
 */
function sanitizeFileName(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9\-_\.]/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^_|_$/g, '');
}

/**
 * Merge export options
 */
export function mergeExportOptions(
  base: ExportOptions,
  override: Partial<ExportOptions>
): ExportOptions {
  return {
    formats: { ...base.formats, ...override.formats },
    validation: { ...base.validation, ...override.validation },
    output: { ...base.output, ...override.output }
  };
}

/**
 * Check if export format is supported
 */
export function isFormatSupported(format: string): format is ExportFormat {
  const supportedFormats: ExportFormat[] = ['rag', 'jsonl', 'corrections', 'manifest', 'log'];
  return supportedFormats.includes(format as ExportFormat);
}

/**
 * Get format display name
 */
export function getFormatDisplayName(format: ExportFormat): string {
  const displayNames: Record<ExportFormat, string> = {
    'rag': 'RAG Chunks',
    'jsonl': 'Training Data (JSONL)',
    'corrections': 'User Corrections',
    'manifest': 'Zone Manifest',
    'log': 'Export Log'
  };

  return displayNames[format] || format.toUpperCase();
}

/**
 * Get format description
 */
export function getFormatDescription(format: ExportFormat): string {
  const descriptions: Record<ExportFormat, string> = {
    'rag': 'JSON chunks optimized for Retrieval-Augmented Generation with metadata and embeddings',
    'jsonl': 'Training examples in JSONL format for fine-tuning language models',
    'corrections': 'Complete audit trail of user corrections with categorization and impact analysis',
    'manifest': 'Comprehensive report of all zones with processing details and statistics',
    'log': 'Human-readable export log with progress details and error reporting'
  };

  return descriptions[format] || 'Export format';
}

/**
 * Validate export configuration
 */
export function validateExportConfiguration(options: ExportOptions): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check if at least one format is specified
  if (!options.formats || Object.keys(options.formats).length === 0) {
    errors.push('At least one export format must be specified');
  }

  // Validate output directory
  if (!options.output?.directory) {
    errors.push('Output directory must be specified');
  }

  // Validate file name pattern
  if (!options.output?.fileNamePattern) {
    errors.push('File name pattern must be specified');
  }

  // Format-specific validations
  if (options.formats.rag) {
    if (options.formats.rag.chunkSize < 100) {
      errors.push('RAG chunk size must be at least 100 characters');
    }
    if (options.formats.rag.overlapPercentage < 0 || options.formats.rag.overlapPercentage > 0.5) {
      errors.push('RAG overlap percentage must be between 0 and 0.5');
    }
  }

  if (options.formats.jsonl) {
    if (options.formats.jsonl.qualityThreshold < 0 || options.formats.jsonl.qualityThreshold > 1) {
      errors.push('JSONL quality threshold must be between 0 and 1');
    }
    if (options.formats.jsonl.qualityThreshold < 0.7) {
      warnings.push('Low quality threshold may result in poor training data');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}