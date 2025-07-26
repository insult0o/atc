/**
 * Enhanced document store with backend API integration
 */
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { documentAPI, type DocumentUploadRequest } from '../api/documents';
import { processingAPI } from '../api/processing';

// Frontend types (converted from backend API types)
export interface DocumentFilters {
  status?: 'uploaded' | 'processing' | 'completed' | 'failed';
  search?: string;
  sortBy?: 'created_at' | 'filename' | 'file_size_bytes' | 'page_count';
  sortOrder?: 'asc' | 'desc';
}
export interface Document {
  id: string;
  name: string;
  filePath: string;
  fileSize: number;
  fileSizeHuman: string;
  mimeType: string;
  pageCount: number;
  status: 'uploaded' | 'processing' | 'completed' | 'failed';
  processingDuration?: number;
  zonesCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface DocumentUpload {
  id: string;
  file: File;
  progress: number;
  status: 'preparing' | 'uploading' | 'processing' | 'completed' | 'failed';
  error?: string;
  processingJobId?: string;
}

export interface DocumentError {
  documentId?: string;
  message: string;
  code?: string;
  timestamp: Date;
}

interface DocumentStore {
  // State
  documents: Record<string, Document>;
  uploads: Record<string, DocumentUpload>;
  selectedDocumentId: string | null;
  loading: boolean;
  error: DocumentError | null;
  
  // Pagination
  pagination: {
    page: number;
    size: number;
    total: number;
    pages: number;
  };
  
  // Filters
  filters: DocumentFilters;
  
  // Statistics
  stats: {
    totalDocuments: number;
    totalSize: number;
    totalSizeHuman: string;
    byStatus: Record<string, number>;
    byFileType: Record<string, number>;
    processingStats: {
      averageProcessingTime: number;
      averagePagesPerDocument: number;
      totalZonesDetected: number;
    };
  } | null;
  
  // Actions
  setDocuments: (documents: Document[]) => void;
  setDocument: (document: Document) => void;
  updateDocument: (documentId: string, updates: Partial<Document>) => void;
  removeDocument: (documentId: string) => void;
  setSelectedDocument: (documentId: string | null) => void;
  
  // Upload management
  startUpload: (file: File, options?: Partial<DocumentUploadRequest>) => Promise<string>;
  updateUploadProgress: (uploadId: string, progress: number) => void;
  completeUpload: (uploadId: string, document: Document, processingJobId?: string) => void;
  failUpload: (uploadId: string, error: string) => void;
  cancelUpload: (uploadId: string) => void;
  clearCompletedUploads: () => void;
  
  // API operations
  loadDocuments: (refresh?: boolean) => Promise<void>;
  loadDocument: (documentId: string) => Promise<Document>;
  uploadDocument: (file: File, options?: Partial<DocumentUploadRequest>) => Promise<string>;
  deleteDocument: (documentId: string) => Promise<void>;
  bulkDeleteDocuments: (documentIds: string[]) => Promise<void>;
  validateDocument: (file: File) => Promise<boolean>;
  
  // Statistics
  loadStats: () => Promise<void>;
  
  // Filters and pagination
  setFilters: (filters: Partial<DocumentFilters>) => void;
  setPagination: (page: number, size?: number) => void;
  
  // Error handling
  setError: (error: DocumentError | null) => void;
  clearError: () => void;
  
  // Reset
  reset: () => void;
}

// Helper function to convert API document to frontend document
function convertAPIDocument(apiDoc: any): Document {
  return {
    id: apiDoc.id,
    name: apiDoc.filename,
    filePath: apiDoc.file_path,
    fileSize: apiDoc.file_size_bytes,
    fileSizeHuman: apiDoc.file_size_human,
    mimeType: apiDoc.mime_type,
    pageCount: apiDoc.page_count,
    status: apiDoc.status,
    processingDuration: apiDoc.processing_duration,
    zonesCount: apiDoc.zones_count,
    createdAt: new Date(apiDoc.created_at),
    updatedAt: new Date(apiDoc.updated_at)
  };
}

export const useDocumentStore = create<DocumentStore>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    documents: {},
    uploads: {},
    selectedDocumentId: null,
    loading: false,
    error: null,
    
    pagination: {
      page: 1,
      size: 20,
      total: 0,
      pages: 0
    },
    
