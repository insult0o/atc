'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { PDFViewer } from './PDFViewer';
import { ExtractedContentViewer } from './ExtractedContentViewer';
import { ZoneHighlighter } from './ZoneHighlighter';
import { useSynchronizedScroll } from '../../hooks/useSynchronizedScroll';
import { useViewerPerformance } from '../../hooks/useViewerPerformance';
import { Button } from '../../../components/ui/button';
import { 
  Maximize2, 
  Minimize2, 
  Eye, 
  EyeOff,
  Smartphone,
  Monitor,
  GripVertical
} from 'lucide-react';
import type { Zone } from '@pdf-platform/shared';

interface DualPaneViewerProps {
  documentId: string;
  zones: Zone[];
  extractedContent: ExtractedContent[];
  onZoneSelect?: (zoneId: string) => void;
  onContentEdit?: (zoneId: string, content: string) => void;
}

export interface ExtractedContent {
  zoneId: string;
  content: string;
  formatting: ContentFormatting;
  confidence: number;
}

export interface ContentFormatting {
  fontSize?: number;
  fontFamily?: string;
  bold?: boolean;
  italic?: boolean;
  alignment?: 'left' | 'center' | 'right' | 'justify';
  indentation?: number;
  lineHeight?: number;
}

interface ViewerState {
  leftPaneScroll: ScrollPosition;
  rightPaneScroll: ScrollPosition;
  selectedZone: string | null;
  highlightVisible: boolean;
  paneRatio: number; // 0-1 for left pane width
  zoomLevel: number;
  fullscreenPane: 'left' | 'right' | null;
  isMobileView: boolean;
  activeMobilePane: 'left' | 'right';
}

interface ScrollPosition {
  top: number;
  left: number;
  height: number;
  width: number;
}

const MOBILE_BREAKPOINT = 768;
const MIN_PANE_WIDTH = 300;
const DEFAULT_PANE_RATIO = 0.5;

