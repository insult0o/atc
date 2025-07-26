/**
 * Log Analysis Tools
 * Search, filter, and visualize export logs
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Search, Filter, Download, RefreshCw, AlertCircle, TrendingUp, TrendingDown } from 'lucide-react';
import { ExportLog, LogLevel, LogCategory } from '@/lib/export/logging/logger';

interface LogAnalyzerProps {
  logs: ExportLog[];
  onSearch: (query: LogQuery) => void;
  onExport: (format: 'json' | 'csv') => void;
  onRefresh: () => void;
  isLoading?: boolean;
}

export interface LogQuery {
  searchText?: string;
  level?: LogLevel[];
  category?: LogCategory[];
  startDate?: Date;
  endDate?: Date;
  userId?: string;
  documentId?: string;
  limit?: number;
}

interface LogStats {
  total: number;
  byLevel: Record<LogLevel, number>;
  byCategory: Record<string, number>;
  errorRate: number;
  avgResponseTime?: number;
}

interface AggregationView {
  type: 'timeline' | 'distribution' | 'errors' | 'performance';
  data: any[];
}

export const LogAnalyzer: React.FC<LogAnalyzerProps> = ({
  logs,
  onSearch,
  onExport,
  onRefresh,
  isLoading = false
}) => {
  const [query, setQuery] = useState<LogQuery>({});
  const [selectedView, setSelectedView] = useState<AggregationView['type']>('timeline');
  const [expandedLog, setExpandedLog] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      onRefresh();
    }, 5000);

    return () => clearInterval(interval);
  }, [autoRefresh, onRefresh]);

  // Calculate statistics
  const stats = useMemo(() => calculateStats(logs), [logs]);

  // Generate aggregation views
  const aggregationData = useMemo(() => {
    switch (selectedView) {
      case 'timeline':
        return generateTimelineData(logs);
      case 'distribution':
        return generateDistributionData(logs);
      case 'errors':
        return generateErrorData(logs);
      case 'performance':
        return generatePerformanceData(logs);
      default:
        return [];
    }
  }, [logs, selectedView]);

  const handleSearch = () => {
    onSearch(query);
  };

  const handleQuickFilter = (filter: Partial<LogQuery>) => {
    const newQuery = { ...query, ...filter };
    setQuery(newQuery);
    onSearch(newQuery);
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-lg shadow">
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Log Analysis</h2>
          <div className="flex gap-2">
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`p-2 rounded ${autoRefresh ? 'bg-blue-100 text-blue-700' : 'bg-gray-100'}`}
              title="Auto-refresh"
            >
              <RefreshCw className={`w-4 h-4 ${autoRefresh ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onRefresh}
              disabled={isLoading}
              className="p-2 bg-gray-100 rounded hover:bg-gray-200 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => onExport('json')}
              className="px-3 py-2 bg-gray-100 rounded hover:bg-gray-200 flex items-center gap-1"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="space-y-3">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search logs..."
                value={query.searchText || ''}
                onChange={(e) => setQuery({ ...query, searchText: e.target.value })}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                className="w-full pl-10 pr-4 py-2 border rounded"
              />
            </div>
            <button
              onClick={handleSearch}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Search
            </button>
          </div>

          {/* Quick Filters */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => handleQuickFilter({ level: ['error', 'critical'] })}
              className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200"
            >
              Errors Only
            </button>
            <button
              onClick={() => handleQuickFilter({ 
                startDate: new Date(Date.now() - 3600000) 
              })}
              className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
            >
              Last Hour
            </button>
            <button
              onClick={() => handleQuickFilter({ 
                category: [LogCategory.EXPORT_FAILED, LogCategory.VALIDATION_FAILED] 
              })}
              className="px-3 py-1 text-sm bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200"
            >
              Failures
            </button>
            <button
              onClick={() => handleQuickFilter({ 
                category: [LogCategory.PERFORMANCE_MILESTONE] 
              })}
              className="px-3 py-1 text-sm bg-green-100 text-green-700 rounded hover:bg-green-200"
            >
              Performance
            </button>
            <button
              onClick={() => setQuery({})}
              className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {/* Statistics Bar */}
      <div className="p-4 bg-gray-50 border-b">
        <div className="grid grid-cols-5 gap-4 text-sm">
          <div>
            <div className="text-gray-600">Total Logs</div>
            <div className="text-xl font-semibold">{stats.total}</div>
          </div>
          <div>
            <div className="text-gray-600">Errors</div>
            <div className="text-xl font-semibold text-red-600">
              {stats.byLevel.error + stats.byLevel.critical}
            </div>
          </div>
          <div>
            <div className="text-gray-600">Warnings</div>
            <div className="text-xl font-semibold text-yellow-600">
              {stats.byLevel.warn}
            </div>
          </div>
          <div>
            <div className="text-gray-600">Error Rate</div>
            <div className="text-xl font-semibold">
              {stats.errorRate.toFixed(1)}%
            </div>
          </div>
          <div>
            <div className="text-gray-600">Avg Response</div>
            <div className="text-xl font-semibold">
              {stats.avgResponseTime?.toFixed(0) || '-'}ms
            </div>
          </div>
        </div>
      </div>

      {/* Aggregation Views */}
      <div className="p-4 border-b">
        <div className="flex gap-2 mb-4">
          {(['timeline', 'distribution', 'errors', 'performance'] as const).map(view => (
            <button
              key={view}
              onClick={() => setSelectedView(view)}
              className={`px-3 py-1 rounded ${
                selectedView === view 
                  ? 'bg-blue-500 text-white' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {view.charAt(0).toUpperCase() + view.slice(1)}
            </button>
          ))}
        </div>
        
        <div className="h-48 bg-gray-50 rounded p-4">
          <AggregationChart type={selectedView} data={aggregationData} />
        </div>
      </div>

      {/* Log List */}
      <div className="flex-1 overflow-y-auto">
        {logs.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No logs found matching your criteria
          </div>
        ) : (
          <div className="divide-y">
            {logs.map((log) => (
              <LogEntry
                key={log.id}
                log={log}
                isExpanded={expandedLog === log.id}
                onToggle={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// Log Entry Component
const LogEntry: React.FC<{
  log: ExportLog;
  isExpanded: boolean;
  onToggle: () => void;
}> = ({ log, isExpanded, onToggle }) => {
  const levelColors: Record<LogLevel, string> = {
    debug: 'text-gray-600',
    info: 'text-blue-600',
    warn: 'text-yellow-600',
    error: 'text-red-600',
    critical: 'text-red-800 font-bold'
  };

  const levelBgColors: Record<LogLevel, string> = {
    debug: 'bg-gray-100',
    info: 'bg-blue-50',
    warn: 'bg-yellow-50',
    error: 'bg-red-50',
    critical: 'bg-red-100'
  };

  return (
    <div className={`${levelBgColors[log.level]} hover:bg-opacity-70 transition-colors`}>
      <div
        onClick={onToggle}
        className="p-4 cursor-pointer"
      >
        <div className="flex items-start gap-3">
          <div className={`text-xs font-medium ${levelColors[log.level]} uppercase`}>
            {log.level}
          </div>
          
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-medium">{log.operation}</span>
              <span className="text-xs text-gray-500">{log.category}</span>
              {log.userId && (
                <span className="text-xs bg-gray-200 px-2 py-0.5 rounded">
                  User: {log.userId}
                </span>
              )}
            </div>
            
            {log.error && (
              <div className="text-sm text-red-700 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {log.error.message}
              </div>
            )}
            
            {log.performance && (
              <div className="text-xs text-gray-600 mt-1">
                Duration: {log.performance.duration}ms | 
                Memory: {(log.performance.memoryUsed / 1024 / 1024).toFixed(1)}MB
              </div>
            )}
          </div>
          
          <div className="text-xs text-gray-500">
            {new Date(log.timestamp).toLocaleTimeString()}
          </div>
        </div>
      </div>
      
      {isExpanded && (
        <div className="px-4 pb-4 border-t">
          <div className="mt-3 space-y-2">
            {log.correlationId && (
              <div className="text-sm">
                <span className="font-medium">Correlation ID:</span> {log.correlationId}
              </div>
            )}
            
            {log.documentId && (
              <div className="text-sm">
                <span className="font-medium">Document:</span> {log.documentId}
              </div>
            )}
            
            {log.metadata && Object.keys(log.metadata).length > 0 && (
              <div className="text-sm">
                <span className="font-medium">Metadata:</span>
                <pre className="mt-1 p-2 bg-gray-100 rounded text-xs overflow-x-auto">
                  {JSON.stringify(log.metadata, null, 2)}
                </pre>
              </div>
            )}
            
            {log.error?.stack && (
              <div className="text-sm">
                <span className="font-medium">Stack Trace:</span>
                <pre className="mt-1 p-2 bg-gray-100 rounded text-xs overflow-x-auto">
                  {log.error.stack}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// Aggregation Chart Component
const AggregationChart: React.FC<{
  type: AggregationView['type'];
  data: any[];
}> = ({ type, data }) => {
  if (data.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500">
        No data available
      </div>
    );
  }

  // Simple text-based visualization
  switch (type) {
    case 'timeline':
      return <TimelineChart data={data} />;
    case 'distribution':
      return <DistributionChart data={data} />;
    case 'errors':
      return <ErrorChart data={data} />;
    case 'performance':
      return <PerformanceChart data={data} />;
    default:
      return null;
  }
};

// Timeline Chart
const TimelineChart: React.FC<{ data: any[] }> = ({ data }) => {
  const maxCount = Math.max(...data.map(d => d.count));
  
  return (
    <div className="h-full flex items-end gap-1">
      {data.map((item, index) => (
        <div
          key={index}
          className="flex-1 bg-blue-500 rounded-t"
          style={{ height: `${(item.count / maxCount) * 100}%` }}
          title={`${item.time}: ${item.count} logs`}
        />
      ))}
    </div>
  );
};

// Distribution Chart
const DistributionChart: React.FC<{ data: any[] }> = ({ data }) => {
  return (
    <div className="space-y-2">
      {data.map((item, index) => (
        <div key={index} className="flex items-center gap-2">
          <div className="w-20 text-sm">{item.category}</div>
          <div className="flex-1 bg-gray-200 rounded">
            <div
              className="bg-blue-500 rounded h-6 flex items-center px-2"
              style={{ width: `${item.percentage}%` }}
            >
              <span className="text-xs text-white">{item.count}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

// Error Chart
const ErrorChart: React.FC<{ data: any[] }> = ({ data }) => {
  return (
    <div className="space-y-2">
      {data.slice(0, 5).map((item, index) => (
        <div key={index} className="flex items-center justify-between">
          <div className="text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-500" />
            {item.error}
          </div>
          <div className="text-sm font-medium">{item.count}</div>
        </div>
      ))}
    </div>
  );
};

// Performance Chart
const PerformanceChart: React.FC<{ data: any[] }> = ({ data }) => {
  return (
    <div className="space-y-2">
      {data.map((item, index) => (
        <div key={index} className="flex items-center justify-between">
          <div className="text-sm">{item.operation}</div>
          <div className="flex items-center gap-2">
            <div className="text-sm font-medium">{item.avgTime}ms</div>
            {item.trend === 'up' ? (
              <TrendingUp className="w-4 h-4 text-red-500" />
            ) : item.trend === 'down' ? (
              <TrendingDown className="w-4 h-4 text-green-500" />
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
};

// Helper functions
function calculateStats(logs: ExportLog[]): LogStats {
  const stats: LogStats = {
    total: logs.length,
    byLevel: {
      debug: 0,
      info: 0,
      warn: 0,
      error: 0,
      critical: 0
    },
    byCategory: {},
    errorRate: 0
  };

  let totalResponseTime = 0;
  let responseTimeCount = 0;

  logs.forEach(log => {
    stats.byLevel[log.level]++;
    stats.byCategory[log.category] = (stats.byCategory[log.category] || 0) + 1;
    
    if (log.performance?.duration) {
      totalResponseTime += log.performance.duration;
      responseTimeCount++;
    }
  });

  stats.errorRate = stats.total > 0 
    ? ((stats.byLevel.error + stats.byLevel.critical) / stats.total) * 100
    : 0;

  stats.avgResponseTime = responseTimeCount > 0 
    ? totalResponseTime / responseTimeCount
    : undefined;

  return stats;
}

function generateTimelineData(logs: ExportLog[]): any[] {
  const buckets = new Map<string, number>();
  
  logs.forEach(log => {
    const date = new Date(log.timestamp);
    const bucket = `${date.getHours()}:${Math.floor(date.getMinutes() / 10)}0`;
    buckets.set(bucket, (buckets.get(bucket) || 0) + 1);
  });

  return Array.from(buckets.entries())
    .map(([time, count]) => ({ time, count }))
    .slice(-20);
}

function generateDistributionData(logs: ExportLog[]): any[] {
  const categories = new Map<string, number>();
  
  logs.forEach(log => {
    categories.set(log.category, (categories.get(log.category) || 0) + 1);
  });

  return Array.from(categories.entries())
    .map(([category, count]) => ({
      category: category.split('.').pop(),
      count,
      percentage: (count / logs.length) * 100
    }))
    .sort((a, b) => b.count - a.count);
}

function generateErrorData(logs: ExportLog[]): any[] {
  const errors = new Map<string, number>();
  
  logs
    .filter(log => log.error)
    .forEach(log => {
      const key = log.error!.code || log.error!.message;
      errors.set(key, (errors.get(key) || 0) + 1);
    });

  return Array.from(errors.entries())
    .map(([error, count]) => ({ error, count }))
    .sort((a, b) => b.count - a.count);
}

function generatePerformanceData(logs: ExportLog[]): any[] {
  const operations = new Map<string, number[]>();
  
  logs
    .filter(log => log.performance)
    .forEach(log => {
      const times = operations.get(log.operation) || [];
      times.push(log.performance!.duration);
      operations.set(log.operation, times);
    });

  return Array.from(operations.entries())
    .map(([operation, times]) => {
      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      const trend = times.length > 5 
        ? times.slice(-5).reduce((a, b) => a + b, 0) / 5 > avgTime ? 'down' : 'up'
        : 'stable';
      
      return { operation, avgTime: Math.round(avgTime), trend };
    })
    .sort((a, b) => b.avgTime - a.avgTime)
    .slice(0, 10);
}