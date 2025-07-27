'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { PDFViewer } from './PDFViewer';
import { ExtractedContentViewer } from './ExtractedContentViewer';
import { RichTextEditor } from '../editor/RichTextEditor';
import { ZoneCreator } from '../zones/ZoneCreator';
import { ZoneManager } from '../zones/ZoneManager';
import { ZoneHighlighter } from './ZoneHighlighter';
import { PDFHighlighter } from './PDFHighlighter';
import { ContentHighlighter } from './ContentHighlighter';
import { useSynchronizedScroll } from '../../hooks/useSynchronizedScroll';
import { useViewerPerformance } from '../../hooks/useViewerPerformance';
import { CoordinateMapper } from '../../../lib/highlighting/coordinate-mapper';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { 
  Maximize2, 
  Minimize2, 
  Eye, 
  EyeOff,
  Smartphone,
  Monitor,
  GripVertical,
  Link,
  Unlink
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

  // Handle zone creation
  const handleZoneCreate = useCallback((zoneData: any) => {
    console.log('🎯 Zone created:', zoneData);
    // Here you would typically send this to the backend
  }, []);

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
    <div className="dual-pane-viewer flex flex-col h-full bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 dark:from-slate-950 dark:via-blue-950/30 dark:to-indigo-950/20 p-4">
      {/* Toolbar */}
      <div className="viewer-toolbar flex items-center justify-between p-4 backdrop-blur-xl bg-white/10 dark:bg-black/10 border-b border-white/20 dark:border-white/10">
        <div className="flex items-center gap-2">
          {/* Mobile pane switcher */}
          {viewerState.isMobileView && (
            <div className="flex rounded-xl shadow-lg backdrop-blur-sm bg-white/20 dark:bg-black/20 border border-white/30 dark:border-white/10">
              <Button
                variant={viewerState.activeMobilePane === 'left' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => switchMobilePane('left')}
                className={`rounded-r-none backdrop-blur-sm ${
                  viewerState.activeMobilePane === 'left' 
                    ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg' 
                    : 'hover:bg-white/20 dark:hover:bg-black/20'
                }`}
              >
                <Smartphone className="w-4 h-4 mr-1" />
                PDF
              </Button>
              <Button
                variant={viewerState.activeMobilePane === 'right' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => switchMobilePane('right')}
                className={`rounded-l-none backdrop-blur-sm ${
                  viewerState.activeMobilePane === 'right' 
                    ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg' 
                    : 'hover:bg-white/20 dark:hover:bg-black/20'
                }`}
              >
                <Monitor className="w-4 h-4 mr-1" />
                Content
              </Button>
            </div>
          )}
          
          {/* Highlighting toggle */}
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleHighlighting}
            className={`backdrop-blur-sm border transition-all duration-300 ${
              viewerState.highlightVisible 
                ? 'bg-gradient-to-r from-green-500/20 to-blue-500/20 border-green-500/30 text-green-700 dark:text-green-300 shadow-lg' 
                : 'bg-white/10 dark:bg-black/10 border-white/20 dark:border-white/10 hover:bg-white/20 dark:hover:bg-black/20'
            }`}
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
                variant="ghost"
                size="sm"
                onClick={() => toggleFullscreen('left')}
                disabled={viewerState.fullscreenPane === 'right'}
                className={`backdrop-blur-sm border transition-all duration-300 ${
                  viewerState.fullscreenPane === 'left'
                    ? 'bg-gradient-to-r from-blue-500/20 to-purple-500/20 border-blue-500/30 text-blue-700 dark:text-blue-300 shadow-lg'
                    : 'bg-white/10 dark:bg-black/10 border-white/20 dark:border-white/10 hover:bg-white/20 dark:hover:bg-black/20'
                } ${viewerState.fullscreenPane === 'right' ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {viewerState.fullscreenPane === 'left' ? (
                  <Minimize2 className="w-4 h-4" />
                ) : (
                  <Maximize2 className="w-4 h-4" />
                )}
                <span className="ml-1 hidden sm:inline">PDF</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => toggleFullscreen('right')}
                disabled={viewerState.fullscreenPane === 'left'}
                className={`backdrop-blur-sm border transition-all duration-300 ${
                  viewerState.fullscreenPane === 'right'
                    ? 'bg-gradient-to-r from-blue-500/20 to-purple-500/20 border-blue-500/30 text-blue-700 dark:text-blue-300 shadow-lg'
                    : 'bg-white/10 dark:bg-black/10 border-white/20 dark:border-white/10 hover:bg-white/20 dark:hover:bg-black/20'
                } ${viewerState.fullscreenPane === 'left' ? 'opacity-50 cursor-not-allowed' : ''}`}
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
      <div ref={containerRef} className="viewer-container flex flex-1 relative overflow-hidden rounded-xl shadow-2xl border border-white/20 dark:border-white/10">
        {/* Left pane - PDF Viewer */}
        <div
          ref={leftPaneRef}
          className="left-pane flex-col overflow-hidden backdrop-blur-xl bg-white/5 dark:bg-black/5 border-r border-white/20 dark:border-white/10"
          style={paneStyles.left}
        >
          <PDFViewer
            pdfUrl={`/api/documents/${documentId}/file`}
            zones={zones}
            selectedZone={viewerState.selectedZone || undefined}
            onZoneSelect={handleZoneSelect}
            onZoneCreate={handleZoneCreate}
            confidenceThreshold={0.7}
          />
          
          {/* Zone Creation Overlay */}
          <ZoneCreator
            containerRef={leftPaneRef}
            currentPage={1}
            existingZones={[]}
            onZoneCreate={handleZoneCreate}
            scale={viewerState.zoomLevel}
          />
          
          {/* Zone Highlighting with Type-based Colors */}
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
          className="pane-divider w-2 backdrop-blur-sm bg-white/20 dark:bg-black/20 hover:bg-gradient-to-b hover:from-blue-500/30 hover:to-purple-500/30 cursor-col-resize transition-all duration-300 relative border-x border-white/30 dark:border-white/10"
          style={paneStyles.divider}
          onMouseDown={handleDividerMouseDown}
        >
          <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-8 flex items-center justify-center">
            <GripVertical className="w-4 h-4 text-slate-600 dark:text-slate-400" />
          </div>
        </div>

        {/* Right pane - Rich Text Editor */}
        <div
          ref={rightPaneRef}
          className="right-pane flex flex-col overflow-hidden backdrop-blur-xl bg-white/5 dark:bg-black/5"
          style={paneStyles.right}
        >
          {/* Editor Header */}
          <div className="editor-header p-4 border-b border-white/20 dark:border-white/10">
            <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              📝 Rich Content Editor
              <Badge variant="outline" className="text-xs">
                {extractedContent.length} zones
              </Badge>
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              Edit extracted content with full rich text capabilities
            </p>
          </div>
          
          {/* Rich Text Editor */}
          <div className="flex-1 overflow-hidden">
            <RichTextEditor
              content={extractedContent}
              onSave={(content) => {
                console.log('💾 Content saved:', content);
              }}
              onExport={(format) => {
                console.log('📤 Exporting as:', format);
              }}
              height="100%"
            />
          </div>
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