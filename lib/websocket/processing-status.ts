import { WebSocket } from 'ws';
import { ProcessingResult, QueuedZone, QueueMetrics } from '../pdf-processing/processing-queue';
import { ConfidenceScore } from '../pdf-processing/confidence-engine';
import { FallbackDecision, RetryResult } from '../pdf-processing/fallback-manager';

// Core interfaces for real-time processing status
export interface ProcessingStatusManager {
  initializeConnection(documentId: string, userId: string): Promise<ProcessingConnection>;
  broadcastProcessingUpdate(update: ProcessingStatusUpdate): Promise<void>;
  handleControlCommand(command: ProcessingControlCommand): Promise<ControlCommandResponse>;
  subscribeToZoneUpdates(zoneId: string, callback: ZoneUpdateCallback): Promise<void>;
  unsubscribeFromZoneUpdates(zoneId: string, callback: ZoneUpdateCallback): Promise<void>;
  getProcessingState(documentId: string): Promise<ProcessingState>;
}

export interface ProcessingConnection {
  id: string;
  documentId: string;
  userId: string;
  webSocket: WebSocket;
  subscriptions: Set<string>;
  isActive: boolean;
  lastHeartbeat: Date;
  permissions: ProcessingPermissions;
}

export interface ProcessingPermissions {
  canPause: boolean;
  canResume: boolean;
  canCancel: boolean;
  canRetry: boolean;
  canViewDetails: boolean;
  canModifyPriority: boolean;
  canControlQueue: boolean;
}

export interface ProcessingStatusUpdate {
  type: ProcessingUpdateType;
  documentId: string;
  timestamp: Date;
  data: ProcessingUpdateData;
  metadata: ProcessingUpdateMetadata;
}

export type ProcessingUpdateType = 
  | 'queue_status_changed'
  | 'zone_processing_started'
  | 'zone_processing_progress'
  | 'zone_processing_completed'
  | 'zone_processing_failed'
  | 'zone_retry_scheduled'
  | 'fallback_triggered'
  | 'confidence_calculated'
  | 'resource_usage_updated'
  | 'queue_metrics_updated'
  | 'worker_status_changed'
  | 'error_occurred'
  | 'system_notification';

export interface ProcessingUpdateData {
  zoneId?: string;
  workerId?: string;
  queueId?: string;
  progressPercentage?: number;
  currentPhase?: string;
  estimatedTimeRemaining?: number;
  result?: ProcessingResult;
  error?: ProcessingError;
  confidence?: ConfidenceScore;
  fallbackDecision?: FallbackDecision;
  retryResult?: RetryResult;
  queueMetrics?: QueueMetrics;
  resourceUsage?: ResourceUsageSnapshot;
  workerStatus?: WorkerStatusSnapshot;
  systemMessage?: string;
  details?: Record<string, any>;
}

export interface ProcessingUpdateMetadata {
  version: string;
  source: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  requiresAcknowledgment: boolean;
  expiresAt?: Date;
  correlationId?: string;
}

export interface ProcessingControlCommand {
  type: ProcessingCommandType;
  documentId: string;
  userId: string;
  timestamp: Date;
  parameters: ProcessingCommandParameters;
  metadata: ProcessingCommandMetadata;
}

export type ProcessingCommandType =
  | 'pause_processing'
  | 'resume_processing'
  | 'cancel_processing'
  | 'retry_zone'
  | 'skip_zone'
  | 'update_priority'
  | 'force_fallback'
  | 'get_status'
  | 'get_detailed_status'
  | 'subscribe_updates'
  | 'unsubscribe_updates'
  | 'emergency_stop'
  | 'resource_adjustment';

export interface ProcessingCommandParameters {
  zoneId?: string;
  workerId?: string;
  newPriority?: number;
  fallbackTool?: string;
  resourceLimits?: ResourceLimits;
  subscriptionTypes?: ProcessingUpdateType[];
  timeout?: number;
  force?: boolean;
  reason?: string;
  additionalParams?: Record<string, any>;
}

export interface ProcessingCommandMetadata {
  requestId: string;
  authorization: string;
  clientInfo: ClientInfo;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  expectResponse: boolean;
  timeoutMs: number;
}

export interface ClientInfo {
  userAgent: string;
  ipAddress: string;
  sessionId: string;
  capabilities: string[];
}

