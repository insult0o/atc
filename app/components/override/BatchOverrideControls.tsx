'use client';

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Zone } from '../zones/ZoneManager';
import { ManualOverride } from '../../hooks/useManualOverride';
import { ToolSelector, Tool } from './ToolSelector';

// Interfaces for batch override operations
export interface BatchOverrideControlsProps {
  zones: Zone[];
  selectedZoneIds: Set<string>;
  onBatchToolAssign: (toolName: string, zoneIds: string[]) => void;
  onBatchRevert: (overrideIds: string[]) => void;
  onSelectionChange: (zoneIds: Set<string>) => void;
  onCreateTemplate?: (template: OverrideTemplate) => void;
  templates?: OverrideTemplate[];
  className?: string;
}

export interface OverrideTemplate {
  id: string;
  name: string;
  description?: string;
  operations: TemplateOperation[];
  filters: TemplateFilter[];
  createdAt: number;
  usageCount: number;
}

export interface TemplateOperation {
  type: 'assign_tool' | 'set_confidence' | 'add_tag' | 'custom';
  value: any;
  conditions?: OperationCondition[];
}

export interface OperationCondition {
  field: string;
  operator: 'equals' | 'contains' | 'greater' | 'less' | 'matches';
  value: any;
}

export interface TemplateFilter {
  field: 'contentType' | 'confidence' | 'pageNumber' | 'hasOverrides' | 'tool';
  operator: 'equals' | 'not_equals' | 'greater' | 'less' | 'in' | 'not_in';
  value: any;
}

export interface SmartSelectionProps {
  zones: Zone[];
  onSelect: (zoneIds: string[]) => void;
  currentSelection: Set<string>;
}

