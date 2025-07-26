/**
 * Core API client for communicating with the FastAPI backend
 */

// Backend API Types (matching our Pydantic models)
export interface APIDocument {
  id: string;
  filename: string;
  file_path: string;
  file_size_bytes: number;
  mime_type: string;
  page_count: number;
  status: 'uploaded' | 'processing' | 'completed' | 'failed';
  processing_duration?: number;
  file_size_human: string;
  zones_count: number;
  created_at: string;
  updated_at: string;
}

export interface APIZone {
  id: string;
  document_id: string;
  page_number: number;
  coordinates: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  zone_type: 'text' | 'table' | 'figure' | 'header' | 'footer';
  content: string;
  confidence: number;
  status: 'detected' | 'processing' | 'processed' | 'error';
  tool_used?: string;
  content_preview: string;
  word_count: number;
  character_count: number;
  created_at: string;
  updated_at: string;
}

export interface APIProcessingJob {
  id: string;
  document_id: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  strategy: 'fast' | 'balanced' | 'thorough';
  tools: string[];
  progress_percentage: number;
  current_page: number;
  total_pages: number;
  zones_processed: number;
  zones_detected: number;
  duration?: number;
  zones_per_minute?: number;
  success_rate?: number;
  error_message?: string;
  created_at: string;
  updated_at: string;
}

export interface APIExportRecord {
  id: string;
  document_id: string;
  export_type: 'manual' | 'batch' | 'scheduled';
  formats: ('json' | 'jsonl' | 'csv' | 'txt' | 'corrections' | 'log')[];
  status: 'pending' | 'processing' | 'completed' | 'failed';
  file_count: number;
  total_file_size: number;
  total_file_size_human: string;
  download_count: number;
  expires_at?: string;
  is_expired: boolean;
  duration?: number;
  created_at: string;
  updated_at: string;
}

// Request/Response Types
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

export interface ErrorResponse {
  error: string;
  code: string;
  details?: Record<string, any>;
  timestamp: string;
  request_id: string;
}

export interface SuccessResponse {
  message: string;
  data?: Record<string, any>;
  timestamp: string;
  request_id: string;
}

// API Client Configuration
interface APIClientConfig {
  baseURL: string;
  timeout: number;
  headers: Record<string, string>;
  retries: number;
  retryDelay: number;
}

// Custom API Error
export class APIError extends Error {
  constructor(
    public status: number,
    public code: string,
    public details?: Record<string, any>,
    public requestId?: string
  ) {
    super(`API Error ${status}: ${code}`);
    this.name = 'APIError';
  }
}

// Main API Client Class
export class APIClient {
  private config: APIClientConfig;
  private baseURL: string;

  constructor(config: Partial<APIClientConfig> = {}) {
    this.config = {
      baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000',
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
      retries: 3,
      retryDelay: 1000,
      ...config,
    };
    this.baseURL = `${this.config.baseURL}/api/v1`;
  }

  private async fetch<T>(
    endpoint: string,
    options: RequestInit = {},
    retryCount = 0
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          ...this.config.headers,
          ...options.headers,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new APIError(
          response.status,
          errorData.code || 'UNKNOWN_ERROR',
          errorData.details,
          errorData.request_id
        );
      }

      return await response.json();
    } catch (error: unknown) {
      clearTimeout(timeoutId);

      // Retry logic for network errors
      if (
        retryCount < this.config.retries &&
        (error instanceof TypeError || (error as Error)?.name === 'AbortError')
      ) {
        await new Promise(resolve => 
          setTimeout(resolve, this.config.retryDelay * Math.pow(2, retryCount))
        );
        return this.fetch(endpoint, options, retryCount + 1);
      }

      throw error;
    }
  }

  // Generic CRUD methods
  async get<T>(endpoint: string, params?: Record<string, any>): Promise<T> {
    const url = new URL(`${this.baseURL}${endpoint}`);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.append(key, String(value));
        }
      });
    }

    return this.fetch(url.pathname + url.search);
  }

  async post<T>(endpoint: string, data?: any): Promise<T> {
    return this.fetch(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async put<T>(endpoint: string, data?: any): Promise<T> {
    return this.fetch(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async patch<T>(endpoint: string, data?: any): Promise<T> {
    return this.fetch(endpoint, {
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async delete<T>(endpoint: string): Promise<T> {
    return this.fetch(endpoint, {
      method: 'DELETE',
    });
  }

  // File upload with progress
  async uploadFile<T>(
    endpoint: string,
    file: File,
    additionalFields?: Record<string, any>,
    onProgress?: (progress: number) => void
  ): Promise<T> {
    const formData = new FormData();
    formData.append('file', file);

    if (additionalFields) {
      Object.entries(additionalFields).forEach(([key, value]) => {
        formData.append(key, typeof value === 'string' ? value : JSON.stringify(value));
      });
    }

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      if (onProgress) {
        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            const progress = (event.loaded / event.total) * 100;
            onProgress(progress);
          }
        });
      }

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const response = JSON.parse(xhr.responseText);
            resolve(response);
          } catch (error) {
            reject(new Error('Invalid JSON response'));
          }
        } else {
          try {
            const errorData = JSON.parse(xhr.responseText);
            reject(new APIError(
              xhr.status,
              errorData.code || 'UPLOAD_ERROR',
              errorData.details,
              errorData.request_id
            ));
          } catch {
            reject(new APIError(xhr.status, 'UPLOAD_ERROR'));
          }
        }
      });

      xhr.addEventListener('error', () => {
        reject(new APIError(0, 'NETWORK_ERROR'));
      });

      xhr.addEventListener('timeout', () => {
        reject(new APIError(0, 'TIMEOUT_ERROR'));
      });

      xhr.timeout = this.config.timeout;
      xhr.open('POST', `${this.baseURL}${endpoint}`);

      // Add any custom headers except Content-Type (browser will set it for FormData)
      Object.entries(this.config.headers).forEach(([key, value]) => {
        if (key.toLowerCase() !== 'content-type') {
          xhr.setRequestHeader(key, value);
        }
      });

      xhr.send(formData);
    });
  }

  // File download with progress
  async downloadFile(
    endpoint: string,
    filename?: string,
    onProgress?: (progress: number) => void
  ): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.responseType = 'blob';

      if (onProgress) {
        xhr.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            const progress = (event.loaded / event.total) * 100;
            onProgress(progress);
          }
        });
      }

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          const blob = xhr.response;
          
          // Trigger download if filename provided
          if (filename) {
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
          }
          
          resolve(blob);
        } else {
          reject(new APIError(xhr.status, 'DOWNLOAD_ERROR'));
        }
      });

      xhr.addEventListener('error', () => {
        reject(new APIError(0, 'NETWORK_ERROR'));
      });

      xhr.open('GET', `${this.baseURL}${endpoint}`);
      Object.entries(this.config.headers).forEach(([key, value]) => {
        xhr.setRequestHeader(key, value);
      });

      xhr.send();
    });
  }

  // Health check
  async healthCheck(): Promise<{ status: string; version: string; timestamp: number }> {
    return this.fetch('/health');
  }
}

// Create singleton instance
export const apiClient = new APIClient(); 