export interface ControlCommandResponse {
  success: boolean;
  requestId: string;
  timestamp: Date;
  result?: any;
  error?: ProcessingError;
  warnings?: string[];
  executionTime: number;
  affectedResources: string[];
}

export interface ProcessingState {
  documentId: string;
  status: ProcessingStatus;
  overallProgress: ProgressInformation;
  queueState: QueueState;
  zoneStates: Map<string, ZoneProcessingState>;
  workerStates: Map<string, WorkerState>;
  systemHealth: SystemHealthSnapshot;
  activeConnections: number;
  lastUpdated: Date;
}

export type ProcessingStatus = 
  | 'initializing'
  | 'queued'
  | 'processing'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'error'
  | 'waiting_for_resources';

export interface ProgressInformation {
  totalZones: number;
  completedZones: number;
  processingZones: number;
  failedZones: number;
  queuedZones: number;
  overallPercentage: number;
  estimatedTimeRemaining: number;
  averageProcessingTime: number;
  currentPhase: string;
  milestones: ProcessingMilestone[];
}

export interface ProcessingMilestone {
  name: string;
  description: string;
  targetPercentage: number;
  currentPercentage: number;
  status: 'pending' | 'active' | 'completed' | 'failed';
  estimatedCompletion?: Date;
}

export interface QueueState {
  id: string;
  status: string;
  length: number;
  activeWorkers: number;
  idleWorkers: number;
  averageWaitTime: number;
  throughputRate: number;
  errorRate: number;
  resourceUtilization: number;
  priorityDistribution: Map<string, number>;
}

export interface ZoneProcessingState {
  zoneId: string;
  status: string;
  progress: number;
  currentTool?: string;
  workerId?: string;
  startTime?: Date;
  estimatedCompletion?: Date;
  attempts: number;
  lastError?: ProcessingError;
  confidenceScore?: number;
  phase: ProcessingPhase;
  metrics: ZoneProcessingMetrics;
}

export type ProcessingPhase = 
  | 'queued'
  | 'initializing'
  | 'analyzing'
  | 'processing'
  | 'validating'
  | 'finalizing'
  | 'completed'
  | 'error';

export interface ZoneProcessingMetrics {
  queueWaitTime: number;
  processingTime: number;
  memoryUsage: number;
  cpuUsage: number;
  networkLatency: number;
  throughputRate: number;
  qualityScore: number;
}

export interface WorkerState {
  id: string;
  status: string;
  currentZone?: string;
  performance: WorkerPerformanceSnapshot;
  resourceUsage: WorkerResourceUsage;
  health: WorkerHealthStatus;
  capabilities: string[];
  lastHeartbeat: Date;
}

export interface WorkerPerformanceSnapshot {
  zonesProcessed: number;
  successRate: number;
  averageProcessingTime: number;
  throughputRate: number;
  errorRate: number;
  uptimePercentage: number;
}

export interface WorkerResourceUsage {
  memoryUsageMB: number;
  cpuUsagePercent: number;
  diskUsageMB: number;
  networkUsageKBps: number;
  isWithinLimits: boolean;
}

export interface WorkerHealthStatus {
  isHealthy: boolean;
  lastHealthCheck: Date;
  issues: HealthIssue[];
  performanceGrade: 'A' | 'B' | 'C' | 'D' | 'F';
}

export interface HealthIssue {
  type: 'performance' | 'resource' | 'connectivity' | 'error_rate';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  firstDetected: Date;
  occurrenceCount: number;
}

export interface SystemHealthSnapshot {
  overallHealth: 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
  memoryUsage: number;
  cpuUsage: number;
  diskUsage: number;
  networkLatency: number;
  activeConnections: number;
  queueBacklog: number;
  errorRate: number;
  responseTime: number;
  lastUpdated: Date;
}

export interface ResourceUsageSnapshot {
  timestamp: Date;
  memoryUtilization: ResourceMetric;
  cpuUtilization: ResourceMetric;
  diskUtilization: ResourceMetric;
  networkUtilization: ResourceMetric;
  queueUtilization: ResourceMetric;
}

export interface ResourceMetric {
  current: number;
  average: number;
  peak: number;
  limit: number;
  unit: string;
  trend: 'increasing' | 'stable' | 'decreasing';
}

