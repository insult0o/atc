# Epic 3: Export System - Granular Testing Guide

## Overview
This document provides exhaustive, function-level testing for every component, hook, utility, and interaction in Epic 3 Export System.

## Story 3.1: Export Format Generation - Complete Testing

### 1. RAGChunkGenerator Component (`lib/export/generators/rag-generator.ts`)

#### 1.1 Content Chunking Algorithm Testing
```typescript
// Test chunking strategies
describe('RAG Content Chunking', () => {
  test('should chunk content by token count', () => {
    const generator = new RAGChunkGenerator({
      chunkSize: 512,
      overlapPercentage: 10
    });
    
    const content = 'Lorem ipsum...'.repeat(100); // Long content
    const chunks = generator.chunkContent(content);
    
    // Verify chunk sizes
    chunks.forEach(chunk => {
      const tokenCount = generator.countTokens(chunk.content);
      expect(tokenCount).toBeLessThanOrEqual(512);
      expect(tokenCount).toBeGreaterThan(450); // Efficient use of space
    });
  });

  test('should maintain semantic boundaries', () => {
    const generator = new RAGChunkGenerator({
      chunkSize: 512,
      respectBoundaries: true
    });
    
    const content = `
      Paragraph 1. This is a complete thought.
      
      Paragraph 2. This is another complete thought.
      
      Paragraph 3. This is a third complete thought.
    `;
    
    const chunks = generator.chunkContent(content);
    
    // Verify no chunks split paragraphs
    chunks.forEach(chunk => {
      expect(chunk.content).not.toMatch(/\.\s*$/); // Doesn't end mid-sentence
      expect(chunk.content.trim()).toBeTruthy(); // No empty chunks
    });
  });

  test('should apply overlap between chunks', () => {
    const generator = new RAGChunkGenerator({
      chunkSize: 200,
      overlapPercentage: 20
    });
    
    const content = 'A'.repeat(1000);
    const chunks = generator.chunkContent(content);
    
    for (let i = 1; i < chunks.length; i++) {
      const prevChunk = chunks[i - 1];
      const currChunk = chunks[i];
      
      // Check overlap exists
      const overlapLength = prevChunk.content.length * 0.2;
      const prevEnd = prevChunk.content.substring(prevChunk.content.length - overlapLength);
      const currStart = currChunk.content.substring(0, overlapLength);
      
      expect(prevEnd).toBe(currStart);
    });
  });

  test('should handle different content types', () => {
    const generator = new RAGChunkGenerator();
    
    // Test table content
    const tableContent = `
      | Header 1 | Header 2 |
      |----------|----------|
      | Cell 1   | Cell 2   |
    `;
    
    const tableChunks = generator.chunkContent(tableContent, 'table');
    expect(tableChunks[0].metadata.contentType).toBe('table');
    expect(tableChunks[0].content).toContain('|'); // Preserves table structure
    
    // Test code content
    const codeContent = `
      function example() {
        return "test";
      }
    `;
    
    const codeChunks = generator.chunkContent(codeContent, 'code');
    expect(codeChunks[0].metadata.contentType).toBe('code');
    expect(codeChunks[0].content).toMatch(/function.*\}/s); // Preserves code block
  });

  test('should handle edge cases', () => {
    const generator = new RAGChunkGenerator({ chunkSize: 100 });
    
    // Empty content
    expect(() => generator.chunkContent('')).toThrow('Content cannot be empty');
    
    // Content smaller than chunk size
    const smallContent = 'Small text';
    const smallChunks = generator.chunkContent(smallContent);
    expect(smallChunks).toHaveLength(1);
    expect(smallChunks[0].content).toBe(smallContent);
    
    // Single word larger than chunk size
    const largeWord = 'A'.repeat(200);
    const largeChunks = generator.chunkContent(largeWord);
    expect(largeChunks.length).toBeGreaterThan(1);
  });
});
```

#### 1.2 Metadata Enrichment Testing
```typescript
// Test metadata generation
describe('RAG Metadata Enrichment', () => {
  test('should enrich chunks with complete metadata', () => {
    const generator = new RAGChunkGenerator();
    const zone = {
      id: 'zone-1',
      page: 1,
      confidence: 0.95,
      type: 'text',
      processingTool: 'tesseract'
    };
    
    const chunk = generator.enrichChunk({
      content: 'Test content',
      index: 0,
      totalChunks: 5
    }, zone, 'doc-123');
    
    expect(chunk.metadata).toEqual({
      source: 'doc-123',
      pageNumber: 1,
      zoneId: 'zone-1',
      confidence: 0.95,
      timestamp: expect.any(String),
      processingTool: 'tesseract',
      contentType: 'text',
      chunkIndex: 0,
      totalChunks: 5
    });
  });

  test('should calculate chunk relationships', () => {
    const generator = new RAGChunkGenerator();
    const chunks = generator.generateChunks(mockContent, mockZones);
    
    chunks.forEach((chunk, index) => {
      expect(chunk.id).toMatch(/^chunk-[a-f0-9-]+$/);
      expect(chunk.chunkIndex).toBe(index);
      expect(chunk.totalChunks).toBe(chunks.length);
      
      if (index > 0) {
        expect(chunk.overlap.previous).toBeGreaterThan(0);
      }
      if (index < chunks.length - 1) {
        expect(chunk.overlap.next).toBeGreaterThan(0);
      }
    });
  });

  test('should handle custom metadata fields', () => {
    const generator = new RAGChunkGenerator({
      metadataFields: ['customField1', 'customField2']
    });
    
    const zone = {
      id: 'zone-1',
      customField1: 'value1',
      customField2: 'value2'
    };
    
    const chunk = generator.enrichChunk({ content: 'Test' }, zone, 'doc-123');
    
    expect(chunk.metadata.customField1).toBe('value1');
    expect(chunk.metadata.customField2).toBe('value2');
  });
});
```

#### 1.3 Embedding Preparation Testing
```typescript
// Test embedding preparation
describe('Embedding Preparation', () => {
  test('should prepare content for embedding', async () => {
    const generator = new RAGChunkGenerator({
      includeEmbeddings: true
    });
    
    const chunk = {
      content: 'This is test content for embeddings.',
      metadata: { contentType: 'text' }
    };
    
    const prepared = await generator.prepareForEmbedding(chunk);
    
    expect(prepared.content).toBe(chunk.content);
    expect(prepared.embeddingText).toBeDefined();
    expect(prepared.tokenCount).toBeGreaterThan(0);
  });

  test('should clean content for embedding', async () => {
    const generator = new RAGChunkGenerator({
      includeEmbeddings: true
    });
    
    const chunk = {
      content: 'This has\n\nmultiple   spaces\tand\nnewlines!',
      metadata: { contentType: 'text' }
    };
    
    const prepared = await generator.prepareForEmbedding(chunk);
    
    expect(prepared.embeddingText).toBe('This has multiple spaces and newlines!');
    expect(prepared.embeddingText).not.toMatch(/\s{2,}/); // No multiple spaces
  });

  test('should handle different content types for embedding', async () => {
    const generator = new RAGChunkGenerator({
      includeEmbeddings: true
    });
    
    // Table content
    const tableChunk = {
      content: '| A | B |\n|---|---|\n| 1 | 2 |',
      metadata: { contentType: 'table' }
    };
    
    const tablePrepared = await generator.prepareForEmbedding(tableChunk);
    expect(tablePrepared.embeddingText).toContain('Table with columns A, B');
    
    // Code content
    const codeChunk = {
      content: 'function test() { return true; }',
      metadata: { contentType: 'code' }
    };
    
    const codePrepared = await generator.prepareForEmbedding(codeChunk);
    expect(codePrepared.embeddingText).toContain('Code: function test');
  });
});
```

#### 1.4 Batch Processing Testing
```typescript
// Test batch chunk generation
describe('Batch Chunk Generation', () => {
  test('should process multiple zones in batch', async () => {
    const generator = new RAGChunkGenerator();
    const zones = Array.from({ length: 100 }, (_, i) => ({
      id: `zone-${i}`,
      content: `Content for zone ${i}`.repeat(50),
      page: Math.floor(i / 10) + 1,
      confidence: 0.8 + Math.random() * 0.2
    }));
    
    const startTime = performance.now();
    const chunks = await generator.batchGenerate(zones, 'doc-123');
    const duration = performance.now() - startTime;
    
    expect(chunks.length).toBeGreaterThan(zones.length); // Some zones split into multiple chunks
    expect(duration).toBeLessThan(1000); // Should process in under 1 second
    
    // Verify all zones processed
    const processedZoneIds = new Set(chunks.map(c => c.metadata.zoneId));
    zones.forEach(zone => {
      expect(processedZoneIds).toContain(zone.id);
    });
  });

  test('should handle batch processing errors', async () => {
    const generator = new RAGChunkGenerator();
    const zones = [
      { id: 'zone-1', content: 'Valid content' },
      { id: 'zone-2', content: null }, // Invalid
      { id: 'zone-3', content: 'More valid content' }
    ];
    
    const results = await generator.batchGenerate(zones, 'doc-123', {
      continueOnError: true
    });
    
    expect(results.chunks.length).toBe(2); // Only valid zones
    expect(results.errors).toHaveLength(1);
    expect(results.errors[0].zoneId).toBe('zone-2');
  });

  test('should respect memory limits during batch processing', async () => {
    const generator = new RAGChunkGenerator({
      maxMemoryUsage: 100 * 1024 * 1024 // 100MB
    });
    
    const largeZones = Array.from({ length: 1000 }, (_, i) => ({
      id: `zone-${i}`,
      content: 'X'.repeat(1024 * 1024) // 1MB each
    }));
    
    const memoryBefore = process.memoryUsage().heapUsed;
    
    await generator.batchGenerate(largeZones, 'doc-123', {
      streaming: true
    });
    
    const memoryAfter = process.memoryUsage().heapUsed;
    const memoryIncrease = memoryAfter - memoryBefore;
    
    expect(memoryIncrease).toBeLessThan(150 * 1024 * 1024); // Less than 150MB increase
  });
});
```

### 2. JSONLGenerator Component (`lib/export/generators/jsonl-generator.ts`)

