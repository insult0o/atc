/**
 * Batch Export Manager
 * Handles multiple export operations with queue management and priority handling
 */

import { ExportFormat } from './schemas/types';
import { ExportSelection } from '@/app/components/export/SelectionPanel';
import { PartialExportEngine, PartialExportConfig } from './partial-export-engine';
import { Zone } from '@/lib/types/zone';

export interface BatchExportConfig {
  maxConcurrent: number;
  priorityLevels: number;
  retryPolicy: RetryPolicy;
  resourceLimits: ResourceLimits;
}

export interface RetryPolicy {
  maxRetries: number;
  retryDelayMs: number;
  exponentialBackoff: boolean;
  retryableErrors: string[];
}

export interface ResourceLimits {
  maxMemoryMB: number;
  maxQueueSize: number;
  maxProcessingTimeMs: number;
  pauseOnResourceLimit: boolean;
}

export interface ExportJob {
  id: string;
  document: any;
  selection: ExportSelection;
  formats: ExportFormat[];
  config: PartialExportConfig;
  priority: number;
  status: 'queued' | 'processing' | 'complete' | 'failed' | 'cancelled';
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  retryCount: number;
  error?: Error;
  result?: any;
}

export interface QueueStatus {
  totalJobs: number;
  queuedJobs: number;
  processingJobs: number;
  completedJobs: number;
  failedJobs: number;
  averageWaitTime: number;
  averageProcessingTime: number;
  estimatedTimeRemaining: number;
}

export interface ExportWorker {
  id: string;
  status: 'idle' | 'busy' | 'paused';
  currentJob?: ExportJob;
  jobsProcessed: number;
  startTime: Date;
  lastActivityTime: Date;
}

export class BatchExportManager {
  private queue: PriorityQueue<ExportJob>;
  private workers: Map<string, ExportWorker>;
  private jobs: Map<string, ExportJob>;
  private config: BatchExportConfig;
  private exportEngine: PartialExportEngine;
  private scheduler: ExportScheduler;
  private resourceMonitor: ResourceMonitor;
  private isPaused: boolean = false;
  private onJobComplete?: (job: ExportJob) => void;
  private onJobFailed?: (job: ExportJob, error: Error) => void;

  constructor(config?: Partial<BatchExportConfig>) {
    this.config = {
      maxConcurrent: 3,
      priorityLevels: 5,
      retryPolicy: {
        maxRetries: 3,
        retryDelayMs: 1000,
        exponentialBackoff: true,
        retryableErrors: ['TIMEOUT', 'NETWORK_ERROR', 'RESOURCE_LIMIT']
      },
      resourceLimits: {
        maxMemoryMB: 512,
        maxQueueSize: 100,
        maxProcessingTimeMs: 300000, // 5 minutes
        pauseOnResourceLimit: true
      },
      ...config
    };

    this.queue = new PriorityQueue(this.config.priorityLevels);
    this.workers = new Map();
    this.jobs = new Map();
    this.exportEngine = new PartialExportEngine();
    this.scheduler = new ExportScheduler(this);
    this.resourceMonitor = new ResourceMonitor(this.config.resourceLimits);

    this.initializeWorkers();
  }

  /**
   * Add job to queue
   */
  async addJob(
    document: any,
    selection: ExportSelection,
    formats: ExportFormat[],
    config: PartialExportConfig,
    priority: number = 2
  ): Promise<string> {
    if (this.queue.size() >= this.config.resourceLimits.maxQueueSize) {
      throw new Error('Queue is full');
    }

    const job: ExportJob = {
      id: this.generateJobId(),
      document,
      selection,
      formats,
      config,
      priority: Math.max(0, Math.min(this.config.priorityLevels - 1, priority)),
      status: 'queued',
      createdAt: new Date(),
      retryCount: 0
    };

    this.jobs.set(job.id, job);
    this.queue.add(job, job.priority);
    
    // Start processing if not already
    this.processQueue();

    return job.id;
  }

  /**
   * Add multiple jobs as a batch
   */
  async addBatch(
    jobs: Array<{
      document: any;
      selection: ExportSelection;
      formats: ExportFormat[];
      config: PartialExportConfig;
      priority?: number;
    }>
  ): Promise<string[]> {
    const jobIds: string[] = [];

    for (const jobData of jobs) {
      try {
        const id = await this.addJob(
          jobData.document,
          jobData.selection,
          jobData.formats,
          jobData.config,
          jobData.priority
        );
        jobIds.push(id);
      } catch (error) {
        console.error('Failed to add job to batch:', error);
      }
    }

    return jobIds;
  }

  /**
   * Cancel a job
   */
  cancelJob(jobId: string): boolean {
    const job = this.jobs.get(jobId);
    if (!job) return false;

    if (job.status === 'queued') {
      this.queue.remove(jobId);
      job.status = 'cancelled';
      job.completedAt = new Date();
      return true;
    }

    if (job.status === 'processing') {
      // Mark for cancellation - worker will handle it
      job.status = 'cancelled';
      return true;
    }

    return false;
  }

