import { Zone } from '../../app/components/zones/ZoneManager';
import { DetectedZone, ContentAnalysisResult } from '../pdf-processing/content-analyzer';
import { ToolAssignmentResult } from '../pdf-processing/tool-assignment';

// Core interfaces for zone persistence
export interface ZonePersistenceManager {
  saveZones(documentId: string, zones: Zone[]): Promise<void>;
  loadZones(documentId: string): Promise<Zone[]>;
  saveZoneVersion(documentId: string, zoneId: string, version: ZoneVersion): Promise<string>;
  getZoneHistory(documentId: string, zoneId: string): Promise<ZoneVersion[]>;
  restoreZoneVersion(documentId: string, zoneId: string, versionId: string): Promise<Zone>;
  deleteZone(documentId: string, zoneId: string): Promise<void>;
  exportZones(documentId: string, format: ExportFormat): Promise<ExportResult>;
  importZones(documentId: string, data: ImportData): Promise<ImportResult>;
  getDocumentState(documentId: string): Promise<DocumentState>;
  saveDocumentState(documentId: string, state: DocumentState): Promise<void>;
}

export interface ZoneVersion {
  id: string;
  zoneId: string;
  version: number;
  timestamp: Date;
  author: string;
  description: string;
  zoneData: Zone;
  changeType: ChangeType;
  changes: ZoneChange[];
  metadata: VersionMetadata;
}

export interface ZoneChange {
  field: string;
  oldValue: any;
  newValue: any;
  changeReason?: string;
}

export interface VersionMetadata {
  source: 'user' | 'system' | 'ai' | 'import';
  confidence?: number;
  processingTime?: number;
  toolUsed?: string;
  qualityScore?: number;
  reviewStatus?: 'pending' | 'approved' | 'rejected';
}

export type ChangeType = 
  | 'created' 
  | 'coordinates_updated' 
  | 'type_changed' 
  | 'tool_assigned' 
  | 'content_updated' 
  | 'merged' 
  | 'split' 
  | 'deleted' 
  | 'restored';

export interface DocumentState {
  documentId: string;
  lastModified: Date;
  totalZones: number;
  completedZones: number;
  processingStatus: 'pending' | 'processing' | 'completed' | 'failed';
  version: number;
  checksum: string;
  metadata: DocumentMetadata;
  zones: ZoneReference[];
  analysisResults?: ContentAnalysisResult;
  toolAssignments?: ToolAssignmentResult[];
}

export interface DocumentMetadata {
  fileName: string;
  fileSize: number;
  pageCount: number;
  createdAt: Date;
  lastProcessedAt?: Date;
  processingHistory: ProcessingEvent[];
  tags: string[];
  priority: 'low' | 'medium' | 'high';
  owner: string;
}

export interface ZoneReference {
  zoneId: string;
  pageNumber: number;
  contentType: string;
  status: string;
  lastModified: Date;
  version: number;
}

export interface ProcessingEvent {
  timestamp: Date;
  event: string;
  details: Record<string, any>;
  success: boolean;
  duration?: number;
  error?: string;
}

export type ExportFormat = 'json' | 'xml' | 'csv' | 'geojson' | 'pdf_annotations';

export interface ExportResult {
  format: ExportFormat;
  data: string | Buffer;
  fileName: string;
  metadata: ExportMetadata;
}

export interface ExportMetadata {
  exportedAt: Date;
  documentId: string;
  zoneCount: number;
  version: number;
  includesHistory: boolean;
  compressionUsed?: string;
}

export interface ImportData {
  format: ExportFormat;
  data: string | Buffer;
  options: ImportOptions;
}

export interface ImportOptions {
  mergeStrategy: 'replace' | 'merge' | 'append';
  preserveIds: boolean;
  validateIntegrity: boolean;
  createBackup: boolean;
  conflictResolution: 'user' | 'newer' | 'higher_confidence';
}

export interface ImportResult {
  success: boolean;
  importedZones: number;
  skippedZones: number;
  errors: ImportError[];
  warnings: string[];
  backupId?: string;
}

export interface ImportError {
  zoneId?: string;
  error: string;
  details: string;
  severity: 'warning' | 'error' | 'critical';
}

