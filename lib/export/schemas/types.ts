/**
 * Export Format Type Definitions
 * Core TypeScript interfaces for all export formats
 */

// Base Types
export type ExportFormat = 'rag' | 'jsonl' | 'corrections' | 'manifest' | 'log';
export type ContentType = 'text' | 'table' | 'diagram' | 'mixed';
export type CorrectionCategory = 'spelling' | 'formatting' | 'content' | 'structure';
export type ImpactLevel = 'low' | 'medium' | 'high';
export type ProcessingStatus = 'pending' | 'processing' | 'completed' | 'error';

// RAG Export Format
export interface RAGChunk {
  id: string;
  content: string;
  metadata: RAGMetadata;
  embeddings?: number[];
  chunkIndex: number;
  totalChunks: number;
  overlap: {
    previous: number;
    next: number;
  };
}

export interface RAGMetadata {
  source: string;
  documentId: string;
  pageNumber: number;
  pageRange?: { start: number; end: number };
  zoneId: string;
  zoneIds?: string[]; // When chunk spans multiple zones
  confidence: number;
  timestamp: string;
  processingTool: string;
  contentType: ContentType;
  language?: string;
  keywords?: string[];
  entities?: Entity[];
}

export interface Entity {
  text: string;
  type: string;
  confidence: number;
  position: { start: number; end: number };
}

// Fine-Tuning JSONL Format
export interface FineTuningExample {
  messages: FineTuningMessage[];
  metadata: FineTuningMetadata;
}

export interface FineTuningMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface FineTuningMetadata {
  source: string;
  documentId: string;
  pageNumber?: number;
  quality_score: number;
  example_type: 'qa' | 'instruction' | 'chat' | 'extraction';
  domain?: string;
  complexity?: 'simple' | 'moderate' | 'complex';
  tokens?: number;
}

// Corrections Export Format
export interface CorrectionExport {
  id: string;
  timestamp: string;
  userId: string;
  documentId: string;
  zoneId: string;
  original: CorrectionContent;
  corrected: CorrectionContent;
  category: CorrectionCategory;
  impact: ImpactLevel;
  confidence_change: number;
  validation?: ValidationResult;
}

export interface CorrectionContent {
  content: string;
  confidence: number;
  tool: string;
  processingTime?: number;
  metadata?: Record<string, any>;
}

export interface ValidationResult {
  validator: string;
  score: number;
  issues: string[];
  suggestions: string[];
}

// Zone Manifest Format
export interface ZoneManifest {
  documentId: string;
  documentName: string;
  totalPages: number;
  totalZones: number;
  processingTime: number;
  exportTimestamp: string;
  zones: ZoneDetails[];
  statistics: ProcessingStatistics;
  toolUsage: ToolUsageReport[];
}

export interface ZoneDetails {
  id: string;
  page: number;
  coordinates: BoundingBox;
  contentType: ContentType;
  content: string;
  confidence: number;
  status: ProcessingStatus;
  tool: string;
  processingHistory: ProcessingEvent[];
  corrections?: CorrectionSummary[];
  metadata: Record<string, any>;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ProcessingEvent {
  timestamp: string;
  tool: string;
  action: string;
  result: 'success' | 'failure' | 'partial';
  confidence?: number;
  duration: number;
}

export interface CorrectionSummary {
  correctionId: string;
  timestamp: string;
  category: CorrectionCategory;
  impact: ImpactLevel;
}

export interface ProcessingStatistics {
  averageConfidence: number;
  confidenceDistribution: Record<string, number>;
  processingTimeByTool: Record<string, number>;
  successRate: number;
  correctionRate: number;
  contentTypeDistribution: Record<ContentType, number>;
}

export interface ToolUsageReport {
  tool: string;
  invocations: number;
  successCount: number;
  failureCount: number;
  averageProcessingTime: number;
  averageConfidence: number;
  contentTypes: ContentType[];
}

// Human-Readable Log Format
export interface ExportLog {
  header: LogHeader;
  summary: LogSummary;
  sections: LogSection[];
  errors: ErrorEntry[];
  warnings: WarningEntry[];
  footer: LogFooter;
}

export interface LogHeader {
  title: string;
  exportId: string;
  timestamp: string;
  documentName: string;
  exportFormats: ExportFormat[];
  version: string;
}

export interface LogSummary {
  totalItems: number;
  successfulExports: number;
  failedExports: number;
  processingTime: number;
  fileSizes: Record<ExportFormat, number>;
  highlights: string[];
}

export interface LogSection {
  title: string;
  level: number;
  content: string | string[] | Record<string, any>;
  subsections?: LogSection[];
}

export interface ErrorEntry {
  timestamp: string;
  code: string;
  message: string;
  context: Record<string, any>;
  stackTrace?: string;
}

export interface WarningEntry {
  timestamp: string;
  code: string;
  message: string;
  context: Record<string, any>;
  suggestion?: string;
}

export interface LogFooter {
  generatedAt: string;
  exportDuration: number;
  platformVersion: string;
  additionalNotes?: string[];
}

// Export Result Types
export interface ExportResult {
  exportId: string;
  format: ExportFormat;
  status: 'success' | 'partial' | 'failure';
  filePath?: string;
  fileSize?: number;
  itemCount?: number;
  errors?: ExportError[];
  warnings?: ExportWarning[];
  metadata: Record<string, any>;
}

export interface ExportError {
  code: string;
  message: string;
  item?: string;
  details?: any;
}

export interface ExportWarning {
  code: string;
  message: string;
  item?: string;
  suggestion?: string;
}

// Export Options
export interface ExportOptions {
  formats: ExportFormatOptions;
  validation: ValidationOptions;
  output: OutputOptions;
}

export interface ExportFormatOptions {
  rag?: RAGExportOptions;
  jsonl?: JSONLExportOptions;
  corrections?: CorrectionsExportOptions;
  manifest?: ManifestExportOptions;
  log?: LogExportOptions;
}

export interface RAGExportOptions {
  chunkSize: number;
  overlapPercentage: number;
  includeEmbeddings: boolean;
  metadataFields: string[];
  chunkingStrategy: 'token' | 'sentence' | 'paragraph';
  maxChunkSize?: number;
  minChunkSize?: number;
}

export interface JSONLExportOptions {
  qualityThreshold: number;
  maxExamplesPerDocument: number;
  conversationStyle: 'qa' | 'instruction' | 'chat';
  systemPrompt: string;
  includeLowQuality: boolean;
  balanceExamples: boolean;
}

export interface CorrectionsExportOptions {
  includeOriginal: boolean;
  groupByCategory: boolean;
  minImpactLevel: ImpactLevel;
  dateRange?: { start: Date; end: Date };
  includeValidation: boolean;
  sortBy: 'timestamp' | 'impact' | 'category';
}

export interface ManifestExportOptions {
  includeVisualPreviews: boolean;
  detailLevel: 'summary' | 'detailed' | 'verbose';
  includeProcessingLogs: boolean;
  includeCorrections: boolean;
  includeMetrics: boolean;
}

export interface LogExportOptions {
  format: 'markdown' | 'plain' | 'json' | 'html';
  includeDebugInfo: boolean;
  sectionsToInclude: string[];
  maxErrorDetails: number;
  timestampFormat: string;
}

export interface ValidationOptions {
  strictMode: boolean;
  schemaValidation: boolean;
  contentValidation: boolean;
  sizeLimit?: number;
  customValidators?: string[];
}

export interface OutputOptions {
  directory: string;
  fileNamePattern: string;
  compression?: 'none' | 'gzip' | 'zip';
  splitLargeFiles: boolean;
  maxFileSize?: number;
}