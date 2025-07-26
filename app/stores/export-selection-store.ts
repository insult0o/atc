/**
 * Export Selection State Management
 * Manages selection state with persistence and undo/redo
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { ExportSelection, SelectionItem } from '../components/export/SelectionPanel';
import { Zone } from '@/lib/types/zone';

interface SelectionHistory {
  past: ExportSelection[];
  present: ExportSelection;
  future: ExportSelection[];
}

interface SelectionConflict {
  itemId: string;
  reason: string;
  resolution: 'include' | 'exclude' | 'pending';
}

interface ExportSelectionState {
  // Current selection
  selection: ExportSelection;
  
  // History for undo/redo
  history: SelectionHistory;
  
  // Conflicts
  conflicts: SelectionConflict[];
  
  // Temporary selections (not persisted)
  tempSelection: ExportSelection | null;
  
  // Selection metadata
  lastModified: Date;
  modifiedBy?: string;
  
  // Actions
  setSelection: (selection: ExportSelection) => void;
  updateSelection: (updates: Partial<ExportSelection>) => void;
  addItems: (items: SelectionItem[]) => void;
  removeItems: (itemIds: string[]) => void;
  toggleItem: (itemId: string) => void;
  
  // Bulk operations
  selectAll: (zones: Zone[], pages: number[]) => void;
  selectNone: () => void;
  selectByType: (type: string, zones: Zone[]) => void;
  selectByPage: (pageNumbers: number[], zones: Zone[]) => void;
  selectByConfidence: (threshold: number, zones: Zone[]) => void;
  
  // History management
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  clearHistory: () => void;
  
  // Conflict resolution
  addConflict: (conflict: SelectionConflict) => void;
  resolveConflict: (itemId: string, resolution: 'include' | 'exclude') => void;
  clearConflicts: () => void;
  
  // Persistence
  saveSelection: (name: string) => void;
  loadSelection: (name: string) => void;
  getSavedSelections: () => string[];
  deleteSavedSelection: (name: string) => void;
  
  // Temporary selection
  setTempSelection: (selection: ExportSelection | null) => void;
  applyTempSelection: () => void;
  
  // Utilities
  reset: () => void;
  getStatistics: () => SelectionStatistics;
}

interface SelectionStatistics {
  totalItems: number;
  selectedItems: number;
  selectedZones: number;
  selectedPages: number;
  conflicts: number;
  coverage: number;
}

interface SavedSelection {
  name: string;
  selection: ExportSelection;
  savedAt: Date;
  savedBy?: string;
}

const initialSelection: ExportSelection = {
  type: 'zones',
  zoneIds: new Set(),
  pageNumbers: new Set(),
  totalCount: 0,
  items: []
};

const initialHistory: SelectionHistory = {
  past: [],
  present: initialSelection,
  future: []
};

export const useExportSelectionStore = create<ExportSelectionState>()(
  persist(
    (set, get) => ({
      selection: initialSelection,
      history: initialHistory,
      conflicts: [],
      tempSelection: null,
      lastModified: new Date(),
      
      setSelection: (selection) => {
        const state = get();
        const newHistory: SelectionHistory = {
          past: [...state.history.past, state.history.present],
          present: selection,
          future: []
        };
        
        set({
          selection,
          history: newHistory,
          lastModified: new Date()
        });
      },
      
      updateSelection: (updates) => {
        const state = get();
        const newSelection = {
          ...state.selection,
          ...updates
        };
        
        state.setSelection(newSelection);
      },
      
      addItems: (items) => {
        const state = get();
        const existingIds = new Set(state.selection.items.map(item => item.id));
        const newItems = items.filter(item => !existingIds.has(item.id));
        
        if (newItems.length === 0) return;
        
        const updatedItems = [...state.selection.items, ...newItems];
        const newZoneIds = new Set([...state.selection.zoneIds]);
        const newPageNumbers = new Set([...state.selection.pageNumbers]);
        
        newItems.forEach(item => {
          if (item.type === 'zone' && item.includeInExport) {
            newZoneIds.add(item.id);
          } else if (item.type === 'page' && item.includeInExport) {
            newPageNumbers.add(parseInt(item.id));
          }
        });
        
        state.setSelection({
          ...state.selection,
          items: updatedItems,
          zoneIds: newZoneIds,
          pageNumbers: newPageNumbers,
          totalCount: updatedItems.filter(i => i.includeInExport).length
        });
      },
      
      removeItems: (itemIds) => {
        const state = get();
        const itemIdSet = new Set(itemIds);
        
        const updatedItems = state.selection.items.filter(
          item => !itemIdSet.has(item.id)
        );
        
        const newZoneIds = new Set<string>();
        const newPageNumbers = new Set<number>();
        
        updatedItems.forEach(item => {
          if (item.type === 'zone' && item.includeInExport) {
            newZoneIds.add(item.id);
          } else if (item.type === 'page' && item.includeInExport) {
            newPageNumbers.add(parseInt(item.id));
          }
        });
        
        state.setSelection({
          ...state.selection,
          items: updatedItems,
          zoneIds: newZoneIds,
          pageNumbers: newPageNumbers,
          totalCount: updatedItems.filter(i => i.includeInExport).length
        });
      },
      
      toggleItem: (itemId) => {
        const state = get();
        const updatedItems = state.selection.items.map(item => 
          item.id === itemId 
            ? { ...item, includeInExport: !item.includeInExport }
            : item
        );
        
        const newZoneIds = new Set<string>();
        const newPageNumbers = new Set<number>();
        
        updatedItems.forEach(item => {
          if (item.includeInExport) {
            if (item.type === 'zone') {
              newZoneIds.add(item.id);
            } else if (item.type === 'page') {
              newPageNumbers.add(parseInt(item.id));
            }
          }
        });
        
        state.setSelection({
          ...state.selection,
          items: updatedItems,
          zoneIds: newZoneIds,
          pageNumbers: newPageNumbers,
          totalCount: updatedItems.filter(i => i.includeInExport).length
        });
      },
      
      selectAll: (zones, pages) => {
        const items: SelectionItem[] = [
          ...zones.map(zone => ({
            id: zone.id,
            type: 'zone' as const,
            boundaries: {
              x: zone.bounds.x,
              y: zone.bounds.y,
              width: zone.bounds.width,
              height: zone.bounds.height,
              pageNumber: zone.pageNumber
            },
            dependencies: zone.dependencies || [],
            contentPreview: zone.textContent?.substring(0, 100) || '',
            includeInExport: true,
            validationStatus: 'valid' as const
          })),
          ...pages.map(pageNumber => ({
            id: `page_${pageNumber}`,
            type: 'page' as const,
            boundaries: {
              x: 0,
              y: 0,
              width: 0,
              height: 0,
              pageNumber
            },
            dependencies: [],
            contentPreview: `Page ${pageNumber}`,
            includeInExport: true,
            validationStatus: 'valid' as const
          }))
        ];
        
        get().setSelection({
          type: 'all',
          zoneIds: new Set(zones.map(z => z.id)),
          pageNumbers: new Set(pages),
          totalCount: items.length,
          items
        });
      },
      
      selectNone: () => {
        get().setSelection(initialSelection);
      },
      
      selectByType: (type, zones) => {
        const filteredZones = zones.filter(z => z.type === type);
        const items: SelectionItem[] = filteredZones.map(zone => ({
          id: zone.id,
          type: 'zone',
          boundaries: {
            x: zone.bounds.x,
            y: zone.bounds.y,
            width: zone.bounds.width,
            height: zone.bounds.height,
            pageNumber: zone.pageNumber
          },
          dependencies: zone.dependencies || [],
          contentPreview: zone.textContent?.substring(0, 100) || '',
          includeInExport: true,
          validationStatus: 'valid' as const
        }));
        
        get().setSelection({
          type: 'zones',
          zoneIds: new Set(filteredZones.map(z => z.id)),
          pageNumbers: new Set(),
          totalCount: items.length,
          items
        });
      },
      
      selectByPage: (pageNumbers, zones) => {
        const pageSet = new Set(pageNumbers);
        const filteredZones = zones.filter(z => pageSet.has(z.pageNumber));
        
        const items: SelectionItem[] = [
          ...filteredZones.map(zone => ({
            id: zone.id,
            type: 'zone' as const,
            boundaries: {
              x: zone.bounds.x,
              y: zone.bounds.y,
              width: zone.bounds.width,
              height: zone.bounds.height,
              pageNumber: zone.pageNumber
            },
            dependencies: zone.dependencies || [],
            contentPreview: zone.textContent?.substring(0, 100) || '',
            includeInExport: true,
            validationStatus: 'valid' as const
          })),
          ...pageNumbers.map(pageNumber => ({
            id: `page_${pageNumber}`,
            type: 'page' as const,
            boundaries: {
              x: 0,
              y: 0,
              width: 0,
              height: 0,
              pageNumber
            },
            dependencies: [],
            contentPreview: `Page ${pageNumber}`,
            includeInExport: true,
            validationStatus: 'valid' as const
          }))
        ];
        
        get().setSelection({
          type: 'pages',
          zoneIds: new Set(filteredZones.map(z => z.id)),
          pageNumbers: new Set(pageNumbers),
          totalCount: items.length,
          items
        });
      },
      
      selectByConfidence: (threshold, zones) => {
        const filteredZones = zones.filter(z => 
          (z.confidence || 0) < threshold
        );
        
        const items: SelectionItem[] = filteredZones.map(zone => ({
          id: zone.id,
          type: 'zone',
          boundaries: {
            x: zone.bounds.x,
            y: zone.bounds.y,
            width: zone.bounds.width,
            height: zone.bounds.height,
            pageNumber: zone.pageNumber
          },
          dependencies: zone.dependencies || [],
          contentPreview: zone.textContent?.substring(0, 100) || '',
          includeInExport: true,
          validationStatus: zone.confidence && zone.confidence < 0.5 ? 'warning' : 'valid'
        }));
        
        get().setSelection({
          type: 'zones',
          zoneIds: new Set(filteredZones.map(z => z.id)),
          pageNumbers: new Set(),
          totalCount: items.length,
          items
        });
      },
      
      undo: () => {
        const state = get();
        if (state.history.past.length === 0) return;
        
        const newPast = [...state.history.past];
        const previous = newPast.pop()!;
        
        set({
          selection: previous,
          history: {
            past: newPast,
            present: previous,
            future: [state.history.present, ...state.history.future]
          },
          lastModified: new Date()
        });
      },
      
      redo: () => {
        const state = get();
        if (state.history.future.length === 0) return;
        
        const newFuture = [...state.history.future];
        const next = newFuture.shift()!;
        
        set({
          selection: next,
          history: {
            past: [...state.history.past, state.history.present],
            present: next,
            future: newFuture
          },
          lastModified: new Date()
        });
      },
      
      canUndo: () => get().history.past.length > 0,
      canRedo: () => get().history.future.length > 0,
      
      clearHistory: () => {
        const state = get();
        set({
          history: {
            past: [],
            present: state.selection,
            future: []
          }
        });
      },
      
      addConflict: (conflict) => {
        set(state => ({
          conflicts: [...state.conflicts, conflict]
        }));
      },
      
      resolveConflict: (itemId, resolution) => {
        const state = get();
        
        // Update conflict
        const updatedConflicts = state.conflicts.map(c => 
          c.itemId === itemId 
            ? { ...c, resolution }
            : c
        );
        
        // Update item based on resolution
        const updatedItems = state.selection.items.map(item => 
          item.id === itemId
            ? { ...item, includeInExport: resolution === 'include' }
            : item
        );
        
        set({
          conflicts: updatedConflicts,
          selection: {
            ...state.selection,
            items: updatedItems
          }
        });
      },
      
      clearConflicts: () => {
        set({ conflicts: [] });
      },
      
      saveSelection: (name) => {
        const state = get();
        const saved: SavedSelection = {
          name,
          selection: state.selection,
          savedAt: new Date(),
          savedBy: state.modifiedBy
        };
        
        const savedSelections = JSON.parse(
          localStorage.getItem('savedExportSelections') || '{}'
        );
        savedSelections[name] = saved;
        localStorage.setItem('savedExportSelections', JSON.stringify(savedSelections));
      },
      
      loadSelection: (name) => {
        const savedSelections = JSON.parse(
          localStorage.getItem('savedExportSelections') || '{}'
        );
        
        const saved = savedSelections[name];
        if (saved) {
          // Reconstruct Sets from arrays
          const selection: ExportSelection = {
            ...saved.selection,
            zoneIds: new Set(saved.selection.zoneIds),
            pageNumbers: new Set(saved.selection.pageNumbers)
          };
          get().setSelection(selection);
        }
      },
      
      getSavedSelections: () => {
        const savedSelections = JSON.parse(
          localStorage.getItem('savedExportSelections') || '{}'
        );
        return Object.keys(savedSelections);
      },
      
      deleteSavedSelection: (name) => {
        const savedSelections = JSON.parse(
          localStorage.getItem('savedExportSelections') || '{}'
        );
        delete savedSelections[name];
        localStorage.setItem('savedExportSelections', JSON.stringify(savedSelections));
      },
      
      setTempSelection: (selection) => {
        set({ tempSelection: selection });
      },
      
      applyTempSelection: () => {
        const state = get();
        if (state.tempSelection) {
          state.setSelection(state.tempSelection);
          set({ tempSelection: null });
        }
      },
      
      reset: () => {
        set({
          selection: initialSelection,
          history: initialHistory,
          conflicts: [],
          tempSelection: null,
          lastModified: new Date()
        });
      },
      
      getStatistics: () => {
        const state = get();
        const selectedItems = state.selection.items.filter(i => i.includeInExport);
        const selectedZones = selectedItems.filter(i => i.type === 'zone');
        const selectedPages = selectedItems.filter(i => i.type === 'page');
        
        return {
          totalItems: state.selection.items.length,
          selectedItems: selectedItems.length,
          selectedZones: selectedZones.length,
          selectedPages: selectedPages.length,
          conflicts: state.conflicts.filter(c => c.resolution === 'pending').length,
          coverage: state.selection.items.length > 0 
            ? (selectedItems.length / state.selection.items.length) * 100
            : 0
        };
      }
    }),
    {
      name: 'export-selection-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        selection: state.selection,
        lastModified: state.lastModified,
        modifiedBy: state.modifiedBy
      })
    }
  )
);