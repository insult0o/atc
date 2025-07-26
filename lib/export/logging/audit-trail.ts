/**
 * Audit Trail System
 * Immutable audit log storage with cryptographic verification
 */

import { createHash, createHmac } from 'crypto';
import { Logger, LogCategory } from './logger';

export interface AuditTrail {
  entryId: string;
  timestamp: string;
  hash: string;
  previousHash: string;
  signature?: string;
  content: AuditContent;
  verified: boolean;
  metadata: AuditMetadata;
}

export interface AuditContent {
  action: string;
  actor: ActorInfo;
  resource: ResourceInfo;
  changes: AuditChange[];
  justification?: string;
  approvals?: Approval[];
  outcome: 'success' | 'failure' | 'partial';
}

export interface ActorInfo {
  userId: string;
  username?: string;
  role: string;
  ipAddress: string;
  userAgent: string;
  sessionId?: string;
}

export interface ResourceInfo {
  type: string;
  id: string;
  name: string;
  documentId?: string;
  version?: number;
}

export interface AuditChange {
  field: string;
  oldValue: any;
  newValue: any;
  type: 'create' | 'update' | 'delete' | 'access';
  timestamp: string;
}

export interface Approval {
  approverId: string;
  approverName: string;
  approverRole: string;
  timestamp: string;
  decision: 'approved' | 'rejected';
  comment?: string;
}

export interface AuditMetadata {
  source: string;
  environment: string;
  version: string;
  correlationId: string;
  tags?: string[];
}

export interface AuditQuery {
  startDate?: Date;
  endDate?: Date;
  userId?: string;
  resourceId?: string;
  action?: string;
  verified?: boolean;
  limit?: number;
  offset?: number;
}

export interface ComplianceReport {
  period: { start: Date; end: Date };
  totalEntries: number;
  verifiedEntries: number;
  tamperedEntries: number;
  userActivity: Map<string, UserActivity>;
  resourceAccess: Map<string, ResourceAccess>;
  criticalActions: CriticalAction[];
  anomalies: Anomaly[];
}

export interface UserActivity {
  userId: string;
  actions: number;
  resources: Set<string>;
  criticalActions: number;
  lastActivity: Date;
}

export interface ResourceAccess {
  resourceId: string;
  accessCount: number;
  uniqueUsers: Set<string>;
  modifications: number;
  lastAccessed: Date;
}

export interface CriticalAction {
  entryId: string;
  timestamp: Date;
  userId: string;
  action: string;
  resourceId: string;
  impact: 'low' | 'medium' | 'high' | 'critical';
}

export interface Anomaly {
  type: 'unusual_access' | 'high_frequency' | 'unauthorized' | 'tampered';
  description: string;
  entries: string[];
  severity: 'low' | 'medium' | 'high';
  timestamp: Date;
}

export class AuditTrailManager {
  private logger: Logger;
  private auditStore: Map<string, AuditTrail>;
  private chainHead: string | null = null;
  private secretKey: string;
  private criticalActions: Set<string>;
  
  constructor(logger?: Logger, secretKey?: string) {
    this.logger = logger || new Logger();
    this.auditStore = new Map();
    this.secretKey = secretKey || process.env.AUDIT_SECRET_KEY || 'default-secret';
    this.criticalActions = new Set([
      'export_override',
      'validation_bypass',
      'data_deletion',
      'permission_change',
      'configuration_update',
      'security_event'
    ]);
  }

