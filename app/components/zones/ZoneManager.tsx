'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { DetectedZone, ToolAssignmentResult } from '../../../lib/pdf-processing/content-analyzer';
import { Button } from '../../../components/ui/button';

// Core interfaces for zone management
export interface ZoneManagerProps {
  zones: Zone[];
  selectedZone?: string;
  onZoneUpdate: (zoneId: string, updates: Partial<Zone>) => void;
  onToolAssignment: (zoneId: string, toolName: string) => void;
  onZoneMerge: (zoneIds: string[]) => void;
  onZoneSplit: (zoneId: string, splitPoints: SplitPoint[]) => void;
  availableTools: ProcessingTool[];
  contentAnalysisResults?: ContentAnalysisResult;
  pdfUrl?: string;
  currentPage: number;
  onZoneSelect: (zoneId: string | null) => void;
  onZoneCreate: (zone: Partial<Zone>) => void;
  readonly?: boolean;
}

export interface Zone {
  id: string;
  coordinates: ZoneCoordinates;
  bounds: ZoneBounds; // Added for compatibility with confidence visualization
  contentType: 'text' | 'table' | 'diagram' | 'mixed' | 'header' | 'footer';
  confidence: number;
  characteristics: ContentCharacteristics;
  assignedTool?: string;
  fallbackTools: string[];
  status: 'detected' | 'confirmed' | 'processing' | 'completed' | 'failed';
  pageNumber: number;
  textContent?: string;
  processingResults?: ProcessingResult[];
  userModified: boolean;
  lastModified: Date;
}

export interface ZoneBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ZoneCoordinates {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
}

export interface ContentCharacteristics {
  textDensity: number;
  lineSpacing: number;
  wordSpacing: number;
  fontSizes: number[];
  hasStructure: boolean;
  hasImages: boolean;
  complexity: 'low' | 'medium' | 'high';
  readingOrder: number;
  language?: string;
}

export interface ProcessingTool {
  name: string;
  displayName: string;
  description: string;
  supportedTypes: string[];
  accuracy: number;
  speed: number;
  icon?: string;
}

export interface SplitPoint {
  x: number;
  y: number;
  type: 'horizontal' | 'vertical';
}

export interface ProcessingResult {
  toolName: string;
  content: string;
  confidence: number;
  processingTime: number;
  metadata: Record<string, any>;
}

export interface ContentAnalysisResult {
  zones: DetectedZone[];
  confidence: number;
  analysisMethod: string;
  processingTime: number;
}

// Zone editing modes
type EditMode = 'select' | 'create' | 'resize' | 'move' | 'split' | 'merge';

interface ZoneInteraction {
  isEditing: boolean;
  editMode: EditMode;
  dragStart?: { x: number; y: number };
  resizeHandle?: string;
  selectedZones: Set<string>;
}

