# Synchronization Engine - Technical Specification

## System Architecture

```typescript
interface SyncEngine {
  scrollSync: ScrollSynchronizer;
  zoomSync: ZoomSynchronizer;
  pageSync: PageSynchronizer;
  eventManager: EventManager;
}

class SynchronizationEngine implements SyncEngine {
  private readonly leftPane: ViewerPane;
  private readonly rightPane: ViewerPane;
  private readonly config: SyncConfig;
  
  constructor(leftPane: ViewerPane, rightPane: ViewerPane, config: SyncConfig) {
    this.scrollSync = new ScrollSynchronizer(leftPane, rightPane);
    this.zoomSync = new ZoomSynchronizer(leftPane, rightPane);
    this.pageSync = new PageSynchronizer(leftPane, rightPane);
    this.eventManager = new EventManager();
  }
}
```

## 1. Scroll Synchronization

### Core Scroll Manager
```typescript
class ScrollSynchronizer {
  private isScrolling = false;
  private scrollTimeout: number | null = null;
  private lastScrollPosition = { x: 0, y: 0 };
  
  private modes = {
    pixel: new PixelScrollSync(),
    percentage: new PercentageScrollSync(),
    semantic: new SemanticScrollSync(),
    independent: new IndependentScrollSync()
  };

  synchronizeScroll(source: ViewerPane, target: ViewerPane, event: ScrollEvent): void {
    if (this.isScrolling) return;
    
    this.isScrolling = true;
    try {
      const mode = this.modes[this.currentMode];
      mode.sync(source, target, event);
      this.updateLastPosition(source);
    } finally {
      this.scheduleScrollEnd();
      this.isScrolling = false;
    }
  }
}
```

### Scroll Modes

```typescript
interface ScrollMode {
  sync(source: ViewerPane, target: ViewerPane, event: ScrollEvent): void;
}

class PixelScrollSync implements ScrollMode {
  sync(source: ViewerPane, target: ViewerPane, event: ScrollEvent): void {
    const sourceRect = source.getViewportRect();
    target.setScrollPosition({
      x: sourceRect.x,
      y: sourceRect.y,
      immediate: true
    });
  }
}

class PercentageScrollSync implements ScrollMode {
  sync(source: ViewerPane, target: ViewerPane, event: ScrollEvent): void {
    const sourcePercent = {
      x: source.scrollLeft / (source.scrollWidth - source.clientWidth),
      y: source.scrollTop / (source.scrollHeight - source.clientHeight)
    };
    
    target.scrollToPercentage(sourcePercent);
  }
}

class SemanticScrollSync implements ScrollMode {
  sync(source: ViewerPane, target: ViewerPane, event: ScrollEvent): void {
    const sourceElements = source.getVisibleElements();
    const targetElements = this.findMatchingElements(sourceElements, target);
    target.scrollToElements(targetElements);
  }
}
```

## 2. Zoom Synchronization

### Zoom Manager
```typescript
class ZoomSynchronizer {
  private currentZoom = 1;
  private zoomLevels = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4];
  
  synchronizeZoom(source: ViewerPane, target: ViewerPane, scale: number): void {
    const centerPoint = source.getViewCenter();
    
    // Apply zoom to both panes
    source.setZoom(scale, centerPoint);
    target.setZoom(scale, this.translatePoint(centerPoint, source, target));
    
    // Update content resolution
    this.updateResolution(source, scale);
    this.updateResolution(target, scale);
  }
  
  private translatePoint(point: Point, source: ViewerPane, target: ViewerPane): Point {
    // Convert point from source coordinates to target coordinates
    return this.coordinateMapper.translate(point, source, target);
  }
}
```

### Zoom Controls
```typescript
class ZoomController {
  private touchZoom: TouchZoomHandler;
  private wheelZoom: WheelZoomHandler;
  private buttonZoom: ButtonZoomHandler;
  
  handleZoomEvent(event: ZoomEvent): void {
    const handler = this.getHandler(event.type);
    const scale = handler.calculateScale(event);
    this.zoomSynchronizer.synchronizeZoom(
      event.source,
      event.target,
      scale
    );
  }
}
```

