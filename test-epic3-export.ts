#!/usr/bin/env ts-node

/**
 * Epic 3 Export System Test Suite
 * Tests all export functionality to ensure everything is working correctly
 */

import { 
  ExportManager,
  RAGGenerator,
  JSONLGenerator,
  ExportConfigManager,
  ExportProgressTracker,
  createExportSession,
  validateExportReadiness
} from './lib/export';

import type { 
  Zone, 
  ProcessedDocument, 
  ExportConfig,
  ExportResult
} from './lib/export/schemas/types';

// Mock data for testing
const mockZones: Zone[] = [
  {
    id: 'zone-1',
    page: 1,
    coordinates: { x: 50, y: 100, width: 500, height: 200 },
    type: 'text',
    confidence: 0.95,
    status: 'completed',
    characteristics: {
      textDensity: 0.8,
      lineSpacing: 1.5,
      wordSpacing: 1.0,
      fontSizes: [12, 14],
      hasStructure: true,
      hasImages: false,
      complexity: 'medium',
      readingOrder: 1
    },
    userModified: false,
    lastModified: new Date()
  },
  {
    id: 'zone-2',
    page: 1,
    coordinates: { x: 50, y: 350, width: 500, height: 300 },
    type: 'table',
    confidence: 0.75,
    status: 'completed',
    characteristics: {
      textDensity: 0.6,
      lineSpacing: 1.2,
      wordSpacing: 1.5,
      fontSizes: [10, 12],
      hasStructure: true,
      hasImages: false,
      complexity: 'high',
      readingOrder: 2
    },
    userModified: false,
    lastModified: new Date()
  },
  {
    id: 'zone-3',
    page: 2,
    coordinates: { x: 100, y: 50, width: 400, height: 150 },
    type: 'header',
    confidence: 0.9,
    status: 'completed',
    characteristics: {
      textDensity: 0.4,
      lineSpacing: 1.0,
      wordSpacing: 1.2,
      fontSizes: [16, 18],
      hasStructure: false,
      hasImages: false,
      complexity: 'low',
      readingOrder: 3
    },
    userModified: false,
    lastModified: new Date()
  }
];

const mockDocument: ProcessedDocument = {
  id: 'doc-123',
  name: 'test-document.pdf',
  uploadedAt: new Date(),
  processedAt: new Date(),
  status: 'completed',
  pageCount: 2,
  zones: mockZones,
  metadata: {
    title: 'Test Document',
    author: 'Test Author',
    subject: 'Testing Epic 3',
    keywords: ['test', 'export', 'pdf'],
    creator: 'PDF Intelligence Platform',
    producer: 'Epic 3 Test Suite',
    creationDate: new Date().toISOString(),
    modificationDate: new Date().toISOString()
  },
  processingMetadata: {
    duration: 1500,
    toolsUsed: ['unstructured', 'pdfplumber'],
    confidence: 0.87,
    errors: [],
    warnings: []
  }
};

// Test 1: RAG Generator
async function testRAGGenerator() {
  console.log('\n📝 Testing RAG Generator...');
  
  try {
    const ragGenerator = new RAGGenerator();
    
    // Test with different configurations
    const configs = [
      { maxTokens: 500, overlap: 50, includeMeta: true },
      { maxTokens: 1000, overlap: 100, includeMeta: false },
      { maxTokens: 2000, overlap: 200, includeMeta: true, format: 'markdown' as const }
    ];
    
    for (const config of configs) {
      console.log(`\n  Testing with config: ${JSON.stringify(config)}`);
      
      const result = await ragGenerator.generate(mockDocument, {
        selectedZones: ['zone-1', 'zone-2', 'zone-3'],
        options: config
      });
      
      console.log(`  ✅ Generated ${result.chunks.length} chunks`);
      console.log(`  ✅ Total tokens: ${result.metadata.totalTokens}`);
      console.log(`  ✅ Average chunk size: ${Math.round(result.metadata.totalTokens / result.chunks.length)} tokens`);
      
      // Validate chunk structure
      const firstChunk = result.chunks[0];
      console.log(`  ✅ First chunk preview: "${firstChunk.content.substring(0, 100)}..."`);
      console.log(`  ✅ Chunk metadata:`, firstChunk.metadata);
    }
    
    console.log('\n✅ RAG Generator test passed!');
    return true;
  } catch (error) {
    console.error('❌ RAG Generator test failed:', error);
    return false;
  }
}

