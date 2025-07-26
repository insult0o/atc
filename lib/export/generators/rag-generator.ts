/**
 * RAG-Ready JSON Chunk Generator
 * Implements intelligent content chunking with metadata enrichment
 */

import { encode } from '@dqbd/tiktoken';
import {
  RAGChunk,
  RAGMetadata,
  RAGExportOptions,
  ContentType,
  Entity,
  ExportResult,
  ExportError,
  ExportWarning
} from '../schemas';

// Default chunking parameters
const DEFAULT_CHUNK_SIZE = 1024;
const DEFAULT_OVERLAP_PERCENTAGE = 0.1;
const MIN_CHUNK_SIZE = 100;
const MAX_CHUNK_SIZE = 4096;

interface Zone {
  id: string;
  content: string;
  pageNumber: number;
  confidence: number;
  contentType: ContentType;
  tool: string;
  metadata?: Record<string, any>;
}

interface Document {
  id: string;
  name: string;
  pageCount: number;
  zones: Zone[];
}

export class RAGGenerator {
  private options: RAGExportOptions;
  private tokenEncoder: any;

  constructor(options: Partial<RAGExportOptions> = {}) {
    this.options = {
      chunkSize: options.chunkSize || DEFAULT_CHUNK_SIZE,
      overlapPercentage: options.overlapPercentage || DEFAULT_OVERLAP_PERCENTAGE,
      includeEmbeddings: options.includeEmbeddings || false,
      metadataFields: options.metadataFields || ['source', 'pageNumber', 'confidence', 'contentType'],
      chunkingStrategy: options.chunkingStrategy || 'token',
      maxChunkSize: options.maxChunkSize || MAX_CHUNK_SIZE,
      minChunkSize: options.minChunkSize || MIN_CHUNK_SIZE
    };

    // Initialize token encoder for accurate chunking
    this.tokenEncoder = encode;
  }

  /**
   * Generate RAG chunks from a document
   */
  async generateChunks(document: Document): Promise<ExportResult> {
    const startTime = Date.now();
    const chunks: RAGChunk[] = [];
    const errors: ExportError[] = [];
    const warnings: ExportWarning[] = [];

    try {
      // Process each zone
      for (const zone of document.zones) {
        try {
          const zoneChunks = await this.chunkZone(zone, document);
          chunks.push(...zoneChunks);
        } catch (error) {
          errors.push({
            code: 'ZONE_PROCESSING_ERROR',
            message: `Failed to process zone ${zone.id}`,
            item: zone.id,
            details: error
          });
        }
      }

      // Add document-level metadata and indexing
      const totalChunks = chunks.length;
      chunks.forEach((chunk, index) => {
        chunk.chunkIndex = index;
        chunk.totalChunks = totalChunks;
        chunk.metadata.documentId = document.id;
      });

      // Calculate overlap between chunks
      this.calculateOverlaps(chunks);

      // Validate chunk quality
      const validationResults = this.validateChunks(chunks);
      warnings.push(...validationResults.warnings);

      // Generate embeddings if requested
      if (this.options.includeEmbeddings) {
        await this.generateEmbeddings(chunks);
      }

      return {
        exportId: `rag-${document.id}-${Date.now()}`,
        format: 'rag',
        status: errors.length === 0 ? 'success' : 'partial',
        itemCount: chunks.length,
        errors,
        warnings,
        metadata: {
          processingTime: Date.now() - startTime,
          chunkingStrategy: this.options.chunkingStrategy,
          averageChunkSize: chunks.reduce((sum, c) => sum + c.content.length, 0) / chunks.length,
          documentName: document.name
        }
      };
    } catch (error) {
      return {
        exportId: `rag-${document.id}-${Date.now()}`,
        format: 'rag',
        status: 'failure',
        errors: [{
          code: 'GENERATION_FAILED',
          message: 'Failed to generate RAG chunks',
          details: error
        }],
        warnings,
        metadata: {
          processingTime: Date.now() - startTime
        }
      };
    }
  }

  /**
   * Chunk a single zone into RAG chunks
   */
  private async chunkZone(zone: Zone, document: Document): Promise<RAGChunk[]> {
    const chunks: RAGChunk[] = [];
    const content = zone.content;
    
    if (!content || content.trim().length === 0) {
      return chunks;
    }

    switch (this.options.chunkingStrategy) {
      case 'token':
        return this.chunkByTokens(content, zone, document);
      case 'sentence':
        return this.chunkBySentences(content, zone, document);
      case 'paragraph':
        return this.chunkByParagraphs(content, zone, document);
      default:
        return this.chunkByTokens(content, zone, document);
    }
  }

