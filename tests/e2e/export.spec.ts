import { test, expect } from '@playwright/test';

test.describe('Export System', () => {
  test.beforeEach(async ({ page }) => {
    // Upload and process a test PDF
    await page.goto('/');
    const fileData = await page.evaluate(() => {
      const file = new File(['test'], 'test.pdf', { type: 'application/pdf' });
      return file;
    });
    await page.dispatchEvent('.dropzone', 'drop', {
      dataTransfer: {
        files: [fileData],
      },
    });
    await expect(page.locator('.zones-container')).toBeVisible();
  });

  test('should export in RAG JSON format', async ({ page }) => {
    // Open export dialog
    await page.click('.export-button');
    await expect(page.locator('.export-dialog')).toBeVisible();

    // Select RAG JSON format
    await page.click('.format-selector');
    await page.click('.format-option[data-value="rag_json"]');

    // Start export
    await page.click('.export-start-button');

    // Check progress
    await expect(page.locator('.export-progress')).toBeVisible();
    await expect(page.locator('.export-status')).toHaveText('Exporting...');

    // Verify completion
    await expect(page.locator('.export-complete')).toBeVisible();
    await expect(page.locator('.download-button')).toBeEnabled();

    // Verify file format
    const downloadPromise = page.waitForEvent('download');
    await page.click('.download-button');
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.json$/);
  });

  test('should export in fine-tune JSONL format', async ({ page }) => {
    await page.click('.export-button');
    await page.click('.format-selector');
    await page.click('.format-option[data-value="fine_tune_jsonl"]');
    await page.click('.export-start-button');

    await expect(page.locator('.export-complete')).toBeVisible();
    const downloadPromise = page.waitForEvent('download');
    await page.click('.download-button');
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.jsonl$/);
  });

  test('should support partial export', async ({ page }) => {
    await page.click('.export-button');

    // Select specific zones
    await page.click('.zone-selector');
    await page.click('.zone-option:nth-child(1)');
    await page.click('.zone-option:nth-child(3)');

    // Select page range
    await page.fill('.page-range-start', '1');
    await page.fill('.page-range-end', '3');

    await page.click('.export-start-button');
    await expect(page.locator('.export-complete')).toBeVisible();

    // Verify partial export
    const downloadPromise = page.waitForEvent('download');
    await page.click('.download-button');
    const download = await downloadPromise;
    
    // Check manifest includes only selected zones
    const manifest = JSON.parse(await download.createReadStream().toString());
    expect(manifest.zones.length).toBe(2);
    expect(manifest.pages).toEqual([1, 2, 3]);
  });

  test('should validate export data', async ({ page }) => {
    // Mock invalid zone data
    await page.evaluate(() => {
      window.localStorage.setItem('test_zone', JSON.stringify({
        id: 'invalid',
        content: null,
        confidence: -1
      }));
    });

    await page.click('.export-button');
    await page.click('.export-start-button');

    // Check validation error
    await expect(page.locator('.error-message')).toBeVisible();
    await expect(page.locator('.error-message')).toHaveText('Invalid zone data');
    await expect(page.locator('.error-details')).toContainText('confidence must be between 0 and 1');
  });

  test('should handle export errors', async ({ page }) => {
    // Mock network error
    await page.route('**/export', route => route.abort('failed'));

    await page.click('.export-button');
    await page.click('.export-start-button');

    // Check error handling
    await expect(page.locator('.error-message')).toBeVisible();
    await expect(page.locator('.error-message')).toHaveText('Export failed');
    await expect(page.locator('.retry-button')).toBeVisible();

    // Test retry
    await page.unroute('**/export');
    await page.click('.retry-button');
    await expect(page.locator('.export-complete')).toBeVisible();
  });

  test('should track export history', async ({ page }) => {
    // Perform multiple exports
    for (const format of ['rag_json', 'fine_tune_jsonl']) {
      await page.click('.export-button');
      await page.click('.format-selector');
      await page.click(`.format-option[data-value="${format}"]`);
      await page.click('.export-start-button');
      await expect(page.locator('.export-complete')).toBeVisible();
      await page.click('.close-button');
    }

    // Check history
    await page.click('.history-button');
    await expect(page.locator('.history-dialog')).toBeVisible();
    await expect(page.locator('.history-item')).toHaveCount(2);

    // Verify history details
    const items = await page.locator('.history-item').all();
    for (const [index, format] of ['fine_tune_jsonl', 'rag_json'].entries()) {
      const item = items[index];
      await expect(item.locator('.format')).toHaveText(format);
      await expect(item.locator('.status')).toHaveText('Completed');
      await expect(item.locator('.timestamp')).toBeVisible();
    }
  });
}); 