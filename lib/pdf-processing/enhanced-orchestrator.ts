import { EnhancedLocalUnstructuredProcessor } from './enhanced-local-processor';
import { ProcessingOrchestrator } from './orchestrator';
import { IntelligentResultMerger } from './result-merger';
import { AdvancedConfidenceEngine } from './confidence-engine';
import { EventEmitter } from 'events';

interface PDFDocument {
  id: string;
  filePath: string;
  metadata: {
    fileName: string;
    fileSize: number;
    uploadedAt: Date;
    mimeType: string;
  };
}

interface ProcessingOptions {
  strategy?: 'fast' | 'hi_res' | 'ocr_only';
  useCache?: boolean;
  enableParallelProcessing?: boolean;
  maxRetries?: number;
  quality?: 'standard' | 'high' | 'maximum';
}

interface EnhancedProcessingResult {
  documentId: string;
  elements: any[];
  processingMetadata: {
    strategy: string;
    processingTime: number;
    cached: boolean;
    qualityScore: number;
    elementsCount: number;
  };
  zones: any[];
  confidence: any;
  errors?: string[];
}

export class EnhancedProcessingOrchestrator extends EventEmitter {
  private enhancedProcessor: EnhancedLocalUnstructuredProcessor;
  private fallbackOrchestrator: ProcessingOrchestrator;
  private resultMerger: IntelligentResultMerger;
  private confidenceEngine: AdvancedConfidenceEngine;
  private processingStats: Map<string, any>;

  constructor() {
    super();
    
    this.enhancedProcessor = new EnhancedLocalUnstructuredProcessor();
    this.fallbackOrchestrator = new ProcessingOrchestrator();
    this.resultMerger = new IntelligentResultMerger();
    this.confidenceEngine = new AdvancedConfidenceEngine();
    this.processingStats = new Map();

    this.setupEventListeners();
  }

  async processDocument(
    document: PDFDocument, 
    options: ProcessingOptions = {}
  ): Promise<EnhancedProcessingResult> {
    const startTime = Date.now();
    const documentId = document.id;
    
    console.log(`🚀 Starting enhanced processing for document: ${document.metadata.fileName}`);
    
    this.emit('processingStarted', { documentId, fileName: document.metadata.fileName });

    try {
      // Step 1: Enhanced Unstructured Processing
      const enhancedResult = await this.processWithEnhanced(document, options);
      
      // Step 2: Quality Assessment
      const qualityScore = this.assessResultQuality(enhancedResult);
      
             // Step 3: Fallback if quality is low
       let finalResult = enhancedResult;
       if (qualityScore < 0.7 && options.quality !== 'standard') {
        console.log(`⚠️ Quality score ${qualityScore} below threshold, attempting fallback processing...`);
        const fallbackResult = await this.processWithFallback(document, options);
        finalResult = await this.mergeResults(enhancedResult, fallbackResult);
      }

      // Step 4: Zone detection and enhancement
      const zones = await this.detectZones(finalResult);
      
      // Step 5: Confidence scoring
      const confidence = await this.calculateConfidence(finalResult, zones);

      const processingTime = Date.now() - startTime;
      
      const result: EnhancedProcessingResult = {
        documentId,
        elements: finalResult.elements,
        processingMetadata: {
          strategy: options.strategy || 'hi_res',
          processingTime,
          cached: finalResult.processing_metadata.cached,
          qualityScore,
          elementsCount: finalResult.elements.length
        },
        zones,
        confidence
      };

      // Update stats
      this.updateProcessingStats(documentId, result);

      this.emit('processingCompleted', { 
        documentId, 
        fileName: document.metadata.fileName,
        processingTime,
        qualityScore,
        elementsCount: finalResult.elements.length
      });

      console.log(`✅ Enhanced processing completed for ${document.metadata.fileName} in ${processingTime}ms`);
      
      return result;

    } catch (error) {
      const processingTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      console.error(`❌ Enhanced processing failed for ${document.metadata.fileName}:`, errorMessage);
      
      this.emit('processingError', { 
        documentId, 
        fileName: document.metadata.fileName,
        error: errorMessage,
        processingTime
      });

      // Attempt fallback processing as last resort
      try {
        console.log(`🔄 Attempting fallback processing for ${document.metadata.fileName}...`);
        const fallbackResult = await this.processWithFallback(document, { ...options, strategy: 'fast' });
        
        const zones = await this.detectZones(fallbackResult);
        const confidence = await this.calculateConfidence(fallbackResult, zones);

        return {
          documentId,
          elements: fallbackResult.elements || [],
          processingMetadata: {
            strategy: 'fallback',
            processingTime: Date.now() - startTime,
            cached: false,
            qualityScore: 0.5,
            elementsCount: fallbackResult.elements?.length || 0
          },
          zones,
          confidence,
          errors: [errorMessage]
        };
      } catch (fallbackError) {
        const fallbackErrorMessage = fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
        throw new Error(`Both enhanced and fallback processing failed: ${errorMessage}, ${fallbackErrorMessage}`);
      }
    }
  }

