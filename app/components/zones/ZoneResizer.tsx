'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Zone, ZoneCoordinates } from './ZoneManager';

export interface ZoneResizerProps {
  zone: Zone;
  containerRef: React.RefObject<HTMLElement>;
  existingZones: Zone[];
  onZoneUpdate: (zoneId: string, updates: Partial<Zone>) => void;
  scale?: number;
  snapToGrid?: boolean;
  gridSize?: number;
  disabled?: boolean;
}

type ResizeHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

interface ResizeState {
  isResizing: boolean;
  activeHandle: ResizeHandle | null;
  startCoordinates: ZoneCoordinates;
  startMousePos: { x: number; y: number };
  previewCoordinates: ZoneCoordinates | null;
}

interface SnapGuide {
  type: 'vertical' | 'horizontal';
  position: number;
  targetZone?: string;
}

const HANDLE_SIZE = 8;
const SNAP_THRESHOLD = 10;
const MIN_ZONE_SIZE = 20;
const ARROW_KEY_STEP = 5;
const SHIFT_MULTIPLIER = 10;

export function ZoneResizer({
  zone,
  containerRef,
  existingZones,
  onZoneUpdate,
  scale = 1,
  snapToGrid = true,
  gridSize = 10,
  disabled = false
}: ZoneResizerProps) {
  const [resizeState, setResizeState] = useState<ResizeState>({
    isResizing: false,
    activeHandle: null,
    startCoordinates: zone.coordinates,
    startMousePos: { x: 0, y: 0 },
    previewCoordinates: null
  });

  const [snapGuides, setSnapGuides] = useState<SnapGuide[]>([]);
  const [hoveredHandle, setHoveredHandle] = useState<ResizeHandle | null>(null);
  const zoneRef = useRef<HTMLDivElement>(null);

  // Get other zones on the same page for snapping
  const otherZones = existingZones.filter(z => 
    z.id !== zone.id && z.pageNumber === zone.pageNumber
  );

  // Get resize handles configuration
  const getHandles = (): Array<{ type: ResizeHandle; cursor: string; position: { x: number; y: number } }> => {
    const coords = resizeState.previewCoordinates || zone.coordinates;
    const halfSize = HANDLE_SIZE / 2;

    return [
      { type: 'nw', cursor: 'nw-resize', position: { x: -halfSize, y: -halfSize } },
      { type: 'n', cursor: 'n-resize', position: { x: coords.width / 2 - halfSize, y: -halfSize } },
      { type: 'ne', cursor: 'ne-resize', position: { x: coords.width - halfSize, y: -halfSize } },
      { type: 'e', cursor: 'e-resize', position: { x: coords.width - halfSize, y: coords.height / 2 - halfSize } },
      { type: 'se', cursor: 'se-resize', position: { x: coords.width - halfSize, y: coords.height - halfSize } },
      { type: 's', cursor: 's-resize', position: { x: coords.width / 2 - halfSize, y: coords.height - halfSize } },
      { type: 'sw', cursor: 'sw-resize', position: { x: -halfSize, y: coords.height - halfSize } },
      { type: 'w', cursor: 'w-resize', position: { x: -halfSize, y: coords.height / 2 - halfSize } }
    ];
  };

  // Snap value to grid
  const snapToGridValue = (value: number): number => {
    if (!snapToGrid) return value;
    return Math.round(value / gridSize) * gridSize;
  };

  // Find snap points from other zones
  const findSnapPoints = (coordinates: ZoneCoordinates): { snappedCoords: ZoneCoordinates; guides: SnapGuide[] } => {
    const guides: SnapGuide[] = [];
    let snappedX = coordinates.x;
    let snappedY = coordinates.y;
    let snappedWidth = coordinates.width;
    let snappedHeight = coordinates.height;

    const right = coordinates.x + coordinates.width;
    const bottom = coordinates.y + coordinates.height;

    otherZones.forEach(otherZone => {
      const otherCoords = otherZone.coordinates;
      const otherRight = otherCoords.x + otherCoords.width;
      const otherBottom = otherCoords.y + otherCoords.height;

      // Left edge snapping
      if (Math.abs(coordinates.x - otherCoords.x) < SNAP_THRESHOLD) {
        snappedX = otherCoords.x;
        guides.push({ type: 'vertical', position: otherCoords.x, targetZone: otherZone.id });
      } else if (Math.abs(coordinates.x - otherRight) < SNAP_THRESHOLD) {
        snappedX = otherRight;
        guides.push({ type: 'vertical', position: otherRight, targetZone: otherZone.id });
      }

      // Right edge snapping
      if (Math.abs(right - otherCoords.x) < SNAP_THRESHOLD) {
        snappedWidth = otherCoords.x - snappedX;
        guides.push({ type: 'vertical', position: otherCoords.x, targetZone: otherZone.id });
      } else if (Math.abs(right - otherRight) < SNAP_THRESHOLD) {
        snappedWidth = otherRight - snappedX;
        guides.push({ type: 'vertical', position: otherRight, targetZone: otherZone.id });
      }

      // Top edge snapping
      if (Math.abs(coordinates.y - otherCoords.y) < SNAP_THRESHOLD) {
        snappedY = otherCoords.y;
        guides.push({ type: 'horizontal', position: otherCoords.y, targetZone: otherZone.id });
      } else if (Math.abs(coordinates.y - otherBottom) < SNAP_THRESHOLD) {
        snappedY = otherBottom;
        guides.push({ type: 'horizontal', position: otherBottom, targetZone: otherZone.id });
      }

      // Bottom edge snapping
      if (Math.abs(bottom - otherCoords.y) < SNAP_THRESHOLD) {
        snappedHeight = otherCoords.y - snappedY;
        guides.push({ type: 'horizontal', position: otherCoords.y, targetZone: otherZone.id });
      } else if (Math.abs(bottom - otherBottom) < SNAP_THRESHOLD) {
        snappedHeight = otherBottom - snappedY;
        guides.push({ type: 'horizontal', position: otherBottom, targetZone: otherZone.id });
      }
    });

    // Apply grid snapping after zone snapping
    if (snapToGrid && guides.length === 0) {
      snappedX = snapToGridValue(snappedX);
      snappedY = snapToGridValue(snappedY);
      snappedWidth = snapToGridValue(snappedWidth);
      snappedHeight = snapToGridValue(snappedHeight);
    }

    return {
      snappedCoords: {
        x: snappedX,
        y: snappedY,
        width: snappedWidth,
        height: snappedHeight
      },
      guides
    };
  };

  // Calculate new coordinates based on resize handle
  const calculateNewCoordinates = (
    handle: ResizeHandle,
    deltaX: number,
    deltaY: number,
    startCoords: ZoneCoordinates
  ): ZoneCoordinates => {
    let { x, y, width, height } = startCoords;

    switch (handle) {
      case 'nw':
        x += deltaX;
        y += deltaY;
        width -= deltaX;
        height -= deltaY;
        break;
      case 'n':
        y += deltaY;
        height -= deltaY;
        break;
      case 'ne':
        y += deltaY;
        width += deltaX;
        height -= deltaY;
        break;
      case 'e':
        width += deltaX;
        break;
      case 'se':
        width += deltaX;
        height += deltaY;
        break;
      case 's':
        height += deltaY;
        break;
      case 'sw':
        x += deltaX;
        width -= deltaX;
        height += deltaY;
        break;
      case 'w':
        x += deltaX;
        width -= deltaX;
        break;
    }

    // Ensure minimum size
    if (width < MIN_ZONE_SIZE) {
      if (handle.includes('w')) {
        x = startCoords.x + startCoords.width - MIN_ZONE_SIZE;
      }
      width = MIN_ZONE_SIZE;
    }

    if (height < MIN_ZONE_SIZE) {
      if (handle.includes('n')) {
        y = startCoords.y + startCoords.height - MIN_ZONE_SIZE;
      }
      height = MIN_ZONE_SIZE;
    }

    return { x, y, width, height };
  };

  // Handle resize start
  const handleResizeStart = useCallback((event: React.MouseEvent, handle: ResizeHandle) => {
    if (disabled) return;

    event.stopPropagation();
    event.preventDefault();

    setResizeState({
      isResizing: true,
      activeHandle: handle,
      startCoordinates: zone.coordinates,
      startMousePos: { x: event.clientX, y: event.clientY },
      previewCoordinates: zone.coordinates
    });
  }, [disabled, zone.coordinates]);

  // Handle resize move
  const handleMouseMove = useCallback((event: MouseEvent) => {
    if (!resizeState.isResizing || !resizeState.activeHandle) return;

    const deltaX = (event.clientX - resizeState.startMousePos.x) / scale;
    const deltaY = (event.clientY - resizeState.startMousePos.y) / scale;

    const newCoords = calculateNewCoordinates(
      resizeState.activeHandle,
      deltaX,
      deltaY,
      resizeState.startCoordinates
    );

    const { snappedCoords, guides } = findSnapPoints(newCoords);

    setResizeState(prev => ({
      ...prev,
      previewCoordinates: snappedCoords
    }));

    setSnapGuides(guides);
  }, [resizeState, scale, otherZones]);

  // Handle resize end
  const handleMouseUp = useCallback(() => {
    if (!resizeState.isResizing || !resizeState.previewCoordinates) return;

    // Apply the resize
    onZoneUpdate(zone.id, {
      coordinates: resizeState.previewCoordinates,
      userModified: true,
      lastModified: new Date()
    });

    // Reset state
    setResizeState({
      isResizing: false,
      activeHandle: null,
      startCoordinates: zone.coordinates,
      startMousePos: { x: 0, y: 0 },
      previewCoordinates: null
    });

    setSnapGuides([]);
  }, [resizeState, zone.id, onZoneUpdate]);

  // Handle keyboard resize
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (disabled || !zoneRef.current || document.activeElement !== zoneRef.current) return;

    const step = event.shiftKey ? ARROW_KEY_STEP * SHIFT_MULTIPLIER : ARROW_KEY_STEP;
    let newCoords = { ...zone.coordinates };
    let updated = false;

    switch (event.key) {
      case 'ArrowLeft':
        if (event.altKey) {
          newCoords.width = Math.max(MIN_ZONE_SIZE, newCoords.width - step);
        } else {
          newCoords.x -= step;
        }
        updated = true;
        break;
      case 'ArrowRight':
        if (event.altKey) {
          newCoords.width += step;
        } else {
          newCoords.x += step;
        }
        updated = true;
        break;
      case 'ArrowUp':
        if (event.altKey) {
          newCoords.height = Math.max(MIN_ZONE_SIZE, newCoords.height - step);
        } else {
          newCoords.y -= step;
        }
        updated = true;
        break;
      case 'ArrowDown':
        if (event.altKey) {
          newCoords.height += step;
        } else {
          newCoords.y += step;
        }
        updated = true;
        break;
    }

    if (updated) {
      event.preventDefault();
      
      // Apply snapping
      if (snapToGrid) {
        newCoords = {
          x: snapToGridValue(newCoords.x),
          y: snapToGridValue(newCoords.y),
          width: snapToGridValue(newCoords.width),
          height: snapToGridValue(newCoords.height)
        };
      }

      onZoneUpdate(zone.id, {
        coordinates: newCoords,
        userModified: true,
        lastModified: new Date()
      });
    }
  }, [disabled, zone, snapToGrid, gridSize, onZoneUpdate]);

  // Add event listeners
  useEffect(() => {
    if (resizeState.isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = resizeState.activeHandle ? 
        `${resizeState.activeHandle}-resize` : 'default';
      document.body.style.userSelect = 'none';

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };
    }
  }, [resizeState.isResizing, resizeState.activeHandle, handleMouseMove, handleMouseUp]);

  // Add keyboard listeners
  useEffect(() => {
    const element = zoneRef.current;
    if (element) {
      element.addEventListener('keydown', handleKeyDown);
      return () => {
        element.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [handleKeyDown]);

  const displayCoords = resizeState.previewCoordinates || zone.coordinates;

  return (
    <div
      ref={zoneRef}
      className="zone-resizer absolute group"
      style={{
        left: `${displayCoords.x * scale}px`,
        top: `${displayCoords.y * scale}px`,
        width: `${displayCoords.width * scale}px`,
        height: `${displayCoords.height * scale}px`
      }}
      tabIndex={0}
      role="application"
      aria-label={`Zone ${zone.id} resizer`}
    >
      {/* Zone outline */}
      <div className={`absolute inset-0 border-2 ${
        resizeState.isResizing ? 'border-blue-500' : 'border-blue-400'
      } pointer-events-none`} />

      {/* Resize handles */}
      {!disabled && getHandles().map(({ type, cursor, position }) => (
        <div
          key={type}
          className={`absolute bg-blue-500 border border-white transition-all ${
            hoveredHandle === type || resizeState.activeHandle === type
              ? 'w-3 h-3' 
              : 'w-2 h-2 opacity-0 group-hover:opacity-100'
          }`}
          style={{
            left: `${position.x * scale}px`,
            top: `${position.y * scale}px`,
            cursor,
            width: `${HANDLE_SIZE}px`,
            height: `${HANDLE_SIZE}px`
          }}
          onMouseDown={(e) => handleResizeStart(e, type)}
          onMouseEnter={() => setHoveredHandle(type)}
          onMouseLeave={() => setHoveredHandle(null)}
          role="button"
          aria-label={`Resize ${type}`}
        />
      ))}

      {/* Size indicator */}
      {(resizeState.isResizing || hoveredHandle) && (
        <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
          {Math.round(displayCoords.width)}×{Math.round(displayCoords.height)}
        </div>
      )}

      {/* Snap guides */}
      {snapGuides.map((guide, index) => (
        <div
          key={index}
          className="absolute bg-blue-500 opacity-50 pointer-events-none"
          style={guide.type === 'vertical' ? {
            left: `${(guide.position - displayCoords.x) * scale}px`,
            top: '-1000px',
            width: '1px',
            height: '2000px'
          } : {
            left: '-1000px',
            top: `${(guide.position - displayCoords.y) * scale}px`,
            width: '2000px',
            height: '1px'
          }}
        />
      ))}

      {/* Keyboard hint */}
      {document.activeElement === zoneRef.current && (
        <div className="absolute -top-8 left-0 bg-gray-800 text-white text-xs px-2 py-1 rounded">
          Arrow keys: move • Alt+Arrow: resize • Shift: ×10
        </div>
      )}
    </div>
  );
}

export default ZoneResizer;