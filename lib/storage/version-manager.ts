import { Zone } from '../../app/components/zones/ZoneManager';
import { ManualOverride } from '../../app/hooks/useManualOverride';

// Core interfaces for version management
export interface Version {
  id: string;
  versionNumber: number;
  timestamp: number;
  author: string;
  description: string;
  changeType: 'manual_override' | 'system_update' | 'collaboration' | 'restoration';
  zones: Zone[];
  overrides: ManualOverride[];
  metadata: VersionMetadata;
}

export interface VersionMetadata {
  documentId: string;
  pageCount: number;
  zoneCount: number;
  overrideCount: number;
  averageConfidence: number;
  processingTools: string[];
  fileHash?: string;
  parentVersion?: string;
  tags?: string[];
}

export interface VersionDiff {
  versionA: string;
  versionB: string;
  timestamp: number;
  changes: DiffChange[];
  summary: DiffSummary;
}

export interface DiffChange {
  type: 'zone_added' | 'zone_removed' | 'zone_modified' | 'override_added' | 'override_removed';
  zoneId: string;
  field?: string;
  oldValue?: any;
  newValue?: any;
  metadata?: {
    confidence?: { old: number; new: number };
    tool?: { old: string; new: string };
    content?: { old: string; new: string };
    coordinates?: { old: any; new: any };
  };
}

export interface DiffSummary {
  totalChanges: number;
  zonesAdded: number;
  zonesRemoved: number;
  zonesModified: number;
  overridesAdded: number;
  overridesRemoved: number;
  confidenceImprovement: number;
}

export interface VersionHistoryEntry {
  versionId: string;
  versionNumber: number;
  timestamp: number;
  author: string;
  description: string;
  changeCount: number;
  size: number;
}

export interface VersionStorageOptions {
  maxVersions?: number;
  compressionEnabled?: boolean;
  autoSnapshot?: boolean;
  snapshotInterval?: number;
  diffOnly?: boolean;
}

export interface VersionComparison {
  version1: Version;
  version2: Version;
  diff: VersionDiff;
  canMerge: boolean;
  conflicts: VersionConflict[];
}

export interface VersionConflict {
  zoneId: string;
  field: string;
  version1Value: any;
  version2Value: any;
  resolution?: 'use_version1' | 'use_version2' | 'manual';
}

// Version Manager implementation
export class VersionManager {
  private versions: Map<string, Version>;
  private versionHistory: Map<string, VersionHistoryEntry[]>;
  private currentVersions: Map<string, string>; // documentId -> versionId
  private options: Required<VersionStorageOptions>;
  private compressionWorker?: Worker;

  constructor(options: VersionStorageOptions = {}) {
    this.versions = new Map();
    this.versionHistory = new Map();
    this.currentVersions = new Map();
    this.options = {
      maxVersions: options.maxVersions || 50,
      compressionEnabled: options.compressionEnabled ?? true,
      autoSnapshot: options.autoSnapshot ?? true,
      snapshotInterval: options.snapshotInterval || 300000, // 5 minutes
      diffOnly: options.diffOnly ?? false
    };

    if (this.options.compressionEnabled && typeof Worker !== 'undefined') {
      // Initialize compression worker for background compression
      this.initCompressionWorker();
    }
  }