export function DualPaneViewer({
  documentId,
  zones,
  extractedContent,
  onZoneSelect,
  onContentEdit
}: DualPaneViewerProps) {
  const leftPaneRef = useRef<HTMLDivElement>(null);
  const rightPaneRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dividerRef = useRef<HTMLDivElement>(null);
  
  const [viewerState, setViewerState] = useState<ViewerState>({
    leftPaneScroll: { top: 0, left: 0, height: 0, width: 0 },
    rightPaneScroll: { top: 0, left: 0, height: 0, width: 0 },
    selectedZone: null,
    highlightVisible: true,
    paneRatio: DEFAULT_PANE_RATIO,
    zoomLevel: 1.0,
    fullscreenPane: null,
    isMobileView: false,
    activeMobilePane: 'left'
  });

  const [isDragging, setIsDragging] = useState(false);
  const [dragStartX, setDragStartX] = useState(0);
  const [startRatio, setStartRatio] = useState(DEFAULT_PANE_RATIO);

  // Performance monitoring
  const { recordMetric, getMetrics } = useViewerPerformance();

  // Synchronized scrolling
  const { 
    syncScroll, 
    registerPane, 
    unregisterPane 
  } = useSynchronizedScroll({
    zones,
    extractedContent,
    onSync: (metrics) => recordMetric('scroll_sync', metrics)
  });

  // Check for mobile view
  useEffect(() => {
    const checkMobileView = () => {
      const isMobile = window.innerWidth < MOBILE_BREAKPOINT;
      setViewerState(prev => ({
        ...prev,
        isMobileView: isMobile,
        paneRatio: isMobile ? 1 : DEFAULT_PANE_RATIO
      }));
    };

    checkMobileView();
    window.addEventListener('resize', checkMobileView);
    return () => window.removeEventListener('resize', checkMobileView);
  }, []);

  // Register panes for synchronized scrolling
  useEffect(() => {
    if (leftPaneRef.current) {
      registerPane('left', leftPaneRef.current);
    }
    if (rightPaneRef.current) {
      registerPane('right', rightPaneRef.current);
    }

    return () => {
      unregisterPane('left');
      unregisterPane('right');
    };
  }, [registerPane, unregisterPane]);

  // Handle zone selection
  const handleZoneSelect = useCallback((zoneId: string) => {
    recordMetric('zone_select', { zoneId });
    setViewerState(prev => ({ ...prev, selectedZone: zoneId }));
    onZoneSelect?.(zoneId);
  }, [onZoneSelect, recordMetric]);

  // Handle pane divider drag
  const handleDividerMouseDown = useCallback((e: React.MouseEvent) => {
    if (viewerState.isMobileView) return;
    
    setIsDragging(true);
    setDragStartX(e.clientX);
    setStartRatio(viewerState.paneRatio);
    e.preventDefault();
  }, [viewerState.isMobileView, viewerState.paneRatio]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !containerRef.current) return;

    const containerWidth = containerRef.current.offsetWidth;
    const deltaX = e.clientX - dragStartX;
    const deltaRatio = deltaX / containerWidth;
    const newRatio = Math.max(0.2, Math.min(0.8, startRatio + deltaRatio));
    
    const leftPaneWidth = containerWidth * newRatio;
    const rightPaneWidth = containerWidth * (1 - newRatio);
    
    // Ensure minimum pane widths
    if (leftPaneWidth >= MIN_PANE_WIDTH && rightPaneWidth >= MIN_PANE_WIDTH) {
      setViewerState(prev => ({ ...prev, paneRatio: newRatio }));
    }
  }, [isDragging, dragStartX, startRatio]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // Toggle highlighting
  const toggleHighlighting = useCallback(() => {
    setViewerState(prev => ({ ...prev, highlightVisible: !prev.highlightVisible }));
    recordMetric('toggle_highlighting', { visible: !viewerState.highlightVisible });
  }, [viewerState.highlightVisible, recordMetric]);

  // Toggle fullscreen
  const toggleFullscreen = useCallback((pane: 'left' | 'right') => {
    const newFullscreen = viewerState.fullscreenPane === pane ? null : pane;
    setViewerState(prev => ({ ...prev, fullscreenPane: newFullscreen }));
    recordMetric('toggle_fullscreen', { pane, fullscreen: !!newFullscreen });
  }, [viewerState.fullscreenPane, recordMetric]);

  // Switch mobile pane
  const switchMobilePane = useCallback((pane: 'left' | 'right') => {
    setViewerState(prev => ({ ...prev, activeMobilePane: pane }));
    recordMetric('switch_mobile_pane', { pane });
  }, [recordMetric]);

  // Get pane styles
  const getPaneStyles = () => {
    if (viewerState.isMobileView) {
      return {
        left: {
          width: '100%',
          display: viewerState.activeMobilePane === 'left' ? 'flex' : 'none'
        },
        right: {
          width: '100%',
          display: viewerState.activeMobilePane === 'right' ? 'flex' : 'none'
        },
        divider: { display: 'none' }
      };
    }

    if (viewerState.fullscreenPane) {
      return {
        left: {
          width: viewerState.fullscreenPane === 'left' ? '100%' : '0',
          display: viewerState.fullscreenPane === 'left' ? 'flex' : 'none'
        },
        right: {
          width: viewerState.fullscreenPane === 'right' ? '100%' : '0',
          display: viewerState.fullscreenPane === 'right' ? 'flex' : 'none'
        },
        divider: { display: 'none' }
      };
    }

    return {
      left: {
        width: `${viewerState.paneRatio * 100}%`,
        display: 'flex'
      },
      right: {
        width: `${(1 - viewerState.paneRatio) * 100}%`,
        display: 'flex'
      },
      divider: { display: 'block' }
    };
  };

  const paneStyles = getPaneStyles();

  return (
    <div className="dual-pane-viewer flex flex-col h-full bg-background">
      {/* Toolbar */}
      <div className="viewer-toolbar flex items-center justify-between p-2 border-b bg-muted/50">
        <div className="flex items-center gap-2">
          {/* Mobile pane switcher */}
          {viewerState.isMobileView && (
            <div className="flex rounded-md shadow-sm">
              <Button
                variant={viewerState.activeMobilePane === 'left' ? 'default' : 'outline'}
                size="sm"
                onClick={() => switchMobilePane('left')}
                className="rounded-r-none"
              >
                <Smartphone className="w-4 h-4 mr-1" />
                PDF
              </Button>
              <Button
                variant={viewerState.activeMobilePane === 'right' ? 'default' : 'outline'}
                size="sm"
                onClick={() => switchMobilePane('right')}
                className="rounded-l-none"
              >
                <Monitor className="w-4 h-4 mr-1" />
                Content
              </Button>
            </div>
          )}
          
          {/* Highlighting toggle */}
          <Button
            variant={viewerState.highlightVisible ? 'default' : 'outline'}
            size="sm"
            onClick={toggleHighlighting}
          >
            {viewerState.highlightVisible ? (
              <Eye className="w-4 h-4" />
            ) : (
              <EyeOff className="w-4 h-4" />
            )}
            <span className="ml-1 hidden sm:inline">Zones</span>
          </Button>
        </div>

        <div className="flex items-center gap-2">
          {/* Fullscreen controls */}
          {!viewerState.isMobileView && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => toggleFullscreen('left')}
                disabled={viewerState.fullscreenPane === 'right'}
              >
                {viewerState.fullscreenPane === 'left' ? (
                  <Minimize2 className="w-4 h-4" />
                ) : (
                  <Maximize2 className="w-4 h-4" />
                )}
                <span className="ml-1 hidden sm:inline">PDF</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => toggleFullscreen('right')}
                disabled={viewerState.fullscreenPane === 'left'}
              >
                {viewerState.fullscreenPane === 'right' ? (
                  <Minimize2 className="w-4 h-4" />
                ) : (
                  <Maximize2 className="w-4 h-4" />
                )}
                <span className="ml-1 hidden sm:inline">Content</span>
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Main viewer area */}
      <div ref={containerRef} className="viewer-container flex flex-1 relative overflow-hidden">
        {/* Left pane - PDF Viewer */}
        <div
          ref={leftPaneRef}
          className="left-pane flex-col overflow-hidden border-r"
          style={paneStyles.left}
        >
          <PDFViewer
            pdfUrl={`/api/documents/${documentId}/pdf`}
            zones={zones}
            selectedZone={viewerState.selectedZone || undefined}
            onZoneSelect={handleZoneSelect}
            onZoneCreate={() => {}} // Handled by parent
            confidenceThreshold={0.7}
          />
          {viewerState.highlightVisible && (
            <ZoneHighlighter
              zones={zones}
              selectedZone={viewerState.selectedZone}
              visible={viewerState.highlightVisible}
              onZoneClick={handleZoneSelect}
            />
          )}
        </div>

        {/* Draggable divider */}
        <div
          ref={dividerRef}
          className="pane-divider w-1 bg-border hover:bg-primary/20 cursor-col-resize transition-colors relative"
          style={paneStyles.divider}
          onMouseDown={handleDividerMouseDown}
        >
          <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-8 flex items-center justify-center">
            <GripVertical className="w-4 h-4 text-muted-foreground" />
          </div>
        </div>

        {/* Right pane - Extracted Content Viewer */}
        <div
          ref={rightPaneRef}
          className="right-pane flex-col overflow-hidden"
          style={paneStyles.right}
        >
          <ExtractedContentViewer
            content={extractedContent}
            zones={zones}
            selectedZone={viewerState.selectedZone}
            highlightVisible={viewerState.highlightVisible}
            onZoneSelect={handleZoneSelect}
            onContentEdit={onContentEdit}
          />
        </div>
      </div>

      {/* Performance metrics (development only) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="performance-metrics absolute bottom-4 right-4 bg-black/80 text-white p-2 rounded text-xs font-mono">
          <div>FPS: {getMetrics().fps}</div>
          <div>Sync Lag: {getMetrics().syncLag}ms</div>
          <div>Memory: {getMetrics().memoryUsage}MB</div>
        </div>
      )}
    </div>
  );
}