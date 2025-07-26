# Epic 2: UI Interaction System - Granular Testing Guide

## Overview
This document provides exhaustive, function-level testing for every component, hook, utility, and interaction in Epic 2.

## Story 2.1: Dual-Pane Viewer - Complete Testing

### 1. DualPaneViewer Component (`app/components/viewer/DualPaneViewer.tsx`)

#### 1.1 Component Props Testing
```typescript
// Test all prop combinations
describe('DualPaneViewer Props', () => {
  test('should render with minimal required props', () => {
    render(
      <DualPaneViewer
        documentId="test-123"
        zones={[]}
        extractedContent={[]}
      />
    );
    expect(screen.getByRole('region', { name: /dual-pane-viewer/i })).toBeInTheDocument();
  });

  test('should handle onZoneSelect callback', async () => {
    const onZoneSelect = jest.fn();
    render(
      <DualPaneViewer
        documentId="test-123"
        zones={mockZones}
        extractedContent={mockContent}
        onZoneSelect={onZoneSelect}
      />
    );
    
    await userEvent.click(screen.getByTestId('zone-1'));
    expect(onZoneSelect).toHaveBeenCalledWith('zone-1');
  });

  test('should handle onContentEdit callback', async () => {
    const onContentEdit = jest.fn();
    render(
      <DualPaneViewer
        documentId="test-123"
        zones={mockZones}
        extractedContent={mockContent}
        onContentEdit={onContentEdit}
      />
    );
    
    // Trigger content edit
    await userEvent.type(screen.getByTestId('content-editor-zone-1'), 'New content');
    expect(onContentEdit).toHaveBeenCalledWith('zone-1', 'New content');
  });
});
```

#### 1.2 ViewerState Management Testing
```typescript
// Test all state transitions
describe('ViewerState Management', () => {
  test('should initialize with correct default state', () => {
    const { container } = render(<DualPaneViewer {...defaultProps} />);
    
    // Check initial state through DOM
    expect(container.querySelector('.left-pane')).toHaveStyle({ width: '50%' });
    expect(container.querySelector('.right-pane')).toHaveStyle({ width: '50%' });
    expect(container.querySelector('.zone-highlighter')).toBeVisible();
  });

  test('should update selectedZone state', async () => {
    const { container } = render(<DualPaneViewer {...defaultProps} />);
    
    const zone = container.querySelector('[data-zone-id="zone-1"]');
    await userEvent.click(zone);
    
    expect(zone).toHaveClass('selected');
    expect(container.querySelector('.selected-zone-content')).toHaveTextContent('zone-1');
  });

  test('should toggle highlightVisible state', async () => {
    const { container } = render(<DualPaneViewer {...defaultProps} />);
    
    const toggleButton = screen.getByRole('button', { name: /zones/i });
    await userEvent.click(toggleButton);
    
    expect(container.querySelector('.zone-highlighter')).not.toBeVisible();
    
    await userEvent.click(toggleButton);
    expect(container.querySelector('.zone-highlighter')).toBeVisible();
  });

  test('should update paneRatio state on drag', async () => {
    const { container } = render(<DualPaneViewer {...defaultProps} />);
    
    const divider = container.querySelector('.pane-divider');
    const leftPane = container.querySelector('.left-pane');
    
    // Simulate drag
    fireEvent.mouseDown(divider, { clientX: 400 });
    fireEvent.mouseMove(document, { clientX: 600 });
    fireEvent.mouseUp(document);
    
    expect(leftPane).not.toHaveStyle({ width: '50%' });
  });

  test('should update zoomLevel state', async () => {
    const { container } = render(<DualPaneViewer {...defaultProps} />);
    
    const zoomInButton = screen.getByRole('button', { name: /zoom in/i });
    await userEvent.click(zoomInButton);
    
    // Check zoom applied to PDF viewer
    expect(container.querySelector('.pdf-viewer')).toHaveStyle({ transform: 'scale(1.1)' });
  });

  test('should handle fullscreenPane state', async () => {
    const { container } = render(<DualPaneViewer {...defaultProps} />);
    
    const fullscreenPdfButton = screen.getByRole('button', { name: /pdf.*maximize/i });
    await userEvent.click(fullscreenPdfButton);
    
    expect(container.querySelector('.left-pane')).toHaveStyle({ width: '100%' });
    expect(container.querySelector('.right-pane')).not.toBeVisible();
    expect(container.querySelector('.pane-divider')).not.toBeVisible();
  });

  test('should detect and update isMobileView', () => {
    // Mock mobile viewport
    global.innerWidth = 500;
    global.dispatchEvent(new Event('resize'));
    
    const { container } = render(<DualPaneViewer {...defaultProps} />);
    
    expect(screen.getByRole('button', { name: /pdf/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /content/i })).toBeInTheDocument();
    expect(container.querySelector('.pane-divider')).not.toBeVisible();
  });

  test('should handle activeMobilePane state', async () => {
    global.innerWidth = 500;
    const { container } = render(<DualPaneViewer {...defaultProps} />);
    
    const contentButton = screen.getByRole('button', { name: /content/i });
    await userEvent.click(contentButton);
    
    expect(container.querySelector('.left-pane')).not.toBeVisible();
    expect(container.querySelector('.right-pane')).toBeVisible();
  });
});
```

#### 1.3 Ref Management Testing
```typescript
// Test all refs
describe('Ref Management', () => {
  test('should create and attach all refs', () => {
    const { container } = render(<DualPaneViewer {...defaultProps} />);
    
    expect(container.querySelector('.left-pane')).toBeInTheDocument();
    expect(container.querySelector('.right-pane')).toBeInTheDocument();
    expect(container.querySelector('.viewer-container')).toBeInTheDocument();
    expect(container.querySelector('.pane-divider')).toBeInTheDocument();
  });

  test('should pass refs to child components', () => {
    const { container } = render(<DualPaneViewer {...defaultProps} />);
    
    // Verify PDFViewer receives ref
    const pdfViewer = container.querySelector('.pdf-viewer');
    expect(pdfViewer.parentElement).toHaveClass('left-pane');
    
    // Verify ExtractedContentViewer receives ref
    const contentViewer = container.querySelector('.extracted-content-viewer');
    expect(contentViewer.parentElement).toHaveClass('right-pane');
  });
});
```

#### 1.4 Dragging Functionality Testing
```typescript
// Test complete drag behavior
describe('Pane Divider Dragging', () => {
  test('should start drag on mousedown', () => {
    const { container } = render(<DualPaneViewer {...defaultProps} />);
    const divider = container.querySelector('.pane-divider');
    
    fireEvent.mouseDown(divider, { clientX: 400, preventDefault: jest.fn() });
    
    expect(document.body.style.cursor).toBe('col-resize');
    expect(document.body.style.userSelect).toBe('none');
  });

  test('should update pane sizes during drag', () => {
    const { container } = render(<DualPaneViewer {...defaultProps} />);
    const divider = container.querySelector('.pane-divider');
    
    // Mock container width
    Object.defineProperty(container.querySelector('.viewer-container'), 'offsetWidth', {
      value: 1000,
      configurable: true
    });
    
    fireEvent.mouseDown(divider, { clientX: 500 });
    fireEvent.mouseMove(document, { clientX: 600 });
    
    const leftPane = container.querySelector('.left-pane');
    expect(leftPane).toHaveStyle({ width: '60%' });
  });

  test('should enforce minimum pane widths', () => {
    const { container } = render(<DualPaneViewer {...defaultProps} />);
    const divider = container.querySelector('.pane-divider');
    
    fireEvent.mouseDown(divider, { clientX: 500 });
    fireEvent.mouseMove(document, { clientX: 100 }); // Try to make left pane too small
    
    const leftPane = container.querySelector('.left-pane');
    const computedWidth = parseInt(leftPane.style.width);
    expect(computedWidth).toBeGreaterThanOrEqual(20); // 20% minimum
  });

  test('should cleanup on mouseup', () => {
    const { container } = render(<DualPaneViewer {...defaultProps} />);
    const divider = container.querySelector('.pane-divider');
    
    fireEvent.mouseDown(divider, { clientX: 400 });
    fireEvent.mouseUp(document);
    
    expect(document.body.style.cursor).toBe('');
    expect(document.body.style.userSelect).toBe('');
  });

  test('should not drag in mobile view', () => {
    global.innerWidth = 500;
    const { container } = render(<DualPaneViewer {...defaultProps} />);
    const divider = container.querySelector('.pane-divider');
    
    const preventDefault = jest.fn();
    fireEvent.mouseDown(divider, { clientX: 400, preventDefault });
    
    expect(preventDefault).not.toHaveBeenCalled();
  });
});
```