#### 2.1 JSONL Formatting Testing
```typescript
// Test JSONL format generation
describe('JSONL Format Generation', () => {
  test('should generate valid JSONL format', () => {
    const generator = new JSONLGenerator();
    const examples = [
      {
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: 'What is 2+2?' },
          { role: 'assistant', content: '4' }
        ]
      }
    ];
    
    const jsonl = generator.format(examples);
    const lines = jsonl.trim().split('\n');
    
    lines.forEach(line => {
      expect(() => JSON.parse(line)).not.toThrow();
      const parsed = JSON.parse(line);
      expect(parsed.messages).toBeDefined();
      expect(Array.isArray(parsed.messages)).toBe(true);
    });
  });

  test('should handle special characters in content', () => {
    const generator = new JSONLGenerator();
    const examples = [
      {
        messages: [
          { role: 'user', content: 'Line with\nnewline and "quotes"' },
          { role: 'assistant', content: 'Response with \t tab and \\backslash' }
        ]
      }
    ];
    
    const jsonl = generator.format(examples);
    const parsed = JSON.parse(jsonl.trim());
    
    expect(parsed.messages[0].content).toContain('\n');
    expect(parsed.messages[0].content).toContain('"');
    expect(parsed.messages[1].content).toContain('\t');
    expect(parsed.messages[1].content).toContain('\\');
  });

  test('should validate message structure', () => {
    const generator = new JSONLGenerator();
    
    // Invalid structure
    const invalid = [
      {
        messages: [
          { role: 'invalid_role', content: 'Test' }
        ]
      }
    ];
    
    expect(() => generator.format(invalid)).toThrow('Invalid role');
    
    // Missing content
    const missingContent = [
      {
        messages: [
          { role: 'user' }
        ]
      }
    ];
    
    expect(() => generator.format(missingContent)).toThrow('Missing content');
  });
});
```

#### 2.2 Conversation Extraction Testing
```typescript
// Test conversation pair extraction
describe('Conversation Extraction', () => {
  test('should extract Q&A pairs from zones', () => {
    const generator = new JSONLGenerator({
      conversationStyle: 'qa'
    });
    
    const zones = [
      {
        id: 'zone-1',
        type: 'text',
        content: 'What is machine learning?',
        metadata: { isQuestion: true }
      },
      {
        id: 'zone-2',
        type: 'text',
        content: 'Machine learning is a subset of AI...',
        metadata: { isAnswer: true }
      }
    ];
    
    const examples = generator.extractConversations(zones);
    
    expect(examples).toHaveLength(1);
    expect(examples[0].messages[1].content).toContain('What is machine learning?');
    expect(examples[0].messages[2].content).toContain('Machine learning is');
  });

  test('should handle instruction-following format', () => {
    const generator = new JSONLGenerator({
      conversationStyle: 'instruction'
    });
    
    const zones = [
      {
        id: 'zone-1',
        type: 'text',
        content: 'Summarize the following text: [long text here]',
        metadata: { instruction: true }
      },
      {
        id: 'zone-2',
        type: 'text',
        content: 'The text discusses three main points...',
        metadata: { response: true }
      }
    ];
    
    const examples = generator.extractConversations(zones);
    
    expect(examples[0].messages[0].role).toBe('system');
    expect(examples[0].messages[0].content).toContain('follow instructions');
    expect(examples[0].messages[1].content).toContain('Summarize');
  });

  test('should detect conversation boundaries', () => {
    const generator = new JSONLGenerator();
    
    const zones = [
      { id: 'z1', content: 'Question 1?', metadata: { paragraph: 1 } },
      { id: 'z2', content: 'Answer 1.', metadata: { paragraph: 2 } },
      { id: 'z3', content: 'Unrelated content.', metadata: { paragraph: 3 } },
      { id: 'z4', content: 'Question 2?', metadata: { paragraph: 4 } },
      { id: 'z5', content: 'Answer 2.', metadata: { paragraph: 5 } }
    ];
    
    const examples = generator.extractConversations(zones);
    
    expect(examples).toHaveLength(2);
    expect(examples[0].messages.length).toBe(3); // system + Q + A
    expect(examples[1].messages.length).toBe(3);
  });
});
```

#### 2.3 Quality Filtering Testing
```typescript
// Test quality filtering for training data
describe('Quality Filtering', () => {
  test('should filter by minimum length', () => {
    const generator = new JSONLGenerator({
      qualityThreshold: 0.8,
      minLength: 50
    });
    
    const examples = [
      {
        messages: [
          { role: 'user', content: 'Hi' },
          { role: 'assistant', content: 'Hello' }
        ],
        metadata: { quality_score: 0.9 }
      },
      {
        messages: [
          { role: 'user', content: 'Explain quantum computing in detail' },
          { role: 'assistant', content: 'Quantum computing is a revolutionary field that leverages quantum mechanical phenomena...' }
        ],
        metadata: { quality_score: 0.9 }
      }
    ];
    
    const filtered = generator.filterByQuality(examples);
    
    expect(filtered).toHaveLength(1);
    expect(filtered[0].messages[2].content).toContain('Quantum computing');
  });

  test('should filter by confidence score', () => {
    const generator = new JSONLGenerator({
      qualityThreshold: 0.85
    });
    
    const examples = [
      { messages: [...], metadata: { quality_score: 0.8 } },
      { messages: [...], metadata: { quality_score: 0.9 } },
      { messages: [...], metadata: { quality_score: 0.7 } }
    ];
    
    const filtered = generator.filterByQuality(examples);
    
    expect(filtered).toHaveLength(1);
    expect(filtered[0].metadata.quality_score).toBe(0.9);
  });

  test('should check content diversity', () => {
    const generator = new JSONLGenerator({
      diversityScore: 0.7
    });
    
    const examples = [
      {
        messages: [
          { role: 'user', content: 'What is X?' },
          { role: 'assistant', content: 'X is Y' }
        ]
      },
      {
        messages: [
          { role: 'user', content: 'What is X?' }, // Duplicate question
          { role: 'assistant', content: 'X is Z' }
        ]
      },
      {
        messages: [
          { role: 'user', content: 'How does A work?' },
          { role: 'assistant', content: 'A works by...' }
        ]
      }
    ];
    
    const filtered = generator.filterByQuality(examples);
    
    expect(filtered).toHaveLength(2); // Removes one duplicate
  });

  test('should balance question/answer ratio', () => {
    const generator = new JSONLGenerator({
      balanceRatio: 0.3 // 30% minimum answer length vs question
    });
    
    const examples = [
      {
        messages: [
          { role: 'user', content: 'What is the meaning of life, universe and everything?' },
          { role: 'assistant', content: '42' } // Too short
        ]
      },
      {
        messages: [
          { role: 'user', content: 'What is AI?' },
          { role: 'assistant', content: 'Artificial Intelligence is the simulation of human intelligence...' }
        ]
      }
    ];
    
    const filtered = generator.filterByQuality(examples);
    
    expect(filtered).toHaveLength(1);
    expect(filtered[0].messages[2].content).toContain('Artificial Intelligence');
  });
});
```

#### 2.4 Batch JSONL Processing Testing
```typescript
// Test batch processing for large datasets
describe('Batch JSONL Processing', () => {
  test('should handle large dataset efficiently', async () => {
    const generator = new JSONLGenerator();
    const zones = Array.from({ length: 10000 }, (_, i) => ({
      id: `zone-${i}`,
      content: `Question ${i}: Test content?`,
      nextZone: {
        id: `zone-${i}-answer`,
        content: `Answer ${i}: Response content.`
      }
    }));
    
    const startTime = performance.now();
    const result = await generator.batchProcess(zones, {
      batchSize: 1000,
      parallel: true
    });
    const duration = performance.now() - startTime;
    
    expect(result.examples.length).toBeGreaterThan(0);
    expect(duration).toBeLessThan(5000); // Under 5 seconds
    expect(result.processedCount).toBe(10000);
  });

  test('should limit examples per document', async () => {
    const generator = new JSONLGenerator({
      maxExamplesPerDocument: 100
    });
    
    const zones = Array.from({ length: 1000 }, (_, i) => ({
      id: `zone-${i}`,
      content: `Q: ${i}?`,
      answer: `A: ${i}.`
    }));
    
    const result = await generator.batchProcess(zones);
    
    expect(result.examples.length).toBe(100);
    expect(result.metadata.limited).toBe(true);
  });

  test('should generate training statistics', async () => {
    const generator = new JSONLGenerator();
    const zones = generateMockZones(500);
    
    const result = await generator.batchProcess(zones);
    
    expect(result.statistics).toMatchObject({
      totalExamples: expect.any(Number),
      averageLength: expect.any(Number),
      qualityDistribution: expect.any(Object),
      tokenCount: expect.any(Number),
      uniqueQuestions: expect.any(Number),
      diversityScore: expect.any(Number)
    });
  });
});
```

### 3. CorrectionExportGenerator Component (`lib/export/generators/corrections-generator.ts`)

#### 3.1 Correction History Export Testing
```typescript
// Test correction history export
describe('Correction History Export', () => {
  test('should export complete correction history', () => {
    const generator = new CorrectionExportGenerator();
    const corrections = [
      {
        id: 'corr-1',
        timestamp: '2024-01-01T10:00:00Z',
        userId: 'user-123',
        original: {
          content: 'Teh cat',
          confidence: 0.7,
          tool: 'ocr'
        },
        corrected: {
          content: 'The cat',
          confidence: 1.0,
          validator: 'user'
        },
        category: 'spelling',
        impact: 'low'
      }
    ];
    
    const exported = generator.export(corrections);
    
    expect(exported.corrections).toHaveLength(1);
    expect(exported.corrections[0]).toMatchObject({
      id: 'corr-1',
      timestamp: '2024-01-01T10:00:00Z',
      userId: 'user-123',
      original: expect.any(Object),
      corrected: expect.any(Object)
    });
  });

  test('should include before/after comparison', () => {
    const generator = new CorrectionExportGenerator({
      includeComparison: true
    });
    
    const correction = {
      original: { content: 'The cat sat on teh mat.' },
      corrected: { content: 'The cat sat on the mat.' }
    };
    
    const exported = generator.exportSingle(correction);
    
    expect(exported.comparison).toMatchObject({
      changes: [
        {
          type: 'replacement',
          original: 'teh',
          corrected: 'the',
          position: 15
        }
      ],
      similarity: expect.any(Number),
      editDistance: 1
    });
  });

  test('should categorize corrections', () => {
    const generator = new CorrectionExportGenerator();
    const corrections = [
      { category: 'spelling', ... },
      { category: 'formatting', ... },
      { category: 'spelling', ... },
      { category: 'content', ... }
    ];
    
    const exported = generator.export(corrections, {
      groupByCategory: true
    });
    
    expect(exported.byCategory).toMatchObject({
      spelling: expect.arrayContaining([expect.any(Object), expect.any(Object)]),
      formatting: expect.arrayContaining([expect.any(Object)]),
      content: expect.arrayContaining([expect.any(Object)])
    });
  });

  test('should calculate correction statistics', () => {
    const generator = new CorrectionExportGenerator();
    const corrections = generateMockCorrections(100);
    
    const exported = generator.export(corrections, {
      includeStatistics: true
    });
    
    expect(exported.statistics).toMatchObject({
      total: 100,
      byCategory: expect.any(Object),
      byImpact: expect.any(Object),
      byUser: expect.any(Object),
      averageConfidenceIncrease: expect.any(Number),
      mostCommonErrors: expect.any(Array)
    });
  });
});
```

