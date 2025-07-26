'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useWebSocket } from './useWebSocket';
import { Zone } from '../components/zones/ZoneManager';
import { DetectedZone, ContentAnalysisResult } from '../../lib/pdf-processing/content-analyzer';
import { ToolAssignmentResult } from '../../lib/pdf-processing/tool-assignment';
import { ZonePersistenceManager } from '../../lib/storage/zone-persistence';

// Core interfaces for zone management
export interface UseZonesOptions {
  documentId: string;
  enableRealtime?: boolean;
  enablePersistence?: boolean;
  enableCollaboration?: boolean;
  autoSave?: boolean;
  autoSaveDelay?: number;
}

export interface ZoneState {
  zones: Zone[];
  selectedZone: string | null;
  loading: boolean;
  error: string | null;
  lastModified: Date | null;
  hasUnsavedChanges: boolean;
  collaborators: Collaborator[];
  analysisResults?: ContentAnalysisResult;
  toolAssignments?: ToolAssignmentResult[];
}

export interface Collaborator {
  id: string;
  name: string;
  avatar?: string;
  isActive: boolean;
  lastSeen: Date;
  currentZone?: string;
  cursor?: CursorPosition;
}

export interface CursorPosition {
  x: number;
  y: number;
  timestamp: Date;
}

export interface ZoneUpdate {
  zoneId: string;
  updates: Partial<Zone>;
  author: string;
  timestamp: Date;
  source: 'local' | 'remote' | 'system';
}

export interface ZoneEvent {
  type: ZoneEventType;
  payload: any;
  author: string;
  timestamp: Date;
}

export type ZoneEventType = 
  | 'zone_created'
  | 'zone_updated' 
  | 'zone_deleted'
  | 'zone_selected'
  | 'tool_assigned'
  | 'zones_merged'
  | 'zone_split'
  | 'analysis_completed'
  | 'collaborator_joined'
  | 'collaborator_left'
  | 'cursor_moved';

