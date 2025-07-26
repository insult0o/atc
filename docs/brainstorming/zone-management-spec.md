# Zone Management - Technical Specification

## System Architecture

```typescript
interface ZoneSystem {
  selectionManager: SelectionManager;
  zoneManipulator: ZoneManipulator;
  visualFeedback: VisualFeedbackManager;
  historyManager: ZoneHistoryManager;
}

class ZoneManager implements ZoneSystem {
  constructor(
    private viewer: DualPaneViewer,
    private config: ZoneConfig
  ) {
    this.selectionManager = new SelectionManager(viewer);
    this.zoneManipulator = new ZoneManipulator(viewer);
    this.visualFeedback = new VisualFeedbackManager();
    this.historyManager = new ZoneHistoryManager();
  }
}
```

## 1. Selection Tools

### Selection Manager
```typescript
class SelectionManager {
  private currentTool: SelectionTool;
  private selectedZones: Set<string>;
  
  private tools = {
    rectangle: new RectangleSelect(),
    lasso: new LassoSelect(),
    magic: new MagicWand(),
    column: new ColumnSelect()
  };
  
  setTool(toolType: SelectionToolType): void {
    this.currentTool = this.tools[toolType];
    this.updateCursor();
  }
  
  handleSelection(event: MouseEvent): void {
    const selection = this.currentTool.select(event);
    this.processSelection(selection);
  }
}
```

### Selection Tools
```typescript
interface SelectionTool {
  select(event: MouseEvent): Selection;
  preview(event: MouseEvent): void;
  cancel(): void;
}

class RectangleSelect implements SelectionTool {
  private startPoint: Point;
  private currentRect: Rect;
  
  select(event: MouseEvent): Selection {
    if (!this.startPoint) {
      this.startPoint = { x: event.clientX, y: event.clientY };
      return;
    }
    
    return {
      type: 'rectangle',
      bounds: this.calculateBounds(event),
      elements: this.getElementsInBounds()
    };
  }
}

class MagicWand implements SelectionTool {
  private tolerance = 32;
  
  select(event: MouseEvent): Selection {
    const startElement = this.getElementAtPoint(event);
    return {
      type: 'content',
      elements: this.findSimilarElements(startElement)
    };
  }
  
  private findSimilarElements(start: Element): Element[] {
    return this.floodFill(start, (el) => 
      this.calculateSimilarity(start, el) <= this.tolerance
    );
  }
}
```

## 2. Zone Manipulation

### Zone Manipulator
```typescript
class ZoneManipulator {
  private activeZone: Zone | null;
  private operations: ZoneOperations;
  
  modifyZone(zoneId: string, changes: ZoneChanges): void {
    const zone = this.getZone(zoneId);
    if (zone) {
      this.historyManager.recordChange(zone);
      this.applyChanges(zone, changes);
      this.updateZone(zone);
    }
  }
  
  mergeZones(zones: string[]): void {
    const newZone = this.createMergedZone(zones);
    this.historyManager.recordMerge(zones, newZone);
    this.deleteZones(zones);
    this.addZone(newZone);
  }
}
```

### Zone Operations
```typescript
class ZoneOperations {
  resize(zone: Zone, newBounds: Rect): void {
    zone.bounds = this.validateBounds(newBounds);
    this.updateZoneContent(zone);
  }
  
  split(zone: Zone, splitPoints: Point[]): Zone[] {
    const subZones = this.calculateSubZones(zone, splitPoints);
    return subZones.map(bounds => this.createZone(bounds));
  }
  
  reprocess(zone: Zone, options: ProcessingOptions): Promise<void> {
    return this.processingPipeline.process(zone, options);
  }
}
```

## 3. Visual Feedback

