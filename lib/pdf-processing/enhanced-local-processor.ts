import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import crypto from 'crypto';
import { EventEmitter } from 'events';

interface ProcessingConfig {
  strategy: 'fast' | 'hi_res' | 'ocr_only';
  chunking_strategy: 'basic' | 'by_title' | 'by_page';
  max_characters: number;
  new_after_n_chars: number;
  overlap: number;
  coordinates: boolean;
  include_page_breaks: boolean;
  languages: string[];
  extract_image_block_types: string[];
  log_level?: 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR';
}

interface SemanticMetadata {
  chunk_index: number;
  word_count: number;
  char_count: number;
  has_tables: boolean;
  has_images: boolean;
  structural_role: string;
  language: string;
  contains_numbers: boolean;
  contains_special_chars: boolean;
}

interface LayoutInfo {
  coordinates: any;
  page_number: number;
  bbox: number[][];
  position_type: string;
  area: number;
  aspect_ratio: number;
}

interface ReadabilityMetrics {
  flesch_score: number;
  complexity: 'easy' | 'medium' | 'hard' | 'unknown';
  avg_words_per_sentence: number;
  avg_syllables_per_word: number;
}

interface DocumentContext {
  is_first_chunk: boolean;
  is_last_chunk: boolean;
  position_ratio: number;
  previous_chunk_type: string | null;
  next_chunk_type: string | null;
}

interface ProcessingMetadata {
  source_file: string;
  source_path: string;
  chunk_index: number;
  total_chunks: number;
  processing_timestamp: number;
  processor_version: string;
  file_size_bytes: number;
  relative_position: number;
}

interface ProcessedChunk {
  text: string;
  type: string;
  content_type: string;
  layout_info: LayoutInfo;
  confidence: number;
  readability: ReadabilityMetrics;
  semantic_metadata: SemanticMetadata;
  processing_metadata: ProcessingMetadata;
  document_context: DocumentContext;
  coordinates?: any;
  metadata?: any;
}

interface ProcessingResult {
  elements: ProcessedChunk[];
  quality_scores: number[];
  processing_metadata: {
    file_path: string;
    num_elements: number;
    avg_quality: number;
    processing_time_seconds: number;
    processing_version: string;
    cached: boolean;
    timestamp: number;
    config_used: ProcessingConfig;
    processing_time_ms?: number;
  };
}

interface CacheStats {
  files: number;
  totalSize: number;
  oldestFile?: string;
  newestFile?: string;
}

export class EnhancedLocalUnstructuredProcessor extends EventEmitter {
  private pythonPath: string;
  private processorPath: string;
  private tempDir: string;
  private cacheDir: string;
  private defaultConfig: ProcessingConfig;
  private processingQueue: Map<string, Promise<ProcessingResult>>;

  constructor() {
    super();
    this.pythonPath = process.env.PYTHON_PATH || 'python3';
    this.processorPath = path.join(__dirname, '../python/enhanced_unstructured_processor.py');
    this.tempDir = path.join(__dirname, '../../temp/unstructured');
    this.cacheDir = path.join(this.tempDir, 'cache');
    
    this.defaultConfig = {
      strategy: 'hi_res',
      chunking_strategy: 'by_title',
      max_characters: 1000,
      new_after_n_chars: 800,
      overlap: 200,
      coordinates: true,
      include_page_breaks: true,
      languages: ['eng'],
      extract_image_block_types: ['image', 'table'],
      log_level: 'INFO'
    };

    this.processingQueue = new Map();
    
    this.ensureDirectories();
  }

  async processDocument(
    filePath: string, 
    options: Partial<ProcessingConfig> = {}
  ): Promise<ProcessingResult> {
    const startTime = Date.now();
    
    // Check if this file is already being processed
    const queueKey = `${filePath}_${JSON.stringify(options)}`;
    if (this.processingQueue.has(queueKey)) {
      console.log(`Document ${path.basename(filePath)} is already being processed, waiting...`);
      return this.processingQueue.get(queueKey)!;
    }

    // Create processing promise
    const processingPromise = this._processDocumentInternal(filePath, options, startTime);
    this.processingQueue.set(queueKey, processingPromise);

    try {
      const result = await processingPromise;
      return result;
    } finally {
      this.processingQueue.delete(queueKey);
    }
  }