#### 3.2 User Attribution Testing
```typescript
// Test user attribution and tracking
describe('User Attribution', () => {
  test('should track user contributions', () => {
    const generator = new CorrectionExportGenerator();
    const corrections = [
      { userId: 'user-1', timestamp: '2024-01-01T10:00:00Z' },
      { userId: 'user-2', timestamp: '2024-01-01T11:00:00Z' },
      { userId: 'user-1', timestamp: '2024-01-01T12:00:00Z' }
    ];
    
    const exported = generator.export(corrections, {
      includeUserMetrics: true
    });
    
    expect(exported.userMetrics).toMatchObject({
      'user-1': {
        correctionCount: 2,
        firstCorrection: '2024-01-01T10:00:00Z',
        lastCorrection: '2024-01-01T12:00:00Z'
      },
      'user-2': {
        correctionCount: 1,
        firstCorrection: '2024-01-01T11:00:00Z',
        lastCorrection: '2024-01-01T11:00:00Z'
      }
    });
  });

  test('should anonymize user data if requested', () => {
    const generator = new CorrectionExportGenerator({
      anonymizeUsers: true
    });
    
    const corrections = [
      { userId: 'user-123', email: 'test@example.com' },
      { userId: 'user-456', email: 'other@example.com' }
    ];
    
    const exported = generator.export(corrections);
    
    exported.corrections.forEach(corr => {
      expect(corr.userId).toMatch(/^anon-[a-f0-9]+$/);
      expect(corr.email).toBeUndefined();
    });
  });
});
```

#### 3.3 Filtering and Date Range Testing
```typescript
// Test filtering options
describe('Correction Filtering', () => {
  test('should filter by date range', () => {
    const generator = new CorrectionExportGenerator();
    const corrections = [
      { timestamp: '2024-01-01T10:00:00Z' },
      { timestamp: '2024-01-15T10:00:00Z' },
      { timestamp: '2024-02-01T10:00:00Z' }
    ];
    
    const exported = generator.export(corrections, {
      dateRange: {
        start: new Date('2024-01-10'),
        end: new Date('2024-01-20')
      }
    });
    
    expect(exported.corrections).toHaveLength(1);
    expect(exported.corrections[0].timestamp).toBe('2024-01-15T10:00:00Z');
  });

  test('should filter by minimum impact level', () => {
    const generator = new CorrectionExportGenerator();
    const corrections = [
      { impact: 'low' },
      { impact: 'medium' },
      { impact: 'high' }
    ];
    
    const exported = generator.export(corrections, {
      minImpactLevel: 'medium'
    });
    
    expect(exported.corrections).toHaveLength(2);
    expect(exported.corrections.every(c => c.impact !== 'low')).toBe(true);
  });

  test('should filter by correction category', () => {
    const generator = new CorrectionExportGenerator();
    const corrections = [
      { category: 'spelling' },
      { category: 'formatting' },
      { category: 'content' }
    ];
    
    const exported = generator.export(corrections, {
      categories: ['spelling', 'content']
    });
    
    expect(exported.corrections).toHaveLength(2);
    expect(exported.corrections.some(c => c.category === 'formatting')).toBe(false);
  });
});
```

### 4. ManifestGenerator Component (`lib/export/generators/manifest-generator.ts`)

#### 4.1 Zone Manifest Generation Testing
```typescript
// Test zone manifest creation
describe('Zone Manifest Generation', () => {
  test('should generate comprehensive zone manifest', () => {
    const generator = new ManifestGenerator();
    const zones = [
      {
        id: 'zone-1',
        page: 1,
        coordinates: { x: 100, y: 100, width: 200, height: 100 },
        type: 'text',
        tool: 'tesseract',
        confidence: 0.95,
        processingTime: 150,
        content: 'Sample text content'
      }
    ];
    
    const manifest = generator.generate(zones, 'doc-123');
    
    expect(manifest).toMatchObject({
      documentId: 'doc-123',
      totalZones: 1,
      generatedAt: expect.any(String),
      zones: [
        {
          id: 'zone-1',
          boundaries: {
            page: 1,
            coordinates: { x: 100, y: 100, width: 200, height: 100 }
          },
          classification: 'text',
          processing: {
            tool: 'tesseract',
            confidence: 0.95,
            duration: 150
          }
        }
      ]
    });
  });

  test('should include processing metrics', () => {
    const generator = new ManifestGenerator({
      includeMetrics: true
    });
    
    const zones = generateMockZones(50);
    const manifest = generator.generate(zones, 'doc-123');
    
    expect(manifest.metrics).toMatchObject({
      totalProcessingTime: expect.any(Number),
      averageConfidence: expect.any(Number),
      zonesByType: expect.any(Object),
      zonesByPage: expect.any(Object),
      toolUsage: expect.any(Object),
      successRate: expect.any(Number)
    });
  });

  test('should generate visual zone representation', () => {
    const generator = new ManifestGenerator({
      includeVisualPreviews: true
    });
    
    const zones = [
      {
        id: 'zone-1',
        page: 1,
        coordinates: { x: 0, y: 0, width: 100, height: 50 },
        type: 'text'
      },
      {
        id: 'zone-2',
        page: 1,
        coordinates: { x: 0, y: 60, width: 100, height: 40 },
        type: 'table'
      }
    ];
    
    const manifest = generator.generate(zones, 'doc-123');
    
    expect(manifest.visualRepresentation).toBeDefined();
    expect(manifest.visualRepresentation.pages[0].ascii).toContain('█'); // Zone markers
    expect(manifest.visualRepresentation.pages[0].legend).toMatchObject({
      'text': '█',
      'table': '▓'
    });
  });

  test('should handle different detail levels', () => {
    const zones = generateMockZones(10);
    
    // Summary level
    const summaryGen = new ManifestGenerator({ detailLevel: 'summary' });
    const summaryManifest = summaryGen.generate(zones, 'doc-123');
    expect(summaryManifest.zones).toBeUndefined();
    expect(summaryManifest.summary).toBeDefined();
    
    // Detailed level
    const detailedGen = new ManifestGenerator({ detailLevel: 'detailed' });
    const detailedManifest = detailedGen.generate(zones, 'doc-123');
    expect(detailedManifest.zones).toHaveLength(10);
    expect(detailedManifest.zones[0].processing).toBeDefined();
    
    // Verbose level
    const verboseGen = new ManifestGenerator({ detailLevel: 'verbose' });
    const verboseManifest = verboseGen.generate(zones, 'doc-123');
    expect(verboseManifest.zones[0].rawData).toBeDefined();
    expect(verboseManifest.zones[0].debugInfo).toBeDefined();
  });
});
```

#### 4.2 Processing Details Testing
```typescript
// Test processing details capture
describe('Processing Details Capture', () => {
  test('should track tool execution details', () => {
    const generator = new ManifestGenerator();
    const zone = {
      id: 'zone-1',
      toolExecutions: [
        {
          tool: 'tesseract',
          startTime: '2024-01-01T10:00:00Z',
          endTime: '2024-01-01T10:00:00.150Z',
          success: true,
          confidence: 0.85
        },
        {
          tool: 'gpt-vision',
          startTime: '2024-01-01T10:00:01Z',
          endTime: '2024-01-01T10:00:02Z',
          success: true,
          confidence: 0.95
        }
      ]
    };
    
    const manifest = generator.generate([zone], 'doc-123');
    
    expect(manifest.zones[0].processing.executionChain).toHaveLength(2);
    expect(manifest.zones[0].processing.finalTool).toBe('gpt-vision');
    expect(manifest.zones[0].processing.totalDuration).toBe(2000);
  });

  test('should include error information', () => {
    const generator = new ManifestGenerator();
    const zone = {
      id: 'zone-1',
      error: {
        code: 'TOOL_TIMEOUT',
        message: 'Tool execution timed out',
        tool: 'complex-parser',
        timestamp: '2024-01-01T10:00:00Z'
      }
    };
    
    const manifest = generator.generate([zone], 'doc-123');
    
    expect(manifest.zones[0].error).toMatchObject({
      code: 'TOOL_TIMEOUT',
      message: 'Tool execution timed out',
      tool: 'complex-parser'
    });
    expect(manifest.metrics.failedZones).toBe(1);
  });
});
```

### 5. LogGenerator Component (`lib/export/generators/log-generator.ts`)

#### 5.1 Human-Readable Log Generation Testing
```typescript
// Test readable log generation
describe('Human-Readable Log Generation', () => {
  test('should generate markdown formatted logs', () => {
    const generator = new LogGenerator({ format: 'markdown' });
    const exportData = {
      exportId: 'exp-123',
      timestamp: '2024-01-01T10:00:00Z',
      documentId: 'doc-123',
      summary: {
        totalZones: 50,
        processedZones: 48,
        failedZones: 2,
        exportFormats: ['rag', 'jsonl']
      }
    };
    
    const log = generator.generate(exportData);
    
    expect(log).toContain('# Export Log - exp-123');
    expect(log).toContain('## Summary');
    expect(log).toContain('- Total Zones: 50');
    expect(log).toContain('- Success Rate: 96.00%');
    expect(log).toMatch(/\*\*Export Formats:\*\* rag, jsonl/);
  });

  test('should create hierarchical structure', () => {
    const generator = new LogGenerator({ format: 'markdown' });
    const exportData = {
      sections: {
        processing: {
          phases: ['extraction', 'validation', 'export'],
          timings: { extraction: 1000, validation: 500, export: 200 }
        },
        errors: [
          { zone: 'zone-1', error: 'Timeout' },
          { zone: 'zone-2', error: 'Invalid format' }
        ]
      }
    };
    
    const log = generator.generate(exportData);
    
    expect(log).toContain('## Processing');
    expect(log).toContain('### Phases');
    expect(log).toContain('### Timings');
    expect(log).toContain('## Errors');
    expect(log).toMatch(/- Zone: zone-1\s+Error: Timeout/m);
  });

  test('should format statistics clearly', () => {
    const generator = new LogGenerator();
    const exportData = {
      statistics: {
        performance: {
          totalDuration: 5423,
          throughput: 123.45,
          peakMemory: 256 * 1024 * 1024
        },
        quality: {
          averageConfidence: 0.923,
          highConfidenceZones: 85,
          lowConfidenceZones: 15
        }
      }
    };
    
    const log = generator.generate(exportData);
    
    expect(log).toContain('Total Duration: 5.42s');
    expect(log).toContain('Throughput: 123.45 zones/s');
    expect(log).toContain('Peak Memory: 256.00 MB');
    expect(log).toContain('Average Confidence: 92.30%');
  });

  test('should handle different output formats', () => {
    const plainGen = new LogGenerator({ format: 'plain' });
    const jsonGen = new LogGenerator({ format: 'json' });
    
    const exportData = { summary: { total: 10 } };
    
    const plainLog = plainGen.generate(exportData);
    expect(plainLog).not.toContain('#'); // No markdown
    expect(plainLog).toContain('EXPORT LOG');
    
    const jsonLog = jsonGen.generate(exportData);
    expect(() => JSON.parse(jsonLog)).not.toThrow();
    expect(JSON.parse(jsonLog).summary.total).toBe(10);
  });
});
```

