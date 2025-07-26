'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import type { Zone, CreateZoneRequest } from '@pdf-platform/shared';

// PDF.js imports
import * as pdfjsLib from 'pdfjs-dist';

// Configure worker
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
}

interface PDFViewerProps {
  pdfUrl: string;
  zones: Zone[];
  selectedZone?: string;
  onZoneSelect: (zoneId: string) => void;
  onZoneCreate: (zone: CreateZoneRequest) => void;
  confidenceThreshold: number;
  highlightVisible?: boolean;
  onPageChange?: (pageNumber: number) => void;
  onViewportChange?: (viewport: any) => void;
}

interface ViewerState {
  currentPage: number;
  totalPages: number;
  scale: number;
  isLoading: boolean;
  error: string | null;
}

export function PDFViewer({
  pdfUrl,
  zones,
  selectedZone,
  onZoneSelect,
  onZoneCreate,
  confidenceThreshold,
  highlightVisible = true,
  onPageChange,
  onViewportChange
}: PDFViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const pdfDocRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null);
  const viewportRef = useRef<any>(null);
  
  const [viewerState, setViewerState] = useState<ViewerState>({
    currentPage: 1,
    totalPages: 0,
    scale: 1.0,
    isLoading: true,
    error: null
  });

  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionStart, setSelectionStart] = useState<{ x: number; y: number } | null>(null);
  const [selectionEnd, setSelectionEnd] = useState<{ x: number; y: number } | null>(null);

  // Initialize PDF.js worker
  useEffect(() => {
    pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
  }, []);

  // Load PDF document
  const loadPDF = useCallback(async () => {
    if (!pdfUrl) return;

    try {
      setViewerState(prev => ({ ...prev, isLoading: true, error: null }));
      
      const loadingTask = pdfjsLib.getDocument(pdfUrl);
      const pdf = await loadingTask.promise;
      
      pdfDocRef.current = pdf;
      setViewerState(prev => ({
        ...prev,
        totalPages: pdf.numPages,
        isLoading: false
      }));
      
      // Render first page
      await renderPage(1);
    } catch (error) {
      console.error('PDF loading error:', error);
      setViewerState(prev => ({
        ...prev,
        isLoading: false,
        error: 'Failed to load PDF document'
      }));
    }
  }, [pdfUrl]);

  // Render specific page
  const renderPage = useCallback(async (pageNumber: number) => {
    if (!pdfDocRef.current || !canvasRef.current || !overlayCanvasRef.current) return;

    try {
      const page = await pdfDocRef.current.getPage(pageNumber);
      const canvas = canvasRef.current;
      const overlayCanvas = overlayCanvasRef.current;
      const context = canvas.getContext('2d');
      const overlayContext = overlayCanvas.getContext('2d');
      
      if (!context || !overlayContext) return;

      const viewport = page.getViewport({ scale: viewerState.scale });
      viewportRef.current = viewport;
      
      // Set canvas dimensions
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      overlayCanvas.height = viewport.height;
      overlayCanvas.width = viewport.width;
      
      // Clear overlay
      overlayContext.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
      
      // Render page
      const renderContext = {
        canvasContext: context,
        viewport: viewport
      };
      
      await page.render(renderContext).promise;
      
      // Render zones on overlay canvas
      if (highlightVisible) {
        renderZonesOverlay(overlayContext, viewport);
      }
      
      // Notify viewport change
      if (onViewportChange) {
        onViewportChange(viewport);
      }
      
    } catch (error) {
      console.error('Page rendering error:', error);
      setViewerState(prev => ({
        ...prev,
        error: 'Failed to render page'
      }));
    }
  }, [viewerState.scale, zones, selectedZone, confidenceThreshold, highlightVisible, onViewportChange]);

  // Render zones as overlays
  const renderZonesOverlay = useCallback((
    context: CanvasRenderingContext2D,
    viewport: any
  ) => {
    const currentPageZones = zones.filter(zone => zone.page === viewerState.currentPage);
    
    currentPageZones.forEach(zone => {
      const { x, y, width, height } = zone.coordinates;
      
      // Transform coordinates to viewport
      const [x1, y1] = viewport.convertToViewportPoint(x, y);
      const [x2, y2] = viewport.convertToViewportPoint(x + width, y + height);
      
      // Zone rectangle
      context.save();
      
      // Set colors based on confidence and selection
      const isSelected = selectedZone === zone.id;
      const isLowConfidence = zone.confidence < confidenceThreshold;
      
      if (isSelected) {
        context.strokeStyle = '#3b82f6'; // blue
        context.fillStyle = 'rgba(59, 130, 246, 0.1)';
        context.lineWidth = 3;
      } else if (isLowConfidence) {
        context.strokeStyle = '#ef4444'; // red
        context.fillStyle = 'rgba(239, 68, 68, 0.1)';
        context.lineWidth = 2;
      } else {
        context.strokeStyle = '#10b981'; // green
        context.fillStyle = 'rgba(16, 185, 129, 0.1)';
        context.lineWidth = 1;
      }
      
      // Draw zone
      context.fillRect(x1, y1, x2 - x1, y2 - y1);
      context.strokeRect(x1, y1, x2 - x1, y2 - y1);
      
      // Zone label
      if (zone.type) {
        context.font = '12px Inter, sans-serif';
        context.fillStyle = context.strokeStyle;
        context.fillText(
          `${zone.type} (${Math.round(zone.confidence * 100)}%)`,
          x1,
          y1 - 5
        );
      }
      
      context.restore();
    });
  }, [zones, selectedZone, viewerState.currentPage, confidenceThreshold]);

  // Handle canvas mouse events for zone selection
  const handleCanvasMouseDown = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // Check if clicking on existing zone
    const currentPageZones = zones.filter(zone => zone.page === viewerState.currentPage);
    const clickedZone = currentPageZones.find(zone => {
      const { coordinates } = zone;
      return x >= coordinates.x && x <= coordinates.x + coordinates.width &&
             y >= coordinates.y && y <= coordinates.y + coordinates.height;
    });

    if (clickedZone) {
      onZoneSelect(clickedZone.id);
    } else {
      // Start new zone selection
      setIsSelecting(true);
      setSelectionStart({ x, y });
      setSelectionEnd({ x, y });
    }
  }, [zones, viewerState.currentPage, onZoneSelect]);

  const handleCanvasMouseMove = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isSelecting || !selectionStart) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    setSelectionEnd({ x, y });
  }, [isSelecting, selectionStart]);

  const handleCanvasMouseUp = useCallback(() => {
    if (!isSelecting || !selectionStart || !selectionEnd) return;

    const minX = Math.min(selectionStart.x, selectionEnd.x);
    const minY = Math.min(selectionStart.y, selectionEnd.y);
    const width = Math.abs(selectionEnd.x - selectionStart.x);
    const height = Math.abs(selectionEnd.y - selectionStart.y);

    // Only create zone if selection is large enough
    if (width > 10 && height > 10) {
      const newZone: CreateZoneRequest = {
        page: viewerState.currentPage,
        coordinates: { x: minX, y: minY, width, height },
        type: 'text' // Default type, user can change later
      };
      
      onZoneCreate(newZone);
    }

    // Reset selection
    setIsSelecting(false);
    setSelectionStart(null);
    setSelectionEnd(null);
  }, [isSelecting, selectionStart, selectionEnd, viewerState.currentPage, onZoneCreate]);

  // Navigation functions
  const goToPage = useCallback((pageNumber: number) => {
    if (pageNumber >= 1 && pageNumber <= viewerState.totalPages) {
      setViewerState(prev => ({ ...prev, currentPage: pageNumber }));
      if (onPageChange) {
        onPageChange(pageNumber);
      }
    }
  }, [viewerState.totalPages, onPageChange]);

  const nextPage = useCallback(() => {
    goToPage(viewerState.currentPage + 1);
  }, [viewerState.currentPage, goToPage]);

  const prevPage = useCallback(() => {
    goToPage(viewerState.currentPage - 1);
  }, [viewerState.currentPage, goToPage]);

  const zoomIn = useCallback(() => {
    setViewerState(prev => ({ ...prev, scale: Math.min(prev.scale * 1.2, 3.0) }));
  }, []);

  const zoomOut = useCallback(() => {
    setViewerState(prev => ({ ...prev, scale: Math.max(prev.scale / 1.2, 0.5) }));
  }, []);

  const resetZoom = useCallback(() => {
    setViewerState(prev => ({ ...prev, scale: 1.0 }));
  }, []);

  // Load PDF when URL changes
  useEffect(() => {
    loadPDF();
  }, [loadPDF]);

  // Re-render page when state changes
  useEffect(() => {
    if (!viewerState.isLoading && pdfDocRef.current) {
      renderPage(viewerState.currentPage);
    }
  }, [viewerState.currentPage, viewerState.scale, renderPage]);

  if (viewerState.error) {
    return (
      <div className="flex items-center justify-center h-96 bg-muted rounded-lg">
        <div className="text-center">
          <p className="text-destructive font-medium">Error loading PDF</p>
          <p className="text-muted-foreground text-sm">{viewerState.error}</p>
          <Button onClick={loadPDF} className="mt-4">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between p-4 border-b bg-background">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={prevPage}
            disabled={viewerState.currentPage === 1 || viewerState.isLoading}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          
          <span className="text-sm font-medium px-3">
            {viewerState.isLoading ? (
              'Loading...'
            ) : (
              `${viewerState.currentPage} / ${viewerState.totalPages}`
            )}
          </span>
          
          <Button
            variant="outline"
            size="sm"
            onClick={nextPage}
            disabled={viewerState.currentPage === viewerState.totalPages || viewerState.isLoading}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={zoomOut}>
            <ZoomOut className="w-4 h-4" />
          </Button>
          
          <span className="text-sm font-medium px-2">
            {Math.round(viewerState.scale * 100)}%
          </span>
          
          <Button variant="outline" size="sm" onClick={zoomIn}>
            <ZoomIn className="w-4 h-4" />
          </Button>
          
          <Button variant="outline" size="sm" onClick={resetZoom}>
            <RotateCcw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* PDF Canvas */}
      <div 
        ref={containerRef}
        className="flex-1 overflow-auto bg-gray-100 flex items-center justify-center p-4"
      >
        {viewerState.isLoading ? (
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <span className="ml-2">Loading PDF...</span>
          </div>
        ) : (
          <div className="relative inline-block">
            <canvas
              ref={canvasRef}
              className="shadow-lg bg-white"
            />
            <canvas
              ref={overlayCanvasRef}
              className="absolute inset-0 cursor-crosshair"
              style={{ pointerEvents: 'auto' }}
              onMouseDown={handleCanvasMouseDown}
              onMouseMove={handleCanvasMouseMove}
              onMouseUp={handleCanvasMouseUp}
            />
          </div>
        )}
      </div>
    </div>
  );
} 