  /**
   * Cancel multiple jobs
   */
  cancelBatch(jobIds: string[]): number {
    let cancelled = 0;
    jobIds.forEach(id => {
      if (this.cancelJob(id)) {
        cancelled++;
      }
    });
    return cancelled;
  }

  /**
   * Change job priority
   */
  reprioritizeJob(jobId: string, newPriority: number): boolean {
    const job = this.jobs.get(jobId);
    if (!job || job.status !== 'queued') return false;

    this.queue.remove(jobId);
    job.priority = Math.max(0, Math.min(this.config.priorityLevels - 1, newPriority));
    this.queue.add(job, job.priority);

    return true;
  }

  /**
   * Get job status
   */
  getJobStatus(jobId: string): ExportJob | undefined {
    return this.jobs.get(jobId);
  }

  /**
   * Get batch status
   */
  getBatchStatus(jobIds: string[]): ExportJob[] {
    return jobIds
      .map(id => this.jobs.get(id))
      .filter((job): job is ExportJob => job !== undefined);
  }

  /**
   * Get queue status
   */
  getQueueStatus(): QueueStatus {
    const jobs = Array.from(this.jobs.values());
    
    const status: QueueStatus = {
      totalJobs: jobs.length,
      queuedJobs: jobs.filter(j => j.status === 'queued').length,
      processingJobs: jobs.filter(j => j.status === 'processing').length,
      completedJobs: jobs.filter(j => j.status === 'complete').length,
      failedJobs: jobs.filter(j => j.status === 'failed').length,
      averageWaitTime: 0,
      averageProcessingTime: 0,
      estimatedTimeRemaining: 0
    };

    // Calculate average times
    const completedJobs = jobs.filter(j => j.completedAt);
    if (completedJobs.length > 0) {
      const waitTimes = completedJobs.map(j => 
        (j.startedAt?.getTime() || 0) - j.createdAt.getTime()
      );
      const processingTimes = completedJobs.map(j => 
        (j.completedAt?.getTime() || 0) - (j.startedAt?.getTime() || 0)
      );

      status.averageWaitTime = waitTimes.reduce((a, b) => a + b, 0) / waitTimes.length;
      status.averageProcessingTime = processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length;
    }

    // Estimate remaining time
    if (status.averageProcessingTime > 0) {
      const remainingJobs = status.queuedJobs + status.processingJobs;
      const effectiveWorkers = Math.min(remainingJobs, this.config.maxConcurrent);
      status.estimatedTimeRemaining = (remainingJobs / effectiveWorkers) * status.averageProcessingTime;
    }

    return status;
  }

  /**
   * Pause processing
   */
  pause(): void {
    this.isPaused = true;
    this.workers.forEach(worker => {
      if (worker.status === 'busy') {
        worker.status = 'paused';
      }
    });
  }

  /**
   * Resume processing
   */
  resume(): void {
    this.isPaused = false;
    this.workers.forEach(worker => {
      if (worker.status === 'paused') {
        worker.status = 'idle';
      }
    });
    this.processQueue();
  }

  /**
   * Set callbacks
   */
  onComplete(callback: (job: ExportJob) => void): void {
    this.onJobComplete = callback;
  }

  onFailed(callback: (job: ExportJob, error: Error) => void): void {
    this.onJobFailed = callback;
  }

  /**
   * Clean up completed jobs
   */
  cleanupCompleted(olderThanMs: number = 3600000): number {
    const cutoffTime = Date.now() - olderThanMs;
    let cleaned = 0;

    Array.from(this.jobs.entries()).forEach(([id, job]) => {
      if (
        ['complete', 'failed', 'cancelled'].includes(job.status) &&
        job.completedAt &&
        job.completedAt.getTime() < cutoffTime
      ) {
        this.jobs.delete(id);
        cleaned++;
      }
    });

    return cleaned;
  }

  /**
   * Private methods
   */

  private initializeWorkers(): void {
    for (let i = 0; i < this.config.maxConcurrent; i++) {
      const worker: ExportWorker = {
        id: `worker_${i}`,
        status: 'idle',
        jobsProcessed: 0,
        startTime: new Date(),
        lastActivityTime: new Date()
      };
      this.workers.set(worker.id, worker);
    }
  }

  private async processQueue(): Promise<void> {
    if (this.isPaused) return;

    // Check resource limits
    if (this.config.resourceLimits.pauseOnResourceLimit) {
      const resourceCheck = await this.resourceMonitor.checkResources();
      if (!resourceCheck.canProceed) {
        console.log('Resource limit reached, pausing queue');
        setTimeout(() => this.processQueue(), 5000);
        return;
      }
    }

    // Find idle workers
    const idleWorkers = Array.from(this.workers.values()).filter(
      w => w.status === 'idle'
    );

    // Assign jobs to idle workers
    for (const worker of idleWorkers) {
      const job = this.queue.getNext();
      if (!job) break;

      job.status = 'processing';
      job.startedAt = new Date();
      
      worker.status = 'busy';
      worker.currentJob = job;
      worker.lastActivityTime = new Date();

      // Process job asynchronously
      this.processJob(job, worker).catch(error => {
        console.error(`Worker ${worker.id} failed to process job ${job.id}:`, error);
      });
    }
  }

