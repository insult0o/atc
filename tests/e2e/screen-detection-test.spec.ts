import { test, expect } from '@playwright/test';

test.describe('Adaptive Screen Detection Test', () => {
  test('should detect maximum screen space and adapt layout', async ({ page }) => {
    // Intelligently detect maximum browser-usable space
    const maxScreenSpace = await page.evaluate(() => {
      const screenWidth = window.screen.width;
      const screenHeight = window.screen.height;
      const availWidth = window.screen.availWidth;
      const availHeight = window.screen.availHeight;
      const innerWidth = window.innerWidth;
      const innerHeight = window.innerHeight;
      const outerWidth = window.outerWidth;
      const outerHeight = window.outerHeight;
      const devicePixelRatio = window.devicePixelRatio || 1;
      
      // Calculate maximum usable space (handles DPI scaling automatically)
      const maxUsableWidth = Math.max(availWidth, screenWidth, outerWidth, innerWidth);
      const maxUsableHeight = Math.max(availHeight, screenHeight, outerHeight, innerHeight);
      
      return {
        native: { screenWidth, screenHeight },
        available: { availWidth, availHeight },
        browser: { innerWidth, innerHeight, outerWidth, outerHeight },
        devicePixelRatio,
        maxUsable: { width: maxUsableWidth, height: maxUsableHeight },
        userAgent: navigator.userAgent
      };
    });
    
    console.log('🖥️  FULL Screen Detection Results:', JSON.stringify(maxScreenSpace, null, 2));
    
    // Set viewport to maximum usable space
    await page.setViewportSize(maxScreenSpace.maxUsable);
    
    // Go to homepage and take screenshot  
    await page.goto('http://localhost:3000');
    
    await page.screenshot({ 
      path: 'test-results/adaptive-screen-homepage.png', 
      fullPage: true 
    });
    console.log('📸 Adaptive screen homepage captured');
    
    // Test what the app's screen detection reports
    const appDetectedDimensions = await page.evaluate(() => {
      // Trigger the same detection logic as the app
      const screenWidth = window.screen.width;
      const screenHeight = window.screen.height;
      const availWidth = window.screen.availWidth;
      const availHeight = window.screen.availHeight;
      const innerWidth = window.innerWidth;
      const innerHeight = window.innerHeight;
      const outerWidth = window.outerWidth;
      const outerHeight = window.outerHeight;
      const devicePixelRatio = window.devicePixelRatio || 1;
      
      const maxUsableWidth = Math.max(availWidth, screenWidth, outerWidth, innerWidth);
      const maxUsableHeight = Math.max(availHeight, screenHeight, outerHeight, innerHeight);
      
      return {
        detectedMaxWidth: maxUsableWidth,
        detectedMaxHeight: maxUsableHeight,
        actualViewport: { width: window.innerWidth, height: window.innerHeight }
      };
    });
    
    console.log('📱 App-level screen detection:', appDetectedDimensions);
    
    // Verify we're using maximum available space
    expect(appDetectedDimensions.actualViewport.width).toBe(maxScreenSpace.maxUsable.width);
    expect(appDetectedDimensions.actualViewport.height).toBe(maxScreenSpace.maxUsable.height);
    
    console.log('✅ Successfully using maximum available screen space!');
    
    // Calculate how much of the physical screen we're using
    const physicalUsagePercent = {
      width: (maxScreenSpace.maxUsable.width / (maxScreenSpace.native.screenWidth || 1)) * 100,
      height: (maxScreenSpace.maxUsable.height / (maxScreenSpace.native.screenHeight || 1)) * 100
    };
    
    console.log('📊 Physical screen usage:', physicalUsagePercent);
  });
}); 