### Visual Feedback Manager
```typescript
class VisualFeedbackManager {
  private overlays: Map<string, Overlay>;
  private animations: Map<string, Animation>;
  
  showFeedback(
    type: FeedbackType,
    target: Element,
    options: FeedbackOptions
  ): void {
    const overlay = this.createOverlay(type, target);
    this.animateOverlay(overlay, options);
    this.scheduleCleanup(overlay);
  }
  
  private createOverlay(
    type: FeedbackType,
    target: Element
  ): Overlay {
    const overlay = document.createElement('div');
    overlay.classList.add(`zone-overlay-${type}`);
    this.positionOverlay(overlay, target);
    return overlay;
  }
}
```

### Feedback Types
```typescript
class ConfidenceIndicator {
  private colors = {
    high: '#4CAF50',
    medium: '#FFC107',
    low: '#F44336'
  };
  
  showConfidence(zone: Zone): void {
    const color = this.getConfidenceColor(zone.confidence);
    this.visualFeedback.showFeedback('confidence', zone.element, {
      color,
      duration: 'persistent',
      position: 'corner'
    });
  }
}

class ProcessingIndicator {
  showProcessing(zone: Zone): void {
    this.visualFeedback.showFeedback('processing', zone.element, {
      type: 'spinner',
      message: 'Processing...',
      cancelable: true
    });
  }
}
```

## 4. Zone History

### History Manager
```typescript
class ZoneHistoryManager {
  private history: ZoneChange[] = [];
  private currentIndex = -1;
  private maxHistory = 50;
  
  recordChange(change: ZoneChange): void {
    this.history = this.history.slice(0, this.currentIndex + 1);
    this.history.push(change);
    
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    } else {
      this.currentIndex++;
    }
  }
  
  undo(): void {
    if (this.canUndo()) {
      const change = this.history[this.currentIndex];
      this.revertChange(change);
      this.currentIndex--;
    }
  }
}
```

### Change Tracking
```typescript
class ChangeTracker {
  private changes = new Map<string, ZoneChange[]>();
  
  trackChange(zone: Zone, type: ChangeType): void {
    const change = this.createChange(zone, type);
    this.changes.get(zone.id)?.push(change);
    this.historyManager.recordChange(change);
  }
  
  getChangeHistory(zoneId: string): ZoneChange[] {
    return this.changes.get(zoneId) || [];
  }
}
```

## 5. Performance Optimization

### Zone Cache
```typescript
class ZoneCache {
  private cache = new LRUCache<string, ZoneData>(100);
  
  cacheZone(zone: Zone): void {
    this.cache.set(zone.id, this.serializeZone(zone));
  }
  
  restoreZone(id: string): Zone | null {
    const data = this.cache.get(id);
    return data ? this.deserializeZone(data) : null;
  }
}
```

### Batch Operations
```typescript
class ZoneBatchProcessor {
  private batchSize = 5;
  private processingQueue: Zone[] = [];
  
  async processBatch(zones: Zone[]): Promise<void> {
    for (let i = 0; i < zones.length; i += this.batchSize) {
      const batch = zones.slice(i, i + this.batchSize);
      await Promise.all(batch.map(zone => 
        this.processZone(zone)
      ));
    }
  }
}
```

## Implementation Strategy

### Phase 1: Core Functionality
1. Basic selection tools
2. Simple zone manipulation
3. Essential visual feedback
4. Basic history management

### Phase 2: Advanced Features
1. Complex selection tools
2. Advanced zone operations
3. Rich visual feedback
4. Comprehensive history

### Phase 3: Performance
1. Zone caching
2. Batch processing
3. Optimized rendering
4. Memory management

## Usage Example

```typescript
// Initialize the zone system
const zoneManager = new ZoneManager(viewer, {
  selectionTools: ['rectangle', 'lasso', 'magic'],
  maxHistory: 50,
  batchSize: 5
});

// Configure selection tool
zoneManager.selectionManager.setTool('rectangle');

// Handle selection
viewer.on('mousedown', (event) => {
  zoneManager.selectionManager.handleSelection(event);
});

// Manipulate zones
zoneManager.zoneManipulator.modifyZone('zone1', {
  bounds: newBounds,
  confidence: 0.85
});

// Show feedback
zoneManager.visualFeedback.showFeedback('confidence', zone, {
  type: 'highlight',
  duration: 2000
});
``` 