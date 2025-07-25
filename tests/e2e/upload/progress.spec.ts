import { test, expect } from '@playwright/test';

test.describe('Upload Progress', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should show upload progress percentage', async ({ page }) => {
    // Create medium-sized file to ensure progress updates
    const content = Buffer.alloc(5 * 1024 * 1024); // 5MB
    await page.setInputFiles('input[type="file"]', {
      name: 'test.pdf',
      mimeType: 'application/pdf',
      buffer: content,
    });

    // Check initial progress
    await expect(page.locator('.upload-progress')).toBeVisible();
    await expect(page.locator('.progress-bar')).toHaveAttribute('aria-valuenow', '0');

    // Check progress updates
    await expect(page.locator('.progress-bar')).toHaveAttribute('aria-valuenow', /[1-9][0-9]*/);
    await expect(page.locator('.progress-bar')).toHaveAttribute('aria-valuenow', '100');
  });

  test('should update status messages', async ({ page }) => {
    await page.setInputFiles('input[type="file"]', {
      name: 'test.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('test content'),
    });

    // Check status sequence
    await expect(page.locator('.upload-status')).toHaveText('Preparing upload...');
    await expect(page.locator('.upload-status')).toHaveText('Uploading...');
    await expect(page.locator('.upload-status')).toHaveText('Processing...');
    await expect(page.locator('.upload-status')).toHaveText('Upload complete');
  });

  test('should handle upload completion', async ({ page }) => {
    await page.setInputFiles('input[type="file"]', {
      name: 'test.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('test content'),
    });

    // Check completion state
    await expect(page.locator('.upload-complete')).toBeVisible();
    await expect(page.locator('.success-message')).toBeVisible();
    await expect(page.locator('.upload-progress')).not.toBeVisible();
  });

  test('should handle upload failure', async ({ page }) => {
    // Mock network failure
    await page.route('**/api/upload', route => route.abort('failed'));

    await page.setInputFiles('input[type="file"]', {
      name: 'test.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('test content'),
    });

    // Check failure state
    await expect(page.locator('.error-message')).toBeVisible();
    await expect(page.locator('.retry-button')).toBeVisible();
    await expect(page.locator('.upload-progress')).not.toBeVisible();
  });

  test('should handle cancel functionality', async ({ page }) => {
    // Create large file to ensure upload takes time
    const largeContent = Buffer.alloc(10 * 1024 * 1024); // 10MB
    await page.setInputFiles('input[type="file"]', {
      name: 'large.pdf',
      mimeType: 'application/pdf',
      buffer: largeContent,
    });

    // Wait for upload to start
    await expect(page.locator('.upload-progress')).toBeVisible();
    await expect(page.locator('.upload-status')).toHaveText('Uploading...');

    // Cancel upload
    await page.click('.cancel-button');

    // Check cancellation state
    await expect(page.locator('.upload-status')).toHaveText('Upload cancelled');
    await expect(page.locator('.upload-progress')).not.toBeVisible();
    await expect(page.locator('.retry-button')).toBeVisible();
  });
}); 