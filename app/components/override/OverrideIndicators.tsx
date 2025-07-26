'use client';

import React, { useState, useMemo } from 'react';
import { Zone } from '../zones/ZoneManager';
import { ManualOverride } from '../../hooks/useManualOverride';

// Interfaces for override visualization
export interface OverrideIndicatorsProps {
  zone: Zone;
  overrides: ManualOverride[];
  showTimeline?: boolean;
  showDetails?: boolean;
  onOverrideClick?: (override: ManualOverride) => void;
  onRevert?: (overrideId: string) => void;
  className?: string;
}

export interface OverrideBadgeProps {
  override: ManualOverride;
  size?: 'sm' | 'md' | 'lg';
  showTooltip?: boolean;
  onClick?: () => void;
}

export interface OverrideTimelineProps {
  overrides: ManualOverride[];
  maxItems?: number;
  onOverrideClick?: (override: ManualOverride) => void;
  onRevert?: (overrideId: string) => void;
}

export interface OverrideSummaryProps {
  zones: Zone[];
  overrides: Map<string, ManualOverride[]>;
  onFilterChange?: (filters: OverrideFilters) => void;
}

export interface OverrideFilters {
  status?: 'all' | 'manual' | 'automatic';
  type?: ManualOverride['type'] | 'all';
  timeRange?: 'all' | 'today' | 'week' | 'month';
  userId?: string;
}

// Override status badge component
export function OverrideBadge({ 
  override, 
  size = 'md', 
  showTooltip = true,
  onClick 
}: OverrideBadgeProps) {
  const [showTooltipState, setShowTooltipState] = useState(false);

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-3 py-1 text-sm',
    lg: 'px-4 py-2 text-base'
  };

  const typeConfig = {
    tool_change: {
      color: 'bg-blue-100 text-blue-800 border-blue-200',
      icon: '🔧',
      label: 'Tool Override'
    },
    content_edit: {
      color: 'bg-purple-100 text-purple-800 border-purple-200',
      icon: '✏️',
      label: 'Content Edit'
    },
    zone_adjustment: {
      color: 'bg-green-100 text-green-800 border-green-200',
      icon: '📐',
      label: 'Zone Adjustment'
    }
  };

  const config = typeConfig[override.type];

  return (
    <div className="relative inline-block">
      <button
        onClick={onClick}
        onMouseEnter={() => setShowTooltipState(true)}
        onMouseLeave={() => setShowTooltipState(false)}
        className={`
          ${sizeClasses[size]}
          ${config.color}
          border rounded-full font-medium
          flex items-center space-x-1
          transition-all duration-200
          hover:shadow-md hover:scale-105
          cursor-pointer
        `}
      >
        <span>{config.icon}</span>
        <span>{config.label}</span>
        <span className="opacity-60">100%</span>
      </button>

      {/* Tooltip */}
      {showTooltip && showTooltipState && (
        <div className="absolute z-50 bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg whitespace-nowrap">
          <div className="font-semibold">{config.label}</div>
          <div className="opacity-80">
            {new Date(override.timestamp).toLocaleString()}
          </div>
          {override.reason && (
            <div className="mt-1 opacity-80 max-w-xs whitespace-normal">
              Reason: {override.reason}
            </div>
          )}
          <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-full">
            <div className="border-4 border-transparent border-t-gray-900"></div>
          </div>
        </div>
      )}
    </div>
  );
}

