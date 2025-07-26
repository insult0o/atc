# Epic 2 & 3 Testing Guide: UI Interaction & Export System

## Overview
This document provides comprehensive testing instructions for all functions and tools implemented in Epic 2 (UI Interaction) and Epic 3 (Export System).

## Epic 2: UI Interaction System Testing

### Story 2.1: Dual-Pane Viewer

#### 1. DualPaneViewer Component
**Location**: `app/components/viewer/DualPaneViewer.tsx`

##### Test: Synchronized Scrolling
```typescript
// Test synchronized scrolling between panes
test('should synchronize scroll between PDF and content panes', async ({ page }) => {
  // Navigate to dual-pane viewer
  await page.goto('http://localhost:3000/viewer/dual-pane?document=test-doc-123');
  
  // Scroll left pane (PDF viewer)
  const leftPane = page.locator('.left-pane');
  await leftPane.evaluate(el => el.scrollTop = 200);
  
  // Check right pane scrolled proportionally
  const rightPane = page.locator('.right-pane');
  const rightScroll = await rightPane.evaluate(el => el.scrollTop);
  expect(rightScroll).toBeGreaterThan(0);
});
```

##### Test: Pane Resizing
```typescript
// Test draggable divider
test('should resize panes by dragging divider', async ({ page }) => {
  await page.goto('http://localhost:3000/viewer/dual-pane');
  
  // Get initial pane widths
  const leftPaneInitial = await page.locator('.left-pane').boundingBox();
  
  // Drag divider
  const divider = page.locator('.pane-divider');
  await divider.dragTo(page.locator('body'), {
    targetPosition: { x: 800, y: 400 }
  });
  
  // Verify pane resized
  const leftPaneFinal = await page.locator('.left-pane').boundingBox();
  expect(leftPaneFinal.width).toBeGreaterThan(leftPaneInitial.width);
});
```

##### Test: Mobile View Switching
```typescript
// Test mobile responsive behavior
test('should switch to mobile view on small screens', async ({ page }) => {
  // Set mobile viewport
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto('http://localhost:3000/viewer/dual-pane');
  
  // Check mobile controls visible
  await expect(page.locator('button:has-text("PDF")')).toBeVisible();
  await expect(page.locator('button:has-text("Content")')).toBeVisible();
  
  // Switch panes
  await page.click('button:has-text("Content")');
  await expect(page.locator('.right-pane')).toBeVisible();
  await expect(page.locator('.left-pane')).not.toBeVisible();
});
```

##### Test: Zone Highlighting Toggle
```typescript
// Test zone highlighting visibility
test('should toggle zone highlighting', async ({ page }) => {
  await page.goto('http://localhost:3000/viewer/dual-pane');
  
  // Toggle highlighting off
  await page.click('button:has-text("Zones")');
  
  // Verify zones hidden
  const zoneHighlighter = page.locator('.zone-highlighter');
  await expect(zoneHighlighter).not.toBeVisible();
  
  // Toggle back on
  await page.click('button:has-text("Zones")');
  await expect(zoneHighlighter).toBeVisible();
});
```

#### 2. PDFViewer Component
**Location**: `app/components/viewer/PDFViewer.tsx`

##### Test: PDF Loading and Rendering
```typescript
// Test PDF loading
test('should load and render PDF', async ({ page }) => {
  await page.goto('http://localhost:3000/viewer/dual-pane');
  
  // Wait for PDF to load
  await page.waitForSelector('canvas.pdf-page', { timeout: 10000 });
  
  // Verify pages rendered
  const pages = await page.locator('canvas.pdf-page').count();
  expect(pages).toBeGreaterThan(0);
});
```

