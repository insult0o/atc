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

// Helper function to convert API zone to frontend format
function convertApiZoneToFrontend(apiZone: any): Zone {
  return {
    id: apiZone.id,
    coordinates: apiZone.coordinates,
    contentType: apiZone.zone_type,
    confidence: apiZone.confidence,
    pageNumber: apiZone.page_number,
    status: apiZone.status,
    userModified: apiZone.metadata?.userModified || false,
    lastModified: new Date(apiZone.updated_at),
    characteristics: apiZone.metadata?.characteristics || {
      textDensity: 0.5,
      lineSpacing: 12,
      wordSpacing: 4,
      fontSizes: [12],
      hasStructure: false,
      hasImages: false,
      complexity: 'medium',
      readingOrder: 1
    },
    fallbackTools: apiZone.metadata?.fallbackTools || [],
    textContent: apiZone.content,
    assignedTool: apiZone.metadata?.assignedTool
  };
}

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
        const response = await fetch(`/api/v1/documents/${documentId}/zones`);
        if (!response.ok) {
          throw new Error(`Failed to load zones: ${response.statusText}`);
        }
        const data = await response.json();
        zones = (data.zones || []).map(convertApiZoneToFrontend);
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
        // Fallback to API - save each zone individually
        for (const zone of state.zones) {
          if (zone.userModified) {
            const response = await fetch(`/api/v1/zones/${zone.id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                zone_type: zone.contentType,
                content: zone.textContent,
                confidence: zone.confidence,
                status: zone.status,
                coordinates: zone.coordinates,
                metadata: {
                  userModified: zone.userModified,
                  assignedTool: zone.assignedTool,
                  characteristics: zone.characteristics
                }
              })
            });

            if (!response.ok) {
              throw new Error(`Failed to save zone ${zone.id}: ${response.statusText}`);
            }
          }
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
  const createZone = useCallback(async (zoneData: Partial<Zone>) => {
    try {
      // Create zone via API
      const response = await fetch(`/api/v1/documents/${documentId}/zones`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          document_id: documentId,
          zone_index: state.zones.length,
          page_number: zoneData.pageNumber || 1,
          zone_type: zoneData.contentType || 'text',
          coordinates: zoneData.coordinates || { x: 0, y: 0, width: 100, height: 100 },
          content: zoneData.textContent || null,
          confidence: zoneData.confidence || 0.8,
          metadata: {
            userModified: true,
            characteristics: zoneData.characteristics || {
              textDensity: 0.5,
              lineSpacing: 12,
              wordSpacing: 4,
              fontSizes: [12],
              hasStructure: false,
              hasImages: false,
              complexity: 'medium',
              readingOrder: 1
            }
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to create zone: ${response.statusText}`);
      }

      const newZone = await response.json();
      const frontendZone = convertApiZoneToFrontend(newZone);

      setState(prev => ({
        ...prev,
        zones: [...prev.zones, frontendZone],
        hasUnsavedChanges: false,
        lastModified: new Date()
      }));

      // Broadcast to other collaborators
      if (enableRealtime && isConnected) {
        sendMessage({
          type: 'zone_created',
          data: {
            zone: frontendZone,
            author: getCurrentUser().id
          }
        });
      }

      return frontendZone;
    } catch (error) {
      console.error('Failed to create zone:', error);
      throw error;
    }
  }, [documentId, state.zones.length, enableRealtime, isConnected, sendMessage]);

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

  const deleteZone = useCallback(async (zoneId: string) => {
    try {
      // Delete zone via API
      const response = await fetch(`/api/v1/zones/${zoneId}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error(`Failed to delete zone: ${response.statusText}`);
      }

      setState(prev => ({
        ...prev,
        zones: prev.zones.filter(zone => zone.id !== zoneId),
        selectedZone: prev.selectedZone === zoneId ? null : prev.selectedZone,
        hasUnsavedChanges: false,
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
    } catch (error) {
      console.error('Failed to delete zone:', error);
      throw error;
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

  const mergeZones = useCallback(async (zoneIds: string[]) => {
    if (zoneIds.length < 2) return;

    try {
      // Merge zones via API
      const response = await fetch('/api/v1/zones/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          zone_ids: zoneIds,
          merge_strategy: 'smart',
          preserve_formatting: true
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to merge zones: ${response.statusText}`);
      }

      const result = await response.json();
      const frontendZone = convertApiZoneToFrontend(result.merged_zone);

      setState(prev => ({
        ...prev,
        zones: [
          ...prev.zones.filter(zone => !zoneIds.includes(zone.id)),
          frontendZone
        ],
        selectedZone: frontendZone.id,
        hasUnsavedChanges: false,
        lastModified: new Date()
      }));

      // Broadcast merge
      if (enableRealtime && isConnected) {
        sendMessage({
          type: 'zones_merged',
          data: {
            zoneIds,
            newZone: frontendZone,
            author: getCurrentUser().id
          }
        });
      }

      return frontendZone;
    } catch (error) {
      console.error('Failed to merge zones:', error);
      throw error;
    }
  }, [enableRealtime, isConnected, sendMessage]);

  const splitZone = useCallback(async (zoneId: string, splitType: 'horizontal' | 'vertical' | 'auto', splitPosition?: number) => {
    try {
      // Split zone via API
      const response = await fetch(`/api/v1/zones/${zoneId}/split`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          split_type: splitType,
          split_position: splitPosition
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to split zone: ${response.statusText}`);
      }

      const result = await response.json();
      const frontendZones = result.new_zones.map(convertApiZoneToFrontend);

      setState(prev => ({
        ...prev,
        zones: [
          ...prev.zones.filter(zone => zone.id !== zoneId),
          ...frontendZones
        ],
        hasUnsavedChanges: false,
        lastModified: new Date()
      }));

      // Broadcast split
      if (enableRealtime && isConnected) {
        sendMessage({
          type: 'zone_split',
          data: {
            originalZoneId: zoneId,
            newZones: frontendZones,
            author: getCurrentUser().id
          }
        });
      }

      return frontendZones;
    } catch (error) {
      console.error('Failed to split zone:', error);
      throw error;
    }
  }, [enableRealtime, isConnected, sendMessage]);

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