  // Create a new version
  async createVersion(
    documentId: string,
    zones: Zone[],
    overrides: ManualOverride[],
    description: string,
    author: string,
    changeType: Version['changeType'] = 'manual_override'
  ): Promise<Version> {
    const currentVersion = await this.getCurrentVersion(documentId);
    const versionNumber = currentVersion ? currentVersion.versionNumber + 1 : 1;
    
    const version: Version = {
      id: `v_${documentId}_${versionNumber}_${Date.now()}`,
      versionNumber,
      timestamp: Date.now(),
      author,
      description,
      changeType,
      zones: this.options.diffOnly && currentVersion ? [] : zones,
      overrides: this.options.diffOnly && currentVersion ? [] : overrides,
      metadata: {
        documentId,
        pageCount: this.getPageCount(zones),
        zoneCount: zones.length,
        overrideCount: overrides.length,
        averageConfidence: this.calculateAverageConfidence(zones),
        processingTools: this.getUniqueTools(zones),
        parentVersion: currentVersion?.id
      }
    };

    // Store version
    await this.storeVersion(version);

    // Generate and store diff if needed
    if (currentVersion && this.options.diffOnly) {
      const diff = await this.generateDiff(currentVersion, version, zones, overrides);
      await this.storeDiff(version.id, diff);
    }

    // Update current version
    this.currentVersions.set(documentId, version.id);

    // Add to history
    this.addToHistory(documentId, version);

    // Cleanup old versions if needed
    await this.cleanupOldVersions(documentId);

    return version;
  }

  // Get current version
  async getCurrentVersion(documentId: string): Promise<Version | null> {
    const versionId = this.currentVersions.get(documentId);
    if (!versionId) return null;
    
    return this.getVersion(versionId);
  }

  // Get specific version
  async getVersion(versionId: string): Promise<Version | null> {
    const version = this.versions.get(versionId);
    if (!version) return null;

    // If using diff-only storage, reconstruct full version
    if (this.options.diffOnly && version.metadata.parentVersion) {
      return this.reconstructVersion(version);
    }

    return version;
  }

  // Get version history
  getVersionHistory(documentId: string): VersionHistoryEntry[] {
    return this.versionHistory.get(documentId) || [];
  }

  // Generate diff between versions
  async generateDiff(
    versionA: Version,
    versionB: Version,
    newZones?: Zone[],
    newOverrides?: ManualOverride[]
  ): Promise<VersionDiff> {
    const changes: DiffChange[] = [];
    
    // Get full data for both versions
    const zonesA = versionA.zones.length > 0 ? versionA.zones : await this.getVersionZones(versionA.id);
    const zonesB = newZones || (versionB.zones.length > 0 ? versionB.zones : await this.getVersionZones(versionB.id));
    
    const overridesA = versionA.overrides;
    const overridesB = newOverrides || versionB.overrides;

    // Create maps for efficient comparison
    const zoneMapA = new Map(zonesA.map(z => [z.id, z]));
    const zoneMapB = new Map(zonesB.map(z => [z.id, z]));
    const overrideMapA = new Map(overridesA.map(o => [o.id, o]));
    const overrideMapB = new Map(overridesB.map(o => [o.id, o]));

    // Check for added/removed/modified zones
    for (const [zoneId, zoneB] of zoneMapB) {
      const zoneA = zoneMapA.get(zoneId);
      
      if (!zoneA) {
        // Zone added
        changes.push({
          type: 'zone_added',
          zoneId,
          newValue: zoneB
        });
      } else {
        // Check for modifications
        const modifications = this.compareZones(zoneA, zoneB);
        changes.push(...modifications);
      }
    }

    // Check for removed zones
    for (const [zoneId, zoneA] of zoneMapA) {
      if (!zoneMapB.has(zoneId)) {
        changes.push({
          type: 'zone_removed',
          zoneId,
          oldValue: zoneA
        });
      }
    }

    // Check for override changes
    for (const [overrideId, overrideB] of overrideMapB) {
      if (!overrideMapA.has(overrideId)) {
        changes.push({
          type: 'override_added',
          zoneId: overrideB.zoneId,
          newValue: overrideB
        });
      }
    }

    for (const [overrideId, overrideA] of overrideMapA) {
      if (!overrideMapB.has(overrideId)) {
        changes.push({
          type: 'override_removed',
          zoneId: overrideA.zoneId,
          oldValue: overrideA
        });
      }
    }

    // Calculate summary
    const summary = this.calculateDiffSummary(changes, zonesA, zonesB);

    return {
      versionA: versionA.id,
      versionB: versionB.id,
      timestamp: Date.now(),
      changes,
      summary
    };
  }

