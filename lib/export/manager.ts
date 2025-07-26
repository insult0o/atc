/**
 * Export Manager - Main Orchestrator
 * Coordinates all export operations with progress tracking
 */

import {
  ExportFormat,
  ExportOptions,
  ExportResult,
  ExportError,
  ExportWarning
} from './schemas';

import { RAGGenerator } from './generators/rag-generator';
import { JSONLGenerator } from './generators/jsonl-generator';
import { CorrectionsGenerator } from './generators/corrections-generator';
import { ManifestGenerator } from './generators/manifest-generator';
import { LogGenerator } from './generators/log-generator';

import { ExportProgressTracker, ExportTask, createProgressAwareExport } from './progress-tracker';
import { ExportConfigManager } from './config-manager';

interface Document {
  id: string;
  name: string;
  pageCount: number;
  zones: any[];
  corrections?: any[];
  processingStartTime?: Date;
  processingEndTime?: Date;
}

interface ExportSession {
  sessionId: string;
  documentId: string;
  documentName: string;
  formats: ExportFormat[];
  options: ExportOptions;
  startTime: Date;
  endTime?: Date;
  results: Map<ExportFormat, ExportResult>;
  errors: ExportError[];
  warnings: ExportWarning[];
}

export class ExportManager {
  private progressTracker: ExportProgressTracker;
  private configManager: ExportConfigManager;
  private generators: Map<ExportFormat, any>;
  private activeSessions: Map<string, ExportSession>;

  constructor() {
    this.progressTracker = new ExportProgressTracker({ persistenceEnabled: true });
    this.configManager = new ExportConfigManager();
    this.generators = new Map();
    this.activeSessions = new Map();

    this.initializeGenerators();
  }

  /**
   * Start a new export session
   */
  async startExport(
    document: Document,
    formats: ExportFormat[],
    options?: Partial<ExportOptions>,
    presetId?: string
  ): Promise<string> {
    const sessionId = this.generateSessionId();
    
    // Get configuration
    const config = presetId 
      ? this.configManager.getConfig(formats, presetId)
      : this.configManager.getConfig(formats);
    
    // Merge with provided options
    const finalOptions = options ? this.mergeOptions(config, options) : config;

    // Validate configuration
    const validation = this.configManager.validateConfig(finalOptions);
    if (!validation.valid) {
      throw new Error(`Invalid export configuration: ${validation.errors.map(e => e.message).join(', ')}`);
    }

    // Create session
    const session: ExportSession = {
      sessionId,
      documentId: document.id,
      documentName: document.name,
      formats,
      options: finalOptions,
      startTime: new Date(),
      results: new Map(),
      errors: [],
      warnings: []
    };

    this.activeSessions.set(sessionId, session);

    // Start export process
    this.processExport(session, document).catch(error => {
      console.error('Export process failed:', error);
      session.errors.push({
        code: 'EXPORT_PROCESS_FAILED',
        message: 'Export process encountered an unhandled error',
        details: error
      });
    });

    return sessionId;
  }

  /**
   * Get export progress
   */
  getExportProgress(sessionId: string): ExportProgress[] {
    const session = this.activeSessions.get(sessionId);
    if (!session) return [];

    return session.formats.map(format => {
      const exportId = `${sessionId}-${format}`;
      return this.progressTracker.getProgress(exportId);
    }).filter(p => p !== undefined) as ExportProgress[];
  }

  /**
   * Cancel export session
   */
  async cancelExport(sessionId: string): Promise<boolean> {
    const session = this.activeSessions.get(sessionId);
    if (!session) return false;

    // Cancel all format exports
    const cancellations = session.formats.map(format => {
      const exportId = `${sessionId}-${format}`;
      return this.progressTracker.cancelExport(exportId);
    });

    const results = await Promise.all(cancellations);
    const success = results.every(r => r);

    if (success) {
      session.endTime = new Date();
      // Keep session for a short time for result retrieval
      setTimeout(() => this.activeSessions.delete(sessionId), 60000);
    }

    return success;
  }

  /**
   * Get export results
   */
  getExportResults(sessionId: string): ExportSession | undefined {
    return this.activeSessions.get(sessionId);
  }

  /**
   * Get all active sessions
   */
  getActiveSessions(): ExportSession[] {
    return Array.from(this.activeSessions.values());
  }

