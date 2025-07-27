/**
 * Export API service for handling export operations
 */
import { apiClient, type APIExportRecord, type PaginatedResponse } from './client';

// Request Types
export interface ExportRequest {
  document_id: string;
  export_type?: 'manual' | 'batch' | 'scheduled';
  formats: ('json' | 'jsonl' | 'csv' | 'txt' | 'corrections' | 'log')[];
  options: ExportOptions;
  zone_selection?: ZoneSelection;
}

export interface ExportOptions {
  include_metadata?: boolean;
  include_confidence?: boolean;
  include_coordinates?: boolean;
  include_timestamps?: boolean;
  format_specific?: {
    json?: {
      pretty_print?: boolean;
      include_schema?: boolean;
    };
    jsonl?: {
      chunk_size?: number;
    };
    csv?: {
      delimiter?: string;
      include_headers?: boolean;
    };
    corrections?: {
      validation_level?: 'basic' | 'detailed' | 'comprehensive';
      include_suggestions?: boolean;
    };
  };
}

export interface ZoneSelection {
  zone_ids?: string[];
  zone_types?: ('text' | 'table' | 'figure' | 'header' | 'footer')[];
  page_ranges?: Array<{
    start: number;
    end: number;
  }>;
  min_confidence?: number;
  exclude_manual_overrides?: boolean;
}

export interface BulkExportRequest {
  document_ids: string[];
  export_options: ExportOptions;
  formats: ('json' | 'jsonl' | 'csv' | 'txt' | 'corrections' | 'log')[];
  archive_format?: 'zip' | 'tar';
}

export interface ExportListParams {
  page?: number;
  size?: number;
  document_id?: string;
  status?: 'pending' | 'processing' | 'completed' | 'failed';
  export_type?: 'manual' | 'batch' | 'scheduled';
  sort_by?: 'created_at' | 'file_count' | 'total_file_size';
  sort_order?: 'asc' | 'desc';
  include_expired?: boolean;
}

// Response Types
export interface ExportResponse {
  export_record: APIExportRecord;
  estimated_completion_time?: string;
  message: string;
}

export interface ExportStats {
  total_exports: number;
  completed_exports: number;
  failed_exports: number;
  total_files_generated: number;
  total_size_exported: number;
  total_size_exported_human: string;
  by_format: Record<string, number>;
  by_status: Record<string, number>;
  average_export_time: number;
}

export interface ExportValidationResult {
  is_valid: boolean;
  estimated_file_count: number;
  estimated_size_bytes: number;
  estimated_size_human: string;
  format_warnings: Record<string, string[]>;
  zone_count: number;
  warnings: string[];
  errors: string[];
}

export interface ExportFile {
  filename: string;
  format: string;
  size_bytes: number;
  size_human: string;
  download_url: string;
  expires_at?: string;
}

export class ExportAPI {
  /**
   * Generate export preview
   */
  async previewExport(request: ExportRequest): Promise<any> {
    return apiClient.post('/export/preview', request);
  }

  /**
   * Generate export file
   */
  async generateExport(request: ExportRequest): Promise<ExportResponse> {
    return apiClient.post<ExportResponse>('/export/generate', request);
  }

  /**
   * Get export status
   */
  async getExportStatus(exportId: string): Promise<APIExportRecord> {
    return apiClient.get<APIExportRecord>(`/export/${exportId}/status`);
  }

  /**
   * Download export file
   */
  async downloadExport(
    exportId: string,
    format: string,
    filename?: string,
    onProgress?: (progress: number) => void
  ): Promise<Blob> {
    const endpoint = `/export/${exportId}/download?format=${format}`;
    return apiClient.downloadFile(endpoint, filename, onProgress);
  }

  /**
   * Validate export configuration before starting
   */
  async validateExport(request: ExportRequest): Promise<ExportValidationResult> {
    return apiClient.post<ExportValidationResult>('/export/validate', request);
  }

