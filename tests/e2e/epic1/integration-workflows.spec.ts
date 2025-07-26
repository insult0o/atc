import { test, expect } from '@playwright/test';
import path from 'path';

// Helper functions for test operations
async function uploadTestDocument(page: any, filename: string) {
  const testPdfPath = path.join(__dirname, '../../fixtures', filename);
  await page.setInputFiles('[data-testid="file-upload"]', testPdfPath);
  await expect(page.locator('[data-testid="upload-complete"]')).toBeVisible({ timeout: 30000 });
}

async function verifyZoneDetection(page: any, expectedCounts: any) {
  await expect(page.locator('[data-testid="zone-detection-complete"]')).toBeVisible({ timeout: 60000 });
  
  const textZones = await page.locator('[data-testid="text-zone"]').count();
  const tableZones = await page.locator('[data-testid="table-zone"]').count();
  const diagramZones = await page.locator('[data-testid="diagram-zone"]').count();
  
  expect(textZones).toBeGreaterThanOrEqual(expectedCounts.textZones.min);
  expect(textZones).toBeLessThanOrEqual(expectedCounts.textZones.max);
  expect(tableZones).toBeGreaterThanOrEqual(expectedCounts.tableZones.min);
  expect(tableZones).toBeLessThanOrEqual(expectedCounts.tableZones.max);
  expect(diagramZones).toBeGreaterThanOrEqual(expectedCounts.diagramZones.min);
  expect(diagramZones).toBeLessThanOrEqual(expectedCounts.diagramZones.max);
}

async function verifyToolAssignments(page: any) {
  await expect(page.locator('[data-testid="tool-assignment-complete"]')).toBeVisible({ timeout: 30000 });
  
  // Verify at least one tool of each type is assigned
  await expect(page.locator('[data-testid="pdfplumber-assigned"]')).toBeVisible();
  await expect(page.locator('[data-testid="pymupdf-assigned"]')).toBeVisible();
  await expect(page.locator('[data-testid="tesseract-assigned"]')).toBeVisible();
}

async function monitorProcessingPipeline(page: any, options: { timeout: number }) {
  // Wait for processing to start
  await expect(page.locator('[data-testid="processing-started"]')).toBeVisible();
  
  // Monitor progress updates
  await expect(page.locator('[data-testid="processing-progress"]')).toBeVisible();
  
  // Wait for completion
  await expect(page.locator('[data-testid="processing-complete"]')).toBeVisible({ timeout: options.timeout });
}

async function verifyConfidenceScoring(page: any, criteria: { minAverage: number }) {
  await expect(page.locator('[data-testid="confidence-calculation-complete"]')).toBeVisible();
  
  // Get average confidence score
  const avgConfidenceText = await page.locator('[data-testid="average-confidence"]').textContent();
  const avgConfidence = parseFloat(avgConfidenceText?.replace('%', '') || '0');
  
  expect(avgConfidence).toBeGreaterThanOrEqual(criteria.minAverage);
}

async function testResultMerging(page: any) {
  // Look for zones with multiple tool results
  const mergedZones = page.locator('[data-testid="merged-result-zone"]');
  const mergedCount = await mergedZones.count();
  
  if (mergedCount > 0) {
    // Verify merged results have higher confidence
    const mergedConfidence = await page.locator('[data-testid="merged-confidence"]').first().textContent();
    const confidence = parseFloat(mergedConfidence?.replace('%', '') || '0');
    expect(confidence).toBeGreaterThan(50); // Merged results should have reasonable confidence
  }
}

async function testExportGeneration(page: any) {
  await page.click('[data-testid="export-button"]');
  await expect(page.locator('[data-testid="export-complete"]')).toBeVisible({ timeout: 30000 });
  
  // Verify export files are generated
  await expect(page.locator('[data-testid="export-files-generated"]')).toBeVisible();
}

