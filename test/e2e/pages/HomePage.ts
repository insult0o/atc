import { Page, expect } from '@playwright/test';
import { BasePage } from './BasePage';
import { selectors, testPDFs } from '../fixtures/test-data';

export class HomePage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  /**
   * Upload a PDF file
   */
  async uploadPDF(pdfPath: string = testPDFs.simple) {
    // Wait for the upload zone to be visible
    await this.page.waitForSelector(selectors.uploadZone, { state: 'visible' });
    
    // Set file on the input element directly
    await this.page.setInputFiles(selectors.fileInput, pdfPath);
  }

  /**
   * Upload multiple PDFs
   */
  async uploadMultiplePDFs(pdfPaths: string[]) {
    // Wait for the upload zone to be visible
    await this.page.waitForSelector(selectors.uploadZone, { state: 'visible' });
    
    // Set files on the input element directly
    await this.page.setInputFiles(selectors.fileInput, pdfPaths);
  }

  /**
   * Wait for upload to complete
   */
  async waitForUploadComplete() {
    // Wait for processing tab to become enabled after upload
    await this.page.waitForTimeout(2000); // Give time for upload animation
    const processingTab = this.page.locator(selectors.processingTab);
    await expect(processingTab).toBeEnabled({ timeout: 10000 });
  }

  /**
   * Navigate to viewer with document
   */
  async openDocument(documentId: string) {
    await this.navigate(`/viewer/dual-pane?doc=${documentId}`);
  }

  /**
   * Check if upload zone is visible
   */
  async isUploadZoneVisible(): Promise<boolean> {
    return await this.isVisible(selectors.uploadZone);
  }

  /**
   * Get recent documents
   */
  async getRecentDocuments(): Promise<string[]> {
    // This feature might not exist in the current UI
    const documents = await this.page.locator('[class*="recent"]').all();
    const names: string[] = [];
    
    for (const doc of documents) {
      const name = await doc.textContent();
      if (name) names.push(name);
    }
    
    return names;
  }

  /**
   * Open recent document by name
   */
  async openRecentDocument(name: string) {
    await this.page.click(`[data-testid="recent-document"]:has-text("${name}")`);
  }

  /**
   * Check if error message is displayed
   */
  async hasErrorMessage(): Promise<boolean> {
    return await this.isVisible(selectors.errorMessage);
  }

  /**
   * Get error message text
   */
  async getErrorMessage(): Promise<string> {
    return await this.getElementText(selectors.errorMessage);
  }
}