##### Test: Zoom Controls
```typescript
// Test zoom functionality
test('should zoom PDF in and out', async ({ page }) => {
  await page.goto('http://localhost:3000/viewer/dual-pane');
  await page.waitForSelector('canvas.pdf-page');
  
  // Get initial canvas size
  const initialSize = await page.locator('canvas.pdf-page').first().boundingBox();
  
  // Zoom in
  await page.click('button[aria-label="Zoom in"]');
  await page.waitForTimeout(500);
  
  // Verify canvas enlarged
  const zoomedSize = await page.locator('canvas.pdf-page').first().boundingBox();
  expect(zoomedSize.width).toBeGreaterThan(initialSize.width);
});
```

### Story 2.2: Zone Selection and Editing

#### 3. ZoneSelector Component
**Location**: `app/components/zones/ZoneSelector.tsx`

##### Test: Zone Creation
```typescript
// Test creating new zone
test('should create zone by drawing', async ({ page }) => {
  await page.goto('http://localhost:3000/viewer/dual-pane');
  
  // Enable zone creation mode
  await page.click('button:has-text("Create Zone")');
  
  // Draw zone
  const canvas = page.locator('.zone-creation-canvas');
  await canvas.dragTo(canvas, {
    sourcePosition: { x: 100, y: 100 },
    targetPosition: { x: 300, y: 200 }
  });
  
  // Verify zone created
  await expect(page.locator('.zone-rect')).toHaveCount(1);
});
```

##### Test: Zone Selection
```typescript
// Test zone selection
test('should select zone on click', async ({ page }) => {
  await page.goto('http://localhost:3000/viewer/dual-pane');
  
  // Click on a zone
  await page.click('.zone-rect:first-child');
  
  // Verify zone selected
  await expect(page.locator('.zone-rect.selected')).toHaveCount(1);
  
  // Verify content viewer shows selected zone
  await expect(page.locator('.selected-zone-content')).toBeVisible();
});
```

#### 4. ZoneEditor Component
**Location**: `app/components/zones/ZoneEditor.tsx`

##### Test: Zone Type Change
```typescript
// Test changing zone type
test('should change zone type', async ({ page }) => {
  await page.goto('http://localhost:3000/viewer/dual-pane');
  
  // Select a zone
  await page.click('.zone-rect:first-child');
  
  // Open zone editor
  await page.click('button:has-text("Edit Zone")');
  
  // Change type
  await page.selectOption('select[name="zoneType"]', 'table');
  
  // Verify type changed
  await expect(page.locator('.zone-rect.type-table')).toHaveCount(1);
});
```

##### Test: Zone Resizing
```typescript
// Test resizing zone
test('should resize zone', async ({ page }) => {
  await page.goto('http://localhost:3000/viewer/dual-pane');
  
  // Select zone
  await page.click('.zone-rect:first-child');
  
  // Get initial size
  const initialBox = await page.locator('.zone-rect.selected').boundingBox();
  
  // Drag resize handle
  await page.dragAndDrop('.resize-handle-se', '.resize-handle-se', {
    targetPosition: { x: 50, y: 50 }
  });
  
  // Verify size changed
  const finalBox = await page.locator('.zone-rect.selected').boundingBox();
  expect(finalBox.width).not.toBe(initialBox.width);
});
```

### Story 2.3: Confidence Visualization

#### 5. ConfidenceIndicator Component
**Location**: `app/components/viewer/ConfidenceIndicator.tsx`

##### Test: Confidence Color Coding
```typescript
// Test confidence visualization
test('should show confidence with color coding', async ({ page }) => {
  await page.goto('http://localhost:3000/viewer/dual-pane');
  
  // Check high confidence (green)
  const highConfidence = page.locator('.confidence-indicator[data-confidence="0.95"]');
  await expect(highConfidence).toHaveCSS('background-color', /rgb\(34, 197, 94/);
  
  // Check medium confidence (yellow)
  const mediumConfidence = page.locator('.confidence-indicator[data-confidence="0.75"]');
  await expect(mediumConfidence).toHaveCSS('background-color', /rgb\(250, 204, 21/);
  
  // Check low confidence (red)
  const lowConfidence = page.locator('.confidence-indicator[data-confidence="0.55"]');
  await expect(lowConfidence).toHaveCSS('background-color', /rgb\(239, 68, 68/);
});
```