#### 5.2 Error and Warning Sections Testing
```typescript
// Test error/warning formatting
describe('Error and Warning Formatting', () => {
  test('should format errors prominently', () => {
    const generator = new LogGenerator();
    const exportData = {
      errors: [
        {
          severity: 'critical',
          zone: 'zone-1',
          message: 'Failed to process zone',
          details: 'Tool timeout after 30s'
        },
        {
          severity: 'error',
          zone: 'zone-2',
          message: 'Invalid content format',
          details: 'Expected text, found binary'
        }
      ]
    };
    
    const log = generator.generate(exportData);
    
    expect(log).toContain('## ⚠️ ERRORS');
    expect(log).toContain('### 🔴 Critical Errors');
    expect(log).toContain('Zone: zone-1');
    expect(log).toContain('### ❌ Errors');
    expect(log).toContain('Zone: zone-2');
  });

  test('should include recovery suggestions', () => {
    const generator = new LogGenerator({
      includeRecoverySuggestions: true
    });
    
    const exportData = {
      errors: [
        {
          code: 'TOOL_TIMEOUT',
          message: 'Processing timeout',
          suggestions: [
            'Increase timeout limit',
            'Use simpler processing tool',
            'Split zone into smaller parts'
          ]
        }
      ]
    };
    
    const log = generator.generate(exportData);
    
    expect(log).toContain('💡 Recovery Suggestions:');
    expect(log).toContain('1. Increase timeout limit');
    expect(log).toContain('2. Use simpler processing tool');
    expect(log).toContain('3. Split zone into smaller parts');
  });
});
```

### Story 3.2: Export Validation System - Complete Testing

### 6. SchemaValidator Component (`lib/export/validation/schema-validator.ts`)

#### 6.1 JSON Schema Validation Testing
```typescript
// Test schema validation
describe('JSON Schema Validation', () => {
  test('should validate against defined schemas', () => {
    const validator = new SchemaValidator();
    validator.loadSchema('rag', ragSchema);
    
    const validData = {
      id: 'chunk-1',
      content: 'Test content',
      metadata: {
        source: 'doc-123',
        pageNumber: 1,
        zoneId: 'zone-1',
        confidence: 0.95,
        timestamp: '2024-01-01T10:00:00Z',
        processingTool: 'tesseract'
      },
      chunkIndex: 0,
      totalChunks: 5
    };
    
    const result = validator.validate(validData, 'rag');
    
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test('should catch schema violations', () => {
    const validator = new SchemaValidator();
    validator.loadSchema('rag', ragSchema);
    
    const invalidData = {
      id: 'chunk-1',
      // Missing required 'content' field
      metadata: {
        source: 'doc-123',
        pageNumber: 'one', // Should be number
        confidence: 1.5 // Out of range
      }
    };
    
    const result = validator.validate(invalidData, 'rag');
    
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({
        field: 'content',
        message: expect.stringContaining('required')
      })
    );
    expect(result.errors).toContainEqual(
      expect.objectContaining({
        field: 'metadata.pageNumber',
        message: expect.stringContaining('number')
      })
    );
  });

  test('should validate custom formats', () => {
    const validator = new SchemaValidator();
    validator.addCustomFormat('confidence', {
      validate: (value) => typeof value === 'number' && value >= 0 && value <= 1,
      message: 'Must be a number between 0 and 1'
    });
    
    const schema = {
      type: 'object',
      properties: {
        confidence: { type: 'number', format: 'confidence' }
      }
    };
    
    validator.loadSchema('test', schema);
    
    expect(validator.validate({ confidence: 0.5 }, 'test').valid).toBe(true);
    expect(validator.validate({ confidence: 1.5 }, 'test').valid).toBe(false);
  });

  test('should handle nested validation', () => {
    const validator = new SchemaValidator();
    const schema = {
      type: 'object',
      properties: {
        data: {
          type: 'object',
          properties: {
            items: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  value: { type: 'number' }
                },
                required: ['id', 'value']
              }
            }
          }
        }
      }
    };
    
    validator.loadSchema('nested', schema);
    
    const validData = {
      data: {
        items: [
          { id: '1', value: 10 },
          { id: '2', value: 20 }
        ]
      }
    };
    
    const invalidData = {
      data: {
        items: [
          { id: '1', value: 10 },
          { id: '2' } // Missing value
        ]
      }
    };
    
    expect(validator.validate(validData, 'nested').valid).toBe(true);
    expect(validator.validate(invalidData, 'nested').valid).toBe(false);
  });
});
```

#### 6.2 Batch Validation Testing
```typescript
// Test batch validation capabilities
describe('Batch Schema Validation', () => {
  test('should validate multiple items efficiently', async () => {
    const validator = new SchemaValidator();
    validator.loadSchema('rag', ragSchema);
    
    const items = Array.from({ length: 1000 }, (_, i) => ({
      id: `chunk-${i}`,
      content: `Content ${i}`,
      metadata: {
        source: 'doc-123',
        pageNumber: Math.floor(i / 10) + 1,
        zoneId: `zone-${i}`,
        confidence: 0.8 + Math.random() * 0.2,
        timestamp: new Date().toISOString(),
        processingTool: 'tesseract'
      }
    }));
    
    const startTime = performance.now();
    const results = await validator.validateBatch(items, 'rag');
    const duration = performance.now() - startTime;
    
    expect(results.totalItems).toBe(1000);
    expect(results.validItems).toBe(1000);
    expect(duration).toBeLessThan(100); // Under 100ms for 1000 items
  });

  test('should collect all validation errors in batch', async () => {
    const validator = new SchemaValidator();
    validator.loadSchema('rag', ragSchema);
    
    const items = [
      { id: 'valid-1', content: 'Valid', metadata: {...} },
      { id: 'invalid-1', content: null, metadata: {...} }, // Invalid
      { id: 'valid-2', content: 'Valid', metadata: {...} },
      { id: 'invalid-2', metadata: {...} } // Missing content
    ];
    
    const results = await validator.validateBatch(items, 'rag');
    
    expect(results.validItems).toBe(2);
    expect(results.invalidItems).toBe(2);
    expect(results.errors['invalid-1']).toBeDefined();
    expect(results.errors['invalid-2']).toBeDefined();
  });

  test('should support parallel validation', async () => {
    const validator = new SchemaValidator({ parallel: true, workers: 4 });
    validator.loadSchema('complex', complexSchema);
    
    const items = generateComplexItems(10000);
    
    const startTime = performance.now();
    const results = await validator.validateBatch(items, 'complex');
    const duration = performance.now() - startTime;
    
    expect(results.totalItems).toBe(10000);
    expect(duration).toBeLessThan(1000); // Parallel should be faster
  });
});
```

### 7. ZoneValidator Component (`lib/export/validation/zone-validator.ts`)

#### 7.1 Zone Completeness Testing
```typescript
// Test zone completeness validation
describe('Zone Completeness Validation', () => {
  test('should check zone processing status', () => {
    const validator = new ZoneValidator();
    const zones = [
      { id: 'zone-1', status: 'processed', content: 'Text' },
      { id: 'zone-2', status: 'processed', content: 'More text' },
      { id: 'zone-3', status: 'failed', error: 'Timeout' },
      { id: 'zone-4', status: 'pending' }
    ];
    
    const result = validator.checkCompleteness(zones);
    
    expect(result.totalZones).toBe(4);
    expect(result.processedZones).toBe(2);
    expect(result.failedZones).toBe(1);
    expect(result.pendingZones).toBe(1);
    expect(result.completenessPercentage).toBe(50);
    expect(result.isComplete).toBe(false);
  });

  test('should validate minimum processing threshold', () => {
    const validator = new ZoneValidator({
      minimumProcessedPercentage: 95
    });
    
    const zones = Array.from({ length: 100 }, (_, i) => ({
      id: `zone-${i}`,
      status: i < 96 ? 'processed' : 'failed'
    }));
    
    const result = validator.checkCompleteness(zones);
    
    expect(result.completenessPercentage).toBe(96);
    expect(result.meetsThreshold).toBe(true);
  });

  test('should check for required zone types', () => {
    const validator = new ZoneValidator({
      requiredZoneTypes: ['header', 'body', 'footer']
    });
    
    const zones = [
      { id: 'z1', type: 'header', status: 'processed' },
      { id: 'z2', type: 'body', status: 'processed' },
      { id: 'z3', type: 'body', status: 'processed' }
      // Missing footer
    ];
    
    const result = validator.checkCompleteness(zones);
    
    expect(result.missingRequiredTypes).toContain('footer');
    expect(result.hasAllRequiredTypes).toBe(false);
  });

  test('should calculate weighted completeness', () => {
    const validator = new ZoneValidator({
      coverageCalculation: 'weighted',
      weightingFactors: {
        text: 1.0,
        table: 2.0,
        diagram: 3.0
      }
    });
    
    const zones = [
      { id: 'z1', type: 'text', status: 'processed', area: 100 },
      { id: 'z2', type: 'table', status: 'processed', area: 100 },
      { id: 'z3', type: 'diagram', status: 'failed', area: 100 }
    ];
    
    const result = validator.checkCompleteness(zones);
    
    // (1*100 + 2*100 + 0) / (1*100 + 2*100 + 3*100) = 300/600 = 50%
    expect(result.weightedCompleteness).toBe(50);
  });
});
```

