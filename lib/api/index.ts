/**
 * API module exports
 */

// Core API client
export { apiClient, APIClient, APIError, type PaginatedResponse, type ErrorResponse, type SuccessResponse } from './client';

// Document API
export { documentAPI, DocumentAPI } from './documents';
export type { 
  DocumentUploadRequest, 
  DocumentUpdateRequest, 
  DocumentListParams,
  DocumentStats,
  DocumentValidationResult,
  DocumentUploadResponse 
} from './documents';

// Processing API  
export { processingAPI, ProcessingAPI } from './processing';
export type {
  ProcessingRequest,
  ZoneUpdateRequest,
  ProcessingJobListParams,
  ZoneListParams,
  ProcessingResponse,
  ProcessingStats,
  ZoneStats,
  ProcessingHistory
} from './processing';

// Export API
export { exportAPI, ExportAPI } from './export';
export type {
  ExportRequest,
  ExportOptions,
  ZoneSelection,
  BulkExportRequest,
  ExportListParams,
  ExportResponse,
  ExportStats,
  ExportValidationResult,
  ExportFile
} from './export'; 