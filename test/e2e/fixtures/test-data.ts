/**
 * Test data fixtures for E2E tests
 */

export const testPDFs = {
  simple: 'test/e2e/fixtures/pdfs/simple-text.pdf',
  complex: 'test/e2e/fixtures/pdfs/complex-tables.pdf',
  multiPage: 'test/e2e/fixtures/pdfs/multi-page.pdf',
  large: 'test/e2e/fixtures/pdfs/large-document.pdf',
  withImages: 'test/e2e/fixtures/pdfs/with-images.pdf',
  corrupted: 'test/e2e/fixtures/pdfs/corrupted.pdf',
};

export const expectedZones = {
  simple: {
    text: 5,
    table: 0,
    image: 0,
    diagram: 0,
    total: 5,
  },
  complex: {
    text: 10,
    table: 3,
    image: 2,
    diagram: 1,
    total: 16,
  },
  multiPage: {
    text: 15,
    table: 2,
    image: 4,
    diagram: 0,
    total: 21,
  },
};

export const mockUsers = {
  primary: {
    email: 'test.user@example.com',
    name: 'Test User',
  },
  collaborator: {
    email: 'collaborator@example.com',
    name: 'Collaborator User',
  },
};

export const exportConfigs = {
  ragDefault: {
    format: 'rag' as const,
    options: {
      maxTokens: 1000,
      overlap: 100,
      includeMeta: true,
    },
  },
  ragMinimal: {
    format: 'rag' as const,
    options: {
      maxTokens: 500,
      overlap: 50,
      includeMeta: false,
    },
  },
  jsonlDefault: {
    format: 'jsonl' as const,
    options: {
      includeMetadata: true,
      includeCoordinates: true,
      flattenStructure: false,
    },
  },
  correctionsDefault: {
    format: 'corrections' as const,
    options: {
      includeOriginal: true,
      trackChanges: true,
    },
  },
};

export const timeouts = {
  quickExtract: 180000, // 3 minutes
  detailedReview: 900000, // 15 minutes
  processing: 120000, // 2 minutes
  export: 60000, // 1 minute
  pageLoad: 30000, // 30 seconds
};

export const selectors = {
  // Upload
  uploadButton: 'text="Upload Document"',
  uploadZone: 'text=/Transform Your PDF|Drop your PDF here/',
  fileInput: 'input[type="file"]',
  uploadProgress: '[class*="Progress"]',
  
  // Processing
  processingStatus: 'text=/Processing.*Complete|Successfully Processed/',
  processingProgress: 'text=/Processing|Analyzing/',
  processingComplete: 'text=/Processing Complete|Intelligence Extracted/',
  processingTab: 'button:has-text("Processing")',
  
  // Viewer
  pdfViewer: 'iframe[title*="PDF"]',
  contentEditor: '.monaco-editor',
  monacoEditor: '.monaco-editor',
  
  // Zones
  zoneItem: '[class*="zone"]',
  zoneHighlight: '[class*="highlight"]',
  selectedZone: '[class*="selected"]',
  
  // Export
  exportButton: 'button:has-text("Export")',
  quickExportButton: 'button:has-text("Quick Export")',
  exportFormat: 'select[name="format"], [role="combobox"]',
  exportConfig: '[class*="export-config"]',
  downloadButton: 'button:has-text("Download")',
  
  // Validation
  validateButton: 'button:has-text("Validate")',
  validationStatus: 'text=/Validation.*Passed|Validation.*Failed/',
  validationErrors: '[role="alert"]',
  
  // Error handling
  errorMessage: '[role="alert"], [class*="error"]',
  retryButton: 'button:has-text("Retry")',
};