  // Compare two zones and return modifications
  private compareZones(zoneA: Zone, zoneB: Zone): DiffChange[] {
    const changes: DiffChange[] = [];
    
    // Check confidence change
    if (zoneA.confidence !== zoneB.confidence) {
      changes.push({
        type: 'zone_modified',
        zoneId: zoneA.id,
        field: 'confidence',
        oldValue: zoneA.confidence,
        newValue: zoneB.confidence,
        metadata: {
          confidence: { old: zoneA.confidence, new: zoneB.confidence }
        }
      });
    }

    // Check tool change
    if (zoneA.assignedTool !== zoneB.assignedTool) {
      changes.push({
        type: 'zone_modified',
        zoneId: zoneA.id,
        field: 'assignedTool',
        oldValue: zoneA.assignedTool,
        newValue: zoneB.assignedTool,
        metadata: {
          tool: { old: zoneA.assignedTool || '', new: zoneB.assignedTool || '' }
        }
      });
    }

    // Check content change
    if (zoneA.textContent !== zoneB.textContent) {
      changes.push({
        type: 'zone_modified',
        zoneId: zoneA.id,
        field: 'textContent',
        oldValue: zoneA.textContent,
        newValue: zoneB.textContent,
        metadata: {
          content: { old: zoneA.textContent || '', new: zoneB.textContent || '' }
        }
      });
    }

    // Check coordinate changes
    if (JSON.stringify(zoneA.coordinates) !== JSON.stringify(zoneB.coordinates)) {
      changes.push({
        type: 'zone_modified',
        zoneId: zoneA.id,
        field: 'coordinates',
        oldValue: zoneA.coordinates,
        newValue: zoneB.coordinates,
        metadata: {
          coordinates: { old: zoneA.coordinates, new: zoneB.coordinates }
        }
      });
    }

    return changes;
  }

  // Calculate diff summary
  private calculateDiffSummary(
    changes: DiffChange[],
    zonesA: Zone[],
    zonesB: Zone[]
  ): DiffSummary {
    const summary: DiffSummary = {
      totalChanges: changes.length,
      zonesAdded: changes.filter(c => c.type === 'zone_added').length,
      zonesRemoved: changes.filter(c => c.type === 'zone_removed').length,
      zonesModified: changes.filter(c => c.type === 'zone_modified').length,
      overridesAdded: changes.filter(c => c.type === 'override_added').length,
      overridesRemoved: changes.filter(c => c.type === 'override_removed').length,
      confidenceImprovement: 0
    };

    // Calculate confidence improvement
    const avgConfidenceA = this.calculateAverageConfidence(zonesA);
    const avgConfidenceB = this.calculateAverageConfidence(zonesB);
    summary.confidenceImprovement = avgConfidenceB - avgConfidenceA;

    return summary;
  }

  // Compare versions
  async compareVersions(versionId1: string, versionId2: string): Promise<VersionComparison | null> {
    const version1 = await this.getVersion(versionId1);
    const version2 = await this.getVersion(versionId2);
    
    if (!version1 || !version2) return null;

    const diff = await this.generateDiff(version1, version2);
    const conflicts = this.detectConflicts(diff);

    return {
      version1,
      version2,
      diff,
      canMerge: conflicts.length === 0,
      conflicts
    };
  }

  // Detect conflicts between changes
  private detectConflicts(diff: VersionDiff): VersionConflict[] {
    const conflicts: VersionConflict[] = [];
    
    // Group changes by zoneId
    const changesByZone = new Map<string, DiffChange[]>();
    for (const change of diff.changes) {
      const zoneChanges = changesByZone.get(change.zoneId) || [];
      zoneChanges.push(change);
      changesByZone.set(change.zoneId, zoneChanges);
    }

    // Check for conflicting changes
    for (const [zoneId, changes] of changesByZone) {
      const fieldChanges = new Map<string, DiffChange[]>();
      
      for (const change of changes) {
        if (change.field) {
          const fieldChangeList = fieldChanges.get(change.field) || [];
          fieldChangeList.push(change);
          fieldChanges.set(change.field, fieldChangeList);
        }
      }

      // If same field changed multiple times, it's a conflict
      for (const [field, fieldChangeList] of fieldChanges) {
        if (fieldChangeList.length > 1) {
          conflicts.push({
            zoneId,
            field,
            version1Value: fieldChangeList[0].oldValue,
            version2Value: fieldChangeList[fieldChangeList.length - 1].newValue
          });
        }
      }
    }

    return conflicts;
  }

