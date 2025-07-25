import { test as base } from '@playwright/test';

export type TestData = {
  testPdf: {
    name: string;
    content: string;
    type: string;
  };
  zones: Array<{
    id: string;
    type: 'text' | 'table' | 'diagram';
    content: string;
    confidence: number;
    tool: string;
    page: number;
  }>;
};

export const test = base.extend<TestData>({
  testPdf: async ({}, use) => {
    await use({
      name: 'test.pdf',
      content: 'test content',
      type: 'application/pdf'
    });
  },
  zones: async ({}, use) => {
    await use([
      {
        id: 'zone1',
        type: 'text',
        content: 'Sample text content',
        confidence: 0.85,
        tool: 'unstructured',
        page: 1
      },
      {
        id: 'zone2',
        type: 'table',
        content: 'Sample table content',
        confidence: 0.75,
        tool: 'camelot',
        page: 1
      },
      {
        id: 'zone3',
        type: 'diagram',
        content: 'Sample diagram content',
        confidence: 0.65,
        tool: 'pymupdf',
        page: 2
      }
    ]);
  }
}); 