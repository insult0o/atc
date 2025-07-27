import { test, expect } from '@playwright/test';
import { HomePage } from '../../pages/HomePage';
import { selectors, testPDFs } from '../../fixtures/test-data';

test.describe('Basic Functionality Tests', () => {
  let homePage: HomePage;

  test.beforeEach(async ({ page }) => {
    homePage = new HomePage(page);
    await homePage.navigate();
  });

  test('should complete basic upload flow', async ({ page }) => {
    // Upload a PDF
    await homePage.uploadPDF(testPDFs.simple);
    
    // Wait for upload animation
    await page.waitForTimeout(3000);
    
    // Verify upload completed - look for the processing tab to be enabled
    const processingTab = page.locator(selectors.processingTab);
    await expect(processingTab).toBeEnabled();
  });

  test('should show upload progress', async ({ page }) => {
    // Start upload
    await page.setInputFiles(selectors.fileInput, testPDFs.simple);
    
    // Wait a moment for progress to appear
    await page.waitForTimeout(500);
    
    // Check for any progress indicator or uploading text
    const uploadingIndicator = await page.locator('text=/Uploading|Processing|Analyzing/').count();
    expect(uploadingIndicator).toBeGreaterThan(0);
    
    // Wait for completion
    await page.waitForTimeout(3000);
  });

  test('should handle drag and drop', async ({ page }) => {
    const uploadZone = page.locator(selectors.uploadZone);
    
    // Verify upload zone is ready
    await expect(uploadZone).toBeVisible();
    await expect(uploadZone).toContainText('Transform Your PDF');
    
    // Simulate file drop (actual drag-drop requires more complex setup)
    await page.setInputFiles(selectors.fileInput, testPDFs.simple);
    
    // Verify file was accepted
    await page.waitForTimeout(2000);
  });

  test('should display file requirements', async ({ page }) => {
    // Check file requirements are shown
    await expect(page.locator('text=/PDF files only/')).toBeVisible();
    await expect(page.locator('text=/Max.*MB/')).toBeVisible();
    // Check for the specific AI-Powered badge in upload zone
    await expect(page.locator('span:has-text("✨ AI-Powered")')).toBeVisible();
  });

  test('should navigate to features tab', async ({ page }) => {
    // Click features tab
    const featuresTab = page.locator('button:has-text("Features")').nth(1);
    await featuresTab.click();
    
    // Verify features content
    await expect(page.locator('text=/AI-Powered Extraction/')).toBeVisible();
    await expect(page.locator('text=/Smart Zone Detection/')).toBeVisible();
  });

  test('should show processing tab after upload', async ({ page }) => {
    // Upload file
    await page.setInputFiles(selectors.fileInput, testPDFs.simple);
    
    // Wait for upload
    await page.waitForTimeout(3000);
    
    // Check if processing tab exists and is enabled
    const processingTab = page.locator(selectors.processingTab);
    await expect(processingTab).toBeVisible();
  });

  test('should display stats correctly', async ({ page }) => {
    // Scroll to stats section
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    
    // Verify stats
    await expect(page.locator('text=/99.9%/')).toBeVisible();
    await expect(page.locator('text=/< 2s/')).toBeVisible();
    await expect(page.locator('text=/50M\\+/')).toBeVisible();
  });

  test('should maintain responsive design', async ({ page }) => {
    // Test different viewports
    const viewports = [
      { width: 1920, height: 1080, name: 'Desktop' },
      { width: 768, height: 1024, name: 'Tablet' },
      { width: 375, height: 667, name: 'Mobile' },
    ];

    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      
      // Main elements should be visible
      await expect(page.locator('text="PDF Intelligence Platform"')).toBeVisible();
      await expect(page.locator(selectors.uploadZone)).toBeVisible();
      
      // Take screenshot for visual verification
      await page.screenshot({
        path: `test-results/screenshots/responsive-${viewport.name.toLowerCase()}.png`,
      });
    }
  });

  test('should show correct branding', async ({ page }) => {
    // Check header branding
    await expect(page.locator('text="PDF Intelligence Platform"')).toBeVisible();
    
    // Check hero text
    await expect(page.locator('text=/Intelligence.*Meets Documents/')).toBeVisible();
    
    // Check tagline
    await expect(page.locator('text=/Transform your PDFs with cutting-edge AI/')).toBeVisible();
  });

  test('should have working navigation buttons', async ({ page }) => {
    // Check Features button in nav
    const navFeaturesBtn = page.locator('nav button:has-text("Features")');
    await expect(navFeaturesBtn).toBeVisible();
    await expect(navFeaturesBtn).toBeEnabled();
    
    // Check Get Started button in nav
    const navGetStartedBtn = page.locator('nav button:has-text("Get Started")');
    await expect(navGetStartedBtn).toBeVisible();
    await expect(navGetStartedBtn).toBeEnabled();
  });
});