    filters: {
      sortBy: 'created_at',
      sortOrder: 'desc'
    },
    
    stats: null,
    
    // Basic state management
    setDocuments: (documents) => set((state) => ({
      documents: documents.reduce((acc, doc) => {
        acc[doc.id] = doc;
        return acc;
      }, {} as Record<string, Document>)
    })),
    
    setDocument: (document) => set((state) => ({
      documents: { ...state.documents, [document.id]: document }
    })),
    
    updateDocument: (documentId, updates) => set((state) => ({
      documents: {
        ...state.documents,
        [documentId]: { ...state.documents[documentId], ...updates }
      }
    })),
    
    removeDocument: (documentId) => set((state) => {
      const { [documentId]: removed, ...documents } = state.documents;
      return {
        documents,
        selectedDocumentId: state.selectedDocumentId === documentId ? null : state.selectedDocumentId
      };
    }),
    
    setSelectedDocument: (documentId) => set({ selectedDocumentId: documentId }),
    
    // Upload management
    startUpload: async (file, options = {}) => {
      const uploadId = `upload_${Date.now()}_${Math.random()}`;
      const upload: DocumentUpload = {
        id: uploadId,
        file,
        progress: 0,
        status: 'preparing'
      };
      
      set((state) => ({
        uploads: { ...state.uploads, [uploadId]: upload }
      }));
      
      try {
        // Validate file first
        set((state) => ({
          uploads: {
            ...state.uploads,
            [uploadId]: { ...state.uploads[uploadId], status: 'uploading' }
          }
        }));
        
        const response = await documentAPI.uploadDocument(
          { file, ...options },
          (progress) => {
            set((state) => ({
              uploads: {
                ...state.uploads,
                [uploadId]: { ...state.uploads[uploadId], progress }
              }
            }));
          }
        );
        
        const document = convertAPIDocument(response.document);
        
        // Complete upload and add document
        set((state) => ({
          documents: { ...state.documents, [document.id]: document },
          uploads: {
            ...state.uploads,
            [uploadId]: {
              ...state.uploads[uploadId],
              status: 'completed',
              progress: 100,
              processingJobId: response.processing_job_id
            }
          }
        }));
        
        return document.id;
        
      } catch (error: any) {
        set((state) => ({
          uploads: {
            ...state.uploads,
            [uploadId]: {
              ...state.uploads[uploadId],
              status: 'failed',
              error: error.message || 'Upload failed'
            }
          },
          error: {
            message: error.message || 'Upload failed',
            code: error.code,
            timestamp: new Date()
          }
        }));
        
        throw error;
      }
    },
    
    updateUploadProgress: (uploadId, progress) => set((state) => ({
      uploads: {
        ...state.uploads,
        [uploadId]: { ...state.uploads[uploadId], progress }
      }
    })),
    
    completeUpload: (uploadId, document, processingJobId) => set((state) => ({
      documents: { ...state.documents, [document.id]: document },
      uploads: {
        ...state.uploads,
        [uploadId]: {
          ...state.uploads[uploadId],
          status: 'completed',
          progress: 100,
          processingJobId
        }
      }
    })),
    
    failUpload: (uploadId, error) => set((state) => ({
      uploads: {
        ...state.uploads,
        [uploadId]: { ...state.uploads[uploadId], status: 'failed', error }
      }
    })),
    
    cancelUpload: (uploadId) => set((state) => {
      const { [uploadId]: removed, ...uploads } = state.uploads;
      return { uploads };
    }),
    
    clearCompletedUploads: () => set((state) => {
      const uploads = Object.fromEntries(
        Object.entries(state.uploads).filter(([_, upload]) => 
          upload.status !== 'completed' && upload.status !== 'failed'
        )
      );
      return { uploads };
    }),
    
    // API operations
    loadDocuments: async (refresh = false) => {
      const state = get();
      
      if (state.loading && !refresh) return;
      
      set({ loading: true, error: null });
      
      try {
        const response = await documentAPI.listDocuments({
          page: state.pagination.page,
          size: state.pagination.size,
          ...state.filters
        });
        
        const documents = response.items.map(convertAPIDocument);
        
        set({
          documents: documents.reduce((acc, doc) => {
            acc[doc.id] = doc;
            return acc;
          }, {} as Record<string, Document>),
          pagination: {
            page: response.page,
            size: response.size,
            total: response.total,
            pages: response.pages
          },
          loading: false
        });
        
      } catch (error: any) {
        set({
          loading: false,
          error: {
            message: error.message || 'Failed to load documents',
            code: error.code,
            timestamp: new Date()
          }
        });
        throw error;
      }
    },
    