  /**
   * Delete an export record and associated files
   */
  async deleteExport(exportId: string): Promise<{ message: string }> {
    return apiClient.delete(`/export/${exportId}`);
  }

  /**
   * List exports with filtering and pagination
   */
  async listExports(params: ExportListParams = {}): Promise<PaginatedResponse<APIExportRecord>> {
    return apiClient.get<PaginatedResponse<APIExportRecord>>('/export', params);
  }

  /**
   * Get export statistics
   */
  async getExportStats(): Promise<ExportStats> {
    return apiClient.get<ExportStats>('/export/stats');
  }

  /**
   * Get exports for a specific document
   */
  async getDocumentExports(
    documentId: string,
    includeExpired = false
  ): Promise<APIExportRecord[]> {
    return apiClient.get<APIExportRecord[]>(`/documents/${documentId}/exports`, {
      include_expired: includeExpired
    });
  }

  /**
   * Start bulk export for multiple documents
   */
  async bulkExport(request: BulkExportRequest): Promise<ExportResponse> {
    return apiClient.post<ExportResponse>('/export/bulk', request);
  }

  /**
   * Cancel an export job
   */
  async cancelExport(exportId: string): Promise<{ message: string }> {
    return apiClient.post(`/export/cancel/${exportId}`);
  }

  /**
   * Cleanup expired exports
   */
  async cleanupExpiredExports(): Promise<{
    cleaned_exports: number;
    freed_space_bytes: number;
    freed_space_human: string;
  }> {
    return apiClient.post('/export/cleanup');
  }

  /**
   * Get export files information
   */
  async getExportFiles(exportId: string): Promise<ExportFile[]> {
    return apiClient.get<ExportFile[]>(`/export/${exportId}/files`);
  }

  /**
   * Re-run a failed export
   */
  async retryExport(
    exportId: string,
    options?: {
      retry_failed_formats_only?: boolean;
      update_options?: Partial<ExportOptions>;
    }
  ): Promise<ExportResponse> {
    return apiClient.post<ExportResponse>(`/export/retry/${exportId}`, options);
  }

  /**
   * Get export templates/presets
   */
  async getExportTemplates(): Promise<Array<{
    id: string;
    name: string;
    description: string;
    formats: string[];
    options: ExportOptions;
    is_system: boolean;
  }>> {
    return apiClient.get('/export/templates');
  }

  /**
   * Save export configuration as template
   */
  async saveExportTemplate(template: {
    name: string;
    description: string;
    formats: string[];
    options: ExportOptions;
  }): Promise<{ id: string; message: string }> {
    return apiClient.post('/export/templates', template);
  }

  /**
   * Get available export formats
   */
  async getAvailableFormats(): Promise<Array<{
    format: string;
    name: string;
    description: string;
    file_extension: string;
    supports_metadata: boolean;
    supports_coordinates: boolean;
    max_file_size?: number;
    typical_compression_ratio?: number;
  }>> {
    return apiClient.get('/export/formats');
  }

  /**
   * Preview export data (first few items)
   */
  async previewExport(
    request: ExportRequest,
    format: string,
    limit = 10
  ): Promise<{
    preview_data: any[];
    total_items: number;
    estimated_file_size: number;
  }> {
    return apiClient.post(`/export/preview/${format}`, {
      ...request,
      preview_limit: limit
    });
  }

  /**
   * Schedule recurring export
   */
  async scheduleRecurringExport(schedule: {
    document_id: string;
    export_options: ExportOptions;
    formats: string[];
    cron_expression: string;
    timezone?: string;
    max_retries?: number;
    notification_settings?: {
      email?: string;
      webhook_url?: string;
    };
  }): Promise<{
    schedule_id: string;
    next_run: string;
    message: string;
  }> {
    return apiClient.post('/export/schedule', schedule);
  }
}

// Export singleton instance
export const exportAPI = new ExportAPI(); 