## 3. Page Synchronization

### Page Manager
```typescript
class PageSynchronizer {
  private pageMap: Map<number, PagePair>;
  
  synchronizePages(source: ViewerPane, target: ViewerPane): void {
    const visiblePages = source.getVisiblePages();
    const matchingPages = this.findMatchingPages(visiblePages, target);
    
    this.ensureVisibility(matchingPages, target);
    this.updatePageMap(visiblePages, matchingPages);
  }
  
  private findMatchingPages(sourcePages: Page[], target: ViewerPane): Page[] {
    return sourcePages.map(page => ({
      number: page.number,
      content: target.getPage(page.number)
    }));
  }
}
```

### Page Alignment
```typescript
class PageAlignmentManager {
  alignPages(source: ViewerPane, target: ViewerPane): void {
    const sourceAlignment = source.getPageAlignment();
    target.alignToPage(sourceAlignment.pageNumber, {
      position: sourceAlignment.position,
      offset: sourceAlignment.offset
    });
  }
}
```

## 4. Event Management

### Event System
```typescript
class EventManager {
  private handlers: Map<string, Set<EventHandler>>;
  private eventQueue: PriorityQueue<SyncEvent>;
  
  handleEvent(event: SyncEvent): void {
    // Debounce and throttle as needed
    if (this.shouldProcessEvent(event)) {
      this.eventQueue.enqueue(event, this.calculatePriority(event));
      this.processEventQueue();
    }
  }
  
  private shouldProcessEvent(event: SyncEvent): boolean {
    return this.debouncer.shouldProcess(event) &&
           this.throttler.shouldProcess(event);
  }
}
```

### Event Optimization
```typescript
class EventOptimizer {
  private scrollDebouncer: Debouncer;
  private zoomThrottler: Throttler;
  private pageChangeDebouncer: Debouncer;
  
  optimizeEvent(event: SyncEvent): OptimizedEvent {
    switch (event.type) {
      case 'scroll':
        return this.scrollDebouncer.optimize(event);
      case 'zoom':
        return this.zoomThrottler.optimize(event);
      case 'pageChange':
        return this.pageChangeDebouncer.optimize(event);
      default:
        return event;
    }
  }
}
```

## 5. Performance Considerations

### Memory Management
```typescript
class SyncMemoryManager {
  private maxEventHistory = 100;
  private eventHistory: CircularBuffer<SyncEvent>;
  
  manageMemory(): void {
    this.eventHistory.trim(this.maxEventHistory);
    this.clearUnusedHandlers();
    this.compactPageMap();
  }
}
```

### Event Batching
```typescript
class EventBatcher {
  private batchTimeWindow = 16; // ms
  private currentBatch: SyncEvent[] = [];
  
  batchEvents(events: SyncEvent[]): BatchedEvent[] {
    return events
      .reduce(this.aggregateEvents, [])
      .map(this.optimizeBatch);
  }
}
```

## Implementation Strategy

### Phase 1: Basic Synchronization
1. Basic scroll sync (pixel-based)
2. Simple zoom sync
3. Basic page alignment
4. Essential event handling

### Phase 2: Advanced Features
1. Multiple scroll modes
2. Complex zoom behaviors
3. Semantic page alignment
4. Event optimization

### Phase 3: Performance
1. Event batching
2. Memory optimization
3. Advanced caching
4. Performance monitoring

## Usage Example

```typescript
// Initialize the sync engine
const syncEngine = new SynchronizationEngine(leftPane, rightPane, {
  scrollMode: 'semantic',
  zoomSync: true,
  pageSync: true
});

// Configure event handling
syncEngine.eventManager.configure({
  debounceTime: 16,
  throttleTime: 32,
  batchSize: 10
});

// Start synchronization
syncEngine.start();
``` 