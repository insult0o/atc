# Navigation Components - Technical Specification

## System Architecture

```typescript
interface NavigationSystem {
  thumbnailManager: ThumbnailManager;
  zoneNavigator: ZoneNavigator;
  searchSystem: SearchSystem;
  pageManager: PageManager;
}

class NavigationSystem implements NavigationSystem {
  constructor(
    private viewer: DualPaneViewer,
    private config: NavigationConfig
  ) {
    this.thumbnailManager = new ThumbnailManager(viewer);
    this.zoneNavigator = new ZoneNavigator(viewer);
    this.searchSystem = new SearchSystem(viewer);
    this.pageManager = new PageManager(viewer);
  }
}
```

## 1. Thumbnail System

### Thumbnail Manager
```typescript
class ThumbnailManager {
  private thumbnailCache: Map<number, HTMLCanvasElement>;
  private visibleThumbnails: Set<number>;
  private renderQueue: PriorityQueue<number>;
  
  async generateThumbnail(pageNumber: number): Promise<HTMLCanvasElement> {
    const page = await this.viewer.getPage(pageNumber);
    const viewport = page.getViewport({ scale: this.getThumbnailScale() });
    
    return this.renderThumbnail(page, viewport);
  }
  
  private getThumbnailScale(): number {
    const maxDimension = Math.max(
      this.config.thumbnailWidth,
      this.config.thumbnailHeight
    );
    return maxDimension / Math.max(
      this.viewer.getPageDimensions().width,
      this.viewer.getPageDimensions().height
    );
  }
}
```

### Thumbnail View
```typescript
class ThumbnailView {
  private container: HTMLElement;
  private thumbnails: Map<number, ThumbnailElement>;
  
  render(): void {
    const visiblePages = this.getVisiblePageRange();
    this.renderVisibleThumbnails(visiblePages);
    this.removeInvisibleThumbnails(visiblePages);
  }
  
  private renderVisibleThumbnails(pages: number[]): void {
    pages.forEach(async pageNumber => {
      if (!this.thumbnails.has(pageNumber)) {
        const thumbnail = await this.manager.generateThumbnail(pageNumber);
        this.addThumbnail(pageNumber, thumbnail);
      }
    });
  }
}
```

## 2. Zone Navigation

### Zone Navigator
```typescript
class ZoneNavigator {
  private zoneIndex: Map<string, ZoneInfo>;
  private currentZone: string | null;
  
  navigateToZone(zoneId: string): void {
    const zone = this.zoneIndex.get(zoneId);
    if (zone) {
      this.viewer.scrollToZone(zone);
      this.highlightZone(zone);
      this.updateCurrentZone(zoneId);
    }
  }
  
  getZoneTree(): ZoneTreeNode[] {
    return this.buildZoneTree(this.zoneIndex);
  }
}
```

### Zone Tree View
```typescript
class ZoneTreeView {
  private treeContainer: HTMLElement;
  
  renderZoneTree(zones: ZoneTreeNode[]): void {
    this.treeContainer.innerHTML = '';
    zones.forEach(zone => {
      const node = this.createZoneNode(zone);
      this.treeContainer.appendChild(node);
    });
  }
  
  private createZoneNode(zone: ZoneTreeNode): HTMLElement {
    const node = document.createElement('div');
    node.classList.add('zone-node');
    node.dataset.zoneId = zone.id;
    
    // Add zone type icon
    node.appendChild(this.createZoneIcon(zone.type));
    
    // Add confidence indicator
    node.appendChild(this.createConfidenceIndicator(zone.confidence));
    
    return node;
  }
}
```

## 3. Search System