    loadDocument: async (documentId) => {
      try {
        const apiDoc = await documentAPI.getDocument(documentId);
        const document = convertAPIDocument(apiDoc);
        
        set((state) => ({
          documents: { ...state.documents, [document.id]: document }
        }));
        
        return document;
        
      } catch (error: any) {
        set({
          error: {
            documentId,
            message: error.message || 'Failed to load document',
            code: error.code,
            timestamp: new Date()
          }
        });
        throw error;
      }
    },
    
    uploadDocument: async (file, options = {}) => {
      return get().startUpload(file, options);
    },
    
    deleteDocument: async (documentId) => {
      try {
        await documentAPI.deleteDocument(documentId);
        get().removeDocument(documentId);
        
      } catch (error: any) {
        set({
          error: {
            documentId,
            message: error.message || 'Failed to delete document',
            code: error.code,
            timestamp: new Date()
          }
        });
        throw error;
      }
    },
    
    bulkDeleteDocuments: async (documentIds) => {
      try {
        const result = await documentAPI.bulkDeleteDocuments(documentIds);
        
        // Remove successfully deleted documents
        set((state) => {
          const documents = { ...state.documents };
          documentIds.forEach(id => {
            if (!result.failed_deletions.find(f => f.document_id === id)) {
              delete documents[id];
            }
          });
          return { documents };
        });
        
        // Show error for failed deletions
        if (result.failed_deletions.length > 0) {
          set({
            error: {
              message: `${result.failed_deletions.length} documents could not be deleted`,
              timestamp: new Date()
            }
          });
        }
        
      } catch (error: any) {
        set({
          error: {
            message: error.message || 'Failed to delete documents',
            code: error.code,
            timestamp: new Date()
          }
        });
        throw error;
      }
    },
    
    validateDocument: async (file) => {
      try {
        const result = await documentAPI.validateDocument(file);
        
        if (!result.is_valid) {
          set({
            error: {
              message: `Invalid document: ${result.errors.join(', ')}`,
              timestamp: new Date()
            }
          });
        }
        
        return result.is_valid;
        
      } catch (error: any) {
        set({
          error: {
            message: error.message || 'Failed to validate document',
            code: error.code,
            timestamp: new Date()
          }
        });
        return false;
      }
    },
    
    // Statistics
    loadStats: async () => {
      try {
        const stats = await documentAPI.getDocumentStats();
        set({ stats: {
          totalDocuments: stats.total_documents,
          totalSize: stats.total_size_bytes,
          totalSizeHuman: stats.total_size_human,
          byStatus: stats.by_status,
          byFileType: stats.by_file_type,
          processingStats: {
            averageProcessingTime: stats.processing_stats.average_processing_time,
            averagePagesPerDocument: stats.processing_stats.average_pages_per_document,
            totalZonesDetected: stats.processing_stats.total_zones_detected
          }
        }});
        
      } catch (error: any) {
        set({
          error: {
            message: error.message || 'Failed to load statistics',
            code: error.code,
            timestamp: new Date()
          }
        });
      }
    },
    
    // Filters and pagination
    setFilters: (newFilters) => set((state) => ({
      filters: { ...state.filters, ...newFilters },
      pagination: { ...state.pagination, page: 1 } // Reset to first page
    })),
    
    setPagination: (page, size) => set((state) => ({
      pagination: { ...state.pagination, page, ...(size && { size }) }
    })),
    
    // Error handling
    setError: (error) => set({ error }),
    clearError: () => set({ error: null }),
    
    // Reset
    reset: () => set({
      documents: {},
      uploads: {},
      selectedDocumentId: null,
      loading: false,
      error: null,
      pagination: { page: 1, size: 20, total: 0, pages: 0 },
      filters: { sortBy: 'created_at', sortOrder: 'desc' },
      stats: null
    })
  }))
); 