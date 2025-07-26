'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Command, CommandType, useUndoRedo } from './useUndoRedo';
import { ManualOverride } from './useManualOverride';
import { Version, VersionManager } from '../../lib/storage/version-manager';
import { Zone } from '../components/zones/ZoneManager';

// Extended command interface for overrides
export interface OverrideCommand extends Command {
  category: 'override';
  impact: 'single' | 'batch';
  versionsAffected: string[];
  canGroupWith(other: OverrideCommand): boolean;
  preview(): OverridePreview;
}

export interface OverridePreview {
  affectedZones: string[];
  changes: PreviewChange[];
  estimatedImpact: {
    confidenceChange: number;
    processingTime: number;
    reversible: boolean;
  };
}

export interface PreviewChange {
  zoneId: string;
  field: string;
  currentValue: any;
  newValue: any;
  description: string;
}

export interface UseOverrideHistoryOptions {
  enableVersioning?: boolean;
  enablePreview?: boolean;
  groupRelatedChanges?: boolean;
  groupingWindow?: number;
  onRevert?: (overrideId: string) => void;
  onVersionCreate?: (version: Version) => void;
}

interface OverrideHistoryState {
  overrideHistory: OverrideCommand[];
  revertedOverrides: Set<string>;
  groupedCommands: Map<string, OverrideCommand[]>;
  activeGroup: string | null;
  lastGroupTime: number;
}

export interface RevertOptions {
  preserveSubsequentChanges?: boolean;
  createRestorePoint?: boolean;
  notifyCollaborators?: boolean;
}

export interface SelectiveUndoOptions {
  targetOverrides: string[];
  preserveOrder?: boolean;
  skipConflicts?: boolean;
}