  // Restore a specific version
  async restoreVersion(versionId: string, author: string): Promise<Version> {
    const versionToRestore = await this.getVersion(versionId);
    if (!versionToRestore) {
      throw new Error(`Version ${versionId} not found`);
    }

    // Get full zones and overrides for the version
    const zones = await this.getVersionZones(versionId);
    const overrides = await this.getVersionOverrides(versionId);

    // Create a new version as a restoration
    const restoredVersion = await this.createVersion(
      versionToRestore.metadata.documentId,
      zones,
      overrides,
      `Restored from version ${versionToRestore.versionNumber}`,
      author,
      'restoration'
    );

    return restoredVersion;
  }

  // Get zones for a specific version
  private async getVersionZones(versionId: string): Promise<Zone[]> {
    const version = this.versions.get(versionId);
    if (!version) return [];

    // If zones are stored directly, return them
    if (version.zones.length > 0) {
      return version.zones;
    }

    // Otherwise, reconstruct from diffs
    return this.reconstructZones(version);
  }

  // Get overrides for a specific version
  private async getVersionOverrides(versionId: string): Promise<ManualOverride[]> {
    const version = this.versions.get(versionId);
    if (!version) return [];

    if (version.overrides.length > 0) {
      return version.overrides;
    }

    return this.reconstructOverrides(version);
  }

  // Reconstruct zones from diffs
  private async reconstructZones(version: Version): Promise<Zone[]> {
    if (!version.metadata.parentVersion) {
      return version.zones;
    }

    // Get parent zones
    const parentZones = await this.getVersionZones(version.metadata.parentVersion);
    const diff = await this.loadDiff(version.id);
    
    if (!diff) return parentZones;

    // Apply diff to parent zones
    const zoneMap = new Map(parentZones.map(z => [z.id, { ...z }]));

    for (const change of diff.changes) {
      switch (change.type) {
        case 'zone_added':
          zoneMap.set(change.zoneId, change.newValue as Zone);
          break;
          
        case 'zone_removed':
          zoneMap.delete(change.zoneId);
          break;
          
        case 'zone_modified':
          const zone = zoneMap.get(change.zoneId);
          if (zone && change.field) {
            (zone as any)[change.field] = change.newValue;
          }
          break;
      }
    }

    return Array.from(zoneMap.values());
  }

  // Reconstruct overrides from diffs
  private async reconstructOverrides(version: Version): Promise<ManualOverride[]> {
    if (!version.metadata.parentVersion) {
      return version.overrides;
    }

    const parentOverrides = await this.getVersionOverrides(version.metadata.parentVersion);
    const diff = await this.loadDiff(version.id);
    
    if (!diff) return parentOverrides;

    const overrideMap = new Map(parentOverrides.map(o => [o.id, o]));

    for (const change of diff.changes) {
      if (change.type === 'override_added') {
        const override = change.newValue as ManualOverride;
        overrideMap.set(override.id, override);
      } else if (change.type === 'override_removed') {
        const override = change.oldValue as ManualOverride;
        overrideMap.delete(override.id);
      }
    }

    return Array.from(overrideMap.values());
  }

  // Reconstruct full version from diffs
  private async reconstructVersion(version: Version): Promise<Version> {
    const zones = await this.reconstructZones(version);
    const overrides = await this.reconstructOverrides(version);

    return {
      ...version,
      zones,
      overrides
    };
  }