#### 1.5 Performance Hook Integration Testing
```typescript
// Test performance monitoring
describe('Performance Monitoring', () => {
  test('should record zone select metrics', async () => {
    const recordMetric = jest.fn();
    jest.mock('../../hooks/useViewerPerformance', () => ({
      useViewerPerformance: () => ({ recordMetric, getMetrics: jest.fn() })
    }));
    
    const { container } = render(<DualPaneViewer {...defaultProps} />);
    
    await userEvent.click(container.querySelector('[data-zone-id="zone-1"]'));
    
    expect(recordMetric).toHaveBeenCalledWith('zone_select', { zoneId: 'zone-1' });
  });

  test('should record toggle highlighting metrics', async () => {
    const recordMetric = jest.fn();
    // ... mock setup
    
    render(<DualPaneViewer {...defaultProps} />);
    
    await userEvent.click(screen.getByRole('button', { name: /zones/i }));
    
    expect(recordMetric).toHaveBeenCalledWith('toggle_highlighting', { visible: false });
  });

  test('should record fullscreen metrics', async () => {
    const recordMetric = jest.fn();
    // ... mock setup
    
    render(<DualPaneViewer {...defaultProps} />);
    
    await userEvent.click(screen.getByRole('button', { name: /pdf.*maximize/i }));
    
    expect(recordMetric).toHaveBeenCalledWith('toggle_fullscreen', { 
      pane: 'left', 
      fullscreen: true 
    });
  });

  test('should display performance metrics in dev mode', () => {
    process.env.NODE_ENV = 'development';
    const getMetrics = jest.fn().mockReturnValue({
      fps: 60,
      syncLag: 5,
      memoryUsage: 125
    });
    // ... mock setup
    
    const { container } = render(<DualPaneViewer {...defaultProps} />);
    
    expect(container.querySelector('.performance-metrics')).toBeInTheDocument();
    expect(container.querySelector('.performance-metrics')).toHaveTextContent('FPS: 60');
    expect(container.querySelector('.performance-metrics')).toHaveTextContent('Sync Lag: 5ms');
    expect(container.querySelector('.performance-metrics')).toHaveTextContent('Memory: 125MB');
  });
});
```

#### 1.6 Synchronized Scrolling Testing
```typescript
// Test scroll synchronization
describe('Synchronized Scrolling', () => {
  test('should register panes on mount', () => {
    const registerPane = jest.fn();
    const unregisterPane = jest.fn();
    jest.mock('../../hooks/useSynchronizedScroll', () => ({
      useSynchronizedScroll: () => ({ 
        registerPane, 
        unregisterPane, 
        syncScroll: jest.fn() 
      })
    }));
    
    render(<DualPaneViewer {...defaultProps} />);
    
    expect(registerPane).toHaveBeenCalledWith('left', expect.any(Object));
    expect(registerPane).toHaveBeenCalledWith('right', expect.any(Object));
  });

  test('should unregister panes on unmount', () => {
    const unregisterPane = jest.fn();
    // ... mock setup
    
    const { unmount } = render(<DualPaneViewer {...defaultProps} />);
    
    unmount();
    
    expect(unregisterPane).toHaveBeenCalledWith('left');
    expect(unregisterPane).toHaveBeenCalledWith('right');
  });

  test('should sync scroll between panes', async () => {
    const syncScroll = jest.fn();
    // ... mock setup
    
    const { container } = render(<DualPaneViewer {...defaultProps} />);
    
    const leftPane = container.querySelector('.left-pane');
    fireEvent.scroll(leftPane, { target: { scrollTop: 100 } });
    
    expect(syncScroll).toHaveBeenCalled();
  });
});
```

#### 1.7 Mobile Responsiveness Testing
```typescript
// Test mobile behavior comprehensively
describe('Mobile Responsiveness', () => {
  beforeEach(() => {
    global.innerWidth = 375;
    global.innerHeight = 667;
  });

  test('should detect mobile on mount', () => {
    const { container } = render(<DualPaneViewer {...defaultProps} />);
    
    expect(screen.getByRole('button', { name: /pdf/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /content/i })).toBeInTheDocument();
    expect(container.querySelector('.pane-divider')).not.toBeVisible();
  });

  test('should switch between mobile panes', async () => {
    const { container } = render(<DualPaneViewer {...defaultProps} />);
    
    // Initially shows left pane
    expect(container.querySelector('.left-pane')).toBeVisible();
    expect(container.querySelector('.right-pane')).not.toBeVisible();
    
    // Switch to right pane
    await userEvent.click(screen.getByRole('button', { name: /content/i }));
    
    expect(container.querySelector('.left-pane')).not.toBeVisible();
    expect(container.querySelector('.right-pane')).toBeVisible();
  });

  test('should maintain selected zone across pane switches', async () => {
    const { container } = render(<DualPaneViewer {...defaultProps} />);
    
    // Select zone in left pane
    await userEvent.click(container.querySelector('[data-zone-id="zone-1"]'));
    
    // Switch to right pane
    await userEvent.click(screen.getByRole('button', { name: /content/i }));
    
    // Verify zone still selected
    expect(container.querySelector('.selected-zone-content')).toHaveTextContent('zone-1');
  });

  test('should handle orientation change', () => {
    const { container } = render(<DualPaneViewer {...defaultProps} />);
    
    // Change to landscape
    global.innerWidth = 667;
    global.innerHeight = 375;
    global.dispatchEvent(new Event('orientationchange'));
    
    // Should still be in mobile mode
    expect(screen.getByRole('button', { name: /pdf/i })).toBeInTheDocument();
  });

  test('should transition from mobile to desktop', () => {
    const { container } = render(<DualPaneViewer {...defaultProps} />);
    
    // Expand to desktop size
    global.innerWidth = 1024;
    global.dispatchEvent(new Event('resize'));
    
    // Should show both panes
    expect(container.querySelector('.left-pane')).toBeVisible();
    expect(container.querySelector('.right-pane')).toBeVisible();
    expect(container.querySelector('.pane-divider')).toBeVisible();
  });
});
```

### 2. PDFViewer Component (`app/components/viewer/PDFViewer.tsx`)

#### 2.1 PDF Loading Testing
```typescript
// Test PDF loading states
describe('PDF Loading', () => {
  test('should show loading state initially', () => {
    render(<PDFViewer pdfUrl="/test.pdf" zones={[]} />);
    
    expect(screen.getByText(/loading pdf/i)).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  test('should load PDF successfully', async () => {
    const { container } = render(<PDFViewer pdfUrl="/test.pdf" zones={[]} />);
    
    // Wait for PDF to load
    await waitFor(() => {
      expect(container.querySelector('canvas.pdf-page')).toBeInTheDocument();
    });
    
    expect(screen.queryByText(/loading pdf/i)).not.toBeInTheDocument();
  });

  test('should handle PDF load error', async () => {
    // Mock failed PDF load
    jest.mock('react-pdf', () => ({
      Document: ({ onLoadError, children }) => {
        React.useEffect(() => {
          onLoadError(new Error('Failed to load PDF'));
        }, []);
        return children;
      }
    }));
    
    render(<PDFViewer pdfUrl="/invalid.pdf" zones={[]} />);
    
    await waitFor(() => {
      expect(screen.getByText(/failed to load pdf/i)).toBeInTheDocument();
    });
  });

  test('should retry on error', async () => {
    render(<PDFViewer pdfUrl="/test.pdf" zones={[]} />);
    
    // Simulate error
    // ... trigger error
    
    const retryButton = await screen.findByRole('button', { name: /retry/i });
    await userEvent.click(retryButton);
    
    expect(screen.getByText(/loading pdf/i)).toBeInTheDocument();
  });
});
```