export interface WorkerStatusSnapshot {
  workerId: string;
  status: string;
  lastActivity: Date;
  currentTask?: string;
  performance: WorkerPerformanceSnapshot;
  health: WorkerHealthStatus;
}

export interface ProcessingError {
  code: string;
  message: string;
  type: string;
  severity: string;
  recoverable: boolean;
  details: Record<string, any>;
  timestamp: Date;
}

export interface ResourceLimits {
  maxMemoryMB: number;
  maxCpuPercent: number;
  maxDiskMB: number;
  maxNetworkKBps: number;
}

export type ZoneUpdateCallback = (update: ProcessingStatusUpdate) => void;

// Main RealTimeProcessingStatusManager implementation
export class RealTimeProcessingStatusManager implements ProcessingStatusManager {
  private connections: Map<string, ProcessingConnection>;
  private zoneSubscriptions: Map<string, Set<ZoneUpdateCallback>>;
  private documentStates: Map<string, ProcessingState>;
  private updateQueue: ProcessingStatusUpdate[];
  private isProcessingUpdates: boolean;
  private heartbeatInterval: NodeJS.Timeout | null;
  private metricsCollector: ProcessingMetricsCollector;
  private commandProcessor: ProcessingCommandProcessor;

  constructor() {
    this.connections = new Map();
    this.zoneSubscriptions = new Map();
    this.documentStates = new Map();
    this.updateQueue = [];
    this.isProcessingUpdates = false;
    this.heartbeatInterval = null;
    this.metricsCollector = new ProcessingMetricsCollectorImpl();
    this.commandProcessor = new ProcessingCommandProcessorImpl();
    
    this.startHeartbeatMonitoring();
    this.startUpdateProcessor();
  }

  async initializeConnection(
    documentId: string, 
    userId: string
  ): Promise<ProcessingConnection> {
    const connectionId = `conn_${documentId}_${userId}_${Date.now()}`;
    
    // Create mock WebSocket for this implementation
    const webSocket = new MockWebSocket() as unknown as WebSocket;
    
    const connection: ProcessingConnection = {
      id: connectionId,
      documentId,
      userId,
      webSocket,
      subscriptions: new Set(),
      isActive: true,
      lastHeartbeat: new Date(),
      permissions: this.getDefaultPermissions(userId)
    };

    this.connections.set(connectionId, connection);

    // Initialize document state if not exists
    if (!this.documentStates.has(documentId)) {
      await this.initializeDocumentState(documentId);
    }

    // Send initial status
    await this.sendInitialStatus(connection);

    console.log(`Initialized processing connection ${connectionId} for document ${documentId}`);
    return connection;
  }

  async broadcastProcessingUpdate(update: ProcessingStatusUpdate): Promise<void> {
    // Add to update queue for processing
    this.updateQueue.push(update);
    
    // Process immediately if not already processing
    if (!this.isProcessingUpdates) {
      await this.processUpdateQueue();
    }
  }

  async handleControlCommand(command: ProcessingControlCommand): Promise<ControlCommandResponse> {
    const startTime = performance.now();
    
    try {
      // Validate command
      const validation = await this.validateCommand(command);
      if (!validation.valid) {
        return this.createErrorResponse(command, validation.error!, startTime);
      }

      // Process command
      const result = await this.commandProcessor.execute(command);
      
      // Broadcast command result if applicable
      if (this.shouldBroadcastCommandResult(command)) {
        await this.broadcastCommandResult(command, result);
      }

      return {
        success: true,
        requestId: command.metadata.requestId,
        timestamp: new Date(),
        result: result.data,
        executionTime: performance.now() - startTime,
        affectedResources: result.affectedResources || []
      };

    } catch (error) {
      return this.createErrorResponse(command, error, startTime);
    }
  }

  async subscribeToZoneUpdates(
    zoneId: string, 
    callback: ZoneUpdateCallback
  ): Promise<void> {
    if (!this.zoneSubscriptions.has(zoneId)) {
      this.zoneSubscriptions.set(zoneId, new Set());
    }
    
    this.zoneSubscriptions.get(zoneId)!.add(callback);
    console.log(`Subscribed to zone ${zoneId} updates`);
  }

