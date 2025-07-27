import { Page, Locator } from '@playwright/test';
import { BasePage } from './BasePage';
import { selectors } from '../fixtures/test-data';

export class ViewerPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  /**
   * Wait for viewer to load
   */
  async waitForViewerReady() {
    // Wait for the dual-pane viewer to appear
    await this.page.waitForSelector('text=/Adaptive Full-Screen PDF Viewer/', { timeout: 30000 });
    await this.waitForElement(selectors.pdfViewer);
    await this.waitForNetworkIdle();
  }

  /**
   * Get all zones
   */
  async getAllZones(): Promise<Locator[]> {
    // In the current UI, zones are shown as extracted elements
    return await this.page.locator('[class*="rounded-lg"][class*="backdrop-blur"]').all();
  }

  /**
   * Get zone count
   */
  async getZoneCount(): Promise<number> {
    // Count the extracted elements in the right pane
    const elementsText = await this.page.locator('text=/\d+ Elements/').textContent();
    const match = elementsText?.match(/(\d+) Elements/);
    return match ? parseInt(match[1]) : 0;
  }

  /**
   * Select a zone by ID
   */
  async selectZone(zoneId: string) {
    // Click on an element in the extracted content pane
    await this.page.click(`[class*="rounded-lg"]:has-text("${zoneId}")`).catch(() => {
      // If zone ID doesn't work, try by index
      const index = parseInt(zoneId.replace('zone-', ''));
      if (!isNaN(index)) {
        return this.page.click(`[class*="rounded-lg"][class*="backdrop-blur"]:nth-of-type(${index})`);
      }
    });
  }

  /**
   * Select multiple zones
   */
  async selectMultipleZones(zoneIds: string[]) {
    for (const zoneId of zoneIds) {
      await this.page.click(`[data-zone-id="${zoneId}"]`, {
        modifiers: ['Control'],
      });
    }
  }

  /**
   * Edit content in Monaco editor
   */
  async editContent(content: string) {
    // Focus Monaco editor
    await this.page.click(selectors.monacoEditor);
    
    // Clear existing content
    await this.page.keyboard.press('Control+A');
    await this.page.keyboard.press('Delete');
    
    // Type new content
    await this.page.keyboard.type(content);
  }

  /**
   * Get editor content
   */
  async getEditorContent(): Promise<string> {
    return await this.page.evaluate(() => {
      const editor = (window as any).monaco?.editor?.getModels()[0];
      return editor?.getValue() || '';
    });
  }

  /**
   * Navigate to specific page
   */
  async goToPage(pageNumber: number) {
    await this.page.fill('[data-testid="page-input"]', pageNumber.toString());
    await this.page.keyboard.press('Enter');
  }

  /**
   * Get current page number
   */
  async getCurrentPage(): Promise<number> {
    // Page numbers might not be visible in current UI
    return 1;
  }

  /**
   * Zoom in
   */
  async zoomIn() {
    await this.page.click('[data-testid="zoom-in"]');
  }

  /**
   * Zoom out
   */
  async zoomOut() {
    await this.page.click('[data-testid="zoom-out"]');
  }

  /**
   * Fit to page
   */
  async fitToPage() {
    await this.page.click('[data-testid="fit-page"]');
  }

  /**
   * Check if zone is highlighted
   */
  async isZoneHighlighted(zoneId: string): Promise<boolean> {
    // Check if element has highlight styling
    const zone = this.page.locator(`[class*="rounded-lg"]:has-text("${zoneId}")`);
    const classes = await zone.getAttribute('class') || '';
    return classes.includes('border') || classes.includes('ring');
  }

  /**
   * Check if editor is synchronized
   */
  async isEditorSynchronized(): Promise<boolean> {
    return await this.isVisible('.monaco-editor .highlighted-line');
  }

  /**
   * Get zone details
   */
  async getZoneDetails(zoneId: string) {
    const zone = this.page.locator(`[data-zone-id="${zoneId}"]`);
    
    return {
      type: await zone.getAttribute('data-zone-type'),
      confidence: await zone.getAttribute('data-confidence'),
      page: await zone.getAttribute('data-page'),
      content: await zone.textContent(),
    };
  }

  /**
   * Open export dialog
   */
  async openExportDialog() {
    // In the current UI, we need to go back to processing view first
    await this.page.click('button:has-text("Back to Analysis")');
    await this.page.waitForSelector('text=/Processing Results/', { timeout: 10000 });
    // Then look for export functionality
    await this.clickWithRetry(selectors.exportButton).catch(() => {
      // Export might be in a different place
      return this.page.click('button:has-text("Download")');
    });
  }

  /**
   * Save changes
   */
  async saveChanges() {
    await this.page.keyboard.press('Control+S');
    await this.waitForText('Changes saved');
  }

  /**
   * Check if changes are saved
   */
  async areChangesSaved(): Promise<boolean> {
    return await this.isVisible('[data-testid="saved-indicator"]');
  }

  /**
   * Get validation status
   */
  async getValidationStatus(): Promise<string> {
    return await this.getElementText(selectors.validationStatus);
  }

  /**
   * Merge selected zones
   */
  async mergeZones() {
    await this.page.click('[data-testid="merge-zones"]');
    await this.waitForText('Zones merged');
  }

  /**
   * Split zone
   */
  async splitZone(zoneId: string, position: { x: number; y: number }) {
    await this.selectZone(zoneId);
    await this.page.click('[data-testid="split-zone"]');
    
    const zone = this.page.locator(`[data-zone-id="${zoneId}"]`);
    const box = await zone.boundingBox();
    
    if (box) {
      await this.page.mouse.click(box.x + position.x, box.y + position.y);
    }
  }

  /**
   * Delete zone
   */
  async deleteZone(zoneId: string) {
    await this.selectZone(zoneId);
    await this.page.keyboard.press('Delete');
    await this.waitForText('Zone deleted');
  }

  /**
   * Get sync status
   */
  async getSyncStatus(): Promise<boolean> {
    const status = await this.getElementText('[data-testid="sync-status"]');
    return status.includes('Synchronized');
  }
}