export function ZoneManager({
  zones,
  selectedZone,
  onZoneUpdate,
  onToolAssignment,
  onZoneMerge,
  onZoneSplit,
  availableTools,
  contentAnalysisResults,
  pdfUrl,
  currentPage,
  onZoneSelect,
  onZoneCreate,
  readonly = false
}: ZoneManagerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [interaction, setInteraction] = useState<ZoneInteraction>({
    isEditing: false,
    editMode: 'select',
    selectedZones: new Set()
  });
  
  const [showToolPanel, setShowToolPanel] = useState(false);
  const [showConfidenceOverlay, setShowConfidenceOverlay] = useState(true);
  const [zoneFilter, setZoneFilter] = useState<string>('all');
  const [scale, setScale] = useState(1.0);

  // Filter zones for current page and ensure bounds property
  const currentPageZones = zones.filter(zone => zone.pageNumber === currentPage).map(zone => ({
    ...zone,
    bounds: zone.bounds || {
      x: zone.coordinates.x,
      y: zone.coordinates.y,
      width: zone.coordinates.width,
      height: zone.coordinates.height
    }
  }));

  // Render zones on canvas
  const renderZones = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Render each zone
    currentPageZones.forEach(zone => {
      const isSelected = selectedZone === zone.id || interaction.selectedZones.has(zone.id);
      renderZone(ctx, zone, isSelected);
    });

    // Render confidence overlay if enabled
    if (showConfidenceOverlay) {
      renderConfidenceOverlay(ctx, currentPageZones);
    }
  }, [currentPageZones, selectedZone, interaction.selectedZones, showConfidenceOverlay, scale]);

  const renderZone = (ctx: CanvasRenderingContext2D, zone: Zone, isSelected: boolean) => {
    const coords = zone.coordinates;
    
    // Apply scaling
    const x = coords.x * scale;
    const y = coords.y * scale;
    const width = coords.width * scale;
    const height = coords.height * scale;

    // Zone background
    ctx.fillStyle = getZoneColor(zone, isSelected);
    ctx.fillRect(x, y, width, height);

    // Zone border
    ctx.strokeStyle = isSelected ? '#2563eb' : getZoneBorderColor(zone);
    ctx.lineWidth = isSelected ? 3 : 1;
    ctx.strokeRect(x, y, width, height);

    // Zone type indicator
    renderZoneTypeIndicator(ctx, zone, x, y);

    // Confidence indicator
    renderConfidenceIndicator(ctx, zone, x + width - 30, y + 5);

    // Tool assignment indicator
    if (zone.assignedTool) {
      renderToolIndicator(ctx, zone, x + 5, y + height - 25);
    }

    // Resize handles for selected zones
    if (isSelected && !readonly) {
      renderResizeHandles(ctx, x, y, width, height);
    }
  };

  const getZoneColor = (zone: Zone, isSelected: boolean): string => {
    if (isSelected) return 'rgba(37, 99, 235, 0.3)';
    
    const colorMap: Record<string, string> = {
      text: 'rgba(34, 197, 94, 0.2)',
      table: 'rgba(168, 85, 247, 0.2)',
      diagram: 'rgba(249, 115, 22, 0.2)',
      mixed: 'rgba(156, 163, 175, 0.2)',
      header: 'rgba(59, 130, 246, 0.2)',
      footer: 'rgba(239, 68, 68, 0.2)'
    };
    
    return colorMap[zone.contentType] || 'rgba(156, 163, 175, 0.2)';
  };

  const getZoneBorderColor = (zone: Zone): string => {
    const colorMap: Record<string, string> = {
      text: '#22c55e',
      table: '#a855f7',
      diagram: '#f97316',
      mixed: '#9ca3af',
      header: '#3b82f6',
      footer: '#ef4444'
    };
    
    return colorMap[zone.contentType] || '#9ca3af';
  };

  const renderZoneTypeIndicator = (
    ctx: CanvasRenderingContext2D, 
    zone: Zone, 
    x: number, 
    y: number
  ) => {
    const iconMap: Record<string, string> = {
      text: 'T',
      table: '⊞',
      diagram: '◊',
      mixed: '⊡',
      header: 'H',
      footer: 'F'
    };

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x + 2, y + 2, 20, 20);
    
    ctx.fillStyle = getZoneBorderColor(zone);
    ctx.font = '14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(iconMap[zone.contentType] || '?', x + 12, y + 16);
  };

  const renderConfidenceIndicator = (
    ctx: CanvasRenderingContext2D,
    zone: Zone,
    x: number,
    y: number
  ) => {
    const confidence = zone.confidence;
    const color = confidence > 0.8 ? '#22c55e' : 
                 confidence > 0.6 ? '#eab308' : '#ef4444';

    // Confidence bar background
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.fillRect(x, y, 25, 15);

    // Confidence bar
    ctx.fillStyle = color;
    ctx.fillRect(x + 2, y + 2, (confidence * 21), 11);

    // Confidence text
    ctx.fillStyle = '#000000';
    ctx.font = '10px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`${Math.round(confidence * 100)}%`, x + 12, y + 25);
  };

  const renderToolIndicator = (
    ctx: CanvasRenderingContext2D,
    zone: Zone,
    x: number,
    y: number
  ) => {
    if (!zone.assignedTool) return;

    const tool = availableTools.find(t => t.name === zone.assignedTool);
    const toolName = tool?.displayName || zone.assignedTool;

    // Tool background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(x, y, 80, 18);

    // Tool text
    ctx.fillStyle = '#ffffff';
    ctx.font = '11px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(toolName.substring(0, 10), x + 3, y + 13);
  };

  const renderResizeHandles = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number
  ) => {
    const handleSize = 8;
    const handles = [
      { x: x - handleSize/2, y: y - handleSize/2, cursor: 'nw-resize' },
      { x: x + width/2 - handleSize/2, y: y - handleSize/2, cursor: 'n-resize' },
      { x: x + width - handleSize/2, y: y - handleSize/2, cursor: 'ne-resize' },
      { x: x + width - handleSize/2, y: y + height/2 - handleSize/2, cursor: 'e-resize' },
      { x: x + width - handleSize/2, y: y + height - handleSize/2, cursor: 'se-resize' },
      { x: x + width/2 - handleSize/2, y: y + height - handleSize/2, cursor: 's-resize' },
      { x: x - handleSize/2, y: y + height - handleSize/2, cursor: 'sw-resize' },
      { x: x - handleSize/2, y: y + height/2 - handleSize/2, cursor: 'w-resize' }
    ];

    handles.forEach(handle => {
      ctx.fillStyle = '#2563eb';
      ctx.fillRect(handle.x, handle.y, handleSize, handleSize);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.strokeRect(handle.x, handle.y, handleSize, handleSize);
    });
  };

  const renderConfidenceOverlay = (ctx: CanvasRenderingContext2D, zones: Zone[]) => {
    // Create a heat map overlay based on confidence scores
    zones.forEach(zone => {
      const coords = zone.coordinates;
      const x = coords.x * scale;
      const y = coords.y * scale;
      const width = coords.width * scale;
      const height = coords.height * scale;

      const alpha = (1 - zone.confidence) * 0.4; // Lower confidence = more visible overlay
      ctx.fillStyle = `rgba(255, 0, 0, ${alpha})`;
      ctx.fillRect(x, y, width, height);
    });
  };

  // Mouse event handlers
  const handleMouseDown = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    if (readonly) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) / scale;
    const y = (event.clientY - rect.top) / scale;

    const clickedZone = findZoneAtPoint(x, y, currentPageZones);

    if (interaction.editMode === 'select') {
      if (clickedZone) {
        onZoneSelect(clickedZone.id);
        if (event.ctrlKey || event.metaKey) {
          // Multi-select
          const newSelected = new Set(interaction.selectedZones);
          if (newSelected.has(clickedZone.id)) {
            newSelected.delete(clickedZone.id);
          } else {
            newSelected.add(clickedZone.id);
          }
          setInteraction(prev => ({ ...prev, selectedZones: newSelected }));
        }
      } else {
        onZoneSelect(null);
        setInteraction(prev => ({ ...prev, selectedZones: new Set() }));
      }
    } else if (interaction.editMode === 'create') {
      // Start creating new zone
      setInteraction(prev => ({
        ...prev,
        isEditing: true,
        dragStart: { x, y }
      }));
    }
  }, [readonly, interaction.editMode, currentPageZones, scale, onZoneSelect]);

  const handleMouseMove = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!interaction.isEditing || readonly) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) / scale;
    const y = (event.clientY - rect.top) / scale;

    if (interaction.editMode === 'create' && interaction.dragStart) {
      // Preview new zone
      const ctx = canvas.getContext('2d');
      if (ctx) {
        renderZones(); // Re-render existing zones
        
        // Draw preview zone
        const width = x - interaction.dragStart.x;
        const height = y - interaction.dragStart.y;
        
        ctx.strokeStyle = '#2563eb';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.strokeRect(interaction.dragStart.x * scale, interaction.dragStart.y * scale, 
                      width * scale, height * scale);
        ctx.setLineDash([]);
      }
    }
  }, [interaction, readonly, scale, renderZones]);

  const handleMouseUp = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!interaction.isEditing || readonly) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) / scale;
    const y = (event.clientY - rect.top) / scale;

    if (interaction.editMode === 'create' && interaction.dragStart) {
      const width = Math.abs(x - interaction.dragStart.x);
      const height = Math.abs(y - interaction.dragStart.y);
      
      if (width > 10 && height > 10) { // Minimum zone size
        const newZone: Partial<Zone> = {
          coordinates: {
            x: Math.min(x, interaction.dragStart.x),
            y: Math.min(y, interaction.dragStart.y),
            width,
            height
          },
          bounds: {
            x: Math.min(x, interaction.dragStart.x),
            y: Math.min(y, interaction.dragStart.y),
            width,
            height
          },
          contentType: 'text', // Default type
          confidence: 0.8,
          pageNumber: currentPage,
          status: 'detected',
          userModified: true,
          lastModified: new Date()
        };
        
        onZoneCreate(newZone);
      }
    }

    setInteraction(prev => ({
      ...prev,
      isEditing: false,
      dragStart: undefined
    }));
  }, [interaction, readonly, scale, currentPage, onZoneCreate]);

  const findZoneAtPoint = (x: number, y: number, zones: Zone[]): Zone | null => {
    // Find zone from back to front (reverse order for proper hit testing)
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

  // Tool assignment handlers
  const handleToolAssignment = (zoneId: string, toolName: string) => {
    onToolAssignment(zoneId, toolName);
    setShowToolPanel(false);
  };

  const handleZoneMerge = () => {
    if (interaction.selectedZones.size >= 2) {
      onZoneMerge(Array.from(interaction.selectedZones));
      setInteraction(prev => ({ ...prev, selectedZones: new Set() }));
    }
  };

  const handleZoneDelete = (zoneId: string) => {
    if (window.confirm('Are you sure you want to delete this zone?')) {
      onZoneUpdate(zoneId, { status: 'failed' }); // Soft delete
    }
  };

  // Filter zones based on current filter
  const filteredZones = currentPageZones.filter(zone => {
    if (zoneFilter === 'all') return true;
    return zone.contentType === zoneFilter;
  });

  // Update canvas size and re-render when zones change
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    // Set canvas size to match container
    const rect = container.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    renderZones();
  }, [zones, currentPage, renderZones]);

  const selectedZoneData = selectedZone ? zones.find(z => z.id === selectedZone) : null;

  return (
    <div className="zone-manager flex flex-col h-full">
      {/* Toolbar */}
      <div className="zone-toolbar flex items-center gap-2 p-2 border-b bg-gray-50">
        <div className="edit-modes flex gap-1">
          <Button
            variant={interaction.editMode === 'select' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setInteraction(prev => ({ ...prev, editMode: 'select' }))}
            disabled={readonly}
          >
            Select
          </Button>
          <Button
            variant={interaction.editMode === 'create' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setInteraction(prev => ({ ...prev, editMode: 'create' }))}
            disabled={readonly}
          >
            Create
          </Button>
        </div>

        <div className="separator w-px h-6 bg-gray-300" />

        <div className="zone-filters flex gap-1">
          <select
            value={zoneFilter}
            onChange={(e) => setZoneFilter(e.target.value)}
            className="px-2 py-1 text-sm border rounded"
          >
            <option value="all">All Types</option>
            <option value="text">Text</option>
            <option value="table">Table</option>
            <option value="diagram">Diagram</option>
            <option value="mixed">Mixed</option>
          </select>
        </div>

        <div className="separator w-px h-6 bg-gray-300" />

        <div className="view-options flex gap-1">
          <Button
            variant={showConfidenceOverlay ? 'default' : 'outline'}
            size="sm"
            onClick={() => setShowConfidenceOverlay(!showConfidenceOverlay)}
          >
            Confidence
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowToolPanel(!showToolPanel)}
            disabled={!selectedZone}
          >
            Tools
          </Button>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <span className="text-sm text-gray-600">
            {filteredZones.length} zones
          </span>
          <div className="zoom-controls flex gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setScale(prev => Math.min(3, prev + 0.25))}
            >
              +
            </Button>
            <span className="px-2 text-sm">{Math.round(scale * 100)}%</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setScale(prev => Math.max(0.25, prev - 0.25))}
            >
              -
            </Button>
          </div>
        </div>
      </div>

      {/* Main content area */}
      <div className="zone-content flex flex-1 overflow-hidden">
        {/* Zone canvas */}
        <div ref={containerRef} className="zone-canvas flex-1 relative overflow-auto">
          <canvas
            ref={canvasRef}
            className="absolute inset-0 cursor-crosshair"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
          />
        </div>

        {/* Zone details panel */}
        {selectedZoneData && (
          <div className="zone-details w-80 border-l bg-white flex flex-col">
            <ZoneDetailsPanel
              zone={selectedZoneData}
              availableTools={availableTools}
              onUpdate={(updates) => onZoneUpdate(selectedZoneData.id, updates)}
              onToolAssign={(toolName) => handleToolAssignment(selectedZoneData.id, toolName)}
              onDelete={() => handleZoneDelete(selectedZoneData.id)}
              readonly={readonly}
            />
          </div>
        )}

        {/* Tool assignment panel */}
        {showToolPanel && selectedZone && (
          <div className="tool-panel w-64 border-l bg-white">
            <ToolAssignmentPanel
              zoneId={selectedZone}
              availableTools={availableTools}
              currentTool={selectedZoneData?.assignedTool}
              onAssign={handleToolAssignment}
              onClose={() => setShowToolPanel(false)}
            />
          </div>
        )}
      </div>

      {/* Status bar */}
      <div className="status-bar flex items-center justify-between p-2 border-t bg-gray-50 text-sm text-gray-600">
        <div className="flex items-center gap-4">
          <span>Page {currentPage}</span>
          {interaction.selectedZones.size > 0 && (
            <span>{interaction.selectedZones.size} selected</span>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {interaction.selectedZones.size >= 2 && !readonly && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleZoneMerge}
            >
              Merge Selected
            </Button>
          )}
          <span>Mode: {interaction.editMode}</span>
        </div>
      </div>
    </div>
  );
}

