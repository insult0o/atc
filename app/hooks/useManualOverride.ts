'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Zone } from '../components/zones/ZoneManager';
import { ToolAssignmentResult } from '../../lib/pdf-processing/tool-assignment';

// Core interfaces for manual overrides
export interface ManualOverride {
  id: string;
  zoneId: string;
  timestamp: number;
  userId: string;
  type: 'tool_change' | 'content_edit' | 'zone_adjustment';
  previousValue: any;
  newValue: any;
  confidence: 1.0; // Always 100% for manual overrides
  reason?: string;
  metadata: {
    tool?: string;
    processingTime?: number;
    userNotes?: string;
    source?: string;
    editDetails?: EditDetails;
  };
}

export interface EditDetails {
  charactersAdded: number;
  charactersRemoved: number;
  linesAffected: number;
  formattingChanges?: FormattingChange[];
}

export interface FormattingChange {
  type: 'bold' | 'italic' | 'underline' | 'font' | 'size' | 'color';
  from: any;
  to: any;
}

export interface OverrideTracking {
  totalOverrides: number;
  overridesByType: Record<string, number>;
  overridesByUser: Record<string, number>;
  averageConfidenceBoost: number;
  lastOverrideTime: number;
}

export interface UseManualOverrideOptions {
  enableTracking?: boolean;
  enableAutoSave?: boolean;
  autoSaveDelay?: number;
  onOverrideApplied?: (override: ManualOverride) => void;
  onConfidenceUpdate?: (zoneId: string, newConfidence: number) => void;
}

interface ManualOverrideState {
  overrides: Map<string, ManualOverride[]>; // zoneId -> overrides
  tracking: OverrideTracking;
  pendingOverrides: ManualOverride[];
  isProcessing: boolean;
}

