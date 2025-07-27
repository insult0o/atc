'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Zone, ZoneCoordinates } from './ZoneManager';

export interface ZoneCreatorProps {
  containerRef: React.RefObject<HTMLElement>;
  currentPage: number;
  existingZones: Zone[];
  onZoneCreate: (zone: Partial<Zone>) => void;
  scale?: number;
  disabled?: boolean;
}

interface DragState {
  isCreating: boolean;
  startPoint: { x: number; y: number } | null;
  currentPoint: { x: number; y: number } | null;
  isDragging: boolean;
}

interface PreviewZone {
  coordinates: ZoneCoordinates;
  type: Zone['contentType'];
  isValid: boolean;
  overlappingZones: string[];
}

const MIN_ZONE_SIZE = 20; // Minimum width/height in pixels
const OVERLAP_THRESHOLD = 0.3; // 30% overlap threshold

export function ZoneCreator({
  containerRef,
  currentPage,
  existingZones,
  onZoneCreate,
  scale = 1,
  disabled = false
}: ZoneCreatorProps) {
  const [dragState, setDragState] = useState<DragState>({
    isCreating: false,
    startPoint: null,
    currentPoint: null,
    isDragging: false
  });

  const [previewZone, setPreviewZone] = useState<PreviewZone | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();

  // Filter zones for current page
  const currentPageZones = existingZones.filter(zone => zone.pageNumber === currentPage);

  // Update canvas size to match container
  useEffect(() => {
    if (!containerRef.current || !canvasRef.current) return;

    const updateCanvasSize = () => {
      const container = containerRef.current;
      const canvas = canvasRef.current;
      
      if (container && canvas) {
        canvas.width = container.clientWidth;
        canvas.height = container.clientHeight;
      }
    };

    updateCanvasSize();
    
    const resizeObserver = new ResizeObserver(updateCanvasSize);
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, [containerRef]);

  // Calculate zone coordinates from drag points
  const calculateZoneCoordinates = (start: { x: number; y: number }, end: { x: number; y: number }): ZoneCoordinates => {
    const x = Math.min(start.x, end.x);
    const y = Math.min(start.y, end.y);
    const width = Math.abs(end.x - start.x);
    const height = Math.abs(end.y - start.y);

    return { x, y, width, height };
  };

  // Detect content type based on zone dimensions and position
  const detectContentType = (coordinates: ZoneCoordinates): Zone['contentType'] => {
    const { width, height, y } = coordinates;
    const aspectRatio = width / height;

    // Table detection - wide and not too tall
    if (aspectRatio > 2 && height < 200) {
      return 'table';
    }

    // Header detection - top of page, wide
    if (y < 100 && aspectRatio > 3) {
      return 'header';
    }

    // Footer detection - bottom of page, wide
    const containerHeight = containerRef.current?.clientHeight || 800;
    if (y > containerHeight - 150 && aspectRatio > 3) {
      return 'footer';
    }

    // Diagram detection - roughly square
    if (aspectRatio > 0.7 && aspectRatio < 1.3 && width > 100) {
      return 'diagram';
    }

    // Default to text for most content
    return 'text';
  };

  // Check for zone overlaps
  const checkOverlaps = (newZone: ZoneCoordinates): string[] => {
    const overlapping: string[] = [];

    currentPageZones.forEach(zone => {
      const overlap = calculateOverlapPercentage(newZone, zone.coordinates);
      if (overlap > OVERLAP_THRESHOLD) {
        overlapping.push(zone.id);
      }
    });

    return overlapping;
  };

  // Calculate overlap percentage between two zones
  const calculateOverlapPercentage = (zone1: ZoneCoordinates, zone2: ZoneCoordinates): number => {
    const x1 = Math.max(zone1.x, zone2.x);
    const y1 = Math.max(zone1.y, zone2.y);
    const x2 = Math.min(zone1.x + zone1.width, zone2.x + zone2.width);
    const y2 = Math.min(zone1.y + zone1.height, zone2.y + zone2.height);

    if (x1 >= x2 || y1 >= y2) {
      return 0; // No overlap
    }

    const overlapArea = (x2 - x1) * (y2 - y1);
    const zone1Area = zone1.width * zone1.height;
    const zone2Area = zone2.width * zone2.height;
    const minArea = Math.min(zone1Area, zone2Area);

    return overlapArea / minArea;
  };

  // Validate zone size
  const isValidSize = (coordinates: ZoneCoordinates): boolean => {
    return coordinates.width >= MIN_ZONE_SIZE && coordinates.height >= MIN_ZONE_SIZE;
  };

  // Draw preview on canvas
  const drawPreview = useCallback(() => {
    if (!canvasRef.current || !dragState.startPoint || !dragState.currentPoint) return;

    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);

    const coordinates = calculateZoneCoordinates(
      { x: dragState.startPoint.x * scale, y: dragState.startPoint.y * scale },
      { x: dragState.currentPoint.x * scale, y: dragState.currentPoint.y * scale }
    );

    const isValid = isValidSize(coordinates);
    const overlaps = checkOverlaps(coordinates);
    const contentType = detectContentType(coordinates);

    // Update preview zone
    setPreviewZone({
      coordinates,
      type: contentType,
      isValid: isValid && overlaps.length === 0,
      overlappingZones: overlaps
    });

    // Set styles based on validity
    if (!isValid) {
      // Too small
      ctx.strokeStyle = '#ef4444'; // red
      ctx.fillStyle = 'rgba(239, 68, 68, 0.1)';
      ctx.setLineDash([5, 5]);
    } else if (overlaps.length > 0) {
      // Overlapping
      ctx.strokeStyle = '#f59e0b'; // amber
      ctx.fillStyle = 'rgba(245, 158, 11, 0.1)';
      ctx.setLineDash([5, 5]);
    } else {
      // Valid
      ctx.strokeStyle = '#10b981'; // green
      ctx.fillStyle = 'rgba(16, 185, 129, 0.1)';
      ctx.setLineDash([]);
    }

    ctx.lineWidth = 2;

    // Draw rectangle
    ctx.beginPath();
    ctx.rect(coordinates.x, coordinates.y, coordinates.width, coordinates.height);
    ctx.fill();
    ctx.stroke();

    // Draw size info
    if (dragState.isDragging) {
      ctx.fillStyle = '#000000';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const centerX = coordinates.x + coordinates.width / 2;
      const centerY = coordinates.y + coordinates.height / 2;

      // Background for text
      const text = `${Math.round(coordinates.width)}×${Math.round(coordinates.height)}`;
      const metrics = ctx.measureText(text);
      const padding = 4;

      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.fillRect(
        centerX - metrics.width / 2 - padding,
        centerY - 8 - padding,
        metrics.width + padding * 2,
        16 + padding * 2
      );

      // Text
      ctx.fillStyle = '#000000';
      ctx.fillText(text, centerX, centerY);

      // Type indicator
      const typeText = contentType.toUpperCase();
      ctx.font = '10px sans-serif';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      const typeMetrics = ctx.measureText(typeText);
      ctx.fillRect(
        coordinates.x + 2,
        coordinates.y + 2,
        typeMetrics.width + 8,
        14
      );
      ctx.fillStyle = '#000000';
      ctx.fillText(typeText, coordinates.x + 6, coordinates.y + 9);
    }

    // Draw overlap indicators
    if (overlaps.length > 0) {
      ctx.fillStyle = '#f59e0b';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`⚠ Overlaps with ${overlaps.length} zone(s)`, coordinates.x, coordinates.y - 5);
    }

    // Schedule next frame
    animationRef.current = requestAnimationFrame(drawPreview);
  }, [dragState, scale, currentPageZones]);

  // Start creating zone
  const handleMouseDown = useCallback((event: MouseEvent) => {
    if (disabled || !containerRef.current) return;

    // Only start on left click
    if (event.button !== 0) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = (event.clientX - rect.left) / scale;
    const y = (event.clientY - rect.top) / scale;

    setDragState({
      isCreating: true,
      startPoint: { x, y },
      currentPoint: { x, y },
      isDragging: false
    });

    event.preventDefault();
  }, [disabled, scale, containerRef]);

  // Update drag position
  const handleMouseMove = useCallback((event: MouseEvent) => {
    if (!dragState.isCreating || !dragState.startPoint || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = (event.clientX - rect.left) / scale;
    const y = (event.clientY - rect.top) / scale;

    setDragState(prev => ({
      ...prev,
      currentPoint: { x, y },
      isDragging: true
    }));
  }, [dragState.isCreating, dragState.startPoint, scale, containerRef]);

  // Complete zone creation
  const handleMouseUp = useCallback((event: MouseEvent) => {
    if (!dragState.isCreating || !dragState.startPoint || !dragState.currentPoint) return;

    const coordinates = calculateZoneCoordinates(dragState.startPoint, dragState.currentPoint);

    if (isValidSize(coordinates)) {
      const overlaps = checkOverlaps(coordinates);
      
      if (overlaps.length === 0 || window.confirm(`This zone overlaps with ${overlaps.length} existing zone(s). Create anyway?`)) {
        const newZone: Partial<Zone> = {
          coordinates,
          contentType: detectContentType(coordinates),
          confidence: 0.8,
          pageNumber: currentPage,
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
            readingOrder: currentPageZones.length + 1
          },
          fallbackTools: []
        };

        onZoneCreate(newZone);
      }
    }

    // Reset state
    setDragState({
      isCreating: false,
      startPoint: null,
      currentPoint: null,
      isDragging: false
    });
    setPreviewZone(null);

    // Clear canvas
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
  }, [dragState, scale, currentPage, currentPageZones, onZoneCreate]);

  // Add event listeners
  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    container.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      container.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseDown, handleMouseMove, handleMouseUp]);

  // Handle drawing animation
  useEffect(() => {
    if (dragState.isDragging) {
      drawPreview();
    } else if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [dragState.isDragging, drawPreview]);

  // Update cursor style
  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    if (disabled) {
      container.style.cursor = 'not-allowed';
    } else if (dragState.isCreating) {
      container.style.cursor = 'crosshair';
    } else {
      container.style.cursor = 'crosshair';
    }
  }, [disabled, dragState.isCreating, containerRef]);

  return (
    <>
      <canvas
        ref={canvasRef}
        className="absolute inset-0 pointer-events-none z-10"
        style={{ mixBlendMode: 'multiply' }}
        data-testid="zone-creator-canvas"
      />
      
      {/* Status indicator */}
      {dragState.isCreating && (
        <div 
          className="absolute top-4 left-4 bg-green-600 text-white px-3 py-1 rounded-full text-sm font-medium shadow-lg z-20"
          data-testid="zone-creator-status"
        >
          {dragState.isDragging ? 'Drawing zone...' : 'Click and drag to create zone'}
        </div>
      )}

      {/* Preview info */}
      {previewZone && dragState.isDragging && (
        <div 
          className={`absolute bottom-4 left-4 px-3 py-2 rounded-lg text-sm font-medium shadow-lg z-20 ${
            previewZone.isValid ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
          }`}
          data-testid="zone-creator-preview"
        >
          <div>Type: {previewZone.type}</div>
          <div>Size: {Math.round(previewZone.coordinates.width)}×{Math.round(previewZone.coordinates.height)}</div>
          {!previewZone.isValid && (
            <div className="text-xs mt-1">
              {previewZone.coordinates.width < MIN_ZONE_SIZE || previewZone.coordinates.height < MIN_ZONE_SIZE
                ? 'Zone too small'
                : `Overlaps with ${previewZone.overlappingZones.length} zone(s)`}
            </div>
          )}
        </div>
      )}

      {/* Instructions */}
      {!dragState.isCreating && !disabled && (
        <div className="absolute top-4 right-4 bg-gray-800 text-white px-3 py-1 rounded text-xs opacity-75 z-20">
          Click and drag to create a new zone
        </div>
      )}
    </>
  );
}

export default ZoneCreator;