### Story 2.4: Manual Override Controls

#### 6. ManualOverride Component
**Location**: `app/components/zones/ManualOverride.tsx`

##### Test: Content Override
```typescript
// Test manual content override
test('should override extracted content', async ({ page }) => {
  await page.goto('http://localhost:3000/viewer/dual-pane');
  
  // Select zone
  await page.click('.zone-rect:first-child');
  
  // Enable override
  await page.click('button:has-text("Override Content")');
  
  // Enter new content
  await page.fill('textarea[name="overrideContent"]', 'Manually corrected text');
  await page.click('button:has-text("Save Override")');
  
  // Verify override applied
  await expect(page.locator('.content-overridden')).toBeVisible();
  await expect(page.locator('.extracted-content')).toContainText('Manually corrected text');
});
```

## Epic 3: Export System Testing

### Story 3.1 (Story 8): Export Format Generation

#### 7. ExportGenerator Class
**Location**: `lib/export/export-generator.ts`

##### Test: RAG JSON Export
```typescript
// Test RAG-ready JSON generation
import { ExportGenerator } from '@/lib/export/export-generator';

test('should generate RAG JSON chunks', async () => {
  const generator = new ExportGenerator();
  
  const result = await generator.generateRAGChunks({
    documentId: 'test-123',
    zones: mockZones,
    chunkSize: 1000,
    overlap: 100
  });
  
  expect(result.chunks).toHaveLength(5);
  expect(result.chunks[0]).toHaveProperty('id');
  expect(result.chunks[0]).toHaveProperty('content');
  expect(result.chunks[0]).toHaveProperty('metadata');
  expect(result.chunks[0].metadata).toHaveProperty('page');
  expect(result.chunks[0].metadata).toHaveProperty('confidence');
});
```

##### Test: Fine-tuning JSONL Export
```typescript
// Test JSONL generation for fine-tuning
test('should generate fine-tuning JSONL', async () => {
  const generator = new ExportGenerator();
  
  const jsonl = await generator.generateFineTuningData({
    documentId: 'test-123',
    corrections: mockCorrections
  });
  
  const lines = jsonl.split('\n').filter(Boolean);
  expect(lines).toHaveLength(3);
  
  const firstLine = JSON.parse(lines[0]);
  expect(firstLine).toHaveProperty('prompt');
  expect(firstLine).toHaveProperty('completion');
});
```

##### Test: Zone Manifest Export
```typescript
// Test zone manifest generation
test('should generate zone manifest', async () => {
  const generator = new ExportGenerator();
  
  const manifest = await generator.generateZoneManifest({
    documentId: 'test-123',
    zones: mockZones,
    includeMetadata: true
  });
  
  expect(manifest.documentId).toBe('test-123');
  expect(manifest.zones).toHaveLength(mockZones.length);
  expect(manifest.statistics).toHaveProperty('totalZones');
  expect(manifest.statistics).toHaveProperty('averageConfidence');
});
```

### Story 3.2 (Story 9): Export Validation System

#### 8. ExportValidator Class
**Location**: `lib/export/validation/export-validator.ts`

##### Test: Schema Validation
```typescript
// Test JSON schema validation
import { ExportValidator } from '@/lib/export/validation/export-validator';

test('should validate export against schema', async () => {
  const validator = new ExportValidator();
  
  const validData = {
    documentId: 'test-123',
    chunks: [{ id: '1', content: 'text', metadata: {} }]
  };
  
  const result = await validator.validateRAGExport(validData);
  expect(result.valid).toBe(true);
  expect(result.errors).toHaveLength(0);
  
  // Test invalid data
  const invalidData = { documentId: 'test-123' }; // missing chunks
  const invalidResult = await validator.validateRAGExport(invalidData);
  expect(invalidResult.valid).toBe(false);
  expect(invalidResult.errors).toContain('Missing required field: chunks');
});
```