// Override timeline component
export function OverrideTimeline({
  overrides,
  maxItems = 5,
  onOverrideClick,
  onRevert
}: OverrideTimelineProps) {
  const sortedOverrides = useMemo(() => {
    return [...overrides].sort((a, b) => b.timestamp - a.timestamp).slice(0, maxItems);
  }, [overrides, maxItems]);

  if (sortedOverrides.length === 0) {
    return (
      <div className="text-sm text-gray-500 text-center py-4">
        No manual overrides yet
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold text-gray-700">Override History</h4>
      <div className="space-y-2">
        {sortedOverrides.map((override) => (
          <div
            key={override.id}
            className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <div className="flex items-center space-x-3">
              <div className="flex-shrink-0">
                <OverrideBadge override={override} size="sm" showTooltip={false} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-gray-900 truncate">
                  {getOverrideDescription(override)}
                </div>
                <div className="text-xs text-gray-500">
                  {getRelativeTime(override.timestamp)}
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              {onOverrideClick && (
                <button
                  onClick={() => onOverrideClick(override)}
                  className="p-1 text-gray-400 hover:text-gray-600"
                  title="View details"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </button>
              )}
              {onRevert && (
                <button
                  onClick={() => onRevert(override.id)}
                  className="p-1 text-gray-400 hover:text-red-600"
                  title="Revert this override"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
      {overrides.length > maxItems && (
        <div className="text-xs text-gray-500 text-center">
          And {overrides.length - maxItems} more overrides...
        </div>
      )}
    </div>
  );
}

// Override summary panel component
export function OverrideSummary({
  zones,
  overrides,
  onFilterChange
}: OverrideSummaryProps) {
  const [filters, setFilters] = useState<OverrideFilters>({
    status: 'all',
    type: 'all',
    timeRange: 'all'
  });

  const stats = useMemo(() => {
    let totalOverrides = 0;
    let overriddenZones = 0;
    const typeCount: Record<string, number> = {
      tool_change: 0,
      content_edit: 0,
      zone_adjustment: 0
    };

    overrides.forEach((zoneOverrides, zoneId) => {
      if (zoneOverrides.length > 0) {
        overriddenZones++;
        totalOverrides += zoneOverrides.length;
        
        zoneOverrides.forEach(override => {
          typeCount[override.type]++;
        });
      }
    });

    const overridePercentage = zones.length > 0 
      ? Math.round((overriddenZones / zones.length) * 100)
      : 0;

    return {
      totalOverrides,
      overriddenZones,
      overridePercentage,
      typeCount
    };
  }, [zones, overrides]);

  const handleFilterChange = (newFilters: Partial<OverrideFilters>) => {
    const updatedFilters = { ...filters, ...newFilters };
    setFilters(updatedFilters);
    if (onFilterChange) {
      onFilterChange(updatedFilters);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Override Summary</h3>
        <div className="flex items-center space-x-2">
          <span className="text-2xl font-bold text-blue-600">{stats.overridePercentage}%</span>
          <span className="text-sm text-gray-500">overridden</span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="text-2xl font-bold text-gray-900">{stats.totalOverrides}</div>
          <div className="text-xs text-gray-500">Total Overrides</div>
        </div>
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="text-2xl font-bold text-gray-900">{stats.overriddenZones}</div>
          <div className="text-xs text-gray-500">Zones Modified</div>
        </div>
      </div>

      {/* Type Breakdown */}
      <div className="space-y-2">
        <h4 className="text-sm font-medium text-gray-700">Override Types</h4>
        <div className="space-y-1">
          {Object.entries(stats.typeCount).map(([type, count]) => {
            const percentage = stats.totalOverrides > 0 
              ? Math.round((count / stats.totalOverrides) * 100)
              : 0;
            
            return (
              <div key={type} className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className={`w-2 h-2 rounded-full ${getTypeColor(type as ManualOverride['type'])}`} />
                  <span className="text-xs text-gray-600">
                    {type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-medium text-gray-900">{count}</span>
                  <span className="text-xs text-gray-500">({percentage}%)</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Filters */}
      <div className="space-y-2 pt-2 border-t border-gray-200">
        <h4 className="text-sm font-medium text-gray-700">Filters</h4>
        <div className="grid grid-cols-2 gap-2">
          <select
            value={filters.type}
            onChange={(e) => handleFilterChange({ type: e.target.value as any })}
            className="text-xs px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Types</option>
            <option value="tool_change">Tool Changes</option>
            <option value="content_edit">Content Edits</option>
            <option value="zone_adjustment">Zone Adjustments</option>
          </select>
          
          <select
            value={filters.timeRange}
            onChange={(e) => handleFilterChange({ timeRange: e.target.value as any })}
            className="text-xs px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Time</option>
            <option value="today">Today</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
          </select>
        </div>
      </div>
    </div>
  );
}

// Main override indicators component
export function OverrideIndicators({
  zone,
  overrides,
  showTimeline = false,
  showDetails = true,
  onOverrideClick,
  onRevert,
  className = ''
}: OverrideIndicatorsProps) {
  const latestOverride = useMemo(() => {
    if (overrides.length === 0) return null;
    return overrides.reduce((latest, current) => 
      current.timestamp > latest.timestamp ? current : latest
    );
  }, [overrides]);

  if (overrides.length === 0) {
    return null;
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Override Status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span className="text-sm font-medium text-gray-700">Override Status:</span>
          {latestOverride && (
            <OverrideBadge 
              override={latestOverride} 
              onClick={() => onOverrideClick?.(latestOverride)}
            />
          )}
        </div>
        {overrides.length > 1 && (
          <span className="text-xs text-gray-500">
            {overrides.length} total overrides
          </span>
        )}
      </div>

      {/* Confidence Boost Indicator */}
      <div className="flex items-center space-x-2">
        <span className="text-sm text-gray-600">Confidence:</span>
        <div className="flex items-center space-x-1">
          <span className="text-sm font-medium text-green-600">100%</span>
          <span className="text-xs text-green-600">⬆️ +{Math.round((1 - zone.confidence) * 100)}%</span>
        </div>
      </div>

      {/* Details Section */}
      {showDetails && latestOverride && (
        <div className="bg-gray-50 rounded-lg p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-700">Last Override:</span>
            <span className="text-xs text-gray-500">
              {getRelativeTime(latestOverride.timestamp)}
            </span>
          </div>
          {latestOverride.reason && (
            <div className="text-xs text-gray-600">
              <span className="font-medium">Reason:</span> {latestOverride.reason}
            </div>
          )}
          {latestOverride.metadata.userNotes && (
            <div className="text-xs text-gray-600">
              <span className="font-medium">Notes:</span> {latestOverride.metadata.userNotes}
            </div>
          )}
        </div>
      )}

      {/* Timeline */}
      {showTimeline && (
        <OverrideTimeline
          overrides={overrides}
          onOverrideClick={onOverrideClick}
          onRevert={onRevert}
        />
      )}
    </div>
  );
}

// Helper functions
function getOverrideDescription(override: ManualOverride): string {
  switch (override.type) {
    case 'tool_change':
      return `Changed tool from ${override.previousValue || 'none'} to ${override.newValue}`;
    case 'content_edit':
      return 'Edited content manually';
    case 'zone_adjustment':
      return 'Adjusted zone properties';
    default:
      return 'Manual override applied';
  }
}

function getRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  
  return new Date(timestamp).toLocaleDateString();
}

function getTypeColor(type: ManualOverride['type']): string {
  switch (type) {
    case 'tool_change':
      return 'bg-blue-500';
    case 'content_edit':
      return 'bg-purple-500';
    case 'zone_adjustment':
      return 'bg-green-500';
    default:
      return 'bg-gray-500';
  }
}

export default OverrideIndicators;