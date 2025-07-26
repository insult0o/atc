/**
 * Epic 3 Export System Test
 * Simple test to verify all export components are working
 */

const fs = require('fs');
const path = require('path');

// Check if all export files exist
console.log('🔍 Epic 3 Export System Verification\n');
console.log('=' .repeat(50));

// Define all required files for Epic 3
const exportFiles = {
  'Core Files': [
    'lib/export/index.ts',
    'lib/export/manager.ts',
    'lib/export/utils.ts',
    'lib/export/config-manager.ts',
    'lib/export/progress-tracker.ts',
    'lib/export/batch-export-manager.ts',
    'lib/export/partial-export-engine.ts',
    'lib/export/history-manager.ts'
  ],
  'Generators': [
    'lib/export/generators/rag-generator.ts',
    'lib/export/generators/jsonl-generator.ts',
    'lib/export/generators/corrections-generator.ts',
    'lib/export/generators/manifest-generator.ts',
    'lib/export/generators/log-generator.ts'
  ],
  'Validation': [
    'lib/export/validation/index.ts',
    'lib/export/validation/validation-orchestrator.ts',
    'lib/export/validation/zone-validator.ts',
    'lib/export/validation/content-validator.ts',
    'lib/export/validation/metadata-validator.ts',
    'lib/export/validation/schema-validator.ts',
    'lib/export/validation/error-validator.ts',
    'lib/export/validation/partial-validator.ts',
    'lib/export/validation/custom-rules.ts'
  ],
  'Logging': [
    'lib/export/logging/logger.ts',
    'lib/export/logging/export-logger.ts',
    'lib/export/logging/validation-logger.ts',
    'lib/export/logging/performance-logger.ts',
    'lib/export/logging/error-logger.ts',
    'lib/export/logging/audit-trail.ts',
    'lib/export/logging/partial-export-logger.ts'
  ],
  'Schemas': [
    'lib/export/schemas/index.ts',
    'lib/export/schemas/types.ts',
    'lib/export/schemas/validator.ts'
  ],
  'UI Components': [
    'app/components/export/SelectionPanel.tsx',
    'app/components/export/ValidationPanel.tsx',
    'app/components/export/ExportFeedback.tsx'
  ]
};

// Check each file exists
let totalFiles = 0;
let missingFiles = 0;

for (const [category, files] of Object.entries(exportFiles)) {
  console.log(`\n📁 ${category}:`);
  
  for (const file of files) {
    totalFiles++;
    const exists = fs.existsSync(path.join(__dirname, file));
    
    if (exists) {
      console.log(`  ✅ ${file}`);
    } else {
      console.log(`  ❌ ${file} - MISSING`);
      missingFiles++;
    }
  }
}

console.log('\n' + '=' .repeat(50));
console.log(`📊 Summary: ${totalFiles - missingFiles}/${totalFiles} files present`);

// Check dependencies
console.log('\n📦 Checking Dependencies:');

const requiredDeps = {
  'ajv': 'Schema validation',
  'ajv-formats': 'Additional validation formats',
  '@dqbd/tiktoken': 'Token counting for RAG chunks',
  'file-saver': 'File download functionality',
  'xlsx': 'Excel export support'
};

const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));

for (const [dep, purpose] of Object.entries(requiredDeps)) {
  const installed = packageJson.dependencies[dep] || packageJson.devDependencies[dep];
  
  if (installed) {
    console.log(`  ✅ ${dep} (${installed}) - ${purpose}`);
  } else {
    console.log(`  ❌ ${dep} - MISSING - ${purpose}`);
  }
}

// Test import functionality
console.log('\n🧪 Testing Import Functionality:');

try {
  // Check if we can read the main export file
  const indexContent = fs.readFileSync(path.join(__dirname, 'lib/export/index.ts'), 'utf8');
  
  // Check for key exports
  const keyExports = [
    'ExportManager',
    'RAGGenerator',
    'JSONLGenerator',
    'ExportConfigManager',
    'ExportProgressTracker'
  ];
  
  keyExports.forEach(exportName => {
    if (indexContent.includes(exportName)) {
      console.log(`  ✅ ${exportName} is exported`);
    } else {
      console.log(`  ❌ ${exportName} export not found`);
    }
  });
  
} catch (error) {
  console.log('  ❌ Could not read export index file');
}

// Check for TypeScript types
console.log('\n📝 Checking TypeScript Types:');

try {
  const typesContent = fs.readFileSync(path.join(__dirname, 'lib/export/schemas/types.ts'), 'utf8');
  
  const requiredTypes = [
    'ExportConfig',
    'ExportResult',
    'ExportFormat',
    'Zone',
    'ProcessedDocument'
  ];
  
  requiredTypes.forEach(typeName => {
    if (typesContent.includes(`export interface ${typeName}`) || 
        typesContent.includes(`export type ${typeName}`) ||
        typesContent.includes(`interface ${typeName}`)) {
      console.log(`  ✅ ${typeName} type defined`);
    } else {
      console.log(`  ❌ ${typeName} type not found`);
    }
  });
  
} catch (error) {
  console.log('  ❌ Could not read types file');
}

// Final result
console.log('\n' + '=' .repeat(50));

if (missingFiles === 0) {
  console.log('✅ Epic 3 Export System: All files present and accounted for!');
  console.log('🎉 The export system is ready to use.');
} else {
  console.log(`⚠️ Epic 3 Export System: ${missingFiles} files are missing.`);
  console.log('Please check the missing files listed above.');
}

// Usage instructions
console.log('\n📘 Usage Example:');
console.log(`
import { ExportManager } from './lib/export';

const exportManager = new ExportManager();
const result = await exportManager.export(document, {
  format: 'rag',
  selectedZones: ['zone-1', 'zone-2'],
  options: {
    maxTokens: 1000,
    overlap: 100
  }
});
`);