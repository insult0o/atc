import { useRef, useCallback, useEffect, useState } from 'react';

interface PerformanceMetrics {
  fps: number;
  memoryUsage: number;
  syncLag: number;
  renderTime: number;
  scrollEvents: number;
  zoneRenderTime: number;
}

interface MetricEntry {
  timestamp: number;
  value: number;
}

interface UseViewerPerformanceReturn {
  recordMetric: (metric: keyof PerformanceMetrics, value: any) => void;
  getMetrics: () => PerformanceMetrics;
  resetMetrics: () => void;
  startMeasurement: (name: string) => void;
  endMeasurement: (name: string) => number;
}

const FPS_SAMPLE_WINDOW = 1000; // 1 second
const MEMORY_SAMPLE_INTERVAL = 2000; // 2 seconds

export function useViewerPerformance(): UseViewerPerformanceReturn {
  const metricsRef = useRef<PerformanceMetrics>({
    fps: 60,
    memoryUsage: 0,
    syncLag: 0,
    renderTime: 0,
    scrollEvents: 0,
    zoneRenderTime: 0
  });

  const fpsFramesRef = useRef<number[]>([]);
  const measurementsRef = useRef<Map<string, number>>(new Map());
  const rafIdRef = useRef<number>();
  const memoryIntervalRef = useRef<NodeJS.Timeout>();

  const [metrics, setMetrics] = useState<PerformanceMetrics>(metricsRef.current);

  // Calculate FPS
  const calculateFPS = useCallback(() => {
    const now = performance.now();
    fpsFramesRef.current.push(now);

    // Remove frames older than sample window
    const cutoff = now - FPS_SAMPLE_WINDOW;
    fpsFramesRef.current = fpsFramesRef.current.filter(time => time > cutoff);

    // Calculate FPS
    if (fpsFramesRef.current.length > 1) {
      const fps = Math.round((fpsFramesRef.current.length - 1) / (FPS_SAMPLE_WINDOW / 1000));
      metricsRef.current.fps = fps;
    }

    // Continue measuring
    rafIdRef.current = requestAnimationFrame(calculateFPS);
  }, []);

  // Monitor memory usage
  const monitorMemory = useCallback(() => {
    if ('memory' in performance && (performance as any).memory) {
      const memoryInfo = (performance as any).memory;
      const usedMB = Math.round(memoryInfo.usedJSHeapSize / 1048576);
      metricsRef.current.memoryUsage = usedMB;
    }
  }, []);

  // Record a metric
  const recordMetric = useCallback((metric: keyof PerformanceMetrics, value: any) => {
    if (typeof value === 'number') {
      metricsRef.current[metric] = value;
    } else if (typeof value === 'object' && value.lag !== undefined) {
      // Handle sync metrics
      metricsRef.current.syncLag = Math.round(value.lag);
      if (value.scrollEvents !== undefined) {
        metricsRef.current.scrollEvents = value.scrollEvents;
      }
    }
    
    // Update state for display
    setMetrics({ ...metricsRef.current });
  }, []);

  // Start a performance measurement
  const startMeasurement = useCallback((name: string) => {
    measurementsRef.current.set(name, performance.now());
  }, []);

  // End a performance measurement
  const endMeasurement = useCallback((name: string): number => {
    const startTime = measurementsRef.current.get(name);
    if (startTime === undefined) return 0;

    const endTime = performance.now();
    const duration = endTime - startTime;
    
    measurementsRef.current.delete(name);
    
    // Auto-record common measurements
    if (name === 'render') {
      recordMetric('renderTime', Math.round(duration));
    } else if (name === 'zone_render') {
      recordMetric('zoneRenderTime', Math.round(duration));
    }
    
    return duration;
  }, [recordMetric]);

  // Get current metrics
  const getMetrics = useCallback((): PerformanceMetrics => {
    return { ...metricsRef.current };
  }, []);

  // Reset metrics
  const resetMetrics = useCallback(() => {
    metricsRef.current = {
      fps: 60,
      memoryUsage: 0,
      syncLag: 0,
      renderTime: 0,
      scrollEvents: 0,
      zoneRenderTime: 0
    };
    fpsFramesRef.current = [];
    measurementsRef.current.clear();
    setMetrics(metricsRef.current);
  }, []);

  // Setup performance monitoring
  useEffect(() => {
    // Start FPS monitoring
    calculateFPS();

    // Start memory monitoring
    monitorMemory();
    memoryIntervalRef.current = setInterval(monitorMemory, MEMORY_SAMPLE_INTERVAL);

    // Monitor long tasks
    if ('PerformanceObserver' in window) {
      try {
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.duration > 50) { // Long task threshold
              console.warn('Long task detected:', {
                name: entry.name,
                duration: Math.round(entry.duration),
                startTime: Math.round(entry.startTime)
              });
            }
          }
        });
        
        observer.observe({ entryTypes: ['longtask'] });
        
        return () => {
          observer.disconnect();
          if (rafIdRef.current) {
            cancelAnimationFrame(rafIdRef.current);
          }
          if (memoryIntervalRef.current) {
            clearInterval(memoryIntervalRef.current);
          }
        };
      } catch (e) {
        // Long task observer not supported
        console.log('Long task observer not supported');
      }
    }

    return () => {
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
      }
      if (memoryIntervalRef.current) {
        clearInterval(memoryIntervalRef.current);
      }
    };
  }, [calculateFPS, monitorMemory]);

  // Periodic metrics update for display
  useEffect(() => {
    const interval = setInterval(() => {
      setMetrics({ ...metricsRef.current });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return {
    recordMetric,
    getMetrics,
    resetMetrics,
    startMeasurement,
    endMeasurement
  };
}