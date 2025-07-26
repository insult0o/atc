const fs = require('fs');

async function testEndpoints() {
  console.log('🔍 Testing PDF Intelligence Platform Features...\n');
  console.log('Server running at: http://localhost:3000');
  console.log('Please check the following URLs in your browser:');
  console.log('  - Main page: http://localhost:3000');
  console.log('  - Dual-pane viewer: http://localhost:3000/viewer/dual-pane');
  console.log('\n✨ Manual testing required!');
}

// Check implemented features
async function checkFeatures() {
  console.log('\n📋 Checking implemented features...\n');
  
  const features = {
    'Epic 2 - UI Components': {
      'DualPaneViewer': fs.existsSync('./app/components/viewer/DualPaneViewer.tsx'),
      'PDFViewer': fs.existsSync('./app/components/viewer/PDFViewer.tsx'),
      'ExtractedContentViewer': fs.existsSync('./app/components/viewer/ExtractedContentViewer.tsx'),
      'ZoneHighlighter': fs.existsSync('./app/components/viewer/ZoneHighlighter.tsx'),
      'ZoneSelector': fs.existsSync('./app/components/zones/ZoneSelector.tsx'),
      'ConfidenceIndicator': fs.existsSync('./app/components/confidence/StatusIndicator.tsx'),
      'SynchronizedScroll': fs.existsSync('./app/hooks/useSynchronizedScroll.ts')
    },
    'Epic 3 - Export System': {
      'ExportManager': fs.existsSync('./lib/export/manager.ts'),
      'RAGGenerator': fs.existsSync('./lib/export/generators/rag-generator.ts'),
      'JSONLGenerator': fs.existsSync('./lib/export/generators/jsonl-generator.ts'),
      'ValidationPanel': fs.existsSync('./app/components/export/ValidationPanel.tsx'),
      'SelectionPanel': fs.existsSync('./app/components/export/SelectionPanel.tsx'),
      'ExportLogger': fs.existsSync('./lib/export/logging/export-logger.ts')
    },
    'Epic 5 - Missing Features': {
      'FullTextExtractor': fs.existsSync('./lib/pdf-processing/full-text-extractor.ts'),
      'CrossHighlighting': fs.existsSync('./lib/highlighting/event-system.ts'),
      'PDFHighlighter': fs.existsSync('./app/components/viewer/PDFHighlighter.tsx'),
      'ContentHighlighter': fs.existsSync('./app/components/viewer/ContentHighlighter.tsx'),
      'RichTextEditor': fs.existsSync('./app/components/editor/RichTextEditor.tsx'),
      'LoadingOverlay': fs.existsSync('./app/components/feedback/LoadingOverlay.tsx'),
      'NotificationToast': fs.existsSync('./app/components/feedback/NotificationToast.tsx')
    }
  };
  
  for (const [epic, components] of Object.entries(features)) {
    console.log(`${epic}:`);
    let implemented = 0;
    let total = 0;
    
    for (const [component, exists] of Object.entries(components)) {
      console.log(`  ${exists ? '✅' : '❌'} ${component}`);
      if (exists) implemented++;
      total++;
    }
    
    console.log(`  📊 Progress: ${implemented}/${total} (${Math.round(implemented/total * 100)}%)\n`);
  }
}

// Run tests
async function main() {
  await checkFeatures();
  await testEndpoints();
}

main().catch(console.error);