  /**
   * Add entry to audit trail
   */
  async addEntry(content: AuditContent, metadata: AuditMetadata): Promise<string> {
    const entryId = this.generateEntryId();
    const timestamp = new Date().toISOString();
    
    // Get previous hash for chain integrity
    const previousHash = this.chainHead || this.genesisHash();
    
    // Create audit entry
    const entry: AuditTrail = {
      entryId,
      timestamp,
      hash: '', // Will be calculated
      previousHash,
      content,
      verified: true,
      metadata
    };

    // Calculate hash
    entry.hash = this.calculateHash(entry);
    
    // Generate signature if critical action
    if (this.isCriticalAction(content.action)) {
      entry.signature = this.generateSignature(entry);
    }

    // Store entry
    this.auditStore.set(entryId, entry);
    this.chainHead = entry.hash;

    // Log audit event
    this.logger.logAudit(
      `Audit entry created: ${content.action}`,
      {
        entryId,
        actor: content.actor.userId,
        resource: `${content.resource.type}/${content.resource.id}`,
        outcome: content.outcome
      }
    );

    // Alert on critical actions
    if (this.isCriticalAction(content.action)) {
      this.alertCriticalAction(entry);
    }

    return entryId;
  }

  /**
   * Query audit trail
   */
  async query(query: AuditQuery): Promise<AuditTrail[]> {
    let results = Array.from(this.auditStore.values());

    // Apply filters
    if (query.startDate) {
      results = results.filter(e => new Date(e.timestamp) >= query.startDate!);
    }
    
    if (query.endDate) {
      results = results.filter(e => new Date(e.timestamp) <= query.endDate!);
    }
    
    if (query.userId) {
      results = results.filter(e => e.content.actor.userId === query.userId);
    }
    
    if (query.resourceId) {
      results = results.filter(e => e.content.resource.id === query.resourceId);
    }
    
    if (query.action) {
      results = results.filter(e => e.content.action === query.action);
    }
    
    if (query.verified !== undefined) {
      results = results.filter(e => e.verified === query.verified);
    }

    // Sort by timestamp descending
    results.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    // Apply pagination
    if (query.offset) {
      results = results.slice(query.offset);
    }
    
    if (query.limit) {
      results = results.slice(0, query.limit);
    }

    return results;
  }

  /**
   * Verify audit trail integrity
   */
  async verifyIntegrity(fromEntry?: string): Promise<{
    valid: boolean;
    errors: string[];
    verified: number;
    tampered: number;
  }> {
    const errors: string[] = [];
    let verified = 0;
    let tampered = 0;
    let previousHash = this.genesisHash();
    let startVerifying = !fromEntry;

    const entries = Array.from(this.auditStore.values())
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    for (const entry of entries) {
      if (!startVerifying && entry.entryId === fromEntry) {
        startVerifying = true;
      }

      if (!startVerifying) continue;

      // Verify hash
      const calculatedHash = this.calculateHash(entry);
      if (calculatedHash !== entry.hash) {
        errors.push(`Hash mismatch for entry ${entry.entryId}`);
        entry.verified = false;
        tampered++;
      } else {
        verified++;
      }

      // Verify chain
      if (entry.previousHash !== previousHash) {
        errors.push(`Chain broken at entry ${entry.entryId}`);
        entry.verified = false;
      }

      // Verify signature if present
      if (entry.signature) {
        const validSignature = this.verifySignature(entry);
        if (!validSignature) {
          errors.push(`Invalid signature for entry ${entry.entryId}`);
          entry.verified = false;
        }
      }

      previousHash = entry.hash;
    }

    const valid = errors.length === 0;

    // Log verification result
    this.logger.logAudit(
      'Audit trail verification completed',
      {
        valid,
        errorCount: errors.length,
        verified,
        tampered,
        fromEntry
      }
    );

    return { valid, errors, verified, tampered };
  }

