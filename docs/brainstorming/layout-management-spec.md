# Layout Management - Technical Specification

## System Architecture

```typescript
interface LayoutSystem {
  splitManager: SplitManager;
  responsiveManager: ResponsiveManager;
  pipManager: PictureInPictureManager;
  transitionManager: TransitionManager;
}

class LayoutManager implements LayoutSystem {
  constructor(
    private container: HTMLElement,
    private config: LayoutConfig
  ) {
    this.splitManager = new SplitManager(container);
    this.responsiveManager = new ResponsiveManager(container);
    this.pipManager = new PictureInPictureManager();
    this.transitionManager = new TransitionManager();
  }
}
```

## 1. Split Modes

### Split Manager
```typescript
class SplitManager {
  private currentMode: SplitMode = 'horizontal';
  private splitRatio: number = 0.5;
  
  setSplitMode(mode: SplitMode): void {
    this.transitionManager.beginTransition();
    
    this.container.dataset.splitMode = mode;
    this.container.style.flexDirection = 
      mode === 'horizontal' ? 'row' : 'column';
    
    this.updatePaneSizes();
    this.transitionManager.endTransition();
  }
  
  setSplitRatio(ratio: number): void {
    this.splitRatio = Math.max(0.1, Math.min(0.9, ratio));
    this.updatePaneSizes();
  }
}
```

### Split Controls
```typescript
class SplitControls {
  private divider: HTMLElement;
  private isDragging: boolean = false;
  
  initialize(): void {
    this.setupDivider();
    this.bindDragEvents();
    this.bindDoubleClickReset();
  }
  
  private handleDrag(event: MouseEvent): void {
    if (this.isDragging) {
      const containerRect = this.container.getBoundingClientRect();
      const ratio = this.currentMode === 'horizontal'
        ? (event.clientX - containerRect.left) / containerRect.width
        : (event.clientY - containerRect.top) / containerRect.height;
      
      this.splitManager.setSplitRatio(ratio);
    }
  }
}
```

## 2. Responsive Design

### Responsive Manager
```typescript
class ResponsiveManager {
  private breakpoints = {
    mobile: 480,
    tablet: 768,
    desktop: 1024
  };
  
  private currentBreakpoint: string;
  
  handleResize(): void {
    const width = window.innerWidth;
    const newBreakpoint = this.getBreakpoint(width);
    
    if (newBreakpoint !== this.currentBreakpoint) {
      this.currentBreakpoint = newBreakpoint;
      this.applyBreakpointLayout(newBreakpoint);
    }
  }
  
  private applyBreakpointLayout(breakpoint: string): void {
    switch (breakpoint) {
      case 'mobile':
        this.splitManager.setSplitMode('vertical');
        this.adjustForMobile();
        break;
      case 'tablet':
        this.splitManager.setSplitMode('horizontal');
        this.adjustForTablet();
        break;
      case 'desktop':
        this.splitManager.setSplitMode('horizontal');
        this.adjustForDesktop();
        break;
    }
  }
}
```

### Layout Adaptations
```typescript
class LayoutAdapter {
  private layouts: Map<string, LayoutConfig> = new Map([
    ['mobile', {
      splitMode: 'vertical',
      toolbarPosition: 'bottom',
      navigationCollapsed: true
    }],
    ['tablet', {
      splitMode: 'horizontal',
      toolbarPosition: 'top',
      navigationCollapsed: false
    }],
    ['desktop', {
      splitMode: 'horizontal',
      toolbarPosition: 'top',
      navigationExpanded: true
    }]
  ]);
  
  applyLayout(breakpoint: string): void {
    const config = this.layouts.get(breakpoint);
    if (config) {
      this.updateLayout(config);
    }
  }
}
```

## 3. Picture-in-Picture

### PiP Manager
```typescript
class PictureInPictureManager {
  private pipWindow: HTMLElement;
  private isActive: boolean = false;
  
  togglePiP(): void {
    if (this.isActive) {
      this.deactivatePiP();
    } else {
      this.activatePiP();
    }
  }
  
  private activatePiP(): void {
    this.pipWindow = this.createPiPWindow();
    this.setupDraggable();
    this.setupResizable();
    this.moveContentToPiP();
    this.isActive = true;
  }
  
  private createPiPWindow(): HTMLElement {
    const window = document.createElement('div');
    window.classList.add('pip-window');
    // Add controls, resize handle, etc.
    return window;
  }
}
```