#### 2.2 Page Navigation Testing
```typescript
// Test page navigation
describe('Page Navigation', () => {
  test('should display page controls', async () => {
    render(<PDFViewer pdfUrl="/test.pdf" zones={[]} />);
    
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /previous page/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /next page/i })).toBeInTheDocument();
      expect(screen.getByText(/page 1 of/i)).toBeInTheDocument();
    });
  });

  test('should navigate to next page', async () => {
    render(<PDFViewer pdfUrl="/test.pdf" zones={[]} />);
    
    await waitFor(() => screen.getByRole('button', { name: /next page/i }));
    
    await userEvent.click(screen.getByRole('button', { name: /next page/i }));
    
    expect(screen.getByText(/page 2 of/i)).toBeInTheDocument();
  });

  test('should navigate to previous page', async () => {
    render(<PDFViewer pdfUrl="/test.pdf" zones={[]} />);
    
    // Go to page 2 first
    await waitFor(() => screen.getByRole('button', { name: /next page/i }));
    await userEvent.click(screen.getByRole('button', { name: /next page/i }));
    
    // Go back
    await userEvent.click(screen.getByRole('button', { name: /previous page/i }));
    
    expect(screen.getByText(/page 1 of/i)).toBeInTheDocument();
  });

  test('should disable previous on first page', async () => {
    render(<PDFViewer pdfUrl="/test.pdf" zones={[]} />);
    
    await waitFor(() => {
      const prevButton = screen.getByRole('button', { name: /previous page/i });
      expect(prevButton).toBeDisabled();
    });
  });

  test('should disable next on last page', async () => {
    // Mock PDF with 2 pages
    render(<PDFViewer pdfUrl="/test.pdf" zones={[]} />);
    
    // Go to last page
    await waitFor(() => screen.getByRole('button', { name: /next page/i }));
    await userEvent.click(screen.getByRole('button', { name: /next page/i }));
    
    expect(screen.getByRole('button', { name: /next page/i })).toBeDisabled();
  });

  test('should jump to specific page', async () => {
    render(<PDFViewer pdfUrl="/test.pdf" zones={[]} />);
    
    await waitFor(() => screen.getByRole('spinbutton', { name: /page number/i }));
    
    const pageInput = screen.getByRole('spinbutton', { name: /page number/i });
    await userEvent.clear(pageInput);
    await userEvent.type(pageInput, '3');
    await userEvent.keyboard('{Enter}');
    
    expect(screen.getByText(/page 3 of/i)).toBeInTheDocument();
  });
});
```

#### 2.3 Zoom Testing
```typescript
// Test zoom functionality
describe('Zoom Controls', () => {
  test('should display zoom controls', async () => {
    render(<PDFViewer pdfUrl="/test.pdf" zones={[]} />);
    
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /zoom in/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /zoom out/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /fit to width/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /fit to page/i })).toBeInTheDocument();
    });
  });

  test('should zoom in', async () => {
    const { container } = render(<PDFViewer pdfUrl="/test.pdf" zones={[]} />);
    
    await waitFor(() => screen.getByRole('button', { name: /zoom in/i }));
    
    const initialScale = container.querySelector('.pdf-page-container').style.transform;
    
    await userEvent.click(screen.getByRole('button', { name: /zoom in/i }));
    
    const newScale = container.querySelector('.pdf-page-container').style.transform;
    expect(newScale).not.toBe(initialScale);
  });

  test('should zoom out', async () => {
    const { container } = render(<PDFViewer pdfUrl="/test.pdf" zones={[]} />);
    
    await waitFor(() => screen.getByRole('button', { name: /zoom out/i }));
    
    // Zoom in first
    await userEvent.click(screen.getByRole('button', { name: /zoom in/i }));
    
    const zoomedScale = container.querySelector('.pdf-page-container').style.transform;
    
    await userEvent.click(screen.getByRole('button', { name: /zoom out/i }));
    
    const newScale = container.querySelector('.pdf-page-container').style.transform;
    expect(newScale).not.toBe(zoomedScale);
  });

  test('should fit to width', async () => {
    const { container } = render(<PDFViewer pdfUrl="/test.pdf" zones={[]} />);
    
    await waitFor(() => screen.getByRole('button', { name: /fit to width/i }));
    
    await userEvent.click(screen.getByRole('button', { name: /fit to width/i }));
    
    const pageContainer = container.querySelector('.pdf-page-container');
    const containerWidth = container.querySelector('.pdf-viewer-container').clientWidth;
    const pageWidth = pageContainer.clientWidth;
    
    expect(Math.abs(pageWidth - containerWidth)).toBeLessThan(10);
  });

  test('should fit to page', async () => {
    const { container } = render(<PDFViewer pdfUrl="/test.pdf" zones={[]} />);
    
    await waitFor(() => screen.getByRole('button', { name: /fit to page/i }));
    
    await userEvent.click(screen.getByRole('button', { name: /fit to page/i }));
    
    const pageContainer = container.querySelector('.pdf-page-container');
    const viewerContainer = container.querySelector('.pdf-viewer-container');
    
    expect(pageContainer.clientHeight).toBeLessThanOrEqual(viewerContainer.clientHeight);
    expect(pageContainer.clientWidth).toBeLessThanOrEqual(viewerContainer.clientWidth);
  });

  test('should limit zoom range', async () => {
    render(<PDFViewer pdfUrl="/test.pdf" zones={[]} />);
    
    await waitFor(() => screen.getByRole('button', { name: /zoom in/i }));
    
    // Zoom in to max
    for (let i = 0; i < 10; i++) {
      await userEvent.click(screen.getByRole('button', { name: /zoom in/i }));
    }
    
    // Should be disabled at max zoom
    expect(screen.getByRole('button', { name: /zoom in/i })).toBeDisabled();
    
    // Zoom out to min
    for (let i = 0; i < 15; i++) {
      await userEvent.click(screen.getByRole('button', { name: /zoom out/i }));
    }
    
    // Should be disabled at min zoom
    expect(screen.getByRole('button', { name: /zoom out/i })).toBeDisabled();
  });
});
```

#### 2.4 Zone Rendering Testing
```typescript
// Test zone rendering on PDF
describe('Zone Rendering', () => {
  const mockZones = [
    {
      id: 'zone-1',
      page: 1,
      coordinates: { x: 100, y: 100, width: 200, height: 100 },
      type: 'text',
      confidence: 0.95
    },
    {
      id: 'zone-2',
      page: 2,
      coordinates: { x: 150, y: 200, width: 300, height: 150 },
      type: 'table',
      confidence: 0.85
    }
  ];

  test('should render zones on correct pages', async () => {
    const { container } = render(
      <PDFViewer pdfUrl="/test.pdf" zones={mockZones} />
    );
    
    await waitFor(() => {
      // Check page 1 zones
      const page1Zones = container.querySelectorAll('.pdf-page-1 .zone-overlay');
      expect(page1Zones).toHaveLength(1);
    });
  });

  test('should position zones correctly', async () => {
    const { container } = render(
      <PDFViewer pdfUrl="/test.pdf" zones={mockZones} />
    );
    
    await waitFor(() => {
      const zone1 = container.querySelector('[data-zone-id="zone-1"]');
      expect(zone1).toHaveStyle({
        left: '100px',
        top: '100px',
        width: '200px',
        height: '100px'
      });
    });
  });

  test('should apply confidence styling', async () => {
    const { container } = render(
      <PDFViewer pdfUrl="/test.pdf" zones={mockZones} />
    );
    
    await waitFor(() => {
      const highConfidenceZone = container.querySelector('[data-zone-id="zone-1"]');
      expect(highConfidenceZone).toHaveClass('confidence-high');
      
      const mediumConfidenceZone = container.querySelector('[data-zone-id="zone-2"]');
      expect(mediumConfidenceZone).toHaveClass('confidence-medium');
    });
  });

  test('should handle zone selection', async () => {
    const onZoneSelect = jest.fn();
    const { container } = render(
      <PDFViewer 
        pdfUrl="/test.pdf" 
        zones={mockZones} 
        onZoneSelect={onZoneSelect}
      />
    );
    
    await waitFor(() => container.querySelector('[data-zone-id="zone-1"]'));
    
    await userEvent.click(container.querySelector('[data-zone-id="zone-1"]'));
    
    expect(onZoneSelect).toHaveBeenCalledWith('zone-1');
  });

  test('should highlight selected zone', async () => {
    const { container } = render(
      <PDFViewer 
        pdfUrl="/test.pdf" 
        zones={mockZones} 
        selectedZone="zone-1"
      />
    );
    
    await waitFor(() => {
      const zone1 = container.querySelector('[data-zone-id="zone-1"]');
      expect(zone1).toHaveClass('selected');
    });
  });
});
```