### Search Engine
```typescript
class SearchSystem {
  private searchIndex: SearchIndex;
  private currentResults: SearchResult[];
  private currentPosition: number = -1;
  
  async search(query: string, options: SearchOptions): Promise<SearchResult[]> {
    const results = await this.searchIndex.search(query, options);
    this.currentResults = results;
    this.currentPosition = results.length > 0 ? 0 : -1;
    return results;
  }
  
  navigateToResult(index: number): void {
    const result = this.currentResults[index];
    if (result) {
      this.viewer.scrollToPosition(result.position);
      this.highlightResult(result);
      this.currentPosition = index;
    }
  }
}
```

### Search UI
```typescript
class SearchUI {
  private searchInput: HTMLInputElement;
  private resultsContainer: HTMLElement;
  private navigationButtons: SearchNavigationButtons;
  
  initialize(): void {
    this.setupSearchInput();
    this.setupResultsView();
    this.setupNavigationButtons();
  }
  
  private async handleSearch(): Promise<void> {
    const query = this.searchInput.value;
    const results = await this.searchSystem.search(query, this.getSearchOptions());
    this.renderResults(results);
  }
}
```

## 4. Page Management

### Page Manager
```typescript
class PageManager {
  private loadedPages: Map<number, PageContent>;
  private visiblePages: Set<number>;
  
  async navigateToPage(pageNumber: number): Promise<void> {
    await this.ensurePageLoaded(pageNumber);
    this.viewer.scrollToPage(pageNumber);
    this.updateVisiblePages();
  }
  
  private async ensurePageLoaded(pageNumber: number): Promise<void> {
    if (!this.loadedPages.has(pageNumber)) {
      const content = await this.viewer.loadPage(pageNumber);
      this.loadedPages.set(pageNumber, content);
    }
  }
}
```

### Page Controls
```typescript
class PageControls {
  private pageInput: HTMLInputElement;
  private pageButtons: PageNavigationButtons;
  
  initialize(): void {
    this.setupPageInput();
    this.setupNavigationButtons();
    this.bindKeyboardShortcuts();
  }
  
  private handlePageChange(pageNumber: number): void {
    if (this.isValidPage(pageNumber)) {
      this.pageManager.navigateToPage(pageNumber);
      this.updatePageDisplay(pageNumber);
    }
  }
}
```

## 5. Performance Optimization

### Resource Management
```typescript
class NavigationResourceManager {
  private maxThumbnailCache = 50;
  private maxLoadedPages = 10;
  
  manageResources(): void {
    this.manageThumbnailCache();
    this.manageLoadedPages();
    this.cleanupSearchResults();
  }
  
  private manageThumbnailCache(): void {
    if (this.thumbnailManager.cacheSize > this.maxThumbnailCache) {
      this.thumbnailManager.trimCache(this.maxThumbnailCache);
    }
  }
}
```

### Event Optimization
```typescript
class NavigationEventOptimizer {
  private scrollThrottler: Throttler;
  private searchDebouncer: Debouncer;
  
  optimizeEvents(): void {
    this.scrollThrottler.throttle(this.handleScroll, 16);
    this.searchDebouncer.debounce(this.handleSearch, 300);
  }
}
```

## Implementation Strategy

### Phase 1: Core Navigation
1. Basic page navigation
2. Simple thumbnail view
3. Zone list view
4. Basic search

### Phase 2: Enhanced Features
1. Advanced thumbnails with caching
2. Zone tree with filtering
3. Full-text search with highlighting
4. Page preloading

### Phase 3: Performance
1. Resource management
2. Event optimization
3. Lazy loading
4. Cache management

## Usage Example

```typescript
// Initialize the navigation system
const navigationSystem = new NavigationSystem(viewer, {
  thumbnailSize: { width: 120, height: 160 },
  maxThumbnailCache: 50,
  preloadPages: 2,
  searchDebounceTime: 300
});

// Set up navigation components
navigationSystem.initialize();

// Handle navigation events
navigationSystem.on('pageChange', (pageNumber) => {
  // Update UI and sync views
});

navigationSystem.on('zoneSelect', (zoneId) => {
  // Handle zone selection
});
``` 