#### 7.2 Zone Boundary Integrity Testing
```typescript
// Test zone boundary validation
describe('Zone Boundary Integrity', () => {
  test('should detect overlapping zones', () => {
    const validator = new ZoneValidator();
    const zones = [
      {
        id: 'zone-1',
        page: 1,
        coordinates: { x: 0, y: 0, width: 100, height: 100 }
      },
      {
        id: 'zone-2',
        page: 1,
        coordinates: { x: 50, y: 50, width: 100, height: 100 } // Overlaps
      }
    ];
    
    const result = validator.checkBoundaryIntegrity(zones);
    
    expect(result.hasOverlaps).toBe(true);
    expect(result.overlaps).toContainEqual({
      zone1: 'zone-1',
      zone2: 'zone-2',
      overlapArea: 2500 // 50x50
    });
  });

  test('should detect zones outside page bounds', () => {
    const validator = new ZoneValidator();
    const zones = [
      {
        id: 'zone-1',
        page: 1,
        coordinates: { x: 700, y: 500, width: 200, height: 100 }
      }
    ];
    
    const pageInfo = { width: 800, height: 600 };
    const result = validator.checkBoundaryIntegrity(zones, pageInfo);
    
    expect(result.outOfBounds).toContainEqual({
      zoneId: 'zone-1',
      issue: 'exceeds page width',
      excess: { x: 100, y: 0 }
    });
  });

  test('should validate zone connectivity', () => {
    const validator = new ZoneValidator();
    const zones = [
      { id: 'z1', page: 1, coordinates: { x: 0, y: 0, width: 100, height: 50 } },
      { id: 'z2', page: 1, coordinates: { x: 0, y: 50, width: 100, height: 50 } },
      { id: 'z3', page: 1, coordinates: { x: 200, y: 200, width: 50, height: 50 } } // Isolated
    ];
    
    const result = validator.checkConnectivity(zones);
    
    expect(result.connectedGroups).toHaveLength(2);
    expect(result.isolatedZones).toContain('z3');
  });
});
```

### 8. ErrorValidator Component (`lib/export/validation/error-validator.ts`)

#### 8.1 Error State Detection Testing
```typescript
// Test error state validation
describe('Error State Detection', () => {
  test('should detect processing failures', () => {
    const validator = new ErrorValidator();
    const exportData = {
      zones: [
        { id: 'z1', status: 'processed' },
        { id: 'z2', status: 'failed', error: { code: 'TIMEOUT' } },
        { id: 'z3', status: 'failed', error: { code: 'PARSE_ERROR' } }
      ],
      validation: {
        errors: ['Schema validation failed']
      }
    };
    
    const result = validator.checkErrorStates(exportData);
    
    expect(result.hasErrors).toBe(true);
    expect(result.errorCount).toBe(3);
    expect(result.errorsByType).toMatchObject({
      'TIMEOUT': 1,
      'PARSE_ERROR': 1,
      'VALIDATION': 1
    });
  });

  test('should assess error impact', () => {
    const validator = new ErrorValidator();
    const errors = [
      { severity: 'critical', affects: ['zone-1', 'zone-2'] },
      { severity: 'high', affects: ['zone-3'] },
      { severity: 'low', affects: ['zone-4'] }
    ];
    
    const result = validator.assessErrorImpact(errors);
    
    expect(result.criticalCount).toBe(1);
    expect(result.affectedZones).toBe(4);
    expect(result.blockingScore).toBeGreaterThan(50);
  });

  test('should check error recovery attempts', () => {
    const validator = new ErrorValidator();
    const errors = [
      {
        id: 'err-1',
        recoveryAttempts: [
          { strategy: 'retry', success: false },
          { strategy: 'fallback', success: true }
        ]
      },
      {
        id: 'err-2',
        recoveryAttempts: [
          { strategy: 'retry', success: false }
        ]
      }
    ];
    
    const result = validator.checkRecoveryStatus(errors);
    
    expect(result.recoveredErrors).toBe(1);
    expect(result.unrecoveredErrors).toBe(1);
    expect(result.recoveryRate).toBe(50);
  });

  test('should enforce error thresholds', () => {
    const validator = new ErrorValidator({
      maxCriticalErrors: 0,
      maxTotalErrors: 5,
      errorRateThreshold: 10
    });
    
    const exportData = {
      totalItems: 100,
      errors: [
        { severity: 'critical' },
        { severity: 'high' },
        { severity: 'medium' }
      ]
    };
    
    const result = validator.validateThresholds(exportData);
    
    expect(result.exceedsThreshold).toBe(true);
    expect(result.reasons).toContain('Critical errors exceed threshold');
  });
});
```

### 9. ContentValidator Component (`lib/export/validation/content-validator.ts`)

#### 9.1 Content Format Validation Testing
```typescript
// Test content format validation
describe('Content Format Validation', () => {
  test('should validate text formatting', () => {
    const validator = new ContentValidator();
    
    const validText = 'This is properly formatted text.';
    const invalidText = 'This contains \x00 null bytes';
    
    expect(validator.validateText(validText).valid).toBe(true);
    expect(validator.validateText(invalidText).valid).toBe(false);
    expect(validator.validateText(invalidText).errors).toContain('Invalid character');
  });

  test('should validate table structures', () => {
    const validator = new ContentValidator();
    
    const validTable = {
      headers: ['Name', 'Age'],
      rows: [
        ['John', '30'],
        ['Jane', '25']
      ]
    };
    
    const invalidTable = {
      headers: ['Name', 'Age'],
      rows: [
        ['John', '30'],
        ['Jane'] // Missing column
      ]
    };
    
    expect(validator.validateTable(validTable).valid).toBe(true);
    expect(validator.validateTable(invalidTable).valid).toBe(false);
    expect(validator.validateTable(invalidTable).errors).toContain('Inconsistent columns');
  });

  test('should validate content patterns', () => {
    const validator = new ContentValidator({
      patterns: {
        email: /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/,
        phone: /^\+?1?\d{10,14}$/
      }
    });
    
    const content = {
      email: 'test@example.com',
      phone: '+1234567890'
    };
    
    const invalidContent = {
      email: 'invalid-email',
      phone: '123'
    };
    
    expect(validator.validatePatterns(content).valid).toBe(true);
    expect(validator.validatePatterns(invalidContent).valid).toBe(false);
  });

  test('should check content encoding', () => {
    const validator = new ContentValidator();
    
    const utf8Content = 'Hello 世界';
    const asciiContent = 'Hello World';
    const binaryContent = Buffer.from([0xFF, 0xFE, 0x00, 0x01]);
    
    expect(validator.checkEncoding(utf8Content, 'utf-8').valid).toBe(true);
    expect(validator.checkEncoding(utf8Content, 'ascii').valid).toBe(false);
    expect(validator.checkEncoding(binaryContent, 'utf-8').valid).toBe(false);
  });
});
```

### 10. MetadataValidator Component (`lib/export/validation/metadata-validator.ts`)

#### 10.1 Metadata Completeness Testing
```typescript
// Test metadata validation
describe('Metadata Completeness Validation', () => {
  test('should check required fields', () => {
    const validator = new MetadataValidator({
      required: {
        global: ['id', 'timestamp', 'source'],
        perFormat: new Map([
          ['rag', ['pageNumber', 'zoneId', 'confidence']]
        ])
      }
    });
    
    const validMetadata = {
      id: 'item-1',
      timestamp: '2024-01-01T10:00:00Z',
      source: 'doc-123',
      pageNumber: 1,
      zoneId: 'zone-1',
      confidence: 0.95
    };
    
    const invalidMetadata = {
      id: 'item-1',
      timestamp: '2024-01-01T10:00:00Z'
      // Missing required fields
    };
    
    expect(validator.validate(validMetadata, 'rag').valid).toBe(true);
    expect(validator.validate(invalidMetadata, 'rag').valid).toBe(false);
  });

  test('should validate metadata formats', () => {
    const validator = new MetadataValidator();
    
    const metadata = {
      timestamp: '2024-01-01T10:00:00Z',
      uuid: '123e4567-e89b-12d3-a456-426614174000',
      confidence: 0.95
    };
    
    const result = validator.validateFormats(metadata);
    
    expect(result.timestamp.valid).toBe(true);
    expect(result.uuid.valid).toBe(true);
    expect(result.confidence.valid).toBe(true);
    
    // Test invalid formats
    const invalidMetadata = {
      timestamp: 'invalid-date',
      uuid: 'not-a-uuid',
      confidence: 1.5
    };
    
    const invalidResult = validator.validateFormats(invalidMetadata);
    expect(invalidResult.timestamp.valid).toBe(false);
    expect(invalidResult.uuid.valid).toBe(false);
    expect(invalidResult.confidence.valid).toBe(false);
  });

  test('should check reference integrity', () => {
    const validator = new MetadataValidator();
    const items = [
      { id: 'item-1', zoneId: 'zone-1', nextItem: 'item-2' },
      { id: 'item-2', zoneId: 'zone-2', previousItem: 'item-1' },
      { id: 'item-3', zoneId: 'zone-3', relatedItems: ['item-99'] } // Invalid reference
    ];
    
    const zones = [
      { id: 'zone-1' },
      { id: 'zone-2' },
      { id: 'zone-3' }
    ];
    
    const result = validator.checkReferenceIntegrity(items, zones);
    
    expect(result.brokenReferences).toContainEqual({
      item: 'item-3',
      field: 'relatedItems',
      invalidReference: 'item-99'
    });
  });

  test('should calculate metadata quality score', () => {
    const validator = new MetadataValidator();
    
    const highQualityMetadata = {
      id: 'item-1',
      timestamp: '2024-01-01T10:00:00Z',
      source: 'doc-123',
      confidence: 0.95,
      description: 'Detailed description',
      tags: ['tag1', 'tag2'],
      processingInfo: { tool: 'ocr', version: '1.0' }
    };
    
    const lowQualityMetadata = {
      id: 'item-2',
      timestamp: '2024-01-01T10:00:00Z'
    };
    
    expect(validator.calculateQualityScore(highQualityMetadata)).toBeGreaterThan(0.8);
    expect(validator.calculateQualityScore(lowQualityMetadata)).toBeLessThan(0.3);
  });
});
```

### Story 3.3: Partial Export Support - Complete Testing

### 11. SelectionPanel Component (`app/components/export/SelectionPanel.tsx`)

