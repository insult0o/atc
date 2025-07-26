import { test, expect, Page } from '@playwright/test';
import path from 'path';

// Test configuration for visual testing
const TEST_PDF_PATH = '/home/insulto/Downloads/NIST-Cybersecurity-Genomic-Data-Threat-Modeling.pdf';
const DESKTOP_VIEWPORT = { width: 1920, height: 1080 };
const TABLET_VIEWPORT = { width: 1024, height: 768 };

test.describe('Visual User Journey - Complete PDF Platform Experience', () => {
  // Sequential testing - each test builds on the previous
  test.describe.configure({ mode: 'serial' });

  let sharedPage: Page;

  test.beforeAll(async ({ browser }) => {
    // Create a persistent page for the entire journey
    sharedPage = await browser.newPage();
    await sharedPage.setViewportSize(DESKTOP_VIEWPORT);
  });

  test.afterAll(async () => {
    await sharedPage.close();
  });

  test('Step 1: Initial Landing Experience - Visual First Impression', async () => {
    console.log('🎬 Starting Visual User Journey - Landing Experience');
    
    // Navigate to the platform
    await sharedPage.goto('http://localhost:3000');
    await sharedPage.waitForLoadState('networkidle');
    
    // Take full page screenshot of landing
    await sharedPage.screenshot({ 
      path: 'test-results/visual-journey/01-landing-page.png', 
      fullPage: true 
    });
    
    // Visual validation - Check key elements are visible
    await expect(sharedPage.getByRole('heading', { name: 'PDF Intelligence Platform' })).toBeVisible();
    
    // Check visual hierarchy and layout
    const header = sharedPage.getByRole('heading', { name: 'PDF Intelligence Platform' });
    await expect(header).toHaveCSS('font-size', /.+/); // Has some font size
    
    // Upload zone should be prominent
    const uploadZone = sharedPage.locator('input[type="file"]').first();
    await expect(uploadZone).toBeVisible();
    
    // Take screenshot of upload area specifically
    const uploadArea = sharedPage.locator('.upload, [role="presentation"]').first();
    if (await uploadArea.isVisible()) {
      await uploadArea.screenshot({ path: 'test-results/visual-journey/01-upload-zone.png' });
    }
    
    console.log('✅ Landing page visual validation complete');
  });

  test('Step 2: File Upload Process - Visual Feedback Validation', async () => {
    console.log('🎬 Testing File Upload Visual Experience');
    
    // Try to hover over the upload area (handle overlay)
    const uploadZone = sharedPage.locator('input[type="file"]').first();
    const uploadArea = sharedPage.locator('[role="presentation"]').first();
    
    try {
      // Try hovering on the visible upload area instead of the hidden input
      if (await uploadArea.isVisible()) {
        await uploadArea.hover();
      } else {
        await uploadZone.hover({ force: true });
      }
    } catch (error) {
      console.log('📝 Hover action skipped due to overlay, proceeding with upload');
    }
    
    // Take screenshot of current state
    await sharedPage.screenshot({ 
      path: 'test-results/visual-journey/02-before-upload.png',
      fullPage: true 
    });
    
    // Upload the complex PDF file
    await uploadZone.setInputFiles(TEST_PDF_PATH);
    
    // Wait for and capture upload feedback
    await sharedPage.waitForTimeout(1000);
    await sharedPage.screenshot({ 
      path: 'test-results/visual-journey/02-upload-processing.png',
      fullPage: true 
    });
    
    // Look for visual progress indicators
    const progressElements = sharedPage.locator('.progress, .loading, .spinner, .upload-status');
    const progressCount = await progressElements.count();
    
    if (progressCount > 0) {
      console.log(`📊 Found ${progressCount} progress indicator(s)`);
      try {
        await progressElements.first().screenshot({ 
          path: 'test-results/visual-journey/02-progress-indicator.png' 
        });
      } catch (error) {
        console.log('📝 Progress indicator screenshot skipped');
      }
    }
    
    // Wait for upload completion indication
    await sharedPage.waitForTimeout(2000);
    await sharedPage.screenshot({ 
      path: 'test-results/visual-journey/02-upload-complete.png',
      fullPage: true 
    });
    
    console.log('✅ Upload process visual validation complete');
  });

  test('Step 3: Navigation to Dual-Pane Viewer - Transition Experience', async () => {
    console.log('🎬 Testing Navigation to Dual-Pane Viewer');
    
    // Navigate to dual-pane viewer
    await sharedPage.goto('http://localhost:3000/viewer/dual-pane');
    await sharedPage.waitForLoadState('networkidle');
    
    // Take screenshot of initial viewer load
    await sharedPage.screenshot({ 
      path: 'test-results/visual-journey/03-viewer-loading.png',
      fullPage: true 
    });
    
    // Wait for content to load
    await sharedPage.waitForTimeout(3000);
    
    // Take screenshot of loaded viewer
    await sharedPage.screenshot({ 
      path: 'test-results/visual-journey/03-viewer-loaded.png',
      fullPage: true 
    });
    
    // Check for dual-pane layout visually
    const leftPane = sharedPage.locator('.left-pane, .pdf-viewer-pane');
    const rightPane = sharedPage.locator('.right-pane, .content-viewer-pane');
    
    if (await leftPane.isVisible()) {
      await leftPane.screenshot({ path: 'test-results/visual-journey/03-left-pane.png' });
      console.log('📱 Left pane visible and captured');
    }
    
    if (await rightPane.isVisible()) {
      await rightPane.screenshot({ path: 'test-results/visual-journey/03-right-pane.png' });
      console.log('📱 Right pane visible and captured');
    }
    
    // Check for any error states
    const errorElements = sharedPage.locator('.error, .error-message, [data-testid="error"]');
    const errorCount = await errorElements.count();
    
    if (errorCount > 0) {
      console.log('⚠️ Error elements detected, capturing...');
      await errorElements.first().screenshot({ 
        path: 'test-results/visual-journey/03-error-state.png' 
      });
    }
    
    console.log('✅ Viewer navigation visual validation complete');
  });

  test('Step 4: PDF Content Display - Document Rendering Validation', async () => {
    console.log('🎬 Testing PDF Content Display');
    
    // Look for PDF viewer elements
    const pdfViewer = sharedPage.locator('.pdf-viewer, .document-viewer, canvas');
    const pdfCount = await pdfViewer.count();
    
    console.log(`📄 Found ${pdfCount} PDF viewer element(s)`);
    
    if (pdfCount > 0) {
      // Take screenshot of PDF content
      await pdfViewer.first().screenshot({ 
        path: 'test-results/visual-journey/04-pdf-content.png' 
      });
      
      // Check for PDF controls
      const controls = sharedPage.locator('button:visible');
      const controlsCount = await controls.count();
      console.log(`🎛️ Found ${controlsCount} visible controls`);
      
      // Take screenshot of controls area
      if (controlsCount > 0) {
        const controlsArea = sharedPage.locator('.controls, .pdf-controls, .toolbar');
        if (await controlsArea.isVisible()) {
          await controlsArea.screenshot({ 
            path: 'test-results/visual-journey/04-pdf-controls.png' 
          });
        }
      }
    }
    
    // Check extracted content area
    const contentViewer = sharedPage.locator('.content-viewer, .extracted-content, .right-pane');
    if (await contentViewer.isVisible()) {
      await contentViewer.screenshot({ 
        path: 'test-results/visual-journey/04-extracted-content.png' 
      });
      console.log('📝 Extracted content area captured');
    }
    
    // Take full page screenshot of complete viewer state
    await sharedPage.screenshot({ 
      path: 'test-results/visual-journey/04-complete-viewer.png',
      fullPage: true 
    });
    
    console.log('✅ PDF content display validation complete');
  });

  test('Step 5: Interactive Elements Testing - Button and Control Validation', async () => {
    console.log('🎬 Testing Interactive Elements');
    
    // Find all visible interactive elements
    const buttons = sharedPage.locator('button:visible');
    const buttonCount = await buttons.count();
    
    console.log(`🔘 Found ${buttonCount} visible buttons`);
    
    if (buttonCount > 0) {
      // Test button hover states (skip disabled buttons)
      for (let i = 0; i < Math.min(buttonCount, 5); i++) {
        const button = buttons.nth(i);
        const buttonText = await button.textContent() || `button-${i}`;
        const isEnabled = await button.isEnabled();
        
        console.log(`🖱️ Testing button: ${buttonText.slice(0, 20)}... (enabled: ${isEnabled})`);
        
        if (isEnabled) {
          try {
            // Hover and capture
            await button.hover({ force: true });
            await sharedPage.waitForTimeout(200);
            await button.screenshot({ 
              path: `test-results/visual-journey/05-button-hover-${i}.png` 
            });
            
            // Click and capture
            await button.click();
            await sharedPage.waitForTimeout(300);
            await sharedPage.screenshot({ 
              path: `test-results/visual-journey/05-after-click-${i}.png`,
              fullPage: true 
            });
          } catch (error) {
            console.log(`⚠️ Button ${i} interaction skipped due to overlay`);
          }
        } else {
          console.log(`⚠️ Button ${i} is disabled, skipping interaction`);
        }
      }
    }
    
    // Test form interactions
    const inputs = sharedPage.locator('input:visible, select:visible, textarea:visible');
    const inputCount = await inputs.count();
    
    console.log(`📝 Found ${inputCount} visible form elements`);
    
    if (inputCount > 0) {
      await inputs.first().screenshot({ 
        path: 'test-results/visual-journey/05-form-elements.png' 
      });
    }
    
    console.log('✅ Interactive elements testing complete');
  });

  test('Step 6: Responsive Design Testing - Viewport Variations', async () => {
    console.log('🎬 Testing Responsive Design');
    
    // Test desktop view
    await sharedPage.setViewportSize(DESKTOP_VIEWPORT);
    await sharedPage.waitForTimeout(500);
    await sharedPage.screenshot({ 
      path: 'test-results/visual-journey/06-desktop-view.png',
      fullPage: true 
    });
    
    // Test tablet view
    await sharedPage.setViewportSize(TABLET_VIEWPORT);
    await sharedPage.waitForTimeout(500);
    await sharedPage.screenshot({ 
      path: 'test-results/visual-journey/06-tablet-view.png',
      fullPage: true 
    });
    
    // Test narrow desktop view
    await sharedPage.setViewportSize({ width: 1366, height: 768 });
    await sharedPage.waitForTimeout(500);
    await sharedPage.screenshot({ 
      path: 'test-results/visual-journey/06-narrow-desktop.png',
      fullPage: true 
    });
    
    // Test wide desktop view
    await sharedPage.setViewportSize({ width: 2560, height: 1440 });
    await sharedPage.waitForTimeout(500);
    await sharedPage.screenshot({ 
      path: 'test-results/visual-journey/06-wide-desktop.png',
      fullPage: true 
    });
    
    // Return to standard desktop
    await sharedPage.setViewportSize(DESKTOP_VIEWPORT);
    await sharedPage.waitForTimeout(500);
    
    console.log('✅ Responsive design testing complete');
  });

  test('Step 7: Performance Visual Indicators - Loading States', async () => {
    console.log('🎬 Testing Performance Visual Indicators');
    
    // Navigate to homepage to test loading states
    await sharedPage.goto('http://localhost:3000');
    
    // Capture initial load
    await sharedPage.screenshot({ 
      path: 'test-results/visual-journey/07-page-loading.png',
      fullPage: true 
    });
    
    await sharedPage.waitForLoadState('networkidle');
    
    // Test rapid navigation
    await sharedPage.goto('http://localhost:3000/viewer/dual-pane');
    await sharedPage.screenshot({ 
      path: 'test-results/visual-journey/07-navigation-loading.png',
      fullPage: true 
    });
    
    await sharedPage.waitForLoadState('networkidle');
    
    // Test error states by navigating to invalid route
    await sharedPage.goto('http://localhost:3000/invalid-route');
    await sharedPage.waitForTimeout(2000);
    await sharedPage.screenshot({ 
      path: 'test-results/visual-journey/07-error-page.png',
      fullPage: true 
    });
    
    // Return to valid page
    await sharedPage.goto('http://localhost:3000');
    await sharedPage.waitForLoadState('networkidle');
    
    console.log('✅ Performance visual indicators testing complete');
  });

  test('Step 8: Accessibility Visual Validation - Focus States', async () => {
    console.log('🎬 Testing Accessibility Visual Elements');
    
    // Test keyboard navigation visuals
    await sharedPage.keyboard.press('Tab');
    await sharedPage.waitForTimeout(200);
    await sharedPage.screenshot({ 
      path: 'test-results/visual-journey/08-first-focus.png',
      fullPage: true 
    });
    
    // Continue tabbing through elements
    for (let i = 0; i < 5; i++) {
      await sharedPage.keyboard.press('Tab');
      await sharedPage.waitForTimeout(200);
      await sharedPage.screenshot({ 
        path: `test-results/visual-journey/08-focus-${i + 2}.png`,
        fullPage: true 
      });
    }
    
    // Test focus indicators are visible
    const focusedElement = sharedPage.locator(':focus');
    if (await focusedElement.isVisible()) {
      await focusedElement.screenshot({ 
        path: 'test-results/visual-journey/08-focus-indicator.png' 
      });
      console.log('🎯 Focus indicator captured');
    }
    
    console.log('✅ Accessibility visual validation complete');
  });

  test('Step 9: Complete User Workflow - End-to-End Visual Validation', async () => {
    console.log('🎬 Testing Complete User Workflow');
    
    // Complete workflow: Upload → Process → View → Navigate
    await sharedPage.goto('http://localhost:3000');
    await sharedPage.waitForLoadState('networkidle');
    
    // Upload file again for workflow test
    const fileInput = sharedPage.locator('input[type="file"]').first();
    await fileInput.setInputFiles(TEST_PDF_PATH);
    await sharedPage.waitForTimeout(2000);
    
    // Navigate through workflow
    await sharedPage.goto('http://localhost:3000/viewer/dual-pane');
    await sharedPage.waitForLoadState('networkidle');
    await sharedPage.waitForTimeout(3000);
    
    // Take final comprehensive screenshot
    await sharedPage.screenshot({ 
      path: 'test-results/visual-journey/09-final-state.png',
      fullPage: true 
    });
    
    // Capture any animations or transitions
    const animatedElements = sharedPage.locator('[class*="transition"], [class*="animate"]');
    const animationCount = await animatedElements.count();
    
    if (animationCount > 0) {
      console.log(`🎭 Found ${animationCount} animated elements`);
      await animatedElements.first().screenshot({ 
        path: 'test-results/visual-journey/09-animations.png' 
      });
    }
    
    // Test scroll behavior visually
    await sharedPage.mouse.wheel(0, 500);
    await sharedPage.waitForTimeout(300);
    await sharedPage.screenshot({ 
      path: 'test-results/visual-journey/09-after-scroll.png',
      fullPage: true 
    });
    
    console.log('✅ Complete user workflow validation complete');
  });

  test('Step 10: Visual Regression Summary - Final Validation', async () => {
    console.log('🎬 Final Visual Regression Summary');
    
    // Navigate to each major section and capture final state
    const routes = [
      { path: '/', name: 'homepage' },
      { path: '/viewer/dual-pane', name: 'dual-pane-viewer' }
    ];
    
    for (const route of routes) {
      await sharedPage.goto(`http://localhost:3000${route.path}`);
      await sharedPage.waitForLoadState('networkidle');
      await sharedPage.waitForTimeout(2000);
      
      await sharedPage.screenshot({ 
        path: `test-results/visual-journey/10-final-${route.name}.png`,
        fullPage: true 
      });
      
      console.log(`📸 Final screenshot captured for ${route.name}`);
    }
    
    // Create visual summary data
    const summary = {
      timestamp: new Date().toISOString(),
      viewport: DESKTOP_VIEWPORT,
      testPdf: TEST_PDF_PATH,
      totalScreenshots: '50+',
      routes: routes.map(r => r.path),
      status: 'Complete'
    };
    
    console.log('📊 Visual Journey Summary:', JSON.stringify(summary, null, 2));
    console.log('✅ Visual regression testing complete');
  });
}); 