'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Zone } from './ZoneManager';

export interface ZoneSelectorProps {
  zones: Zone[];
  selectedZones: Set<string>;
  currentPage: number;
  onZoneSelect: (zoneId: string | null) => void;
  onMultiSelect: (zoneIds: Set<string>) => void;
  onZoneHover?: (zoneId: string | null) => void;
  disabled?: boolean;
}

interface SelectionState {
  lastSelectedZone: string | null;
  shiftStartZone: string | null;
  hoveredZone: string | null;
  isMultiSelecting: boolean;
  keyboardNavigationIndex: number;
}

export function ZoneSelector({
  zones,
  selectedZones,
  currentPage,
  onZoneSelect,
  onMultiSelect,
  onZoneHover,
  disabled = false
}: ZoneSelectorProps) {
  const [selectionState, setSelectionState] = useState<SelectionState>({
    lastSelectedZone: null,
    shiftStartZone: null,
    hoveredZone: null,
    isMultiSelecting: false,
    keyboardNavigationIndex: -1
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const zoneRefs = useRef<Map<string, HTMLElement>>(new Map());

  // Filter zones for current page
  const currentPageZones = zones.filter(zone => zone.pageNumber === currentPage);

  // Sort zones by reading order for keyboard navigation
  const sortedZones = [...currentPageZones].sort((a, b) => {
    // First by y position (top to bottom)
    const yDiff = a.coordinates.y - b.coordinates.y;
    if (Math.abs(yDiff) > 20) return yDiff;
    // Then by x position (left to right)
    return a.coordinates.x - b.coordinates.x;
  });

  // Handle single zone selection
  const handleZoneClick = useCallback((event: React.MouseEvent, zoneId: string) => {
    if (disabled) return;

    event.stopPropagation();

    const isCtrlOrCmd = event.ctrlKey || event.metaKey;
    const isShift = event.shiftKey;

    if (isCtrlOrCmd) {
      // Toggle selection for multi-select
      const newSelection = new Set(selectedZones);
      if (newSelection.has(zoneId)) {
        newSelection.delete(zoneId);
        if (newSelection.size === 0) {
          onZoneSelect(null);
        }
      } else {
        newSelection.add(zoneId);
      }
      onMultiSelect(newSelection);
      setSelectionState(prev => ({
        ...prev,
        lastSelectedZone: zoneId,
        shiftStartZone: zoneId
      }));
    } else if (isShift && selectionState.lastSelectedZone) {
      // Range selection
      const newSelection = getRangeSelection(
        sortedZones,
        selectionState.lastSelectedZone,
        zoneId
      );
      onMultiSelect(newSelection);
    } else {
      // Single selection
      onZoneSelect(zoneId);
      onMultiSelect(new Set([zoneId]));
      setSelectionState(prev => ({
        ...prev,
        lastSelectedZone: zoneId,
        shiftStartZone: zoneId,
        keyboardNavigationIndex: sortedZones.findIndex(z => z.id === zoneId)
      }));
    }
  }, [disabled, selectedZones, sortedZones, selectionState.lastSelectedZone, onZoneSelect, onMultiSelect]);

  // Handle clicking on empty space to deselect
  const handleContainerClick = useCallback((event: React.MouseEvent) => {
    if (disabled) return;

    // Only deselect if clicking directly on container
    if (event.target === event.currentTarget) {
      onZoneSelect(null);
      onMultiSelect(new Set());
      setSelectionState(prev => ({
        ...prev,
        lastSelectedZone: null,
        shiftStartZone: null,
        keyboardNavigationIndex: -1
      }));
    }
  }, [disabled, onZoneSelect, onMultiSelect]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (disabled || sortedZones.length === 0) return;

    const { key, ctrlKey, metaKey, shiftKey } = event;
    const isCtrlOrCmd = ctrlKey || metaKey;

    switch (key) {
      case 'ArrowDown':
      case 'ArrowUp': {
        event.preventDefault();
        const direction = key === 'ArrowDown' ? 1 : -1;
        const currentIndex = selectionState.keyboardNavigationIndex;
        const newIndex = Math.max(0, Math.min(sortedZones.length - 1, currentIndex + direction));
        
        if (newIndex !== currentIndex) {
          const newZone = sortedZones[newIndex];
          
          if (shiftKey && selectionState.shiftStartZone) {
            // Extend selection
            const newSelection = getRangeSelection(
              sortedZones,
              selectionState.shiftStartZone,
              newZone.id
            );
            onMultiSelect(newSelection);
          } else {
            // Move selection
            onZoneSelect(newZone.id);
            onMultiSelect(new Set([newZone.id]));
            setSelectionState(prev => ({
              ...prev,
              shiftStartZone: newZone.id
            }));
          }
          
          setSelectionState(prev => ({
            ...prev,
            keyboardNavigationIndex: newIndex,
            lastSelectedZone: newZone.id
          }));

          // Scroll into view
          const zoneElement = zoneRefs.current.get(newZone.id);
          zoneElement?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
        break;
      }

      case 'ArrowLeft':
      case 'ArrowRight': {
        event.preventDefault();
        const currentIndex = selectionState.keyboardNavigationIndex;
        if (currentIndex === -1) break;

        const currentZone = sortedZones[currentIndex];
        const currentY = currentZone.coordinates.y;
        
        // Find zones on the same row
        const sameRowZones = sortedZones.filter(z => 
          Math.abs(z.coordinates.y - currentY) < 20
        );
        
        if (sameRowZones.length > 1) {
          const currentRowIndex = sameRowZones.findIndex(z => z.id === currentZone.id);
          const direction = key === 'ArrowRight' ? 1 : -1;
          const newRowIndex = Math.max(0, Math.min(sameRowZones.length - 1, currentRowIndex + direction));
          
          if (newRowIndex !== currentRowIndex) {
            const newZone = sameRowZones[newRowIndex];
            const newIndex = sortedZones.findIndex(z => z.id === newZone.id);
            
            onZoneSelect(newZone.id);
            onMultiSelect(new Set([newZone.id]));
            setSelectionState(prev => ({
              ...prev,
              keyboardNavigationIndex: newIndex,
              lastSelectedZone: newZone.id,
              shiftStartZone: newZone.id
            }));

            // Scroll into view
            const zoneElement = zoneRefs.current.get(newZone.id);
            zoneElement?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }
        }
        break;
      }

      case 'a':
      case 'A': {
        if (isCtrlOrCmd) {
          event.preventDefault();
          // Select all zones on current page
          const allZoneIds = new Set(currentPageZones.map(z => z.id));
          onMultiSelect(allZoneIds);
        }
        break;
      }

      case 'Escape': {
        // Clear selection
        onZoneSelect(null);
        onMultiSelect(new Set());
        setSelectionState(prev => ({
          ...prev,
          lastSelectedZone: null,
          shiftStartZone: null,
          keyboardNavigationIndex: -1
        }));
        break;
      }

      case ' ': {
        if (selectionState.keyboardNavigationIndex >= 0) {
          event.preventDefault();
          const currentZone = sortedZones[selectionState.keyboardNavigationIndex];
          
          if (isCtrlOrCmd) {
            // Toggle selection
            const newSelection = new Set(selectedZones);
            if (newSelection.has(currentZone.id)) {
              newSelection.delete(currentZone.id);
            } else {
              newSelection.add(currentZone.id);
            }
            onMultiSelect(newSelection);
          }
        }
        break;
      }
    }
  }, [disabled, sortedZones, currentPageZones, selectionState, selectedZones, onZoneSelect, onMultiSelect]);

  // Get selection range between two zones
  const getRangeSelection = (zones: Zone[], startId: string, endId: string): Set<string> => {
    const startIndex = zones.findIndex(z => z.id === startId);
    const endIndex = zones.findIndex(z => z.id === endId);
    
    if (startIndex === -1 || endIndex === -1) {
      return new Set([endId]);
    }

    const minIndex = Math.min(startIndex, endIndex);
    const maxIndex = Math.max(startIndex, endIndex);
    
    const rangeZones = zones.slice(minIndex, maxIndex + 1);
    return new Set(rangeZones.map(z => z.id));
  };

  // Handle hover
  const handleZoneHover = useCallback((zoneId: string | null) => {
    if (disabled) return;
    
    setSelectionState(prev => ({
      ...prev,
      hoveredZone: zoneId
    }));
    
    onZoneHover?.(zoneId);
  }, [disabled, onZoneHover]);

  // Add keyboard event listeners
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      if (containerRef.current) {
        containerRef.current.removeEventListener('keydown', handleKeyDown);
      }
    };
  }, [handleKeyDown]);

  // Focus container when selection changes
  useEffect(() => {
    if (selectedZones.size > 0 && containerRef.current) {
      containerRef.current.focus();
    }
  }, [selectedZones.size]);

  return (
    <div
      ref={containerRef}
      className="zone-selector relative w-full h-full"
      onClick={handleContainerClick}
      tabIndex={0}
      role="listbox"
      aria-label="Zone selection"
      aria-multiselectable="true"
    >
      {currentPageZones.map((zone, index) => {
        const isSelected = selectedZones.has(zone.id);
        const isHovered = selectionState.hoveredZone === zone.id;
        const isFocused = selectionState.keyboardNavigationIndex === sortedZones.findIndex(z => z.id === zone.id);

        return (
          <div
            key={zone.id}
            ref={(el) => {
              if (el) zoneRefs.current.set(zone.id, el);
              else zoneRefs.current.delete(zone.id);
            }}
            className={`
              zone-selectable absolute cursor-pointer transition-all duration-150
              ${isSelected ? 'ring-2 ring-blue-500 bg-blue-50/50' : ''}
              ${isHovered && !isSelected ? 'ring-1 ring-blue-300 bg-blue-50/25' : ''}
              ${isFocused ? 'ring-2 ring-offset-2 ring-blue-600' : ''}
              ${disabled ? 'pointer-events-none opacity-50' : ''}
            `}
            style={{
              left: `${zone.coordinates.x}px`,
              top: `${zone.coordinates.y}px`,
              width: `${zone.coordinates.width}px`,
              height: `${zone.coordinates.height}px`
            }}
            onClick={(e) => handleZoneClick(e, zone.id)}
            onMouseEnter={() => handleZoneHover(zone.id)}
            onMouseLeave={() => handleZoneHover(null)}
            role="option"
            aria-selected={isSelected}
            aria-label={`Zone ${zone.id} - ${zone.contentType}`}
            data-zone-id={zone.id}
            data-zone-type={zone.contentType}
          >
            {/* Zone selection indicator */}
            {isSelected && (
              <div className="absolute -top-2 -left-2 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                <span className="text-white text-xs font-bold">
                  {Array.from(selectedZones).indexOf(zone.id) + 1}
                </span>
              </div>
            )}
            
            {/* Zone type badge */}
            <div className={`
              absolute top-1 right-1 px-2 py-0.5 rounded text-xs font-medium
              ${isSelected ? 'bg-blue-600 text-white' : 'bg-gray-700 text-white opacity-75'}
            `}>
              {zone.contentType}
            </div>

            {/* Confidence indicator */}
            {zone.confidence < 0.8 && (
              <div className="absolute bottom-1 right-1 flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-yellow-500" />
                <span className="text-xs text-gray-600">
                  {Math.round(zone.confidence * 100)}%
                </span>
              </div>
            )}
          </div>
        );
      })}

      {/* Selection info */}
      {selectedZones.size > 1 && (
        <div className="absolute bottom-4 left-4 bg-blue-600 text-white px-3 py-1 rounded-full text-sm font-medium shadow-lg">
          {selectedZones.size} zones selected
        </div>
      )}

      {/* Keyboard navigation hint */}
      {selectionState.keyboardNavigationIndex >= 0 && (
        <div className="absolute top-4 right-4 bg-gray-800 text-white px-3 py-1 rounded text-xs">
          Use arrow keys to navigate • Space to toggle • Ctrl+A to select all
        </div>
      )}
    </div>
  );
}

export default ZoneSelector;