export function useOverrideHistory(
  versionManager: VersionManager,
  options: UseOverrideHistoryOptions = {}
) {
  const {
    enableVersioning = true,
    enablePreview = true,
    groupRelatedChanges = true,
    groupingWindow = 5000, // 5 seconds
    onRevert,
    onVersionCreate
  } = options;

  const undoRedo = useUndoRedo({
    enableKeyboardShortcuts: true,
    maxHistorySize: 100
  });

  const [state, setState] = useState<OverrideHistoryState>({
    overrideHistory: [],
    revertedOverrides: new Set(),
    groupedCommands: new Map(),
    activeGroup: null,
    lastGroupTime: 0
  });

  const groupingTimeoutRef = useRef<NodeJS.Timeout>();

  // Create override command for tool change
  const createToolOverrideCommand = useCallback((
    zone: Zone,
    override: ManualOverride,
    onApply: (override: ManualOverride) => void,
    onRevert: (overrideId: string) => void
  ): OverrideCommand => {
    const baseCommand = undoRedo.createUpdateCommand(
      zone.id,
      { assignedTool: override.previousValue, confidence: zone.confidence },
      { assignedTool: override.newValue, confidence: 1.0 },
      (zoneId, values) => {
        // Update zone with new values
        console.log('Applying tool override:', zoneId, values);
      }
    );

    const overrideCommand: OverrideCommand = {
      ...baseCommand,
      category: 'override',
      impact: 'single',
      versionsAffected: [],
      canGroupWith: (other: OverrideCommand) => {
        // Group if same zone and within time window
        return other.data?.zoneId === zone.id && 
               other.type === 'zone_update' &&
               Math.abs(other.timestamp - baseCommand.timestamp) < groupingWindow;
      },
      preview: () => ({
        affectedZones: [zone.id],
        changes: [{
          zoneId: zone.id,
          field: 'assignedTool',
          currentValue: override.previousValue,
          newValue: override.newValue,
          description: `Change tool from ${override.previousValue || 'none'} to ${override.newValue}`
        }],
        estimatedImpact: {
          confidenceChange: 1.0 - zone.confidence,
          processingTime: 100,
          reversible: true
        }
      }),
      execute: async () => {
        await baseCommand.execute();
        onApply(override);
      },
      undo: async () => {
        await baseCommand.undo();
        onRevert(override.id);
      }
    };

    return overrideCommand;
  }, [undoRedo, groupingWindow]);

  // Create override command for content edit
  const createContentOverrideCommand = useCallback((
    zone: Zone,
    override: ManualOverride,
    onApply: (override: ManualOverride) => void,
    onRevert: (overrideId: string) => void
  ): OverrideCommand => {
    const baseCommand = undoRedo.createContentEditCommand(
      zone.id,
      override.previousValue,
      override.newValue,
      (zoneId, content) => {
        console.log('Applying content override:', zoneId);
      }
    );

    const overrideCommand: OverrideCommand = {
      ...baseCommand,
      category: 'override',
      impact: 'single',
      versionsAffected: [],
      canGroupWith: (other: OverrideCommand) => {
        // Group consecutive edits to same zone
        return other.data?.zoneId === zone.id && 
               other.type === 'content_edit' &&
               Math.abs(other.timestamp - baseCommand.timestamp) < groupingWindow;
      },
      preview: () => ({
        affectedZones: [zone.id],
        changes: [{
          zoneId: zone.id,
          field: 'textContent',
          currentValue: override.previousValue,
          newValue: override.newValue,
          description: 'Edit text content'
        }],
        estimatedImpact: {
          confidenceChange: 1.0 - zone.confidence,
          processingTime: 0,
          reversible: true
        }
      }),
      execute: async () => {
        await baseCommand.execute();
        onApply(override);
      },
      undo: async () => {
        await baseCommand.undo();
        onRevert(override.id);
      }
    };

    return overrideCommand;
  }, [undoRedo, groupingWindow]);

  // Create batch override command
  const createBatchOverrideCommand = useCallback((
    overrides: Array<{ zone: Zone; override: ManualOverride }>,
    onApply: (overrides: ManualOverride[]) => void,
    onRevert: (overrideIds: string[]) => void
  ): OverrideCommand => {
    const commands = overrides.map(({ zone, override }) => {
      if (override.type === 'tool_change') {
        return createToolOverrideCommand(zone, override, () => {}, () => {});
      } else if (override.type === 'content_edit') {
        return createContentOverrideCommand(zone, override, () => {}, () => {});
      }
      return null;
    }).filter(Boolean) as OverrideCommand[];

    const batchCommand = undoRedo.createBatchCommand(
      commands,
      `Batch override (${overrides.length} zones)`
    );

    const overrideCommand: OverrideCommand = {
      ...batchCommand,
      category: 'override',
      impact: 'batch',
      versionsAffected: [],
      canGroupWith: () => false, // Batch commands don't group
      preview: () => {
        const allChanges: PreviewChange[] = [];
        const affectedZones: string[] = [];
        let totalConfidenceChange = 0;

        commands.forEach(cmd => {
          const preview = cmd.preview();
          allChanges.push(...preview.changes);
          affectedZones.push(...preview.affectedZones);
          totalConfidenceChange += preview.estimatedImpact.confidenceChange;
        });

        return {
          affectedZones: [...new Set(affectedZones)],
          changes: allChanges,
          estimatedImpact: {
            confidenceChange: totalConfidenceChange / commands.length,
            processingTime: 100 * commands.length,
            reversible: true
          }
        };
      },
      execute: async () => {
        await batchCommand.execute();
        onApply(overrides.map(o => o.override));
      },
      undo: async () => {
        await batchCommand.undo();
        onRevert(overrides.map(o => o.override.id));
      }
    };

    return overrideCommand;
  }, [undoRedo, createToolOverrideCommand, createContentOverrideCommand]);

  // Execute override command with grouping
  const executeOverrideCommand = useCallback(async (command: OverrideCommand) => {
    if (groupRelatedChanges) {
      const now = Date.now();
      const timeSinceLastCommand = now - state.lastGroupTime;

      // Check if should group with existing commands
      if (state.activeGroup && timeSinceLastCommand < groupingWindow) {
        const groupCommands = state.groupedCommands.get(state.activeGroup) || [];
        
        // Check if can group with any existing command
        const canGroup = groupCommands.some(cmd => cmd.canGroupWith(command));
        
        if (canGroup) {
          // Add to existing group
          setState(prev => {
            const newGrouped = new Map(prev.groupedCommands);
            newGrouped.set(state.activeGroup!, [...groupCommands, command]);
            return {
              ...prev,
              groupedCommands: newGrouped,
              lastGroupTime: now
            };
          });

          // Reset grouping timeout
          if (groupingTimeoutRef.current) {
            clearTimeout(groupingTimeoutRef.current);
          }

          groupingTimeoutRef.current = setTimeout(() => {
            flushCommandGroup();
          }, groupingWindow);

          return;
        }
      }

      // Start new group
      const groupId = `group_${Date.now()}`;
      setState(prev => ({
        ...prev,
        activeGroup: groupId,
        groupedCommands: new Map([[groupId, [command]]]),
        lastGroupTime: now
      }));

      // Set timeout to flush group
      groupingTimeoutRef.current = setTimeout(() => {
        flushCommandGroup();
      }, groupingWindow);
    } else {
      // Execute immediately without grouping
      await executeAndRecord(command);
    }
  }, [groupRelatedChanges, groupingWindow, state.activeGroup, state.lastGroupTime, state.groupedCommands]);

  // Flush command group
  const flushCommandGroup = useCallback(async () => {
    if (!state.activeGroup) return;

    const groupCommands = state.groupedCommands.get(state.activeGroup);
    if (!groupCommands || groupCommands.length === 0) return;

    if (groupCommands.length === 1) {
      // Single command, execute directly
      await executeAndRecord(groupCommands[0]);
    } else {
      // Multiple commands, create batch
      const batchCommand = undoRedo.createBatchCommand(
        groupCommands,
        `Grouped overrides (${groupCommands.length} changes)`
      );

      const groupedOverrideCommand: OverrideCommand = {
        ...batchCommand,
        category: 'override',
        impact: 'batch',
        versionsAffected: [],
        canGroupWith: () => false,
        preview: () => {
          const previews = groupCommands.map(cmd => cmd.preview());
          const allChanges = previews.flatMap(p => p.changes);
          const allZones = [...new Set(previews.flatMap(p => p.affectedZones))];
          
          return {
            affectedZones: allZones,
            changes: allChanges,
            estimatedImpact: {
              confidenceChange: previews.reduce((sum, p) => sum + p.estimatedImpact.confidenceChange, 0) / previews.length,
              processingTime: previews.reduce((sum, p) => sum + p.estimatedImpact.processingTime, 0),
              reversible: true
            }
          };
        }
      };

      await executeAndRecord(groupedOverrideCommand);
    }

    // Clear group
    setState(prev => ({
      ...prev,
      activeGroup: null,
      groupedCommands: new Map(),
      lastGroupTime: 0
    }));
  }, [state.activeGroup, state.groupedCommands, undoRedo]);

  // Execute and record command
  const executeAndRecord = useCallback(async (command: OverrideCommand) => {
    // Execute command
    await undoRedo.executeCommand(command);

    // Add to override history
    setState(prev => ({
      ...prev,
      overrideHistory: [...prev.overrideHistory, command]
    }));

    // Create version if enabled
    if (enableVersioning) {
      // This would integrate with version manager
      console.log('Creating version for override:', command.id);
    }
  }, [undoRedo, enableVersioning]);

  // Granular revert for specific override
  const revertOverride = useCallback(async (
    overrideId: string,
    options: RevertOptions = {}
  ) => {
    const {
      preserveSubsequentChanges = true,
      createRestorePoint = true,
      notifyCollaborators = true
    } = options;

    // Find the override command
    const overrideCommand = state.overrideHistory.find(cmd => 
      cmd.id === overrideId || 
      (cmd.data?.override && cmd.data.override.id === overrideId)
    );

    if (!overrideCommand) {
      console.error('Override not found:', overrideId);
      return;
    }

    // Create restore point if requested
    if (createRestorePoint && enableVersioning) {
      // Would create a version before reverting
      console.log('Creating restore point before revert');
    }

    if (preserveSubsequentChanges) {
      // Complex revert that preserves later changes
      await selectiveUndo({
        targetOverrides: [overrideId],
        preserveOrder: true,
        skipConflicts: false
      });
    } else {
      // Simple revert - undo this and all subsequent changes
      const index = state.overrideHistory.indexOf(overrideCommand);
      const commandsToUndo = state.overrideHistory.slice(index).reverse();

      for (const cmd of commandsToUndo) {
        await cmd.undo();
      }
    }

    // Mark as reverted
    setState(prev => ({
      ...prev,
      revertedOverrides: new Set([...prev.revertedOverrides, overrideId])
    }));

    // Notify
    if (onRevert) {
      onRevert(overrideId);
    }

    if (notifyCollaborators) {
      // Would send notification to collaborators
      console.log('Notifying collaborators of revert:', overrideId);
    }
  }, [state.overrideHistory, enableVersioning, onRevert]);

  // Selective undo for specific changes
  const selectiveUndo = useCallback(async (options: SelectiveUndoOptions) => {
    const {
      targetOverrides,
      preserveOrder = true,
      skipConflicts = false
    } = options;

    // Find target commands
    const targetCommands = state.overrideHistory.filter(cmd =>
      targetOverrides.some(id => 
        cmd.id === id || 
        (cmd.data?.override && cmd.data.override.id === id)
      )
    );

    if (targetCommands.length === 0) return;

    // Check for conflicts
    const conflicts = detectConflicts(targetCommands, state.overrideHistory);
    
    if (conflicts.length > 0 && !skipConflicts) {
      console.error('Conflicts detected, cannot selective undo:', conflicts);
      return;
    }

    // Perform selective undo
    for (const cmd of targetCommands) {
      try {
        await cmd.undo();
        
        // Remove from history
        setState(prev => ({
          ...prev,
          overrideHistory: prev.overrideHistory.filter(c => c.id !== cmd.id)
        }));
      } catch (error) {
        console.error('Failed to undo command:', cmd.id, error);
      }
    }
  }, [state.overrideHistory]);

  // Preview override impact
  const previewOverride = useCallback((command: OverrideCommand): OverridePreview => {
    if (!enablePreview) {
      return {
        affectedZones: [],
        changes: [],
        estimatedImpact: {
          confidenceChange: 0,
          processingTime: 0,
          reversible: true
        }
      };
    }

    return command.preview();
  }, [enablePreview]);

  // Get override history with filters
  const getOverrideHistory = useCallback((filters?: {
    type?: ManualOverride['type'];
    zoneId?: string;
    userId?: string;
    startTime?: number;
    endTime?: number;
  }) => {
    let history = [...state.overrideHistory];

    if (filters) {
      if (filters.type) {
        history = history.filter(cmd => 
          cmd.data?.override?.type === filters.type
        );
      }

      if (filters.zoneId) {
        history = history.filter(cmd => 
          cmd.data?.zoneId === filters.zoneId ||
          cmd.data?.override?.zoneId === filters.zoneId
        );
      }

      if (filters.userId) {
        history = history.filter(cmd => 
          cmd.data?.override?.userId === filters.userId
        );
      }

      if (filters.startTime) {
        history = history.filter(cmd => 
          cmd.timestamp >= filters.startTime
        );
      }

      if (filters.endTime) {
        history = history.filter(cmd => 
          cmd.timestamp <= filters.endTime
        );
      }
    }

    return history;
  }, [state.overrideHistory]);

  // Get conflict analysis
  const getConflictAnalysis = useCallback((overrideId: string) => {
    const command = state.overrideHistory.find(cmd => 
      cmd.id === overrideId || 
      (cmd.data?.override && cmd.data.override.id === overrideId)
    );

    if (!command) return null;

    const conflicts = detectConflicts([command], state.overrideHistory);
    const dependencies = findDependencies(command, state.overrideHistory);

    return {
      hasConflicts: conflicts.length > 0,
      conflicts,
      dependencies,
      canRevert: conflicts.length === 0 || dependencies.length === 0
    };
  }, [state.overrideHistory]);

  // Helper functions
  const detectConflicts = (
    targetCommands: OverrideCommand[],
    allCommands: OverrideCommand[]
  ): Array<{ command1: OverrideCommand; command2: OverrideCommand; reason: string }> => {
    const conflicts: Array<{ command1: OverrideCommand; command2: OverrideCommand; reason: string }> = [];

    for (const target of targetCommands) {
      const targetZones = target.preview().affectedZones;
      
      // Find later commands that affect same zones
      const laterCommands = allCommands.filter(cmd => 
        cmd.timestamp > target.timestamp &&
        cmd.preview().affectedZones.some(zone => targetZones.includes(zone))
      );

      for (const later of laterCommands) {
        conflicts.push({
          command1: target,
          command2: later,
          reason: 'Later command depends on this change'
        });
      }
    }

    return conflicts;
  };

  const findDependencies = (
    command: OverrideCommand,
    allCommands: OverrideCommand[]
  ): OverrideCommand[] => {
    const affectedZones = command.preview().affectedZones;
    
    return allCommands.filter(cmd => 
      cmd.timestamp > command.timestamp &&
      cmd.preview().affectedZones.some(zone => affectedZones.includes(zone))
    );
  };

  // Cleanup
  useEffect(() => {
    return () => {
      if (groupingTimeoutRef.current) {
        clearTimeout(groupingTimeoutRef.current);
      }
    };
  }, []);

  return {
    // Command creation
    createToolOverrideCommand,
    createContentOverrideCommand,
    createBatchOverrideCommand,
    
    // Command execution
    executeOverrideCommand,
    
    // Revert operations
    revertOverride,
    selectiveUndo,
    
    // Preview
    previewOverride,
    
    // History queries
    getOverrideHistory,
    getConflictAnalysis,
    
    // State
    overrideCount: state.overrideHistory.length,
    revertedCount: state.revertedOverrides.size,
    hasActiveGroup: state.activeGroup !== null,
    
    // Undo/redo from base hook
    undo: undoRedo.undo,
    redo: undoRedo.redo,
    canUndo: undoRedo.canUndo,
    canRedo: undoRedo.canRedo
  };
}

export default useOverrideHistory;