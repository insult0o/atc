# Frontend Architecture

## Technology Stack
- React with TypeScript
- shadcn/ui components
- Tailwind v4 styling
- PDF.js for rendering
- Canvas for zone selection
- WebSocket for real-time updates
- Zustand for state management

## Component Architecture

### UI Layer
```typescript
// App.tsx
interface AppState {
  currentDocument: PDFDocument | null;
  selectedZone: Zone | null;
  processingStatus: ProcessingStatus;
  confidenceScores: Record<string, number>;
}

// State management
const useStore = create<AppState>((set) => ({
  currentDocument: null,
  selectedZone: null,
  processingStatus: 'idle',
  confidenceScores: {},
  setDocument: (doc: PDFDocument) => set({ currentDocument: doc }),
  // ... other actions
}));
```

### Dual-Pane Viewer
```typescript
// components/DualPaneViewer.tsx
interface DualPaneViewerProps {
  document: PDFDocument;
  extractedContent: ExtractedContent;
  onZoneSelect: (zone: Zone) => void;
}

const DualPaneViewer: React.FC<DualPaneViewerProps> = ({
  document,
  extractedContent,
  onZoneSelect,
}) => {
  // Viewer implementation
};
```

### Zone Manager
```typescript
// components/ZoneManager.tsx
interface Zone {
  id: string;
  type: 'text' | 'table' | 'diagram';
  bounds: BoundingBox;
  confidence: number;
  tool: string;
  content: any;
}

interface ZoneManagerProps {
  zones: Zone[];
  onZoneUpdate: (zone: Zone) => void;
  onToolSelect: (zoneId: string, tool: string) => void;
}
```

### Export UI
```typescript
// components/ExportUI.tsx
interface ExportOptions {
  format: 'rag_json' | 'fine_tune_jsonl';
  zones: string[];
  pages: number[];
}

interface ExportUIProps {
  onExport: (options: ExportOptions) => Promise<void>;
  availableZones: Zone[];
  totalPages: number;
}
```

## State Management

### Document State
```typescript
interface DocumentState {
  currentPage: number;
  zoom: number;
  rotation: number;
  selectedZones: string[];
}

const useDocumentStore = create<DocumentState>((set) => ({
  currentPage: 1,
  zoom: 1,
  rotation: 0,
  selectedZones: [],
  // ... actions
}));
```

### Processing State
```typescript
interface ProcessingState {
  status: 'idle' | 'processing' | 'error';
  progress: number;
  currentTool: string | null;
  errors: Record<string, string>;
}

const useProcessingStore = create<ProcessingState>((set) => ({
  status: 'idle',
  progress: 0,
  currentTool: null,
  errors: {},
  // ... actions
}));
```

## WebSocket Integration

### Real-time Updates
```typescript
// utils/websocket.ts
class ProcessingWebSocket {
  private ws: WebSocket;

  constructor(documentId: string) {
    this.ws = new WebSocket(`ws://api/processing/${documentId}`);
    this.setupListeners();
  }

  private setupListeners() {
    this.ws.onmessage = (event) => {
      const update = JSON.parse(event.data);
      // Handle different update types
      switch (update.type) {
        case 'progress':
          useProcessingStore.getState().setProgress(update.progress);
          break;
        case 'confidence':
          useStore.getState().updateConfidence(update.zoneId, update.score);
          break;
        // ... other cases
      }
    };
  }
}
```

## UI Components

### Confidence Indicator
```typescript
// components/ConfidenceIndicator.tsx
interface ConfidenceIndicatorProps {
  score: number;
  threshold: number;
}

const ConfidenceIndicator: React.FC<ConfidenceIndicatorProps> = ({
  score,
  threshold,
}) => {
  const color = score >= threshold ? 'text-green-500' : 'text-yellow-500';
  return (
    <div className={`flex items-center ${color}`}>
      <span className="font-bold">{(score * 100).toFixed(1)}%</span>
      {score < threshold && (
        <WarningIcon className="ml-2" title="Below threshold" />
      )}
    </div>
  );
};
```

### Zone Selection
```typescript
// components/ZoneSelector.tsx
interface ZoneSelectorProps {
  page: PDFPageProxy;
  onSelection: (bounds: BoundingBox) => void;
}

const ZoneSelector: React.FC<ZoneSelectorProps> = ({
  page,
  onSelection,
}) => {
  // Canvas-based selection implementation
};
```

## Error Handling

### Error Boundary
```typescript
// components/ErrorBoundary.tsx
class ProcessingErrorBoundary extends React.Component<
  PropsWithChildren<unknown>,
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return <ErrorFallback onRetry={() => this.setState({ hasError: false })} />;
    }
    return this.props.children;
  }
}
```

## Performance Optimizations

### Virtual Scrolling
```typescript
// components/VirtualContent.tsx
interface VirtualContentProps {
  items: Zone[];
  height: number;
  itemHeight: number;
}

const VirtualContent: React.FC<VirtualContentProps> = ({
  items,
  height,
  itemHeight,
}) => {
  // Virtual scrolling implementation
};
```

### Lazy Loading
```typescript
// App.tsx
const DualPaneViewer = lazy(() => import('./components/DualPaneViewer'));
const ExportUI = lazy(() => import('./components/ExportUI'));

// Usage with Suspense
<Suspense fallback={<LoadingSpinner />}>
  <DualPaneViewer />
</Suspense>
``` 