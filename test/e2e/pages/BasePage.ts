import { Page, Locator, expect } from '@playwright/test';
import { setupMockAPI } from '../fixtures/mock-setup';

export abstract class BasePage {
  constructor(protected page: Page) {}

  /**
   * Navigate to a specific path
   */
  async navigate(path: string = '/') {
    // Setup API mocks before navigation
    await setupMockAPI(this.page);
    await this.page.goto(path);
    await this.waitForPageLoad();
  }

  /**
   * Wait for page to be fully loaded
   */
  async waitForPageLoad() {
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Take a screenshot for visual comparison
   */
  async takeScreenshot(name: string) {
    return await this.page.screenshot({
      path: `test-results/screenshots/${name}.png`,
      fullPage: true,
    });
  }

  /**
   * Wait for element and return it
   */
  async waitForElement(selector: string): Promise<Locator> {
    const element = this.page.locator(selector);
    await element.waitFor({ state: 'visible' });
    return element;
  }

  /**
   * Check if element exists
   */
  async elementExists(selector: string): Promise<boolean> {
    const count = await this.page.locator(selector).count();
    return count > 0;
  }

  /**
   * Wait for text to appear
   */
  async waitForText(text: string, timeout: number = 30000) {
    await expect(this.page.getByText(text)).toBeVisible({ timeout });
  }

  /**
   * Click element with retry
   */
  async clickWithRetry(selector: string, retries: number = 3) {
    for (let i = 0; i < retries; i++) {
      try {
        await this.page.click(selector);
        return;
      } catch (error) {
        if (i === retries - 1) throw error;
        await this.page.waitForTimeout(1000);
      }
    }
  }

  /**
   * Fill input with retry
   */
  async fillWithRetry(selector: string, value: string, retries: number = 3) {
    for (let i = 0; i < retries; i++) {
      try {
        await this.page.fill(selector, value);
        return;
      } catch (error) {
        if (i === retries - 1) throw error;
        await this.page.waitForTimeout(1000);
      }
    }
  }

  /**
   * Wait for network idle
   */
  async waitForNetworkIdle() {
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Get element text
   */
  async getElementText(selector: string): Promise<string> {
    const element = await this.waitForElement(selector);
    return await element.textContent() || '';
  }

  /**
   * Check if element is visible
   */
  async isVisible(selector: string): Promise<boolean> {
    const element = this.page.locator(selector);
    return await element.isVisible();
  }

  /**
   * Wait for URL to match pattern
   */
  async waitForURL(pattern: string | RegExp) {
    await this.page.waitForURL(pattern);
  }

  /**
   * Get current URL
   */
  getURL(): string {
    return this.page.url();
  }

  /**
   * Reload page
   */
  async reload() {
    await this.page.reload();
    await this.waitForPageLoad();
  }
}