// Real-time zone management hook
export function useZones(options: UseZonesOptions) {
  const {
    documentId,
    enableRealtime = true,
    enablePersistence = true,
    enableCollaboration = true,
    autoSave = true,
    autoSaveDelay = 2000
  } = options;

  // State management
  const [state, setState] = useState<ZoneState>({
    zones: [],
    selectedZone: null,
    loading: true,
    error: null,
    lastModified: null,
    hasUnsavedChanges: false,
    collaborators: []
  });

  // Refs for managing auto-save and debouncing
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout>();
  const persistenceRef = useRef<ZonePersistenceManager | null>(null);
  const lastSaveRef = useRef<Date>(new Date());

  // WebSocket for real-time updates  
  const { isConnected, sendMessage } = useWebSocket(
    enableRealtime ? `/api/ws/zones/${documentId}` : '',
    {
      onMessage: (message) => {
        if (enableRealtime) {
          handleRealtimeMessage(message.data);
        }
      },
      onOpen: () => {
        console.log('Zone WebSocket connected');
        // Subscribe to zone events
        sendMessage({
          type: 'subscribe_zones',
          data: { documentId }
        });
        
        if (enableCollaboration) {
          sendMessage({
            type: 'join_collaboration',
            data: { documentId, user: getCurrentUser() }
          });
        }
      },
      onClose: () => {
        console.log('Zone WebSocket disconnected');
      },
      onError: (error) => {
        setState(prev => ({ ...prev, error: `WebSocket error: ${error}` }));
      }
    }
  );

  // Initialize persistence if enabled
  useEffect(() => {
    if (enablePersistence) {
      // In a real app, this would be injected or imported
      // persistenceRef.current = createZonePersistence(storageAdapter);
    }
  }, [enablePersistence]);

  // Load initial zones
  useEffect(() => {
    loadZones();
  }, [documentId]);

  // Handle real-time messages - now handled in onMessage callback

  // Auto-save functionality
  useEffect(() => {
    if (!autoSave || !state.hasUnsavedChanges) return;

    // Clear existing timeout
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }

    // Set new timeout
    autoSaveTimeoutRef.current = setTimeout(() => {
      saveZones();
    }, autoSaveDelay);

    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [state.hasUnsavedChanges, autoSave, autoSaveDelay]);

  // Load zones from persistence or API
  const loadZones = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      let zones: Zone[];

      if (enablePersistence && persistenceRef.current) {
        zones = await persistenceRef.current.loadZones(documentId);
      } else {
        // Fallback to API
        const response = await fetch(`/api/documents/${documentId}/zones`);
        if (!response.ok) {
          throw new Error(`Failed to load zones: ${response.statusText}`);
        }
        zones = await response.json();
      }

      setState(prev => ({
        ...prev,
        zones,
        loading: false,
        lastModified: new Date(),
        hasUnsavedChanges: false
      }));

      console.log(`Loaded ${zones.length} zones for document ${documentId}`);
    } catch (error) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to load zones'
      }));
    }
  }, [documentId, enablePersistence]);

  // Save zones to persistence or API
  const saveZones = useCallback(async () => {
    if (!state.hasUnsavedChanges) return;

    try {
      if (enablePersistence && persistenceRef.current) {
        await persistenceRef.current.saveZones(documentId, state.zones);
      } else {
        // Fallback to API
        const response = await fetch(`/api/documents/${documentId}/zones`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(state.zones)
        });

        if (!response.ok) {
          throw new Error(`Failed to save zones: ${response.statusText}`);
        }
      }

      setState(prev => ({
        ...prev,
        hasUnsavedChanges: false,
        lastModified: new Date()
      }));

      lastSaveRef.current = new Date();
      console.log(`Saved ${state.zones.length} zones for document ${documentId}`);
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to save zones'
      }));
    }
  }, [documentId, state.zones, state.hasUnsavedChanges, enablePersistence]);

  // Handle real-time messages
  const handleRealtimeMessage = useCallback((message: any) => {
    if (!message || typeof message !== 'object') return;
    
    const event = typeof message === 'string' ? JSON.parse(message) : message;

    switch (event.type) {
      case 'zone_created':
        handleZoneCreated(event.data);
        break;

      case 'zone_updated':
        handleZoneUpdated(event.data);
        break;

      case 'zone_deleted':
        handleZoneDeleted(event.data);
        break;

      case 'zone_selected':
        handleZoneSelected(event.data);
        break;

      case 'tool_assigned':
        handleToolAssigned(event.data);
        break;

      case 'zones_merged':
        handleZonesMerged(event.data);
        break;

      case 'zone_split':
        handleZoneSplit(event.data);
        break;

      case 'analysis_completed':
        handleAnalysisCompleted(event.data);
        break;

      case 'collaborator_joined':
        handleCollaboratorJoined(event.data);
        break;

      case 'collaborator_left':
        handleCollaboratorLeft(event.data);
        break;

      case 'cursor_moved':
        handleCursorMoved(event.data);
        break;

      default:
        console.warn(`Unknown zone event type: ${event.type}`);
    }
  }, []);

  // Zone event handlers
  const handleZoneCreated = useCallback((payload: { zone: Zone; author: string }) => {
    const { zone, author } = payload;
    
    if (author === getCurrentUser().id) return; // Ignore own changes

    setState(prev => ({
      ...prev,
      zones: [...prev.zones, zone],
      lastModified: new Date()
    }));

    console.log(`Zone created by ${author}:`, zone.id);
  }, []);

  const handleZoneUpdated = useCallback((payload: ZoneUpdate) => {
    const { zoneId, updates, author } = payload;
    
    if (author === getCurrentUser().id) return; // Ignore own changes

    setState(prev => ({
      ...prev,
      zones: prev.zones.map(zone =>
        zone.id === zoneId
          ? { ...zone, ...updates, lastModified: new Date() }
          : zone
      ),
      lastModified: new Date()
    }));

    console.log(`Zone ${zoneId} updated by ${author}`);
  }, []);

  const handleZoneDeleted = useCallback((payload: { zoneId: string; author: string }) => {
    const { zoneId, author } = payload;
    
    if (author === getCurrentUser().id) return; // Ignore own changes

    setState(prev => ({
      ...prev,
      zones: prev.zones.filter(zone => zone.id !== zoneId),
      selectedZone: prev.selectedZone === zoneId ? null : prev.selectedZone,
      lastModified: new Date()
    }));

    console.log(`Zone ${zoneId} deleted by ${author}`);
  }, []);

  const handleZoneSelected = useCallback((payload: { zoneId: string | null; author: string }) => {
    if (!enableCollaboration) return;
    
    const { zoneId, author } = payload;
    
    setState(prev => ({
      ...prev,
      collaborators: prev.collaborators.map(collab =>
        collab.id === author
          ? { ...collab, currentZone: zoneId || undefined, lastSeen: new Date() }
          : collab
      )
    }));
  }, [enableCollaboration]);

  const handleToolAssigned = useCallback((payload: { zoneId: string; toolName: string; author: string }) => {
    const { zoneId, toolName, author } = payload;
    
    if (author === getCurrentUser().id) return; // Ignore own changes

    setState(prev => ({
      ...prev,
      zones: prev.zones.map(zone =>
        zone.id === zoneId
          ? { ...zone, assignedTool: toolName, lastModified: new Date() }
          : zone
      ),
      lastModified: new Date()
    }));

    console.log(`Tool ${toolName} assigned to zone ${zoneId} by ${author}`);
  }, []);

  const handleZonesMerged = useCallback((payload: { zoneIds: string[]; newZone: Zone; author: string }) => {
    const { zoneIds, newZone, author } = payload;
    
    if (author === getCurrentUser().id) return; // Ignore own changes

    setState(prev => ({
      ...prev,
      zones: [
        ...prev.zones.filter(zone => !zoneIds.includes(zone.id)),
        newZone
      ],
      lastModified: new Date()
    }));

    console.log(`Zones merged by ${author}:`, zoneIds);
  }, []);

  const handleZoneSplit = useCallback((payload: { originalZoneId: string; newZones: Zone[]; author: string }) => {
    const { originalZoneId, newZones, author } = payload;
    
    if (author === getCurrentUser().id) return; // Ignore own changes

    setState(prev => ({
      ...prev,
      zones: [
        ...prev.zones.filter(zone => zone.id !== originalZoneId),
        ...newZones
      ],
      lastModified: new Date()
    }));

    console.log(`Zone ${originalZoneId} split by ${author}`);
  }, []);

  const handleAnalysisCompleted = useCallback((payload: ContentAnalysisResult) => {
    setState(prev => ({
      ...prev,
      analysisResults: payload
    }));

    console.log('Content analysis completed:', payload);
  }, []);

  const handleCollaboratorJoined = useCallback((payload: Collaborator) => {
    if (!enableCollaboration) return;

    setState(prev => ({
      ...prev,
      collaborators: [
        ...prev.collaborators.filter(c => c.id !== payload.id),
        { ...payload, isActive: true, lastSeen: new Date() }
      ]
    }));

    console.log(`Collaborator joined: ${payload.name}`);
  }, [enableCollaboration]);

  const handleCollaboratorLeft = useCallback((payload: { collaboratorId: string }) => {
    if (!enableCollaboration) return;

    setState(prev => ({
      ...prev,
      collaborators: prev.collaborators.map(collab =>
        collab.id === payload.collaboratorId
          ? { ...collab, isActive: false, lastSeen: new Date() }
          : collab
      )
    }));
  }, [enableCollaboration]);

  const handleCursorMoved = useCallback((payload: { collaboratorId: string; cursor: CursorPosition }) => {
    if (!enableCollaboration) return;

    setState(prev => ({
      ...prev,
      collaborators: prev.collaborators.map(collab =>
        collab.id === payload.collaboratorId
          ? { ...collab, cursor: payload.cursor, lastSeen: new Date() }
          : collab
      )
    }));
  }, [enableCollaboration]);

  // Zone manipulation functions
  const createZone = useCallback((zoneData: Partial<Zone>) => {
    const newZone: Zone = {
      id: `zone_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      coordinates: { x: 0, y: 0, width: 100, height: 100 },
      contentType: 'text',
      confidence: 0.8,
      pageNumber: 1,
      status: 'detected',
      userModified: true,
      lastModified: new Date(),
      characteristics: {
        textDensity: 0.5,
        lineSpacing: 12,
        wordSpacing: 4,
        fontSizes: [12],
        hasStructure: false,
        hasImages: false,
        complexity: 'medium',
        readingOrder: 1
      },
      fallbackTools: [],
      ...zoneData
    };

    setState(prev => ({
      ...prev,
      zones: [...prev.zones, newZone],
      hasUnsavedChanges: true,
      lastModified: new Date()
    }));

    // Broadcast to other collaborators
    if (enableRealtime && isConnected) {
      sendMessage({
        type: 'zone_created',
        data: {
          zone: newZone,
          author: getCurrentUser().id
        }
      });
    }

    return newZone;
  }, [enableRealtime, isConnected, sendMessage]);

  const updateZone = useCallback((zoneId: string, updates: Partial<Zone>) => {
    setState(prev => ({
      ...prev,
      zones: prev.zones.map(zone =>
        zone.id === zoneId
          ? { ...zone, ...updates, lastModified: new Date(), userModified: true }
          : zone
      ),
      hasUnsavedChanges: true,
      lastModified: new Date()
    }));

    // Broadcast to other collaborators
    if (enableRealtime && isConnected) {
      sendMessage({
        type: 'zone_updated',
        data: {
          zoneId,
          updates,
          author: getCurrentUser().id,
          timestamp: new Date(),
          source: 'local'
        }
      });
    }
  }, [enableRealtime, isConnected, sendMessage]);

  const deleteZone = useCallback((zoneId: string) => {
    setState(prev => ({
      ...prev,
      zones: prev.zones.filter(zone => zone.id !== zoneId),
      selectedZone: prev.selectedZone === zoneId ? null : prev.selectedZone,
      hasUnsavedChanges: true,
      lastModified: new Date()
    }));

    // Broadcast to other collaborators
    if (enableRealtime && isConnected) {
      sendMessage({
        type: 'zone_deleted',
        data: {
          zoneId,
          author: getCurrentUser().id
        }
      });
    }
  }, [enableRealtime, isConnected, sendMessage]);

  const selectZone = useCallback((zoneId: string | null) => {
    setState(prev => ({
      ...prev,
      selectedZone: zoneId
    }));

    // Broadcast selection to other collaborators
    if (enableCollaboration && enableRealtime && isConnected) {
      sendMessage({
        type: 'zone_selected',
        data: {
          zoneId,
          author: getCurrentUser().id
        }
      });
    }
  }, [enableCollaboration, enableRealtime, isConnected, sendMessage]);

  const assignTool = useCallback((zoneId: string, toolName: string) => {
    updateZone(zoneId, { assignedTool: toolName });

    // Broadcast tool assignment
    if (enableRealtime && isConnected) {
      sendMessage({
        type: 'tool_assigned',
        data: {
          zoneId,
          toolName,
          author: getCurrentUser().id
        }
      });
    }
  }, [updateZone, enableRealtime, isConnected, sendMessage]);

  const mergeZones = useCallback((zoneIds: string[]) => {
    const zonesToMerge = state.zones.filter(zone => zoneIds.includes(zone.id));
    if (zonesToMerge.length < 2) return;

    // Calculate merged bounding box
    const boundingBox = zonesToMerge.reduce((bounds, zone) => {
      const coords = zone.coordinates;
      return {
        left: Math.min(bounds.left, coords.x),
        top: Math.min(bounds.top, coords.y),
        right: Math.max(bounds.right, coords.x + coords.width),
        bottom: Math.max(bounds.bottom, coords.y + coords.height)
      };
    }, {
      left: Infinity,
      top: Infinity,
      right: -Infinity,
      bottom: -Infinity
    });

    // Create merged zone
    const mergedZone: Zone = {
      id: `merged_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      coordinates: {
        x: boundingBox.left,
        y: boundingBox.top,
        width: boundingBox.right - boundingBox.left,
        height: boundingBox.bottom - boundingBox.top
      },
      contentType: 'mixed',
      confidence: zonesToMerge.reduce((sum, z) => sum + z.confidence, 0) / zonesToMerge.length,
      pageNumber: zonesToMerge[0].pageNumber,
      status: 'detected',
      userModified: true,
      lastModified: new Date(),
      characteristics: {
        textDensity: 0.5,
        lineSpacing: 12,
        wordSpacing: 4,
        fontSizes: [12],
        hasStructure: true,
        hasImages: false,
        complexity: 'medium',
        readingOrder: Math.min(...zonesToMerge.map(z => z.characteristics.readingOrder))
      },
      fallbackTools: [],
      textContent: zonesToMerge.map(z => z.textContent).filter(Boolean).join('\n')
    };

    setState(prev => ({
      ...prev,
      zones: [
        ...prev.zones.filter(zone => !zoneIds.includes(zone.id)),
        mergedZone
      ],
      selectedZone: mergedZone.id,
      hasUnsavedChanges: true,
      lastModified: new Date()
    }));

    // Broadcast merge
    if (enableRealtime && isConnected) {
      sendMessage({
        type: 'zones_merged',
        data: {
          zoneIds,
          newZone: mergedZone,
          author: getCurrentUser().id
        }
      });
    }

    return mergedZone;
  }, [state.zones, enableRealtime, isConnected, sendMessage]);

  const splitZone = useCallback((zoneId: string, splitPoints: Array<{ x: number; y: number; type: 'horizontal' | 'vertical' }>) => {
    const originalZone = state.zones.find(zone => zone.id === zoneId);
    if (!originalZone) return;

    // Simplified split logic - in production would be more sophisticated
    const newZones: Zone[] = splitPoints.map((point, index) => ({
      ...originalZone,
      id: `${zoneId}_split_${index}_${Date.now()}`,
      coordinates: {
        x: point.type === 'vertical' ? (index === 0 ? originalZone.coordinates.x : point.x) : originalZone.coordinates.x,
        y: point.type === 'horizontal' ? (index === 0 ? originalZone.coordinates.y : point.y) : originalZone.coordinates.y,
        width: point.type === 'vertical' ? 
          (index === 0 ? point.x - originalZone.coordinates.x : originalZone.coordinates.x + originalZone.coordinates.width - point.x) :
          originalZone.coordinates.width,
        height: point.type === 'horizontal' ?
          (index === 0 ? point.y - originalZone.coordinates.y : originalZone.coordinates.y + originalZone.coordinates.height - point.y) :
          originalZone.coordinates.height
      },
      userModified: true,
      lastModified: new Date()
    }));

    setState(prev => ({
      ...prev,
      zones: [
        ...prev.zones.filter(zone => zone.id !== zoneId),
        ...newZones
      ],
      hasUnsavedChanges: true,
      lastModified: new Date()
    }));

    // Broadcast split
    if (enableRealtime && isConnected) {
      sendMessage({
        type: 'zone_split',
        data: {
          originalZoneId: zoneId,
          newZones,
          author: getCurrentUser().id
        }
      });
    }

    return newZones;
  }, [state.zones, enableRealtime, isConnected, sendMessage]);

  // Collaboration functions
  const moveCursor = useCallback((x: number, y: number) => {
    if (!enableCollaboration || !enableRealtime || !isConnected) return;

    const cursor: CursorPosition = {
      x,
      y,
      timestamp: new Date()
    };

    sendMessage({
      type: 'cursor_moved',
      data: {
        collaboratorId: getCurrentUser().id,
        cursor
      }
    });
  }, [enableCollaboration, enableRealtime, isConnected, sendMessage]);

  // Utility functions
  const getZoneById = useCallback((zoneId: string): Zone | undefined => {
    return state.zones.find(zone => zone.id === zoneId);
  }, [state.zones]);

  const getZonesByPage = useCallback((pageNumber: number): Zone[] => {
    return state.zones.filter(zone => zone.pageNumber === pageNumber);
  }, [state.zones]);

  const getZonesByType = useCallback((contentType: string): Zone[] => {
    return state.zones.filter(zone => zone.contentType === contentType);
  }, [state.zones]);

  const hasUnsavedChanges = useCallback((): boolean => {
    return state.hasUnsavedChanges;
  }, [state.hasUnsavedChanges]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, []);

  return {
    // State
    ...state,
    isConnected: enableRealtime ? isConnected : true,

    // Zone operations
    createZone,
    updateZone,
    deleteZone,
    selectZone,
    assignTool,
    mergeZones,
    splitZone,

    // Data operations
    loadZones,
    saveZones,

    // Utility functions
    getZoneById,
    getZonesByPage,
    getZonesByType,
    hasUnsavedChanges,

    // Collaboration
    moveCursor,
    collaborators: enableCollaboration ? state.collaborators : []
  };
}

// Helper function to get current user
function getCurrentUser() {
  // In a real app, this would get the actual authenticated user
  return {
    id: 'user_' + Math.random().toString(36).substr(2, 9),
    name: 'Current User',
    avatar: undefined
  };
}

export default useZones; 