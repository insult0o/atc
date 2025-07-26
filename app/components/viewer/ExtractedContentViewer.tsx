'use client';

import React, { useRef, useEffect, useCallback, useState } from 'react';
import { Button } from '../../../components/ui/button';
import { Edit2, Save, X, Copy, Check } from 'lucide-react';
import type { Zone } from '@pdf-platform/shared';
import type { ExtractedContent, ContentFormatting } from './DualPaneViewer';

interface ExtractedContentViewerProps {
  content: ExtractedContent[];
  zones: Zone[];
  selectedZone: string | null;
  highlightVisible: boolean;
  onZoneSelect: (zoneId: string) => void;
  onContentEdit?: (zoneId: string, content: string) => void;
}

interface ContentBlock {
  zoneId: string;
  content: string;
  formatting: ContentFormatting;
  confidence: number;
  zone: Zone;
  isEditing: boolean;
  editedContent: string;
}

export function ExtractedContentViewer({
  content,
  zones,
  selectedZone,
  highlightVisible,
  onZoneSelect,
  onContentEdit
}: ExtractedContentViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [editingZones, setEditingZones] = useState<Set<string>>(new Set());
  const [editedContent, setEditedContent] = useState<Map<string, string>>(new Map());
  const [copiedZone, setCopiedZone] = useState<string | null>(null);

  // Prepare content blocks with zone data
  const contentBlocks: ContentBlock[] = content.map(item => {
    const zone = zones.find(z => z.id === item.zoneId);
    if (!zone) return null;
    
    return {
      ...item,
      zone,
      isEditing: editingZones.has(item.zoneId),
      editedContent: editedContent.get(item.zoneId) || item.content
    };
  }).filter(Boolean) as ContentBlock[];

  // Sort content blocks by reading order
  contentBlocks.sort((a, b) => {
    const pageA = a.zone.page || 0;
    const pageB = b.zone.page || 0;
    
    if (pageA !== pageB) return pageA - pageB;
    
    // Sort by Y position then X position for same page
    const yDiff = a.zone.coordinates.y - b.zone.coordinates.y;
    if (Math.abs(yDiff) > 10) return yDiff;
    
    return a.zone.coordinates.x - b.zone.coordinates.x;
  });

  // Scroll to selected zone
  useEffect(() => {
    if (selectedZone && contentRefs.current.has(selectedZone)) {
      const element = contentRefs.current.get(selectedZone);
      element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [selectedZone]);

  // Handle content click for zone selection
  const handleContentClick = useCallback((zoneId: string) => {
    onZoneSelect(zoneId);
  }, [onZoneSelect]);

  // Edit mode handlers
  const startEditing = useCallback((zoneId: string) => {
    const currentContent = content.find(c => c.zoneId === zoneId)?.content || '';
    setEditingZones(prev => new Set(prev).add(zoneId));
    setEditedContent(prev => new Map(prev).set(zoneId, currentContent));
  }, [content]);

  const cancelEditing = useCallback((zoneId: string) => {
    setEditingZones(prev => {
      const newSet = new Set(prev);
      newSet.delete(zoneId);
      return newSet;
    });
    setEditedContent(prev => {
      const newMap = new Map(prev);
      newMap.delete(zoneId);
      return newMap;
    });
  }, []);

  const saveEditing = useCallback((zoneId: string) => {
    const newContent = editedContent.get(zoneId);
    if (newContent !== undefined && onContentEdit) {
      onContentEdit(zoneId, newContent);
    }
    cancelEditing(zoneId);
  }, [editedContent, onContentEdit, cancelEditing]);

  const handleContentChange = useCallback((zoneId: string, value: string) => {
    setEditedContent(prev => new Map(prev).set(zoneId, value));
  }, []);

  // Copy content handler
  const copyContent = useCallback(async (zoneId: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedZone(zoneId);
      setTimeout(() => setCopiedZone(null), 2000);
    } catch (err) {
      console.error('Failed to copy text:', err);
    }
  }, []);

  // Render formatted content
  const renderFormattedContent = (block: ContentBlock) => {
    const { formatting } = block;
    const style: React.CSSProperties = {
      fontSize: formatting.fontSize || 14,
      fontFamily: formatting.fontFamily || 'inherit',
      fontWeight: formatting.bold ? 'bold' : 'normal',
      fontStyle: formatting.italic ? 'italic' : 'normal',
      textAlign: formatting.alignment || 'left',
      paddingLeft: formatting.indentation ? `${formatting.indentation}px` : undefined,
      lineHeight: formatting.lineHeight || 1.5,
    };

    if (block.isEditing) {
      return (
        <textarea
          className="w-full min-h-[100px] p-2 border rounded resize-y"
          value={block.editedContent}
          onChange={(e) => handleContentChange(block.zoneId, e.target.value)}
          style={style}
          autoFocus
        />
      );
    }

    // Handle different content types
    const contentType = block.zone.type || 'text';
    
    if (contentType === 'table') {
      return renderTableContent(block.content, style);
    } else if (contentType === 'list') {
      return renderListContent(block.content, style);
    } else {
      return (
        <div style={style} className="whitespace-pre-wrap">
          {block.content}
        </div>
      );
    }
  };

  // Render table content
  const renderTableContent = (content: string, baseStyle: React.CSSProperties) => {
    try {
      // Try to parse as JSON table data
      const tableData = JSON.parse(content);
      if (Array.isArray(tableData) && tableData.length > 0) {
        return (
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse">
              <thead>
                <tr>
                  {Object.keys(tableData[0]).map((header, idx) => (
                    <th
                      key={idx}
                      className="border border-gray-300 px-2 py-1 bg-gray-50 text-left"
                      style={baseStyle}
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tableData.map((row, rowIdx) => (
                  <tr key={rowIdx}>
                    {Object.values(row).map((cell, cellIdx) => (
                      <td
                        key={cellIdx}
                        className="border border-gray-300 px-2 py-1"
                        style={baseStyle}
                      >
                        {String(cell)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }
    } catch {
      // Fall back to pre-formatted text
    }
    
    return (
      <pre style={baseStyle} className="overflow-x-auto">
        {content}
      </pre>
    );
  };

  // Render list content
  const renderListContent = (content: string, baseStyle: React.CSSProperties) => {
    const lines = content.split('\n').filter(line => line.trim());
    const isOrdered = lines.some(line => /^\d+[.)]\s/.test(line));
    
    const ListTag = isOrdered ? 'ol' : 'ul';
    const listItems = lines.map(line => {
      // Remove bullet points or numbers
      return line.replace(/^[-*•]\s+/, '').replace(/^\d+[.)]\s+/, '');
    });
    
    return (
      <ListTag className={isOrdered ? 'list-decimal' : 'list-disc'} style={baseStyle}>
        {listItems.map((item, idx) => (
          <li key={idx} className="ml-4">
            {item}
          </li>
        ))}
      </ListTag>
    );
  };

  // Get zone highlight color
  const getZoneHighlightColor = (block: ContentBlock) => {
    if (!highlightVisible) return 'transparent';
    if (selectedZone === block.zoneId) return 'rgba(59, 130, 246, 0.2)'; // blue
    if (block.confidence < 0.7) return 'rgba(239, 68, 68, 0.1)'; // red
    return 'rgba(16, 185, 129, 0.05)'; // green
  };

  // Get zone border color
  const getZoneBorderColor = (block: ContentBlock) => {
    if (!highlightVisible) return 'transparent';
    if (selectedZone === block.zoneId) return '#3b82f6'; // blue
    if (block.confidence < 0.7) return '#ef4444'; // red
    return 'transparent';
  };

  return (
    <div 
      ref={containerRef}
      className="extracted-content-viewer h-full overflow-y-auto bg-background"
    >
      <div className="max-w-4xl mx-auto p-6 space-y-4">
        {contentBlocks.map((block) => (
          <div
            key={block.zoneId}
            ref={(el) => {
              if (el) contentRefs.current.set(block.zoneId, el);
              else contentRefs.current.delete(block.zoneId);
            }}
            className={`content-block relative group rounded-lg transition-all duration-200 ${
              selectedZone === block.zoneId ? 'ring-2 ring-primary' : ''
            }`}
            style={{
              backgroundColor: getZoneHighlightColor(block),
              borderLeft: `4px solid ${getZoneBorderColor(block)}`,
              paddingLeft: highlightVisible ? '1rem' : '0'
            }}
            onClick={() => handleContentClick(block.zoneId)}
          >
            {/* Zone info header */}
            {highlightVisible && (
              <div className="flex items-center justify-between mb-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{block.zone.type || 'text'}</span>
                  <span className="px-1.5 py-0.5 bg-muted rounded">
                    {Math.round(block.confidence * 100)}%
                  </span>
                  <span>Page {block.zone.page || 1}</span>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {/* Copy button */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      copyContent(block.zoneId, block.content);
                    }}
                  >
                    {copiedZone === block.zoneId ? (
                      <Check className="w-3 h-3 text-green-600" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                  </Button>
                  
                  {/* Edit button */}
                  {onContentEdit && !block.isEditing && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        startEditing(block.zoneId);
                      }}
                    >
                      <Edit2 className="w-3 h-3" />
                    </Button>
                  )}
                  
                  {/* Save/Cancel buttons */}
                  {block.isEditing && (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          saveEditing(block.zoneId);
                        }}
                      >
                        <Save className="w-3 h-3 text-green-600" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          cancelEditing(block.zoneId);
                        }}
                      >
                        <X className="w-3 h-3 text-red-600" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            )}
            
            {/* Content */}
            <div className="content-body">
              {renderFormattedContent(block)}
            </div>
            
            {/* Confidence indicator for low confidence zones */}
            {block.confidence < 0.7 && highlightVisible && (
              <div className="mt-2 text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded inline-block">
                Low confidence - review recommended
              </div>
            )}
          </div>
        ))}
        
        {contentBlocks.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            No extracted content available
          </div>
        )}
      </div>
    </div>
  );
}