  async unsubscribeFromZoneUpdates(
    zoneId: string, 
    callback: ZoneUpdateCallback
  ): Promise<void> {
    const callbacks = this.zoneSubscriptions.get(zoneId);
    if (callbacks) {
      callbacks.delete(callback);
      
      if (callbacks.size === 0) {
        this.zoneSubscriptions.delete(zoneId);
      }
    }
    
    console.log(`Unsubscribed from zone ${zoneId} updates`);
  }

  async getProcessingState(documentId: string): Promise<ProcessingState> {
    let state = this.documentStates.get(documentId);
    
    if (!state) {
      await this.initializeDocumentState(documentId);
      state = this.documentStates.get(documentId)!;
    }

    // Update state with latest metrics
    await this.updateProcessingState(state);
    
    return state;
  }

  // Private implementation methods
  private async initializeDocumentState(documentId: string): Promise<void> {
    const state: ProcessingState = {
      documentId,
      status: 'initializing',
      overallProgress: {
        totalZones: 0,
        completedZones: 0,
        processingZones: 0,
        failedZones: 0,
        queuedZones: 0,
        overallPercentage: 0,
        estimatedTimeRemaining: 0,
        averageProcessingTime: 0,
        currentPhase: 'initialization',
        milestones: this.createDefaultMilestones()
      },
      queueState: {
        id: `queue_${documentId}`,
        status: 'idle',
        length: 0,
        activeWorkers: 0,
        idleWorkers: 0,
        averageWaitTime: 0,
        throughputRate: 0,
        errorRate: 0,
        resourceUtilization: 0,
        priorityDistribution: new Map()
      },
      zoneStates: new Map(),
      workerStates: new Map(),
      systemHealth: await this.getSystemHealthSnapshot(),
      activeConnections: 0,
      lastUpdated: new Date()
    };

    this.documentStates.set(documentId, state);
  }

  private createDefaultMilestones(): ProcessingMilestone[] {
    return [
      {
        name: 'queue_initialization',
        description: 'Processing queue initialized',
        targetPercentage: 5,
        currentPercentage: 0,
        status: 'pending'
      },
      {
        name: 'zone_analysis_complete',
        description: 'Zone analysis and tool assignment complete',
        targetPercentage: 15,
        currentPercentage: 0,
        status: 'pending'
      },
      {
        name: 'processing_started',
        description: 'Content processing started',
        targetPercentage: 20,
        currentPercentage: 0,
        status: 'pending'
      },
      {
        name: 'halfway_complete',
        description: '50% of zones processed',
        targetPercentage: 50,
        currentPercentage: 0,
        status: 'pending'
      },
      {
        name: 'processing_complete',
        description: 'All zones processed',
        targetPercentage: 90,
        currentPercentage: 0,
        status: 'pending'
      },
      {
        name: 'finalization_complete',
        description: 'Result finalization and cleanup complete',
        targetPercentage: 100,
        currentPercentage: 0,
        status: 'pending'
      }
    ];
  }

  private async updateProcessingState(state: ProcessingState): Promise<void> {
    // Update metrics from collectors
    const metrics = await this.metricsCollector.collectCurrentMetrics(state.documentId);
    
    // Update overall progress
    state.overallProgress = {
      ...state.overallProgress,
      ...metrics.overallProgress
    };

    // Update queue state
    state.queueState = {
      ...state.queueState,
      ...metrics.queueMetrics
    };

    // Update system health
    state.systemHealth = await this.getSystemHealthSnapshot();
    
    // Update active connections count
    state.activeConnections = Array.from(this.connections.values())
      .filter(conn => conn.documentId === state.documentId && conn.isActive)
      .length;

    state.lastUpdated = new Date();
  }

  private async getSystemHealthSnapshot(): Promise<SystemHealthSnapshot> {
    // Mock system health - in real implementation would gather actual metrics
    return {
      overallHealth: 'good',
      memoryUsage: 0.65,
      cpuUsage: 0.45,
      diskUsage: 0.30,
      networkLatency: 50,
      activeConnections: this.connections.size,
      queueBacklog: this.updateQueue.length,
      errorRate: 0.02,
      responseTime: 150,
      lastUpdated: new Date()
    };
  }

  private getDefaultPermissions(userId: string): ProcessingPermissions {
    // In real implementation, would lookup user roles/permissions
    return {
      canPause: true,
      canResume: true,
      canCancel: true,
      canRetry: true,
      canViewDetails: true,
      canModifyPriority: true,
      canControlQueue: true
    };
  }