// Zone Details Panel Component
interface ZoneDetailsPanelProps {
  zone: Zone;
  availableTools: ProcessingTool[];
  onUpdate: (updates: Partial<Zone>) => void;
  onToolAssign: (toolName: string) => void;
  onDelete: () => void;
  readonly: boolean;
}

function ZoneDetailsPanel({
  zone,
  availableTools,
  onUpdate,
  onToolAssign,
  onDelete,
  readonly
}: ZoneDetailsPanelProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedZone, setEditedZone] = useState<Partial<Zone>>(zone);

  const handleSave = () => {
    onUpdate(editedZone);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditedZone(zone);
    setIsEditing(false);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-medium">Zone Details</h3>
          {!readonly && (
            <div className="flex gap-1">
              {isEditing ? (
                <>
                  <Button size="sm" onClick={handleSave}>Save</Button>
                  <Button size="sm" variant="outline" onClick={handleCancel}>Cancel</Button>
                </>
              ) : (
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={() => setIsEditing(true)}
                >
                  Edit
                </Button>
              )}
            </div>
          )}
        </div>
        
        <div className="space-y-2 text-sm">
          <div>
            <span className="font-medium">ID:</span> {zone.id}
          </div>
          <div>
            <span className="font-medium">Type:</span>
            {isEditing ? (
              <select
                value={editedZone.contentType}
                onChange={(e) => setEditedZone(prev => ({ 
                  ...prev, 
                  contentType: e.target.value as Zone['contentType']
                }))}
                className="ml-2 px-1 py-0.5 border rounded text-xs"
              >
                <option value="text">Text</option>
                <option value="table">Table</option>
                <option value="diagram">Diagram</option>
                <option value="mixed">Mixed</option>
                <option value="header">Header</option>
                <option value="footer">Footer</option>
              </select>
            ) : (
              <span className="ml-2 px-2 py-1 bg-gray-100 rounded text-xs">
                {zone.contentType}
              </span>
            )}
          </div>
          <div>
            <span className="font-medium">Confidence:</span>
            <span className="ml-2">{Math.round(zone.confidence * 100)}%</span>
          </div>
          <div>
            <span className="font-medium">Status:</span>
            <span className={`ml-2 px-2 py-1 rounded text-xs ${
              zone.status === 'completed' ? 'bg-green-100 text-green-700' :
              zone.status === 'processing' ? 'bg-blue-100 text-blue-700' :
              zone.status === 'failed' ? 'bg-red-100 text-red-700' :
              'bg-gray-100 text-gray-700'
            }`}>
              {zone.status}
            </span>
          </div>
        </div>
      </div>

      <div className="p-4 border-b">
        <h4 className="font-medium mb-2">Coordinates</h4>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>X: {Math.round(zone.coordinates.x)}</div>
          <div>Y: {Math.round(zone.coordinates.y)}</div>
          <div>W: {Math.round(zone.coordinates.width)}</div>
          <div>H: {Math.round(zone.coordinates.height)}</div>
        </div>
      </div>

      <div className="p-4 border-b">
        <h4 className="font-medium mb-2">Tool Assignment</h4>
        <div className="space-y-2">
          {zone.assignedTool ? (
            <div className="flex items-center justify-between">
              <span className="text-sm">
                {availableTools.find(t => t.name === zone.assignedTool)?.displayName || zone.assignedTool}
              </span>
              {!readonly && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onToolAssign('')}
                >
                  Remove
                </Button>
              )}
            </div>
          ) : (
            <div className="text-sm text-gray-500">No tool assigned</div>
          )}
          
          {!readonly && (
            <select
              onChange={(e) => e.target.value && onToolAssign(e.target.value)}
              value=""
              className="w-full px-2 py-1 text-sm border rounded"
            >
              <option value="">Select tool...</option>
              {availableTools
                .filter(tool => tool.supportedTypes.includes(zone.contentType))
                .map(tool => (
                  <option key={tool.name} value={tool.name}>
                    {tool.displayName}
                  </option>
                ))}
            </select>
          )}
        </div>
      </div>

      {zone.characteristics && (
        <div className="p-4 border-b">
          <h4 className="font-medium mb-2">Characteristics</h4>
          <div className="space-y-1 text-sm">
            <div>Text Density: {zone.characteristics.textDensity.toFixed(2)}</div>
            <div>Complexity: {zone.characteristics.complexity}</div>
            <div>Has Structure: {zone.characteristics.hasStructure ? 'Yes' : 'No'}</div>
            <div>Has Images: {zone.characteristics.hasImages ? 'Yes' : 'No'}</div>
            {zone.characteristics.language && (
              <div>Language: {zone.characteristics.language}</div>
            )}
          </div>
        </div>
      )}

      {zone.textContent && (
        <div className="p-4 flex-1 overflow-auto">
          <h4 className="font-medium mb-2">Text Content</h4>
          <div className="text-sm bg-gray-50 p-2 rounded max-h-32 overflow-auto">
            {zone.textContent}
          </div>
        </div>
      )}

      {!readonly && (
        <div className="p-4 border-t">
          <Button
            variant="outline"
            size="sm"
            onClick={onDelete}
            className="w-full text-red-600 hover:text-red-700"
          >
            Delete Zone
          </Button>
        </div>
      )}
    </div>
  );
}