  /**
   * Process export session
   */
  private async processExport(session: ExportSession, document: Document): Promise<void> {
    try {
      // Process each format
      const exportPromises = session.formats.map(format => 
        this.processFormatExport(session, document, format)
      );

      // Wait for all exports to complete
      const results = await Promise.all(exportPromises);
      
      // Store results
      results.forEach((result, index) => {
        const format = session.formats[index];
        session.results.set(format, result);
        
        // Add errors and warnings to session
        if (result.errors) {
          session.errors.push(...result.errors);
        }
        if (result.warnings) {
          session.warnings.push(...result.warnings);
        }
      });

      // Generate log if requested
      if (session.options.formats.log) {
        const logResult = await this.generateSessionLog(session);
        session.results.set('log', logResult);
      }

      session.endTime = new Date();
      
      // Clean up after delay
      setTimeout(() => {
        this.activeSessions.delete(session.sessionId);
      }, 300000); // Keep for 5 minutes

    } catch (error) {
      session.errors.push({
        code: 'SESSION_PROCESSING_ERROR',
        message: 'Failed to process export session',
        details: error
      });
      session.endTime = new Date();
    }
  }

  /**
   * Process individual format export
   */
  private async processFormatExport(
    session: ExportSession, 
    document: Document, 
    format: ExportFormat
  ): Promise<ExportResult> {
    const exportId = `${session.sessionId}-${format}`;
    const generator = this.generators.get(format);
    
    if (!generator) {
      throw new Error(`No generator available for format: ${format}`);
    }

    try {
      // Estimate total items for progress tracking
      const totalItems = this.estimateItems(document, format);
      
      // Create export task
      const task: ExportTask = {
        id: exportId,
        format,
        totalItems,
        processFunction: () => this.runGenerator(generator, document, format, session.options)
      };

      // Track export
      this.progressTracker.trackExport(task);

      // Execute export with progress tracking
      const result = await task.processFunction();
      
      return result;
    } catch (error) {
      // Handle cancellation
      if (this.progressTracker.isCancelled(exportId)) {
        return {
          exportId,
          format,
          status: 'failure',
          errors: [{
            code: 'EXPORT_CANCELLED',
            message: 'Export was cancelled by user'
          }],
          warnings: [],
          metadata: {}
        };
      }

      throw error;
    }
  }

  /**
   * Run generator with appropriate options
   */
  private async runGenerator(
    generator: any, 
    document: Document, 
    format: ExportFormat, 
    options: ExportOptions
  ): Promise<ExportResult> {
    const formatOptions = options.formats[format];
    
    switch (format) {
      case 'rag':
        const ragGenerator = generator as RAGGenerator;
        return ragGenerator.generateChunks(document);
        
      case 'jsonl':
        const jsonlGenerator = generator as JSONLGenerator;
        return jsonlGenerator.generateExamples(document);
        
      case 'corrections':
        const correctionsGenerator = generator as CorrectionsGenerator;
        return correctionsGenerator.generateExports(document);
        
      case 'manifest':
        const manifestGenerator = generator as ManifestGenerator;
        return manifestGenerator.generateManifest(document);
        
      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  }

  /**
   * Generate session log
   */
  private async generateSessionLog(session: ExportSession): Promise<ExportResult> {
    const logOptions = session.options.formats.log;
    if (!logOptions) {
      throw new Error('Log options not configured');
    }

    const logGenerator = new LogGenerator(logOptions);
    
    // Convert session to log format
    const logSession = {
      exportId: session.sessionId,
      documentId: session.documentId,
      documentName: session.documentName,
      exportFormats: session.formats,
      startTime: session.startTime,
      endTime: session.endTime,
      results: session.results,
      globalErrors: [],
      globalWarnings: session.warnings.map(w => w.message)
    };

    return logGenerator.generateLog(logSession);
  }

  /**
   * Initialize generators with default options
   */
  private initializeGenerators(): void {
    this.generators.set('rag', new RAGGenerator());
    this.generators.set('jsonl', new JSONLGenerator());
    this.generators.set('corrections', new CorrectionsGenerator());
    this.generators.set('manifest', new ManifestGenerator());
    this.generators.set('log', new LogGenerator());
  }

  /**
   * Estimate items for progress tracking
   */
  private estimateItems(document: Document, format: ExportFormat): number {
    switch (format) {
      case 'rag':
        // Estimate chunks based on total content
        return Math.max(document.zones.length, 10);
        
      case 'jsonl':
        // Estimate examples based on zones
        return document.zones.length * 2; // Rough estimate
        
      case 'corrections':
        return document.corrections?.length || 0;
        
      case 'manifest':
        return document.zones.length + 5; // Zones plus statistics
        
      case 'log':
        return 10; // Fixed estimation for log generation
        
      default:
        return 1;
    }
  }

  /**
   * Merge options
   */
  private mergeOptions(base: ExportOptions, override: Partial<ExportOptions>): ExportOptions {
    return {
      formats: { ...base.formats, ...override.formats },
      validation: { ...base.validation, ...override.validation },
      output: { ...base.output, ...override.output }
    };
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return `export-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.progressTracker.destroy();
    this.activeSessions.clear();
    this.generators.clear();
  }
}