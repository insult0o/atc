/**
 * Processing store for managing processing jobs and real-time progress
 */
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { processingAPI, type ProcessingRequest, type ZoneUpdateRequest } from '../api/processing';

// Frontend types
export interface ProcessingJob {
  id: string;
  documentId: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  strategy: 'fast' | 'balanced' | 'thorough';
  tools: string[];
  progressPercentage: number;
  currentPage: number;
  totalPages: number;
  zonesProcessed: number;
  zonesDetected: number;
  duration?: number;
  zonesPerMinute?: number;
  successRate?: number;
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Zone {
  id: string;
  documentId: string;
  pageNumber: number;
  coordinates: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  zoneType: 'text' | 'table' | 'figure' | 'header' | 'footer';
  content: string;
  confidence: number;
  status: 'detected' | 'processing' | 'processed' | 'error';
  toolUsed?: string;
  contentPreview: string;
  wordCount: number;
  characterCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProcessingProgress {
  jobId: string;
  documentId: string;
  stage: string;
  progressPercentage: number;
  currentPage: number;
  totalPages: number;
  zonesProcessed: number;
  zonesDetected: number;
  etaSeconds?: number;
  message?: string;
  errorsCount: number;
  lastError?: any;
}

export interface ProcessingCapacity {
  currentJobs: number;
  maxConcurrentJobs: number;
  queueLength: number;
  estimatedWaitTime: number;
  availableTools: string[];
}

export interface ProcessingStats {
  totalJobs: number;
  activeJobs: number;
  completedJobs: number;
  failedJobs: number;
  averageProcessingTime: number;
  averageZonesPerDocument: number;
  processingCapacity: {
    currentCapacity: number;
    maxCapacity: number;
    queueLength: number;
  };
}

export interface ProcessingError {
  jobId?: string;
  zoneId?: string;
  message: string;
  code?: string;
  timestamp: Date;
}

interface ProcessingStore {
  // State
  jobs: Record<string, ProcessingJob>;
  zones: Record<string, Zone>;
  progress: Record<string, ProcessingProgress>;
  activeJobIds: string[];
  selectedJobId: string | null;
  capacity: ProcessingCapacity | null;
  stats: ProcessingStats | null;
  loading: boolean;
  error: ProcessingError | null;
  
  // Job management
  setJob: (job: ProcessingJob) => void;
  updateJob: (jobId: string, updates: Partial<ProcessingJob>) => void;
  removeJob: (jobId: string) => void;
  setSelectedJob: (jobId: string | null) => void;
  
  // Zone management
  setZones: (zones: Zone[]) => void;
  setZone: (zone: Zone) => void;
  updateZone: (zoneId: string, updates: Partial<Zone>) => void;
  removeZone: (zoneId: string) => void;
  
  // Progress tracking
  setProgress: (jobId: string, progress: ProcessingProgress) => void;
  updateProgress: (jobId: string, updates: Partial<ProcessingProgress>) => void;
  clearProgress: (jobId: string) => void;
  
  // API operations
  startProcessing: (request: ProcessingRequest) => Promise<ProcessingJob>;
  loadJobStatus: (jobId: string) => Promise<ProcessingJob>;
  loadJobs: (filters?: { documentId?: string; status?: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled' }) => Promise<void>;
  cancelProcessing: (jobId: string) => Promise<void>;
  retryProcessing: (jobId: string, options?: { strategy?: 'fast' | 'balanced' | 'thorough'; tools?: string[] }) => Promise<ProcessingJob>;
  pauseProcessing: (jobId: string) => Promise<void>;
  resumeProcessing: (jobId: string) => Promise<void>;
  
  // Zone operations
  loadZones: (documentId: string) => Promise<void>;
  updateZoneContent: (zoneId: string, updates: ZoneUpdateRequest) => Promise<Zone>;
  deleteZone: (zoneId: string) => Promise<void>;
  createZone: (zone: Omit<Zone, 'id' | 'createdAt' | 'updatedAt' | 'contentPreview' | 'wordCount' | 'characterCount'>) => Promise<Zone>;
  bulkUpdateZones: (updates: Array<{ zoneId: string; updates: ZoneUpdateRequest }>) => Promise<void>;
  reprocessZones: (zoneIds: string[], options?: { toolPreference?: string; confidenceThreshold?: number }) => Promise<string>;
  
  // Statistics and capacity
  loadStats: () => Promise<void>;
  loadCapacity: () => Promise<void>;
  loadAvailableTools: () => Promise<Array<{ name: string; description: string; supportedTypes: string[] }>>;
  
  // Error handling
  setError: (error: ProcessingError | null) => void;
  clearError: () => void;
  
  // Utilities
  getJobsByDocument: (documentId: string) => ProcessingJob[];
  getZonesByDocument: (documentId: string) => Zone[];
  getActiveJobs: () => ProcessingJob[];
  getCompletedJobs: () => ProcessingJob[];
  
  // Reset
  reset: () => void;
}

// Helper functions to convert API responses to frontend types
function convertAPIProcessingJob(apiJob: any): ProcessingJob {
  return {
    id: apiJob.id,
    documentId: apiJob.document_id,
    status: apiJob.status,
    strategy: apiJob.strategy,
    tools: apiJob.tools,
    progressPercentage: apiJob.progress_percentage,
    currentPage: apiJob.current_page,
    totalPages: apiJob.total_pages,
    zonesProcessed: apiJob.zones_processed,
    zonesDetected: apiJob.zones_detected,
    duration: apiJob.duration,
    zonesPerMinute: apiJob.zones_per_minute,
    successRate: apiJob.success_rate,
    errorMessage: apiJob.error_message,
    createdAt: new Date(apiJob.created_at),
    updatedAt: new Date(apiJob.updated_at)
  };
}

function convertAPIZone(apiZone: any): Zone {
  return {
    id: apiZone.id,
    documentId: apiZone.document_id,
    pageNumber: apiZone.page_number,
    coordinates: apiZone.coordinates,
    zoneType: apiZone.zone_type,
    content: apiZone.content,
    confidence: apiZone.confidence,
    status: apiZone.status,
    toolUsed: apiZone.tool_used,
    contentPreview: apiZone.content_preview,
    wordCount: apiZone.word_count,
    characterCount: apiZone.character_count,
    createdAt: new Date(apiZone.created_at),
    updatedAt: new Date(apiZone.updated_at)
  };
}

export const useProcessingStore = create<ProcessingStore>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    jobs: {},
    zones: {},
    progress: {},
    activeJobIds: [],
    selectedJobId: null,
    capacity: null,
    stats: null,
    loading: false,
    error: null,
    
    // Job management
    setJob: (job) => set((state) => {
      const jobs = { ...state.jobs, [job.id]: job };
      const activeJobIds = Object.values(jobs)
        .filter(j => j.status === 'running' || j.status === 'queued')
        .map(j => j.id);
      
      return { jobs, activeJobIds };
    }),
    
    updateJob: (jobId, updates) => set((state) => ({
      jobs: {
        ...state.jobs,
        [jobId]: { ...state.jobs[jobId], ...updates }
      }
    })),
    
    removeJob: (jobId) => set((state) => {
      const { [jobId]: removed, ...jobs } = state.jobs;
      const { [jobId]: removedProgress, ...progress } = state.progress;
      const activeJobIds = state.activeJobIds.filter(id => id !== jobId);
      
      return {
        jobs,
        progress,
        activeJobIds,
        selectedJobId: state.selectedJobId === jobId ? null : state.selectedJobId
      };
    }),
    
    setSelectedJob: (jobId) => set({ selectedJobId: jobId }),
    
    // Zone management
    setZones: (zones) => set({
      zones: zones.reduce((acc, zone) => {
        acc[zone.id] = zone;
        return acc;
      }, {} as Record<string, Zone>)
    }),
    
    setZone: (zone) => set((state) => ({
      zones: { ...state.zones, [zone.id]: zone }
    })),
    
    updateZone: (zoneId, updates) => set((state) => ({
      zones: {
        ...state.zones,
        [zoneId]: { ...state.zones[zoneId], ...updates }
      }
    })),
    
    removeZone: (zoneId) => set((state) => {
      const { [zoneId]: removed, ...zones } = state.zones;
      return { zones };
    }),
    
    // Progress tracking
    setProgress: (jobId, progress) => set((state) => ({
      progress: { ...state.progress, [jobId]: progress }
    })),
    
    updateProgress: (jobId, updates) => set((state) => ({
      progress: {
        ...state.progress,
        [jobId]: { ...state.progress[jobId], ...updates }
      }
    })),
    
    clearProgress: (jobId) => set((state) => {
      const { [jobId]: removed, ...progress } = state.progress;
      return { progress };
    }),
    
    // API operations
    startProcessing: async (request) => {
      set({ loading: true, error: null });
      
      try {
        const response = await processingAPI.startProcessing(request);
        const job = convertAPIProcessingJob(response.job);
        
        get().setJob(job);
        set({ loading: false });
        
        return job;
        
      } catch (error: any) {
        set({
          loading: false,
          error: {
            message: error.message || 'Failed to start processing',
            code: error.code,
            timestamp: new Date()
          }
        });
        throw error;
      }
    },
    
    loadJobStatus: async (jobId) => {
      try {
        const apiJob = await processingAPI.getProcessingStatus(jobId);
        const job = convertAPIProcessingJob(apiJob);
        
        get().setJob(job);
        return job;
        
      } catch (error: any) {
        set({
          error: {
            jobId,
            message: error.message || 'Failed to load job status',
            code: error.code,
            timestamp: new Date()
          }
        });
        throw error;
      }
    },
    
    loadJobs: async (filters = {}) => {
      set({ loading: true, error: null });
      
      try {
        const response = await processingAPI.listProcessingJobs(filters);
        const jobs = response.items.map(convertAPIProcessingJob);
        
        set({
          jobs: jobs.reduce((acc, job) => {
            acc[job.id] = job;
            return acc;
          }, {} as Record<string, ProcessingJob>),
          activeJobIds: jobs
            .filter(j => j.status === 'running' || j.status === 'queued')
            .map(j => j.id),
          loading: false
        });
        
      } catch (error: any) {
        set({
          loading: false,
          error: {
            message: error.message || 'Failed to load jobs',
            code: error.code,
            timestamp: new Date()
          }
        });
        throw error;
      }
    },
    
    cancelProcessing: async (jobId) => {
      try {
        await processingAPI.cancelProcessing(jobId);
        get().updateJob(jobId, { status: 'cancelled' });
        
      } catch (error: any) {
        set({
          error: {
            jobId,
            message: error.message || 'Failed to cancel processing',
            code: error.code,
            timestamp: new Date()
          }
        });
        throw error;
      }
    },
    
    retryProcessing: async (jobId, options = {}) => {
      try {
        const response = await processingAPI.retryProcessing(jobId, options);
        const job = convertAPIProcessingJob(response.job);
        
        get().setJob(job);
        return job;
        
      } catch (error: any) {
        set({
          error: {
            jobId,
            message: error.message || 'Failed to retry processing',
            code: error.code,
            timestamp: new Date()
          }
        });
        throw error;
      }
    },
    
    pauseProcessing: async (jobId) => {
      try {
        await processingAPI.pauseProcessingJob(jobId);
        get().updateJob(jobId, { status: 'queued' }); // Assuming paused jobs go to queued state
        
      } catch (error: any) {
        set({
          error: {
            jobId,
            message: error.message || 'Failed to pause processing',
            code: error.code,
            timestamp: new Date()
          }
        });
        throw error;
      }
    },
    
    resumeProcessing: async (jobId) => {
      try {
        await processingAPI.resumeProcessingJob(jobId);
        get().updateJob(jobId, { status: 'running' });
        
      } catch (error: any) {
        set({
          error: {
            jobId,
            message: error.message || 'Failed to resume processing',
            code: error.code,
            timestamp: new Date()
          }
        });
        throw error;
      }
    },
    
    // Zone operations
    loadZones: async (documentId) => {
      set({ loading: true, error: null });
      
      try {
        const response = await processingAPI.getDocumentZones({ document_id: documentId });
        const zones = response.items.map(convertAPIZone);
        
        get().setZones(zones);
        set({ loading: false });
        
      } catch (error: any) {
        set({
          loading: false,
          error: {
            message: error.message || 'Failed to load zones',
            code: error.code,
            timestamp: new Date()
          }
        });
        throw error;
      }
    },
    
    updateZoneContent: async (zoneId, updates) => {
      try {
        const apiZone = await processingAPI.updateZone(zoneId, updates);
        const zone = convertAPIZone(apiZone);
        
        get().setZone(zone);
        return zone;
        
      } catch (error: any) {
        set({
          error: {
            zoneId,
            message: error.message || 'Failed to update zone',
            code: error.code,
            timestamp: new Date()
          }
        });
        throw error;
      }
    },
    
    deleteZone: async (zoneId) => {
      try {
        await processingAPI.deleteZone(zoneId);
        get().removeZone(zoneId);
        
      } catch (error: any) {
        set({
          error: {
            zoneId,
            message: error.message || 'Failed to delete zone',
            code: error.code,
            timestamp: new Date()
          }
        });
        throw error;
      }
    },
    
    createZone: async (zoneData) => {
      try {
        const apiZone = await processingAPI.createZone({
          document_id: zoneData.documentId,
          page_number: zoneData.pageNumber,
          coordinates: zoneData.coordinates,
          zone_type: zoneData.zoneType,
          content: zoneData.content
        });
        
        const zone = convertAPIZone(apiZone);
        get().setZone(zone);
        return zone;
        
      } catch (error: any) {
        set({
          error: {
            message: error.message || 'Failed to create zone',
            code: error.code,
            timestamp: new Date()
          }
        });
        throw error;
      }
    },
    
    bulkUpdateZones: async (updates) => {
      try {
        const apiUpdates = updates.map(u => ({
          zone_id: u.zoneId,
          updates: u.updates
        }));
        
        const result = await processingAPI.bulkUpdateZones(apiUpdates);
        
        if (result.failed_updates.length > 0) {
          set({
            error: {
              message: `${result.failed_updates.length} zones could not be updated`,
              timestamp: new Date()
            }
          });
        }
        
      } catch (error: any) {
        set({
          error: {
            message: error.message || 'Failed to bulk update zones',
            code: error.code,
            timestamp: new Date()
          }
        });
        throw error;
      }
    },
    
    reprocessZones: async (zoneIds, options = {}) => {
      try {
        const result = await processingAPI.reprocessZones(zoneIds, {
          tool_preference: options.toolPreference,
          confidence_threshold: options.confidenceThreshold
        });
        
        return result.job_id;
        
      } catch (error: any) {
        set({
          error: {
            message: error.message || 'Failed to reprocess zones',
            code: error.code,
            timestamp: new Date()
          }
        });
        throw error;
      }
    },
    
    // Statistics and capacity
    loadStats: async () => {
      try {
        const stats = await processingAPI.getProcessingStats();
        set({ stats: {
          totalJobs: stats.total_jobs,
          activeJobs: stats.active_jobs,
          completedJobs: stats.completed_jobs,
          failedJobs: stats.failed_jobs,
          averageProcessingTime: stats.average_processing_time,
          averageZonesPerDocument: stats.average_zones_per_document,
          processingCapacity: {
            currentCapacity: stats.processing_capacity.current_capacity,
            maxCapacity: stats.processing_capacity.max_capacity,
            queueLength: stats.processing_capacity.queue_length
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
    
    loadCapacity: async () => {
      try {
        const capacity = await processingAPI.getProcessingCapacity();
        set({ capacity: {
          currentJobs: capacity.current_jobs,
          maxConcurrentJobs: capacity.max_concurrent_jobs,
          queueLength: capacity.queue_length,
          estimatedWaitTime: capacity.estimated_wait_time,
          availableTools: capacity.available_tools
        }});
        
      } catch (error: any) {
        set({
          error: {
            message: error.message || 'Failed to load capacity',
            code: error.code,
            timestamp: new Date()
          }
        });
      }
    },
    
    loadAvailableTools: async () => {
      try {
        const tools = await processingAPI.getAvailableTools();
        return tools.map(tool => ({
          name: tool.name,
          description: tool.description,
          supportedTypes: tool.supported_types
        }));
        
      } catch (error: any) {
        set({
          error: {
            message: error.message || 'Failed to load tools',
            code: error.code,
            timestamp: new Date()
          }
        });
        return [];
      }
    },
    
    // Error handling
    setError: (error) => set({ error }),
    clearError: () => set({ error: null }),
    
    // Utilities
    getJobsByDocument: (documentId) => {
      const state = get();
      return Object.values(state.jobs).filter(job => job.documentId === documentId);
    },
    
    getZonesByDocument: (documentId) => {
      const state = get();
      return Object.values(state.zones).filter(zone => zone.documentId === documentId);
    },
    
    getActiveJobs: () => {
      const state = get();
      return state.activeJobIds.map(id => state.jobs[id]).filter(Boolean);
    },
    
    getCompletedJobs: () => {
      const state = get();
      return Object.values(state.jobs).filter(job => job.status === 'completed');
    },
    
    // Reset
    reset: () => set({
      jobs: {},
      zones: {},
      progress: {},
      activeJobIds: [],
      selectedJobId: null,
      capacity: null,
      stats: null,
      loading: false,
      error: null
    })
  }))
); 