#### 11.1 Interactive Selection UI Testing
```typescript
// Test selection UI interactions
describe('Selection Panel UI', () => {
  test('should render zone selection interface', () => {
    const zones = [
      { id: 'zone-1', type: 'text', page: 1 },
      { id: 'zone-2', type: 'table', page: 1 },
      { id: 'zone-3', type: 'text', page: 2 }
    ];
    
    render(
      <SelectionPanel
        zones={zones}
        pages={[{ number: 1 }, { number: 2 }]}
        onSelectionChange={jest.fn()}
      />
    );
    
    expect(screen.getByText('Select Export Items')).toBeInTheDocument();
    expect(screen.getAllByRole('checkbox')).toHaveLength(zones.length + 2); // +2 for pages
    expect(screen.getByLabelText('Zone zone-1')).toBeInTheDocument();
  });

  test('should handle single zone selection', async () => {
    const onSelectionChange = jest.fn();
    render(
      <SelectionPanel
        zones={mockZones}
        pages={mockPages}
        onSelectionChange={onSelectionChange}
      />
    );
    
    await userEvent.click(screen.getByLabelText('Zone zone-1'));
    
    expect(onSelectionChange).toHaveBeenCalledWith(
      expect.objectContaining({
        items: expect.arrayContaining([
          expect.objectContaining({ id: 'zone-1' })
        ])
      })
    );
  });

  test('should support multi-select with ctrl/cmd', async () => {
    const onSelectionChange = jest.fn();
    render(
      <SelectionPanel
        zones={mockZones}
        pages={mockPages}
        onSelectionChange={onSelectionChange}
      />
    );
    
    await userEvent.click(screen.getByLabelText('Zone zone-1'));
    await userEvent.click(screen.getByLabelText('Zone zone-2'), { ctrlKey: true });
    await userEvent.click(screen.getByLabelText('Zone zone-3'), { ctrlKey: true });
    
    const lastCall = onSelectionChange.mock.calls[onSelectionChange.mock.calls.length - 1];
    expect(lastCall[0].items).toHaveLength(3);
  });

  test('should support range selection with shift', async () => {
    const onSelectionChange = jest.fn();
    render(
      <SelectionPanel
        zones={Array.from({ length: 10 }, (_, i) => ({
          id: `zone-${i}`,
          type: 'text',
          page: 1
        }))}
        pages={[{ number: 1 }]}
        onSelectionChange={onSelectionChange}
      />
    );
    
    await userEvent.click(screen.getByLabelText('Zone zone-2'));
    await userEvent.click(screen.getByLabelText('Zone zone-7'), { shiftKey: true });
    
    const lastCall = onSelectionChange.mock.calls[onSelectionChange.mock.calls.length - 1];
    expect(lastCall[0].items).toHaveLength(6); // zones 2-7
  });

  test('should handle page-based selection', async () => {
    const onSelectionChange = jest.fn();
    const zones = [
      { id: 'z1', page: 1 },
      { id: 'z2', page: 1 },
      { id: 'z3', page: 2 },
      { id: 'z4', page: 2 }
    ];
    
    render(
      <SelectionPanel
        zones={zones}
        pages={[{ number: 1 }, { number: 2 }]}
        onSelectionChange={onSelectionChange}
      />
    );
    
    await userEvent.click(screen.getByLabelText('Page 1'));
    
    const lastCall = onSelectionChange.mock.calls[onSelectionChange.mock.calls.length - 1];
    expect(lastCall[0].items).toHaveLength(2);
    expect(lastCall[0].items.every(item => item.page === 1)).toBe(true);
  });
});
```

#### 11.2 Selection Preview Testing
```typescript
// Test selection preview functionality
describe('Selection Preview', () => {
  test('should show selection preview', async () => {
    const { container } = render(
      <SelectionPanel
        zones={mockZones}
        pages={mockPages}
        onSelectionChange={jest.fn()}
        showPreview={true}
      />
    );
    
    await userEvent.click(screen.getByLabelText('Zone zone-1'));
    
    expect(screen.getByText('Selection Preview')).toBeInTheDocument();
    expect(screen.getByText('1 zone selected')).toBeInTheDocument();
    expect(container.querySelector('.preview-highlight')).toBeInTheDocument();
  });

  test('should update preview on selection change', async () => {
    render(
      <SelectionPanel
        zones={mockZones}
        pages={mockPages}
        onSelectionChange={jest.fn()}
        showPreview={true}
      />
    );
    
    await userEvent.click(screen.getByLabelText('Zone zone-1'));
    expect(screen.getByText('1 zone selected')).toBeInTheDocument();
    
    await userEvent.click(screen.getByLabelText('Zone zone-2'), { ctrlKey: true });
    expect(screen.getByText('2 zones selected')).toBeInTheDocument();
  });

  test('should show estimated export size', async () => {
    const zones = [
      { id: 'z1', content: 'A'.repeat(1000), estimatedSize: 1000 },
      { id: 'z2', content: 'B'.repeat(2000), estimatedSize: 2000 }
    ];
    
    render(
      <SelectionPanel
        zones={zones}
        pages={mockPages}
        onSelectionChange={jest.fn()}
        showPreview={true}
      />
    );
    
    await userEvent.click(screen.getByLabelText('Zone z1'));
    expect(screen.getByText('Estimated size: 1.0 KB')).toBeInTheDocument();
    
    await userEvent.click(screen.getByLabelText('Zone z2'), { ctrlKey: true });
    expect(screen.getByText('Estimated size: 3.0 KB')).toBeInTheDocument();
  });
});
```

#### 11.3 Selection Controls Testing
```typescript
// Test selection control buttons
describe('Selection Controls', () => {
  test('should handle select all', async () => {
    const onSelectionChange = jest.fn();
    render(
      <SelectionPanel
        zones={mockZones}
        pages={mockPages}
        onSelectionChange={onSelectionChange}
      />
    );
    
    await userEvent.click(screen.getByRole('button', { name: 'Select All' }));
    
    const lastCall = onSelectionChange.mock.calls[onSelectionChange.mock.calls.length - 1];
    expect(lastCall[0].items).toHaveLength(mockZones.length);
  });

  test('should handle select none', async () => {
    const onSelectionChange = jest.fn();
    render(
      <SelectionPanel
        zones={mockZones}
        pages={mockPages}
        onSelectionChange={onSelectionChange}
        currentSelection={{
          items: mockZones.map(z => ({ id: z.id, type: 'zone' }))
        }}
      />
    );
    
    await userEvent.click(screen.getByRole('button', { name: 'Clear Selection' }));
    
    const lastCall = onSelectionChange.mock.calls[onSelectionChange.mock.calls.length - 1];
    expect(lastCall[0].items).toHaveLength(0);
  });

  test('should handle invert selection', async () => {
    const onSelectionChange = jest.fn();
    const zones = [
      { id: 'z1' },
      { id: 'z2' },
      { id: 'z3' }
    ];
    
    render(
      <SelectionPanel
        zones={zones}
        pages={[]}
        onSelectionChange={onSelectionChange}
        currentSelection={{
          items: [{ id: 'z1', type: 'zone' }]
        }}
      />
    );
    
    await userEvent.click(screen.getByRole('button', { name: 'Invert Selection' }));
    
    const lastCall = onSelectionChange.mock.calls[onSelectionChange.mock.calls.length - 1];
    expect(lastCall[0].items).toHaveLength(2);
    expect(lastCall[0].items.map(i => i.id)).toEqual(['z2', 'z3']);
  });

  test('should filter zones by type', async () => {
    const zones = [
      { id: 'z1', type: 'text' },
      { id: 'z2', type: 'table' },
      { id: 'z3', type: 'text' },
      { id: 'z4', type: 'image' }
    ];
    
    render(
      <SelectionPanel
        zones={zones}
        pages={[]}
        onSelectionChange={jest.fn()}
      />
    );
    
    await userEvent.selectOptions(
      screen.getByLabelText('Filter by type'),
      'text'
    );
    
    expect(screen.queryByLabelText('Zone z2')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Zone z4')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Zone z1')).toBeInTheDocument();
    expect(screen.getByLabelText('Zone z3')).toBeInTheDocument();
  });
});
```

### 12. ExportSelectionStore Testing
```typescript
// Test selection state management
describe('Export Selection Store', () => {
  test('should initialize with empty selection', () => {
    const store = new ExportSelectionStore();
    
    expect(store.getSelection()).toEqual({
      items: [],
      metadata: expect.any(Object)
    });
  });

  test('should add items to selection', () => {
    const store = new ExportSelectionStore();
    
    store.addItem({ id: 'zone-1', type: 'zone' });
    store.addItem({ id: 'zone-2', type: 'zone' });
    
    expect(store.getSelection().items).toHaveLength(2);
  });

  test('should validate selection conflicts', () => {
    const store = new ExportSelectionStore();
    
    // Add page selection
    store.selectPage(1, ['zone-1', 'zone-2']);
    
    // Try to add individual zone from same page - should detect conflict
    const result = store.addItem({ id: 'zone-1', type: 'zone' });
    
    expect(result.hasConflict).toBe(true);
    expect(result.conflictType).toBe('already_in_page_selection');
  });

  test('should maintain selection history', () => {
    const store = new ExportSelectionStore();
    
    store.addItem({ id: 'zone-1', type: 'zone' });
    store.addItem({ id: 'zone-2', type: 'zone' });
    store.removeItem('zone-1');
    
    expect(store.canUndo()).toBe(true);
    
    store.undo();
    expect(store.getSelection().items).toHaveLength(2);
    
    expect(store.canRedo()).toBe(true);
    store.redo();
    expect(store.getSelection().items).toHaveLength(1);
  });

  test('should persist selection', () => {
    const store = new ExportSelectionStore();
    
    store.addItem({ id: 'zone-1', type: 'zone' });
    store.addItem({ id: 'zone-2', type: 'zone' });
    
    const saved = store.serialize();
    
    const newStore = new ExportSelectionStore();
    newStore.deserialize(saved);
    
    expect(newStore.getSelection().items).toHaveLength(2);
  });
});
```