  // Storage optimization
  async optimizeStorage(documentId: string): Promise<void> {
    const history = this.getVersionHistory(documentId);
    
    // Convert old full versions to diff-only storage
    for (let i = 0; i < history.length - 1; i++) {
      const version = await this.getVersion(history[i].versionId);
      if (version && version.zones.length > 0) {
        await this.convertToDiffStorage(version);
      }
    }

    // Compress old versions
    if (this.options.compressionEnabled) {
      await this.compressOldVersions(documentId);
    }
  }

  // Convert full version to diff storage
  private async convertToDiffStorage(version: Version): Promise<void> {
    if (!version.metadata.parentVersion) return;

    const parentVersion = await this.getVersion(version.metadata.parentVersion);
    if (!parentVersion) return;

    const diff = await this.generateDiff(parentVersion, version);
    await this.storeDiff(version.id, diff);

    // Clear zones and overrides from version
    version.zones = [];
    version.overrides = [];
    
    await this.storeVersion(version);
  }

  // Helper methods
  private getPageCount(zones: Zone[]): number {
    return Math.max(...zones.map(z => z.pageNumber), 0);
  }

  private calculateAverageConfidence(zones: Zone[]): number {
    if (zones.length === 0) return 0;
    const sum = zones.reduce((acc, zone) => acc + zone.confidence, 0);
    return sum / zones.length;
  }

  private getUniqueTools(zones: Zone[]): string[] {
    const tools = new Set<string>();
    zones.forEach(zone => {
      if (zone.assignedTool) {
        tools.add(zone.assignedTool);
      }
    });
    return Array.from(tools);
  }

  private addToHistory(documentId: string, version: Version): void {
    const history = this.versionHistory.get(documentId) || [];
    
    history.push({
      versionId: version.id,
      versionNumber: version.versionNumber,
      timestamp: version.timestamp,
      author: version.author,
      description: version.description,
      changeCount: version.metadata.zoneCount + version.metadata.overrideCount,
      size: this.estimateVersionSize(version)
    });

    // Sort by version number
    history.sort((a, b) => b.versionNumber - a.versionNumber);
    
    this.versionHistory.set(documentId, history);
  }

  private estimateVersionSize(version: Version): number {
    // Rough estimation of version size in bytes
    const baseSize = JSON.stringify(version.metadata).length;
    const zonesSize = version.zones.length * 500; // Estimate 500 bytes per zone
    const overridesSize = version.overrides.length * 200; // Estimate 200 bytes per override
    
    return baseSize + zonesSize + overridesSize;
  }

  private async cleanupOldVersions(documentId: string): Promise<void> {
    const history = this.getVersionHistory(documentId);
    
    if (history.length > this.options.maxVersions) {
      const versionsToRemove = history
        .slice(this.options.maxVersions)
        .map(h => h.versionId);
      
      for (const versionId of versionsToRemove) {
        await this.removeVersion(versionId);
      }
    }
  }

  private async removeVersion(versionId: string): Promise<void> {
    this.versions.delete(versionId);
    // Also remove associated diffs
    await this.removeDiff(versionId);
  }

  // Storage methods (would be implemented with actual storage backend)
  private async storeVersion(version: Version): Promise<void> {
    this.versions.set(version.id, version);
  }

  private async storeDiff(versionId: string, diff: VersionDiff): Promise<void> {
    // In a real implementation, this would store to a database or file system
    console.log('Storing diff for version:', versionId);
  }

  private async loadDiff(versionId: string): Promise<VersionDiff | null> {
    // In a real implementation, this would load from storage
    return null;
  }

  private async removeDiff(versionId: string): Promise<void> {
    // In a real implementation, this would remove from storage
    console.log('Removing diff for version:', versionId);
  }

  private async compressOldVersions(documentId: string): Promise<void> {
    // In a real implementation, this would compress old versions
    console.log('Compressing old versions for document:', documentId);
  }

  private initCompressionWorker(): void {
    // In a real implementation, this would initialize a web worker
    console.log('Initializing compression worker');
  }
}

// Create singleton instance
export const versionManager = new VersionManager();