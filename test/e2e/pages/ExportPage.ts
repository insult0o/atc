import { Page } from '@playwright/test';
import { BasePage } from './BasePage';
import { selectors, exportConfigs } from '../fixtures/test-data';

export class ExportPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  /**
   * Select export format
   */
  async selectFormat(format: 'rag' | 'jsonl' | 'corrections' | 'manifest') {
    await this.page.selectOption(selectors.exportFormat, format);
  }

  /**
   * Configure RAG export
   */
  async configureRAGExport(options: {
    maxTokens?: number;
    overlap?: number;
    includeMeta?: boolean;
  }) {
    if (options.maxTokens !== undefined) {
      await this.page.fill('[data-testid="max-tokens"]', options.maxTokens.toString());
    }
    
    if (options.overlap !== undefined) {
      await this.page.fill('[data-testid="overlap"]', options.overlap.toString());
    }
    
    if (options.includeMeta !== undefined) {
      const checkbox = this.page.locator('[data-testid="include-meta"]');
      const isChecked = await checkbox.isChecked();
      
      if (isChecked !== options.includeMeta) {
        await checkbox.click();
      }
    }
  }

  /**
   * Configure JSONL export
   */
  async configureJSONLExport(options: {
    includeMetadata?: boolean;
    includeCoordinates?: boolean;
    flattenStructure?: boolean;
  }) {
    if (options.includeMetadata !== undefined) {
      const checkbox = this.page.locator('[data-testid="include-metadata"]');
      const isChecked = await checkbox.isChecked();
      
      if (isChecked !== options.includeMetadata) {
        await checkbox.click();
      }
    }
    
    if (options.includeCoordinates !== undefined) {
      const checkbox = this.page.locator('[data-testid="include-coordinates"]');
      const isChecked = await checkbox.isChecked();
      
      if (isChecked !== options.includeCoordinates) {
        await checkbox.click();
      }
    }
    
    if (options.flattenStructure !== undefined) {
      const checkbox = this.page.locator('[data-testid="flatten-structure"]');
      const isChecked = await checkbox.isChecked();
      
      if (isChecked !== options.flattenStructure) {
        await checkbox.click();
      }
    }
  }

  /**
   * Start export
   */
  async startExport() {
    await this.clickWithRetry('[data-testid="start-export"]');
  }

  /**
   * Wait for export to complete
   */
  async waitForExportComplete(timeout: number = 60000) {
    await this.page.waitForSelector('[data-testid="export-complete"]', { timeout });
  }

  /**
   * Download exported file
   */
  async downloadExport() {
    const downloadPromise = this.page.waitForEvent('download');
    await this.clickWithRetry(selectors.downloadButton);
    const download = await downloadPromise;
    
    return {
      filename: download.suggestedFilename(),
      path: await download.path(),
      download,
    };
  }

  /**
   * Get export progress
   */
  async getExportProgress(): Promise<number> {
    const progressText = await this.getElementText('[data-testid="export-progress"]');
    const match = progressText.match(/(\d+)%/);
    return match ? parseInt(match[1]) : 0;
  }

  /**
   * Check if validation passed
   */
  async isValidationPassed(): Promise<boolean> {
    const status = await this.getElementText(selectors.validationStatus);
    return status.toLowerCase().includes('passed') || status.toLowerCase().includes('valid');
  }

  /**
   * Get validation errors
   */
  async getValidationErrors(): Promise<string[]> {
    const errors = await this.page.locator(selectors.validationErrors).all();
    const errorTexts: string[] = [];
    
    for (const error of errors) {
      const text = await error.textContent();
      if (text) errorTexts.push(text);
    }
    
    return errorTexts;
  }

  /**
   * Override validation
   */
  async overrideValidation(reason: string) {
    await this.clickWithRetry('[data-testid="override-validation"]');
    await this.page.fill('[data-testid="override-reason"]', reason);
    await this.clickWithRetry('[data-testid="confirm-override"]');
  }

  /**
   * Quick export with default settings
   */
  async quickExport(format: 'rag' | 'jsonl' | 'corrections' = 'rag') {
    await this.clickWithRetry(selectors.quickExportButton);
    await this.selectFormat(format);
    await this.startExport();
    await this.waitForExportComplete();
    return await this.downloadExport();
  }

  /**
   * Get export statistics
   */
  async getExportStats() {
    return {
      zonesSelected: await this.getElementText('[data-testid="zones-selected"]'),
      estimatedSize: await this.getElementText('[data-testid="estimated-size"]'),
      exportTime: await this.getElementText('[data-testid="export-time"]'),
      tokenCount: await this.getElementText('[data-testid="token-count"]'),
    };
  }

  /**
   * Cancel export
   */
  async cancelExport() {
    await this.clickWithRetry('[data-testid="cancel-export"]');
    await this.waitForText('Export cancelled');
  }

  /**
   * Check if export can be retried
   */
  async canRetryExport(): Promise<boolean> {
    return await this.isVisible('[data-testid="retry-export"]');
  }

  /**
   * Retry failed export
   */
  async retryExport() {
    await this.clickWithRetry('[data-testid="retry-export"]');
  }

  /**
   * Save export configuration as preset
   */
  async saveAsPreset(name: string) {
    await this.clickWithRetry('[data-testid="save-preset"]');
    await this.page.fill('[data-testid="preset-name"]', name);
    await this.clickWithRetry('[data-testid="confirm-save-preset"]');
  }

  /**
   * Load export preset
   */
  async loadPreset(name: string) {
    await this.clickWithRetry('[data-testid="load-preset"]');
    await this.page.click(`[data-testid="preset-${name}"]`);
  }
}