##### Test: Content Validation
```typescript
// Test content format validation
test('should validate content formats', async () => {
  const validator = new ExportValidator();
  
  const result = await validator.validateContent({
    zones: mockZones,
    checkEmptyContent: true,
    checkSpecialCharacters: true
  });
  
  expect(result.valid).toBe(true);
  expect(result.warnings).toHaveLength(0);
});
```

##### Test: Export Blocking
```typescript
// Test export blocking on validation failure
test('should block invalid exports', async ({ page }) => {
  await page.goto('http://localhost:3000/export');
  
  // Try to export with validation errors
  await page.click('button:has-text("Export as RAG JSON")');
  
  // Verify error message
  await expect(page.locator('.export-error')).toContainText('Validation failed');
  await expect(page.locator('.export-error-details')).toBeVisible();
  
  // Verify export not completed
  const downloads = await page.context().waitForEvent('download', { timeout: 1000 }).catch(() => null);
  expect(downloads).toBeNull();
});
```

### Story 3.3 (Story 10): Partial Export Support

#### 9. PartialExportSelector Component
**Location**: `app/components/export/PartialExportSelector.tsx`

##### Test: Zone Selection for Export
```typescript
// Test selecting specific zones
test('should select zones for partial export', async ({ page }) => {
  await page.goto('http://localhost:3000/export');
  
  // Open partial export dialog
  await page.click('button:has-text("Partial Export")');
  
  // Select specific zones
  await page.check('input[name="zone_1"]');
  await page.check('input[name="zone_3"]');
  await page.check('input[name="zone_5"]');
  
  // Verify selection count
  await expect(page.locator('.selection-count')).toContainText('3 zones selected');
});
```

##### Test: Page-based Selection
```typescript
// Test selecting by page
test('should select all zones on a page', async ({ page }) => {
  await page.goto('http://localhost:3000/export');
  
  await page.click('button:has-text("Partial Export")');
  
  // Select all zones on page 1
  await page.click('button:has-text("Select Page 1")');
  
  // Verify all page 1 zones selected
  const page1Zones = await page.locator('input[name^="zone_"]:checked').count();
  expect(page1Zones).toBe(5); // assuming 5 zones on page 1
});
```

##### Test: Partial Export Generation
```typescript
// Test generating partial export
test('should export only selected zones', async ({ page }) => {
  await page.goto('http://localhost:3000/export');
  
  // Select specific zones
  await page.click('button:has-text("Partial Export")');
  await page.check('input[name="zone_1"]');
  await page.check('input[name="zone_2"]');
  
  // Export
  const downloadPromise = page.waitForEvent('download');
  await page.click('button:has-text("Export Selected")');
  const download = await downloadPromise;
  
  // Verify download
  const content = await download.path().then(fs.readFileSync).then(b => b.toString());
  const exported = JSON.parse(content);
  expect(exported.zones).toHaveLength(2);
  expect(exported.partial).toBe(true);
});
```

### Story 3.4 (Story 11): Export Logging System

#### 10. Logger Class
**Location**: `lib/export/logging/logger.ts`

##### Test: Structured Logging
```typescript
// Test structured log creation
import { Logger } from '@/lib/export/logging/logger';

test('should create structured logs', () => {
  const logger = new Logger({ correlationId: 'test-123' });
  
  const log = logger.log({
    level: 'info',
    action: 'export_started',
    metadata: { format: 'rag_json', zones: 10 }
  });
  
  expect(log.correlationId).toBe('test-123');
  expect(log.timestamp).toBeDefined();
  expect(log.level).toBe('info');
  expect(log.metadata.zones).toBe(10);
});
```

##### Test: Log Sanitization
```typescript
// Test PII sanitization
test('should sanitize sensitive data', () => {
  const logger = new Logger({ 
    sanitization: { enabled: true }
  });
  
  const log = logger.log({
    level: 'info',
    action: 'export_completed',
    metadata: {
      userEmail: 'john.doe@example.com',
      apiKey: 'sk-1234567890',
      content: 'Contact John at 555-1234'
    }
  });
  
  expect(log.metadata.userEmail).toBe('[REDACTED]');
  expect(log.metadata.apiKey).toBe('[REDACTED]');
  expect(log.metadata.content).toBe('Contact John at [REDACTED]');
});
```