  /**
   * Generate compliance report
   */
  async generateComplianceReport(
    startDate: Date,
    endDate: Date
  ): Promise<ComplianceReport> {
    const entries = await this.query({ startDate, endDate });
    
    const report: ComplianceReport = {
      period: { start: startDate, end: endDate },
      totalEntries: entries.length,
      verifiedEntries: 0,
      tamperedEntries: 0,
      userActivity: new Map(),
      resourceAccess: new Map(),
      criticalActions: [],
      anomalies: []
    };

    // Process entries
    entries.forEach(entry => {
      // Count verification status
      if (entry.verified) {
        report.verifiedEntries++;
      } else {
        report.tamperedEntries++;
      }

      // Track user activity
      const userActivity = report.userActivity.get(entry.content.actor.userId) || {
        userId: entry.content.actor.userId,
        actions: 0,
        resources: new Set(),
        criticalActions: 0,
        lastActivity: new Date(entry.timestamp)
      };

      userActivity.actions++;
      userActivity.resources.add(entry.content.resource.id);
      if (this.isCriticalAction(entry.content.action)) {
        userActivity.criticalActions++;
      }
      
      report.userActivity.set(entry.content.actor.userId, userActivity);

      // Track resource access
      const resourceAccess = report.resourceAccess.get(entry.content.resource.id) || {
        resourceId: entry.content.resource.id,
        accessCount: 0,
        uniqueUsers: new Set(),
        modifications: 0,
        lastAccessed: new Date(entry.timestamp)
      };

      resourceAccess.accessCount++;
      resourceAccess.uniqueUsers.add(entry.content.actor.userId);
      if (['update', 'delete'].includes(entry.content.changes[0]?.type)) {
        resourceAccess.modifications++;
      }

      report.resourceAccess.set(entry.content.resource.id, resourceAccess);

      // Track critical actions
      if (this.isCriticalAction(entry.content.action)) {
        report.criticalActions.push({
          entryId: entry.entryId,
          timestamp: new Date(entry.timestamp),
          userId: entry.content.actor.userId,
          action: entry.content.action,
          resourceId: entry.content.resource.id,
          impact: this.assessImpact(entry.content.action)
        });
      }
    });

    // Detect anomalies
    report.anomalies = this.detectAnomalies(entries, report);

    return report;
  }

  /**
   * Export audit trail
   */
  async exportAuditTrail(
    query: AuditQuery,
    format: 'json' | 'csv' = 'json'
  ): Promise<string> {
    const entries = await this.query(query);

    if (format === 'json') {
      return JSON.stringify({
        exportDate: new Date().toISOString(),
        query,
        entries,
        metadata: {
          totalEntries: entries.length,
          verified: entries.filter(e => e.verified).length,
          chainValid: await this.verifyIntegrity().then(r => r.valid)
        }
      }, null, 2);
    } else {
      // CSV format
      const headers = [
        'Entry ID',
        'Timestamp',
        'Action',
        'Actor',
        'Resource',
        'Outcome',
        'Verified',
        'Hash'
      ];

      const rows = entries.map(e => [
        e.entryId,
        e.timestamp,
        e.content.action,
        e.content.actor.userId,
        `${e.content.resource.type}/${e.content.resource.id}`,
        e.content.outcome,
        e.verified,
        e.hash.substring(0, 8)
      ]);

      return [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
      ].join('\n');
    }
  }

  /**
   * Private helper methods
   */

  private calculateHash(entry: AuditTrail): string {
    const content = JSON.stringify({
      entryId: entry.entryId,
      timestamp: entry.timestamp,
      previousHash: entry.previousHash,
      content: entry.content,
      metadata: entry.metadata
    });

    return createHash('sha256').update(content).digest('hex');
  }

  private generateSignature(entry: AuditTrail): string {
    const content = `${entry.entryId}:${entry.timestamp}:${entry.hash}`;
    return createHmac('sha256', this.secretKey).update(content).digest('hex');
  }

  private verifySignature(entry: AuditTrail): boolean {
    if (!entry.signature) return true;
    
    const expectedSignature = this.generateSignature(entry);
    return entry.signature === expectedSignature;
  }

  private genesisHash(): string {
    return createHash('sha256').update('GENESIS_BLOCK').digest('hex');
  }

