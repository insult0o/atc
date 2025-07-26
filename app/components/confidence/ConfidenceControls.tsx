import React, { useState, useEffect } from 'react';
import { Zone } from '../zones/ZoneManager';
import { ProcessingTool } from '../zones/ZoneManager';
import { ConfidenceFilters } from './ConfidenceVisualizer';

export interface ConfidenceLegendProps {
  showValues?: boolean;
  orientation?: 'horizontal' | 'vertical';
  compact?: boolean;
  colorBlindMode?: boolean;
}

export interface ConfidenceFilterProps {
  filters: ConfidenceFilters;
  onChange: (filters: ConfidenceFilters) => void;
  availableTools: string[];
  showQuickFilters?: boolean;
}

export interface ConfidenceThresholdSliderProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  showMarkers?: boolean;
  label?: string;
}

export interface ConfidenceSortingProps {
  zones: Zone[];
  onSort: (sortedZones: Zone[]) => void;
  sortBy: 'confidence' | 'type' | 'tool' | 'status';
  order: 'asc' | 'desc';
}

export interface ConfidenceControlsProps {
  filters: ConfidenceFilters;
  onFilterChange: (filters: ConfidenceFilters) => void;
  threshold: number;
  onThresholdChange: (threshold: number) => void;
  availableTools: ProcessingTool[];
  zones: Zone[];
  onZonesSort?: (sortedZones: Zone[]) => void;
  showLegend?: boolean;
  showSorting?: boolean;
  colorBlindMode?: boolean;
  onColorBlindModeChange?: (enabled: boolean) => void;
}

