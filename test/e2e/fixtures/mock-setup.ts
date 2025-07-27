import { Page } from '@playwright/test';

export async function setupMockAPI(page: Page) {
  // Intercept API calls and provide mock responses
  
  // Mock upload endpoint
  await page.route('/api/upload', async (route) => {
    const request = route.request();
    const contentType = request.headers()['content-type'] || '';
    
    if (contentType.includes('multipart/form-data')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          documentId: `doc_${Date.now()}`,
          document: {
            id: `doc_${Date.now()}`,
            filename: 'test.pdf',
            size: 1024,
            created_at: new Date().toISOString(),
          },
          status: 'uploaded',
        }),
      });
    } else {
      await route.abort('failed');
    }
  });

  // Mock document file endpoint
  await page.route('/api/documents/*/file', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/pdf',
      body: Buffer.from('%PDF-1.4\n%fake pdf content'),
    });
  });

  // Mock processing status
  await page.route('**/api/v1/process/*/status', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'process_123',
        status: 'completed',
        progress: 100,
        strategy: 'hi_res',
        confidence_score: 0.95,
      }),
    });
  });

  // Mock zones endpoint
  await page.route('**/api/v1/documents/*/zones', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: 'zone_1',
          type: 'text',
          content: 'Sample text zone content',
          confidence: 0.98,
          page: 1,
        },
        {
          id: 'zone_2',
          type: 'table',
          content: 'Sample table zone content',
          confidence: 0.95,
          page: 1,
        },
        {
          id: 'zone_3',
          type: 'text',
          content: 'Another text zone',
          confidence: 0.97,
          page: 1,
        },
        {
          id: 'zone_4',
          type: 'image',
          content: 'Image description',
          confidence: 0.92,
          page: 2,
        },
        {
          id: 'zone_5',
          type: 'text',
          content: 'Final text zone',
          confidence: 0.96,
          page: 2,
        },
      ]),
    });
  });

  // Mock health endpoints
  await page.route('**/health', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'ok' }),
    });
  });

  // Mock high-performance processor endpoint
  await page.route('http://localhost:8001/process', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        strategy: 'hi_res_gpu',
        processing_time_seconds: 0.5,
        elements: [
          {
            type: 'Title',
            text: 'Document Title',
            confidence: 0.99,
          },
          {
            type: 'NarrativeText',
            text: 'This is the main content of the document.',
            confidence: 0.97,
          },
        ],
        total_elements: 2,
        quality_score: 0.98,
        cached: false,
        gpu_enabled: true,
        parallel_workers: 8,
      }),
    });
  });
}