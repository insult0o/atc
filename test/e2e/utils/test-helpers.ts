import { Page, Download } from '@playwright/test';
import fs from 'fs-extra';
import path from 'path';

/**
 * Test helper utilities
 */

/**
 * Wait for element with retry
 */
export async function waitForElementWithRetry(
  page: Page,
  selector: string,
  options = { timeout: 30000, retries: 3 }
) {
  for (let i = 0; i < options.retries; i++) {
    try {
      await page.waitForSelector(selector, { timeout: options.timeout });
      return;
    } catch (error) {
      if (i === options.retries - 1) throw error;
      await page.reload();
      await page.waitForTimeout(1000);
    }
  }
}

/**
 * Upload file and wait for processing
 */
export async function uploadAndProcess(
  page: Page,
  filePath: string,
  timeout = 120000
): Promise<string> {
  // Upload file
  await page.click('[data-testid="upload-button"]');
  await page.setInputFiles('input[type="file"]', filePath);
  
  // Wait for processing
  await page.waitForSelector('[data-testid="processing-complete"]', { timeout });
  
  // Get document ID from URL
  const url = page.url();
  const docId = new URL(url).searchParams.get('doc');
  
  return docId || '';
}

/**
 * Download and verify file
 */
export async function downloadAndVerify(
  download: Download,
  expectedFormat: string
): Promise<{
  filename: string;
  size: number;
  content: string;
}> {
  const filename = download.suggestedFilename();
  const downloadPath = await download.path();
  
  // Verify filename
  if (!filename.includes(expectedFormat)) {
    throw new Error(`Expected ${expectedFormat} file, got ${filename}`);
  }
  
  // Read file content
  const content = await fs.readFile(downloadPath!, 'utf-8');
  const stats = await fs.stat(downloadPath!);
  
  return {
    filename,
    size: stats.size,
    content,
  };
}

/**
 * Create sample PDF for testing
 */
export async function createSamplePDF(
  name: string,
  content: string = 'Sample PDF content'
): Promise<string> {
  const pdfPath = path.join('test/e2e/fixtures/pdfs', name);
  
  // Create minimal PDF structure
  const pdfContent = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 4 0 R >> >> /MediaBox [0 0 612 792] /Contents 5 0 R >>
endobj
4 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
5 0 obj
<< /Length ${content.length + 50} >>
stream
BT
/F1 12 Tf
50 750 Td
(${content}) Tj
ET
endstream
endobj
xref
0 6
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
0000000214 00000 n
0000000289 00000 n
trailer
<< /Size 6 /Root 1 0 R >>
startxref
${350 + content.length}
%%EOF`;

  await fs.ensureDir(path.dirname(pdfPath));
  await fs.writeFile(pdfPath, pdfContent);
  
  return pdfPath;
}

/**
 * Mock WebSocket connection for testing
 */
export async function mockWebSocketConnection(page: Page) {
  await page.evaluate(() => {
    // Override WebSocket constructor
    (window as any).MockWebSocket = class MockWebSocket {
      url: string;
      readyState: number = 1; // OPEN
      
      constructor(url: string) {
        this.url = url;
        setTimeout(() => this.onopen?.({} as Event), 100);
      }
      
      send(data: string) {
        // Echo back for testing
        setTimeout(() => {
          this.onmessage?.({ data } as MessageEvent);
        }, 50);
      }
      
      close() {
        this.readyState = 3; // CLOSED
        this.onclose?.({} as CloseEvent);
      }
      
      onopen?: (event: Event) => void;
      onmessage?: (event: MessageEvent) => void;
      onerror?: (event: Event) => void;
      onclose?: (event: CloseEvent) => void;
    };
    
    (window as any).WebSocket = (window as any).MockWebSocket;
  });
}

/**
 * Measure performance metrics
 */
export async function measurePerformance(
  page: Page,
  action: () => Promise<void>
): Promise<{
  duration: number;
  metrics: any;
}> {
  const startTime = Date.now();
  
  // Start collecting metrics
  await page.evaluate(() => {
    (window as any).performanceMarks = [];
    performance.mark('action-start');
  });
  
  // Perform action
  await action();
  
  // Collect metrics
  const endTime = Date.now();
  const metrics = await page.evaluate(() => {
    performance.mark('action-end');
    performance.measure('action-duration', 'action-start', 'action-end');
    
    return {
      marks: performance.getEntriesByType('mark'),
      measures: performance.getEntriesByType('measure'),
      navigation: performance.getEntriesByType('navigation')[0],
      resources: performance.getEntriesByType('resource').length,
    };
  });
  
  return {
    duration: endTime - startTime,
    metrics,
  };
}

/**
 * Check for console errors
 */
export function setupConsoleMonitoring(page: Page): {
  getErrors: () => string[];
  getWarnings: () => string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    } else if (msg.type() === 'warning') {
      warnings.push(msg.text());
    }
  });
  
  page.on('pageerror', error => {
    errors.push(error.message);
  });
  
  return {
    getErrors: () => errors,
    getWarnings: () => warnings,
  };
}

/**
 * Wait for network idle with timeout
 */
export async function waitForNetworkIdleWithTimeout(
  page: Page,
  timeout = 30000
): Promise<boolean> {
  try {
    await page.waitForLoadState('networkidle', { timeout });
    return true;
  } catch {
    return false;
  }
}

/**
 * Take screenshot with annotations
 */
export async function takeAnnotatedScreenshot(
  page: Page,
  name: string,
  annotations?: Array<{
    selector: string;
    text: string;
    color?: string;
  }>
) {
  // Add annotations if provided
  if (annotations) {
    await page.evaluate((annots) => {
      annots.forEach(({ selector, text, color = 'red' }) => {
        const element = document.querySelector(selector);
        if (element) {
          const rect = element.getBoundingClientRect();
          const annotation = document.createElement('div');
          annotation.style.position = 'absolute';
          annotation.style.left = `${rect.left}px`;
          annotation.style.top = `${rect.top - 30}px`;
          annotation.style.backgroundColor = color;
          annotation.style.color = 'white';
          annotation.style.padding = '4px 8px';
          annotation.style.borderRadius = '4px';
          annotation.style.fontSize = '12px';
          annotation.style.zIndex = '10000';
          annotation.textContent = text;
          document.body.appendChild(annotation);
        }
      });
    }, annotations);
  }
  
  // Take screenshot
  await page.screenshot({
    path: `test-results/screenshots/${name}.png`,
    fullPage: true,
  });
  
  // Remove annotations
  if (annotations) {
    await page.evaluate(() => {
      document.querySelectorAll('div[style*="position: absolute"]').forEach(el => {
        if (el.textContent && el.style.zIndex === '10000') {
          el.remove();
        }
      });
    });
  }
}

/**
 * Simulate slow network
 */
export async function simulateSlowNetwork(page: Page) {
  const client = await page.context().newCDPSession(page);
  await client.send('Network.enable');
  await client.send('Network.emulateNetworkConditions', {
    offline: false,
    downloadThroughput: 50 * 1024, // 50kb/s
    uploadThroughput: 20 * 1024, // 20kb/s
    latency: 500, // 500ms
  });
}

/**
 * Reset network conditions
 */
export async function resetNetworkConditions(page: Page) {
  const client = await page.context().newCDPSession(page);
  await client.send('Network.disable');
}