  private generateEntryId(): string {
    return `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private isCriticalAction(action: string): boolean {
    return this.criticalActions.has(action) || 
           action.includes('override') ||
           action.includes('bypass') ||
           action.includes('delete');
  }

  private assessImpact(action: string): 'low' | 'medium' | 'high' | 'critical' {
    if (action.includes('delete') || action.includes('security')) return 'critical';
    if (action.includes('override') || action.includes('bypass')) return 'high';
    if (action.includes('update') || action.includes('configuration')) return 'medium';
    return 'low';
  }

  private alertCriticalAction(entry: AuditTrail): void {
    this.logger.critical(
      `Critical audit event: ${entry.content.action}`,
      new Error('Critical action performed'),
      {
        entryId: entry.entryId,
        actor: entry.content.actor,
        resource: entry.content.resource,
        justification: entry.content.justification
      }
    );
  }

  private detectAnomalies(
    entries: AuditTrail[],
    report: ComplianceReport
  ): Anomaly[] {
    const anomalies: Anomaly[] = [];

    // Detect tampered entries
    if (report.tamperedEntries > 0) {
      anomalies.push({
        type: 'tampered',
        description: `${report.tamperedEntries} entries failed verification`,
        entries: entries.filter(e => !e.verified).map(e => e.entryId),
        severity: 'high',
        timestamp: new Date()
      });
    }

    // Detect unusual access patterns
    report.userActivity.forEach((activity, userId) => {
      // High frequency access
      const avgActionsPerDay = activity.actions / 
        ((report.period.end.getTime() - report.period.start.getTime()) / (1000 * 60 * 60 * 24));
      
      if (avgActionsPerDay > 100) {
        anomalies.push({
          type: 'high_frequency',
          description: `User ${userId} performed ${avgActionsPerDay.toFixed(0)} actions per day`,
          entries: entries.filter(e => e.content.actor.userId === userId).map(e => e.entryId).slice(0, 10),
          severity: 'medium',
          timestamp: new Date()
        });
      }

      // Unusual hours
      const unusualHourAccess = entries.filter(e => {
        const hour = new Date(e.timestamp).getHours();
        return e.content.actor.userId === userId && (hour < 6 || hour > 22);
      });

      if (unusualHourAccess.length > 10) {
        anomalies.push({
          type: 'unusual_access',
          description: `User ${userId} accessed system during unusual hours`,
          entries: unusualHourAccess.map(e => e.entryId).slice(0, 10),
          severity: 'low',
          timestamp: new Date()
        });
      }
    });

    return anomalies;
  }

  /**
   * Clean up old entries
   */
  async cleanupOldEntries(retentionDays: number): Promise<number> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - retentionDays);

    let removed = 0;
    
    // Note: In production, old entries should be archived, not deleted
    this.logger.warn(
      'Audit cleanup requested - entries should be archived',
      {
        retentionDays,
        cutoffDate: cutoff.toISOString()
      }
    );

    return removed;
  }

  /**
   * Get audit statistics
   */
  getStatistics(): {
    totalEntries: number;
    chainLength: number;
    oldestEntry?: Date;
    newestEntry?: Date;
    criticalActions: number;
    users: number;
    resources: number;
  } {
    const entries = Array.from(this.auditStore.values());
    
    const stats = {
      totalEntries: entries.length,
      chainLength: entries.length,
      oldestEntry: undefined as Date | undefined,
      newestEntry: undefined as Date | undefined,
      criticalActions: 0,
      users: new Set<string>(),
      resources: new Set<string>()
    };

    entries.forEach(entry => {
      const timestamp = new Date(entry.timestamp);
      
      if (!stats.oldestEntry || timestamp < stats.oldestEntry) {
        stats.oldestEntry = timestamp;
      }
      
      if (!stats.newestEntry || timestamp > stats.newestEntry) {
        stats.newestEntry = timestamp;
      }

      if (this.isCriticalAction(entry.content.action)) {
        stats.criticalActions++;
      }

      stats.users.add(entry.content.actor.userId);
      stats.resources.add(entry.content.resource.id);
    });

    return {
      ...stats,
      users: stats.users.size,
      resources: stats.resources.size
    };
  }
}