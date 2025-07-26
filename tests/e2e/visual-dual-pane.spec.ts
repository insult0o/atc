import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('Visual Dual-Pane Layout Testing', () => {
  test('should capture full dual-pane layout with screenshots', async ({ page, context }) => {
    // Intelligently detect maximum browser-usable space
    const maxScreenSpace = await page.evaluate(() => {
      const screenWidth = window.screen.width;
      const screenHeight = window.screen.height;
      const availWidth = window.screen.availWidth;
      const availHeight = window.screen.availHeight;
      const devicePixelRatio = window.devicePixelRatio || 1;
      
      // Calculate maximum usable space (handles DPI scaling automatically)
      const maxUsableWidth = Math.max(availWidth, screenWidth);
      const maxUsableHeight = Math.max(availHeight, screenHeight);
      
      return {
        native: { screenWidth, screenHeight },
        available: { availWidth, availHeight },
        devicePixelRatio,
        maxUsable: { width: maxUsableWidth, height: maxUsableHeight }
      };
    });
    
    console.log('🖥️  Intelligent screen space detection:', maxScreenSpace);
    
    // Set viewport to maximum usable space (adaptive to any DPI scaling)
    await page.setViewportSize(maxScreenSpace.maxUsable);
    
    // Start at the homepage
    await page.goto('http://localhost:3000');
    
    // Take initial screenshot
    await page.screenshot({ 
      path: 'test-results/01-homepage.png', 
      fullPage: true 
    });
    console.log('📸 Screenshot 1: Homepage taken');

    // Upload a PDF file
    const testPdfPath = path.join(process.cwd(), 'uploads', '1753543075254-test.pdf');
    
    // Wait for page to be fully loaded
    await page.waitForLoadState('networkidle');
    
    // Click upload zone and select file with better error handling
    try {
      const fileInput = page.locator('input[type="file"]').first();
      await fileInput.setInputFiles(testPdfPath);
    } catch (error) {
      console.log('Direct file input failed, trying dropzone approach...');
      // Alternative: trigger upload via dropzone click
      await page.click('[role="presentation"]');
      await page.setInputFiles('input[type="file"]', testPdfPath);
    }
    
    // Wait for upload to complete - use more specific selector
    await expect(page.locator('p:has-text("✅ Successfully Processed")')).toBeVisible({ timeout: 30000 });
    
    // Take screenshot after upload
    await page.screenshot({ 
      path: 'test-results/02-after-upload.png', 
      fullPage: true 
    });
    console.log('📸 Screenshot 2: After upload taken');

    // Click "View Detailed Analysis"
    await page.click('button:has-text("View Detailed Analysis")');
    await page.waitForTimeout(2000);
    
    // Take screenshot after analysis
    await page.screenshot({ 
      path: 'test-results/03-analysis-view.png', 
      fullPage: true 
    });
    console.log('📸 Screenshot 3: Analysis view taken');

    // Click "Open Dual-Pane Viewer"
    await page.click('button:has-text("Open Dual-Pane Viewer")');
    await page.waitForTimeout(3000);
    
    // Take screenshot of dual-pane view BEFORE full-screen
    await page.screenshot({ 
      path: 'test-results/04-dual-pane-windowed.png', 
      fullPage: true 
    });
    console.log('📸 Screenshot 4: Dual-pane windowed view taken');
    
    // Check if dual-pane container exists - wait a bit more for portal rendering
    await page.waitForTimeout(1000);
    const dualPaneContainer = page.locator('div[style*="position: fixed"], div.fixed.inset-0');
    await expect(dualPaneContainer).toBeVisible({ timeout: 10000 });
    console.log('✅ Dual-pane container found');
    
    // Request full-screen mode for maximum working area
    await page.evaluate(() => {
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen();
        console.log('🖥️ Full-screen mode requested');
      }
    });
    await page.waitForTimeout(3000); // Wait for full-screen transition
    
    // Take screenshot in full-screen mode
    await page.screenshot({ 
      path: 'test-results/05-dual-pane-fullscreen.png', 
      fullPage: false 
    });
    console.log('📸 Screenshot 5: Dual-pane FULL-SCREEN taken');
    
    // Take another full-page screenshot in full-screen
    await page.screenshot({ 
      path: 'test-results/06-dual-pane-fullscreen-full.png', 
      fullPage: true 
    });
    console.log('📸 Screenshot 6: Dual-pane full-screen full-page taken');
    
    // Get viewport and container dimensions in full-screen
    const viewportFullScreen = await page.viewportSize();
    const containerBoxFullScreen = await dualPaneContainer.boundingBox();
    
    console.log('🖥️  Full-screen viewport dimensions:', viewportFullScreen);
    console.log('📦 Full-screen container dimensions:', containerBoxFullScreen);
    
    // Check if we're actually in full-screen mode
    const isFullScreenActive = await page.evaluate(() => {
      return !!(document.fullscreenElement || document.webkitFullscreenElement);
    });
    console.log('🔍 Is full-screen active?', isFullScreenActive);
    
    // Verify full screen coverage
    if (containerBoxFullScreen) {
      console.log('✅ Full-screen container position:', {
        x: containerBoxFullScreen.x,
        y: containerBoxFullScreen.y, 
        width: containerBoxFullScreen.width,
        height: containerBoxFullScreen.height
      });
      
      // Should start at 0,0 and cover full viewport
      expect(containerBoxFullScreen.x).toBe(0);
      expect(containerBoxFullScreen.y).toBe(0);
      expect(containerBoxFullScreen.width).toBe(viewportFullScreen?.width || 0);
      expect(containerBoxFullScreen.height).toBe(viewportFullScreen?.height || 0);
    }
    
    // Get actual screen dimensions in full-screen
    const screenDimensions = await page.evaluate(() => ({
      screenWidth: window.screen.width,
      screenHeight: window.screen.height,
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight
    }));
    console.log('🖥️  Screen dimensions:', screenDimensions);

    // Take final layout debug screenshot
    await page.screenshot({ 
      path: 'test-results/07-fullscreen-layout-debug.png', 
      fullPage: true 
    });
    console.log('📸 Screenshot 7: Full-screen layout debug taken');
  });
}); 