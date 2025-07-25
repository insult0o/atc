import { test, expect } from '@playwright/test';

test.describe('WebSocket Connection', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should establish WebSocket connection', async ({ page }) => {
    // Wait for WebSocket connection
    const wsPromise = page.waitForEvent('websocket');
    
    // Trigger connection (page load should do this)
    await page.reload();
    
    // Get WebSocket connection
    const ws = await wsPromise;
    
    // Verify connection URL
    expect(ws.url()).toContain('/api/ws');
  });

  test('should handle connection errors', async ({ page }) => {
    // Mock WebSocket failure
    await page.route('**/api/ws', route => route.abort());
    
    // Reload page to trigger connection
    await page.reload();
    
    // Check error message
    await expect(page.locator('.connection-error')).toBeVisible();
    await expect(page.locator('.connection-error')).toHaveText('WebSocket connection failed');
  });

  test('should attempt reconnection', async ({ page }) => {
    // Count connection attempts
    let connectionAttempts = 0;
    await page.route('**/api/ws', route => {
      connectionAttempts++;
      route.abort();
    });
    
    // Reload page to trigger connection
    await page.reload();
    
    // Wait for multiple reconnection attempts
    await page.waitForTimeout(5000);
    
    // Verify multiple attempts were made
    expect(connectionAttempts).toBeGreaterThan(1);
  });

  test('should handle clean disconnection', async ({ page }) => {
    // Wait for WebSocket connection
    const wsPromise = page.waitForEvent('websocket');
    await page.reload();
    const ws = await wsPromise;
    
    // Verify initial connection
    expect(ws.url()).toContain('/api/ws');
    
    // Navigate away to trigger disconnect
    await page.goto('/about');
    
    // Check disconnect status
    await expect(page.locator('.connection-status')).toHaveText('Disconnected');
  });

  test('should reconnect after temporary failure', async ({ page }) => {
    // Setup connection counter
    let connectionAttempts = 0;
    
    // Block first connection attempt
    await page.route('**/api/ws', route => {
      connectionAttempts++;
      if (connectionAttempts === 1) {
        route.abort();
      } else {
        route.continue();
      }
    });
    
    // Trigger connection
    await page.reload();
    
    // Wait for successful connection
    await expect(page.locator('.connection-status')).toHaveText('Connected');
    
    // Verify multiple attempts were made
    expect(connectionAttempts).toBeGreaterThan(1);
  });

  test('should maintain connection state', async ({ page }) => {
    // Wait for WebSocket connection
    const wsPromise = page.waitForEvent('websocket');
    await page.reload();
    const ws = await wsPromise;
    
    // Send test message through page
    await page.evaluate(() => {
      const ws = new WebSocket('ws://localhost:3000/api/ws');
      ws.onopen = () => {
        ws.send(JSON.stringify({
          type: 'test',
          data: 'hello'
        }));
      };
    });
    
    // Check message handling
    await expect(page.locator('.last-message')).toHaveText('hello');
  });
}); 