### 13. PartialExportEngine Testing
```typescript
// Test partial export engine
describe('Partial Export Engine', () => {
  test('should export selected zones only', async () => {
    const engine = new PartialExportEngine();
    const selection = {
      items: [
        { id: 'zone-1', type: 'zone' },
        { id: 'zone-3', type: 'zone' }
      ]
    };
    
    const allZones = [
      { id: 'zone-1', content: 'Content 1' },
      { id: 'zone-2', content: 'Content 2' },
      { id: 'zone-3', content: 'Content 3' }
    ];
    
    const result = await engine.exportPartial(selection, allZones, ['rag']);
    
    expect(result.exportedItems).toHaveLength(2);
    expect(result.exportedItems.map(i => i.id)).toEqual(['zone-1', 'zone-3']);
  });

  test('should preserve references in partial export', async () => {
    const engine = new PartialExportEngine({
      preserveReferences: true
    });
    
    const selection = {
      items: [{ id: 'zone-2', type: 'zone' }]
    };
    
    const zones = [
      { id: 'zone-1', content: 'See zone 2' },
      { id: 'zone-2', content: 'Referenced by zone 1', references: ['zone-1'] },
      { id: 'zone-3', content: 'Unrelated' }
    ];
    
    const result = await engine.exportPartial(selection, zones, ['rag']);
    
    expect(result.references).toContainEqual({
      from: 'zone-2',
      to: 'zone-1',
      type: 'referenced_by',
      included: false,
      placeholder: '[Reference to zone-1 not included in export]'
    });
  });

  test('should include context if requested', async () => {
    const engine = new PartialExportEngine({
      includeContext: true,
      contextSize: 100
    });
    
    const selection = {
      items: [{ id: 'zone-2', type: 'zone' }]
    };
    
    const zones = [
      { id: 'zone-1', content: 'Previous paragraph that provides context.' },
      { id: 'zone-2', content: 'Selected content.' },
      { id: 'zone-3', content: 'Following paragraph with more context.' }
    ];
    
    const result = await engine.exportPartial(selection, zones, ['rag']);
    
    expect(result.exportedItems[0].context).toMatchObject({
      before: expect.stringContaining('Previous paragraph'),
      after: expect.stringContaining('Following paragraph')
    });
  });

  test('should validate partial export completeness', async () => {
    const engine = new PartialExportEngine({
      validateCompleteness: true
    });
    
    const selection = {
      items: [
        { id: 'table-header', type: 'zone' }
        // Missing table body
      ]
    };
    
    const zones = [
      { id: 'table-header', type: 'table-header', relatedZones: ['table-body'] },
      { id: 'table-body', type: 'table-body' }
    ];
    
    const result = await engine.exportPartial(selection, zones, ['rag']);
    
    expect(result.validation.warnings).toContainEqual(
      expect.objectContaining({
        type: 'incomplete_table',
        message: 'Table header selected without body'
      })
    );
  });
});
```

### Story 3.4: Export Logging System - Complete Testing

### 14. ExportLogger Component (`lib/export/logging/export-logger.ts`)

#### 14.1 Export Operation Logging Testing
```typescript
// Test export operation logging
describe('Export Operation Logging', () => {
  test('should log export initiation', () => {
    const logger = new ExportLogger();
    
    const exportConfig = {
      exportId: 'exp-123',
      documentId: 'doc-456',
      formats: ['rag', 'jsonl'],
      userId: 'user-789'
    };
    
    logger.logExportStart(exportConfig);
    
    const logs = logger.getLogs();
    expect(logs[0]).toMatchObject({
      level: 'info',
      category: 'export.initiated',
      operation: 'export_start',
      metadata: expect.objectContaining({
        exportId: 'exp-123',
        formats: ['rag', 'jsonl']
      })
    });
  });

  test('should log export progress milestones', () => {
    const logger = new ExportLogger();
    
    logger.logProgress('exp-123', {
      phase: 'validation',
      progress: 50,
      currentItem: 'zone-25'
    });
    
    const logs = logger.getLogs({ exportId: 'exp-123' });
    expect(logs[0]).toMatchObject({
      category: 'export.progress',
      metadata: expect.objectContaining({
        phase: 'validation',
        progress: 50
      })
    });
  });

  test('should log export completion', () => {
    const logger = new ExportLogger();
    
    logger.logExportComplete('exp-123', {
      duration: 5423,
      itemsExported: 100,
      outputSize: 1024 * 1024
    });
    
    const logs = logger.getLogs({ category: 'export.completed' });
    expect(logs[0]).toMatchObject({
      level: 'info',
      performance: expect.objectContaining({
        duration: 5423,
        itemsPerSecond: expect.any(Number)
      })
    });
  });

  test('should include contextual information', () => {
    const logger = new ExportLogger();
    
    logger.setContext({
      sessionId: 'session-123',
      environment: 'production'
    });
    
    logger.logExportStart({ exportId: 'exp-123' });
    
    const logs = logger.getLogs();
    expect(logs[0].metadata).toMatchObject({
      sessionId: 'session-123',
      environment: 'production'
    });
  });
});
```

#### 14.2 User Action Logging Testing
```typescript
// Test user action tracking
describe('User Action Logging', () => {
  test('should log user export actions', () => {
    const logger = new ExportLogger();
    
    logger.logUserAction({
      userId: 'user-123',
      action: 'select_zones',
      details: {
        zoneCount: 15,
        selectionMethod: 'manual'
      }
    });
    
    const logs = logger.getLogs({ userId: 'user-123' });
    expect(logs[0]).toMatchObject({
      category: 'user.action',
      metadata: expect.objectContaining({
        action: 'select_zones',
        details: expect.objectContaining({
          zoneCount: 15
        })
      })
    });
  });

  test('should track user decision points', () => {
    const logger = new ExportLogger();
    
    logger.logDecision({
      userId: 'user-123',
      decision: 'override_validation',
      reason: 'Known false positive',
      context: {
        validationRule: 'min_confidence',
        originalValue: 0.7
      }
    });
    
    const logs = logger.getLogs({ category: 'user.decision' });
    expect(logs[0].metadata.reason).toBe('Known false positive');
  });
});
```

### 15. ValidationLogger Testing
```typescript
// Test validation logging
describe('Validation Logging', () => {
  test('should log validation rule execution', () => {
    const logger = new ValidationLogger();
    
    logger.logRuleExecution({
      ruleId: 'schema_validation',
      ruleName: 'RAG Schema Validation',
      input: { id: 'chunk-1', content: 'test' },
      result: 'pass',
      executionTime: 15
    });
    
    const logs = logger.getLogs();
    expect(logs[0]).toMatchObject({
      category: 'validation.rule_executed',
      metadata: expect.objectContaining({
        ruleId: 'schema_validation',
        result: 'pass',
        executionTime: 15
      })
    });
  });

  test('should log validation failures with details', () => {
    const logger = new ValidationLogger();
    
    logger.logValidationFailure({
      ruleId: 'content_length',
      input: { content: 'Hi' },
      expected: 'minLength: 10',
      actual: 'length: 2',
      impact: 'blocking'
    });
    
    const logs = logger.getLogs({ category: 'validation.failed' });
    expect(logs[0]).toMatchObject({
      level: 'error',
      metadata: expect.objectContaining({
        impact: 'blocking',
        details: expect.objectContaining({
          expected: 'minLength: 10',
          actual: 'length: 2'
        })
      })
    });
  });

  test('should log validation overrides', () => {
    const logger = new ValidationLogger();
    
    logger.logOverride({
      ruleId: 'confidence_threshold',
      overriddenBy: 'user-123',
      justification: 'Manual review confirmed accuracy',
      originalResult: 'fail',
      overrideResult: 'pass'
    });
    
    const logs = logger.getLogs({ category: 'validation.overridden' });
    expect(logs[0]).toMatchObject({
      level: 'warn',
      metadata: expect.objectContaining({
        overriddenBy: 'user-123',
        justification: 'Manual review confirmed accuracy'
      })
    });
  });

  test('should aggregate validation statistics', () => {
    const logger = new ValidationLogger();
    
    // Log multiple validations
    logger.logRuleExecution({ ruleId: 'r1', result: 'pass' });
    logger.logRuleExecution({ ruleId: 'r2', result: 'pass' });
    logger.logRuleExecution({ ruleId: 'r3', result: 'fail' });
    
    const stats = logger.getValidationStats();
    
    expect(stats).toMatchObject({
      totalValidations: 3,
      passed: 2,
      failed: 1,
      passRate: 66.67,
      byRule: expect.any(Object)
    });
  });
});
```

### 16. PerformanceLogger Testing
```typescript
// Test performance logging
describe('Performance Logging', () => {
  test('should log detailed timing breakdowns', () => {
    const logger = new PerformanceLogger();
    
    logger.startOperation('export-123', 'full_export');
    
    logger.startPhase('preparation');
    // Simulate work
    logger.endPhase('preparation');
    
    logger.startPhase('validation');
    // Simulate work
    logger.endPhase('validation');
    
    logger.endOperation('export-123');
    
    const logs = logger.getLogs({ operationId: 'export-123' });
    expect(logs[0].performance.phases).toMatchObject({
      preparation: expect.any(Number),
      validation: expect.any(Number)
    });
  });

  test('should track resource usage', () => {
    const logger = new PerformanceLogger();
    
    logger.logResourceSnapshot('export-123', {
      memoryUsed: 256 * 1024 * 1024,
      cpuUsage: 45.5,
      activeConnections: 3
    });
    
    const logs = logger.getLogs();
    expect(logs[0]).toMatchObject({
      category: 'performance.resources',
      performance: expect.objectContaining({
        memoryUsed: 256 * 1024 * 1024,
        cpuUsage: 45.5
      })
    });
  });

  test('should identify performance bottlenecks', () => {
    const logger = new PerformanceLogger();
    
    logger.logBottleneck({
      operation: 'zone_processing',
      phase: 'ocr_extraction',
      duration: 5000,
      threshold: 1000,
      impact: 'high',
      suggestions: [
        'Consider using faster OCR engine',
        'Implement parallel processing'
      ]
    });
    
    const logs = logger.getLogs({ category: 'performance.bottleneck' });
    expect(logs[0].metadata.suggestions).toHaveLength(2);
  });

  test('should calculate performance trends', () => {
    const logger = new PerformanceLogger();
    
    // Log multiple operations
    for (let i = 0; i < 10; i++) {
      logger.logOperation({
        operationId: `op-${i}`,
        duration: 1000 + i * 100,
        itemCount: 100
      });
    }
    
    const trends = logger.getPerformanceTrends();
    
    expect(trends).toMatchObject({
      averageDuration: expect.any(Number),
      trend: 'increasing',
      degradationRate: expect.any(Number)
    });
  });
});
```