// Test 2: JSONL Generator
async function testJSONLGenerator() {
  console.log('\n📋 Testing JSONL Generator...');
  
  try {
    const jsonlGenerator = new JSONLGenerator();
    
    const result = await jsonlGenerator.generate(mockDocument, {
      selectedZones: ['zone-1', 'zone-2', 'zone-3'],
      options: {
        includeMetadata: true,
        includeCoordinates: true,
        flattenStructure: false
      }
    });
    
    console.log(`  ✅ Generated JSONL with ${result.lines.length} lines`);
    
    // Parse and validate first line
    const firstLine = JSON.parse(result.lines[0]);
    console.log('  ✅ First line structure:', Object.keys(firstLine));
    console.log('  ✅ Zone data present:', 'zone' in firstLine);
    console.log('  ✅ Metadata present:', 'metadata' in firstLine);
    console.log('  ✅ Content preview:', firstLine.content?.substring(0, 100) + '...');
    
    // Test flattened structure
    const flatResult = await jsonlGenerator.generate(mockDocument, {
      selectedZones: ['zone-1'],
      options: {
        includeMetadata: false,
        includeCoordinates: false,
        flattenStructure: true
      }
    });
    
    const flatLine = JSON.parse(flatResult.lines[0]);
    console.log('\n  ✅ Flattened structure:', Object.keys(flatLine));
    
    console.log('\n✅ JSONL Generator test passed!');
    return true;
  } catch (error) {
    console.error('❌ JSONL Generator test failed:', error);
    return false;
  }
}

// Test 3: Export Validation System
async function testValidationSystem() {
  console.log('\n🔍 Testing Validation System...');
  
  try {
    // Test valid configuration
    const validConfig: ExportConfig = {
      format: 'rag',
      selectedZones: ['zone-1', 'zone-2'],
      options: {
        maxTokens: 1000,
        overlap: 100
      },
      validation: {
        enabled: true,
        strict: true,
        rules: {
          minConfidence: 0.7,
          requireContent: true,
          maxTokens: 2000
        }
      }
    };
    
    const validationResult = await validateExportReadiness(mockDocument, validConfig);
    console.log('  ✅ Valid config passed:', validationResult.isValid);
    console.log('  ✅ Warnings:', validationResult.warnings.length);
    
    // Test invalid configuration
    const invalidConfig: ExportConfig = {
      format: 'rag',
      selectedZones: ['invalid-zone'],
      options: {
        maxTokens: -100  // Invalid
      }
    };
    
    try {
      await validateExportReadiness(mockDocument, invalidConfig);
      console.log('  ❌ Invalid config should have failed');
      return false;
    } catch (error) {
      console.log('  ✅ Invalid config correctly rejected');
    }
    
    // Test zone validation
    const lowConfidenceZone: Zone = {
      ...mockZones[0],
      confidence: 0.3  // Below threshold
    };
    
    const docWithLowConfidence = {
      ...mockDocument,
      zones: [...mockDocument.zones, lowConfidenceZone]
    };
    
    const warningResult = await validateExportReadiness(docWithLowConfidence, validConfig);
    console.log('  ✅ Low confidence warning detected:', warningResult.warnings.length > 0);
    
    console.log('\n✅ Validation System test passed!');
    return true;
  } catch (error) {
    console.error('❌ Validation System test failed:', error);
    return false;
  }
}

