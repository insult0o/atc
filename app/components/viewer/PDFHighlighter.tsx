'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { highlightEventBus, HighlightEvent } from '../../../lib/highlighting/event-system';
import { CoordinateMapper } from '../../../lib/highlighting/coordinate-mapper';
import type { Zone } from '@pdf-platform/shared';

interface PDFHighlighterProps {
  zones: Zone[];
  coordinateMapper: CoordinateMapper;
  className?: string;
}

interface HighlightStyle {
  backgroundColor: string;
  borderColor: string;
  borderWidth: number;
  opacity: number;
}

const HIGHLIGHT_STYLES: Record<string, HighlightStyle> = {
  highlighted: {
    backgroundColor: 'rgba(255, 235, 59, 0.4)',
    borderColor: 'rgba(255, 193, 7, 0.8)',
    borderWidth: 2,
    opacity: 1
  },
  hover: {
    backgroundColor: 'rgba(33, 150, 243, 0.2)',
    borderColor: 'rgba(33, 150, 243, 0.6)',
    borderWidth: 1,
    opacity: 0.8
  }
};

export function PDFHighlighter({ zones, coordinateMapper, className }: PDFHighlighterProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [highlightedZones, setHighlightedZones] = useState<Set<string>>(new Set());
  const [hoveredZone, setHoveredZone] = useState<string | null>(null);
  const animationFrameRef = useRef<number>();
  
  // Subscribe to highlight events from content pane
  useEffect(() => {
    const handleHighlight = (event: HighlightEvent) => {
      if (event.source === 'content') {
        const zoneLocation = coordinateMapper.getZoneLocation(event.targetId);
        if (zoneLocation) {
          if (event.type === 'highlight') {
            setHighlightedZones(prev => {
              const next = new Set(prev);
              if (event.multiSelect) {
                if (next.has(zoneLocation.zoneId)) {
                  next.delete(zoneLocation.zoneId);
                } else {
                  next.add(zoneLocation.zoneId);
                }
              } else {
                next.clear();
                next.add(zoneLocation.zoneId);
              }
              return next;
            });
          } else if (event.type === 'hover') {
            setHoveredZone(zoneLocation.zoneId);
          } else if (event.type === 'unhighlight') {
            setHighlightedZones(prev => {
              const next = new Set(prev);
              next.delete(zoneLocation.zoneId);
              return next;
            });
          }
        }
      }
    };
    
    const unsubscribeHighlight = highlightEventBus.on('highlight', handleHighlight);
    const unsubscribeHover = highlightEventBus.on('hover', handleHighlight);
    const unsubscribeUnhighlight = highlightEventBus.on('unhighlight', handleHighlight);
    
    return () => {
      unsubscribeHighlight();
      unsubscribeHover();
      unsubscribeUnhighlight();
    };
  }, [coordinateMapper]);
  
  // Handle zone clicks
  const handleZoneClick = useCallback((zone: Zone, event: React.MouseEvent) => {
    const multiSelect = event.ctrlKey || event.metaKey;
    
    highlightEventBus.emit({
      type: 'highlight',
      source: 'pdf',
      targetId: zone.id,
      multiSelect
    });
    
    // Update local state
    setHighlightedZones(prev => {
      const next = new Set(prev);
      if (multiSelect) {
        if (next.has(zone.id)) {
          next.delete(zone.id);
        } else {
          next.add(zone.id);
        }
      } else {
        next.clear();
        next.add(zone.id);
      }
      return next;
    });
  }, []);
  
  // Handle zone hover
  const handleZoneHover = useCallback((zone: Zone | null) => {
    if (zone) {
      setHoveredZone(zone.id);
      highlightEventBus.emit({
        type: 'hover',
        source: 'pdf',
        targetId: zone.id
      });
    } else {
      setHoveredZone(null);
    }
  }, []);
  
  // Render highlights on canvas
  const renderHighlights = useCallback(() => {
    if (!canvasRef.current) return;
    
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    
    zones.forEach(zone => {
      const isHighlighted = highlightedZones.has(zone.id);
      const isHovered = hoveredZone === zone.id;
      
      if (isHighlighted || isHovered) {
        ctx.save();
        
        // Get appropriate style
        const style = isHighlighted ? HIGHLIGHT_STYLES.highlighted : HIGHLIGHT_STYLES.hover;
        
        // Set styles
        ctx.fillStyle = style.backgroundColor;
        ctx.strokeStyle = style.borderColor;
        ctx.lineWidth = style.borderWidth;
        ctx.globalAlpha = style.opacity;
        
        // Draw highlight
        const { x, y, width, height } = zone.coordinates;
        ctx.fillRect(x, y, width, height);
        ctx.strokeRect(x, y, width, height);
        
        ctx.restore();
      }
    });
  }, [zones, highlightedZones, hoveredZone]);
  
  // Re-render highlights when state changes
  useEffect(() => {
    // Cancel previous animation frame
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    
    // Schedule new render
    animationFrameRef.current = requestAnimationFrame(renderHighlights);
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [renderHighlights]);
  
  // Handle canvas resize
  useEffect(() => {
    const updateCanvasSize = () => {
      if (canvasRef.current && canvasRef.current.parentElement) {
        const parent = canvasRef.current.parentElement;
        canvasRef.current.width = parent.clientWidth;
        canvasRef.current.height = parent.clientHeight;
        renderHighlights();
      }
    };
    
    updateCanvasSize();
    window.addEventListener('resize', updateCanvasSize);
    
    return () => {
      window.removeEventListener('resize', updateCanvasSize);
    };
  }, [renderHighlights]);
  
  // Create interactive zones
  const createInteractiveZones = () => {
    return zones.map(zone => {
      const { x, y, width, height } = zone.coordinates;
      const isHighlighted = highlightedZones.has(zone.id);
      const isHovered = hoveredZone === zone.id;
      
      return (
        <div
          key={zone.id}
          className="absolute cursor-pointer transition-opacity"
          style={{
            left: `${x}px`,
            top: `${y}px`,
            width: `${width}px`,
            height: `${height}px`,
            opacity: isHighlighted || isHovered ? 0 : 0.01,
            backgroundColor: 'transparent'
          }}
          onClick={(e) => handleZoneClick(zone, e)}
          onMouseEnter={() => handleZoneHover(zone)}
          onMouseLeave={() => handleZoneHover(null)}
          data-zone-id={zone.id}
        />
      );
    });
  };
  
  return (
    <>
      <canvas
        ref={canvasRef}
        className={`absolute inset-0 pointer-events-none ${className || ''}`}
        style={{ mixBlendMode: 'multiply' }}
      />
      <div className="absolute inset-0 pointer-events-none">
        {createInteractiveZones()}
      </div>
    </>
  );
}