  private async _processDocumentInternal(
    filePath: string,
    options: Partial<ProcessingConfig>,
    startTime: number
  ): Promise<ProcessingResult> {
    this.emit('processingStarted', { filePath, options });

    // Validate file exists
    try {
      await fs.access(filePath);
    } catch (error) {
      throw new Error(`File not found: ${filePath}`);
    }

    // Generate cache key
    const cacheKey = await this.generateCacheKey(filePath, options);
    
    // Check cache first
    const cachedResult = await this.getCachedResult(cacheKey);
    if (cachedResult) {
      console.log(`Using cached result for ${path.basename(filePath)}`);
      this.emit('cacheHit', { filePath, cacheKey });
      return cachedResult;
    }

    // Prepare configuration
    const config = this.prepareConfig(filePath, options);
    
    try {
      this.emit('processingStage', { filePath, stage: 'partitioning' });
      
      // Execute Python processor
      const result = await this.executePythonProcessor(config);
      
      // Add processing time
      result.processing_metadata.processing_time_ms = Date.now() - startTime;
      
      // Cache result
      await this.cacheResult(cacheKey, result);
      
      this.emit('processingCompleted', { 
        filePath, 
        result: {
          elementCount: result.elements.length,
          avgQuality: result.processing_metadata.avg_quality,
          processingTime: result.processing_metadata.processing_time_ms
        }
      });
      
      return result;
      
         } catch (error) {
       const errorMessage = error instanceof Error ? error.message : String(error);
       this.emit('processingError', { filePath, error: errorMessage });
       console.error(`Error processing ${filePath}:`, error);
       throw new Error(`Document processing failed: ${errorMessage}`);
     }
  }

  private prepareConfig(filePath: string, options: Partial<ProcessingConfig>): ProcessingConfig & { filename: string; temp_dir: string } {
    return {
      ...this.defaultConfig,
      ...options,
      filename: filePath,
      temp_dir: this.tempDir
    };
  }

