/**
 * Document API service for handling document operations
 */
import { apiClient, type APIDocument, type PaginatedResponse } from './client';

// Request Types
export interface DocumentUploadRequest {
  file: File;
  auto_process?: boolean;
  confidence_threshold?: number;
  preferred_tools?: string[];
}

export interface DocumentUpdateRequest {
  filename?: string;
  auto_process?: boolean;
}

export interface DocumentListParams {
  page?: number;
  size?: number;
  status?: 'uploaded' | 'processing' | 'completed' | 'failed';
  search?: string;
  sort_by?: 'created_at' | 'filename' | 'file_size_bytes' | 'page_count';
  sort_order?: 'asc' | 'desc';
}

export interface DocumentStats {
  total_documents: number;
  total_size_bytes: number;
  total_size_human: string;
  by_status: Record<string, number>;
  by_file_type: Record<string, number>;
  processing_stats: {
    average_processing_time: number;
    average_pages_per_document: number;
    total_zones_detected: number;
  };
}

export interface DocumentValidationResult {
  is_valid: boolean;
  file_type: string;
  estimated_pages: number;
  warnings: string[];
  errors: string[];
}

// Response Types
export interface DocumentUploadResponse {
  document: APIDocument;
  processing_job_id?: string;
  message: string;
}

export class DocumentAPI {
  /**
   * Upload a new document
   */
  async uploadDocument(
    request: DocumentUploadRequest,
    onProgress?: (progress: number) => void
  ): Promise<DocumentUploadResponse> {
    const { file, ...options } = request;
    
    return apiClient.uploadFile<DocumentUploadResponse>(
      '/documents/upload',
      file,
      options,
      onProgress
    );
  }

  /**
   * Get a specific document by ID
   */
  async getDocument(documentId: string): Promise<APIDocument> {
    return apiClient.get<APIDocument>(`/documents/${documentId}`);
  }

  /**
   * Get document status (lightweight version)
   */
  async getDocumentStatus(documentId: string): Promise<{
    document_id: string;
    status: string;
    processing_started_at?: string;
    processing_completed_at?: string;
    progress: number;
    current_zone_id?: string;
    total_zones: number;
    completed_zones: number;
    error_message?: string;
    is_complete: boolean;
    processing_status: string;
  }> {
    return apiClient.get(`/documents/${documentId}/status`);
  }

  /**
   * Update document metadata
   */
  async updateDocument(
    documentId: string,
    updates: DocumentUpdateRequest
  ): Promise<APIDocument> {
    return apiClient.patch<APIDocument>(`/documents/${documentId}`, updates);
  }

  /**
   * Delete a document
   */
  async deleteDocument(documentId: string): Promise<{ message: string }> {
    return apiClient.delete(`/documents/${documentId}`);
  }

  /**
   * List documents with pagination and filtering
   */
  async listDocuments(params: DocumentListParams = {}): Promise<PaginatedResponse<APIDocument>> {
    return apiClient.get<PaginatedResponse<APIDocument>>('/documents', params);
  }

  /**
   * Get document statistics
   */
  async getDocumentStats(): Promise<DocumentStats> {
    return apiClient.get<DocumentStats>('/documents/stats');
  }

  /**
   * Validate a document before upload
   */
  async validateDocument(file: File): Promise<DocumentValidationResult> {
    return apiClient.uploadFile<DocumentValidationResult>(
      '/documents/validate',
      file
    );
  }

  /**
   * Download original document file
   */
  async downloadDocument(
    documentId: string,
    filename?: string,
    onProgress?: (progress: number) => void
  ): Promise<Blob> {
    return apiClient.downloadFile(
      `/documents/${documentId}/download`,
      filename,
      onProgress
    );
  }

  /**
   * Bulk delete documents
   */
  async bulkDeleteDocuments(documentIds: string[]): Promise<{
    deleted_count: number;
    failed_deletions: Array<{
      document_id: string;
      error: string;
    }>;
  }> {
    return apiClient.post('/documents/bulk-delete', {
      document_ids: documentIds
    });
  }

  /**
   * Get document thumbnail/preview
   */
  async getDocumentThumbnail(
    documentId: string,
    page = 1,
    size: 'small' | 'medium' | 'large' = 'medium'
  ): Promise<Blob> {
    return apiClient.downloadFile(
      `/documents/${documentId}/thumbnail?page=${page}&size=${size}`
    );
  }

  /**
   * Get document processing history
   */
  async getDocumentHistory(documentId: string): Promise<Array<{
    id: string;
    action: string;
    timestamp: string;
    user_id?: string;
    details: Record<string, any>;
  }>> {
    return apiClient.get(`/documents/${documentId}/history`);
  }
}

// Export singleton instance
export const documentAPI = new DocumentAPI(); 