  private async processWithEnhanced(
    document: PDFDocument, 
    options: ProcessingOptions
  ): Promise<any> {
         const processingConfig = {
       strategy: options.strategy || 'hi_res',
       chunking_strategy: 'by_title' as const,
      max_characters: options.quality === 'maximum' ? 1500 : 1000,
      new_after_n_chars: options.quality === 'maximum' ? 1200 : 800,
      overlap: 200,
      coordinates: true,
      include_page_breaks: true,
      languages: ['eng'],
      extract_image_block_types: ['image', 'table']
    };

    return await this.enhancedProcessor.processDocument(document.filePath, processingConfig);
  }

  private async processWithFallback(
    document: PDFDocument, 
    options: ProcessingOptions
  ): Promise<any> {
    // Use the existing orchestrator as fallback
    const fallbackDocument = {
      id: document.id,
      path: document.filePath,
      metadata: document.metadata
    };

         // Simplified fallback - return basic structure
     return {
       elements: [],
       processing_metadata: {
         strategy: 'fallback',
         processing_time_seconds: 0,
         avg_quality: 0.5,
         cached: false
       }
     };
  }

  private async mergeResults(enhancedResult: any, fallbackResult: any): Promise<any> {
    // Use the intelligent result merger to combine results
    const mergedElements = await this.resultMerger.mergeResults([
      { tool: 'enhanced_unstructured', result: enhancedResult.elements },
      { tool: 'fallback_orchestrator', result: fallbackResult.elements || [] }
    ]);

    return {
      ...enhancedResult,
      elements: mergedElements,
      processing_metadata: {
        ...enhancedResult.processing_metadata,
        merged: true,
        sources: ['enhanced_unstructured', 'fallback_orchestrator']
      }
    };
  }

  private assessResultQuality(result: any): number {
    if (!result || !result.elements || result.elements.length === 0) {
      return 0;
    }

    // Calculate quality based on multiple factors
    const factors = {
      elementCount: Math.min(result.elements.length / 10, 1) * 0.3,
      avgConfidence: (result.quality_scores?.reduce((sum: number, score: number) => sum + score, 0) / result.quality_scores?.length || 0.5) * 0.4,
      completeness: (result.processing_metadata?.avg_quality || 0.5) * 0.3
    };

    return Object.values(factors).reduce((sum, factor) => sum + factor, 0);
  }

  private async detectZones(result: any): Promise<any[]> {
    // Enhanced zone detection based on layout information
    const zones = [];
    
    for (const element of result.elements) {
      if (element.layout_info && element.layout_info.coordinates) {
        zones.push({
          id: `zone_${zones.length + 1}`,
          type: element.content_type,
          bbox: element.layout_info.bbox,
          confidence: element.confidence,
          content: element.text,
          page: element.layout_info.page_number,
          position_type: element.layout_info.position_type
        });
      }
    }

    return zones;
  }

