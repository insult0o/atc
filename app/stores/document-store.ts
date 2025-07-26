import { create } from 'zustand';
import type { Zone, Document, ProcessingStatus } from '@pdf-platform/shared';

interface DocumentStore {
  // State
  document: Document | null;
  zones: Zone[];
  processing: ProcessingStatus;
  error: string | null;
  
  // Actions
  setDocument: (document: Document) => void;
  updateZone: (zoneId: string, updates: Partial<Zone>) => void;
  addZone: (zone: Zone) => void;
  removeZone: (zoneId: string) => void;
  setProcessing: (processing: ProcessingStatus) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

export const useDocumentStore = create<DocumentStore>((set) => ({
  // Initial state
  document: null,
  zones: [],
  processing: {
    totalZones: 0,
    completedZones: 0,
    currentlyProcessing: [],
    estimatedTimeRemaining: 0,
  },
  error: null,
  
  // Actions
  setDocument: (document) => set({ document }),
  
  updateZone: (zoneId, updates) => set((state) => ({
    zones: state.zones.map((zone) => 
      zone.id === zoneId ? { ...zone, ...updates } : zone
    ),
  })),
  
  addZone: (zone) => set((state) => ({
    zones: [...state.zones, zone],
  })),
  
  removeZone: (zoneId) => set((state) => ({
    zones: state.zones.filter((zone) => zone.id !== zoneId),
  })),
  
  setProcessing: (processing) => set({ processing }),
  
  setError: (error) => set({ error }),
  
  reset: () => set({
    document: null,
    zones: [],
    processing: {
      totalZones: 0,
      completedZones: 0,
      currentlyProcessing: [],
      estimatedTimeRemaining: 0,
    },
    error: null,
  }),
})); 