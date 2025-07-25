import { test, expect } from '@playwright/test';

test.describe('PDF Upload', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should upload PDF via drag and drop', async ({ page }) => {
    // Setup file drop
    const fileData = await page.evaluate(() => {
      const file = new File(['test'], 'test.pdf', { type: 'application/pdf' });
      return file;
    });

    // Drop file
    await page.dispatchEvent('.dropzone', 'drop', {
      dataTransfer: {
        files: [fileData],
      },
    });

    // Check upload progress
    await expect(page.locator('.upload-progress')).toBeVisible();
    await expect(page.locator('.upload-status')).toHaveText('Uploading...');

    // Wait for processing
    await expect(page.locator('.processing-status')).toBeVisible();
    await expect(page.locator('.processing-status')).toHaveText('Processing...');

    // Verify completion
    await expect(page.locator('.zones-container')).toBeVisible();
    await expect(page.locator('.zone')).toHaveCount(1);
  });

  test('should validate PDF format', async ({ page }) => {
    // Try uploading non-PDF
    const fileData = await page.evaluate(() => {
      const file = new File(['test'], 'test.txt', { type: 'text/plain' });
      return file;
    });

    await page.dispatchEvent('.dropzone', 'drop', {
      dataTransfer: {
        files: [fileData],
      },
    });

    // Check error message
    await expect(page.locator('.error-message')).toBeVisible();
    await expect(page.locator('.error-message')).toHaveText('Please upload a PDF file');
  });

  test('should handle large files', async ({ page }) => {
    // Create large file
    const fileData = await page.evaluate(() => {
      const largeContent = new Array(1024 * 1024 * 100).fill('a').join(''); // 100MB
      const file = new File([largeContent], 'large.pdf', { type: 'application/pdf' });
      return file;
    });

    await page.dispatchEvent('.dropzone', 'drop', {
      dataTransfer: {
        files: [fileData],
      },
    });

    // Check error message
    await expect(page.locator('.error-message')).toBeVisible();
    await expect(page.locator('.error-message')).toHaveText('File size exceeds 100MB limit');
  });

  test('should show upload progress', async ({ page }) => {
    const fileData = await page.evaluate(() => {
      const file = new File(['test'], 'test.pdf', { type: 'application/pdf' });
      return file;
    });

    await page.dispatchEvent('.dropzone', 'drop', {
      dataTransfer: {
        files: [fileData],
      },
    });

    // Check progress updates
    await expect(page.locator('.upload-progress')).toBeVisible();
    await expect(page.locator('.progress-bar')).toHaveAttribute('aria-valuenow', '0');
    await expect(page.locator('.progress-bar')).toHaveAttribute('aria-valuenow', '100');
  });

  test('should handle upload errors', async ({ page }) => {
    // Mock network error
    await page.route('**/upload', route => route.abort('failed'));

    const fileData = await page.evaluate(() => {
      const file = new File(['test'], 'test.pdf', { type: 'application/pdf' });
      return file;
    });

    await page.dispatchEvent('.dropzone', 'drop', {
      dataTransfer: {
        files: [fileData],
      },
    });

    // Check error handling
    await expect(page.locator('.error-message')).toBeVisible();
    await expect(page.locator('.error-message')).toHaveText('Upload failed. Please try again.');
    await expect(page.locator('.retry-button')).toBeVisible();
  });
}); 