'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { highlightEventBus, HighlightEvent } from '../../../lib/highlighting/event-system';
import { CoordinateMapper } from '../../../lib/highlighting/coordinate-mapper';
import type { ExtractedContent } from './DualPaneViewer';

interface ContentHighlighterProps {
  content: ExtractedContent[];
  coordinateMapper: CoordinateMapper;
  onContentClick?: (contentId: string) => void;
}

export function ContentHighlighter({ 
  content, 
  coordinateMapper,
  onContentClick 
}: ContentHighlighterProps) {
  const [highlightedContent, setHighlightedContent] = useState<Set<string>>(new Set());
  const [hoveredContent, setHoveredContent] = useState<string | null>(null);
  const contentRefs = useRef<Map<string, HTMLElement>>(new Map());
  
  // Subscribe to highlight events from PDF pane
  useEffect(() => {
    const handleHighlight = (event: HighlightEvent) => {
      if (event.source === 'pdf') {
        const contentLocation = coordinateMapper.getContentLocation(event.targetId);
        if (contentLocation) {
          if (event.type === 'highlight') {
            setHighlightedContent(prev => {
              const next = new Set(prev);
              if (event.multiSelect) {
                if (next.has(contentLocation.elementId)) {
                  next.delete(contentLocation.elementId);
                } else {
                  next.add(contentLocation.elementId);
                }
              } else {
                next.clear();
                next.add(contentLocation.elementId);
              }
              return next;
            });
            
            // Scroll to content
            scrollToContent(contentLocation.elementId);
          } else if (event.type === 'hover') {
            setHoveredContent(contentLocation.elementId);
          } else if (event.type === 'unhighlight') {
            setHighlightedContent(prev => {
              const next = new Set(prev);
              next.delete(contentLocation.elementId);
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
  
  const handleContentClick = useCallback((contentId: string, event: React.MouseEvent) => {
    const zoneLocation = coordinateMapper.getZoneLocation(contentId);
    if (!zoneLocation) return;
    
    highlightEventBus.emit({
      type: 'highlight',
      source: 'content',
      targetId: contentId,
      multiSelect: event.ctrlKey || event.metaKey
    });
    
    setHighlightedContent(prev => {
      const next = new Set(prev);
      if (event.ctrlKey || event.metaKey) {
        if (next.has(contentId)) {
          next.delete(contentId);
        } else {
          next.add(contentId);
        }
      } else {
        next.clear();
        next.add(contentId);
      }
      return next;
    });
    
    onContentClick?.(contentId);
  }, [coordinateMapper, onContentClick]);
  
  const handleContentHover = useCallback((contentId: string | null) => {
    if (contentId) {
      setHoveredContent(contentId);
      highlightEventBus.emit({
        type: 'hover',
        source: 'content',
        targetId: contentId
      });
    } else {
      setHoveredContent(null);
    }
  }, []);
  
  const scrollToContent = (contentId: string) => {
    const element = contentRefs.current.get(contentId);
    if (element) {
      element.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });
      
      // Add attention animation
      element.classList.add('highlight-attention');
      setTimeout(() => {
        element.classList.remove('highlight-attention');
      }, 1000);
    }
  };
  
  return (
    <div className="content-highlighter space-y-4">
      {content.map((item, index) => {
        const contentId = `content-${item.zoneId}`;
        const isHighlighted = highlightedContent.has(contentId);
        const isHovered = hoveredContent === contentId;
        
        return (
          <div
            key={item.zoneId}
            ref={el => {
              if (el) contentRefs.current.set(contentId, el);
            }}
            className={`
              content-item p-4 rounded-lg cursor-pointer transition-all duration-200
              ${isHighlighted ? 'bg-yellow-100 border-l-4 border-yellow-400 shadow-md' : 'bg-white'}
              ${isHovered && !isHighlighted ? 'bg-blue-50 border-l-4 border-blue-300' : ''}
              ${!isHighlighted && !isHovered ? 'hover:bg-gray-50 border-l-4 border-transparent' : ''}
            `}
            onClick={(e) => handleContentClick(contentId, e)}
            onMouseEnter={() => handleContentHover(contentId)}
            onMouseLeave={() => handleContentHover(null)}
            data-content-id={contentId}
            data-zone-id={item.zoneId}
          >
            <div className="flex items-start gap-3">
              {/* Highlight indicator */}
              {isHighlighted && (
                <div className="highlight-indicator flex-shrink-0 mt-1">
                  <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
                </div>
              )}
              
              {/* Content */}
              <div className="content-text flex-1">
                <div 
                  className="whitespace-pre-wrap"
                  style={{
                    fontSize: item.formatting?.fontSize || 14,
                    fontFamily: item.formatting?.fontFamily || 'inherit',
                    fontWeight: item.formatting?.bold ? 'bold' : 'normal',
                    fontStyle: item.formatting?.italic ? 'italic' : 'normal',
                    textAlign: item.formatting?.alignment || 'left',
                    lineHeight: item.formatting?.lineHeight || 1.5
                  }}
                >
                  {item.content}
                </div>
                
                {/* Confidence indicator */}
                <div className="mt-2 flex items-center gap-2">
                  <div className="text-xs text-gray-500">
                    Zone: {item.zoneId}
                  </div>
                  <div className={`
                    text-xs px-2 py-1 rounded-full
                    ${item.confidence >= 0.9 ? 'bg-green-100 text-green-700' : ''}
                    ${item.confidence >= 0.7 && item.confidence < 0.9 ? 'bg-yellow-100 text-yellow-700' : ''}
                    ${item.confidence < 0.7 ? 'bg-red-100 text-red-700' : ''}
                  `}>
                    {Math.round(item.confidence * 100)}% confidence
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })}
      
      <style jsx global>{`
        @keyframes highlight-attention {
          0% { transform: scale(1); }
          50% { transform: scale(1.02); }
          100% { transform: scale(1); }
        }
        
        .highlight-attention {
          animation: highlight-attention 0.5s ease-in-out;
        }
      `}</style>
    </div>
  );
}