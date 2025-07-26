import { useRef, useCallback, useEffect } from 'react';
import type { Zone } from '@pdf-platform/shared';
import type { ExtractedContent } from '../components/viewer/DualPaneViewer';

interface ScrollPane {
  element: HTMLElement;
  type: 'left' | 'right';
  lastScrollTime: number;
}

interface ScrollMapping {
  leftPosition: number;
  rightPosition: number;
  zoneId: string;
}

interface SyncMetrics {
  lag: number;
  scrollEvents: number;
  lastSync: number;
}

interface UseSynchronizedScrollProps {
  zones: Zone[];
  extractedContent: ExtractedContent[];
  onSync?: (metrics: SyncMetrics) => void;
}

interface UseSynchronizedScrollReturn {
  syncScroll: (sourcePane: 'left' | 'right', scrollTop: number) => void;
  registerPane: (type: 'left' | 'right', element: HTMLElement) => void;
  unregisterPane: (type: 'left' | 'right') => void;
  scrollToZone: (zoneId: string) => void;
}

const SCROLL_DEBOUNCE_MS = 16; // ~60fps
const SYNC_THRESHOLD_MS = 100; // Ignore syncs within this time to prevent loops

export function useSynchronizedScroll({
  zones,
  extractedContent,
  onSync
}: UseSynchronizedScrollProps): UseSynchronizedScrollReturn {
  const panesRef = useRef<Map<string, ScrollPane>>(new Map());
  const scrollMappingsRef = useRef<ScrollMapping[]>([]);
  const metricsRef = useRef<SyncMetrics>({
    lag: 0,
    scrollEvents: 0,
    lastSync: 0
  });
  const syncTimeoutRef = useRef<NodeJS.Timeout>();
  const isSyncingRef = useRef(false);

  // Build scroll mappings between PDF positions and content positions
  const buildScrollMappings = useCallback(() => {
    const mappings: ScrollMapping[] = [];
    
    // Sort zones by page and position
    const sortedZones = [...zones].sort((a, b) => {
      const pageA = a.page || 0;
      const pageB = b.page || 0;
      
      if (pageA !== pageB) return pageA - pageB;
      
      // Sort by Y position then X position for same page
      const yDiff = a.coordinates.y - b.coordinates.y;
      if (Math.abs(yDiff) > 10) return yDiff;
      
      return a.coordinates.x - b.coordinates.x;
    });

    // Create mappings for each zone
    sortedZones.forEach((zone, index) => {
      const contentItem = extractedContent.find(c => c.zoneId === zone.id);
      if (!contentItem) return;

      mappings.push({
        leftPosition: zone.coordinates.y + (zone.page || 0) * 1000, // Approximate page offset
        rightPosition: index * 200, // Approximate content offset
        zoneId: zone.id
      });
    });

    scrollMappingsRef.current = mappings;
  }, [zones, extractedContent]);

  // Register a pane for synchronization
  const registerPane = useCallback((type: 'left' | 'right', element: HTMLElement) => {
    const pane: ScrollPane = {
      element,
      type,
      lastScrollTime: 0
    };
    
    panesRef.current.set(type, pane);
    
    // Add scroll listener
    const handleScroll = (event: Event) => {
      const now = Date.now();
      const timeSinceLastSync = now - pane.lastScrollTime;
      
      // Prevent sync loops
      if (timeSinceLastSync < SYNC_THRESHOLD_MS || isSyncingRef.current) {
        return;
      }
      
      pane.lastScrollTime = now;
      metricsRef.current.scrollEvents++;
      
      // Debounce scroll sync
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
      
      syncTimeoutRef.current = setTimeout(() => {
        syncScroll(type, element.scrollTop);
      }, SCROLL_DEBOUNCE_MS);
    };
    
    element.addEventListener('scroll', handleScroll, { passive: true });
    
    // Store cleanup function
    (element as any)._scrollCleanup = () => {
      element.removeEventListener('scroll', handleScroll);
    };
  }, []);

  // Unregister a pane
  const unregisterPane = useCallback((type: 'left' | 'right') => {
    const pane = panesRef.current.get(type);
    if (pane) {
      // Run cleanup
      if ((pane.element as any)._scrollCleanup) {
        (pane.element as any)._scrollCleanup();
      }
      panesRef.current.delete(type);
    }
  }, []);

  // Find the corresponding scroll position in the other pane
  const findCorrespondingPosition = useCallback((
    sourcePosition: number,
    sourceType: 'left' | 'right'
  ): number => {
    const mappings = scrollMappingsRef.current;
    if (mappings.length === 0) return sourcePosition;

    // Find the closest mapping
    let closestMapping = mappings[0];
    let minDistance = Infinity;
    
    const sourceKey = sourceType === 'left' ? 'leftPosition' : 'rightPosition';
    const targetKey = sourceType === 'left' ? 'rightPosition' : 'leftPosition';
    
    mappings.forEach(mapping => {
      const distance = Math.abs(mapping[sourceKey] - sourcePosition);
      if (distance < minDistance) {
        minDistance = distance;
        closestMapping = mapping;
      }
    });

    // Interpolate between mappings for smooth scrolling
    const mappingIndex = mappings.indexOf(closestMapping);
    
    if (mappingIndex < mappings.length - 1) {
      const nextMapping = mappings[mappingIndex + 1];
      const sourceRange = nextMapping[sourceKey] - closestMapping[sourceKey];
      const targetRange = nextMapping[targetKey] - closestMapping[targetKey];
      
      if (sourceRange > 0) {
        const ratio = (sourcePosition - closestMapping[sourceKey]) / sourceRange;
        return closestMapping[targetKey] + (targetRange * ratio);
      }
    }
    
    return closestMapping[targetKey];
  }, []);

  // Synchronize scroll between panes
  const syncScroll = useCallback((sourcePane: 'left' | 'right', scrollTop: number) => {
    const startTime = performance.now();
    isSyncingRef.current = true;
    
    const targetPane = sourcePane === 'left' ? 'right' : 'left';
    const target = panesRef.current.get(targetPane);
    
    if (!target) {
      isSyncingRef.current = false;
      return;
    }
    
    // Find corresponding position
    const targetPosition = findCorrespondingPosition(scrollTop, sourcePane);
    
    // Update target pane scroll
    target.lastScrollTime = Date.now();
    target.element.scrollTop = targetPosition;
    
    // Update metrics
    const endTime = performance.now();
    metricsRef.current.lag = endTime - startTime;
    metricsRef.current.lastSync = Date.now();
    
    // Notify metrics callback
    if (onSync) {
      onSync(metricsRef.current);
    }
    
    // Reset syncing flag after a delay
    setTimeout(() => {
      isSyncingRef.current = false;
    }, SYNC_THRESHOLD_MS);
  }, [findCorrespondingPosition, onSync]);

  // Scroll both panes to show a specific zone
  const scrollToZone = useCallback((zoneId: string) => {
    const zone = zones.find(z => z.id === zoneId);
    if (!zone) return;

    const leftPane = panesRef.current.get('left');
    const rightPane = panesRef.current.get('right');
    
    if (leftPane) {
      // Scroll PDF to zone position
      const pdfPosition = zone.coordinates.y + (zone.page || 0) * 1000;
      leftPane.lastScrollTime = Date.now();
      leftPane.element.scrollTop = pdfPosition;
    }
    
    if (rightPane) {
      // Find content element and scroll to it
      const contentElement = rightPane.element.querySelector(`[data-zone-id="${zoneId}"]`);
      if (contentElement) {
        contentElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        rightPane.lastScrollTime = Date.now();
      }
    }
  }, [zones]);

  // Rebuild mappings when zones or content change
  useEffect(() => {
    buildScrollMappings();
  }, [buildScrollMappings]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
      
      // Unregister all panes
      panesRef.current.forEach((_, type) => {
        unregisterPane(type as 'left' | 'right');
      });
    };
  }, [unregisterPane]);

  return {
    syncScroll,
    registerPane,
    unregisterPane,
    scrollToZone
  };
}