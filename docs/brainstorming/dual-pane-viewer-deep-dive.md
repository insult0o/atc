# Dual-Pane Viewer - Deep Dive Analysis

## Core Functionality

### View Components
```typescript
interface ViewerState {
  layout: 'horizontal' | 'vertical' | 'pip';
  splitRatio: number;  // 0-1
  syncMode: 'locked' | 'independent';
  scale: number;
  currentPage: number;
}
```

### 1. PDF Rendering
- **Original Document (Left Pane)**
  - PDF.js for rendering
  - Canvas-based display
  - Hardware acceleration
  - Lazy page loading
  - Resolution optimization

- **Extracted Content (Right Pane)**
  - HTML/Canvas hybrid rendering
  - Dynamic content updates
  - Style preservation
  - Real-time highlighting
  - Error visualization

## Layout System

### 1. Split Modes
- **Horizontal Split**
  ```css
  .viewer-container {
    display: flex;
    flex-direction: row;
  }
  ```
  - Default 50/50 split
  - Draggable divider
  - Minimum pane widths
  - Collapse/expand controls

- **Vertical Split**
  ```css
  .viewer-container {
    display: flex;
    flex-direction: column;
  }
  ```
  - Stack view for taller documents
  - Height-based scrolling
  - Responsive breakpoints
  - Mobile optimization

- **Picture-in-Picture**
  - Floating secondary view
  - Resizable/movable window
  - Always-on-top option
  - Quick toggle shortcut
  - Position memory

### 2. Layout Controls
- **Split Ratio Control**
  - Drag handle UI
  - Percentage input
  - Preset ratios (25/75, 50/50, 75/25)
  - Double-click to equalize
  - Keyboard adjustment

- **View Mode Switching**
  ```typescript
  interface LayoutControls {
    switchLayout(mode: LayoutMode): void;
    setSplitRatio(ratio: number): void;
    togglePiP(): void;
    resetLayout(): void;
  }
  ```

## Synchronization Features

### 1. Scroll Synchronization
- **Sync Modes**
  ```typescript
  type ScrollSyncMode = 
    | 'pixel'      // Exact pixel matching
    | 'percentage' // Position percentage
    | 'semantic'   // Content-aware
    | 'none';      // Independent
  ```

- **Implementation**
  ```typescript
  class ScrollManager {
    private syncMode: ScrollSyncMode;
    private isScrolling: boolean;
    
    syncScroll(sourcePane: Pane, targetPane: Pane) {
      if (this.isScrolling) return; // Prevent loops
      this.isScrolling = true;
      
      switch(this.syncMode) {
        case 'pixel':
          this.syncByPixel(sourcePane, targetPane);
          break;
        case 'percentage':
          this.syncByPercentage(sourcePane, targetPane);
          break;
        case 'semantic':
          this.syncBySemantic(sourcePane, targetPane);
          break;
      }
      
      this.isScrolling = false;
    }
  }
  ```

### 2. Zoom Synchronization
- **Zoom Features**
  - Synchronized zoom levels
  - Independent zoom option
  - Fit to width/height
  - Custom zoom presets
  - Mouse wheel zoom

- **Zoom Controls**
  ```typescript
  interface ZoomControls {
    zoomIn(): void;
    zoomOut(): void;
    setZoom(level: number): void;
    fitToWidth(): void;
    fitToHeight(): void;
    resetZoom(): void;
  }
  ```

### 3. Page Synchronization
- **Page Matching**
  - Automatic page alignment
  - Page number display
  - Jump to page
  - Thumbnail navigation
  - Page mismatch handling

## Navigation System

### 1. Thumbnail Navigation
- **Thumbnail Panel**
  - Page previews
  - Current position indicator
  - Quick page jumps
  - Multi-page selection
  - Drag-drop reordering

- **Implementation**
  ```typescript
  interface ThumbnailManager {
    generateThumbnail(page: number): Promise<string>;
    updateVisibleThumbnails(): void;
    handleThumbnailClick(page: number): void;
    preloadThumbnails(startPage: number, count: number): void;
  }
  ```

### 2. Zone Navigation
- **Zone List**
  - Hierarchical zone view
  - Zone type filtering
  - Confidence filtering
  - Search/filter zones
  - Quick zone jumps

- **Zone Highlighting**
  ```typescript
  interface ZoneHighlight {
    highlightZone(zoneId: string): void;
    clearHighlight(): void;
    flashZone(zoneId: string): void;
    showZonePreview(zoneId: string): void;
  }
  ```

### 3. Search System
- **Search Features**
  - Full text search
  - Regular expressions
  - Case sensitivity
  - Whole word matching
  - Search history

- **Results Navigation**
  - Result highlighting
  - Next/previous result
  - Result count
  - Context preview
  - Jump to result

## Performance Considerations

### 1. Rendering Optimization
- Use `requestAnimationFrame` for smooth updates
- Implement virtual scrolling for large documents
- Canvas layer recycling
- GPU acceleration where available
- Lazy loading of content

### 2. Memory Management
- Implement page unloading for large documents
- Cache frequently accessed pages
- Clear unused resources
- Monitor memory usage
- Implement cleanup routines

### 3. Event Handling
- Debounce scroll events
- Throttle zoom operations
- Batch DOM updates
- Use passive event listeners
- Optimize resize handlers

## Technical Implementation

### 1. Component Architecture
```typescript
class DualPaneViewer {
  private leftPane: PDFPane;
  private rightPane: ContentPane;
  private syncManager: SyncManager;
  private navigationManager: NavigationManager;
  private layoutManager: LayoutManager;
  
  constructor(config: ViewerConfig) {
    this.initializeComponents();
    this.setupEventHandlers();
    this.applyInitialLayout();
  }
  
  private initializeComponents() {
    // Initialize all sub-components
  }
  
  private setupEventHandlers() {
    // Set up event listeners and handlers
  }
  
  private applyInitialLayout() {
    // Apply initial layout configuration
  }
}
```

### 2. State Management
```typescript
interface ViewerState {
  layout: LayoutConfig;
  sync: SyncConfig;
  navigation: NavigationConfig;
  ui: UIState;
  document: DocumentState;
}

class StateManager {
  private state: ViewerState;
  private subscribers: Set<StateSubscriber>;
  
  updateState(partial: Partial<ViewerState>) {
    // Update state and notify subscribers
  }
}
```

Would you like to:
1. Explore any specific aspect of the dual-pane viewer in more detail
2. Discuss implementation priorities for these features
3. Look at specific technical challenges
4. Consider user interaction patterns
5. Move on to another UI feature

Please choose a number and we'll continue our deep dive in that direction! 