// Recovery interfaces
export interface RecoveryManager {
  createCheckpoint(documentId: string, description?: string): Promise<CheckpointInfo>;
  restoreFromCheckpoint(documentId: string, checkpointId: string): Promise<RecoveryResult>;
  listCheckpoints(documentId: string): Promise<CheckpointInfo[]>;
  deleteCheckpoint(documentId: string, checkpointId: string): Promise<void>;
  validateIntegrity(documentId: string): Promise<IntegrityReport>;
  repairCorruption(documentId: string, repairOptions: RepairOptions): Promise<RepairResult>;
}

export interface CheckpointInfo {
  id: string;
  documentId: string;
  timestamp: Date;
  description: string;
  zoneCount: number;
  dataSize: number;
  integrity: boolean;
}

export interface RecoveryResult {
  success: boolean;
  restoredZones: number;
  errors: string[];
  timestamp: Date;
}

export interface IntegrityReport {
  isValid: boolean;
  issues: IntegrityIssue[];
  recommendations: string[];
  lastChecked: Date;
}

export interface IntegrityIssue {
  type: 'missing_data' | 'corrupted_data' | 'version_mismatch' | 'invalid_reference';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  affectedZones: string[];
  autoFixable: boolean;
}

export interface RepairOptions {
  autoFix: boolean;
  backupBeforeRepair: boolean;
  fixTypes: string[];
  preserveUserChanges: boolean;
}

export interface RepairResult {
  success: boolean;
  fixedIssues: number;
  remainingIssues: number;
  backupId?: string;
  report: string;
}

// Storage interfaces
export interface StorageAdapter {
  save(key: string, data: any): Promise<void>;
  load(key: string): Promise<any>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  list(prefix: string): Promise<string[]>;
  backup(key: string): Promise<string>;
  restore(backupId: string): Promise<void>;
}

// Main implementation classes
export class ZonePersistence implements ZonePersistenceManager {
  private storage: StorageAdapter;
  private recovery: RecoveryManager;
  private versionManager: VersionManager;
  private validator: DataValidator;

  constructor(storage: StorageAdapter) {
    this.storage = storage;
    this.recovery = new ZoneRecoveryManager(storage);
    this.versionManager = new ZoneVersionManager(storage);
    this.validator = new ZoneDataValidator();
  }

