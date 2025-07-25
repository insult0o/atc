import { test, expect } from '@playwright/test';

test.describe('Dual-Pane Viewer', () => {
  test.beforeEach(async ({ page }) => {
    // Upload a test PDF and wait for processing
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

  test('should show PDF and extracted content side by side', async ({ page }) => {
    // Check viewer layout
    await expect(page.locator('.dual-pane-container')).toBeVisible();
    await expect(page.locator('.pdf-viewer')).toBeVisible();
    await expect(page.locator('.content-viewer')).toBeVisible();
  });

  test('should synchronize scrolling between panes', async ({ page }) => {
    // Scroll PDF viewer
    await page.locator('.pdf-viewer').evaluate(el => {
      el.scrollTop = 100;
    });

    // Check content viewer scroll position
    const contentScroll = await page.locator('.content-viewer').evaluate(el => el.scrollTop);
    expect(contentScroll).toBe(100);

    // Scroll content viewer
    await page.locator('.content-viewer').evaluate(el => {
      el.scrollTop = 200;
    });

    // Check PDF viewer scroll position
    const pdfScroll = await page.locator('.pdf-viewer').evaluate(el => el.scrollTop);
    expect(pdfScroll).toBe(200);
  });

  test('should highlight corresponding zones', async ({ page }) => {
    // Click zone in PDF viewer
    await page.click('.pdf-viewer .zone');

    // Check highlighting in both panes
    await expect(page.locator('.pdf-viewer .zone.highlighted')).toBeVisible();
    await expect(page.locator('.content-viewer .zone.highlighted')).toBeVisible();

    // Click zone in content viewer
    await page.click('.content-viewer .zone');

    // Check highlighting in both panes
    await expect(page.locator('.pdf-viewer .zone.highlighted')).toBeVisible();
    await expect(page.locator('.content-viewer .zone.highlighted')).toBeVisible();
  });

  test('should be responsive', async ({ page }) => {
    // Test desktop layout
    await page.setViewportSize({ width: 1920, height: 1080 });
    await expect(page.locator('.dual-pane-container')).toHaveClass(/desktop/);

    // Test tablet layout
    await page.setViewportSize({ width: 768, height: 1024 });
    await expect(page.locator('.dual-pane-container')).toHaveClass(/tablet/);

    // Test mobile layout
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(page.locator('.dual-pane-container')).toHaveClass(/mobile/);
  });

  test('should handle large documents smoothly', async ({ page }) => {
    // Create large document
    const fileData = await page.evaluate(() => {
      const largeContent = new Array(100).fill('page').join('\n'); // 100 pages
      const file = new File([largeContent], 'large.pdf', { type: 'application/pdf' });
      return file;
    });

    // Upload and wait for processing
    await page.dispatchEvent('.dropzone', 'drop', {
      dataTransfer: {
        files: [fileData],
      },
    });
    await expect(page.locator('.zones-container')).toBeVisible();

    // Test scrolling performance
    await page.locator('.pdf-viewer').evaluate(el => {
      el.scrollTop = el.scrollHeight;
    });

    // Check for smooth scroll
    await expect(page.locator('.pdf-viewer')).toHaveClass(/smooth-scroll/);
    await expect(page.locator('.content-viewer')).toHaveClass(/smooth-scroll/);
  });

  test('should handle zone selection', async ({ page }) => {
    // Select zone in PDF viewer
    await page.click('.pdf-viewer .zone', { button: 'right' });
    await expect(page.locator('.zone-context-menu')).toBeVisible();

    // Select multiple zones
    await page.keyboard.down('Control');
    await page.click('.pdf-viewer .zone:nth-child(2)');
    await page.click('.pdf-viewer .zone:nth-child(3)');
    await page.keyboard.up('Control');

    // Check multiple selection
    await expect(page.locator('.pdf-viewer .zone.selected')).toHaveCount(3);
    await expect(page.locator('.content-viewer .zone.selected')).toHaveCount(3);
  });
}); 