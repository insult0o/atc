import { test, expect } from '@playwright/test';
import { readFileSync } from 'fs';
import path from 'path';

test.describe('PDF Processing Platform', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test.describe('Upload Flow', () => {
    test('should upload PDF and identify zones', async ({ page }) => {
      // Upload test PDF
      await page.setInputFiles('input[type="file"]', 'fixtures/test.pdf');
      
      // Wait for processing
      await expect(page.locator('.processing-status')).toHaveText('Processing complete');
      
      // Verify zones were created
      const zones = page.locator('.pdf-zone');
      await expect(zones).toHaveCount(5); // Assuming test PDF has 5 zones
    });

    test('should show correct confidence indicators', async ({ page }) => {
      await page.setInputFiles('input[type="file"]', 'fixtures/test.pdf');
      await page.waitForSelector('.pdf-zone');

      // Check high confidence zones
      const highConfidence = page.locator('.pdf-zone.high-confidence');
      await expect(highConfidence).toBeVisible();
      await expect(highConfidence).toHaveCSS('opacity', '1');

      // Check low confidence zones
      const lowConfidence = page.locator('.pdf-zone.low-confidence');
      await expect(lowConfidence).toBeVisible();
      await expect(lowConfidence).toHaveCSS('opacity', '0.5');
    });
  });

  test.describe('Zone Processing', () => {
    test('should allow zone reprocessing', async ({ page }) => {
      await page.setInputFiles('input[type="file"]', 'fixtures/test.pdf');
      await page.waitForSelector('.pdf-zone');

      // Select a zone
      await page.click('.pdf-zone:first-child');
      
      // Choose different tool
      await page.selectOption('.tool-selector', 'pdfplumber');
      await page.click('.reprocess-button');

      // Verify processing status
      await expect(page.locator('.zone-status')).toHaveText('Processing');
      await expect(page.locator('.zone-status')).toHaveText('Complete');
    });

    test('should handle tool fallback', async ({ page }) => {
      await page.setInputFiles('input[type="file"]', 'fixtures/error.pdf');
      await page.waitForSelector('.pdf-zone');

      // Wait for fallback to occur
      await expect(page.locator('.tool-status')).toHaveText(/Falling back to pdfplumber/);
      
      // Verify final tool used
      await expect(page.locator('.current-tool')).toHaveText('pdfplumber');
    });

    test('should allow manual corrections', async ({ page }) => {
      await page.setInputFiles('input[type="file"]', 'fixtures/test.pdf');
      await page.waitForSelector('.pdf-zone');

      // Edit zone content
      await page.click('.pdf-zone:first-child');
      await page.click('.edit-button');
      await page.fill('.zone-editor', 'Corrected content');
      await page.click('.save-button');

      // Verify confidence update
      await expect(page.locator('.confidence-score')).toHaveText('100%');
      await expect(page.locator('.zone-status')).toHaveText('manual_override');
    });
  });

  test.describe('Export System', () => {
    test('should block export with errors', async ({ page }) => {
      await page.setInputFiles('input[type="file"]', 'fixtures/error.pdf');
      await page.waitForSelector('.pdf-zone');

      // Try to export
      await page.click('.export-button');

      // Verify export blocked
      await expect(page.locator('.export-error')).toBeVisible();
      await expect(page.locator('.export-error')).toHaveText(/Cannot export with unresolved errors/);
    });

    test('should support partial export', async ({ page }) => {
      await page.setInputFiles('input[type="file"]', 'fixtures/test.pdf');
      await page.waitForSelector('.pdf-zone');

      // Select specific zones
      await page.click('.pdf-zone:first-child');
      await page.click('.pdf-zone:nth-child(2)');
      
      // Export selected
      await page.click('.partial-export-button');

      // Verify export
      await expect(page.locator('.export-status')).toHaveText('Export complete');
      
      // Verify files
      const manifest = JSON.parse(readFileSync(path.join('output', 'test', 'zone_manifest.json'), 'utf-8'));
      expect(manifest.zones).toHaveLength(2);
    });

    test('should validate export schema', async ({ page }) => {
      await page.setInputFiles('input[type="file"]', 'fixtures/test.pdf');
      await page.waitForSelector('.pdf-zone');

      // Export
      await page.click('.export-button');

      // Verify schema validation
      await expect(page.locator('.validation-status')).toHaveText('Schema validation passed');
    });
  });

  test.describe('Regression Tests', () => {
    test('should flag confidence drops', async ({ page }) => {
      await page.setInputFiles('input[type="file"]', 'fixtures/test.pdf');
      await page.waitForSelector('.pdf-zone');

      // Get initial confidence
      const initialConfidenceEl = page.locator('.confidence-score').first();
      const initialConfidence = await initialConfidenceEl.textContent();
      if (!initialConfidence) {
        throw new Error('Initial confidence score not found');
      }

      // Reprocess zone
      await page.click('.pdf-zone:first-child');
      await page.selectOption('.tool-selector', 'pymupdf');
      await page.click('.reprocess-button');

      // Get new confidence
      const newConfidenceEl = page.locator('.confidence-score').first();
      const newConfidence = await newConfidenceEl.textContent();
      if (!newConfidence) {
        throw new Error('New confidence score not found');
      }

      // If confidence dropped
      if (parseFloat(newConfidence) < parseFloat(initialConfidence)) {
        await expect(page.locator('.confidence-warning')).toBeVisible();
      }
    });
  });
}); 