  private async sendInitialStatus(connection: ProcessingConnection): Promise<void> {
    const state = await this.getProcessingState(connection.documentId);
    
    const initialUpdate: ProcessingStatusUpdate = {
      type: 'queue_status_changed',
      documentId: connection.documentId,
      timestamp: new Date(),
      data: {
        queueMetrics: this.convertQueueStateToMetrics(state.queueState),
        progressPercentage: state.overallProgress.overallPercentage,
        currentPhase: state.overallProgress.currentPhase,
        estimatedTimeRemaining: state.overallProgress.estimatedTimeRemaining
      },
      metadata: {
        version: '1.0.0',
        source: 'status_manager',
        priority: 'medium',
        requiresAcknowledgment: false
      }
    };

    await this.sendUpdateToConnection(connection, initialUpdate);
  }

  private convertQueueStateToMetrics(queueState: QueueState): QueueMetrics {
    return {
      totalZones: queueState.length,
      completedZones: 0, // Would be calculated from actual queue
      failedZones: 0,
      processingZones: 0,
      queuedZones: queueState.length,
      averageWaitTime: queueState.averageWaitTime,
      averageProcessingTime: 0,
      throughputRate: queueState.throughputRate,
      errorRate: queueState.errorRate,
      resourceUtilization: {
        memoryUsage: queueState.resourceUtilization,
        cpuUsage: 0.5,
        activeWorkers: queueState.activeWorkers,
        idleWorkers: queueState.idleWorkers,
        queueCapacity: 0.7
      },
      lastUpdated: new Date()
    };
  }

  private async processUpdateQueue(): Promise<void> {
    if (this.isProcessingUpdates || this.updateQueue.length === 0) {
      return;
    }

    this.isProcessingUpdates = true;

    try {
      while (this.updateQueue.length > 0) {
        const update = this.updateQueue.shift()!;
        await this.processUpdate(update);
      }
    } catch (error) {
      console.error('Error processing update queue:', error);
    } finally {
      this.isProcessingUpdates = false;
    }
  }

  private async processUpdate(update: ProcessingStatusUpdate): Promise<void> {
    // Update document state
    await this.updateDocumentStateFromUpdate(update);

    // Send to relevant connections
    const relevantConnections = this.getRelevantConnections(update);
    
    for (const connection of relevantConnections) {
      await this.sendUpdateToConnection(connection, update);
    }

    // Notify zone subscribers
    if (update.data.zoneId) {
      await this.notifyZoneSubscribers(update.data.zoneId, update);
    }

    // Log update for debugging
    console.log(`Processed update: ${update.type} for document ${update.documentId}`);
  }

  private async updateDocumentStateFromUpdate(update: ProcessingStatusUpdate): Promise<void> {
    const state = this.documentStates.get(update.documentId);
    if (!state) return;

    switch (update.type) {
      case 'zone_processing_started':
        this.handleZoneProcessingStarted(state, update);
        break;
      case 'zone_processing_progress':
        this.handleZoneProcessingProgress(state, update);
        break;
      case 'zone_processing_completed':
        this.handleZoneProcessingCompleted(state, update);
        break;
      case 'zone_processing_failed':
        this.handleZoneProcessingFailed(state, update);
        break;
      case 'queue_metrics_updated':
        this.handleQueueMetricsUpdated(state, update);
        break;
      case 'resource_usage_updated':
        this.handleResourceUsageUpdated(state, update);
        break;
    }

    state.lastUpdated = new Date();
  }

  private handleZoneProcessingStarted(state: ProcessingState, update: ProcessingStatusUpdate): void {
    if (!update.data.zoneId) return;

    const zoneState: ZoneProcessingState = {
      zoneId: update.data.zoneId,
      status: 'processing',
      progress: 0,
      currentTool: update.data.details?.toolName,
      workerId: update.data.workerId,
      startTime: new Date(),
      attempts: 1,
      phase: 'processing',
      metrics: {
        queueWaitTime: 0,
        processingTime: 0,
        memoryUsage: 0,
        cpuUsage: 0,
        networkLatency: 0,
        throughputRate: 0,
        qualityScore: 0
      }
    };

    state.zoneStates.set(update.data.zoneId, zoneState);
    state.overallProgress.processingZones++;
    state.overallProgress.queuedZones--;
  }