  private async executePythonProcessor(config: any): Promise<ProcessingResult> {
    return new Promise((resolve, reject) => {
      const pythonProcess = spawn(this.pythonPath, [
        this.processorPath,
        JSON.stringify(config)
      ], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
      });

      let stdout = '';
      let stderr = '';

      pythonProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      pythonProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      pythonProcess.on('close', (code) => {
        if (code === 0) {
          try {
            const result = JSON.parse(stdout);
            
            // Validate result structure
            if (!result.elements || !Array.isArray(result.elements)) {
              throw new Error('Invalid result structure: missing elements array');
            }
            
            resolve(result);
                     } catch (parseError) {
             const parseErrorMessage = parseError instanceof Error ? parseError.message : String(parseError);
             reject(new Error(`Failed to parse Python output: ${parseErrorMessage}\nOutput: ${stdout.substring(0, 500)}`));
           }
        } else {
          const errorMessage = stderr || `Python process failed with code ${code}`;
          reject(new Error(`Python processing failed: ${errorMessage}`));
        }
      });

             pythonProcess.on('error', (error) => {
         const errorMessage = error instanceof Error ? error.message : String(error);
         reject(new Error(`Failed to start Python process: ${errorMessage}`));
       });

      // Set timeout for long-running processes
      const timeout = setTimeout(() => {
        pythonProcess.kill('SIGTERM');
        reject(new Error('Processing timeout: Operation took too long'));
      }, 5 * 60 * 1000); // 5 minutes timeout

      pythonProcess.on('close', () => {
        clearTimeout(timeout);
      });
    });
  }

  private async generateCacheKey(filePath: string, options: Partial<ProcessingConfig>): Promise<string> {
    try {
      const stats = await fs.stat(filePath);
      const configStr = JSON.stringify({ ...this.defaultConfig, ...options }, Object.keys({ ...this.defaultConfig, ...options }).sort());
      const content = `${filePath}_${stats.size}_${stats.mtimeMs}_${configStr}_v2.0`;
      return crypto.createHash('md5').update(content).digest('hex');
    } catch (error) {
      // Fallback if file stats fail
      const configStr = JSON.stringify(options);
      return crypto.createHash('md5').update(`${filePath}_${configStr}_${Date.now()}`).digest('hex');
    }
  }

  private async getCachedResult(cacheKey: string): Promise<ProcessingResult | null> {
    const cacheFile = path.join(this.cacheDir, `${cacheKey}.json`);
    
    try {
      const data = await fs.readFile(cacheFile, 'utf-8');
      const result = JSON.parse(data);
      
      // Validate cached result
      if (result.elements && Array.isArray(result.elements) && result.processing_metadata) {
        return result;
      } else {
        // Remove invalid cache
        await fs.unlink(cacheFile).catch(() => {});
        return null;
      }
    } catch {
      return null;
    }
  }

  private async cacheResult(cacheKey: string, result: ProcessingResult): Promise<void> {
    const cacheFile = path.join(this.cacheDir, `${cacheKey}.json`);
    
    try {
      await fs.writeFile(cacheFile, JSON.stringify(result, null, 2));
         } catch (error) {
       const errorMessage = error instanceof Error ? error.message : String(error);
       console.warn(`Failed to cache result: ${errorMessage}`);
     }
  }

  private async ensureDirectories(): Promise<void> {
    try {
      await fs.mkdir(this.tempDir, { recursive: true });
      await fs.mkdir(this.cacheDir, { recursive: true });
         } catch (error) {
       const errorMessage = error instanceof Error ? error.message : String(error);
       console.warn(`Failed to create directories: ${errorMessage}`);
     }
  }

  // Performance optimization methods
  async processMultipleDocuments(
    filePaths: string[], 
    options: Partial<ProcessingConfig> = {},
    concurrency: number = 3
  ): Promise<ProcessingResult[]> {
    const results: ProcessingResult[] = [];
    
    console.log(`Processing ${filePaths.length} documents with concurrency ${concurrency}`);
    
    for (let i = 0; i < filePaths.length; i += concurrency) {
      const batch = filePaths.slice(i, i + concurrency);
      console.log(`Processing batch ${Math.floor(i / concurrency) + 1}: ${batch.map(p => path.basename(p)).join(', ')}`);
      
             const batchPromises = batch.map(filePath => 
         this.processDocument(filePath, options).catch(error => ({
           error: error instanceof Error ? error.message : String(error),
           filePath,
          elements: [],
          quality_scores: [],
          processing_metadata: {
            file_path: filePath,
            num_elements: 0,
            avg_quality: 0,
            processing_time_seconds: 0,
            processing_version: '2.0',
            cached: false,
            timestamp: Date.now(),
            config_used: this.defaultConfig
          }
        }))
      );
      
      const batchResults = await Promise.all(batchPromises);
      
      for (const result of batchResults) {
        if ('error' in result) {
          console.error(`Batch processing error for ${result.filePath}:`, result.error);
        } else {
          results.push(result);
        }
      }
    }
    
    return results;
  }

  async clearCache(): Promise<void> {
    try {
      const files = await fs.readdir(this.cacheDir);
      await Promise.all(
        files.map(file => fs.unlink(path.join(this.cacheDir, file)))
      );
      console.log(`Cache cleared: ${files.length} files removed`);
      this.emit('cacheCleared', { filesRemoved: files.length });
         } catch (error) {
       const errorMessage = error instanceof Error ? error.message : String(error);
       console.warn(`Failed to clear cache: ${errorMessage}`);
     }
  }

  async clearOldCache(maxAgeMs: number = 7 * 24 * 60 * 60 * 1000): Promise<void> {
    try {
      const files = await fs.readdir(this.cacheDir);
      const now = Date.now();
      let removedCount = 0;
      
      for (const file of files) {
        const filePath = path.join(this.cacheDir, file);
        const stats = await fs.stat(filePath);
        
        if (now - stats.mtimeMs > maxAgeMs) {
          await fs.unlink(filePath);
          removedCount++;
        }
      }
      
      console.log(`Old cache cleared: ${removedCount} files removed`);
      this.emit('oldCacheCleared', { filesRemoved: removedCount });
         } catch (error) {
       const errorMessage = error instanceof Error ? error.message : String(error);
       console.warn(`Failed to clear old cache: ${errorMessage}`);
     }
  }

  async getCacheStats(): Promise<CacheStats> {
    try {
      const files = await fs.readdir(this.cacheDir);
      let totalSize = 0;
      let oldestTime = Infinity;
      let newestTime = 0;
      let oldestFile: string | undefined;
      let newestFile: string | undefined;
      
      for (const file of files) {
        const filePath = path.join(this.cacheDir, file);
        const stats = await fs.stat(filePath);
        totalSize += stats.size;
        
        if (stats.mtimeMs < oldestTime) {
          oldestTime = stats.mtimeMs;
          oldestFile = file;
        }
        
        if (stats.mtimeMs > newestTime) {
          newestTime = stats.mtimeMs;
          newestFile = file;
        }
      }
      
      return { 
        files: files.length, 
        totalSize,
        oldestFile,
        newestFile
      };
    } catch {
      return { files: 0, totalSize: 0 };
    }
  }

  async validateProcessor(): Promise<boolean> {
    try {
      // Test Python availability
      const pythonTest = spawn(this.pythonPath, ['--version'], { stdio: 'pipe' });
      await new Promise((resolve, reject) => {
        pythonTest.on('close', (code) => {
          if (code === 0) resolve(true);
          else reject(new Error(`Python not available: exit code ${code}`));
        });
        pythonTest.on('error', reject);
      });

      // Test processor script exists
      await fs.access(this.processorPath);

      // Test required Python modules
      const moduleTest = spawn(this.pythonPath, ['-c', 'import unstructured, json, pickle'], { stdio: 'pipe' });
      await new Promise((resolve, reject) => {
        moduleTest.on('close', (code) => {
          if (code === 0) resolve(true);
          else reject(new Error(`Required Python modules not available: exit code ${code}`));
        });
        moduleTest.on('error', reject);
      });

      return true;
         } catch (error) {
       const errorMessage = error instanceof Error ? error.message : String(error);
       console.error('Processor validation failed:', errorMessage);
       return false;
     }
  }

  getProcessingStats(): {
    activeProcesses: number;
    queuedProcesses: string[];
    cacheDir: string;
    tempDir: string;
  } {
    return {
      activeProcesses: this.processingQueue.size,
      queuedProcesses: Array.from(this.processingQueue.keys()),
      cacheDir: this.cacheDir,
      tempDir: this.tempDir
    };
  }

  // Configuration methods
  updateDefaultConfig(updates: Partial<ProcessingConfig>): void {
    this.defaultConfig = { ...this.defaultConfig, ...updates };
    this.emit('configUpdated', this.defaultConfig);
  }

  getDefaultConfig(): ProcessingConfig {
    return { ...this.defaultConfig };
  }

  // Quality analysis methods
  analyzeQualityTrends(results: ProcessingResult[]): {
    avgQuality: number;
    qualityByType: Record<string, number>;
    lowQualityFiles: string[];
  } {
    const qualities = results.map(r => r.processing_metadata.avg_quality);
    const avgQuality = qualities.reduce((sum, q) => sum + q, 0) / qualities.length;
    
    const qualityByType: Record<string, number[]> = {};
    const lowQualityFiles: string[] = [];
    
    results.forEach(result => {
      result.elements.forEach(element => {
        const type = element.content_type;
        if (!qualityByType[type]) {
          qualityByType[type] = [];
        }
        qualityByType[type].push(element.confidence);
      });
      
      if (result.processing_metadata.avg_quality < 0.7) {
        lowQualityFiles.push(result.processing_metadata.file_path);
      }
    });
    
    const qualityByTypeAvg: Record<string, number> = {};
    Object.entries(qualityByType).forEach(([type, qualities]) => {
      qualityByTypeAvg[type] = qualities.reduce((sum, q) => sum + q, 0) / qualities.length;
    });
    
    return {
      avgQuality,
      qualityByType: qualityByTypeAvg,
      lowQualityFiles
    };
  }
} 