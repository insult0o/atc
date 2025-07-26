'use client';

import React, { useRef, useEffect, useCallback, useState } from 'react';
import type { Zone } from '@pdf-platform/shared';

interface ZoneHighlighterProps {
  zones: Zone[];
  selectedZone: string | null;
  visible: boolean;
  onZoneClick?: (zoneId: string) => void;
  scale?: number;
  pageNumber?: number;
}

interface HighlightStyle {
  fillColor: string;
  strokeColor: string;
  strokeWidth: number;
  opacity: number;
}

const ZONE_COLORS = {
  text: { fill: 'rgba(34, 197, 94, 0.2)', stroke: '#22c55e' },
  table: { fill: 'rgba(168, 85, 247, 0.2)', stroke: '#a855f7' },
  diagram: { fill: 'rgba(249, 115, 22, 0.2)', stroke: '#f97316' },
  image: { fill: 'rgba(59, 130, 246, 0.2)', stroke: '#3b82f6' },
  mixed: { fill: 'rgba(156, 163, 175, 0.2)', stroke: '#9ca3af' },
  header: { fill: 'rgba(59, 130, 246, 0.2)', stroke: '#3b82f6' },
  footer: { fill: 'rgba(239, 68, 68, 0.2)', stroke: '#ef4444' }
};

const SELECTED_STYLE: HighlightStyle = {
  fillColor: 'rgba(59, 130, 246, 0.3)',
  strokeColor: '#3b82f6',
  strokeWidth: 3,
  opacity: 1
};

const LOW_CONFIDENCE_STYLE: HighlightStyle = {
  fillColor: 'rgba(239, 68, 68, 0.2)',
  strokeColor: '#ef4444',
  strokeWidth: 2,
  opacity: 0.8
};

export function ZoneHighlighter({
  zones,
  selectedZone,
  visible,
  onZoneClick,
  scale = 1,
  pageNumber
}: ZoneHighlighterProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hoveredZone, setHoveredZone] = useState<string | null>(null);
  const animationFrameRef = useRef<number>();

  // Filter zones for current page if specified
  const visibleZones = pageNumber 
    ? zones.filter(zone => zone.page === pageNumber)
    : zones;

  // Get highlight style for a zone
  const getZoneStyle = useCallback((zone: Zone): HighlightStyle => {
    if (selectedZone === zone.id) {
      return SELECTED_STYLE;
    }
    
    if (zone.confidence < 0.7) {
      return LOW_CONFIDENCE_STYLE;
    }
    
    const zoneType = zone.type || 'text';
    const colors = ZONE_COLORS[zoneType as keyof typeof ZONE_COLORS] || ZONE_COLORS.mixed;
    
    return {
      fillColor: colors.fill,
      strokeColor: colors.stroke,
      strokeWidth: hoveredZone === zone.id ? 2 : 1,
      opacity: hoveredZone === zone.id ? 1 : 0.8
    };
  }, [selectedZone, hoveredZone]);

  // Draw zones on canvas
  const drawZones = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !visible) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Enable anti-aliasing
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // Draw zones from back to front
    visibleZones.forEach(zone => {
      const style = getZoneStyle(zone);
      const coords = zone.coordinates;
      
      // Apply scaling
      const x = coords.x * scale;
      const y = coords.y * scale;
      const width = coords.width * scale;
      const height = coords.height * scale;

      ctx.save();
      
      // Set opacity
      ctx.globalAlpha = style.opacity;

      // Draw fill
      ctx.fillStyle = style.fillColor;
      ctx.fillRect(x, y, width, height);

      // Draw stroke
      ctx.strokeStyle = style.strokeColor;
      ctx.lineWidth = style.strokeWidth;
      ctx.strokeRect(x, y, width, height);

      // Draw zone label if selected or hovered
      if (selectedZone === zone.id || hoveredZone === zone.id) {
        drawZoneLabel(ctx, zone, x, y);
      }

      ctx.restore();
    });
  }, [visible, visibleZones, scale, getZoneStyle, selectedZone, hoveredZone]);

  // Draw zone label
  const drawZoneLabel = (ctx: CanvasRenderingContext2D, zone: Zone, x: number, y: number) => {
    const label = `${zone.type || 'text'} (${Math.round(zone.confidence * 100)}%)`;
    
    // Label background
    ctx.font = '12px Inter, system-ui, sans-serif';
    const metrics = ctx.measureText(label);
    const labelWidth = metrics.width + 8;
    const labelHeight = 20;
    
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(x, y - labelHeight - 2, labelWidth, labelHeight);
    
    // Label text
    ctx.fillStyle = '#ffffff';
    ctx.fillText(label, x + 4, y - 6);
  };

  // Handle canvas click
  const handleCanvasClick = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!onZoneClick || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) / scale;
    const y = (event.clientY - rect.top) / scale;

    // Find clicked zone
    const clickedZone = findZoneAtPoint(x, y, visibleZones);
    if (clickedZone) {
      onZoneClick(clickedZone.id);
    }
  }, [onZoneClick, scale, visibleZones]);

  // Handle mouse move for hover effects
  const handleMouseMove = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) / scale;
    const y = (event.clientY - rect.top) / scale;

    const zone = findZoneAtPoint(x, y, visibleZones);
    const zoneId = zone?.id || null;
    
    if (zoneId !== hoveredZone) {
      setHoveredZone(zoneId);
      canvas.style.cursor = zoneId ? 'pointer' : 'default';
    }
  }, [scale, visibleZones, hoveredZone]);

  // Handle mouse leave
  const handleMouseLeave = useCallback(() => {
    setHoveredZone(null);
    if (canvasRef.current) {
      canvasRef.current.style.cursor = 'default';
    }
  }, []);

  // Find zone at point
  const findZoneAtPoint = (x: number, y: number, zones: Zone[]): Zone | null => {
    // Search from front to back (reverse order)
    for (let i = zones.length - 1; i >= 0; i--) {
      const zone = zones[i];
      const coords = zone.coordinates;
      
      if (x >= coords.x && x <= coords.x + coords.width &&
          y >= coords.y && y <= coords.y + coords.height) {
        return zone;
      }
    }
    return null;
  };

  // Update canvas size
  const updateCanvasSize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const parent = canvas.parentElement;
    if (!parent) return;

    const rect = parent.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
  }, []);

  // Animation loop for smooth updates
  const animate = useCallback(() => {
    drawZones();
    animationFrameRef.current = requestAnimationFrame(animate);
  }, [drawZones]);

  // Setup and cleanup
  useEffect(() => {
    updateCanvasSize();
    window.addEventListener('resize', updateCanvasSize);

    if (visible) {
      animate();
    }

    return () => {
      window.removeEventListener('resize', updateCanvasSize);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [updateCanvasSize, animate, visible]);

  // Redraw when dependencies change
  useEffect(() => {
    drawZones();
  }, [drawZones]);

  if (!visible) return null;

  return (
    <canvas
      ref={canvasRef}
      className="zone-highlighter absolute inset-0 pointer-events-auto"
      style={{ mixBlendMode: 'multiply' }}
      onClick={handleCanvasClick}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    />
  );
}