  private async processJob(job: ExportJob, worker: ExportWorker): Promise<void> {
    try {
      // Check if cancelled
      if (job.status === 'cancelled') {
        throw new Error('Job cancelled');
      }

      // Set timeout
      const timeoutId = setTimeout(() => {
        throw new Error('Job timeout');
      }, this.config.resourceLimits.maxProcessingTimeMs);

      // Process export
      const allZones = job.document.zones || [];
      const result = await this.exportEngine.exportPartial(
        job.document,
        job.config,
        allZones
      );

      clearTimeout(timeoutId);

      // Update job
      job.status = 'complete';
      job.completedAt = new Date();
      job.result = result;

      // Update worker
      worker.jobsProcessed++;
      
      // Callback
      if (this.onJobComplete) {
        this.onJobComplete(job);
      }

    } catch (error) {
      await this.handleJobError(job, error as Error);
    } finally {
      // Reset worker
      worker.status = 'idle';
      worker.currentJob = undefined;
      worker.lastActivityTime = new Date();

      // Process next job
      this.processQueue();
    }
  }

  private async handleJobError(job: ExportJob, error: Error): Promise<void> {
    job.error = error;
    
    // Check if retryable
    const isRetryable = this.config.retryPolicy.retryableErrors.some(
      code => error.message.includes(code)
    );

    if (isRetryable && job.retryCount < this.config.retryPolicy.maxRetries) {
      // Schedule retry
      job.retryCount++;
      job.status = 'queued';
      
      const delay = this.config.retryPolicy.exponentialBackoff
        ? this.config.retryPolicy.retryDelayMs * Math.pow(2, job.retryCount - 1)
        : this.config.retryPolicy.retryDelayMs;

      setTimeout(() => {
        this.queue.add(job, job.priority);
        this.processQueue();
      }, delay);

    } else {
      // Mark as failed
      job.status = 'failed';
      job.completedAt = new Date();

      // Callback
      if (this.onJobFailed) {
        this.onJobFailed(job, error);
      }
    }
  }

  private generateJobId(): string {
    return `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Destroy manager
   */
  destroy(): void {
    this.isPaused = true;
    this.workers.clear();
    this.jobs.clear();
    this.queue.clear();
    this.exportEngine.destroy();
  }
}

/**
 * Priority Queue implementation
 */
class PriorityQueue<T extends { id: string }> {
  private queues: Map<number, T[]>;
  private itemMap: Map<string, { item: T; priority: number }>;

  constructor(private levels: number) {
    this.queues = new Map();
    this.itemMap = new Map();
    
    for (let i = 0; i < levels; i++) {
      this.queues.set(i, []);
    }
  }

  add(item: T, priority: number): void {
    const queue = this.queues.get(priority);
    if (!queue) throw new Error(`Invalid priority: ${priority}`);

    queue.push(item);
    this.itemMap.set(item.id, { item, priority });
  }

  getNext(): T | undefined {
    // Check from highest to lowest priority
    for (let p = this.levels - 1; p >= 0; p--) {
      const queue = this.queues.get(p);
      if (queue && queue.length > 0) {
        const item = queue.shift()!;
        this.itemMap.delete(item.id);
        return item;
      }
    }
    return undefined;
  }

  remove(itemId: string): boolean {
    const entry = this.itemMap.get(itemId);
    if (!entry) return false;

    const queue = this.queues.get(entry.priority);
    if (!queue) return false;

    const index = queue.findIndex(item => item.id === itemId);
    if (index !== -1) {
      queue.splice(index, 1);
      this.itemMap.delete(itemId);
      return true;
    }

    return false;
  }

  size(): number {
    return this.itemMap.size;
  }

  clear(): void {
    this.queues.forEach(queue => queue.length = 0);
    this.itemMap.clear();
  }
}

/**
 * Export Scheduler
 */
class ExportScheduler {
  constructor(private manager: BatchExportManager) {}

  scheduleAt(date: Date, jobData: any): NodeJS.Timeout {
    const delay = date.getTime() - Date.now();
    return setTimeout(() => {
      this.manager.addJob(
        jobData.document,
        jobData.selection,
        jobData.formats,
        jobData.config,
        jobData.priority
      );
    }, Math.max(0, delay));
  }

  scheduleRecurring(
    intervalMs: number,
    jobData: any
  ): NodeJS.Timer {
    return setInterval(() => {
      this.manager.addJob(
        jobData.document,
        jobData.selection,
        jobData.formats,
        jobData.config,
        jobData.priority
      );
    }, intervalMs);
  }
}

/**
 * Resource Monitor
 */
class ResourceMonitor {
  constructor(private limits: ResourceLimits) {}

  async checkResources(): Promise<{ canProceed: boolean; reason?: string }> {
    // Check memory usage (simplified - in real app would use actual memory monitoring)
    const memoryUsage = process.memoryUsage?.() || { heapUsed: 0 };
    const memoryMB = memoryUsage.heapUsed / 1024 / 1024;

    if (memoryMB > this.limits.maxMemoryMB) {
      return { canProceed: false, reason: 'Memory limit exceeded' };
    }

    return { canProceed: true };
  }
}