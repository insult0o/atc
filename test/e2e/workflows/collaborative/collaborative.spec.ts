import { test, expect, Browser, Page, BrowserContext } from '@playwright/test';
import { HomePage } from '../../pages/HomePage';
import { ViewerPage } from '../../pages/ViewerPage';
import { testPDFs, mockUsers } from '../../fixtures/test-data';

test.describe('Collaborative Workflow', () => {
  let browser: Browser;
  let context1: BrowserContext;
  let context2: BrowserContext;
  let page1: Page;
  let page2: Page;
  let homePage1: HomePage;
  let homePage2: HomePage;
  let viewerPage1: ViewerPage;
  let viewerPage2: ViewerPage;

  test.beforeEach(async ({ browser: testBrowser }) => {
    browser = testBrowser;
    
    // Create two separate browser contexts (simulating two users)
    context1 = await browser.newContext();
    context2 = await browser.newContext();
    
    page1 = await context1.newPage();
    page2 = await context2.newPage();
    
    homePage1 = new HomePage(page1);
    homePage2 = new HomePage(page2);
    viewerPage1 = new ViewerPage(page1);
    viewerPage2 = new ViewerPage(page2);
  });

  test.afterEach(async () => {
    await context1.close();
    await context2.close();
  });

  test('should sync real-time updates between users', async () => {
    // User 1: Upload and process document
    await test.step('User 1 uploads document', async () => {
      await homePage1.navigate();
      await homePage1.uploadPDF(testPDFs.simple);
      await page1.waitForSelector('[data-testid="processing-complete"]');
      await viewerPage1.waitForViewerReady();
    });

    // Get document URL
    const documentUrl = page1.url();
    const docId = new URL(documentUrl).searchParams.get('doc');
    expect(docId).toBeTruthy();

    // User 2: Open same document
    await test.step('User 2 opens same document', async () => {
      await page2.goto(documentUrl);
      await viewerPage2.waitForViewerReady();
    });

    // User 1: Edit content
    await test.step('User 1 edits content', async () => {
      await viewerPage1.selectZone('zone-1');
      const updatedContent = 'User 1 has edited this content';
      await viewerPage1.editContent(updatedContent);
      await viewerPage1.saveChanges();
    });

    // User 2: Should see the update
    await test.step('User 2 sees update', async () => {
      // Wait for real-time sync
      await page2.waitForTimeout(1000);
      
      // Select same zone
      await viewerPage2.selectZone('zone-1');
      
      // Verify content is updated
      const content = await viewerPage2.getEditorContent();
      expect(content).toBe('User 1 has edited this content');
    });

    // User 2: Make another edit
    await test.step('User 2 edits different zone', async () => {
      await viewerPage2.selectZone('zone-2');
      await viewerPage2.editContent('User 2 has edited zone 2');
      await viewerPage2.saveChanges();
    });

    // User 1: Should see User 2's edit
    await test.step('User 1 sees User 2 update', async () => {
      await page1.waitForTimeout(1000);
      await viewerPage1.selectZone('zone-2');
      const content = await viewerPage1.getEditorContent();
      expect(content).toBe('User 2 has edited zone 2');
    });
  });

  test('should show active user indicators', async () => {
    // Both users open same document
    await homePage1.navigate();
    await homePage1.uploadPDF(testPDFs.simple);
    await page1.waitForSelector('[data-testid="processing-complete"]');
    const documentUrl = page1.url();
    
    await page2.goto(documentUrl);
    await viewerPage2.waitForViewerReady();

    // Check for active user indicators
    await test.step('Check user presence indicators', async () => {
      // User 1 should see User 2's presence
      await expect(page1.locator('[data-testid="active-users"]')).toContainText('2 users');
      
      // User 2 should see User 1's presence
      await expect(page2.locator('[data-testid="active-users"]')).toContainText('2 users');
    });

    // Show cursor positions
    await test.step('Show cursor positions', async () => {
      // User 1 selects a zone
      await viewerPage1.selectZone('zone-1');
      
      // User 2 should see User 1's selection indicator
      await expect(page2.locator('[data-testid="user-selection-indicator"]')).toBeVisible();
    });
  });

  test('should handle concurrent zone editing', async () => {
    // Setup: Both users on same document
    await homePage1.navigate();
    await homePage1.uploadPDF(testPDFs.complex);
    await page1.waitForSelector('[data-testid="processing-complete"]');
    const documentUrl = page1.url();
    await page2.goto(documentUrl);

    // Concurrent editing of different zones
    await test.step('Concurrent editing', async () => {
      // User 1 edits zone 1
      const edit1Promise = (async () => {
        await viewerPage1.selectZone('zone-1');
        await viewerPage1.editContent('User 1 concurrent edit');
        await viewerPage1.saveChanges();
      })();

      // User 2 edits zone 2 simultaneously
      const edit2Promise = (async () => {
        await viewerPage2.selectZone('zone-2');
        await viewerPage2.editContent('User 2 concurrent edit');
        await viewerPage2.saveChanges();
      })();

      // Wait for both edits to complete
      await Promise.all([edit1Promise, edit2Promise]);
    });

    // Verify both edits persisted
    await test.step('Verify both edits', async () => {
      await page1.waitForTimeout(1000);
      
      // Check zone 1
      await viewerPage1.selectZone('zone-1');
      const content1 = await viewerPage1.getEditorContent();
      expect(content1).toBe('User 1 concurrent edit');
      
      // Check zone 2
      await viewerPage1.selectZone('zone-2');
      const content2 = await viewerPage1.getEditorContent();
      expect(content2).toBe('User 2 concurrent edit');
    });
  });

  test('should handle conflict resolution', async () => {
    // Setup: Both users on same document
    await homePage1.navigate();
    await homePage1.uploadPDF(testPDFs.simple);
    await page1.waitForSelector('[data-testid="processing-complete"]');
    const documentUrl = page1.url();
    await page2.goto(documentUrl);

    // Both users try to edit same zone
    await test.step('Create edit conflict', async () => {
      // Both select same zone
      await viewerPage1.selectZone('zone-1');
      await viewerPage2.selectZone('zone-1');
      
      // User 1 starts editing
      await viewerPage1.editContent('User 1 version');
      
      // User 2 tries to edit simultaneously
      await viewerPage2.editContent('User 2 version');
      
      // User 1 saves first
      await viewerPage1.saveChanges();
      
      // User 2 tries to save
      await viewerPage2.saveChanges();
    });

    // Check conflict resolution
    await test.step('Verify conflict handling', async () => {
      // User 2 should see conflict warning
      await expect(page2.locator('[data-testid="conflict-warning"]')).toBeVisible();
      
      // Options should be available
      await expect(page2.locator('[data-testid="merge-changes"]')).toBeVisible();
      await expect(page2.locator('[data-testid="overwrite-changes"]')).toBeVisible();
      await expect(page2.locator('[data-testid="discard-changes"]')).toBeVisible();
    });
  });

  test('should track collaborative export history', async () => {
    // Setup document
    await homePage1.navigate();
    await homePage1.uploadPDF(testPDFs.simple);
    await page1.waitForSelector('[data-testid="processing-complete"]');
    const documentUrl = page1.url();
    await page2.goto(documentUrl);

    // User 1 performs export
    await test.step('User 1 exports', async () => {
      await viewerPage1.openExportDialog();
      await page1.click('[data-testid="quick-export-button"]');
      await page1.waitForSelector('[data-testid="export-complete"]');
    });

    // User 2 should see export in history
    await test.step('User 2 sees export history', async () => {
      await page2.click('[data-testid="export-history"]');
      await expect(page2.locator('[data-testid="export-history-list"]')).toContainText('User exported');
    });
  });

  test('should handle user disconnection gracefully', async () => {
    // Setup: Both users on same document
    await homePage1.navigate();
    await homePage1.uploadPDF(testPDFs.simple);
    await page1.waitForSelector('[data-testid="processing-complete"]');
    const documentUrl = page1.url();
    await page2.goto(documentUrl);
    
    // Verify both users connected
    await expect(page1.locator('[data-testid="active-users"]')).toContainText('2 users');

    // User 2 disconnects
    await test.step('User 2 disconnects', async () => {
      await context2.close();
      await page1.waitForTimeout(2000); // Wait for disconnect detection
    });

    // User 1 should see updated user count
    await test.step('User 1 sees disconnection', async () => {
      await expect(page1.locator('[data-testid="active-users"]')).toContainText('1 user');
      
      // Any unsaved changes from User 2 should be handled
      await expect(page1.locator('[data-testid="user-disconnected-notice"]')).toBeVisible();
    });
  });

  test('should support collaborative zone management', async () => {
    // Setup
    await homePage1.navigate();
    await homePage1.uploadPDF(testPDFs.complex);
    await page1.waitForSelector('[data-testid="processing-complete"]');
    const documentUrl = page1.url();
    await page2.goto(documentUrl);

    // User 1 merges zones
    await test.step('User 1 merges zones', async () => {
      await viewerPage1.selectMultipleZones(['zone-1', 'zone-2']);
      await viewerPage1.mergeZones();
    });

    // User 2 should see merged result
    await test.step('User 2 sees merge', async () => {
      await page2.waitForTimeout(1000);
      
      // Original zones should not exist
      await expect(page2.locator('[data-zone-id="zone-1"]')).not.toBeVisible();
      await expect(page2.locator('[data-zone-id="zone-2"]')).not.toBeVisible();
      
      // Merged zone should exist
      await expect(page2.locator('[data-zone-id*="merged"]')).toBeVisible();
    });

    // User 2 splits a zone
    await test.step('User 2 splits zone', async () => {
      const zoneToSplit = await page2.locator('[data-zone-id="zone-3"]');
      const box = await zoneToSplit.boundingBox();
      
      if (box) {
        await viewerPage2.splitZone('zone-3', {
          x: box.width / 2,
          y: box.height / 2,
        });
      }
    });

    // User 1 should see split result
    await test.step('User 1 sees split', async () => {
      await page1.waitForTimeout(1000);
      
      // Should see additional zones
      const zoneCount = await viewerPage1.getZoneCount();
      expect(zoneCount).toBeGreaterThan(expectedZones.complex.total - 1); // -1 for merge, +1 for split
    });
  });
});