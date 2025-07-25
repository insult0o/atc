import { test, expect } from '@playwright/test';
import { readFileSync } from 'fs';
import { join } from 'path';

test.describe('Upload Functionality', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should upload valid PDF via drag-drop', async ({ page }) => {
    // Create test PDF
    const testPdf = new File(['test content'], 'test.pdf', {
      type: 'application/pdf'
    });

    // Drop file
    await page.evaluate((testPdf) => {
      const dropEvent = new Event('drop', { bubbles: true });
      Object.defineProperty(dropEvent, 'dataTransfer', {
        value: {
          files: [testPdf],
        },
      });
      document.querySelector('.dropzone')?.dispatchEvent(dropEvent);
    }, testPdf);

    // Check upload progress
    await expect(page.locator('.upload-progress')).toBeVisible();
    await expect(page.locator('.upload-status')).toHaveText('Uploading...');

    // Verify completion
    await expect(page.locator('.upload-complete')).toBeVisible();
    await expect(page.locator('.error-message')).not.toBeVisible();
  });

  test('should upload valid PDF via file input', async ({ page }) => {
    // Use file input
    await page.setInputFiles('input[type="file"]', {
      name: 'test.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('test content'),
    });

    // Check upload progress
    await expect(page.locator('.upload-progress')).toBeVisible();
    await expect(page.locator('.upload-status')).toHaveText('Uploading...');

    // Verify completion
    await expect(page.locator('.upload-complete')).toBeVisible();
    await expect(page.locator('.error-message')).not.toBeVisible();
  });

  test('should reject multiple files', async ({ page }) => {
    // Try uploading multiple files
    await page.setInputFiles('input[type="file"]', [
      {
        name: 'test1.pdf',
        mimeType: 'application/pdf',
        buffer: Buffer.from('test content 1'),
      },
      {
        name: 'test2.pdf',
        mimeType: 'application/pdf',
        buffer: Buffer.from('test content 2'),
      },
    ]);

    // Check error message
    await expect(page.locator('.error-message')).toBeVisible();
    await expect(page.locator('.error-message')).toHaveText('Please upload a single file');
  });

  test('should cancel upload in progress', async ({ page }) => {
    // Create large file to ensure upload takes time
    const largeContent = Buffer.alloc(5 * 1024 * 1024); // 5MB
    await page.setInputFiles('input[type="file"]', {
      name: 'large.pdf',
      mimeType: 'application/pdf',
      buffer: largeContent,
    });

    // Wait for progress and click cancel
    await expect(page.locator('.upload-progress')).toBeVisible();
    await page.click('.cancel-button');

    // Verify cancellation
    await expect(page.locator('.upload-status')).toHaveText('Upload cancelled');
    await expect(page.locator('.upload-progress')).not.toBeVisible();
  });

  test('should retry failed upload', async ({ page }) => {
    // Mock network failure
    await page.route('**/api/upload', route => route.abort('failed'));

    // Upload file
    await page.setInputFiles('input[type="file"]', {
      name: 'test.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('test content'),
    });

    // Check error
    await expect(page.locator('.error-message')).toBeVisible();
    await expect(page.locator('.retry-button')).toBeVisible();

    // Remove network failure mock
    await page.unroute('**/api/upload');

    // Click retry
    await page.click('.retry-button');

    // Verify success
    await expect(page.locator('.upload-complete')).toBeVisible();
    await expect(page.locator('.error-message')).not.toBeVisible();
  });
}); 