#### 11. ExportLogger Class
**Location**: `lib/export/logging/export-logger.ts`

##### Test: Export Operation Tracking
```typescript
// Test export operation logging
import { ExportLogger } from '@/lib/export/logging/export-logger';

test('should track export lifecycle', async () => {
  const logger = new ExportLogger();
  const sessionId = 'export-123';
  
  // Log initiation
  logger.logExportInitiated({
    sessionId,
    format: 'rag_json',
    documentId: 'doc-123',
    totalZones: 20
  });
  
  // Log progress
  logger.logExportProgress(sessionId, {
    processed: 10,
    total: 20,
    currentPhase: 'validation'
  });
  
  // Log completion
  logger.logExportCompleted(sessionId, {
    success: true,
    duration: 1500,
    outputSize: 2048,
    warnings: []
  });
  
  // Verify logs
  const logs = logger.getSessionLogs(sessionId);
  expect(logs).toHaveLength(3);
  expect(logs[0].action).toBe('export_initiated');
  expect(logs[2].action).toBe('export_completed');
});
```

#### 12. PerformanceLogger Class
**Location**: `lib/export/logging/performance-logger.ts`

##### Test: Performance Tracking
```typescript
// Test performance logging
import { PerformanceLogger } from '@/lib/export/logging/performance-logger';

test('should track operation performance', async () => {
  const perfLogger = new PerformanceLogger();
  const opId = 'op-123';
  
  // Start operation
  perfLogger.startOperation(opId, 'export_generation');
  
  // Track phases
  perfLogger.startPhase(opId, 'validation');
  await new Promise(resolve => setTimeout(resolve, 100));
  perfLogger.endPhase(opId, 'validation');
  
  perfLogger.startPhase(opId, 'generation');
  await new Promise(resolve => setTimeout(resolve, 200));
  perfLogger.endPhase(opId, 'generation');
  
  // End operation
  const metrics = perfLogger.endOperation(opId);
  
  expect(metrics.totalDuration).toBeGreaterThan(300);
  expect(metrics.phases.validation.duration).toBeGreaterThan(100);
  expect(metrics.phases.generation.duration).toBeGreaterThan(200);
  expect(metrics.bottlenecks).toContain('generation');
});
```

#### 13. AuditTrailManager Class
**Location**: `lib/export/logging/audit-trail.ts`

##### Test: Audit Trail Creation
```typescript
// Test audit trail with hash verification
import { AuditTrailManager } from '@/lib/export/logging/audit-trail';

test('should create verifiable audit trail', async () => {
  const auditManager = new AuditTrailManager();
  
  // Add entries
  const entry1 = await auditManager.addEntry({
    action: 'export_initiated',
    documentId: 'doc-123',
    format: 'rag_json'
  }, {
    userId: 'user-123',
    timestamp: new Date()
  });
  
  const entry2 = await auditManager.addEntry({
    action: 'export_completed',
    documentId: 'doc-123',
    success: true
  }, {
    userId: 'user-123',
    timestamp: new Date()
  });
  
  // Verify integrity
  const verification = await auditManager.verifyIntegrity();
  expect(verification.valid).toBe(true);
  expect(verification.errors).toHaveLength(0);
  
  // Verify entries are linked
  const entries = await auditManager.getEntries({ limit: 2 });
  expect(entries[1].previousHash).toBe(entries[0].hash);
});
```

## Integration Testing Examples