  private handleZoneProcessingProgress(state: ProcessingState, update: ProcessingStatusUpdate): void {
    if (!update.data.zoneId) return;

    const zoneState = state.zoneStates.get(update.data.zoneId);
    if (zoneState) {
      zoneState.progress = update.data.progressPercentage || 0;
      zoneState.phase = (update.data.currentPhase as ProcessingPhase) || 'processing';
      
      if (update.data.estimatedTimeRemaining) {
        zoneState.estimatedCompletion = new Date(Date.now() + update.data.estimatedTimeRemaining);
      }
    }
  }

  private handleZoneProcessingCompleted(state: ProcessingState, update: ProcessingStatusUpdate): void {
    if (!update.data.zoneId) return;

    const zoneState = state.zoneStates.get(update.data.zoneId);
    if (zoneState) {
      zoneState.status = 'completed';
      zoneState.progress = 100;
      zoneState.phase = 'completed';
      zoneState.confidenceScore = update.data.confidence?.finalConfidence;
    }

    state.overallProgress.completedZones++;
    state.overallProgress.processingZones--;
    this.updateOverallProgress(state);
  }

  private handleZoneProcessingFailed(state: ProcessingState, update: ProcessingStatusUpdate): void {
    if (!update.data.zoneId) return;

    const zoneState = state.zoneStates.get(update.data.zoneId);
    if (zoneState) {
      zoneState.status = 'failed';
      zoneState.phase = 'error';
      zoneState.lastError = update.data.error;
    }

    state.overallProgress.failedZones++;
    state.overallProgress.processingZones--;
    this.updateOverallProgress(state);
  }

  private handleQueueMetricsUpdated(state: ProcessingState, update: ProcessingStatusUpdate): void {
    if (update.data.queueMetrics) {
      state.queueState.length = update.data.queueMetrics.totalZones;
      state.queueState.averageWaitTime = update.data.queueMetrics.averageWaitTime;
      state.queueState.throughputRate = update.data.queueMetrics.throughputRate;
      state.queueState.errorRate = update.data.queueMetrics.errorRate;
      state.queueState.resourceUtilization = update.data.queueMetrics.resourceUtilization.memoryUsage;
    }
  }

  private handleResourceUsageUpdated(state: ProcessingState, update: ProcessingStatusUpdate): void {
    if (update.data.resourceUsage) {
      // Update system health based on resource usage
      const usage = update.data.resourceUsage;
      state.systemHealth.memoryUsage = usage.memoryUtilization.current;
      state.systemHealth.cpuUsage = usage.cpuUtilization.current;
      state.systemHealth.lastUpdated = new Date();
    }
  }

  private updateOverallProgress(state: ProcessingState): void {
    const total = state.overallProgress.totalZones;
    if (total > 0) {
      const completed = state.overallProgress.completedZones;
      state.overallProgress.overallPercentage = (completed / total) * 100;
      
      // Update milestones
      this.updateMilestones(state);
      
      // Update current phase
      if (state.overallProgress.overallPercentage >= 90) {
        state.overallProgress.currentPhase = 'finalization';
      } else if (state.overallProgress.overallPercentage >= 20) {
        state.overallProgress.currentPhase = 'processing';
      } else if (state.overallProgress.overallPercentage >= 15) {
        state.overallProgress.currentPhase = 'analysis';
      }
    }
  }

  private updateMilestones(state: ProcessingState): void {
    const progress = state.overallProgress.overallPercentage;
    
    state.overallProgress.milestones.forEach(milestone => {
      milestone.currentPercentage = Math.min(progress, milestone.targetPercentage);
      
      if (progress >= milestone.targetPercentage && milestone.status === 'pending') {
        milestone.status = 'completed';
      } else if (progress >= milestone.targetPercentage * 0.5 && milestone.status === 'pending') {
        milestone.status = 'active';
      }
    });
  }

  private getRelevantConnections(update: ProcessingStatusUpdate): ProcessingConnection[] {
    return Array.from(this.connections.values()).filter(conn => 
      conn.documentId === update.documentId && 
      conn.isActive &&
      this.shouldSendUpdateToConnection(conn, update)
    );
  }