### PiP Controls
```typescript
class PiPControls {
  private position = { x: 0, y: 0 };
  private size = { width: 300, height: 200 };
  
  setupDraggable(): void {
    const dragHandler = new DragHandler(this.pipWindow, {
      onDrag: this.handleDrag.bind(this),
      boundary: 'viewport'
    });
  }
  
  setupResizable(): void {
    const resizeHandler = new ResizeHandler(this.pipWindow, {
      onResize: this.handleResize.bind(this),
      minSize: { width: 200, height: 150 },
      maxSize: { width: 800, height: 600 }
    });
  }
}
```

## 4. Layout Transitions

### Transition Manager
```typescript
class TransitionManager {
  private isTransitioning: boolean = false;
  private transitionDuration: number = 300;
  
  async transition(
    from: LayoutState,
    to: LayoutState
  ): Promise<void> {
    this.isTransitioning = true;
    
    // Prepare transition
    this.container.classList.add('transitioning');
    
    // Apply changes
    await this.animateTransition(from, to);
    
    // Cleanup
    this.container.classList.remove('transitioning');
    this.isTransitioning = false;
  }
  
  private async animateTransition(
    from: LayoutState,
    to: LayoutState
  ): Promise<void> {
    return new Promise(resolve => {
      requestAnimationFrame(() => {
        this.applyTransitionStyles(to);
        setTimeout(resolve, this.transitionDuration);
      });
    });
  }
}
```

### Animation System
```typescript
class LayoutAnimator {
  private animations: Map<string, Animation> = new Map();
  
  animate(element: HTMLElement, keyframes: Keyframe[]): void {
    const animation = element.animate(keyframes, {
      duration: this.transitionDuration,
      easing: 'ease-in-out',
      fill: 'forwards'
    });
    
    this.animations.set(element.id, animation);
  }
  
  cancelAnimations(): void {
    this.animations.forEach(animation => animation.cancel());
    this.animations.clear();
  }
}
```

## 5. Performance Optimization

### Layout Performance
```typescript
class LayoutOptimizer {
  private rafId: number | null = null;
  private pendingUpdates = new Set<string>();
  
  scheduleUpdate(updateType: string, data: any): void {
    this.pendingUpdates.add(updateType);
    
    if (!this.rafId) {
      this.rafId = requestAnimationFrame(() => {
        this.processUpdates();
      });
    }
  }
  
  private processUpdates(): void {
    // Batch process all pending layout updates
    this.pendingUpdates.forEach(updateType => {
      this.applyUpdate(updateType);
    });
    
    this.pendingUpdates.clear();
    this.rafId = null;
  }
}
```

### Resource Management
```typescript
class LayoutResourceManager {
  private observers: Map<string, ResizeObserver>;
  
  manageResources(): void {
    this.cleanupUnusedObservers();
    this.optimizeEventListeners();
    this.recycleLayoutElements();
  }
  
  private cleanupUnusedObservers(): void {
    this.observers.forEach((observer, key) => {
      if (!this.isObserverActive(key)) {
        observer.disconnect();
        this.observers.delete(key);
      }
    });
  }
}
```

## Implementation Strategy

### Phase 1: Core Layout
1. Basic split modes
2. Simple responsive design
3. Layout transitions
4. Essential controls

### Phase 2: Advanced Features
1. PiP implementation
2. Complex responsive layouts
3. Advanced transitions
4. Gesture support

### Phase 3: Performance
1. Layout optimization
2. Animation performance
3. Resource management
4. Event optimization

## Usage Example

```typescript
// Initialize the layout system
const layoutManager = new LayoutManager(container, {
  defaultMode: 'horizontal',
  splitRatio: 0.5,
  responsive: true,
  pipEnabled: true
});

// Configure layout
layoutManager.initialize();

// Handle layout events
layoutManager.on('layoutChange', (layout) => {
  // Update UI state
});

layoutManager.on('pipToggle', (active) => {
  // Handle PiP state
});
``` 