#### 2.5 Zone Creation Testing
```typescript
// Test zone creation mode
describe('Zone Creation', () => {
  test('should enable zone creation mode', async () => {
    const onZoneCreate = jest.fn();
    const { container } = render(
      <PDFViewer 
        pdfUrl="/test.pdf" 
        zones={[]} 
        onZoneCreate={onZoneCreate}
      />
    );
    
    await waitFor(() => screen.getByRole('button', { name: /create zone/i }));
    
    await userEvent.click(screen.getByRole('button', { name: /create zone/i }));
    
    expect(container.querySelector('.zone-creation-overlay')).toBeInTheDocument();
  });

  test('should draw zone with mouse', async () => {
    const onZoneCreate = jest.fn();
    const { container } = render(
      <PDFViewer 
        pdfUrl="/test.pdf" 
        zones={[]} 
        onZoneCreate={onZoneCreate}
      />
    );
    
    await waitFor(() => screen.getByRole('button', { name: /create zone/i }));
    await userEvent.click(screen.getByRole('button', { name: /create zone/i }));
    
    const overlay = container.querySelector('.zone-creation-overlay');
    
    // Simulate drawing
    fireEvent.mouseDown(overlay, { clientX: 100, clientY: 100 });
    fireEvent.mouseMove(overlay, { clientX: 300, clientY: 200 });
    fireEvent.mouseUp(overlay, { clientX: 300, clientY: 200 });
    
    expect(onZoneCreate).toHaveBeenCalledWith(expect.objectContaining({
      page: 1,
      coordinates: expect.objectContaining({
        x: expect.any(Number),
        y: expect.any(Number),
        width: expect.any(Number),
        height: expect.any(Number)
      })
    }));
  });

  test('should show preview while drawing', async () => {
    const { container } = render(
      <PDFViewer pdfUrl="/test.pdf" zones={[]} onZoneCreate={jest.fn()} />
    );
    
    await waitFor(() => screen.getByRole('button', { name: /create zone/i }));
    await userEvent.click(screen.getByRole('button', { name: /create zone/i }));
    
    const overlay = container.querySelector('.zone-creation-overlay');
    
    fireEvent.mouseDown(overlay, { clientX: 100, clientY: 100 });
    fireEvent.mouseMove(overlay, { clientX: 300, clientY: 200 });
    
    expect(container.querySelector('.zone-preview')).toBeInTheDocument();
    expect(container.querySelector('.zone-preview')).toHaveStyle({
      width: '200px',
      height: '100px'
    });
  });

  test('should cancel zone creation on escape', async () => {
    const { container } = render(
      <PDFViewer pdfUrl="/test.pdf" zones={[]} onZoneCreate={jest.fn()} />
    );
    
    await waitFor(() => screen.getByRole('button', { name: /create zone/i }));
    await userEvent.click(screen.getByRole('button', { name: /create zone/i }));
    
    await userEvent.keyboard('{Escape}');
    
    expect(container.querySelector('.zone-creation-overlay')).not.toBeInTheDocument();
  });
});
```

### 3. ExtractedContentViewer Component (`app/components/viewer/ExtractedContentViewer.tsx`)

#### 3.1 Content Rendering Testing
```typescript
// Test content rendering
describe('Content Rendering', () => {
  const mockContent = [
    {
      zoneId: 'zone-1',
      content: 'This is extracted text content',
      formatting: {
        fontSize: 14,
        fontFamily: 'Arial',
        bold: false,
        italic: false,
        alignment: 'left'
      },
      confidence: 0.95
    },
    {
      zoneId: 'zone-2',
      content: JSON.stringify([
        { col1: 'A', col2: 'B' },
        { col1: 'C', col2: 'D' }
      ]),
      formatting: { fontSize: 12 },
      confidence: 0.85
    }
  ];

  test('should render all content items', () => {
    render(
      <ExtractedContentViewer 
        content={mockContent} 
        zones={[]} 
      />
    );
    
    expect(screen.getByText('This is extracted text content')).toBeInTheDocument();
    expect(screen.getByText(/col1.*col2/i)).toBeInTheDocument();
  });

  test('should apply formatting styles', () => {
    const { container } = render(
      <ExtractedContentViewer 
        content={mockContent} 
        zones={[]} 
      />
    );
    
    const contentItem = container.querySelector('[data-zone-id="zone-1"] .content-text');
    expect(contentItem).toHaveStyle({
      fontSize: '14px',
      fontFamily: 'Arial',
      textAlign: 'left'
    });
  });

  test('should show confidence indicators', () => {
    render(
      <ExtractedContentViewer 
        content={mockContent} 
        zones={[]} 
      />
    );
    
    expect(screen.getByText('95%')).toBeInTheDocument();
    expect(screen.getByText('85%')).toBeInTheDocument();
  });

  test('should render table content as table', () => {
    render(
      <ExtractedContentViewer 
        content={mockContent} 
        zones={[]} 
      />
    );
    
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getAllByRole('row')).toHaveLength(3); // header + 2 data rows
  });
});
```

#### 3.2 Zone Selection Integration Testing
```typescript
// Test zone selection
describe('Zone Selection Integration', () => {
  test('should highlight selected zone content', () => {
    const { container } = render(
      <ExtractedContentViewer 
        content={mockContent} 
        zones={mockZones}
        selectedZone="zone-1"
      />
    );
    
    const selectedContent = container.querySelector('[data-zone-id="zone-1"]');
    expect(selectedContent).toHaveClass('selected');
  });

  test('should scroll to selected zone', () => {
    const scrollIntoViewMock = jest.fn();
    Element.prototype.scrollIntoView = scrollIntoViewMock;
    
    const { rerender } = render(
      <ExtractedContentViewer 
        content={mockContent} 
        zones={mockZones}
      />
    );
    
    rerender(
      <ExtractedContentViewer 
        content={mockContent} 
        zones={mockZones}
        selectedZone="zone-2"
      />
    );
    
    expect(scrollIntoViewMock).toHaveBeenCalled();
  });

  test('should handle zone selection click', async () => {
    const onZoneSelect = jest.fn();
    const { container } = render(
      <ExtractedContentViewer 
        content={mockContent} 
        zones={mockZones}
        onZoneSelect={onZoneSelect}
      />
    );
    
    await userEvent.click(container.querySelector('[data-zone-id="zone-2"]'));
    
    expect(onZoneSelect).toHaveBeenCalledWith('zone-2');
  });
});
```

