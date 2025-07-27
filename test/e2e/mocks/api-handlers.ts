import { http, HttpResponse } from 'msw';

// Mock API handlers for testing
export const handlers = [
  // Upload endpoint
  http.post('/api/upload', async ({ request }) => {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return HttpResponse.json({ error: 'No file provided' }, { status: 400 });
    }
    
    // Simulate successful upload
    const documentId = `doc_${Date.now()}`;
    return HttpResponse.json({
      documentId,
      document: {
        id: documentId,
        filename: file.name,
        size: file.size,
        created_at: new Date().toISOString(),
      },
      status: 'uploaded',
    });
  }),

  // Document file endpoint
  http.get('/api/documents/:id/file', ({ params }) => {
    // Return a mock PDF response
    return new HttpResponse(null, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
      },
    });
  }),

  // Processing status endpoint
  http.get('/api/v1/process/:id/status', ({ params }) => {
    return HttpResponse.json({
      id: params.id,
      status: 'completed',
      progress: 100,
      strategy: 'hi_res',
      confidence_score: 0.95,
    });
  }),

  // Zones endpoint
  http.get('/api/v1/documents/:id/zones', ({ params }) => {
    return HttpResponse.json([
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
    ]);
  }),

  // Health check endpoint
  http.get('/health', () => {
    return HttpResponse.json({ status: 'ok' });
  }),

  // Backend health check
  http.get('http://localhost:8000/health', () => {
    return HttpResponse.json({ status: 'ok' });
  }),
];