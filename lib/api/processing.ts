/**
 * Processing API service for handling processing job operations
 */
import { apiClient, type APIProcessingJob, type APIZone, type PaginatedResponse } from './client';

// Request Types
export interface ProcessingRequest {
  document_id: string;
  strategy?: 'fast' | 'balanced' | 'thorough';
  tools?: string[];
  confidence_threshold?: number;
  priority?: 'low' | 'normal' | 'high';
}

export interface ZoneUpdateRequest {
  content?: string;
  confidence?: number;
  zone_type?: 'text' | 'table' | 'figure' | 'header' | 'footer';
  reprocess?: boolean;
  tool_preference?: string;
}

export interface ProcessingJobListParams {
  page?: number;
  size?: number;
  status?: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  document_id?: string;
  strategy?: 'fast' | 'balanced' | 'thorough';
  sort_by?: 'created_at' | 'progress_percentage' | 'duration';
  sort_order?: 'asc' | 'desc';
}

export interface ZoneListParams {
  page?: number;
  size?: number;
  document_id: string;
  zone_type?: 'text' | 'table' | 'figure' | 'header' | 'footer';
  status?: 'detected' | 'processing' | 'processed' | 'error';
  min_confidence?: number;
  page_number?: number;
}

// Response Types
export interface ProcessingResponse {
  job: APIProcessingJob;
  message: string;
}

export interface ProcessingStats {
  total_jobs: number;
  active_jobs: number;
  completed_jobs: number;
  failed_jobs: number;
  average_processing_time: number;
  average_zones_per_document: number;
  processing_capacity: {
    current_capacity: number;
    max_capacity: number;
    queue_length: number;
  };
}

export interface ZoneStats {
  total_zones: number;
  by_type: Record<string, number>;
  by_status: Record<string, number>;
  average_confidence: number;
  confidence_distribution: {
    high: number; // > 0.8
    medium: number; // 0.5 - 0.8
    low: number; // < 0.5
  };
}

export interface ProcessingHistory {
  job_id: string;
  document_id: string;
  status: string;
  strategy: string;
  tools: string[];
  started_at: string;
  completed_at?: string;
  duration?: number;
  zones_processed: number;
  success_rate: number;
  error_message?: string;
}

export class ProcessingAPI {
  /**
   * Start processing a document
   */
  async startProcessing(request: ProcessingRequest): Promise<ProcessingResponse> {
    return apiClient.post<ProcessingResponse>('/process/start', request);
  }

  /**
   * Get processing job status
   */
  async getProcessingStatus(jobId: string): Promise<APIProcessingJob> {
    return apiClient.get<APIProcessingJob>(`/process/status/${jobId}`);
  }

  /**
   * Cancel a processing job
   */
  async cancelProcessing(jobId: string): Promise<{ message: string }> {
    return apiClient.post(`/process/cancel/${jobId}`);
  }

  /**
   * Retry a failed processing job
   */
  async retryProcessing(
    jobId: string,
    options?: {
      strategy?: 'fast' | 'balanced' | 'thorough';
      tools?: string[];
    }
  ): Promise<ProcessingResponse> {
    return apiClient.post<ProcessingResponse>(`/process/retry/${jobId}`, options);
  }

  /**
   * Get zones for a document
   */
  async getDocumentZones(params: ZoneListParams): Promise<PaginatedResponse<APIZone>> {
    return apiClient.get<PaginatedResponse<APIZone>>('/process/zones', params);
  }

  /**
   * Update a specific zone
   */
  async updateZone(
    zoneId: string,
    updates: ZoneUpdateRequest
  ): Promise<APIZone> {
    return apiClient.patch<APIZone>(`/process/zones/${zoneId}`, updates);
  }

  /**
   * Delete a zone
   */
  async deleteZone(zoneId: string): Promise<{ message: string }> {
    return apiClient.delete(`/process/zones/${zoneId}`);
  }

  /**
   * Create a new zone manually
   */
  async createZone(zone: {
    document_id: string;
    page_number: number;
    coordinates: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
    zone_type: 'text' | 'table' | 'figure' | 'header' | 'footer';
    content?: string;
  }): Promise<APIZone> {
    return apiClient.post<APIZone>('/process/zones', zone);
  }

  /**
   * List processing jobs with filtering
   */
  async listProcessingJobs(params: ProcessingJobListParams = {}): Promise<PaginatedResponse<APIProcessingJob>> {
    return apiClient.get<PaginatedResponse<APIProcessingJob>>('/process/jobs', params);
  }

  /**
   * Get processing statistics
   */
  async getProcessingStats(): Promise<ProcessingStats> {
    return apiClient.get<ProcessingStats>('/process/stats');
  }

  /**
   * Get processing job history for a document
   */
  async getJobHistory(documentId: string): Promise<ProcessingHistory[]> {
    return apiClient.get<ProcessingHistory[]>(`/process/history/${documentId}`);
  }

  /**
   * Pause a processing job
   */
  async pauseProcessingJob(jobId: string): Promise<{ message: string }> {
    return apiClient.post(`/process/pause/${jobId}`);
  }

  /**
   * Resume a paused processing job
   */
  async resumeProcessingJob(jobId: string): Promise<{ message: string }> {
    return apiClient.post(`/process/resume/${jobId}`);
  }

  /**
   * Get zone statistics for a document
   */
  async getZoneStats(documentId: string): Promise<ZoneStats> {
    return apiClient.get<ZoneStats>(`/process/zones/stats/${documentId}`);
  }

  /**
   * Bulk update zones
   */
  async bulkUpdateZones(updates: Array<{
    zone_id: string;
    updates: ZoneUpdateRequest;
  }>): Promise<{
    updated_count: number;
    failed_updates: Array<{
      zone_id: string;
      error: string;
    }>;
  }> {
    return apiClient.post('/process/zones/bulk-update', {
      zone_updates: updates
    });
  }

  /**
   * Reprocess specific zones
   */
  async reprocessZones(
    zoneIds: string[],
    options?: {
      tool_preference?: string;
      confidence_threshold?: number;
    }
  ): Promise<{
    job_id: string;
    zones_count: number;
    message: string;
  }> {
    return apiClient.post('/process/zones/reprocess', {
      zone_ids: zoneIds,
      ...options
    });
  }

  /**
   * Get available processing tools
   */
  async getAvailableTools(): Promise<Array<{
    name: string;
    description: string;
    supported_types: string[];
    estimated_time_per_zone: number;
    confidence_score: number;
    is_available: boolean;
  }>> {
    return apiClient.get('/process/tools');
  }

  /**
   * Get processing capacity information
   */
  async getProcessingCapacity(): Promise<{
    current_jobs: number;
    max_concurrent_jobs: number;
    queue_length: number;
    estimated_wait_time: number;
    available_tools: string[];
  }> {
    return apiClient.get('/process/capacity');
  }
}

// Export singleton instance
export const processingAPI = new ProcessingAPI(); 