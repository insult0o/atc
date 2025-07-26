'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Zone } from '../components/zones/ZoneManager';

// Command interface for undo/redo operations
export interface Command {
  id: string;
  type: CommandType;
  description: string;
  timestamp: number;
  execute: () => void | Promise<void>;
  undo: () => void | Promise<void>;
  data?: any;
}

export type CommandType = 
  | 'zone_create'
  | 'zone_update'
  | 'zone_delete'
  | 'zone_move'
  | 'zone_resize'
  | 'zone_type_change'
  | 'zones_merge'
  | 'zone_split'
  | 'content_edit'
  | 'batch';

export interface BatchCommand extends Command {
  type: 'batch';
  commands: Command[];
}

export interface UseUndoRedoOptions {
  maxHistorySize?: number;
  batchDelay?: number;
  onHistoryChange?: (canUndo: boolean, canRedo: boolean) => void;
  enableKeyboardShortcuts?: boolean;
}

interface UndoRedoState {
  undoStack: Command[];
  redoStack: Command[];
  isExecuting: boolean;
  batchingCommands: Command[];
  lastCommandTime: number;
}

const DEFAULT_MAX_HISTORY = 50;
const DEFAULT_BATCH_DELAY = 300; // ms

export function useUndoRedo(options: UseUndoRedoOptions = {}) {
  const {
    maxHistorySize = DEFAULT_MAX_HISTORY,
    batchDelay = DEFAULT_BATCH_DELAY,
    onHistoryChange,
    enableKeyboardShortcuts = true
  } = options;

  const [state, setState] = useState<UndoRedoState>({
    undoStack: [],
    redoStack: [],
    isExecuting: false,
    batchingCommands: [],
    lastCommandTime: 0
  });

  const batchTimeoutRef = useRef<NodeJS.Timeout>();

  // Create zone creation command
  const createZoneCommand = useCallback((
    zone: Zone,
    onCreate: (zone: Zone) => void,
    onDelete: (zoneId: string) => void
  ): Command => {
    return {
      id: `create_${zone.id}_${Date.now()}`,
      type: 'zone_create',
      description: `Create ${zone.contentType} zone`,
      timestamp: Date.now(),
      data: { zone },
      execute: () => onCreate(zone),
      undo: () => onDelete(zone.id)
    };
  }, []);

  // Create zone update command
  const createUpdateCommand = useCallback((
    zoneId: string,
    oldValues: Partial<Zone>,
    newValues: Partial<Zone>,
    onUpdate: (zoneId: string, values: Partial<Zone>) => void
  ): Command => {
    return {
      id: `update_${zoneId}_${Date.now()}`,
      type: 'zone_update',
      description: `Update zone ${zoneId}`,
      timestamp: Date.now(),
      data: { zoneId, oldValues, newValues },
      execute: () => onUpdate(zoneId, newValues),
      undo: () => onUpdate(zoneId, oldValues)
    };
  }, []);

  // Create zone delete command
  const createDeleteCommand = useCallback((
    zone: Zone,
    onCreate: (zone: Zone) => void,
    onDelete: (zoneId: string) => void
  ): Command => {
    return {
      id: `delete_${zone.id}_${Date.now()}`,
      type: 'zone_delete',
      description: `Delete ${zone.contentType} zone`,
      timestamp: Date.now(),
      data: { zone },
      execute: () => onDelete(zone.id),
      undo: () => onCreate(zone)
    };
  }, []);

  // Create zone move command
  const createMoveCommand = useCallback((
    zoneId: string,
    oldPosition: { x: number; y: number },
    newPosition: { x: number; y: number },
    onMove: (zoneId: string, position: { x: number; y: number }) => void
  ): Command => {
    return {
      id: `move_${zoneId}_${Date.now()}`,
      type: 'zone_move',
      description: `Move zone ${zoneId}`,
      timestamp: Date.now(),
      data: { zoneId, oldPosition, newPosition },
      execute: () => onMove(zoneId, newPosition),
      undo: () => onMove(zoneId, oldPosition)
    };
  }, []);

  // Create zone resize command
  const createResizeCommand = useCallback((
    zoneId: string,
    oldBounds: { x: number; y: number; width: number; height: number },
    newBounds: { x: number; y: number; width: number; height: number },
    onResize: (zoneId: string, bounds: { x: number; y: number; width: number; height: number }) => void
  ): Command => {
    return {
      id: `resize_${zoneId}_${Date.now()}`,
      type: 'zone_resize',
      description: `Resize zone ${zoneId}`,
      timestamp: Date.now(),
      data: { zoneId, oldBounds, newBounds },
      execute: () => onResize(zoneId, newBounds),
      undo: () => onResize(zoneId, oldBounds)
    };
  }, []);

  // Create zones merge command
  const createMergeCommand = useCallback((
    originalZones: Zone[],
    mergedZone: Zone,
    onMerge: (zones: Zone[], merged: Zone) => void,
    onSplit: (merged: Zone, original: Zone[]) => void
  ): Command => {
    return {
      id: `merge_${mergedZone.id}_${Date.now()}`,
      type: 'zones_merge',
      description: `Merge ${originalZones.length} zones`,
      timestamp: Date.now(),
      data: { originalZones, mergedZone },
      execute: () => onMerge(originalZones, mergedZone),
      undo: () => onSplit(mergedZone, originalZones)
    };
  }, []);

  // Create content edit command
  const createContentEditCommand = useCallback((
    zoneId: string,
    oldContent: string,
    newContent: string,
    onEdit: (zoneId: string, content: string) => void
  ): Command => {
    return {
      id: `edit_${zoneId}_${Date.now()}`,
      type: 'content_edit',
      description: `Edit content of zone ${zoneId}`,
      timestamp: Date.now(),
      data: { zoneId, oldContent, newContent },
      execute: () => onEdit(zoneId, newContent),
      undo: () => onEdit(zoneId, oldContent)
    };
  }, []);

  // Create batch command
  const createBatchCommand = useCallback((
    commands: Command[],
    description?: string
  ): BatchCommand => {
    return {
      id: `batch_${Date.now()}`,
      type: 'batch',
      description: description || `Batch operation (${commands.length} commands)`,
      timestamp: Date.now(),
      commands,
      execute: async () => {
        for (const command of commands) {
          await command.execute();
        }
      },
      undo: async () => {
        // Undo in reverse order
        for (let i = commands.length - 1; i >= 0; i--) {
          await commands[i].undo();
        }
      }
    };
  }, []);

  // Execute command and add to history
  const executeCommand = useCallback(async (command: Command, addToHistory = true) => {
    if (state.isExecuting) return;

    setState(prev => ({ ...prev, isExecuting: true }));

    try {
      await command.execute();

      if (addToHistory) {
        setState(prev => {
          const newUndoStack = [...prev.undoStack, command];
          
          // Limit history size
          if (newUndoStack.length > maxHistorySize) {
            newUndoStack.shift();
          }

          const newState = {
            ...prev,
            undoStack: newUndoStack,
            redoStack: [], // Clear redo stack on new command
            lastCommandTime: Date.now()
          };

          // Notify about history change
          onHistoryChange?.(newUndoStack.length > 0, false);

          return newState;
        });
      }
    } catch (error) {
      console.error('Failed to execute command:', error);
    } finally {
      setState(prev => ({ ...prev, isExecuting: false }));
    }
  }, [state.isExecuting, maxHistorySize, onHistoryChange]);

  // Add command to batch
  const addToBatch = useCallback((command: Command) => {
    const now = Date.now();
    const shouldBatch = now - state.lastCommandTime < batchDelay;

    if (shouldBatch) {
      // Add to current batch
      setState(prev => ({
        ...prev,
        batchingCommands: [...prev.batchingCommands, command],
        lastCommandTime: now
      }));

      // Reset batch timeout
      if (batchTimeoutRef.current) {
        clearTimeout(batchTimeoutRef.current);
      }

      batchTimeoutRef.current = setTimeout(() => {
        // Execute batched commands
        setState(prev => {
          if (prev.batchingCommands.length > 0) {
            const batchCommand = createBatchCommand(prev.batchingCommands);
            executeCommand(batchCommand);
          }
          return {
            ...prev,
            batchingCommands: []
          };
        });
      }, batchDelay);
    } else {
      // Execute immediately
      executeCommand(command);
    }
  }, [state.lastCommandTime, batchDelay, createBatchCommand, executeCommand]);

  // Undo last command
  const undo = useCallback(async () => {
    if (state.undoStack.length === 0 || state.isExecuting) return;

    setState(prev => ({ ...prev, isExecuting: true }));

    try {
      const command = state.undoStack[state.undoStack.length - 1];
      await command.undo();

      setState(prev => {
        const newUndoStack = prev.undoStack.slice(0, -1);
        const newRedoStack = [...prev.redoStack, command];

        // Notify about history change
        onHistoryChange?.(newUndoStack.length > 0, newRedoStack.length > 0);

        return {
          ...prev,
          undoStack: newUndoStack,
          redoStack: newRedoStack
        };
      });
    } catch (error) {
      console.error('Failed to undo command:', error);
    } finally {
      setState(prev => ({ ...prev, isExecuting: false }));
    }
  }, [state.undoStack, state.isExecuting, onHistoryChange]);

  // Redo last undone command
  const redo = useCallback(async () => {
    if (state.redoStack.length === 0 || state.isExecuting) return;

    setState(prev => ({ ...prev, isExecuting: true }));

    try {
      const command = state.redoStack[state.redoStack.length - 1];
      await command.execute();

      setState(prev => {
        const newRedoStack = prev.redoStack.slice(0, -1);
        const newUndoStack = [...prev.undoStack, command];

        // Notify about history change
        onHistoryChange?.(newUndoStack.length > 0, newRedoStack.length > 0);

        return {
          ...prev,
          undoStack: newUndoStack,
          redoStack: newRedoStack
        };
      });
    } catch (error) {
      console.error('Failed to redo command:', error);
    } finally {
      setState(prev => ({ ...prev, isExecuting: false }));
    }
  }, [state.redoStack, state.isExecuting, onHistoryChange]);

  // Clear history
  const clearHistory = useCallback(() => {
    setState({
      undoStack: [],
      redoStack: [],
      isExecuting: false,
      batchingCommands: [],
      lastCommandTime: 0
    });
    onHistoryChange?.(false, false);
  }, [onHistoryChange]);

  // Get history info
  const getHistory = useCallback(() => {
    return {
      undoStack: state.undoStack.map(cmd => ({
        id: cmd.id,
        type: cmd.type,
        description: cmd.description,
        timestamp: cmd.timestamp
      })),
      redoStack: state.redoStack.map(cmd => ({
        id: cmd.id,
        type: cmd.type,
        description: cmd.description,
        timestamp: cmd.timestamp
      })),
      canUndo: state.undoStack.length > 0 && !state.isExecuting,
      canRedo: state.redoStack.length > 0 && !state.isExecuting
    };
  }, [state]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!enableKeyboardShortcuts) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const isCtrlOrCmd = event.ctrlKey || event.metaKey;

      if (isCtrlOrCmd && event.key === 'z' && !event.shiftKey) {
        event.preventDefault();
        undo();
      } else if (isCtrlOrCmd && (event.key === 'y' || (event.key === 'z' && event.shiftKey))) {
        event.preventDefault();
        redo();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [undo, redo, enableKeyboardShortcuts]);

  // Cleanup batch timeout
  useEffect(() => {
    return () => {
      if (batchTimeoutRef.current) {
        clearTimeout(batchTimeoutRef.current);
      }
    };
  }, []);

  return {
    // Command creators
    createZoneCommand,
    createUpdateCommand,
    createDeleteCommand,
    createMoveCommand,
    createResizeCommand,
    createMergeCommand,
    createContentEditCommand,
    createBatchCommand,

    // Command execution
    executeCommand,
    addToBatch,

    // History operations
    undo,
    redo,
    clearHistory,
    getHistory,

    // State
    canUndo: state.undoStack.length > 0 && !state.isExecuting,
    canRedo: state.redoStack.length > 0 && !state.isExecuting,
    isExecuting: state.isExecuting,
    historySize: state.undoStack.length
  };
}

export default useUndoRedo;