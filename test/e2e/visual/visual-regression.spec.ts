import { test, expect } from '@playwright/test';
import { HomePage } from '../pages/HomePage';
import { ViewerPage } from '../pages/ViewerPage';
import { testPDFs } from '../fixtures/test-data';

test.describe('Visual Regression Tests', () => {
  let homePage: HomePage;
  let viewerPage: ViewerPage;

  test.beforeEach(async ({ page }) => {
    homePage = new HomePage(page);
    viewerPage = new ViewerPage(page);
  });

  test('homepage layout', async ({ page }) => {
    await homePage.navigate();
    
    // Wait for animations to complete
    await page.waitForTimeout(1000);
    
    await expect(page).toHaveScreenshot('homepage.png', {
      fullPage: true,
      animations: 'disabled',
    });
  });

  test('upload interface', async ({ page }) => {
    await homePage.navigate();
    await page.click('[data-testid="upload-button"]');
    
    // Wait for upload modal
    await page.waitForSelector('[data-testid="upload-modal"]');
    
    await expect(page.locator('[data-testid="upload-modal"]')).toHaveScreenshot(
      'upload-modal.png'
    );
  });

  test('dual-pane viewer layout', async ({ page }) => {
    // Upload and process a document first
    await homePage.navigate();
    await homePage.uploadPDF(testPDFs.simple);
    await page.waitForSelector('[data-testid="processing-complete"]');
    await viewerPage.waitForViewerReady();
    
    // Take screenshot of viewer
    await expect(page).toHaveScreenshot('dual-pane-viewer.png', {
      fullPage: true,
      animations: 'disabled',
    });
  });

  test('PDF viewer with zones', async ({ page }) => {
    await homePage.navigate();
    await homePage.uploadPDF(testPDFs.simple);
    await page.waitForSelector('[data-testid="processing-complete"]');
    await viewerPage.waitForViewerReady();
    
    // Wait for PDF to render
    await page.waitForTimeout(2000);
    
    // Take screenshot of PDF viewer area only
    await expect(page.locator('[data-testid="pdf-viewer"]')).toHaveScreenshot(
      'pdf-viewer-zones.png'
    );
  });

  test('zone highlighting on hover', async ({ page }) => {
    await homePage.navigate();
    await homePage.uploadPDF(testPDFs.simple);
    await page.waitForSelector('[data-testid="processing-complete"]');
    await viewerPage.waitForViewerReady();
    
    // Hover over a zone
    await page.hover('[data-zone-id="zone-1"]');
    await page.waitForTimeout(500); // Wait for hover effect
    
    await expect(page.locator('[data-testid="pdf-viewer"]')).toHaveScreenshot(
      'zone-hover-highlight.png'
    );
  });

  test('zone selection state', async ({ page }) => {
    await homePage.navigate();
    await homePage.uploadPDF(testPDFs.simple);
    await page.waitForSelector('[data-testid="processing-complete"]');
    await viewerPage.waitForViewerReady();
    
    // Select a zone
    await viewerPage.selectZone('zone-1');
    await page.waitForTimeout(500); // Wait for selection animation
    
    await expect(page).toHaveScreenshot('zone-selected.png', {
      fullPage: true,
      animations: 'disabled',
    });
  });

  test('editor with highlighted content', async ({ page }) => {
    await homePage.navigate();
    await homePage.uploadPDF(testPDFs.simple);
    await page.waitForSelector('[data-testid="processing-complete"]');
    await viewerPage.waitForViewerReady();
    
    // Select a zone to trigger editor highlighting
    await viewerPage.selectZone('zone-1');
    await page.waitForTimeout(500);
    
    await expect(page.locator('[data-testid="content-editor"]')).toHaveScreenshot(
      'editor-highlighted.png'
    );
  });

  test('export dialog', async ({ page }) => {
    await homePage.navigate();
    await homePage.uploadPDF(testPDFs.simple);
    await page.waitForSelector('[data-testid="processing-complete"]');
    await viewerPage.waitForViewerReady();
    
    // Open export dialog
    await viewerPage.openExportDialog();
    
    await expect(page.locator('[data-testid="export-dialog"]')).toHaveScreenshot(
      'export-dialog.png'
    );
  });

  test('validation panel with warnings', async ({ page }) => {
    await homePage.navigate();
    await homePage.uploadPDF(testPDFs.complex);
    await page.waitForSelector('[data-testid="processing-complete"]');
    await viewerPage.waitForViewerReady();
    
    // Open export dialog
    await viewerPage.openExportDialog();
    
    // Trigger validation
    await page.click('[data-testid="validate-button"]');
    await page.waitForSelector('[data-testid="validation-panel"]');
    
    await expect(page.locator('[data-testid="validation-panel"]')).toHaveScreenshot(
      'validation-warnings.png'
    );
  });

  test('processing progress indicator', async ({ page }) => {
    await homePage.navigate();
    
    // Start upload to trigger processing
    await page.click('[data-testid="upload-button"]');
    await page.setInputFiles('input[type="file"]', testPDFs.large);
    
    // Capture processing state
    await page.waitForSelector('[data-testid="processing-progress"]', {
      timeout: 5000,
    });
    
    await expect(page.locator('[data-testid="processing-status"]')).toHaveScreenshot(
      'processing-progress.png'
    );
  });

  test('error state display', async ({ page }) => {
    await homePage.navigate();
    
    // Upload corrupted file to trigger error
    await homePage.uploadPDF(testPDFs.corrupted);
    
    // Wait for error message
    await page.waitForSelector('[data-testid="error-message"]');
    
    await expect(page.locator('[data-testid="error-container"]')).toHaveScreenshot(
      'error-state.png'
    );
  });

  test('mobile responsive view', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    await homePage.navigate();
    await page.waitForTimeout(1000);
    
    await expect(page).toHaveScreenshot('mobile-homepage.png', {
      fullPage: true,
    });
  });

  test('dark mode theme', async ({ page }) => {
    await homePage.navigate();
    
    // Toggle dark mode if available
    const darkModeToggle = page.locator('[data-testid="dark-mode-toggle"]');
    if (await darkModeToggle.isVisible()) {
      await darkModeToggle.click();
      await page.waitForTimeout(500); // Wait for theme transition
      
      await expect(page).toHaveScreenshot('dark-mode.png', {
        fullPage: true,
      });
    }
  });

  test('zone context menu', async ({ page }) => {
    await homePage.navigate();
    await homePage.uploadPDF(testPDFs.simple);
    await page.waitForSelector('[data-testid="processing-complete"]');
    await viewerPage.waitForViewerReady();
    
    // Right-click on a zone
    await page.click('[data-zone-id="zone-1"]', { button: 'right' });
    await page.waitForSelector('[data-testid="zone-context-menu"]');
    
    await expect(page.locator('[data-testid="zone-context-menu"]')).toHaveScreenshot(
      'zone-context-menu.png'
    );
  });

  test('synchronized scrolling indicator', async ({ page }) => {
    await homePage.navigate();
    await homePage.uploadPDF(testPDFs.multiPage);
    await page.waitForSelector('[data-testid="processing-complete"]');
    await viewerPage.waitForViewerReady();
    
    // Scroll in PDF viewer
    await page.locator('[data-testid="pdf-viewer"]').evaluate(el => {
      el.scrollTop = 200;
    });
    
    await page.waitForTimeout(500); // Wait for sync
    
    // Check sync indicator
    await expect(page.locator('[data-testid="sync-indicator"]')).toHaveScreenshot(
      'sync-indicator.png'
    );
  });
});