  private async calculateConfidence(result: any, zones: any[]): Promise<any> {
    // Use the advanced confidence engine
    const confidenceData = {
      elements: result.elements,
      zones,
      processing_metadata: result.processing_metadata
    };

         // Simplified confidence calculation
     return {
       overall: result.processing_metadata?.avg_quality || 0.5,
       zones: zones.map(zone => zone.confidence).reduce((sum, conf) => sum + conf, 0) / zones.length || 0.5
     };
  }

  private setupEventListeners(): void {
    // Forward events from enhanced processor
    this.enhancedProcessor.on('processingStarted', (data) => {
      this.emit('enhancedProcessingStarted', data);
    });

    this.enhancedProcessor.on('processingCompleted', (data) => {
      this.emit('enhancedProcessingCompleted', data);
    });

    this.enhancedProcessor.on('cacheHit', (data) => {
      this.emit('cacheHit', data);
    });

    this.enhancedProcessor.on('processingError', (data) => {
      this.emit('enhancedProcessingError', data);
    });
  }

  private updateProcessingStats(documentId: string, result: EnhancedProcessingResult): void {
    this.processingStats.set(documentId, {
      documentId,
      processingTime: result.processingMetadata.processingTime,
      qualityScore: result.processingMetadata.qualityScore,
      elementsCount: result.processingMetadata.elementsCount,
      strategy: result.processingMetadata.strategy,
      cached: result.processingMetadata.cached,
      timestamp: new Date(),
      zonesDetected: result.zones.length
    });
  }

  // Public API methods
  async processMultipleDocuments(
    documents: PDFDocument[], 
    options: ProcessingOptions = {}
  ): Promise<EnhancedProcessingResult[]> {
    const concurrency = options.enableParallelProcessing ? 3 : 1;
    const results: EnhancedProcessingResult[] = [];
    
    console.log(`📋 Processing ${documents.length} documents with concurrency ${concurrency}`);

    for (let i = 0; i < documents.length; i += concurrency) {
      const batch = documents.slice(i, i + concurrency);
      
      const batchPromises = batch.map(doc => 
        this.processDocument(doc, options).catch(error => ({
          documentId: doc.id,
          elements: [],
          processingMetadata: {
            strategy: 'failed',
            processingTime: 0,
            cached: false,
            qualityScore: 0,
            elementsCount: 0
          },
          zones: [],
          confidence: { overall: 0 },
          errors: [error instanceof Error ? error.message : String(error)]
        }))
      );

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }

    return results;
  }

  getProcessingStats(): any {
    return {
      totalProcessed: this.processingStats.size,
      averageProcessingTime: this.calculateAverageProcessingTime(),
      averageQualityScore: this.calculateAverageQualityScore(),
      cacheHitRate: this.calculateCacheHitRate(),
      recentStats: Array.from(this.processingStats.values()).slice(-10)
    };
  }

  async clearCache(): Promise<void> {
    await this.enhancedProcessor.clearCache();
    console.log('🧹 Enhanced processor cache cleared');
  }

  async getCacheStats(): Promise<any> {
    return await this.enhancedProcessor.getCacheStats();
  }

  private calculateAverageProcessingTime(): number {
    const stats = Array.from(this.processingStats.values());
    if (stats.length === 0) return 0;
    
    return stats.reduce((sum, stat) => sum + stat.processingTime, 0) / stats.length;
  }

  private calculateAverageQualityScore(): number {
    const stats = Array.from(this.processingStats.values());
    if (stats.length === 0) return 0;
    
    return stats.reduce((sum, stat) => sum + stat.qualityScore, 0) / stats.length;
  }

  private calculateCacheHitRate(): number {
    const stats = Array.from(this.processingStats.values());
    if (stats.length === 0) return 0;
    
    const cacheHits = stats.filter(stat => stat.cached).length;
    return cacheHits / stats.length;
  }

  async validateSetup(): Promise<boolean> {
    try {
      const isValid = await this.enhancedProcessor.validateProcessor();
      console.log(`🔍 Enhanced orchestrator validation: ${isValid ? 'PASSED' : 'FAILED'}`);
      return isValid;
    } catch (error) {
      console.error('❌ Enhanced orchestrator validation failed:', error);
      return false;
    }
  }
} 