export function useManualOverride(options: UseManualOverrideOptions = {}) {
  const {
    enableTracking = true,
    enableAutoSave = true,
    autoSaveDelay = 1000,
    onOverrideApplied,
    onConfidenceUpdate
  } = options;

  const [state, setState] = useState<ManualOverrideState>({
    overrides: new Map(),
    tracking: {
      totalOverrides: 0,
      overridesByType: {},
      overridesByUser: {},
      averageConfidenceBoost: 0,
      lastOverrideTime: 0
    },
    pendingOverrides: [],
    isProcessing: false
  });

  const autoSaveTimeoutRef = useRef<NodeJS.Timeout>();

  // Create a manual override for tool change
  const createToolChangeOverride = useCallback((
    zone: Zone,
    newTool: string,
    previousTool?: string,
    reason?: string,
    notes?: string
  ): ManualOverride => {
    const override: ManualOverride = {
      id: `override_tool_${zone.id}_${Date.now()}`,
      zoneId: zone.id,
      timestamp: Date.now(),
      userId: getCurrentUserId(),
      type: 'tool_change',
      previousValue: previousTool || zone.assignedTool,
      newValue: newTool,
      confidence: 1.0,
      reason,
      metadata: {
        tool: newTool,
        userNotes: notes,
        source: 'manual_selection'
      }
    };

    return override;
  }, []);

  // Create a manual override for content edit
  const createContentEditOverride = useCallback((
    zone: Zone,
    newContent: string,
    previousContent: string,
    reason?: string,
    notes?: string
  ): ManualOverride => {
    const editDetails = calculateEditDetails(previousContent, newContent);

    const override: ManualOverride = {
      id: `override_content_${zone.id}_${Date.now()}`,
      zoneId: zone.id,
      timestamp: Date.now(),
      userId: getCurrentUserId(),
      type: 'content_edit',
      previousValue: previousContent,
      newValue: newContent,
      confidence: 1.0,
      reason,
      metadata: {
        userNotes: notes,
        source: 'manual_edit',
        editDetails,
        processingTime: 0 // Manual edits have no processing time
      }
    };

    return override;
  }, []);

  // Create a manual override for zone adjustment
  const createZoneAdjustmentOverride = useCallback((
    zone: Zone,
    adjustmentType: string,
    previousValue: any,
    newValue: any,
    reason?: string,
    notes?: string
  ): ManualOverride => {
    const override: ManualOverride = {
      id: `override_adjust_${zone.id}_${Date.now()}`,
      zoneId: zone.id,
      timestamp: Date.now(),
      userId: getCurrentUserId(),
      type: 'zone_adjustment',
      previousValue,
      newValue,
      confidence: 1.0,
      reason,
      metadata: {
        userNotes: notes,
        source: 'manual_adjustment',
        processingTime: 0
      }
    };

    return override;
  }, []);

  // Apply an override
  const applyOverride = useCallback(async (override: ManualOverride) => {
    setState(prev => ({ ...prev, isProcessing: true }));

    try {
      // Add to overrides map
      setState(prev => {
        const newOverrides = new Map(prev.overrides);
        const zoneOverrides = newOverrides.get(override.zoneId) || [];
        newOverrides.set(override.zoneId, [...zoneOverrides, override]);

        // Update tracking
        const newTracking = updateTracking(prev.tracking, override);

        return {
          ...prev,
          overrides: newOverrides,
          tracking: newTracking,
          pendingOverrides: enableAutoSave 
            ? [...prev.pendingOverrides, override]
            : prev.pendingOverrides
        };
      });

      // Notify confidence update (always 100% for manual overrides)
      if (onConfidenceUpdate) {
        onConfidenceUpdate(override.zoneId, 1.0);
      }

      // Notify override applied
      if (onOverrideApplied) {
        onOverrideApplied(override);
      }

      // Schedule auto-save if enabled
      if (enableAutoSave) {
        scheduleAutoSave();
      }

      return override;
    } catch (error) {
      console.error('Failed to apply override:', error);
      throw error;
    } finally {
      setState(prev => ({ ...prev, isProcessing: false }));
    }
  }, [enableAutoSave, onConfidenceUpdate, onOverrideApplied]);

  // Batch apply overrides
  const batchApplyOverrides = useCallback(async (overrides: ManualOverride[]) => {
    setState(prev => ({ ...prev, isProcessing: true }));

    try {
      const appliedOverrides: ManualOverride[] = [];

      for (const override of overrides) {
        const applied = await applyOverride(override);
        appliedOverrides.push(applied);
      }

      return appliedOverrides;
    } finally {
      setState(prev => ({ ...prev, isProcessing: false }));
    }
  }, [applyOverride]);

  // Get overrides for a specific zone
  const getZoneOverrides = useCallback((zoneId: string): ManualOverride[] => {
    return state.overrides.get(zoneId) || [];
  }, [state.overrides]);

  // Get all overrides
  const getAllOverrides = useCallback((): ManualOverride[] => {
    const allOverrides: ManualOverride[] = [];
    state.overrides.forEach(overrides => {
      allOverrides.push(...overrides);
    });
    return allOverrides.sort((a, b) => b.timestamp - a.timestamp);
  }, [state.overrides]);

  // Get override statistics
  const getOverrideStats = useCallback(() => {
    const stats = {
      totalOverrides: state.tracking.totalOverrides,
      byType: { ...state.tracking.overridesByType },
      byUser: { ...state.tracking.overridesByUser },
      recentOverrides: getAllOverrides().slice(0, 10),
      mostOverriddenZones: getMostOverriddenZones(),
      averageConfidenceBoost: state.tracking.averageConfidenceBoost
    };

    return stats;
  }, [state.tracking, getAllOverrides]);

  // Get most overridden zones
  const getMostOverriddenZones = useCallback((): Array<{ zoneId: string; count: number }> => {
    const zoneCounts = new Map<string, number>();
    
    state.overrides.forEach((overrides, zoneId) => {
      zoneCounts.set(zoneId, overrides.length);
    });

    return Array.from(zoneCounts.entries())
      .map(([zoneId, count]) => ({ zoneId, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [state.overrides]);

  // Check if zone has overrides
  const hasOverrides = useCallback((zoneId: string): boolean => {
    const overrides = state.overrides.get(zoneId);
    return overrides ? overrides.length > 0 : false;
  }, [state.overrides]);

  // Get latest override for zone
  const getLatestOverride = useCallback((zoneId: string): ManualOverride | null => {
    const overrides = state.overrides.get(zoneId);
    if (!overrides || overrides.length === 0) return null;
    
    return overrides.reduce((latest, current) => 
      current.timestamp > latest.timestamp ? current : latest
    );
  }, [state.overrides]);

  // Clear overrides for a zone
  const clearZoneOverrides = useCallback((zoneId: string) => {
    setState(prev => {
      const newOverrides = new Map(prev.overrides);
      newOverrides.delete(zoneId);
      
      return {
        ...prev,
        overrides: newOverrides
      };
    });
  }, []);

  // Export override history
  const exportOverrideHistory = useCallback(() => {
    const allOverrides = getAllOverrides();
    const exportData = {
      timestamp: new Date().toISOString(),
      totalOverrides: allOverrides.length,
      tracking: state.tracking,
      overrides: allOverrides.map(override => ({
        ...override,
        userInfo: getUserInfo(override.userId)
      }))
    };

    return exportData;
  }, [getAllOverrides, state.tracking]);

  // Schedule auto-save
  const scheduleAutoSave = useCallback(() => {
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }

    autoSaveTimeoutRef.current = setTimeout(() => {
      savePendingOverrides();
    }, autoSaveDelay);
  }, [autoSaveDelay]);

  // Save pending overrides
  const savePendingOverrides = useCallback(async () => {
    if (state.pendingOverrides.length === 0) return;

    try {
      // In a real app, this would save to backend
      console.log('Saving pending overrides:', state.pendingOverrides);
      
      setState(prev => ({
        ...prev,
        pendingOverrides: []
      }));
    } catch (error) {
      console.error('Failed to save overrides:', error);
    }
  }, [state.pendingOverrides]);

  // Update tracking information
  const updateTracking = (
    tracking: OverrideTracking,
    override: ManualOverride
  ): OverrideTracking => {
    const newTracking = { ...tracking };
    
    // Update total count
    newTracking.totalOverrides++;
    
    // Update by type
    newTracking.overridesByType[override.type] = 
      (newTracking.overridesByType[override.type] || 0) + 1;
    
    // Update by user
    newTracking.overridesByUser[override.userId] = 
      (newTracking.overridesByUser[override.userId] || 0) + 1;
    
    // Update last override time
    newTracking.lastOverrideTime = override.timestamp;
    
    // Update average confidence boost (simplified - assumes previous confidence was 0.8)
    const previousAvgBoost = newTracking.averageConfidenceBoost;
    const totalBoosts = (previousAvgBoost * (newTracking.totalOverrides - 1)) + 0.2;
    newTracking.averageConfidenceBoost = totalBoosts / newTracking.totalOverrides;
    
    return newTracking;
  };

  // Calculate edit details
  const calculateEditDetails = (
    previousContent: string,
    newContent: string
  ): EditDetails => {
    const prevLines = previousContent.split('\n');
    const newLines = newContent.split('\n');
    
    return {
      charactersAdded: Math.max(0, newContent.length - previousContent.length),
      charactersRemoved: Math.max(0, previousContent.length - newContent.length),
      linesAffected: Math.abs(newLines.length - prevLines.length),
      formattingChanges: [] // Would need more sophisticated diff algorithm
    };
  };

  // Helper functions
  const getCurrentUserId = (): string => {
    // In a real app, this would get the actual user ID
    return 'user_' + Math.random().toString(36).substr(2, 9);
  };

  const getUserInfo = (userId: string) => {
    // In a real app, this would fetch user info
    return {
      id: userId,
      name: 'User',
      email: 'user@example.com'
    };
  };

  // Cleanup
  useEffect(() => {
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, []);

  return {
    // Override creation
    createToolChangeOverride,
    createContentEditOverride,
    createZoneAdjustmentOverride,
    
    // Override application
    applyOverride,
    batchApplyOverrides,
    
    // Override queries
    getZoneOverrides,
    getAllOverrides,
    getOverrideStats,
    hasOverrides,
    getLatestOverride,
    
    // Override management
    clearZoneOverrides,
    exportOverrideHistory,
    
    // State
    isProcessing: state.isProcessing,
    tracking: state.tracking,
    totalOverrides: state.tracking.totalOverrides
  };
}

export default useManualOverride;