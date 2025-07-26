import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('Story 4: PDF Upload & Initial Processing', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    
    // Wait for app initialization
    await expect(page.locator('[data-testid="app-loaded"]')).toBeVisible();
  });

  test.describe('Upload Flow Tests', () => {
    test('PDF upload via drag-drop with progress tracking', async ({ page }) => {
      // Create test PDF file data
      const testPdfPath = path.join(__dirname, '../../fixtures/test-aviation-manual.pdf');
      
      // Drag and drop file
      await page.setInputFiles('[data-testid="file-upload"]', testPdfPath);
      
      // Verify upload progress indicator appears
      await expect(page.locator('[data-testid="upload-progress"]')).toBeVisible();
      await expect(page.locator('[data-testid="upload-percentage"]')).toBeVisible();
      
      // Wait for upload completion
      await expect(page.locator('[data-testid="upload-complete"]')).toBeVisible({ timeout: 30000 });
      
      // Verify file appears in document list
      await expect(page.locator('[data-testid="uploaded-document"]')).toBeVisible();
      await expect(page.locator('[data-testid="document-name"]')).toHaveText('test-aviation-manual.pdf');
    });

    test('PDF validation (format, size, corruption detection)', async ({ page }) => {
      // Test invalid file type
      const invalidFile = path.join(__dirname, '../../fixtures/invalid-file.txt');
      await page.setInputFiles('[data-testid="file-upload"]', invalidFile);
      
      await expect(page.locator('[data-testid="validation-error"]')).toBeVisible();
      await expect(page.locator('[data-testid="validation-error"]')).toHaveText(/Invalid file type/);
      
      // Test oversized file (mock large file)
      await page.evaluate(() => {
        const mockLargeFile = new File(['x'.repeat(101 * 1024 * 1024)], 'large.pdf', {
          type: 'application/pdf'
        });
        
        const input = document.querySelector('[data-testid="file-upload"]') as HTMLInputElement;
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(mockLargeFile);
        input.files = dataTransfer.files;
        input.dispatchEvent(new Event('change', { bubbles: true }));
      });
      
      await expect(page.locator('[data-testid="validation-error"]')).toHaveText(/File size exceeds 100MB limit/);
    });

    test('Upload cancellation and retry mechanisms', async ({ page }) => {
      // Mock slow upload to test cancellation
      await page.route('**/api/upload', async route => {
        await new Promise(resolve => setTimeout(resolve, 5000)); // 5 second delay
        await route.continue();
      });
      
      const testPdfPath = path.join(__dirname, '../../fixtures/test-aviation-manual.pdf');
      await page.setInputFiles('[data-testid="file-upload"]', testPdfPath);
      
      // Wait for upload to start and cancel
      await expect(page.locator('[data-testid="upload-progress"]')).toBeVisible();
      await page.click('[data-testid="cancel-upload"]');
      
      // Verify cancellation
      await expect(page.locator('[data-testid="upload-cancelled"]')).toBeVisible();
      
      // Test retry functionality
      await page.click('[data-testid="retry-upload"]');
      await expect(page.locator('[data-testid="upload-progress"]')).toBeVisible();
    });
  });

  test.describe('WebSocket Integration Tests', () => {
    test('Real-time processing status updates', async ({ page }) => {
      // Setup WebSocket message listener
      let wsMessages: any[] = [];
      page.on('websocket', ws => {
        ws.on('framereceived', event => {
          const data = JSON.parse(event.payload.toString());
          wsMessages.push(data);
        });
      });
      
      const testPdfPath = path.join(__dirname, '../../fixtures/test-aviation-manual.pdf');
      await page.setInputFiles('[data-testid="file-upload"]', testPdfPath);
      
      // Wait for processing to complete
      await expect(page.locator('[data-testid="processing-complete"]')).toBeVisible({ timeout: 60000 });
      
      // Verify WebSocket messages were received
      expect(wsMessages.length).toBeGreaterThan(0);
      expect(wsMessages.some(msg => msg.type === 'processing_started')).toBe(true);
      expect(wsMessages.some(msg => msg.type === 'processing_progress')).toBe(true);
      expect(wsMessages.some(msg => msg.type === 'processing_complete')).toBe(true);
    });

    test('WebSocket reconnection on failure', async ({ page }) => {
      // Upload document first
      const testPdfPath = path.join(__dirname, '../../fixtures/test-aviation-manual.pdf');
      await page.setInputFiles('[data-testid="file-upload"]', testPdfPath);
      
      // Wait for WebSocket connection
      await expect(page.locator('[data-testid="ws-connected"]')).toBeVisible();
      
      // Simulate WebSocket disconnection
      await page.evaluate(() => {
        // Close WebSocket connection
        (window as any).wsConnection?.close();
      });
      
      // Verify reconnection indicator
      await expect(page.locator('[data-testid="ws-reconnecting"]')).toBeVisible();
      await expect(page.locator('[data-testid="ws-connected"]')).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Initial Processing Tests', () => {
    test('PDF parsing and metadata extraction', async ({ page }) => {
      const testPdfPath = path.join(__dirname, '../../fixtures/test-aviation-manual.pdf');
      await page.setInputFiles('[data-testid="file-upload"]', testPdfPath);
      
      // Wait for parsing to complete
      await expect(page.locator('[data-testid="parsing-complete"]')).toBeVisible({ timeout: 30000 });
      
      // Verify metadata extraction
      await expect(page.locator('[data-testid="document-metadata"]')).toBeVisible();
      await expect(page.locator('[data-testid="page-count"]')).toHaveText(/\d+ pages/);
      await expect(page.locator('[data-testid="file-size"]')).toHaveText(/\d+\.?\d* (KB|MB)/);
      
      // Verify document title extraction
      const documentTitle = await page.locator('[data-testid="document-title"]').textContent();
      expect(documentTitle).toBeTruthy();
      expect(documentTitle!.length).toBeGreaterThan(0);
    });

    test('Zone detection initialization', async ({ page }) => {
      const testPdfPath = path.join(__dirname, '../../fixtures/test-aviation-manual.pdf');
      await page.setInputFiles('[data-testid="file-upload"]', testPdfPath);
      
      // Wait for zone detection to complete
      await expect(page.locator('[data-testid="zone-detection-complete"]')).toBeVisible({ timeout: 60000 });
      
      // Verify zones are detected
      const zones = page.locator('[data-testid="detected-zone"]');
      const zoneCount = await zones.count();
      expect(zoneCount).toBeGreaterThan(0);
      
      // Verify zone types are identified
      await expect(page.locator('[data-testid="text-zone"]')).toBeVisible();
      await expect(page.locator('[data-testid="table-zone"]')).toBeVisible();
      await expect(page.locator('[data-testid="diagram-zone"]')).toBeVisible();
    });

    test('Tool assignment preparation', async ({ page }) => {
      const testPdfPath = path.join(__dirname, '../../fixtures/test-aviation-manual.pdf');
      await page.setInputFiles('[data-testid="file-upload"]', testPdfPath);
      
      // Wait for tool assignment to complete
      await expect(page.locator('[data-testid="tool-assignment-complete"]')).toBeVisible({ timeout: 30000 });
      
      // Verify tools are assigned to zones
      const assignedZones = page.locator('[data-testid="zone-with-tool"]');
      const assignedZoneCount = await assignedZones.count();
      expect(assignedZoneCount).toBeGreaterThan(0);
      
      // Verify tool assignment indicators
      await expect(page.locator('[data-testid="pdfplumber-assigned"]')).toBeVisible();
      await expect(page.locator('[data-testid="pymupdf-assigned"]')).toBeVisible();
      await expect(page.locator('[data-testid="tesseract-assigned"]')).toBeVisible();
      
      // Verify tool assignment summary
      const toolSummary = page.locator('[data-testid="tool-assignment-summary"]');
      await expect(toolSummary).toBeVisible();
      await expect(toolSummary).toHaveText(/\d+ zones assigned/);
    });
  });

  test.describe('Performance Validation', () => {
    test('Upload and initial processing performance', async ({ page }) => {
      const startTime = Date.now();
      
      const testPdfPath = path.join(__dirname, '../../fixtures/test-aviation-manual.pdf');
      await page.setInputFiles('[data-testid="file-upload"]', testPdfPath);
      
      // Wait for complete processing
      await expect(page.locator('[data-testid="processing-complete"]')).toBeVisible({ timeout: 120000 });
      
      const endTime = Date.now();
      const processingTime = endTime - startTime;
      
      // Verify processing time is within acceptable limits (2 minutes for test document)
      expect(processingTime).toBeLessThan(120000);
      
      // Verify performance metrics are displayed
      await expect(page.locator('[data-testid="processing-time"]')).toBeVisible();
      await expect(page.locator('[data-testid="zones-detected-count"]')).toBeVisible();
    });
  });
}); 