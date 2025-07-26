'use client';

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Zone } from '../zones/ZoneManager';
import { toolAssignmentEngine, ToolCapabilities } from '../../../lib/pdf-processing/tool-assignment';

// Interfaces for tool selection
export interface Tool {
  name: string;
  displayName: string;
  icon: React.ReactNode;
  description: string;
  capabilities: ToolCapabilities;
  supportedContentTypes: string[];
  performance: {
    speed: 'very_fast' | 'fast' | 'medium' | 'slow' | 'very_slow';
    accuracy: number;
    memoryUsage: number;
  };
  status: 'available' | 'busy' | 'unavailable';
  costEstimate?: number;
}

export interface ToolSelectorProps {
  zone: Zone | null;
  selectedZones?: Zone[];
  currentTool?: string;
  onToolSelect: (toolName: string, zones?: Zone[]) => void;
  onPreview?: (toolName: string) => void;
  onBatchAssign?: (toolName: string, zones: Zone[]) => void;
  availableTools?: Tool[];
  showRecommendations?: boolean;
  showCostEstimates?: boolean;
  className?: string;
}

export interface ToolRecommendation {
  toolName: string;
  score: number;
  reasons: string[];
  expectedAccuracy: number;
  processingTime: number;
}

// Available tools configuration
const DEFAULT_TOOLS: Tool[] = [
  {
    name: 'unstructured',
    displayName: 'Unstructured',
    icon: <span className="text-lg">📄</span>,
    description: 'General-purpose text extraction with layout analysis',
    capabilities: {
      supportedContentTypes: ['text', 'mixed', 'table'],
      maxDocumentSize: 100 * 1024 * 1024,
      accuracyRating: 0.95,
      speedRating: 0.85,
      memoryEfficiency: 0.90,
      complexity: 'low',
      languages: ['en', 'es', 'fr', 'de'],
      specialFeatures: ['layout_analysis', 'hierarchical_structure', 'metadata_extraction']
    },
    supportedContentTypes: ['text', 'mixed'],
    performance: { speed: 'fast', accuracy: 0.95, memoryUsage: 50 },
    status: 'available',
    costEstimate: 0.01
  },
  {
    name: 'pdfplumber',
    displayName: 'PDF Plumber',
    icon: <span className="text-lg">🔧</span>,
    description: 'Precise text and table extraction with coordinate mapping',
    capabilities: {
      supportedContentTypes: ['text', 'table'],
      maxDocumentSize: 50 * 1024 * 1024,
      accuracyRating: 0.88,
      speedRating: 0.75,
      memoryEfficiency: 0.80,
      complexity: 'medium',
      languages: ['en'],
      specialFeatures: ['coordinate_precision', 'table_detection', 'line_analysis']
    },
    supportedContentTypes: ['text', 'table'],
    performance: { speed: 'medium', accuracy: 0.88, memoryUsage: 80 },
    status: 'available',
    costEstimate: 0.02
  },
  {
    name: 'camelot',
    displayName: 'Camelot',
    icon: <span className="text-lg">📊</span>,
    description: 'Advanced table extraction for complex layouts',
    capabilities: {
      supportedContentTypes: ['table'],
      maxDocumentSize: 20 * 1024 * 1024,
      accuracyRating: 0.95,
      speedRating: 0.50,
      memoryEfficiency: 0.60,
      complexity: 'high',
      languages: ['en'],
      specialFeatures: ['lattice_detection', 'stream_detection', 'complex_tables']
    },
    supportedContentTypes: ['table'],
    performance: { speed: 'slow', accuracy: 0.95, memoryUsage: 150 },
    status: 'available',
    costEstimate: 0.05
  },
  {
    name: 'tabula',
    displayName: 'Tabula',
    icon: <span className="text-lg">📋</span>,
    description: 'Fast table extraction for simple structures',
    capabilities: {
      supportedContentTypes: ['table'],
      maxDocumentSize: 30 * 1024 * 1024,
      accuracyRating: 0.88,
      speedRating: 0.80,
      memoryEfficiency: 0.85,
      complexity: 'medium',
      languages: ['en'],
      specialFeatures: ['stream_detection', 'simple_tables']
    },
    supportedContentTypes: ['table'],
    performance: { speed: 'fast', accuracy: 0.88, memoryUsage: 90 },
    status: 'available',
    costEstimate: 0.02
  },
  {
    name: 'visual_analyzer',
    displayName: 'Visual Analyzer',
    icon: <span className="text-lg">🖼️</span>,
    description: 'AI-powered visual content analysis',
    capabilities: {
      supportedContentTypes: ['diagram', 'image'],
      maxDocumentSize: 30 * 1024 * 1024,
      accuracyRating: 0.75,
      speedRating: 0.30,
      memoryEfficiency: 0.40,
      complexity: 'high',
      languages: ['en'],
      specialFeatures: ['image_processing', 'chart_recognition', 'ocr_integration']
    },
    supportedContentTypes: ['diagram', 'image'],
    performance: { speed: 'very_slow', accuracy: 0.75, memoryUsage: 300 },
    status: 'available',
    costEstimate: 0.10
  },
  {
    name: 'ocr_engine',
    displayName: 'OCR Engine',
    icon: <span className="text-lg">👁️</span>,
    description: 'Optical character recognition for scanned content',
    capabilities: {
      supportedContentTypes: ['diagram', 'text'],
      maxDocumentSize: 50 * 1024 * 1024,
      accuracyRating: 0.80,
      speedRating: 0.40,
      memoryEfficiency: 0.50,
      complexity: 'high',
      languages: ['en', 'es', 'fr', 'de', 'zh', 'ja'],
      specialFeatures: ['text_in_images', 'scanned_documents', 'handwriting_recognition']
    },
    supportedContentTypes: ['diagram', 'text', 'image'],
    performance: { speed: 'slow', accuracy: 0.80, memoryUsage: 200 },
    status: 'available',
    costEstimate: 0.08
  }
];

