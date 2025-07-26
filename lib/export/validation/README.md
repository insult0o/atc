# Export Validation System

## Overview

The Export Validation System provides comprehensive validation for all export operations, ensuring data quality and consistency before final export. It implements a multi-layer validation approach with customizable rules and override capabilities.

## Architecture

### Core Components

1. **Schema Validator** (`schema-validator.ts`)
   - Validates export data against JSON schemas using AJV
   - Supports custom format validators
   - Batch validation capabilities

2. **Zone Validator** (`zone-validator.ts`)
   - Checks zone processing completeness
   - Validates coverage and zone types
   - Calculates quality scores

3. **Error Validator** (`error-validator.ts`)
   - Detects and analyzes error states
   - Assesses error impact
   - Prevents corrupted data export

4. **Content Validator** (`content-validator.ts`)
   - Validates text formatting and encoding
   - Checks table structure integrity
   - Verifies content patterns

5. **Metadata Validator** (`metadata-validator.ts`)
   - Ensures required metadata presence
   - Validates field formats
   - Checks consistency

6. **Custom Rules Engine** (`custom-rules.ts`)
   - Allows custom validation rules
   - Priority-based execution
   - Conflict resolution

7. **Validation Orchestrator** (`validation-orchestrator.ts`)
   - Coordinates all validators
   - Makes blocking decisions
   - Generates comprehensive reports

## Usage

### Basic Export with Validation

```typescript
import { ExportManager } from '@/lib/export/manager'

const exportManager = new ExportManager()

// Start export with validation enabled
const sessionId = await exportManager.startExport(
  document,
  ['rag', 'jsonl'],
  {
    validation: {
      enabled: true,
      stopOnError: true,
      customRules: []
    }
  }
)

// Get validation results
const validationResults = exportManager.getValidationResults(sessionId)
```

### Custom Validation Rules

```typescript
import { customRulesEngine } from '@/lib/export/validation'

// Add a custom rule
customRulesEngine.addRule({
  id: 'chunk_quality',
  name: 'Chunk Quality Check',
  description: 'Ensures chunks meet quality standards',
  type: 'quality',
  applies_to: ['rag'],
  priority: 15,
  implementation: (data) => {
    // Custom validation logic
    const issues = []
    const chunks = data.chunks || []
    
    chunks.forEach((chunk, index) => {
      if (chunk.content.length < 100) {
        issues.push({
          severity: 'warning',
          path: `chunks[${index}]`,
          message: 'Chunk too short'
        })
      }
    })
    
    return {
      passed: issues.length === 0,
      score: 100 - (issues.length * 10),
      issues,
      metrics: { totalChunks: chunks.length }
    }
  },
  config: {},
  override_allowed: true,
  override_approval_required: false
})
```

### Validation Override

```typescript
// Request override for validation failures
const approved = await exportManager.requestValidationOverride(
  sessionId,
  'rag',
  'Manual review confirmed data quality despite validation warnings',
  'user@example.com'
)

if (approved) {
  // Export can proceed despite validation failures
}
```

## Validation Flow

1. **Export Generation** - Generate export data
2. **Schema Validation** - Validate against JSON schema
3. **Zone Completeness** - Check processing status
4. **Error Analysis** - Detect critical errors
5. **Content Validation** - Verify data formats
6. **Metadata Check** - Ensure required fields
7. **Custom Rules** - Apply business rules
8. **Blocking Decision** - Determine if export can proceed

## Configuration

### Validation Options

```typescript
interface ValidationOptions {
  enabled: boolean          // Enable/disable validation
  stopOnError: boolean      // Stop on first error
  customRules: Rule[]       // Custom validation rules
  thresholds?: {
    minScore: number        // Minimum acceptable score
    maxErrors: number       // Maximum allowed errors
    maxCriticalErrors: number
  }
}
```

### Blocking Thresholds

- **Score Threshold**: Default 70%
- **Max Errors**: Default 10
- **Max Critical Errors**: Default 0

## Validation Report

The validation report includes:

- Overall status (passed/failed/passed_with_warnings)
- Quality score (0-100)
- Detailed results for each validator
- Error and warning lists
- Recommendations for improvement
- Performance metrics

## UI Components

The `ValidationPanel` component provides:

- Visual validation status
- Error and warning display
- Detailed report viewing
- Override request workflow
- Progress indication

## Error Types

### Blocking Errors
- Schema validation failures
- Critical processing errors
- Missing required zone types
- Unrecoverable failures

### Non-Blocking Warnings
- Low confidence scores
- Missing recommended metadata
- Content format suggestions
- Performance recommendations

## Performance

- Schema validation: <100ms for 1MB
- Zone checking: <500ms for 100 pages
- Full validation: <3s typical
- Supports concurrent validation

## Best Practices

1. **Always validate critical exports** - Enable validation for production data
2. **Define custom rules** - Add business-specific validation
3. **Review validation reports** - Use insights to improve quality
4. **Document overrides** - Maintain audit trail for overrides
5. **Monitor validation metrics** - Track quality trends over time