#### 3.3 Content Editing Testing
```typescript
// Test content editing
describe('Content Editing', () => {
  test('should enable edit mode on double click', async () => {
    const { container } = render(
      <ExtractedContentViewer 
        content={mockContent} 
        zones={mockZones}
        onContentEdit={jest.fn()}
      />
    );
    
    const contentItem = container.querySelector('[data-zone-id="zone-1"] .content-text');
    await userEvent.dblClick(contentItem);
    
    expect(container.querySelector('textarea[data-zone-id="zone-1"]')).toBeInTheDocument();
  });

  test('should save edited content', async () => {
    const onContentEdit = jest.fn();
    const { container } = render(
      <ExtractedContentViewer 
        content={mockContent} 
        zones={mockZones}
        onContentEdit={onContentEdit}
      />
    );
    
    const contentItem = container.querySelector('[data-zone-id="zone-1"] .content-text');
    await userEvent.dblClick(contentItem);
    
    const textarea = container.querySelector('textarea[data-zone-id="zone-1"]');
    await userEvent.clear(textarea);
    await userEvent.type(textarea, 'New content');
    await userEvent.keyboard('{Enter}');
    
    expect(onContentEdit).toHaveBeenCalledWith('zone-1', 'New content');
  });

  test('should cancel edit on escape', async () => {
    const { container } = render(
      <ExtractedContentViewer 
        content={mockContent} 
        zones={mockZones}
        onContentEdit={jest.fn()}
      />
    );
    
    const contentItem = container.querySelector('[data-zone-id="zone-1"] .content-text');
    await userEvent.dblClick(contentItem);
    
    await userEvent.keyboard('{Escape}');
    
    expect(container.querySelector('textarea')).not.toBeInTheDocument();
    expect(screen.getByText('This is extracted text content')).toBeInTheDocument();
  });

  test('should show edit indicator', async () => {
    const { container } = render(
      <ExtractedContentViewer 
        content={mockContent} 
        zones={mockZones}
        onContentEdit={jest.fn()}
      />
    );
    
    const contentItem = container.querySelector('[data-zone-id="zone-1"]');
    await userEvent.hover(contentItem);
    
    expect(screen.getByTitle('Double-click to edit')).toBeInTheDocument();
  });
});
```

#### 3.4 Visibility Toggle Testing
```typescript
// Test visibility controls
describe('Visibility Controls', () => {
  test('should hide content when highlightVisible is false', () => {
    const { container } = render(
      <ExtractedContentViewer 
        content={mockContent} 
        zones={mockZones}
        highlightVisible={false}
      />
    );
    
    expect(container.querySelector('.content-dimmed')).toBeInTheDocument();
  });

  test('should show visibility indicator', () => {
    render(
      <ExtractedContentViewer 
        content={mockContent} 
        zones={mockZones}
        highlightVisible={false}
      />
    );
    
    expect(screen.getByText(/content hidden/i)).toBeInTheDocument();
  });
});
```

### 4. ZoneHighlighter Component (`app/components/viewer/ZoneHighlighter.tsx`)

#### 4.1 Zone Highlighting Testing
```typescript
// Test zone highlighting
describe('Zone Highlighting', () => {
  test('should render highlights for all zones', () => {
    const { container } = render(
      <ZoneHighlighter 
        zones={mockZones} 
        visible={true}
      />
    );
    
    expect(container.querySelectorAll('.zone-highlight')).toHaveLength(mockZones.length);
  });

  test('should position highlights correctly', () => {
    const { container } = render(
      <ZoneHighlighter 
        zones={mockZones} 
        visible={true}
      />
    );
    
    const highlight = container.querySelector('[data-zone-id="zone-1"]');
    expect(highlight).toHaveStyle({
      left: '100px',
      top: '100px',
      width: '200px',
      height: '100px'
    });
  });

  test('should apply type-based styling', () => {
    const { container } = render(
      <ZoneHighlighter 
        zones={[
          { ...mockZones[0], type: 'text' },
          { ...mockZones[1], type: 'table' }
        ]} 
        visible={true}
      />
    );
    
    expect(container.querySelector('.zone-type-text')).toBeInTheDocument();
    expect(container.querySelector('.zone-type-table')).toBeInTheDocument();
  });

  test('should highlight selected zone', () => {
    const { container } = render(
      <ZoneHighlighter 
        zones={mockZones} 
        selectedZone="zone-1"
        visible={true}
      />
    );
    
    expect(container.querySelector('[data-zone-id="zone-1"]')).toHaveClass('selected');
  });

  test('should handle zone clicks', async () => {
    const onZoneClick = jest.fn();
    const { container } = render(
      <ZoneHighlighter 
        zones={mockZones} 
        visible={true}
        onZoneClick={onZoneClick}
      />
    );
    
    await userEvent.click(container.querySelector('[data-zone-id="zone-1"]'));
    
    expect(onZoneClick).toHaveBeenCalledWith('zone-1');
  });

  test('should hide when visible is false', () => {
    const { container } = render(
      <ZoneHighlighter 
        zones={mockZones} 
        visible={false}
      />
    );
    
    expect(container.querySelector('.zone-highlighter')).not.toBeVisible();
  });
});
```

### 5. Hooks Testing

#### 5.1 useSynchronizedScroll Hook Testing
```typescript
// Test synchronized scroll hook
describe('useSynchronizedScroll Hook', () => {
  test('should register and unregister panes', () => {
    const { result } = renderHook(() => 
      useSynchronizedScroll({ zones: mockZones, extractedContent: mockContent })
    );
    
    const mockElement = document.createElement('div');
    
    act(() => {
      result.current.registerPane('left', mockElement);
    });
    
    expect(result.current.panes.left).toBe(mockElement);
    
    act(() => {
      result.current.unregisterPane('left');
    });
    
    expect(result.current.panes.left).toBeUndefined();
  });

  test('should synchronize scroll between panes', () => {
    const { result } = renderHook(() => 
      useSynchronizedScroll({ zones: mockZones, extractedContent: mockContent })
    );
    
    const leftPane = document.createElement('div');
    const rightPane = document.createElement('div');
    
    Object.defineProperty(leftPane, 'scrollHeight', { value: 1000 });
    Object.defineProperty(rightPane, 'scrollHeight', { value: 2000 });
    
    act(() => {
      result.current.registerPane('left', leftPane);
      result.current.registerPane('right', rightPane);
    });
    
    act(() => {
      leftPane.scrollTop = 100;
      result.current.syncScroll('left');
    });
    
    expect(rightPane.scrollTop).toBe(200); // Proportional scroll
  });

  test('should handle zone-based scroll sync', () => {
    const { result } = renderHook(() => 
      useSynchronizedScroll({ 
        zones: mockZones, 
        extractedContent: mockContent,
        enableZoneSync: true 
      })
    );
    
    const leftPane = document.createElement('div');
    const rightPane = document.createElement('div');
    
    // Mock zone positions
    jest.spyOn(leftPane, 'querySelector').mockImplementation((selector) => {
      if (selector === '[data-zone-id="zone-1"]') {
        return { offsetTop: 100 };
      }
    });
    
    jest.spyOn(rightPane, 'querySelector').mockImplementation((selector) => {
      if (selector === '[data-zone-id="zone-1"]') {
        return { offsetTop: 200 };
      }
    });
    
    act(() => {
      result.current.registerPane('left', leftPane);
      result.current.registerPane('right', rightPane);
      leftPane.scrollTop = 100;
      result.current.syncScroll('left');
    });
    
    expect(rightPane.scrollTop).toBe(200);
  });
});
```

#### 5.2 useViewerPerformance Hook Testing
```typescript
// Test performance monitoring hook
describe('useViewerPerformance Hook', () => {
  test('should record metrics', () => {
    const { result } = renderHook(() => useViewerPerformance());
    
    act(() => {
      result.current.recordMetric('zone_select', { zoneId: 'zone-1' });
    });
    
    const metrics = result.current.getMetrics();
    expect(metrics.events).toContainEqual(
      expect.objectContaining({
        type: 'zone_select',
        data: { zoneId: 'zone-1' }
      })
    );
  });

  test('should calculate FPS', async () => {
    const { result } = renderHook(() => useViewerPerformance());
    
    // Simulate frame updates
    act(() => {
      for (let i = 0; i < 60; i++) {
        result.current.recordFrame();
      }
    });
    
    await waitFor(() => {
      const metrics = result.current.getMetrics();
      expect(metrics.fps).toBeGreaterThan(0);
    });
  });

  test('should track memory usage', () => {
    // Mock performance.memory
    Object.defineProperty(performance, 'memory', {
      value: {
        usedJSHeapSize: 50 * 1024 * 1024,
        totalJSHeapSize: 100 * 1024 * 1024
      },
      configurable: true
    });
    
    const { result } = renderHook(() => useViewerPerformance());
    
    const metrics = result.current.getMetrics();
    expect(metrics.memoryUsage).toBe(50);
  });

  test('should measure sync lag', () => {
    const { result } = renderHook(() => useViewerPerformance());
    
    act(() => {
      result.current.startSyncMeasure();
      // Simulate some processing time
      jest.advanceTimersByTime(10);
      result.current.endSyncMeasure();
    });
    
    const metrics = result.current.getMetrics();
    expect(metrics.syncLag).toBeGreaterThanOrEqual(10);
  });
});
```