// Tool Assignment Panel Component
interface ToolAssignmentPanelProps {
  zoneId: string;
  availableTools: ProcessingTool[];
  currentTool?: string;
  onAssign: (zoneId: string, toolName: string) => void;
  onClose: () => void;
}

function ToolAssignmentPanel({
  zoneId,
  availableTools,
  currentTool,
  onAssign,
  onClose
}: ToolAssignmentPanelProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b flex items-center justify-between">
        <h3 className="text-lg font-medium">Tool Assignment</h3>
        <Button variant="outline" size="sm" onClick={onClose}>×</Button>
      </div>

      <div className="flex-1 overflow-auto p-4">
        <div className="space-y-3">
          {availableTools.map(tool => (
            <div
              key={tool.name}
              className={`p-3 border rounded cursor-pointer transition-colors ${
                currentTool === tool.name 
                  ? 'border-blue-500 bg-blue-50' 
                  : 'hover:border-gray-300'
              }`}
              onClick={() => onAssign(zoneId, tool.name)}
            >
              <div className="font-medium">{tool.displayName}</div>
              <div className="text-sm text-gray-600 mt-1">{tool.description}</div>
              <div className="flex justify-between mt-2 text-xs text-gray-500">
                <span>Accuracy: {Math.round(tool.accuracy * 100)}%</span>
                <span>Speed: {tool.speed}/10</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default ZoneManager; 