### 17. AuditTrail Testing
```typescript
// Test audit trail integrity
describe('Audit Trail System', () => {
  test('should create tamper-proof audit entries', () => {
    const audit = new AuditTrail();
    
    const entry = audit.addEntry({
      action: 'export_initiated',
      actor: { userId: 'user-123', role: 'admin' },
      resource: { type: 'document', id: 'doc-456' }
    });
    
    expect(entry).toMatchObject({
      entryId: expect.any(String),
      hash: expect.any(String),
      previousHash: expect.any(String),
      signature: expect.any(String)
    });
  });

  test('should verify audit chain integrity', () => {
    const audit = new AuditTrail();
    
    // Add multiple entries
    audit.addEntry({ action: 'action1' });
    audit.addEntry({ action: 'action2' });
    audit.addEntry({ action: 'action3' });
    
    const verification = audit.verifyIntegrity();
    
    expect(verification.valid).toBe(true);
    expect(verification.brokenLinks).toHaveLength(0);
  });

  test('should detect tampering', () => {
    const audit = new AuditTrail();
    
    audit.addEntry({ action: 'action1' });
    const entry2 = audit.addEntry({ action: 'action2' });
    audit.addEntry({ action: 'action3' });
    
    // Tamper with entry
    entry2.content.action = 'modified_action';
    
    const verification = audit.verifyIntegrity();
    
    expect(verification.valid).toBe(false);
    expect(verification.tamperedEntries).toContain(entry2.entryId);
  });

  test('should support audit queries', () => {
    const audit = new AuditTrail();
    
    // Add various entries
    audit.addEntry({
      action: 'export_initiated',
      actor: { userId: 'user-123' },
      timestamp: '2024-01-01T10:00:00Z'
    });
    
    audit.addEntry({
      action: 'validation_override',
      actor: { userId: 'user-456' },
      timestamp: '2024-01-01T11:00:00Z'
    });
    
    const results = audit.query({
      filters: { actor: { userId: 'user-123' } },
      timeRange: {
        start: '2024-01-01T00:00:00Z',
        end: '2024-01-02T00:00:00Z'
      }
    });
    
    expect(results).toHaveLength(1);
    expect(results[0].content.action).toBe('export_initiated');
  });
});
```

### 18. LogAnalyzer Component Testing
```typescript
// Test log analysis UI
describe('Log Analyzer Component', () => {
  test('should display log search interface', () => {
    render(<LogAnalyzer logs={mockLogs} />);
    
    expect(screen.getByPlaceholderText('Search logs...')).toBeInTheDocument();
    expect(screen.getByLabelText('Log Level')).toBeInTheDocument();
    expect(screen.getByLabelText('Category')).toBeInTheDocument();
    expect(screen.getByLabelText('Time Range')).toBeInTheDocument();
  });

  test('should filter logs by search query', async () => {
    const logs = [
      { id: '1', message: 'Export started', level: 'info' },
      { id: '2', message: 'Validation failed', level: 'error' },
      { id: '3', message: 'Export completed', level: 'info' }
    ];
    
    render(<LogAnalyzer logs={logs} />);
    
    await userEvent.type(
      screen.getByPlaceholderText('Search logs...'),
      'export'
    );
    
    expect(screen.getByText('Export started')).toBeInTheDocument();
    expect(screen.getByText('Export completed')).toBeInTheDocument();
    expect(screen.queryByText('Validation failed')).not.toBeInTheDocument();
  });

  test('should show log aggregations', () => {
    render(<LogAnalyzer logs={mockLogs} showAggregations={true} />);
    
    expect(screen.getByText('Log Statistics')).toBeInTheDocument();
    expect(screen.getByText('Total Logs:')).toBeInTheDocument();
    expect(screen.getByText('Error Rate:')).toBeInTheDocument();
    expect(screen.getByText('Most Common Categories:')).toBeInTheDocument();
  });

  test('should visualize log timeline', () => {
    const { container } = render(
      <LogAnalyzer logs={mockLogs} showTimeline={true} />
    );
    
    expect(container.querySelector('.log-timeline')).toBeInTheDocument();
    expect(container.querySelector('.timeline-chart')).toBeInTheDocument();
  });

  test('should export filtered logs', async () => {
    const onExport = jest.fn();
    render(
      <LogAnalyzer 
        logs={mockLogs} 
        onExport={onExport}
      />
    );
    
    // Apply filters
    await userEvent.selectOptions(
      screen.getByLabelText('Log Level'),
      'error'
    );
    
    await userEvent.click(screen.getByRole('button', { name: 'Export Logs' }));
    
    expect(onExport).toHaveBeenCalledWith(
      expect.objectContaining({
        filters: expect.objectContaining({ level: 'error' })
      })
    );
  });
});
```

## Integration and Performance Testing

### 19. End-to-End Export Testing
```typescript
// Test complete export workflows
describe('E2E Export Workflows', () => {
  test('should complete full document export', async () => {
    const { exportManager, zones, document } = setupTestEnvironment();
    
    // Start export
    const exportId = await exportManager.startExport({
      documentId: document.id,
      formats: ['rag', 'jsonl', 'corrections'],
      options: {
        includeMetadata: true,
        validateOutput: true
      }
    });
    
    // Wait for completion
    const result = await waitForExportCompletion(exportId);
    
    expect(result.status).toBe('completed');
    expect(result.outputs).toHaveLength(3);
    expect(result.validation.allPassed).toBe(true);
    expect(result.logs.length).toBeGreaterThan(0);
  });

  test('should handle partial export with validation', async () => {
    const { exportManager, selectionUI } = setupTestEnvironment();
    
    // Make selection
    await selectionUI.selectZones(['zone-1', 'zone-5', 'zone-10']);
    
    // Start partial export
    const exportId = await exportManager.startPartialExport({
      selection: selectionUI.getSelection(),
      formats: ['rag'],
      validateCompleteness: true
    });
    
    const result = await waitForExportCompletion(exportId);
    
    expect(result.exportedItems).toHaveLength(3);
    expect(result.validation.warnings).toContain(
      expect.objectContaining({ type: 'partial_content' })
    );
  });

  test('should recover from export failures', async () => {
    const { exportManager } = setupTestEnvironment();
    
    // Simulate failure condition
    mockStorageFailure();
    
    const exportId = await exportManager.startExport({
      documentId: 'doc-123',
      formats: ['rag']
    });
    
    // First attempt fails
    await waitForExportStatus(exportId, 'failed');
    
    // Retry with recovery
    restoreStorage();
    const retryResult = await exportManager.retry(exportId);
    
    expect(retryResult.status).toBe('completed');
    expect(retryResult.recoveryApplied).toBe(true);
  });
});
```

### 20. Performance Benchmarking
```typescript
// Test export performance
describe('Export Performance Benchmarks', () => {
  test('should meet performance targets for large documents', async () => {
    const zones = generateLargeDataset(10000); // 10k zones
    const exporter = new ExportManager();
    
    const startTime = performance.now();
    
    const result = await exporter.export({
      zones,
      formats: ['rag', 'jsonl'],
      options: { parallel: true }
    });
    
    const duration = performance.now() - startTime;
    const throughput = zones.length / (duration / 1000);
    
    expect(duration).toBeLessThan(10000); // Under 10 seconds
    expect(throughput).toBeGreaterThan(1000); // >1000 zones/second
    expect(result.memoryPeak).toBeLessThan(500 * 1024 * 1024); // <500MB
  });

  test('should handle concurrent exports efficiently', async () => {
    const exporter = new ExportManager({ maxConcurrent: 5 });
    
    // Start multiple exports
    const exports = Array.from({ length: 10 }, (_, i) => 
      exporter.export({
        documentId: `doc-${i}`,
        zones: generateZones(100),
        formats: ['rag']
      })
    );
    
    const startTime = performance.now();
    const results = await Promise.all(exports);
    const duration = performance.now() - startTime;
    
    expect(results.every(r => r.status === 'completed')).toBe(true);
    expect(duration).toBeLessThan(5000); // Parallel processing benefit
  });

  test('should maintain responsiveness during export', async () => {
    const exporter = new ExportManager();
    const progressEvents = [];
    
    exporter.on('progress', (event) => {
      progressEvents.push({
        timestamp: Date.now(),
        progress: event.progress
      });
    });
    
    await exporter.export({
      zones: generateLargeDataset(5000),
      formats: ['rag']
    });
    
    // Check progress update frequency
    const intervals = progressEvents.slice(1).map((e, i) => 
      e.timestamp - progressEvents[i].timestamp
    );
    
    expect(Math.max(...intervals)).toBeLessThan(100); // Max 100ms between updates
  });
});
```

## Accessibility Testing

### 21. Export UI Accessibility
```typescript
// Test accessibility compliance
describe('Export System Accessibility', () => {
  test('should have proper ARIA labels', () => {
    render(<ExportPanel zones={mockZones} />);
    
    expect(screen.getByRole('region', { name: 'Export Options' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start Export' })).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-label');
  });

  test('should be keyboard navigable', async () => {
    render(<SelectionPanel zones={mockZones} />);
    
    // Tab through interface
    await userEvent.tab();
    expect(screen.getByLabelText('Zone zone-1')).toHaveFocus();
    
    // Space to select
    await userEvent.keyboard(' ');
    expect(screen.getByLabelText('Zone zone-1')).toBeChecked();
    
    // Arrow navigation
    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getByLabelText('Zone zone-2')).toHaveFocus();
  });

  test('should announce export status changes', async () => {
    render(<ExportPanel zones={mockZones} />);
    
    await userEvent.click(screen.getByRole('button', { name: 'Start Export' }));
    
    expect(screen.getByRole('status')).toHaveTextContent('Export in progress');
    
    // After completion
    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent('Export completed successfully');
    });
  });

  test('should support screen reader navigation', () => {
    render(<ValidationReport validationResults={mockValidationResults} />);
    
    expect(screen.getByRole('heading', { name: 'Validation Report' })).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Validation Errors' })).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(mockValidationResults.errors.length);
  });
});
```

## Summary

This granular testing guide for Epic 3 Export System provides:

1. **Story 3.1 Coverage**: RAG generation, JSONL formatting, corrections export, manifest generation, and readable logs
2. **Story 3.2 Coverage**: Schema validation, zone completeness, error detection, content validation, and metadata checks  
3. **Story 3.3 Coverage**: Selection UI, state management, partial export engine, and batch operations
4. **Story 3.4 Coverage**: Operation logging, validation tracking, performance metrics, and audit trails

Each component has comprehensive tests covering:
- Happy path scenarios
- Edge cases and error conditions
- Performance requirements
- Integration with other components
- Accessibility compliance

The tests ensure the export system meets all functional requirements while maintaining high quality and performance standards.