  private shouldSendUpdateToConnection(
    connection: ProcessingConnection, 
    update: ProcessingStatusUpdate
  ): boolean {
    // Check if connection has permissions to receive this type of update
    if (!connection.permissions.canViewDetails && update.metadata.priority === 'low') {
      return false;
    }

    // Check subscription filters (simplified)
    if (connection.subscriptions.size > 0) {
      return connection.subscriptions.has(update.type);
    }

    return true; // Send all updates by default
  }

  private async sendUpdateToConnection(
    connection: ProcessingConnection, 
    update: ProcessingStatusUpdate
  ): Promise<void> {
    try {
      if (connection.webSocket.readyState === WebSocket.OPEN) {
        const message = JSON.stringify({
          type: 'processing_update',
          data: update
        });
        
        connection.webSocket.send(message);
        connection.lastHeartbeat = new Date();
      }
    } catch (error) {
      console.error(`Failed to send update to connection ${connection.id}:`, error);
      connection.isActive = false;
    }
  }

  private async notifyZoneSubscribers(zoneId: string, update: ProcessingStatusUpdate): Promise<void> {
    const callbacks = this.zoneSubscriptions.get(zoneId);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(update);
        } catch (error) {
          console.error(`Error in zone update callback for ${zoneId}:`, error);
        }
      });
    }
  }

  private async validateCommand(command: ProcessingControlCommand): Promise<ValidationResult> {
    // Basic validation
    if (!command.documentId || !command.userId) {
      return {
        valid: false,
        error: new Error('Missing required command parameters')
      };
    }

    // Check if document exists
    if (!this.documentStates.has(command.documentId)) {
      return {
        valid: false,
        error: new Error(`Document ${command.documentId} not found`)
      };
    }

    // Get user connection and check permissions
    const userConnection = Array.from(this.connections.values())
      .find(conn => conn.userId === command.userId && conn.documentId === command.documentId);

    if (!userConnection) {
      return {
        valid: false,
        error: new Error('User connection not found or insufficient permissions')
      };
    }

    // Validate specific command type
    const commandValidation = this.validateSpecificCommand(command, userConnection);
    if (!commandValidation.valid) {
      return commandValidation;
    }

    return { valid: true };
  }

  private validateSpecificCommand(
    command: ProcessingControlCommand,
    connection: ProcessingConnection
  ): ValidationResult {
    switch (command.type) {
      case 'pause_processing':
        return {
          valid: connection.permissions.canPause,
          error: connection.permissions.canPause ? undefined : new Error('Insufficient permissions to pause processing')
        };
      
      case 'resume_processing':
        return {
          valid: connection.permissions.canResume,
          error: connection.permissions.canResume ? undefined : new Error('Insufficient permissions to resume processing')
        };
      
      case 'cancel_processing':
        return {
          valid: connection.permissions.canCancel,
          error: connection.permissions.canCancel ? undefined : new Error('Insufficient permissions to cancel processing')
        };
      
      case 'retry_zone':
        if (!connection.permissions.canRetry) {
          return {
            valid: false,
            error: new Error('Insufficient permissions to retry zones')
          };
        }
        
        if (!command.parameters.zoneId) {
          return {
            valid: false,
            error: new Error('Zone ID required for retry command')
          };
        }
        break;
      
      case 'update_priority':
        if (!connection.permissions.canModifyPriority) {
          return {
            valid: false,
            error: new Error('Insufficient permissions to modify priority')
          };
        }
        
        if (!command.parameters.zoneId || command.parameters.newPriority === undefined) {
          return {
            valid: false,
            error: new Error('Zone ID and new priority required')
          };
        }
        break;
    }

    return { valid: true };
  }

  private shouldBroadcastCommandResult(command: ProcessingControlCommand): boolean {
    const broadcastCommands = [
      'pause_processing',
      'resume_processing',
      'cancel_processing',
      'emergency_stop'
    ];
    
    return broadcastCommands.includes(command.type);
  }

  private async broadcastCommandResult(
    command: ProcessingControlCommand,
    result: any
  ): Promise<void> {
    const update: ProcessingStatusUpdate = {
      type: 'system_notification',
      documentId: command.documentId,
      timestamp: new Date(),
      data: {
        systemMessage: `Command ${command.type} executed by user ${command.userId}`,
        details: {
          command: command.type,
          parameters: command.parameters,
          result
        }
      },
      metadata: {
        version: '1.0.0',
        source: 'command_processor',
        priority: 'high',
        requiresAcknowledgment: false,
        correlationId: command.metadata.requestId
      }
    };

    await this.broadcastProcessingUpdate(update);
  }

  private createErrorResponse(
    command: ProcessingControlCommand,
    error: any,
    startTime: number
  ): ControlCommandResponse {
    return {
      success: false,
      requestId: command.metadata.requestId,
      timestamp: new Date(),
      error: {
        code: 'COMMAND_EXECUTION_FAILED',
        message: error instanceof Error ? error.message : 'Command execution failed',
        type: 'command_error',
        severity: 'medium',
        recoverable: true,
        details: { originalError: error },
        timestamp: new Date()
      },
      executionTime: performance.now() - startTime,
      affectedResources: []
    };
  }

  private startHeartbeatMonitoring(): void {
    this.heartbeatInterval = setInterval(() => {
      this.checkConnectionHeartbeats();
    }, 30000); // Check every 30 seconds
  }

  private checkConnectionHeartbeats(): void {
    const now = new Date();
    const timeoutMs = 60000; // 1 minute timeout

    for (const [id, connection] of this.connections.entries()) {
      const timeSinceHeartbeat = now.getTime() - connection.lastHeartbeat.getTime();
      
      if (timeSinceHeartbeat > timeoutMs) {
        console.log(`Connection ${id} timed out, marking as inactive`);
        connection.isActive = false;
        
        // Optionally remove connection after longer timeout
        if (timeSinceHeartbeat > timeoutMs * 2) {
          this.connections.delete(id);
        }
      }
    }
  }

  private startUpdateProcessor(): void {
    // Process update queue every 100ms
    setInterval(() => {
      if (!this.isProcessingUpdates && this.updateQueue.length > 0) {
        this.processUpdateQueue().catch(error => {
          console.error('Error in update processor:', error);
        });
      }
    }, 100);
  }

  // Public utility methods
  getActiveConnections(): ProcessingConnection[] {
    return Array.from(this.connections.values()).filter(conn => conn.isActive);
  }

  getConnectionCount(documentId?: string): number {
    if (documentId) {
      return Array.from(this.connections.values())
        .filter(conn => conn.documentId === documentId && conn.isActive)
        .length;
    }
    return Array.from(this.connections.values())
      .filter(conn => conn.isActive)
      .length;
  }

  async cleanup(): Promise<void> {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    // Close all connections
    for (const connection of this.connections.values()) {
      if (connection.webSocket.readyState === WebSocket.OPEN) {
        connection.webSocket.close();
      }
    }

    this.connections.clear();
    this.documentStates.clear();
    this.zoneSubscriptions.clear();
  }
}