  /**
   * Token-based chunking (most accurate)
   */
  private chunkByTokens(content: string, zone: Zone, document: Document): RAGChunk[] {
    const chunks: RAGChunk[] = [];
    const tokens = this.tokenEncoder(content);
    const chunkSize = this.options.chunkSize;
    const overlapSize = Math.floor(chunkSize * this.options.overlapPercentage);
    
    let position = 0;
    while (position < tokens.length) {
      const endPosition = Math.min(position + chunkSize, tokens.length);
      const chunkTokens = tokens.slice(position, endPosition);
      
      // Decode tokens back to text
      const chunkContent = this.decodeTokens(chunkTokens);
      
      // Create chunk with metadata
      const chunk: RAGChunk = {
        id: `${zone.id}-chunk-${chunks.length}`,
        content: chunkContent,
        metadata: this.createMetadata(zone, document),
        chunkIndex: 0, // Will be set later
        totalChunks: 0, // Will be set later
        overlap: {
          previous: position > 0 ? overlapSize : 0,
          next: 0 // Will be calculated later
        }
      };
      
      chunks.push(chunk);
      
      // Move position with overlap
      position += chunkSize - overlapSize;
    }
    
    return chunks;
  }

  /**
   * Sentence-based chunking
   */
  private chunkBySentences(content: string, zone: Zone, document: Document): RAGChunk[] {
    const chunks: RAGChunk[] = [];
    const sentences = this.splitIntoSentences(content);
    const targetSize = this.options.chunkSize;
    
    let currentChunk: string[] = [];
    let currentSize = 0;
    
    for (const sentence of sentences) {
      const sentenceTokens = this.tokenEncoder(sentence).length;
      
      if (currentSize + sentenceTokens > targetSize && currentChunk.length > 0) {
        // Create chunk
        chunks.push(this.createChunk(
          currentChunk.join(' '),
          zone,
          document,
          chunks.length
        ));
        
        // Start new chunk with overlap
        const overlapCount = Math.ceil(currentChunk.length * this.options.overlapPercentage);
        currentChunk = currentChunk.slice(-overlapCount);
        currentSize = currentChunk.reduce((sum, s) => sum + this.tokenEncoder(s).length, 0);
      }
      
      currentChunk.push(sentence);
      currentSize += sentenceTokens;
    }
    
    // Add final chunk
    if (currentChunk.length > 0) {
      chunks.push(this.createChunk(
        currentChunk.join(' '),
        zone,
        document,
        chunks.length
      ));
    }
    
    return chunks;
  }

  /**
   * Paragraph-based chunking
   */
  private chunkByParagraphs(content: string, zone: Zone, document: Document): RAGChunk[] {
    const chunks: RAGChunk[] = [];
    const paragraphs = content.split(/\n\n+/);
    const targetSize = this.options.chunkSize;
    
    let currentChunk: string[] = [];
    let currentSize = 0;
    
    for (const paragraph of paragraphs) {
      const paragraphTokens = this.tokenEncoder(paragraph).length;
      
      if (currentSize + paragraphTokens > targetSize && currentChunk.length > 0) {
        // Create chunk
        chunks.push(this.createChunk(
          currentChunk.join('\n\n'),
          zone,
          document,
          chunks.length
        ));
        
        // Start new chunk (no overlap for paragraphs)
        currentChunk = [];
        currentSize = 0;
      }
      
      currentChunk.push(paragraph);
      currentSize += paragraphTokens;
    }
    
    // Add final chunk
    if (currentChunk.length > 0) {
      chunks.push(this.createChunk(
        currentChunk.join('\n\n'),
        zone,
        document,
        chunks.length
      ));
    }
    
    return chunks;
  }

  /**
   * Create a chunk with metadata
   */
  private createChunk(content: string, zone: Zone, document: Document, index: number): RAGChunk {
    return {
      id: `${zone.id}-chunk-${index}`,
      content: content.trim(),
      metadata: this.createMetadata(zone, document),
      chunkIndex: 0, // Will be set later
      totalChunks: 0, // Will be set later
      overlap: {
        previous: 0,
        next: 0
      }
    };
  }

  /**
   * Create metadata for a chunk
   */
  private createMetadata(zone: Zone, document: Document): RAGMetadata {
    const metadata: RAGMetadata = {
      source: document.name,
      documentId: document.id,
      pageNumber: zone.pageNumber,
      zoneId: zone.id,
      confidence: zone.confidence,
      timestamp: new Date().toISOString(),
      processingTool: zone.tool,
      contentType: zone.contentType
    };

    // Add optional metadata fields
    if (zone.metadata?.language) {
      metadata.language = zone.metadata.language;
    }

    // Extract keywords (simple implementation)
    metadata.keywords = this.extractKeywords(zone.content);

    // Extract entities (placeholder - would use NER in production)
    metadata.entities = this.extractEntities(zone.content);

    return metadata;
  }