### Story 2.2: Zone Selection and Editing - Complete Testing

### 6. ZoneSelector Component (`app/components/zones/ZoneSelector.tsx`)

#### 6.1 Selection Mode Testing
```typescript
// Test selection modes
describe('Zone Selection Modes', () => {
  test('should support single selection mode', async () => {
    const onSelect = jest.fn();
    render(
      <ZoneSelector 
        zones={mockZones} 
        mode="single"
        onSelect={onSelect}
      />
    );
    
    await userEvent.click(screen.getByTestId('zone-1'));
    expect(onSelect).toHaveBeenCalledWith(['zone-1']);
    
    await userEvent.click(screen.getByTestId('zone-2'));
    expect(onSelect).toHaveBeenCalledWith(['zone-2']);
  });

  test('should support multi selection mode', async () => {
    const onSelect = jest.fn();
    render(
      <ZoneSelector 
        zones={mockZones} 
        mode="multi"
        onSelect={onSelect}
      />
    );
    
    await userEvent.click(screen.getByTestId('zone-1'));
    expect(onSelect).toHaveBeenCalledWith(['zone-1']);
    
    // Ctrl+click for multi-select
    await userEvent.click(screen.getByTestId('zone-2'), { ctrlKey: true });
    expect(onSelect).toHaveBeenCalledWith(['zone-1', 'zone-2']);
  });

  test('should support range selection with shift', async () => {
    const onSelect = jest.fn();
    render(
      <ZoneSelector 
        zones={mockZones} 
        mode="multi"
        onSelect={onSelect}
      />
    );
    
    await userEvent.click(screen.getByTestId('zone-1'));
    await userEvent.click(screen.getByTestId('zone-3'), { shiftKey: true });
    
    expect(onSelect).toHaveBeenCalledWith(['zone-1', 'zone-2', 'zone-3']);
  });
});
```

#### 6.2 Zone Creation Testing
```typescript
// Test zone creation
describe('Zone Creation', () => {
  test('should create zone by drawing', async () => {
    const onCreate = jest.fn();
    const { container } = render(
      <ZoneSelector 
        zones={[]} 
        enableCreation={true}
        onCreate={onCreate}
      />
    );
    
    const canvas = container.querySelector('.zone-creation-canvas');
    
    // Start drawing
    fireEvent.mouseDown(canvas, { clientX: 100, clientY: 100 });
    fireEvent.mouseMove(canvas, { clientX: 300, clientY: 200 });
    fireEvent.mouseUp(canvas);
    
    expect(onCreate).toHaveBeenCalledWith({
      coordinates: { x: 100, y: 100, width: 200, height: 100 },
      page: expect.any(Number)
    });
  });

  test('should show creation preview', async () => {
    const { container } = render(
      <ZoneSelector 
        zones={[]} 
        enableCreation={true}
        onCreate={jest.fn()}
      />
    );
    
    const canvas = container.querySelector('.zone-creation-canvas');
    
    fireEvent.mouseDown(canvas, { clientX: 100, clientY: 100 });
    fireEvent.mouseMove(canvas, { clientX: 300, clientY: 200 });
    
    const preview = container.querySelector('.zone-creation-preview');
    expect(preview).toBeInTheDocument();
    expect(preview).toHaveStyle({
      left: '100px',
      top: '100px',
      width: '200px',
      height: '100px'
    });
  });

  test('should enforce minimum zone size', async () => {
    const onCreate = jest.fn();
    const { container } = render(
      <ZoneSelector 
        zones={[]} 
        enableCreation={true}
        onCreate={onCreate}
        minZoneSize={{ width: 50, height: 50 }}
      />
    );
    
    const canvas = container.querySelector('.zone-creation-canvas');
    
    // Try to create tiny zone
    fireEvent.mouseDown(canvas, { clientX: 100, clientY: 100 });
    fireEvent.mouseMove(canvas, { clientX: 110, clientY: 110 });
    fireEvent.mouseUp(canvas);
    
    expect(onCreate).not.toHaveBeenCalled();
    expect(screen.getByText(/zone too small/i)).toBeInTheDocument();
  });
});
```

#### 6.3 Selection Feedback Testing
```typescript
// Test selection feedback
describe('Selection Feedback', () => {
  test('should show selection count', async () => {
    render(
      <ZoneSelector 
        zones={mockZones} 
        mode="multi"
        showSelectionCount={true}
      />
    );
    
    await userEvent.click(screen.getByTestId('zone-1'));
    expect(screen.getByText('1 zone selected')).toBeInTheDocument();
    
    await userEvent.click(screen.getByTestId('zone-2'), { ctrlKey: true });
    expect(screen.getByText('2 zones selected')).toBeInTheDocument();
  });

  test('should highlight selected zones', async () => {
    const { container } = render(
      <ZoneSelector zones={mockZones} mode="single" />
    );
    
    await userEvent.click(screen.getByTestId('zone-1'));
    
    expect(container.querySelector('[data-zone-id="zone-1"]')).toHaveClass('selected');
  });

  test('should show hover state', async () => {
    const { container } = render(
      <ZoneSelector zones={mockZones} />
    );
    
    await userEvent.hover(screen.getByTestId('zone-1'));
    
    expect(container.querySelector('[data-zone-id="zone-1"]')).toHaveClass('hover');
  });
});
```

### 7. ZoneEditor Component (`app/components/zones/ZoneEditor.tsx`)

#### 7.1 Zone Properties Editing Testing
```typescript
// Test zone property editing
describe('Zone Properties Editing', () => {
  const mockZone = {
    id: 'zone-1',
    type: 'text',
    coordinates: { x: 100, y: 100, width: 200, height: 100 },
    confidence: 0.95,
    page: 1
  };

  test('should display zone properties', () => {
    render(<ZoneEditor zone={mockZone} />);
    
    expect(screen.getByLabelText(/zone type/i)).toHaveValue('text');
    expect(screen.getByLabelText(/confidence/i)).toHaveValue('0.95');
    expect(screen.getByLabelText(/page/i)).toHaveValue('1');
  });

  test('should edit zone type', async () => {
    const onUpdate = jest.fn();
    render(<ZoneEditor zone={mockZone} onUpdate={onUpdate} />);
    
    await userEvent.selectOptions(screen.getByLabelText(/zone type/i), 'table');
    
    expect(onUpdate).toHaveBeenCalledWith({
      ...mockZone,
      type: 'table'
    });
  });

  test('should edit confidence threshold', async () => {
    const onUpdate = jest.fn();
    render(<ZoneEditor zone={mockZone} onUpdate={onUpdate} />);
    
    const confidenceInput = screen.getByLabelText(/confidence/i);
    await userEvent.clear(confidenceInput);
    await userEvent.type(confidenceInput, '0.75');
    
    expect(onUpdate).toHaveBeenCalledWith({
      ...mockZone,
      confidence: 0.75
    });
  });

  test('should validate confidence range', async () => {
    const onUpdate = jest.fn();
    render(<ZoneEditor zone={mockZone} onUpdate={onUpdate} />);
    
    const confidenceInput = screen.getByLabelText(/confidence/i);
    await userEvent.clear(confidenceInput);
    await userEvent.type(confidenceInput, '1.5');
    
    expect(screen.getByText(/must be between 0 and 1/i)).toBeInTheDocument();
    expect(onUpdate).not.toHaveBeenCalled();
  });
});
```