// Smart selection tool component
export function SmartSelection({ zones, onSelect, currentSelection }: SmartSelectionProps) {
  const [selectionMode, setSelectionMode] = useState<'manual' | 'smart'>('manual');
  const [smartFilters, setSmartFilters] = useState({
    contentType: 'all',
    confidence: { min: 0, max: 1 },
    hasOverrides: 'all',
    pageRange: { start: 1, end: 999 }
  });

  const applySmartSelection = useCallback(() => {
    const selected = zones.filter(zone => {
      // Content type filter
      if (smartFilters.contentType !== 'all' && zone.contentType !== smartFilters.contentType) {
        return false;
      }

      // Confidence filter
      if (zone.confidence < smartFilters.confidence.min || zone.confidence > smartFilters.confidence.max) {
        return false;
      }

      // Page range filter
      if (zone.pageNumber < smartFilters.pageRange.start || zone.pageNumber > smartFilters.pageRange.end) {
        return false;
      }

      // Override filter
      if (smartFilters.hasOverrides === 'with' && !zone.userModified) {
        return false;
      }
      if (smartFilters.hasOverrides === 'without' && zone.userModified) {
        return false;
      }

      return true;
    });

    onSelect(selected.map(z => z.id));
  }, [zones, smartFilters, onSelect]);

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-gray-900">Smart Selection</h4>
        <div className="flex rounded-md shadow-sm">
          <button
            onClick={() => setSelectionMode('manual')}
            className={`px-3 py-1 text-xs font-medium rounded-l-md border ${
              selectionMode === 'manual'
                ? 'bg-blue-50 text-blue-700 border-blue-200'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
            }`}
          >
            Manual
          </button>
          <button
            onClick={() => setSelectionMode('smart')}
            className={`px-3 py-1 text-xs font-medium rounded-r-md border-t border-r border-b ${
              selectionMode === 'smart'
                ? 'bg-blue-50 text-blue-700 border-blue-200'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
            }`}
          >
            Smart
          </button>
        </div>
      </div>

      {selectionMode === 'smart' && (
        <div className="space-y-3">
          {/* Content Type Filter */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Content Type
            </label>
            <select
              value={smartFilters.contentType}
              onChange={(e) => setSmartFilters(prev => ({ ...prev, contentType: e.target.value }))}
              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Types</option>
              <option value="text">Text</option>
              <option value="table">Table</option>
              <option value="diagram">Diagram</option>
              <option value="mixed">Mixed</option>
            </select>
          </div>

          {/* Confidence Range */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Confidence Range
            </label>
            <div className="flex items-center space-x-2">
              <input
                type="number"
                min="0"
                max="1"
                step="0.1"
                value={smartFilters.confidence.min}
                onChange={(e) => setSmartFilters(prev => ({
                  ...prev,
                  confidence: { ...prev.confidence, min: parseFloat(e.target.value) }
                }))}
                className="w-20 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-xs text-gray-500">to</span>
              <input
                type="number"
                min="0"
                max="1"
                step="0.1"
                value={smartFilters.confidence.max}
                onChange={(e) => setSmartFilters(prev => ({
                  ...prev,
                  confidence: { ...prev.confidence, max: parseFloat(e.target.value) }
                }))}
                className="w-20 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Override Status */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Override Status
            </label>
            <select
              value={smartFilters.hasOverrides}
              onChange={(e) => setSmartFilters(prev => ({ ...prev, hasOverrides: e.target.value }))}
              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Zones</option>
              <option value="with">With Overrides</option>
              <option value="without">Without Overrides</option>
            </select>
          </div>

          {/* Page Range */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Page Range
            </label>
            <div className="flex items-center space-x-2">
              <input
                type="number"
                min="1"
                value={smartFilters.pageRange.start}
                onChange={(e) => setSmartFilters(prev => ({
                  ...prev,
                  pageRange: { ...prev.pageRange, start: parseInt(e.target.value) }
                }))}
                className="w-20 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-xs text-gray-500">to</span>
              <input
                type="number"
                min="1"
                value={smartFilters.pageRange.end}
                onChange={(e) => setSmartFilters(prev => ({
                  ...prev,
                  pageRange: { ...prev.pageRange, end: parseInt(e.target.value) }
                }))}
                className="w-20 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <button
            onClick={applySmartSelection}
            className="w-full px-3 py-1 text-sm font-medium text-white bg-blue-600 rounded hover:bg-blue-700 transition-colors"
          >
            Apply Smart Selection
          </button>
        </div>
      )}

      {/* Quick selection buttons */}
      <div className="space-y-2">
        <div className="text-xs font-medium text-gray-700">Quick Select:</div>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => onSelect(zones.map(z => z.id))}
            className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
          >
            Select All
          </button>
          <button
            onClick={() => onSelect([])}
            className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
          >
            Clear Selection
          </button>
          <button
            onClick={() => {
              const inverted = zones
                .filter(z => !currentSelection.has(z.id))
                .map(z => z.id);
              onSelect(inverted);
            }}
            className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
          >
            Invert Selection
          </button>
          <button
            onClick={() => {
              const lowConfidence = zones
                .filter(z => z.confidence < 0.8)
                .map(z => z.id);
              onSelect(lowConfidence);
            }}
            className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
          >
            Low Confidence
          </button>
        </div>
      </div>
    </div>
  );
}

// Template manager component
export function TemplateManager({
  templates = [],
  onApply,
  onCreate,
  onDelete
}: {
  templates: OverrideTemplate[];
  onApply: (template: OverrideTemplate) => void;
  onCreate?: (template: OverrideTemplate) => void;
  onDelete?: (templateId: string) => void;
}) {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTemplate, setNewTemplate] = useState<Partial<OverrideTemplate>>({
    name: '',
    description: '',
    operations: [],
    filters: []
  });

  const handleCreateTemplate = () => {
    if (!newTemplate.name || !onCreate) return;

    const template: OverrideTemplate = {
      id: `template_${Date.now()}`,
      name: newTemplate.name,
      description: newTemplate.description,
      operations: newTemplate.operations || [],
      filters: newTemplate.filters || [],
      createdAt: Date.now(),
      usageCount: 0
    };

    onCreate(template);
    setShowCreateForm(false);
    setNewTemplate({ name: '', description: '', operations: [], filters: [] });
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-gray-900">Override Templates</h4>
        {onCreate && (
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="text-xs text-blue-600 hover:text-blue-700"
          >
            {showCreateForm ? 'Cancel' : '+ New Template'}
          </button>
        )}
      </div>

      {showCreateForm && (
        <div className="space-y-3 p-3 bg-gray-50 rounded-lg">
          <input
            type="text"
            placeholder="Template name"
            value={newTemplate.name}
            onChange={(e) => setNewTemplate(prev => ({ ...prev, name: e.target.value }))}
            className="w-full px-3 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <textarea
            placeholder="Description (optional)"
            value={newTemplate.description}
            onChange={(e) => setNewTemplate(prev => ({ ...prev, description: e.target.value }))}
            className="w-full px-3 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={2}
          />
          <button
            onClick={handleCreateTemplate}
            disabled={!newTemplate.name}
            className="w-full px-3 py-1 text-sm font-medium text-white bg-blue-600 rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            Create Template
          </button>
        </div>
      )}

      {templates.length === 0 ? (
        <div className="text-xs text-gray-500 text-center py-2">
          No templates yet
        </div>
      ) : (
        <div className="space-y-2">
          {templates.map(template => (
            <div
              key={template.id}
              className="flex items-center justify-between p-2 bg-gray-50 rounded hover:bg-gray-100"
            >
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-gray-900">{template.name}</div>
                {template.description && (
                  <div className="text-xs text-gray-500">{template.description}</div>
                )}
                <div className="text-xs text-gray-400 mt-1">
                  Used {template.usageCount} times
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => onApply(template)}
                  className="px-3 py-1 text-xs font-medium text-blue-600 bg-blue-50 rounded hover:bg-blue-100"
                >
                  Apply
                </button>
                {onDelete && (
                  <button
                    onClick={() => onDelete(template.id)}
                    className="p-1 text-gray-400 hover:text-red-600"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Main batch override controls component
export function BatchOverrideControls({
  zones,
  selectedZoneIds,
  onBatchToolAssign,
  onBatchRevert,
  onSelectionChange,
  onCreateTemplate,
  templates = [],
  className = ''
}: BatchOverrideControlsProps) {
  const [activeTab, setActiveTab] = useState<'selection' | 'operations' | 'templates'>('selection');
  const [batchTool, setBatchTool] = useState<string | null>(null);

  const selectedZones = useMemo(() => {
    return zones.filter(zone => selectedZoneIds.has(zone.id));
  }, [zones, selectedZoneIds]);

  const handleSmartSelect = useCallback((zoneIds: string[]) => {
    onSelectionChange(new Set(zoneIds));
  }, [onSelectionChange]);

  const handleBatchToolAssign = useCallback(() => {
    if (!batchTool || selectedZones.length === 0) return;
    
    const zoneIds = selectedZones.map(z => z.id);
    onBatchToolAssign(batchTool, zoneIds);
  }, [batchTool, selectedZones, onBatchToolAssign]);

  const handleTemplateApply = useCallback((template: OverrideTemplate) => {
    // Apply template operations to selected zones
    console.log('Applying template:', template.name);
    
    // Filter zones based on template filters
    let targetZones = selectedZones;
    
    template.filters.forEach(filter => {
      targetZones = targetZones.filter(zone => {
        switch (filter.field) {
          case 'contentType':
            return filter.operator === 'equals' 
              ? zone.contentType === filter.value
              : zone.contentType !== filter.value;
          case 'confidence':
            if (filter.operator === 'greater') return zone.confidence > filter.value;
            if (filter.operator === 'less') return zone.confidence < filter.value;
            return zone.confidence === filter.value;
          default:
            return true;
        }
      });
    });

    // Apply operations
    template.operations.forEach(operation => {
      if (operation.type === 'assign_tool' && operation.value) {
        onBatchToolAssign(operation.value, targetZones.map(z => z.id));
      }
      // Add more operation types as needed
    });
  }, [selectedZones, onBatchToolAssign]);

  // Calculate stats for selected zones
  const selectionStats = useMemo(() => {
    const stats = {
      total: selectedZones.length,
      byType: {} as Record<string, number>,
      avgConfidence: 0,
      withOverrides: 0
    };

    selectedZones.forEach(zone => {
      stats.byType[zone.contentType] = (stats.byType[zone.contentType] || 0) + 1;
      stats.avgConfidence += zone.confidence;
      if (zone.userModified) stats.withOverrides++;
    });

    if (stats.total > 0) {
      stats.avgConfidence /= stats.total;
    }

    return stats;
  }, [selectedZones]);

  if (zones.length === 0) {
    return null;
  }

  return (
    <div className={`bg-white rounded-lg shadow-lg border border-gray-200 ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Batch Override Controls</h3>
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-500">
              {selectedZoneIds.size} of {zones.length} zones selected
            </span>
            {selectedZoneIds.size > 0 && (
              <button
                onClick={() => onSelectionChange(new Set())}
                className="text-xs text-blue-600 hover:text-blue-700"
              >
                Clear Selection
              </button>
            )}
          </div>
        </div>

        {/* Selection Stats */}
        {selectedZoneIds.size > 0 && (
          <div className="mt-3 grid grid-cols-4 gap-3 text-xs">
            <div className="bg-gray-50 rounded p-2">
              <div className="font-medium text-gray-900">{selectionStats.total}</div>
              <div className="text-gray-500">Selected</div>
            </div>
            <div className="bg-gray-50 rounded p-2">
              <div className="font-medium text-gray-900">
                {Math.round(selectionStats.avgConfidence * 100)}%
              </div>
              <div className="text-gray-500">Avg Confidence</div>
            </div>
            <div className="bg-gray-50 rounded p-2">
              <div className="font-medium text-gray-900">{selectionStats.withOverrides}</div>
              <div className="text-gray-500">Overridden</div>
            </div>
            <div className="bg-gray-50 rounded p-2">
              <div className="font-medium text-gray-900">
                {Object.keys(selectionStats.byType).length}
              </div>
              <div className="text-gray-500">Types</div>
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex">
          {(['selection', 'operations', 'templates'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab
                  ? 'text-blue-600 border-blue-600'
                  : 'text-gray-500 border-transparent hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="p-4">
        {activeTab === 'selection' && (
          <SmartSelection
            zones={zones}
            onSelect={handleSmartSelect}
            currentSelection={selectedZoneIds}
          />
        )}

        {activeTab === 'operations' && (
          <div className="space-y-4">
            {/* Batch Tool Assignment */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-gray-900">Batch Tool Assignment</h4>
              {selectedZones.length > 0 ? (
                <>
                  <ToolSelector
                    zone={null}
                    selectedZones={selectedZones}
                    currentTool={batchTool || undefined}
                    onToolSelect={(tool) => setBatchTool(tool)}
                    className="w-full"
                  />
                  <button
                    onClick={handleBatchToolAssign}
                    disabled={!batchTool}
                    className="w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                  >
                    Apply Tool to {selectedZones.length} Zones
                  </button>
                </>
              ) : (
                <div className="text-sm text-gray-500 text-center py-4">
                  Select zones to apply batch operations
                </div>
              )}
            </div>

            {/* Batch Revert */}
            <div className="pt-4 border-t border-gray-200">
              <h4 className="text-sm font-semibold text-gray-900 mb-3">Batch Revert</h4>
              <button
                onClick={() => {
                  const overrideIds = selectedZones
                    .filter(z => z.userModified)
                    .map(z => `override_${z.id}`); // Would need actual override IDs
                  if (overrideIds.length > 0) {
                    onBatchRevert(overrideIds);
                  }
                }}
                disabled={selectionStats.withOverrides === 0}
                className="w-full px-4 py-2 text-sm font-medium text-red-600 bg-red-50 rounded hover:bg-red-100 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                Revert Overrides for {selectionStats.withOverrides} Zones
              </button>
            </div>
          </div>
        )}

        {activeTab === 'templates' && (
          <TemplateManager
            templates={templates}
            onApply={handleTemplateApply}
            onCreate={onCreateTemplate}
          />
        )}
      </div>
    </div>
  );
}

export default BatchOverrideControls;