// Main confidence controls component
export const ConfidenceControls: React.FC<ConfidenceControlsProps> = ({
  filters,
  onFilterChange,
  threshold,
  onThresholdChange,
  availableTools,
  zones,
  onZonesSort,
  showLegend = true,
  showSorting = true,
  colorBlindMode = false,
  onColorBlindModeChange
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [sortBy, setSortBy] = useState<'confidence' | 'type' | 'tool' | 'status'>('confidence');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Persist filter settings to localStorage
  useEffect(() => {
    const savedFilters = localStorage.getItem('confidenceFilters');
    if (savedFilters) {
      try {
        const parsed = JSON.parse(savedFilters);
        onFilterChange(parsed);
      } catch (e) {
        console.error('Failed to parse saved filters:', e);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('confidenceFilters', JSON.stringify(filters));
  }, [filters]);

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Confidence Controls</h3>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-gray-500 hover:text-gray-700"
          >
            <svg
              className={`w-5 h-5 transform transition-transform ${isExpanded ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Legend */}
      {showLegend && (
        <div className="p-4 border-b border-gray-200">
          <ConfidenceLegend
            orientation="horizontal"
            showValues={true}
            colorBlindMode={colorBlindMode}
          />
        </div>
      )}

      {/* Main controls */}
      <div className={`${isExpanded ? 'block' : 'hidden'}`}>
        {/* Threshold Slider */}
        <div className="p-4 border-b border-gray-200">
          <ConfidenceThresholdSlider
            value={threshold}
            onChange={onThresholdChange}
            showMarkers={true}
            label="Confidence Threshold"
          />
        </div>

        {/* Filters */}
        <div className="p-4 border-b border-gray-200">
          <ConfidenceFilter
            filters={filters}
            onChange={onFilterChange}
            availableTools={availableTools.map(t => t.name)}
            showQuickFilters={true}
          />
        </div>

        {/* Sorting */}
        {showSorting && zones.length > 0 && (
          <div className="p-4 border-b border-gray-200">
            <ConfidenceSorting
              zones={zones}
              onSort={(sorted) => onZonesSort?.(sorted)}
              sortBy={sortBy}
              order={sortOrder}
              onSortChange={(newSortBy, newOrder) => {
                setSortBy(newSortBy);
                setSortOrder(newOrder);
              }}
            />
          </div>
        )}

        {/* Accessibility Options */}
        <div className="p-4">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-gray-700">Color-blind Mode</label>
            <button
              onClick={() => onColorBlindModeChange?.(!colorBlindMode)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                colorBlindMode ? 'bg-blue-600' : 'bg-gray-200'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  colorBlindMode ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Confidence legend component
export const ConfidenceLegend: React.FC<ConfidenceLegendProps> = ({
  showValues = true,
  orientation = 'horizontal',
  compact = false,
  colorBlindMode = false
}) => {
  const legendItems = [
    { label: 'Very High', range: '80-100%', color: colorBlindMode ? '#1E88E5' : '#4CAF50', pattern: 'solid' },
    { label: 'High', range: '60-80%', color: colorBlindMode ? '#42A5F5' : '#8BC34A', pattern: 'solid' },
    { label: 'Medium', range: '40-60%', color: colorBlindMode ? '#FFC107' : '#FF9800', pattern: 'dashed' },
    { label: 'Low', range: '20-40%', color: colorBlindMode ? '#FFB300' : '#FF5722', pattern: 'dashed' },
    { label: 'Very Low', range: '0-20%', color: colorBlindMode ? '#E91E63' : '#F44336', pattern: 'dotted' }
  ];

  const containerClass = orientation === 'horizontal' 
    ? 'flex flex-wrap gap-4' 
    : 'flex flex-col gap-2';

  if (compact) {
    return (
      <div className={containerClass}>
        {legendItems.map((item) => (
          <div key={item.label} className="flex items-center gap-1">
            <div
              className="w-4 h-4 rounded"
              style={{ backgroundColor: item.color }}
              title={`${item.label}: ${item.range}`}
            />
            {!compact && <span className="text-xs text-gray-600">{item.label}</span>}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium text-gray-700">Confidence Legend</h4>
      <div className={containerClass}>
        {legendItems.map((item) => (
          <div key={item.label} className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <div
                className={`w-6 h-6 rounded border-2`}
                style={{ 
                  backgroundColor: `${item.color}33`,
                  borderColor: item.color,
                  borderStyle: item.pattern
                }}
              />
              {colorBlindMode && (
                <div className="w-4 h-4 flex items-center justify-center">
                  <span className="text-xs font-bold">{item.label[0]}</span>
                </div>
              )}
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-medium text-gray-900">{item.label}</span>
              {showValues && (
                <span className="text-xs text-gray-500">{item.range}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Confidence filter component
export const ConfidenceFilter: React.FC<ConfidenceFilterProps> = ({
  filters,
  onChange,
  availableTools,
  showQuickFilters = true
}) => {
  const handleRangeChange = (type: 'min' | 'max', value: number) => {
    onChange({
      ...filters,
      [`${type}Confidence`]: value / 100
    });
  };

  const handleToolToggle = (tool: string) => {
    const newTools = filters.tools.includes(tool)
      ? filters.tools.filter(t => t !== tool)
      : [...filters.tools, tool];
    
    onChange({
      ...filters,
      tools: newTools
    });
  };

  const handleQuickFilter = (type: 'low' | 'high' | 'all') => {
    switch (type) {
      case 'low':
        onChange({
          ...filters,
          showOnlyLowConfidence: true,
          showOnlyHighConfidence: false,
          minConfidence: 0,
          maxConfidence: 0.4
        });
        break;
      case 'high':
        onChange({
          ...filters,
          showOnlyLowConfidence: false,
          showOnlyHighConfidence: true,
          minConfidence: 0.6,
          maxConfidence: 1
        });
        break;
      case 'all':
        onChange({
          ...filters,
          showOnlyLowConfidence: false,
          showOnlyHighConfidence: false,
          minConfidence: 0,
          maxConfidence: 1
        });
        break;
    }
  };

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-medium text-gray-700">Filters</h4>

      {/* Quick filters */}
      {showQuickFilters && (
        <div className="flex gap-2">
          <button
            onClick={() => handleQuickFilter('all')}
            className={`px-3 py-1 text-sm rounded-md transition-colors ${
              !filters.showOnlyLowConfidence && !filters.showOnlyHighConfidence
                ? 'bg-blue-100 text-blue-700'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            All
          </button>
          <button
            onClick={() => handleQuickFilter('low')}
            className={`px-3 py-1 text-sm rounded-md transition-colors ${
              filters.showOnlyLowConfidence
                ? 'bg-red-100 text-red-700'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Low Confidence
          </button>
          <button
            onClick={() => handleQuickFilter('high')}
            className={`px-3 py-1 text-sm rounded-md transition-colors ${
              filters.showOnlyHighConfidence
                ? 'bg-green-100 text-green-700'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            High Confidence
          </button>
        </div>
      )}

      {/* Range slider */}
      <div>
        <label className="text-sm text-gray-600">
          Confidence Range: {Math.round(filters.minConfidence * 100)}% - {Math.round(filters.maxConfidence * 100)}%
        </label>
        <div className="mt-2 space-y-2">
          <input
            type="range"
            min="0"
            max="100"
            value={filters.minConfidence * 100}
            onChange={(e) => handleRangeChange('min', parseInt(e.target.value))}
            className="w-full"
          />
          <input
            type="range"
            min="0"
            max="100"
            value={filters.maxConfidence * 100}
            onChange={(e) => handleRangeChange('max', parseInt(e.target.value))}
            className="w-full"
          />
        </div>
      </div>

      {/* Tool filters */}
      <div>
        <label className="text-sm text-gray-600 mb-2 block">Filter by Tools</label>
        <div className="flex flex-wrap gap-2">
          {availableTools.map(tool => (
            <label
              key={tool}
              className="flex items-center gap-1 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={filters.tools.includes(tool)}
                onChange={() => handleToolToggle(tool)}
                className="rounded text-blue-600"
              />
              <span className="text-sm">{tool}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
};

// Confidence threshold slider component
export const ConfidenceThresholdSlider: React.FC<ConfidenceThresholdSliderProps> = ({
  value,
  onChange,
  min = 0,
  max = 1,
  step = 0.05,
  showMarkers = true,
  label
}) => {
  const percentage = Math.round(value * 100);
  const markers = [0, 0.2, 0.4, 0.6, 0.8, 1];

  return (
    <div className="space-y-2">
      {label && (
        <label className="text-sm font-medium text-gray-700">
          {label}: {percentage}%
        </label>
      )}
      
      <div className="relative">
        <input
          type="range"
          min={min * 100}
          max={max * 100}
          step={step * 100}
          value={value * 100}
          onChange={(e) => onChange(parseInt(e.target.value) / 100)}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
          style={{
            background: `linear-gradient(to right, #3B82F6 0%, #3B82F6 ${percentage}%, #E5E7EB ${percentage}%, #E5E7EB 100%)`
          }}
        />
        
        {showMarkers && (
          <div className="absolute w-full flex justify-between text-xs text-gray-500 mt-1">
            {markers.map(marker => (
              <span key={marker} className="transform -translate-x-1/2">
                {Math.round(marker * 100)}%
              </span>
            ))}
          </div>
        )}
      </div>
      
      <style jsx>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          width: 16px;
          height: 16px;
          background: #3B82F6;
          border-radius: 50%;
          cursor: pointer;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
        }
        
        .slider::-moz-range-thumb {
          width: 16px;
          height: 16px;
          background: #3B82F6;
          border-radius: 50%;
          cursor: pointer;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
          border: none;
        }
      `}</style>
    </div>
  );
};

// Confidence sorting component
interface ConfidenceSortingPropsExtended extends ConfidenceSortingProps {
  onSortChange?: (sortBy: 'confidence' | 'type' | 'tool' | 'status', order: 'asc' | 'desc') => void;
}

export const ConfidenceSorting: React.FC<ConfidenceSortingPropsExtended> = ({
  zones,
  onSort,
  sortBy,
  order,
  onSortChange
}) => {
  const handleSort = (newSortBy: typeof sortBy) => {
    const newOrder = sortBy === newSortBy && order === 'desc' ? 'asc' : 'desc';
    onSortChange?.(newSortBy, newOrder);

    const sorted = [...zones].sort((a, b) => {
      let comparison = 0;

      switch (newSortBy) {
        case 'confidence':
          comparison = a.confidence - b.confidence;
          break;
        case 'type':
          comparison = a.contentType.localeCompare(b.contentType);
          break;
        case 'tool':
          comparison = (a.assignedTool || '').localeCompare(b.assignedTool || '');
          break;
        case 'status':
          comparison = a.status.localeCompare(b.status);
          break;
      }

      return newOrder === 'asc' ? comparison : -comparison;
    });

    onSort(sorted);
  };

  const sortOptions = [
    { value: 'confidence', label: 'Confidence' },
    { value: 'type', label: 'Type' },
    { value: 'tool', label: 'Tool' },
    { value: 'status', label: 'Status' }
  ];

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium text-gray-700">Sort Zones</h4>
      <div className="flex gap-2">
        {sortOptions.map(option => (
          <button
            key={option.value}
            onClick={() => handleSort(option.value as typeof sortBy)}
            className={`px-3 py-1 text-sm rounded-md transition-colors flex items-center gap-1 ${
              sortBy === option.value
                ? 'bg-blue-100 text-blue-700'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {option.label}
            {sortBy === option.value && (
              <svg
                className={`w-3 h-3 transform ${order === 'asc' ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            )}
          </button>
        ))}
      </div>
    </div>
  );
};

export default ConfidenceControls;