#### 7.2 Zone Coordinates Editing Testing
```typescript
// Test coordinate editing
describe('Zone Coordinates Editing', () => {
  test('should display coordinate fields', () => {
    render(<ZoneEditor zone={mockZone} />);
    
    expect(screen.getByLabelText(/x position/i)).toHaveValue('100');
    expect(screen.getByLabelText(/y position/i)).toHaveValue('100');
    expect(screen.getByLabelText(/width/i)).toHaveValue('200');
    expect(screen.getByLabelText(/height/i)).toHaveValue('100');
  });

  test('should edit coordinates', async () => {
    const onUpdate = jest.fn();
    render(<ZoneEditor zone={mockZone} onUpdate={onUpdate} />);
    
    const xInput = screen.getByLabelText(/x position/i);
    await userEvent.clear(xInput);
    await userEvent.type(xInput, '150');
    
    expect(onUpdate).toHaveBeenCalledWith({
      ...mockZone,
      coordinates: { ...mockZone.coordinates, x: 150 }
    });
  });

  test('should validate coordinate bounds', async () => {
    const onUpdate = jest.fn();
    render(
      <ZoneEditor 
        zone={mockZone} 
        onUpdate={onUpdate}
        pageBounds={{ width: 500, height: 700 }}
      />
    );
    
    const xInput = screen.getByLabelText(/x position/i);
    await userEvent.clear(xInput);
    await userEvent.type(xInput, '600');
    
    expect(screen.getByText(/exceeds page bounds/i)).toBeInTheDocument();
  });
});
```

#### 7.3 Zone Resizing Testing
```typescript
// Test visual resizing
describe('Zone Visual Resizing', () => {
  test('should show resize handles', () => {
    const { container } = render(
      <ZoneEditor zone={mockZone} enableVisualEdit={true} />
    );
    
    const handles = container.querySelectorAll('.resize-handle');
    expect(handles).toHaveLength(8); // 8 resize handles
  });

  test('should resize from corner handle', async () => {
    const onUpdate = jest.fn();
    const { container } = render(
      <ZoneEditor 
        zone={mockZone} 
        enableVisualEdit={true}
        onUpdate={onUpdate}
      />
    );
    
    const seHandle = container.querySelector('.resize-handle-se');
    
    fireEvent.mouseDown(seHandle, { clientX: 300, clientY: 200 });
    fireEvent.mouseMove(document, { clientX: 350, clientY: 250 });
    fireEvent.mouseUp(document);
    
    expect(onUpdate).toHaveBeenCalledWith({
      ...mockZone,
      coordinates: {
        x: 100,
        y: 100,
        width: 250,
        height: 150
      }
    });
  });

  test('should maintain aspect ratio when shift held', async () => {
    const onUpdate = jest.fn();
    const { container } = render(
      <ZoneEditor 
        zone={mockZone} 
        enableVisualEdit={true}
        onUpdate={onUpdate}
      />
    );
    
    const seHandle = container.querySelector('.resize-handle-se');
    
    fireEvent.mouseDown(seHandle, { clientX: 300, clientY: 200, shiftKey: true });
    fireEvent.mouseMove(document, { clientX: 400, clientY: 250, shiftKey: true });
    fireEvent.mouseUp(document);
    
    const call = onUpdate.mock.calls[0][0];
    const ratio = call.coordinates.width / call.coordinates.height;
    const originalRatio = mockZone.coordinates.width / mockZone.coordinates.height;
    
    expect(Math.abs(ratio - originalRatio)).toBeLessThan(0.01);
  });
});
```

#### 7.4 Zone Moving Testing
```typescript
// Test zone movement
describe('Zone Movement', () => {
  test('should move zone by dragging', async () => {
    const onUpdate = jest.fn();
    const { container } = render(
      <ZoneEditor 
        zone={mockZone} 
        enableVisualEdit={true}
        onUpdate={onUpdate}
      />
    );
    
    const zoneElement = container.querySelector('.zone-editor-overlay');
    
    fireEvent.mouseDown(zoneElement, { clientX: 200, clientY: 150 });
    fireEvent.mouseMove(document, { clientX: 250, clientY: 180 });
    fireEvent.mouseUp(document);
    
    expect(onUpdate).toHaveBeenCalledWith({
      ...mockZone,
      coordinates: {
        x: 150,
        y: 130,
        width: 200,
        height: 100
      }
    });
  });

  test('should snap to grid when enabled', async () => {
    const onUpdate = jest.fn();
    render(
      <ZoneEditor 
        zone={mockZone} 
        enableVisualEdit={true}
        snapToGrid={true}
        gridSize={10}
        onUpdate={onUpdate}
      />
    );
    
    // ... drag zone
    
    const call = onUpdate.mock.calls[0][0];
    expect(call.coordinates.x % 10).toBe(0);
    expect(call.coordinates.y % 10).toBe(0);
  });
});
```

### Story 2.3: Confidence Visualization - Complete Testing

### 8. ConfidenceIndicator Component (`app/components/viewer/ConfidenceIndicator.tsx`)

#### 8.1 Visual Representation Testing
```typescript
// Test confidence visualization
describe('Confidence Visual Representation', () => {
  test('should show percentage text', () => {
    render(<ConfidenceIndicator confidence={0.95} />);
    
    expect(screen.getByText('95%')).toBeInTheDocument();
  });

  test('should apply color based on confidence level', () => {
    const { container, rerender } = render(<ConfidenceIndicator confidence={0.95} />);
    
    // High confidence - green
    expect(container.firstChild).toHaveClass('confidence-high');
    expect(container.firstChild).toHaveStyle({ backgroundColor: /rgb\(34, 197, 94/ });
    
    // Medium confidence - yellow
    rerender(<ConfidenceIndicator confidence={0.75} />);
    expect(container.firstChild).toHaveClass('confidence-medium');
    expect(container.firstChild).toHaveStyle({ backgroundColor: /rgb\(250, 204, 21/ });
    
    // Low confidence - red
    rerender(<ConfidenceIndicator confidence={0.55} />);
    expect(container.firstChild).toHaveClass('confidence-low');
    expect(container.firstChild).toHaveStyle({ backgroundColor: /rgb\(239, 68, 68/ });
  });

  test('should show progress bar', () => {
    const { container } = render(
      <ConfidenceIndicator confidence={0.75} showBar={true} />
    );
    
    const progressBar = container.querySelector('.confidence-bar-fill');
    expect(progressBar).toHaveStyle({ width: '75%' });
  });

  test('should animate on value change', async () => {
    const { container, rerender } = render(
      <ConfidenceIndicator confidence={0.5} animate={true} />
    );
    
    rerender(<ConfidenceIndicator confidence={0.9} animate={true} />);
    
    // Check for animation class
    expect(container.firstChild).toHaveClass('confidence-animating');
  });
});
```

#### 8.2 Interactive Features Testing
```typescript
// Test interactive features
describe('Confidence Interactive Features', () => {
  test('should show tooltip on hover', async () => {
    render(<ConfidenceIndicator confidence={0.85} showTooltip={true} />);
    
    await userEvent.hover(screen.getByText('85%'));
    
    expect(screen.getByRole('tooltip')).toHaveTextContent('Confidence: 85%');
    expect(screen.getByRole('tooltip')).toHaveTextContent('High confidence');
  });

  test('should allow threshold adjustment', async () => {
    const onThresholdChange = jest.fn();
    render(
      <ConfidenceIndicator 
        confidence={0.85} 
        editable={true}
        onThresholdChange={onThresholdChange}
      />
    );
    
    await userEvent.click(screen.getByText('85%'));
    
    const slider = screen.getByRole('slider');
    fireEvent.change(slider, { target: { value: '0.7' } });
    
    expect(onThresholdChange).toHaveBeenCalledWith(0.7);
  });
});
```

### 9. ConfidenceOverlay Component (`app/components/viewer/ConfidenceOverlay.tsx`)

#### 9.1 Zone Confidence Overlay Testing
```typescript
// Test confidence overlay
describe('Confidence Overlay', () => {
  test('should overlay confidence on zones', () => {
    const { container } = render(
      <ConfidenceOverlay zones={mockZones} visible={true} />
    );
    
    mockZones.forEach(zone => {
      const overlay = container.querySelector(`[data-zone-id="${zone.id}"] .confidence-overlay`);
      expect(overlay).toBeInTheDocument();
    });
  });

  test('should use gradient for confidence visualization', () => {
    const { container } = render(
      <ConfidenceOverlay zones={mockZones} visible={true} mode="gradient" />
    );
    
    const overlay = container.querySelector('.confidence-overlay');
    expect(overlay).toHaveStyle({ 
      background: expect.stringContaining('linear-gradient') 
    });
  });

  test('should toggle visibility', () => {
    const { container, rerender } = render(
      <ConfidenceOverlay zones={mockZones} visible={true} />
    );
    
    expect(container.querySelector('.confidence-overlay-container')).toBeVisible();
    
    rerender(<ConfidenceOverlay zones={mockZones} visible={false} />);
    
    expect(container.querySelector('.confidence-overlay-container')).not.toBeVisible();
  });
});
```