  async saveZones(documentId: string, zones: Zone[]): Promise<void> {
    try {
      // Validate zones before saving
      const validationResult = await this.validator.validateZones(zones);
      if (!validationResult.isValid) {
        throw new Error(`Zone validation failed: ${validationResult.errors.join(', ')}`);
      }

      // Create checkpoint before major changes
      if (zones.length > 10) {
        await this.recovery.createCheckpoint(documentId, 'Before bulk zone save');
      }

      // Save zones with versioning
      const savePromises = zones.map(async (zone) => {
        const key = this.getZoneKey(documentId, zone.id);
        
        // Check if zone exists and create version if modified
        if (await this.storage.exists(key)) {
          const existingZone = await this.storage.load(key);
          if (this.hasZoneChanged(existingZone, zone)) {
            await this.versionManager.createVersion(documentId, zone, 'updated');
          }
        } else {
          await this.versionManager.createVersion(documentId, zone, 'created');
        }

        // Save current zone
        await this.storage.save(key, {
          ...zone,
          lastModified: new Date(),
          version: await this.versionManager.getNextVersion(documentId, zone.id)
        });
      });

      await Promise.all(savePromises);

      // Update document state
      await this.updateDocumentState(documentId, zones);

      console.log(`Successfully saved ${zones.length} zones for document ${documentId}`);
    } catch (error) {
      console.error('Failed to save zones:', error);
      throw new Error(`Zone persistence failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async loadZones(documentId: string): Promise<Zone[]> {
    try {
      const state = await this.getDocumentState(documentId);
      if (!state) {
        return [];
      }

      const loadPromises = state.zones.map(async (ref) => {
        const key = this.getZoneKey(documentId, ref.zoneId);
        try {
          const zone = await this.storage.load(key);
          return zone as Zone;
        } catch (error) {
          console.warn(`Failed to load zone ${ref.zoneId}:`, error);
          return null;
        }
      });

      const zones = await Promise.all(loadPromises);
      const validZones = zones.filter((zone): zone is Zone => zone !== null);

      console.log(`Loaded ${validZones.length} zones for document ${documentId}`);
      return validZones;
    } catch (error) {
      console.error('Failed to load zones:', error);
      return [];
    }
  }

  async saveZoneVersion(documentId: string, zoneId: string, version: ZoneVersion): Promise<string> {
    const versionKey = this.getVersionKey(documentId, zoneId, version.version);
    await this.storage.save(versionKey, version);
    return version.id;
  }

  async getZoneHistory(documentId: string, zoneId: string): Promise<ZoneVersion[]> {
    const prefix = this.getVersionPrefix(documentId, zoneId);
    const versionKeys = await this.storage.list(prefix);
    
    const versions = await Promise.all(
      versionKeys.map(key => this.storage.load(key))
    );

    return versions
      .filter((v): v is ZoneVersion => v !== null)
      .sort((a, b) => b.version - a.version);
  }

  async restoreZoneVersion(documentId: string, zoneId: string, versionId: string): Promise<Zone> {
    const history = await this.getZoneHistory(documentId, zoneId);
    const version = history.find(v => v.id === versionId);
    
    if (!version) {
      throw new Error(`Version ${versionId} not found for zone ${zoneId}`);
    }

    // Create new version marking this as a restoration
    await this.versionManager.createVersion(documentId, version.zoneData, 'restored');

    // Save restored zone as current
    const zoneKey = this.getZoneKey(documentId, zoneId);
    const restoredZone = {
      ...version.zoneData,
      lastModified: new Date(),
      userModified: true
    };

    await this.storage.save(zoneKey, restoredZone);
    return restoredZone;
  }

  async deleteZone(documentId: string, zoneId: string): Promise<void> {
    const zoneKey = this.getZoneKey(documentId, zoneId);
    
    // Create version before deletion
    const existingZone = await this.storage.load(zoneKey);
    if (existingZone) {
      await this.versionManager.createVersion(documentId, existingZone, 'deleted');
    }

    // Soft delete by marking as deleted
    if (existingZone) {
      await this.storage.save(zoneKey, {
        ...existingZone,
        status: 'deleted',
        lastModified: new Date()
      });
    }
  }

  async exportZones(documentId: string, format: ExportFormat): Promise<ExportResult> {
    const zones = await this.loadZones(documentId);
    const state = await this.getDocumentState(documentId);
    
    const exportData = {
      document: state,
      zones: zones,
      exportMetadata: {
        exportedAt: new Date(),
        documentId,
        zoneCount: zones.length,
        version: state?.version || 1,
        includesHistory: false
      }
    };

    let data: string | Buffer;
    let fileName: string;

    switch (format) {
      case 'json':
        data = JSON.stringify(exportData, null, 2);
        fileName = `zones_${documentId}.json`;
        break;
      
      case 'xml':
        data = this.convertToXML(exportData);
        fileName = `zones_${documentId}.xml`;
        break;
      
      case 'csv':
        data = this.convertToCSV(zones);
        fileName = `zones_${documentId}.csv`;
        break;
      
      case 'geojson':
        data = this.convertToGeoJSON(zones);
        fileName = `zones_${documentId}.geojson`;
        break;
      
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }

    return {
      format,
      data,
      fileName,
      metadata: exportData.exportMetadata
    };
  }

  async importZones(documentId: string, data: ImportData): Promise<ImportResult> {
    const result: ImportResult = {
      success: false,
      importedZones: 0,
      skippedZones: 0,
      errors: [],
      warnings: []
    };

    try {
      // Create backup if requested
      if (data.options.createBackup) {
        result.backupId = await this.recovery.createCheckpoint(
          documentId, 
          'Before zone import'
        ).then(info => info.id);
      }

      // Parse import data
      let zones: Zone[];
      switch (data.format) {
        case 'json':
          zones = this.parseJSONImport(data.data as string);
          break;
        case 'xml':
          zones = this.parseXMLImport(data.data as string);
          break;
        case 'csv':
          zones = this.parseCSVImport(data.data as string);
          break;
        default:
          throw new Error(`Unsupported import format: ${data.format}`);
      }

      // Process each zone
      for (const zone of zones) {
        try {
          await this.importSingleZone(documentId, zone, data.options);
          result.importedZones++;
        } catch (error) {
          result.errors.push({
            zoneId: zone.id,
            error: 'Import failed',
            details: error instanceof Error ? error.message : 'Unknown error',
            severity: 'error'
          });
          result.skippedZones++;
        }
      }

      result.success = result.errors.length === 0 || result.importedZones > 0;
    } catch (error) {
      result.errors.push({
        error: 'Import process failed',
        details: error instanceof Error ? error.message : 'Unknown error',
        severity: 'critical'
      });
    }

    return result;
  }

  async getDocumentState(documentId: string): Promise<DocumentState | null> {
    const stateKey = this.getDocumentStateKey(documentId);
    try {
      return await this.storage.load(stateKey);
    } catch {
      return null;
    }
  }

  async saveDocumentState(documentId: string, state: DocumentState): Promise<void> {
    const stateKey = this.getDocumentStateKey(documentId);
    await this.storage.save(stateKey, {
      ...state,
      lastModified: new Date(),
      checksum: this.calculateChecksum(state)
    });
  }

  // Private helper methods
  private getZoneKey(documentId: string, zoneId: string): string {
    return `documents/${documentId}/zones/${zoneId}`;
  }

  private getVersionKey(documentId: string, zoneId: string, version: number): string {
    return `documents/${documentId}/zones/${zoneId}/versions/${version}`;
  }

  private getVersionPrefix(documentId: string, zoneId: string): string {
    return `documents/${documentId}/zones/${zoneId}/versions/`;
  }

  private getDocumentStateKey(documentId: string): string {
    return `documents/${documentId}/state`;
  }

  private hasZoneChanged(oldZone: Zone, newZone: Zone): boolean {
    // Compare key fields to detect changes
    const fieldsToCompare = [
      'coordinates', 'contentType', 'confidence', 
      'assignedTool', 'status', 'textContent'
    ];

    return fieldsToCompare.some(field => {
      const oldValue = JSON.stringify((oldZone as any)[field]);
      const newValue = JSON.stringify((newZone as any)[field]);
      return oldValue !== newValue;
    });
  }

  private async updateDocumentState(documentId: string, zones: Zone[]): Promise<void> {
    const existingState = await this.getDocumentState(documentId) || {
      documentId,
      lastModified: new Date(),
      totalZones: 0,
      completedZones: 0,
      processingStatus: 'pending' as const,
      version: 1,
      checksum: '',
      metadata: {
        fileName: '',
        fileSize: 0,
        pageCount: 0,
        createdAt: new Date(),
        processingHistory: [],
        tags: [],
        priority: 'medium' as const,
        owner: ''
      },
      zones: []
    };

    const completedZones = zones.filter(z => z.status === 'completed').length;
    const processingStatus = completedZones === zones.length ? 'completed' : 
                           zones.some(z => z.status === 'processing') ? 'processing' : 'pending';

    const updatedState: DocumentState = {
      ...existingState,
      lastModified: new Date(),
      totalZones: zones.length,
      completedZones,
      processingStatus,
      version: existingState.version + 1,
      zones: zones.map(zone => ({
        zoneId: zone.id,
        pageNumber: zone.pageNumber,
        contentType: zone.contentType,
        status: zone.status,
        lastModified: zone.lastModified,
        version: 1 // Simplified version tracking
      }))
    };

    await this.saveDocumentState(documentId, updatedState);
  }

  private calculateChecksum(state: DocumentState): string {
    // Simple checksum calculation - in production would use proper hashing
    const dataString = JSON.stringify({
      zones: state.zones,
      totalZones: state.totalZones,
      version: state.version
    });
    return btoa(dataString).substring(0, 16);
  }

  private convertToXML(data: any): string {
    // Simplified XML conversion
    return `<?xml version="1.0" encoding="UTF-8"?>
<zones>
  ${data.zones.map((zone: Zone) => `
  <zone id="${zone.id}" type="${zone.contentType}">
    <coordinates x="${zone.coordinates.x}" y="${zone.coordinates.y}" 
                 width="${zone.coordinates.width}" height="${zone.coordinates.height}" />
    <confidence>${zone.confidence}</confidence>
    <status>${zone.status}</status>
  </zone>`).join('')}
</zones>`;
  }

  private convertToCSV(zones: Zone[]): string {
    const headers = ['id', 'type', 'x', 'y', 'width', 'height', 'confidence', 'status', 'assignedTool'];
    const rows = zones.map(zone => [
      zone.id,
      zone.contentType,
      zone.coordinates.x,
      zone.coordinates.y,
      zone.coordinates.width,
      zone.coordinates.height,
      zone.confidence,
      zone.status,
      zone.assignedTool || ''
    ]);

    return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
  }

  private convertToGeoJSON(zones: Zone[]): string {
    const features = zones.map(zone => ({
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [zone.coordinates.x, zone.coordinates.y],
          [zone.coordinates.x + zone.coordinates.width, zone.coordinates.y],
          [zone.coordinates.x + zone.coordinates.width, zone.coordinates.y + zone.coordinates.height],
          [zone.coordinates.x, zone.coordinates.y + zone.coordinates.height],
          [zone.coordinates.x, zone.coordinates.y]
        ]]
      },
      properties: {
        id: zone.id,
        type: zone.contentType,
        confidence: zone.confidence,
        status: zone.status,
        assignedTool: zone.assignedTool
      }
    }));

    return JSON.stringify({
      type: 'FeatureCollection',
      features
    }, null, 2);
  }

  private parseJSONImport(data: string): Zone[] {
    const parsed = JSON.parse(data);
    return parsed.zones || parsed; // Handle both wrapped and direct zone arrays
  }

  private parseXMLImport(data: string): Zone[] {
    // Simplified XML parsing - in production would use proper XML parser
    throw new Error('XML import not implemented in this example');
  }

  private parseCSVImport(data: string): Zone[] {
    const lines = data.split('\n');
    const headers = lines[0].split(',');
    
    return lines.slice(1).map((line, index) => {
      const values = line.split(',');
      const zone: Partial<Zone> = {};
      
      headers.forEach((header, i) => {
        const value = values[i]?.trim();
        switch (header.trim()) {
          case 'id':
            zone.id = value;
            break;
          case 'type':
            zone.contentType = value as Zone['contentType'];
            break;
          case 'x':
          case 'y':
          case 'width':
          case 'height':
            if (!zone.coordinates) zone.coordinates = {} as any;
            (zone.coordinates as any)[header] = parseFloat(value);
            break;
          case 'confidence':
            zone.confidence = parseFloat(value);
            break;
          case 'status':
            zone.status = value as Zone['status'];
            break;
          case 'assignedTool':
            zone.assignedTool = value || undefined;
            break;
        }
      });

      return {
        pageNumber: 1,
        userModified: true,
        lastModified: new Date(),
        characteristics: {
          textDensity: 0.5,
          lineSpacing: 12,
          wordSpacing: 4,
          fontSizes: [12],
          hasStructure: false,
          hasImages: false,
          complexity: 'medium' as const,
          readingOrder: index + 1
        },
        fallbackTools: [],
        ...zone
      } as Zone;
    });
  }

  private async importSingleZone(documentId: string, zone: Zone, options: ImportOptions): Promise<void> {
    const existingKey = this.getZoneKey(documentId, zone.id);
    const exists = await this.storage.exists(existingKey);

    if (exists && options.mergeStrategy === 'merge') {
      const existingZone = await this.storage.load(existingKey);
      const mergedZone = this.mergeZones(existingZone, zone, options);
      await this.storage.save(existingKey, mergedZone);
    } else if (!exists || options.mergeStrategy === 'replace') {
      await this.storage.save(existingKey, zone);
    }
    // 'append' strategy would generate new ID for duplicate zones
  }

  private mergeZones(existing: Zone, imported: Zone, options: ImportOptions): Zone {
    // Simple merge strategy - in production would be more sophisticated
    if (options.conflictResolution === 'newer') {
      return imported.lastModified > existing.lastModified ? imported : existing;
    } else if (options.conflictResolution === 'higher_confidence') {
      return imported.confidence > existing.confidence ? imported : existing;
    }
    return existing; // Default to existing
  }
}

// Supporting classes
class ZoneVersionManager {
  constructor(private storage: StorageAdapter) {}

  async createVersion(documentId: string, zone: Zone, changeType: ChangeType): Promise<string> {
    const version: ZoneVersion = {
      id: `v${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      zoneId: zone.id,
      version: await this.getNextVersion(documentId, zone.id),
      timestamp: new Date(),
      author: 'system', // Would be actual user in production
      description: `Zone ${changeType}`,
      zoneData: { ...zone },
      changeType,
      changes: [], // Would calculate actual changes
      metadata: {
        source: 'system',
        confidence: zone.confidence
      }
    };

    const versionKey = `documents/${documentId}/zones/${zone.id}/versions/${version.version}`;
    await this.storage.save(versionKey, version);
    return version.id;
  }

  async getNextVersion(documentId: string, zoneId: string): Promise<number> {
    const prefix = `documents/${documentId}/zones/${zoneId}/versions/`;
    const versions = await this.storage.list(prefix);
    return versions.length + 1;
  }
}

class ZoneRecoveryManager implements RecoveryManager {
  constructor(private storage: StorageAdapter) {}

  async createCheckpoint(documentId: string, description = 'Automatic checkpoint'): Promise<CheckpointInfo> {
    const checkpointId = `checkpoint_${Date.now()}`;
    const zones = await this.loadAllZones(documentId);
    
    const checkpoint: CheckpointInfo = {
      id: checkpointId,
      documentId,
      timestamp: new Date(),
      description,
      zoneCount: zones.length,
      dataSize: JSON.stringify(zones).length,
      integrity: true
    };

    await this.storage.save(`checkpoints/${documentId}/${checkpointId}`, {
      info: checkpoint,
      data: zones
    });

    return checkpoint;
  }

  async restoreFromCheckpoint(documentId: string, checkpointId: string): Promise<RecoveryResult> {
    try {
      const checkpointData = await this.storage.load(`checkpoints/${documentId}/${checkpointId}`);
      const zones = checkpointData.data as Zone[];

      // Restore zones
      for (const zone of zones) {
        const zoneKey = `documents/${documentId}/zones/${zone.id}`;
        await this.storage.save(zoneKey, zone);
      }

      return {
        success: true,
        restoredZones: zones.length,
        errors: [],
        timestamp: new Date()
      };
    } catch (error) {
      return {
        success: false,
        restoredZones: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
        timestamp: new Date()
      };
    }
  }

  async listCheckpoints(documentId: string): Promise<CheckpointInfo[]> {
    const prefix = `checkpoints/${documentId}/`;
    const checkpointKeys = await this.storage.list(prefix);
    
    const checkpoints = await Promise.all(
      checkpointKeys.map(async key => {
        const data = await this.storage.load(key);
        return data.info as CheckpointInfo;
      })
    );

    return checkpoints.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  async deleteCheckpoint(documentId: string, checkpointId: string): Promise<void> {
    await this.storage.delete(`checkpoints/${documentId}/${checkpointId}`);
  }

  async validateIntegrity(documentId: string): Promise<IntegrityReport> {
    const issues: IntegrityIssue[] = [];
    
    try {
      const state = await this.storage.load(`documents/${documentId}/state`);
      const zones = await this.loadAllZones(documentId);

      // Check zone count consistency
      if (state.totalZones !== zones.length) {
        issues.push({
          type: 'version_mismatch',
          severity: 'medium',
          description: 'Zone count mismatch between state and actual zones',
          affectedZones: [],
          autoFixable: true
        });
      }

      // Check for missing zone data
      for (const zoneRef of state.zones) {
        const zone = zones.find(z => z.id === zoneRef.zoneId);
        if (!zone) {
          issues.push({
            type: 'missing_data',
            severity: 'high',
            description: `Zone ${zoneRef.zoneId} referenced in state but not found`,
            affectedZones: [zoneRef.zoneId],
            autoFixable: false
          });
        }
      }

    } catch (error) {
      issues.push({
        type: 'corrupted_data',
        severity: 'critical',
        description: 'Failed to load document data',
        affectedZones: [],
        autoFixable: false
      });
    }

    return {
      isValid: issues.length === 0,
      issues,
      recommendations: this.generateRecommendations(issues),
      lastChecked: new Date()
    };
  }

  async repairCorruption(documentId: string, options: RepairOptions): Promise<RepairResult> {
    if (options.backupBeforeRepair) {
      await this.createCheckpoint(documentId, 'Before corruption repair');
    }

    const integrity = await this.validateIntegrity(documentId);
    let fixedIssues = 0;

    for (const issue of integrity.issues) {
      if (issue.autoFixable && options.autoFix) {
        try {
          await this.fixIssue(documentId, issue);
          fixedIssues++;
        } catch (error) {
          console.error(`Failed to fix issue: ${issue.description}`, error);
        }
      }
    }

    const remainingIssues = integrity.issues.length - fixedIssues;

    return {
      success: remainingIssues === 0,
      fixedIssues,
      remainingIssues,
      report: `Fixed ${fixedIssues} of ${integrity.issues.length} issues`
    };
  }

  private async loadAllZones(documentId: string): Promise<Zone[]> {
    const prefix = `documents/${documentId}/zones/`;
    const zoneKeys = await this.storage.list(prefix);
    
    const zones = await Promise.all(
      zoneKeys
        .filter(key => !key.includes('/versions/')) // Exclude version files
        .map(key => this.storage.load(key))
    );

    return zones.filter((zone): zone is Zone => zone !== null);
  }

  private generateRecommendations(issues: IntegrityIssue[]): string[] {
    const recommendations: string[] = [];
    
    if (issues.some(i => i.type === 'missing_data')) {
      recommendations.push('Consider restoring from a recent checkpoint');
    }
    
    if (issues.some(i => i.type === 'corrupted_data')) {
      recommendations.push('Run data repair with backup enabled');
    }
    
    if (issues.some(i => i.autoFixable)) {
      recommendations.push('Enable automatic repair for fixable issues');
    }

    return recommendations;
  }

  private async fixIssue(documentId: string, issue: IntegrityIssue): Promise<void> {
    switch (issue.type) {
      case 'version_mismatch':
        // Recalculate and update zone counts
        const zones = await this.loadAllZones(documentId);
        const state = await this.storage.load(`documents/${documentId}/state`);
        state.totalZones = zones.length;
        state.zones = zones.map(z => ({
          zoneId: z.id,
          pageNumber: z.pageNumber,
          contentType: z.contentType,
          status: z.status,
          lastModified: z.lastModified,
          version: 1
        }));
        await this.storage.save(`documents/${documentId}/state`, state);
        break;
      
      default:
        throw new Error(`No automatic fix available for issue type: ${issue.type}`);
    }
  }
}

class ZoneDataValidator {
  async validateZones(zones: Zone[]): Promise<{ isValid: boolean; errors: string[] }> {
    const errors: string[] = [];

    for (const zone of zones) {
      // Validate required fields
      if (!zone.id) errors.push(`Zone missing ID`);
      if (!zone.coordinates) errors.push(`Zone ${zone.id} missing coordinates`);
      if (!zone.contentType) errors.push(`Zone ${zone.id} missing content type`);
      if (zone.confidence === undefined || zone.confidence < 0 || zone.confidence > 1) {
        errors.push(`Zone ${zone.id} has invalid confidence value`);
      }

      // Validate coordinates
      if (zone.coordinates) {
        if (zone.coordinates.width <= 0 || zone.coordinates.height <= 0) {
          errors.push(`Zone ${zone.id} has invalid dimensions`);
        }
      }

      // Validate content type
      const validTypes = ['text', 'table', 'diagram', 'mixed', 'header', 'footer'];
      if (!validTypes.includes(zone.contentType)) {
        errors.push(`Zone ${zone.id} has invalid content type: ${zone.contentType}`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

// Export default instance factory
export function createZonePersistence(storage: StorageAdapter): ZonePersistenceManager {
  return new ZonePersistence(storage);
} 