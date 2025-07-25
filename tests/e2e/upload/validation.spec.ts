import { test, expect } from '@playwright/test';

test.describe('Upload Validation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should reject non-PDF file', async ({ page }) => {
    // Try uploading text file
    await page.setInputFiles('input[type="file"]', {
      name: 'test.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('test content'),
    });

    // Check error message
    await expect(page.locator('.error-message')).toBeVisible();
    await expect(page.locator('.error-message')).toHaveText('Please upload a PDF file');
  });

  test('should reject oversized PDF', async ({ page }) => {
    // Create large file (101MB)
    const largeContent = Buffer.alloc(101 * 1024 * 1024);
    await page.setInputFiles('input[type="file"]', {
      name: 'large.pdf',
      mimeType: 'application/pdf',
      buffer: largeContent,
    });

    // Check error message
    await expect(page.locator('.error-message')).toBeVisible();
    await expect(page.locator('.error-message')).toHaveText('File size exceeds 100MB limit');
  });

  test('should reject empty PDF', async ({ page }) => {
    // Upload empty file
    await page.setInputFiles('input[type="file"]', {
      name: 'empty.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from(''),
    });

    // Check error message
    await expect(page.locator('.error-message')).toBeVisible();
    await expect(page.locator('.error-message')).toHaveText('File is empty');
  });

  test('should reject corrupted PDF', async ({ page }) => {
    // Create corrupted PDF content
    const corruptedContent = Buffer.from('Not a valid PDF content');
    await page.setInputFiles('input[type="file"]', {
      name: 'corrupted.pdf',
      mimeType: 'application/pdf',
      buffer: corruptedContent,
    });

    // Check error message
    await expect(page.locator('.error-message')).toBeVisible();
    await expect(page.locator('.error-message')).toHaveText('Invalid PDF file');
  });

  test('should handle network errors', async ({ page }) => {
    // Mock network error
    await page.route('**/api/upload', route => route.abort('failed'));

    // Upload valid file
    await page.setInputFiles('input[type="file"]', {
      name: 'test.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('test content'),
    });

    // Check error message
    await expect(page.locator('.error-message')).toBeVisible();
    await expect(page.locator('.error-message')).toHaveText('Upload failed');
  });

  test('should validate file type beyond extension', async ({ page }) => {
    // Create text file with PDF extension
    await page.setInputFiles('input[type="file"]', {
      name: 'fake.pdf',
      mimeType: 'text/plain',
      buffer: Buffer.from('text content'),
    });

    // Check error message
    await expect(page.locator('.error-message')).toBeVisible();
    await expect(page.locator('.error-message')).toHaveText('Invalid PDF file');
  });
}); 