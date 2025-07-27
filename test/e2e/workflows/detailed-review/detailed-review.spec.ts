import { test, expect } from '@playwright/test';
import { HomePage } from '../../pages/HomePage';
import { ViewerPage } from '../../pages/ViewerPage';
import { ExportPage } from '../../pages/ExportPage';
import { testPDFs, timeouts, expectedZones } from '../../fixtures/test-data';

test.describe('Detailed Review Workflow', () => {
  let homePage: HomePage;
  let viewerPage: ViewerPage;
  let exportPage: ExportPage;

  test.beforeEach(async ({ page }) => {
    homePage = new HomePage(page);
    viewerPage = new ViewerPage(page);
    exportPage = new ExportPage(page);
    
    await homePage.navigate();
  });

  test('should allow comprehensive zone editing and validation', async ({ page }) => {
    // Step 1: Upload and process
    await test.step('Upload complex document', async () => {
      await homePage.uploadPDF(testPDFs.complex);
      await page.waitForSelector('[data-testid="processing-complete"]', {
        timeout: timeouts.processing,
      });
      await viewerPage.waitForViewerReady();
    });

    // Step 2: Review all zones
    await test.step('Review detected zones', async () => {
      const zones = await viewerPage.getAllZones();
      expect(zones.length).toBe(expectedZones.complex.total);

      // Check zone types distribution
      for (const zone of zones) {
        const zoneElement = page.locator(`[data-zone-id="${await zone.getAttribute('data-zone-id')}"]`);
        const zoneType = await zoneElement.getAttribute('data-zone-type');
        expect(['text', 'table', 'image', 'diagram']).toContain(zoneType);
      }
    });

    // Step 3: Test zone selection and highlighting
    await test.step('Test zone selection', async () => {
      await viewerPage.selectZone('zone-1');
      
      // Verify highlighting
      expect(await viewerPage.isZoneHighlighted('zone-1')).toBeTruthy();
      
      // Verify editor sync
      expect(await viewerPage.isEditorSynchronized()).toBeTruthy();
    });

    // Step 4: Edit zone content
    await test.step('Edit zone content', async () => {
      const originalContent = await viewerPage.getEditorContent();
      const updatedContent = 'This is updated content for testing purposes.';
      
      await viewerPage.editContent(updatedContent);
      
      // Save changes
      await viewerPage.saveChanges();
      expect(await viewerPage.areChangesSaved()).toBeTruthy();
      
      // Verify content persisted
      const savedContent = await viewerPage.getEditorContent();
      expect(savedContent).toBe(updatedContent);
    });

    // Step 5: Test zone merging
    await test.step('Test zone merging', async () => {
      await viewerPage.selectMultipleZones(['zone-2', 'zone-3']);
      await viewerPage.mergeZones();
      
      // Verify zones were merged
      const zonesAfterMerge = await viewerPage.getAllZones();
      expect(zonesAfterMerge.length).toBeLessThan(expectedZones.complex.total);
    });

    // Step 6: Validate and export
    await test.step('Validate and export', async () => {
      await viewerPage.openExportDialog();
      
      // Configure detailed export
      await exportPage.selectFormat('jsonl');
      await exportPage.configureJSONLExport({
        includeMetadata: true,
        includeCoordinates: true,
        flattenStructure: false,
      });
      
      // Start export and validation
      await exportPage.startExport();
      
      // Check validation
      const validationPassed = await exportPage.isValidationPassed();
      if (!validationPassed) {
        const errors = await exportPage.getValidationErrors();
        console.log('Validation errors:', errors);
        
        // Override if needed
        await exportPage.overrideValidation('Manual review completed');
      }
      
      await exportPage.waitForExportComplete();
      const download = await exportPage.downloadExport();
      expect(download.filename).toContain('.jsonl');
    });
  });

  test('should support page navigation and multi-page editing', async ({ page }) => {
    await homePage.uploadPDF(testPDFs.multiPage);
    await page.waitForSelector('[data-testid="processing-complete"]');
    await viewerPage.waitForViewerReady();

    // Navigate through pages
    await test.step('Navigate pages', async () => {
      const initialPage = await viewerPage.getCurrentPage();
      expect(initialPage).toBe(1);

      await viewerPage.goToPage(2);
      expect(await viewerPage.getCurrentPage()).toBe(2);

      // Edit content on page 2
      const page2Zones = await viewerPage.getAllZones();
      if (page2Zones.length > 0) {
        await viewerPage.selectZone('zone-10'); // Assuming zone IDs
        await viewerPage.editContent('Page 2 edited content');
        await viewerPage.saveChanges();
      }

      // Go back to page 1
      await viewerPage.goToPage(1);
      expect(await viewerPage.getCurrentPage()).toBe(1);
    });
  });

  test('should handle table zone editing', async ({ page }) => {
    await homePage.uploadPDF(testPDFs.complex);
    await page.waitForSelector('[data-testid="processing-complete"]');
    await viewerPage.waitForViewerReady();

    // Find and select table zone
    const zones = await viewerPage.getAllZones();
    let tableZoneId: string | null = null;

    for (const zone of zones) {
      const type = await zone.getAttribute('data-zone-type');
      if (type === 'table') {
        tableZoneId = await zone.getAttribute('data-zone-id');
        break;
      }
    }

    if (tableZoneId) {
      await test.step('Edit table zone', async () => {
        await viewerPage.selectZone(tableZoneId);
        
        // Table content should be in structured format
        const content = await viewerPage.getEditorContent();
        expect(content).toContain('|'); // Markdown table format
        
        // Edit table
        const updatedTable = `| Column 1 | Column 2 | Column 3 |
|----------|----------|----------|
| Data 1   | Data 2   | Data 3   |
| Data 4   | Data 5   | Data 6   |`;
        
        await viewerPage.editContent(updatedTable);
        await viewerPage.saveChanges();
      });
    }
  });

  test('should validate zone confidence levels', async ({ page }) => {
    await homePage.uploadPDF(testPDFs.complex);
    await page.waitForSelector('[data-testid="processing-complete"]');
    await viewerPage.waitForViewerReady();

    const zones = await viewerPage.getAllZones();
    const lowConfidenceZones: string[] = [];

    await test.step('Check zone confidence', async () => {
      for (const zone of zones) {
        const zoneId = await zone.getAttribute('data-zone-id');
        const confidence = parseFloat(await zone.getAttribute('data-confidence') || '0');
        
        if (confidence < 0.8) {
          lowConfidenceZones.push(zoneId || '');
        }
      }
    });

    // If low confidence zones exist, they should be highlighted
    if (lowConfidenceZones.length > 0) {
      await test.step('Review low confidence zones', async () => {
        for (const zoneId of lowConfidenceZones) {
          await viewerPage.selectZone(zoneId);
          
          // Should show warning indicator
          const warningIndicator = page.locator(`[data-zone-id="${zoneId}"] .warning-indicator`);
          await expect(warningIndicator).toBeVisible();
        }
      });
    }
  });

  test('should support zone splitting', async ({ page }) => {
    await homePage.uploadPDF(testPDFs.simple);
    await page.waitForSelector('[data-testid="processing-complete"]');
    await viewerPage.waitForViewerReady();

    const initialZoneCount = await viewerPage.getZoneCount();

    await test.step('Split a zone', async () => {
      await viewerPage.selectZone('zone-1');
      
      // Get zone dimensions for split position
      const zoneElement = page.locator('[data-zone-id="zone-1"]');
      const box = await zoneElement.boundingBox();
      
      if (box) {
        await viewerPage.splitZone('zone-1', {
          x: box.width / 2,
          y: box.height / 2,
        });
        
        // Verify zone was split
        const newZoneCount = await viewerPage.getZoneCount();
        expect(newZoneCount).toBe(initialZoneCount + 1);
      }
    });
  });

  test('should save and load export presets', async ({ page }) => {
    await homePage.uploadPDF(testPDFs.simple);
    await page.waitForSelector('[data-testid="processing-complete"]');
    await viewerPage.waitForViewerReady();

    await viewerPage.openExportDialog();

    await test.step('Create export preset', async () => {
      await exportPage.selectFormat('rag');
      await exportPage.configureRAGExport({
        maxTokens: 2000,
        overlap: 200,
        includeMeta: true,
      });
      
      await exportPage.saveAsPreset('High Quality RAG');
      await expect(page.locator('[data-testid="preset-saved"]')).toBeVisible();
    });

    // Reload page and test preset
    await page.reload();
    await viewerPage.waitForViewerReady();
    await viewerPage.openExportDialog();

    await test.step('Load export preset', async () => {
      await exportPage.loadPreset('High Quality RAG');
      
      // Verify settings were loaded
      const maxTokensInput = page.locator('[data-testid="max-tokens"]');
      await expect(maxTokensInput).toHaveValue('2000');
    });
  });
});