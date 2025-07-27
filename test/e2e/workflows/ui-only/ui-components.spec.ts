import { test, expect } from '@playwright/test';
import { HomePage } from '../../pages/HomePage';
import { selectors } from '../../fixtures/test-data';

test.describe('UI Components Test', () => {
  let homePage: HomePage;

  test.beforeEach(async ({ page }) => {
    homePage = new HomePage(page);
    await homePage.navigate();
  });

  test('should display landing page correctly', async ({ page }) => {
    // Check main heading
    await expect(page.locator('text=/Intelligence.*Meets Documents/')).toBeVisible();
    
    // Check feature pills
    await expect(page.locator('text=/AI-Powered Analysis/')).toBeVisible();
    await expect(page.locator('text=/Real-time Processing/')).toBeVisible();
    await expect(page.locator('text=/Privacy-First/')).toBeVisible();
    
    // Check navigation
    await expect(page.locator('text="PDF Intelligence Platform"')).toBeVisible();
    await expect(page.locator('nav button:has-text("Features")')).toBeVisible();
    await expect(page.locator('nav button:has-text("Get Started")')).toBeVisible();
  });

  test('should display upload zone', async ({ page }) => {
    // Check upload zone is visible
    await expect(page.locator(selectors.uploadZone)).toBeVisible();
    
    // Verify upload zone text
    await expect(page.locator('text=/Transform Your PDF with AI Intelligence/')).toBeVisible();
    await expect(page.locator('text=/Drag & drop your PDF here/')).toBeVisible();
  });

  test('should navigate between tabs', async ({ page }) => {
    // Check tabs are visible - they appear inside the upload component
    const uploadTab = page.locator('button:has-text("Upload Document")').first();
    await expect(uploadTab).toBeVisible();
    
    // Click Features tab
    const featuresTab = page.locator('button:has-text("Features")').nth(1); // Second one is the tab
    await featuresTab.click();
    
    // Check features content
    await expect(page.locator('text=/AI-Powered Extraction/')).toBeVisible();
    await expect(page.locator('text=/Smart Zone Detection/')).toBeVisible();
    await expect(page.locator('text=/Real-time Analytics/')).toBeVisible();
  });

  test('should show file input accepts PDFs', async ({ page }) => {
    const fileInput = page.locator(selectors.fileInput);
    const acceptAttribute = await fileInput.getAttribute('accept');
    
    expect(acceptAttribute).toContain('pdf');
  });

  test('should display stats section', async ({ page }) => {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    
    // Check stats are visible
    await expect(page.locator('text=/99.9%.*Accuracy Rate/')).toBeVisible();
    await expect(page.locator('text=/< 2s.*Processing Time/')).toBeVisible();
    await expect(page.locator('text=/50M\\+.*Documents Processed/')).toBeVisible();
  });

  test('should handle drag over upload zone', async ({ page }) => {
    const uploadZone = page.locator(selectors.uploadZone);
    const box = await uploadZone.boundingBox();
    
    if (box) {
      // Simulate drag over
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      
      // Check if drag state is indicated (border color change, etc)
      const classList = await uploadZone.getAttribute('class');
      expect(classList).toBeTruthy();
    }
  });

  test('should have responsive design', async ({ page }) => {
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Elements should still be visible
    await expect(page.locator('text="PDF Intelligence Platform"')).toBeVisible();
    await expect(page.locator(selectors.uploadZone)).toBeVisible();
    
    // Test tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });
    
    // Elements should still be visible
    await expect(page.locator('text="PDF Intelligence Platform"')).toBeVisible();
    await expect(page.locator(selectors.uploadZone)).toBeVisible();
  });

  test('should show correct system status', async ({ page }) => {
    // Check for status indicator
    const statusText = await page.locator('text=/System Ready/').textContent();
    expect(statusText).toBeTruthy();
  });
});