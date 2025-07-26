import React, { useState, useCallback, useMemo } from 'react';
import type { Zone } from '@pdf-platform/shared';

interface SelectionPanelProps {
  zones: Zone[];
  pages: number[];
  onSelectionChange: (selection: ExportSelection) => void;
  initialSelection?: ExportSelection;
}

export interface ExportSelection {
  type: 'zones' | 'pages' | 'all';
  zoneIds: Set<string>;
  pageNumbers: Set<number>;
  totalCount: number;
}

interface SelectionMode {
  mode: 'zones' | 'pages';
  multiSelect: boolean;
}

export const SelectionPanel: React.FC<SelectionPanelProps> = ({
  zones,
  pages,
  onSelectionChange,
  initialSelection
}) => {
  const [selectionMode, setSelectionMode] = useState<SelectionMode>({
    mode: 'zones',
    multiSelect: true
  });

  const [selectedZones, setSelectedZones] = useState<Set<string>>(
    initialSelection?.zoneIds || new Set()
  );

  const [selectedPages, setSelectedPages] = useState<Set<number>>(
    initialSelection?.pageNumbers || new Set()
  );

  const [lastSelectedIndex, setLastSelectedIndex] = useState<number>(-1);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');

  // Group zones by page for easier navigation
  const zonesByPage = useMemo(() => {
    const grouped = new Map<number, Zone[]>();
    zones.forEach(zone => {
      const page = zone.page || 1;
      if (!grouped.has(page)) {
        grouped.set(page, []);
      }
      grouped.get(page)!.push(zone);
    });
    return grouped;
  }, [zones]);

  // Filter zones based on search and type
  const filteredZones = useMemo(() => {
    return zones.filter(zone => {
      const matchesSearch = searchQuery === '' || 
        zone.content?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        zone.type.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesType = filterType === 'all' || zone.type === filterType;
      
      return matchesSearch && matchesType;
    });
  }, [zones, searchQuery, filterType]);

  // Calculate selection statistics
  const selectionStats = useMemo(() => {
    const stats = {
      totalZones: zones.length,
      selectedZones: selectedZones.size,
      totalPages: pages.length,
      selectedPages: selectedPages.size,
      estimatedSize: 0
    };

    // Estimate export size based on selected content
    selectedZones.forEach(zoneId => {
      const zone = zones.find(z => z.id === zoneId);
      if (zone?.content) {
        stats.estimatedSize += zone.content.length;
      }
    });

    return stats;
  }, [zones, selectedZones, pages, selectedPages]);

  // Handle zone selection
  const handleZoneClick = useCallback((zone: Zone, index: number, event: React.MouseEvent) => {
    const newSelection = new Set(selectedZones);
    
    if (event.shiftKey && lastSelectedIndex !== -1 && selectionMode.multiSelect) {
      // Range selection
      const start = Math.min(lastSelectedIndex, index);
      const end = Math.max(lastSelectedIndex, index);
      
      for (let i = start; i <= end; i++) {
        if (filteredZones[i]) {
          newSelection.add(filteredZones[i].id);
        }
      }
    } else if (event.ctrlKey || event.metaKey) {
      // Toggle selection
      if (newSelection.has(zone.id)) {
        newSelection.delete(zone.id);
      } else {
        newSelection.add(zone.id);
      }
    } else {
      // Single selection (clear others unless multiSelect)
      if (selectionMode.multiSelect && newSelection.has(zone.id)) {
        newSelection.delete(zone.id);
      } else {
        if (!selectionMode.multiSelect) {
          newSelection.clear();
        }
        newSelection.add(zone.id);
      }
    }

    setSelectedZones(newSelection);
    setLastSelectedIndex(index);
    
    // Update parent with new selection
    const selection: ExportSelection = {
      type: 'zones',
      zoneIds: newSelection,
      pageNumbers: new Set(),
      totalCount: newSelection.size
    };
    onSelectionChange(selection);
  }, [selectedZones, lastSelectedIndex, selectionMode, filteredZones, onSelectionChange]);

  // Handle page selection
  const handlePageClick = useCallback((pageNumber: number) => {
    const newSelection = new Set(selectedPages);
    
    if (newSelection.has(pageNumber)) {
      newSelection.delete(pageNumber);
    } else {
      if (!selectionMode.multiSelect) {
        newSelection.clear();
      }
      newSelection.add(pageNumber);
    }

    setSelectedPages(newSelection);
    
    // Also select all zones on selected pages
    const pageZoneIds = new Set<string>();
    newSelection.forEach(page => {
      zonesByPage.get(page)?.forEach(zone => {
        pageZoneIds.add(zone.id);
      });
    });

    setSelectedZones(pageZoneIds);
    
    const selection: ExportSelection = {
      type: 'pages',
      zoneIds: pageZoneIds,
      pageNumbers: newSelection,
      totalCount: pageZoneIds.size
    };
    onSelectionChange(selection);
  }, [selectedPages, selectionMode, zonesByPage, onSelectionChange]);

  // Quick selection helpers
  const selectAll = useCallback(() => {
    const allZoneIds = new Set(zones.map(z => z.id));
    const allPageNumbers = new Set(pages);
    
    setSelectedZones(allZoneIds);
    setSelectedPages(allPageNumbers);
    
    const selection: ExportSelection = {
      type: 'all',
      zoneIds: allZoneIds,
      pageNumbers: allPageNumbers,
      totalCount: allZoneIds.size
    };
    onSelectionChange(selection);
  }, [zones, pages, onSelectionChange]);

  const selectNone = useCallback(() => {
    setSelectedZones(new Set());
    setSelectedPages(new Set());
    
    const selection: ExportSelection = {
      type: 'zones',
      zoneIds: new Set(),
      pageNumbers: new Set(),
      totalCount: 0
    };
    onSelectionChange(selection);
  }, [onSelectionChange]);

  const invertSelection = useCallback(() => {
    const inverted = new Set<string>();
    zones.forEach(zone => {
      if (!selectedZones.has(zone.id)) {
        inverted.add(zone.id);
      }
    });
    
    setSelectedZones(inverted);
    
    const selection: ExportSelection = {
      type: 'zones',
      zoneIds: inverted,
      pageNumbers: new Set(),
      totalCount: inverted.size
    };
    onSelectionChange(selection);
  }, [zones, selectedZones, onSelectionChange]);

  const selectByConfidence = useCallback((threshold: number) => {
    const lowConfidence = new Set<string>();
    zones.forEach(zone => {
      if ((zone.confidence || 0) < threshold) {
        lowConfidence.add(zone.id);
      }
    });
    
    setSelectedZones(lowConfidence);
    
    const selection: ExportSelection = {
      type: 'zones',
      zoneIds: lowConfidence,
      pageNumbers: new Set(),
      totalCount: lowConfidence.size
    };
    onSelectionChange(selection);
  }, [zones, onSelectionChange]);

  return (
    <div className="flex flex-col h-full bg-white rounded-lg shadow">
      {/* Header with mode selector */}
      <div className="p-4 border-b">
        <h3 className="text-lg font-semibold mb-3">Export Selection</h3>
        
        <div className="flex gap-2 mb-3">
          <button
            onClick={() => setSelectionMode({ ...selectionMode, mode: 'zones' })}
            className={`px-4 py-2 rounded ${
              selectionMode.mode === 'zones'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-200 text-gray-700'
            }`}
          >
            Select Zones
          </button>
          <button
            onClick={() => setSelectionMode({ ...selectionMode, mode: 'pages' })}
            className={`px-4 py-2 rounded ${
              selectionMode.mode === 'pages'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-200 text-gray-700'
            }`}
          >
            Select Pages
          </button>
          
          <div className="ml-auto flex items-center gap-2">
            <input
              type="checkbox"
              id="multiSelect"
              checked={selectionMode.multiSelect}
              onChange={(e) => setSelectionMode({ ...selectionMode, multiSelect: e.target.checked })}
            />
            <label htmlFor="multiSelect" className="text-sm">Multi-select</label>
          </div>
        </div>

        {/* Search and filter */}
        {selectionMode.mode === 'zones' && (
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Search zones..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 px-3 py-2 border rounded"
            />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-3 py-2 border rounded"
            >
              <option value="all">All Types</option>
              <option value="text">Text</option>
              <option value="table">Table</option>
              <option value="image">Image</option>
              <option value="diagram">Diagram</option>
            </select>
          </div>
        )}
      </div>

      {/* Quick actions */}
      <div className="px-4 py-2 border-b bg-gray-50">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={selectAll}
            className="px-3 py-1 text-sm bg-gray-200 rounded hover:bg-gray-300"
          >
            Select All
          </button>
          <button
            onClick={selectNone}
            className="px-3 py-1 text-sm bg-gray-200 rounded hover:bg-gray-300"
          >
            Select None
          </button>
          <button
            onClick={invertSelection}
            className="px-3 py-1 text-sm bg-gray-200 rounded hover:bg-gray-300"
          >
            Invert
          </button>
          <button
            onClick={() => selectByConfidence(0.5)}
            className="px-3 py-1 text-sm bg-yellow-200 rounded hover:bg-yellow-300"
          >
            Low Confidence
          </button>
        </div>
      </div>

      {/* Selection content */}
      <div className="flex-1 overflow-y-auto p-4">
        {selectionMode.mode === 'zones' ? (
          <div className="space-y-1">
            {filteredZones.map((zone, index) => (
              <div
                key={zone.id}
                onClick={(e) => handleZoneClick(zone, index, e)}
                className={`p-3 border rounded cursor-pointer transition-colors ${
                  selectedZones.has(zone.id)
                    ? 'bg-blue-100 border-blue-500'
                    : 'hover:bg-gray-50'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 text-xs rounded ${
                        zone.type === 'text' ? 'bg-gray-200' :
                        zone.type === 'table' ? 'bg-green-200' :
                        zone.type === 'image' ? 'bg-purple-200' :
                        'bg-orange-200'
                      }`}>
                        {zone.type}
                      </span>
                      <span className="text-sm text-gray-600">
                        Page {zone.pageNumber || 'Unknown'}
                      </span>
                      {zone.confidence !== undefined && (
                        <span className={`text-sm ${
                          zone.confidence >= 0.8 ? 'text-green-600' :
                          zone.confidence >= 0.5 ? 'text-yellow-600' :
                          'text-red-600'
                        }`}>
                          {Math.round(zone.confidence * 100)}%
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-gray-700 truncate">
                      {zone.content || 'No content preview'}
                    </p>
                  </div>
                  {selectedZones.has(zone.id) && (
                    <div className="ml-2 text-blue-500">
                      ✓
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-2">
            {pages.map((pageNumber) => {
              const pageZones = zonesByPage.get(pageNumber) || [];
              const isSelected = selectedPages.has(pageNumber);
              
              return (
                <div
                  key={pageNumber}
                  onClick={() => handlePageClick(pageNumber)}
                  className={`p-4 border rounded cursor-pointer text-center transition-colors ${
                    isSelected
                      ? 'bg-blue-100 border-blue-500'
                      : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="font-semibold">Page {pageNumber}</div>
                  <div className="text-sm text-gray-600 mt-1">
                    {pageZones.length} zones
                  </div>
                  {isSelected && (
                    <div className="mt-2 text-blue-500">✓</div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Selection summary */}
      <div className="p-4 border-t bg-gray-50">
        <div className="text-sm">
          <div className="font-semibold mb-1">Selection Summary</div>
          <div className="grid grid-cols-2 gap-2 text-gray-600">
            <div>Zones: {selectionStats.selectedZones} / {selectionStats.totalZones}</div>
            <div>Pages: {selectionStats.selectedPages} / {selectionStats.totalPages}</div>
            <div className="col-span-2">
              Estimated size: {Math.round(selectionStats.estimatedSize / 1024)} KB
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};