### Story 2.4: Manual Override Controls - Complete Testing

### 10. ManualOverride Component (`app/components/zones/ManualOverride.tsx`)

#### 10.1 Override UI Testing
```typescript
// Test override interface
describe('Manual Override UI', () => {
  const mockZone = {
    id: 'zone-1',
    content: 'Original content',
    type: 'text',
    confidence: 0.75
  };

  test('should show override button on hover', async () => {
    const { container } = render(
      <ManualOverride zone={mockZone} />
    );
    
    await userEvent.hover(container.firstChild);
    
    expect(screen.getByRole('button', { name: /override/i })).toBeVisible();
  });

  test('should open override dialog', async () => {
    render(<ManualOverride zone={mockZone} />);
    
    await userEvent.click(screen.getByRole('button', { name: /override/i }));
    
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/manual content override/i)).toBeInTheDocument();
  });

  test('should show original content in dialog', async () => {
    render(<ManualOverride zone={mockZone} />);
    
    await userEvent.click(screen.getByRole('button', { name: /override/i }));
    
    expect(screen.getByLabelText(/original content/i)).toHaveValue('Original content');
  });
});
```

#### 10.2 Content Override Testing
```typescript
// Test override functionality
describe('Content Override Functionality', () => {
  test('should update content', async () => {
    const onOverride = jest.fn();
    render(
      <ManualOverride 
        zone={mockZone} 
        onOverride={onOverride}
      />
    );
    
    await userEvent.click(screen.getByRole('button', { name: /override/i }));
    
    const textarea = screen.getByLabelText(/corrected content/i);
    await userEvent.type(textarea, 'Corrected content');
    
    await userEvent.click(screen.getByRole('button', { name: /save/i }));
    
    expect(onOverride).toHaveBeenCalledWith({
      zoneId: 'zone-1',
      originalContent: 'Original content',
      correctedContent: 'Corrected content',
      confidence: 1.0,
      timestamp: expect.any(Date)
    });
  });

  test('should show override indicator', async () => {
    const { container } = render(
      <ManualOverride 
        zone={{ ...mockZone, isOverridden: true }}
      />
    );
    
    expect(container.querySelector('.override-indicator')).toBeInTheDocument();
    expect(screen.getByTitle('Content has been manually overridden')).toBeInTheDocument();
  });

  test('should allow reverting override', async () => {
    const onRevert = jest.fn();
    render(
      <ManualOverride 
        zone={{ ...mockZone, isOverridden: true }}
        onRevert={onRevert}
      />
    );
    
    await userEvent.click(screen.getByRole('button', { name: /revert/i }));
    
    expect(onRevert).toHaveBeenCalledWith('zone-1');
  });
});
```

#### 10.3 Override History Testing
```typescript
// Test override history
describe('Override History', () => {
  test('should track override history', async () => {
    const { container } = render(
      <ManualOverride 
        zone={mockZone}
        showHistory={true}
      />
    );
    
    await userEvent.click(screen.getByRole('button', { name: /history/i }));
    
    expect(screen.getByText(/override history/i)).toBeInTheDocument();
  });

  test('should display previous overrides', () => {
    const history = [
      {
        timestamp: new Date('2024-01-01'),
        originalContent: 'Original',
        correctedContent: 'First correction',
        user: 'user1'
      },
      {
        timestamp: new Date('2024-01-02'),
        originalContent: 'First correction',
        correctedContent: 'Second correction',
        user: 'user2'
      }
    ];
    
    render(
      <ManualOverride 
        zone={mockZone}
        history={history}
        showHistory={true}
      />
    );
    
    expect(screen.getByText('First correction')).toBeInTheDocument();
    expect(screen.getByText('Second correction')).toBeInTheDocument();
  });
});
```

### 11. OverrideManager Component (`app/components/zones/OverrideManager.tsx`)

#### 11.1 Bulk Override Testing
```typescript
// Test bulk override operations
describe('Bulk Override Operations', () => {
  test('should select multiple zones for override', async () => {
    render(
      <OverrideManager zones={mockZones} />
    );
    
    await userEvent.click(screen.getByRole('checkbox', { name: /select all/i }));
    
    expect(screen.getByText(`${mockZones.length} zones selected`)).toBeInTheDocument();
  });

  test('should apply bulk confidence adjustment', async () => {
    const onBulkUpdate = jest.fn();
    render(
      <OverrideManager 
        zones={mockZones}
        onBulkUpdate={onBulkUpdate}
      />
    );
    
    // Select zones
    await userEvent.click(screen.getByTestId('zone-1-checkbox'));
    await userEvent.click(screen.getByTestId('zone-2-checkbox'));
    
    // Adjust confidence
    const slider = screen.getByRole('slider', { name: /bulk confidence/i });
    fireEvent.change(slider, { target: { value: '0.9' } });
    
    await userEvent.click(screen.getByRole('button', { name: /apply/i }));
    
    expect(onBulkUpdate).toHaveBeenCalledWith(
      ['zone-1', 'zone-2'],
      { confidence: 0.9 }
    );
  });
});
```

## Performance and Integration Testing

### 12. Performance Testing
```typescript
// Test rendering performance
describe('UI Performance', () => {
  test('should render large number of zones efficiently', async () => {
    const manyZones = Array.from({ length: 1000 }, (_, i) => ({
      id: `zone-${i}`,
      page: Math.floor(i / 100) + 1,
      coordinates: { x: (i % 10) * 50, y: Math.floor(i / 10) * 50, width: 40, height: 40 },
      type: 'text',
      confidence: Math.random()
    }));
    
    const startTime = performance.now();
    
    render(
      <DualPaneViewer 
        documentId="perf-test"
        zones={manyZones}
        extractedContent={[]}
      />
    );
    
    const renderTime = performance.now() - startTime;
    
    expect(renderTime).toBeLessThan(1000); // Should render in under 1 second
    expect(screen.getAllByTestId(/zone-/)).toHaveLength(1000);
  });

  test('should handle rapid zone selection', async () => {
    const onZoneSelect = jest.fn();
    render(
      <DualPaneViewer 
        documentId="test"
        zones={mockZones}
        extractedContent={mockContent}
        onZoneSelect={onZoneSelect}
      />
    );
    
    // Rapidly select zones
    for (let i = 0; i < 10; i++) {
      await userEvent.click(screen.getByTestId(`zone-${i % mockZones.length}`));
    }
    
    // Should debounce/throttle appropriately
    expect(onZoneSelect).toHaveBeenCalledTimes(10);
  });
});
```

### 13. Accessibility Testing
```typescript
// Test accessibility
describe('Accessibility', () => {
  test('should have proper ARIA labels', () => {
    render(
      <DualPaneViewer 
        documentId="test"
        zones={mockZones}
        extractedContent={mockContent}
      />
    );
    
    expect(screen.getByRole('region', { name: /pdf viewer/i })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: /extracted content/i })).toBeInTheDocument();
    expect(screen.getByRole('separator', { name: /resize/i })).toBeInTheDocument();
  });

  test('should be keyboard navigable', async () => {
    render(
      <DualPaneViewer 
        documentId="test"
        zones={mockZones}
        extractedContent={mockContent}
      />
    );
    
    // Tab through interface
    await userEvent.tab();
    expect(screen.getByRole('button', { name: /zones/i })).toHaveFocus();
    
    await userEvent.tab();
    expect(screen.getByRole('button', { name: /maximize.*pdf/i })).toHaveFocus();
  });

  test('should announce changes to screen readers', async () => {
    render(
      <DualPaneViewer 
        documentId="test"
        zones={mockZones}
        extractedContent={mockContent}
      />
    );
    
    await userEvent.click(screen.getByTestId('zone-1'));
    
    expect(screen.getByRole('status')).toHaveTextContent('Zone zone-1 selected');
  });
});
```