// Tool compatibility matrix
const TOOL_COMPATIBILITY: Record<string, string[]> = {
  text: ['unstructured', 'pdfplumber', 'ocr_engine'],
  table: ['camelot', 'tabula', 'pdfplumber', 'unstructured'],
  diagram: ['visual_analyzer', 'ocr_engine'],
  image: ['visual_analyzer', 'ocr_engine'],
  mixed: ['unstructured', 'pdfplumber']
};

export function ToolSelector({
  zone,
  selectedZones = [],
  currentTool,
  onToolSelect,
  onPreview,
  onBatchAssign,
  availableTools = DEFAULT_TOOLS,
  showRecommendations = true,
  showCostEstimates = true,
  className = ''
}: ToolSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [hoveredTool, setHoveredTool] = useState<string | null>(null);
  const [recommendations, setRecommendations] = useState<ToolRecommendation[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterByType, setFilterByType] = useState<string | null>(null);

  // Get zones for tool selection (single or multiple)
  const targetZones = useMemo(() => {
    if (selectedZones.length > 0) return selectedZones;
    if (zone) return [zone];
    return [];
  }, [zone, selectedZones]);

  // Get compatible tools for the selected zone(s)
  const compatibleTools = useMemo(() => {
    if (targetZones.length === 0) return availableTools;

    // Get content types from all selected zones
    const contentTypes = new Set(targetZones.map(z => z.contentType));
    
    // Find tools that support all content types
    return availableTools.filter(tool => {
      const supportedTypes = new Set(tool.supportedContentTypes);
      return Array.from(contentTypes).every(type => supportedTypes.has(type));
    });
  }, [targetZones, availableTools]);

  // Filter tools based on search and type filter
  const filteredTools = useMemo(() => {
    let tools = compatibleTools;

    // Apply search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      tools = tools.filter(tool => 
        tool.displayName.toLowerCase().includes(term) ||
        tool.description.toLowerCase().includes(term) ||
        tool.capabilities.specialFeatures.some(f => f.toLowerCase().includes(term))
      );
    }

    // Apply type filter
    if (filterByType) {
      tools = tools.filter(tool => tool.supportedContentTypes.includes(filterByType));
    }

    return tools;
  }, [compatibleTools, searchTerm, filterByType]);

  // Get tool recommendations
  useEffect(() => {
    if (!showRecommendations || targetZones.length === 0) return;

    const getRecommendations = async () => {
      try {
        // Simulate tool recommendation based on zone characteristics
        const recs: ToolRecommendation[] = filteredTools.map(tool => {
          let score = 0;
          const reasons: string[] = [];

          // Score based on content type match
          targetZones.forEach(z => {
            if (tool.supportedContentTypes.includes(z.contentType)) {
              score += 0.3;
              reasons.push(`Supports ${z.contentType} content`);
            }
          });

          // Score based on accuracy
          score += tool.performance.accuracy * 0.4;
          if (tool.performance.accuracy > 0.9) {
            reasons.push('High accuracy');
          }

          // Score based on speed
          if (tool.performance.speed === 'very_fast' || tool.performance.speed === 'fast') {
            score += 0.2;
            reasons.push('Fast processing');
          }

          // Score based on complexity match
          const avgConfidence = targetZones.reduce((sum, z) => sum + z.confidence, 0) / targetZones.length;
          if (avgConfidence < 0.7 && tool.name === 'ocr_engine') {
            score += 0.1;
            reasons.push('Good for low-confidence content');
          }

          return {
            toolName: tool.name,
            score,
            reasons,
            expectedAccuracy: tool.performance.accuracy,
            processingTime: getProcessingTimeEstimate(tool.performance.speed)
          };
        });

        // Sort by score
        recs.sort((a, b) => b.score - a.score);
        setRecommendations(recs.slice(0, 3));
      } catch (error) {
        console.error('Failed to get tool recommendations:', error);
      }
    };

    getRecommendations();
  }, [targetZones, filteredTools, showRecommendations]);

  // Handle tool selection
  const handleToolSelect = useCallback((toolName: string) => {
    if (targetZones.length > 1 && onBatchAssign) {
      onBatchAssign(toolName, targetZones);
    } else {
      onToolSelect(toolName, targetZones);
    }
    setIsOpen(false);
  }, [targetZones, onToolSelect, onBatchAssign]);

  // Handle tool preview
  const handleToolPreview = useCallback((toolName: string) => {
    if (onPreview) {
      onPreview(toolName);
    }
  }, [onPreview]);

  // Get processing time estimate
  const getProcessingTimeEstimate = (speed: string): number => {
    const speedMap: Record<string, number> = {
      very_fast: 100,
      fast: 200,
      medium: 500,
      slow: 1000,
      very_slow: 2000
    };
    return speedMap[speed] || 500;
  };

  // Get speed badge color
  const getSpeedBadgeColor = (speed: string): string => {
    const colorMap: Record<string, string> = {
      very_fast: 'bg-green-100 text-green-800',
      fast: 'bg-blue-100 text-blue-800',
      medium: 'bg-yellow-100 text-yellow-800',
      slow: 'bg-orange-100 text-orange-800',
      very_slow: 'bg-red-100 text-red-800'
    };
    return colorMap[speed] || 'bg-gray-100 text-gray-800';
  };

  // Get accuracy badge color
  const getAccuracyBadgeColor = (accuracy: number): string => {
    if (accuracy >= 0.9) return 'bg-green-100 text-green-800';
    if (accuracy >= 0.8) return 'bg-blue-100 text-blue-800';
    if (accuracy >= 0.7) return 'bg-yellow-100 text-yellow-800';
    return 'bg-orange-100 text-orange-800';
  };

  if (targetZones.length === 0) {
    return (
      <div className={`text-sm text-gray-500 ${className}`}>
        Select a zone to choose extraction tool
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      {/* Tool selector button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-2 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <div className="flex items-center space-x-2">
          {currentTool ? (
            <>
              {availableTools.find(t => t.name === currentTool)?.icon}
              <span className="text-sm font-medium">
                {availableTools.find(t => t.name === currentTool)?.displayName || currentTool}
              </span>
            </>
          ) : (
            <span className="text-sm text-gray-500">Select extraction tool...</span>
          )}
        </div>
        <svg className={`w-5 h-5 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown panel */}
      {isOpen && (
        <div className="absolute z-50 mt-2 w-96 bg-white rounded-lg shadow-lg border border-gray-200 max-h-96 overflow-hidden">
          {/* Search and filters */}
          <div className="p-3 border-b border-gray-200">
            <input
              type="text"
              placeholder="Search tools..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            
            {/* Content type filter */}
            <div className="mt-2 flex items-center space-x-2">
              <span className="text-xs text-gray-500">Filter by type:</span>
              <div className="flex space-x-1">
                {['text', 'table', 'diagram'].map(type => (
                  <button
                    key={type}
                    onClick={() => setFilterByType(filterByType === type ? null : type)}
                    className={`px-2 py-1 text-xs rounded ${
                      filterByType === type
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Recommendations section */}
          {showRecommendations && recommendations.length > 0 && (
            <div className="p-3 bg-blue-50 border-b border-blue-200">
              <div className="text-xs font-medium text-blue-900 mb-2">Recommended Tools</div>
              <div className="space-y-1">
                {recommendations.slice(0, 2).map(rec => {
                  const tool = availableTools.find(t => t.name === rec.toolName);
                  if (!tool) return null;
                  
                  return (
                    <button
                      key={tool.name}
                      onClick={() => handleToolSelect(tool.name)}
                      className="w-full flex items-center justify-between p-2 text-sm bg-white rounded hover:bg-blue-100 transition-colors"
                    >
                      <div className="flex items-center space-x-2">
                        {tool.icon}
                        <span className="font-medium">{tool.displayName}</span>
                        <span className="text-xs text-blue-600">
                          {Math.round(rec.score * 100)}% match
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Tools list */}
          <div className="overflow-y-auto max-h-64">
            {filteredTools.length === 0 ? (
              <div className="p-4 text-center text-sm text-gray-500">
                No compatible tools found
              </div>
            ) : (
              <div className="p-2">
                {filteredTools.map(tool => (
                  <div
                    key={tool.name}
                    onMouseEnter={() => setHoveredTool(tool.name)}
                    onMouseLeave={() => setHoveredTool(null)}
                    className="relative"
                  >
                    <button
                      onClick={() => handleToolSelect(tool.name)}
                      disabled={tool.status === 'unavailable'}
                      className={`w-full text-left p-3 rounded-md transition-colors ${
                        tool.status === 'unavailable'
                          ? 'opacity-50 cursor-not-allowed'
                          : 'hover:bg-gray-50 cursor-pointer'
                      } ${currentTool === tool.name ? 'bg-blue-50 border border-blue-200' : ''}`}
                    >
                      <div className="flex items-start space-x-3">
                        <div className="flex-shrink-0 mt-0.5">{tool.icon}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <h4 className="text-sm font-medium text-gray-900">
                              {tool.displayName}
                            </h4>
                            <div className="flex items-center space-x-2">
                              {/* Speed badge */}
                              <span className={`px-2 py-1 text-xs rounded-full ${getSpeedBadgeColor(tool.performance.speed)}`}>
                                {tool.performance.speed.replace('_', ' ')}
                              </span>
                              
                              {/* Accuracy badge */}
                              <span className={`px-2 py-1 text-xs rounded-full ${getAccuracyBadgeColor(tool.performance.accuracy)}`}>
                                {Math.round(tool.performance.accuracy * 100)}%
                              </span>
                              
                              {/* Cost estimate */}
                              {showCostEstimates && tool.costEstimate && (
                                <span className="text-xs text-gray-500">
                                  ${tool.costEstimate.toFixed(3)}
                                </span>
                              )}
                            </div>
                          </div>
                          
                          <p className="mt-1 text-xs text-gray-600">
                            {tool.description}
                          </p>
                          
                          {/* Special features */}
                          <div className="mt-2 flex flex-wrap gap-1">
                            {tool.capabilities.specialFeatures.slice(0, 3).map(feature => (
                              <span
                                key={feature}
                                className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded"
                              >
                                {feature.replace(/_/g, ' ')}
                              </span>
                            ))}
                            {tool.capabilities.specialFeatures.length > 3 && (
                              <span className="px-2 py-0.5 text-xs text-gray-500">
                                +{tool.capabilities.specialFeatures.length - 3} more
                              </span>
                            )}
                          </div>
                        </div>
                        
                        {/* Preview button */}
                        {onPreview && hoveredTool === tool.name && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToolPreview(tool.name);
                            }}
                            className="flex-shrink-0 p-1 text-gray-400 hover:text-gray-600"
                            title="Preview tool output"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Batch assignment info */}
          {targetZones.length > 1 && (
            <div className="p-3 bg-gray-50 border-t border-gray-200">
              <div className="text-xs text-gray-600">
                <span className="font-medium">{targetZones.length} zones selected</span>
                {' - Tool will be applied to all selected zones'}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ToolSelector;