### Full Export Flow Test
```typescript
// Test complete export workflow
test('should complete full export workflow', async ({ page }) => {
  // Upload document
  await page.goto('http://localhost:3000');
  await page.setInputFiles('input[type="file"]', 'test-files/sample.pdf');
  await page.waitForSelector('text=Successfully Processed');
  
  // Open dual-pane viewer
  await page.click('button:has-text("Open Dual-Pane Viewer")');
  
  // Select and modify zones
  await page.click('.zone-rect:first-child');
  await page.click('button:has-text("Override Content")');
  await page.fill('textarea[name="overrideContent"]', 'Corrected content');
  await page.click('button:has-text("Save Override")');
  
  // Navigate to export
  await page.click('button:has-text("Export")');
  
  // Select export format
  await page.selectOption('select[name="exportFormat"]', 'rag_json');
  
  // Configure options
  await page.fill('input[name="chunkSize"]', '1500');
  await page.fill('input[name="overlap"]', '200');
  
  // Export
  const downloadPromise = page.waitForEvent('download');
  await page.click('button:has-text("Export Document")');
  
  // Verify download
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toContain('rag_export');
  expect(download.suggestedFilename()).toContain('.json');
});
```

### Performance Monitoring Test
```typescript
// Test performance monitoring during export
test('should monitor export performance', async ({ page }) => {
  await page.goto('http://localhost:3000/export');
  
  // Enable performance monitoring
  await page.evaluate(() => {
    window.localStorage.setItem('enablePerformanceMonitoring', 'true');
  });
  
  // Start export
  await page.click('button:has-text("Export as RAG JSON")');
  
  // Check performance overlay
  await expect(page.locator('.performance-metrics')).toBeVisible();
  await expect(page.locator('.performance-metrics')).toContainText('Export Duration');
  await expect(page.locator('.performance-metrics')).toContainText('Memory Usage');
});
```

## Test Data Setup

### Mock Data Generators
```typescript
// Generate mock zones
export const generateMockZones = (count: number): Zone[] => {
  return Array.from({ length: count }, (_, i) => ({
    id: `zone_${i + 1}`,
    page: Math.floor(i / 5) + 1,
    coordinates: {
      x: 50 + (i % 3) * 200,
      y: 100 + (i % 5) * 150,
      width: 180,
      height: 100
    },
    type: ['text', 'table', 'header', 'image'][i % 4],
    confidence: 0.5 + Math.random() * 0.5,
    status: 'completed',
    content: `Sample content for zone ${i + 1}`,
    metadata: {
      tool: 'ai_processor',
      timestamp: new Date().toISOString()
    }
  }));
};

// Generate mock corrections
export const generateMockCorrections = (): Correction[] => {
  return [
    {
      zoneId: 'zone_1',
      original: 'Original text with error',
      corrected: 'Corrected text without error',
      confidence: 0.95,
      timestamp: new Date().toISOString()
    },
    {
      zoneId: 'zone_3',
      original: 'Tabel heading',
      corrected: 'Table heading',
      confidence: 0.88,
      timestamp: new Date().toISOString()
    }
  ];
};
```

## Running the Tests

### Setup Test Environment
```bash
# Install test dependencies
npm install --save-dev @playwright/test vitest @testing-library/react

# Run all tests
npm run test

# Run UI tests only
npm run test:ui

# Run export tests only
npm run test:export

# Run with UI mode
npm run test:ui -- --ui

# Run specific test file
npm run test -- dual-pane-viewer.spec.ts
```

### CI/CD Integration
```yaml
# .github/workflows/test.yml
name: Test Epic 2 & 3

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Run Epic 2 & 3 tests
        run: |
          npm run test:ui
          npm run test:export
          
      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: test-results
          path: test-results/
```

## Debugging Tips

1. **Visual Debugging**: Use Playwright's UI mode to see tests run
   ```bash
   npx playwright test --ui
   ```

2. **Screenshot on Failure**: Add to test config
   ```typescript
   use: {
     screenshot: 'only-on-failure',
     video: 'retain-on-failure'
   }
   ```

3. **Debug Specific Test**: 
   ```bash
   npx playwright test dual-pane --debug
   ```

4. **Check Export Logs**:
   ```typescript
   // In tests, enable verbose logging
   process.env.DEBUG = 'export:*';
   ```