async function validatePerformanceMetrics(page: any, thresholds: any) {
  // Get performance metrics
  const processingTimeText = await page.locator('[data-testid="total-processing-time"]').textContent();
  const processingTime = parseFloat(processingTimeText?.replace(/[^\d.]/g, '') || '0');
  
  const memoryUsageText = await page.locator('[data-testid="memory-usage"]').textContent();
  const memoryMB = parseFloat(memoryUsageText?.replace(/[^\d.]/g, '') || '0');
  
  expect(processingTime).toBeLessThan(thresholds.totalTime.max);
  expect(memoryMB).toBeLessThan(parseFloat(thresholds.memoryUsage.max.replace('MB', '')));
}

test.describe('Epic 1: Complete Integration Workflows', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('[data-testid="app-loaded"]')).toBeVisible();
  });

  test('Complete PDF Processing Journey', async ({ page }) => {
    console.log('Starting complete PDF processing journey test...');
    
    // 1. Upload aviation technical manual (50 pages)
    console.log('Step 1: Uploading test document...');
    await uploadTestDocument(page, 'aviation-manual-50p.pdf');
    
    // 2. Verify automatic zone detection (text, tables, diagrams)
    console.log('Step 2: Verifying zone detection...');
    await verifyZoneDetection(page, {
      textZones: { min: 30, max: 50 },
      tableZones: { min: 5, max: 15 },
      diagramZones: { min: 10, max: 20 }
    });
    
    // 3. Validate tool assignments
    console.log('Step 3: Validating tool assignments...');
    await verifyToolAssignments(page);
    
    // 4. Monitor processing pipeline execution
    console.log('Step 4: Monitoring processing pipeline...');
    await monitorProcessingPipeline(page, { timeout: 120000 });
    
    // 5. Verify confidence scoring
    console.log('Step 5: Verifying confidence scoring...');
    await verifyConfidenceScoring(page, { minAverage: 75 });
    
    // 6. Test result merging for overlapping zones
    console.log('Step 6: Testing result merging...');
    await testResultMerging(page);
    
    // 7. Validate export functionality
    console.log('Step 7: Testing export generation...');
    await testExportGeneration(page);
    
    // 8. Performance metrics validation
    console.log('Step 8: Validating performance metrics...');
    await validatePerformanceMetrics(page, {
      totalTime: { max: 180000 }, // 3 minutes max
      memoryUsage: { max: '512MB' },
      cpuUsage: { max: 80 }
    });
    
    console.log('Complete PDF processing journey test completed successfully!');
  });

  test('Error Recovery and Fallback Scenarios', async ({ page }) => {
    // Test tool failure and fallback
    console.log('Testing error recovery scenarios...');
    
    // Mock primary tool failure
    await page.route('**/api/process/pdfplumber', route => route.abort('failed'));
    
    await uploadTestDocument(page, 'test-document.pdf');
    
    // Verify fallback to secondary tool
    await expect(page.locator('[data-testid="tool-fallback-occurred"]')).toBeVisible({ timeout: 60000 });
    await expect(page.locator('[data-testid="fallback-tool-name"]')).toHaveText('pymupdf');
    
    // Verify processing still completes
    await expect(page.locator('[data-testid="processing-complete"]')).toBeVisible({ timeout: 120000 });
  });

  test('Multi-User Concurrent Processing', async ({ browser }) => {
    console.log('Testing multi-user concurrent processing...');
    
    // Create multiple browser contexts to simulate different users
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();
    const page1 = await context1.newPage();
    const page2 = await context2.newPage();
    
    await page1.goto('/');
    await page2.goto('/');
    
    // Both users upload documents simultaneously
    const upload1 = uploadTestDocument(page1, 'test-document-1.pdf');
    const upload2 = uploadTestDocument(page2, 'test-document-2.pdf');
    
    await Promise.all([upload1, upload2]);
    
    // Verify both processing pipelines work independently
    await expect(page1.locator('[data-testid="processing-complete"]')).toBeVisible({ timeout: 120000 });
    await expect(page2.locator('[data-testid="processing-complete"]')).toBeVisible({ timeout: 120000 });
    
    await context1.close();
    await context2.close();
  });

  test('Large Document Stress Testing', async ({ page }) => {
    console.log('Testing large document processing...');
    
    // Upload large document (100+ pages)
    await uploadTestDocument(page, 'large-aviation-manual-100p.pdf');
    
    // Monitor memory usage during processing
    let maxMemoryUsage = 0;
    const memoryMonitor = setInterval(async () => {
      try {
        const memoryText = await page.locator('[data-testid="current-memory-usage"]').textContent();
        const memoryMB = parseFloat(memoryText?.replace(/[^\d.]/g, '') || '0');
        maxMemoryUsage = Math.max(maxMemoryUsage, memoryMB);
      } catch (e) {
        // Ignore errors during monitoring
      }
    }, 1000);
    
    // Wait for processing to complete
    await expect(page.locator('[data-testid="processing-complete"]')).toBeVisible({ timeout: 300000 }); // 5 minutes max
    
    clearInterval(memoryMonitor);
    
    // Verify memory usage stayed within acceptable limits
    expect(maxMemoryUsage).toBeLessThan(1024); // Less than 1GB
    
    // Verify all zones were processed
    const totalZones = await page.locator('[data-testid="detected-zone"]').count();
    const processedZones = await page.locator('[data-testid="processed-zone"]').count();
    expect(processedZones).toBe(totalZones);
  });

  test('Network Interruption Recovery', async ({ page }) => {
    console.log('Testing network interruption recovery...');
    
    await uploadTestDocument(page, 'test-document.pdf');
    
    // Wait for processing to start
    await expect(page.locator('[data-testid="processing-started"]')).toBeVisible();
    
    // Simulate network interruption
    await page.context().setOffline(true);
    
    // Verify offline indicator appears
    await expect(page.locator('[data-testid="offline-indicator"]')).toBeVisible();
    
    // Restore network
    await page.context().setOffline(false);
    
    // Verify automatic reconnection and processing continuation
    await expect(page.locator('[data-testid="reconnected-indicator"]')).toBeVisible();
    await expect(page.locator('[data-testid="processing-resumed"]')).toBeVisible();
    
    // Verify processing completes successfully
    await expect(page.locator('[data-testid="processing-complete"]')).toBeVisible({ timeout: 120000 });
  });

  test('End-to-End Regression Validation', async ({ page }) => {
    console.log('Running end-to-end regression validation...');
    
    // Load baseline test results
    const baselineResults = {
      expectedZones: 45,
      expectedConfidence: 82,
      expectedProcessingTime: 45000
    };
    
    const startTime = Date.now();
    await uploadTestDocument(page, 'regression-baseline.pdf');
    
    // Wait for processing completion
    await expect(page.locator('[data-testid="processing-complete"]')).toBeVisible({ timeout: 120000 });
    const endTime = Date.now();
    
    // Verify zone detection consistency
    const detectedZones = await page.locator('[data-testid="detected-zone"]').count();
    expect(Math.abs(detectedZones - baselineResults.expectedZones)).toBeLessThanOrEqual(3); // Allow 3 zone variance
    
    // Verify confidence score consistency
    const avgConfidenceText = await page.locator('[data-testid="average-confidence"]').textContent();
    const avgConfidence = parseFloat(avgConfidenceText?.replace('%', '') || '0');
    expect(Math.abs(avgConfidence - baselineResults.expectedConfidence)).toBeLessThanOrEqual(5); // Allow 5% variance
    
    // Verify processing time consistency
    const processingTime = endTime - startTime;
    expect(processingTime).toBeLessThan(baselineResults.expectedProcessingTime * 1.2); // Allow 20% increase
    
    console.log('Regression validation completed successfully!');
  });
}); 