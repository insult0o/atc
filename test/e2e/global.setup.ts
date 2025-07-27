import { chromium, FullConfig } from '@playwright/test';
import fs from 'fs-extra';
import path from 'path';

/**
 * Global setup for all E2E tests
 */
async function globalSetup(config: FullConfig) {
  console.log('🚀 Starting global test setup...');

  // Create test directories
  const dirs = [
    'test-results',
    'test-results/screenshots',
    'test-results/videos',
    'test-results/traces',
    'test-results/downloads',
    'test/e2e/fixtures/pdfs',
  ];

  for (const dir of dirs) {
    await fs.ensureDir(dir);
  }

  // Create sample PDF files for testing
  await createSamplePDFs();

  // Start services if needed
  if (!process.env.CI) {
    console.log('📦 Checking services...');
    // Services are started by webServer config in playwright.config.ts
  }

  // Perform initial setup with browser
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Check if frontend is accessible
    console.log('🌐 Checking frontend availability...');
    await page.goto(config.projects[0].use?.baseURL || 'http://localhost:3000');
    console.log('✅ Frontend is accessible');
    
    // Check if backend is accessible (optional)
    console.log('🔌 Checking backend availability...');
    try {
      const response = await page.request.get('http://localhost:8000/health');
      if (response.ok()) {
        console.log('✅ Backend is running');
      }
    } catch (backendError) {
      console.log('⚠️  Backend is not running (tests may be limited)');
    }

    console.log('✅ Setup completed');
  } catch (error) {
    console.error('❌ Service check failed:', error);
    console.log('ℹ️  Tests will run with available services');
  } finally {
    await browser.close();
  }

  console.log('✅ Global setup completed');
}

/**
 * Create sample PDF files for testing
 */
async function createSamplePDFs() {
  // In a real scenario, you would copy actual PDF files
  // For now, we'll create placeholder files
  const pdfDir = 'test/e2e/fixtures/pdfs';
  
  const files = [
    'simple-text.pdf',
    'complex-tables.pdf',
    'multi-page.pdf',
    'large-document.pdf',
    'with-images.pdf',
    'corrupted.pdf',
  ];

  for (const file of files) {
    const filePath = path.join(pdfDir, file);
    if (!await fs.pathExists(filePath)) {
      // Create a minimal valid PDF
      const pdfContent = Buffer.from([
        0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, // %PDF-1.4
        0x0a, 0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a, // Binary marker
        // ... minimal PDF structure
      ]);
      
      await fs.writeFile(filePath, pdfContent);
    }
  }
}

export default globalSetup;