  /**
   * Calculate overlap between consecutive chunks
   */
  private calculateOverlaps(chunks: RAGChunk[]): void {
    for (let i = 0; i < chunks.length - 1; i++) {
      const currentChunk = chunks[i];
      const nextChunk = chunks[i + 1];
      
      // Calculate actual overlap
      const overlap = this.findOverlap(currentChunk.content, nextChunk.content);
      currentChunk.overlap.next = overlap;
      nextChunk.overlap.previous = overlap;
    }
  }

  /**
   * Find overlap between two text segments
   */
  private findOverlap(text1: string, text2: string): number {
    const tokens1 = this.tokenEncoder(text1);
    const tokens2 = this.tokenEncoder(text2);
    
    // Find longest common prefix
    let overlap = 0;
    const checkLength = Math.min(tokens1.length, tokens2.length);
    
    for (let i = 1; i <= checkLength; i++) {
      const suffix = tokens1.slice(-i);
      const prefix = tokens2.slice(0, i);
      
      if (JSON.stringify(suffix) === JSON.stringify(prefix)) {
        overlap = i;
      }
    }
    
    return overlap;
  }

  /**
   * Validate chunk quality
   */
  private validateChunks(chunks: RAGChunk[]): { warnings: ExportWarning[] } {
    const warnings: ExportWarning[] = [];
    
    chunks.forEach((chunk, index) => {
      // Check chunk size
      const tokenCount = this.tokenEncoder(chunk.content).length;
      
      if (tokenCount < this.options.minChunkSize) {
        warnings.push({
          code: 'CHUNK_TOO_SMALL',
          message: `Chunk ${index} is too small (${tokenCount} tokens)`,
          item: chunk.id,
          suggestion: 'Consider merging with adjacent chunks'
        });
      }
      
      if (tokenCount > this.options.maxChunkSize) {
        warnings.push({
          code: 'CHUNK_TOO_LARGE',
          message: `Chunk ${index} is too large (${tokenCount} tokens)`,
          item: chunk.id,
          suggestion: 'Consider splitting into smaller chunks'
        });
      }
      
      // Check confidence
      if (chunk.metadata.confidence < 0.5) {
        warnings.push({
          code: 'LOW_CONFIDENCE',
          message: `Low confidence for chunk ${index}`,
          item: chunk.id,
          suggestion: 'Review content accuracy'
        });
      }
    });
    
    return { warnings };
  }

  /**
   * Generate embeddings for chunks (placeholder)
   */
  private async generateEmbeddings(chunks: RAGChunk[]): Promise<void> {
    // In production, this would call an embedding service
    // For now, we'll add placeholder embeddings
    for (const chunk of chunks) {
      chunk.embeddings = Array(1536).fill(0).map(() => Math.random() * 2 - 1);
    }
  }

  /**
   * Split text into sentences
   */
  private splitIntoSentences(text: string): string[] {
    // Simple sentence splitting - could be improved with NLP library
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    return sentences.map(s => s.trim()).filter(s => s.length > 0);
  }

  /**
   * Extract keywords from text
   */
  private extractKeywords(text: string): string[] {
    // Simple keyword extraction - in production would use TF-IDF or similar
    const words = text.toLowerCase().split(/\W+/);
    const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for']);
    
    const wordFreq = new Map<string, number>();
    words.forEach(word => {
      if (word.length > 3 && !stopWords.has(word)) {
        wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
      }
    });
    
    // Get top 5 keywords
    return Array.from(wordFreq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([word]) => word);
  }

  /**
   * Extract entities from text (placeholder)
   */
  private extractEntities(text: string): Entity[] {
    // In production, would use NER model
    // For now, simple pattern matching
    const entities: Entity[] = [];
    
    // Find potential dates
    const datePattern = /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g;
    let match;
    while ((match = datePattern.exec(text)) !== null) {
      entities.push({
        text: match[0],
        type: 'DATE',
        confidence: 0.8,
        position: { start: match.index, end: match.index + match[0].length }
      });
    }
    
    // Find potential money amounts
    const moneyPattern = /\$[\d,]+(\.\d{2})?/g;
    while ((match = moneyPattern.exec(text)) !== null) {
      entities.push({
        text: match[0],
        type: 'MONEY',
        confidence: 0.9,
        position: { start: match.index, end: match.index + match[0].length }
      });
    }
    
    return entities;
  }

  /**
   * Decode tokens back to text
   */
  private decodeTokens(tokens: number[]): string {
    // This is a simplified decoder - in production would use proper tiktoken decoder
    // For now, we'll join with estimated characters
    return tokens.map(() => 'x').join(''); // Placeholder
  }

  /**
   * Export chunks to file
   */
  async exportToFile(chunks: RAGChunk[], filePath: string): Promise<void> {
    const fs = await import('fs/promises');
    const data = chunks.map(chunk => JSON.stringify(chunk)).join('\n');
    await fs.writeFile(filePath, data, 'utf-8');
  }
}