// Supporting implementations
interface ValidationResult {
  valid: boolean;
  error?: Error;
}

class ProcessingMetricsCollectorImpl {
  async collectCurrentMetrics(documentId: string): Promise<any> {
    // Mock metrics collection
    return {
      overallProgress: {
        totalZones: 10,
        completedZones: 3,
        processingZones: 2,
        failedZones: 0,
        queuedZones: 5,
        overallPercentage: 30,
        estimatedTimeRemaining: 45000,
        averageProcessingTime: 2500
      },
      queueMetrics: {
        length: 7,
        activeWorkers: 2,
        idleWorkers: 1,
        averageWaitTime: 1200,
        throughputRate: 0.8,
        errorRate: 0.05,
        resourceUtilization: 0.6
      }
    };
  }
}

class ProcessingCommandProcessorImpl {
  async execute(command: ProcessingControlCommand): Promise<any> {
    // Mock command execution
    console.log(`Executing command: ${command.type}`);
    
    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 100));
    
    return {
      data: { message: `Command ${command.type} executed successfully` },
      affectedResources: [command.documentId]
    };
  }
}

// Mock WebSocket implementation for testing
class MockWebSocket {
  readyState: number = 1; // OPEN
  
  send(data: string): void {
    console.log(`MockWebSocket sending: ${data.substring(0, 100)}...`);
  }
  
  close(): void {
    this.readyState = 3; // CLOSED
  }
}

// Export default instance
export const processingStatusManager = new RealTimeProcessingStatusManager(); 