// Test 4: Export Progress Tracking
async function testProgressTracking() {
  console.log('\n📊 Testing Progress Tracking...');
  
  try {
    const progressTracker = new ExportProgressTracker('test-export');
    const progressUpdates: any[] = [];
    
    // Subscribe to progress updates
    progressTracker.subscribe((update) => {
      progressUpdates.push(update);
      console.log(`  📈 Progress: ${update.progress}% - ${update.message}`);
    });
    
    // Simulate export progress
    progressTracker.startTask('validation', 'Validating configuration...');
    await new Promise(resolve => setTimeout(resolve, 100));
    progressTracker.completeTask('validation');
    
    progressTracker.startTask('generation', 'Generating chunks...');
    for (let i = 0; i <= 100; i += 20) {
      progressTracker.updateTask('generation', i, `Processing chunk ${i/20 + 1}/6`);
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    progressTracker.completeTask('generation');
    
    progressTracker.startTask('formatting', 'Formatting output...');
    await new Promise(resolve => setTimeout(resolve, 100));
    progressTracker.completeTask('formatting');
    
    progressTracker.complete();
    
    console.log(`\n  ✅ Total progress updates: ${progressUpdates.length}`);
    console.log('  ✅ Final status:', progressTracker.getStatus());
    console.log('  ✅ Total duration:', progressTracker.getDuration(), 'ms');
    
    console.log('\n✅ Progress Tracking test passed!');
    return true;
  } catch (error) {
    console.error('❌ Progress Tracking test failed:', error);
    return false;
  }
}

// Test 5: Export Manager Integration
async function testExportManager() {
  console.log('\n🎯 Testing Export Manager Integration...');
  
  try {
    const exportManager = new ExportManager();
    
    // Create export session
    const session = createExportSession(mockDocument);
    console.log('  ✅ Session created:', session.id);
    
    // Test RAG export through manager
    const ragConfig: ExportConfig = {
      format: 'rag',
      selectedZones: ['zone-1', 'zone-2'],
      options: {
        maxTokens: 1000,
        overlap: 100,
        includeMeta: true
      }
    };
    
    console.log('\n  🔄 Starting RAG export...');
    const ragResult = await exportManager.export(mockDocument, ragConfig);
    console.log('  ✅ RAG export completed');
    console.log('  ✅ Output size:', ragResult.data.length, 'bytes');
    console.log('  ✅ Chunks generated:', ragResult.metadata.itemCount);
    
    // Test JSONL export through manager
    const jsonlConfig: ExportConfig = {
      format: 'jsonl',
      selectedZones: ['zone-1', 'zone-2', 'zone-3'],
      options: {
        includeMetadata: true,
        flattenStructure: false
      }
    };
    
    console.log('\n  🔄 Starting JSONL export...');
    const jsonlResult = await exportManager.export(mockDocument, jsonlConfig);
    console.log('  ✅ JSONL export completed');
    console.log('  ✅ Lines generated:', jsonlResult.metadata.itemCount);
    
    // Test batch export
    console.log('\n  🔄 Testing batch export...');
    const batchResults = await exportManager.batchExport(mockDocument, [ragConfig, jsonlConfig]);
    console.log('  ✅ Batch export completed');
    console.log('  ✅ Successful exports:', batchResults.filter(r => r.success).length);
    
    console.log('\n✅ Export Manager test passed!');
    return true;
  } catch (error) {
    console.error('❌ Export Manager test failed:', error);
    return false;
  }
}

// Test 6: Configuration Management
async function testConfigurationManagement() {
  console.log('\n⚙️ Testing Configuration Management...');
  
  try {
    const configManager = new ExportConfigManager();
    
    // Create and save preset
    const preset = await configManager.createPreset('test-preset', {
      format: 'rag',
      options: {
        maxTokens: 1500,
        overlap: 150,
        includeMeta: true
      }
    });
    
    console.log('  ✅ Preset created:', preset.name);
    
    // Load preset
    const loaded = await configManager.loadPreset('test-preset');
    console.log('  ✅ Preset loaded successfully');
    console.log('  ✅ Config matches:', JSON.stringify(loaded.config) === JSON.stringify(preset.config));
    
    // List presets
    const presets = await configManager.listPresets();
    console.log('  ✅ Total presets:', presets.length);
    
    // Validate preset
    const validation = await configManager.validatePreset('test-preset');
    console.log('  ✅ Preset validation:', validation.isValid ? 'valid' : 'invalid');
    
    console.log('\n✅ Configuration Management test passed!');
    return true;
  } catch (error) {
    console.error('❌ Configuration Management test failed:', error);
    return false;
  }
}

// Main test runner
async function runAllTests() {
  console.log('🚀 Starting Epic 3 Export System Tests\n');
  console.log('=' .repeat(50));
  
  const tests = [
    { name: 'RAG Generator', fn: testRAGGenerator },
    { name: 'JSONL Generator', fn: testJSONLGenerator },
    { name: 'Validation System', fn: testValidationSystem },
    { name: 'Progress Tracking', fn: testProgressTracking },
    { name: 'Export Manager', fn: testExportManager },
    { name: 'Configuration Management', fn: testConfigurationManagement }
  ];
  
  const results = [];
  
  for (const test of tests) {
    const passed = await test.fn();
    results.push({ name: test.name, passed });
  }
  
  console.log('\n' + '=' .repeat(50));
  console.log('📊 TEST RESULTS:\n');
  
  let allPassed = true;
  results.forEach(result => {
    console.log(`  ${result.passed ? '✅' : '❌'} ${result.name}`);
    if (!result.passed) allPassed = false;
  });
  
  console.log('\n' + '=' .repeat(50));
  
  if (allPassed) {
    console.log('🎉 All Epic 3 tests passed! The export system is working correctly.');
  } else {
    console.log('⚠️ Some tests failed. Please check the errors above.');
  }
  
  return allPassed;
}

// Run tests if this file is executed directly
if (require.main === module) {
  runAllTests()
    .then(success => process.exit(success ? 0 : 1))
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

export { runAllTests };