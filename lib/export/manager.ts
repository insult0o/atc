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

import { ExportProgressTracker, ExportTask, ExportProgress, createProgressAwareExport } from './progress-tracker';
import { ExportConfigManager } from './config-manager';
import { 
  ValidationOrchestrator, 
  ValidationResult,
  BlockingIssue 
} from './validation/validation-orchestrator';
import { ErrorDetail } from './validation/error-validator';
import { Zone } from '../types/zone';
import { PDFDocument } from '../types/pdf';

interface Document extends Partial<PDFDocument> {
  id: string;
  name: string;
  pageCount: number;
  zones: Zone[];
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
  validationResults: Map<ExportFormat, ValidationResult>;
  overrideRequests?: Map<ExportFormat, OverrideRequest>;
}

interface OverrideRequest {
  blockers: BlockingIssue[];
  justification: string;
  requestedBy?: string;
  requestedAt: Date;
  approvedBy?: string;
  approvedAt?: Date;
  status: 'pending' | 'approved' | 'rejected';
}

export class ExportManager {
  private progressTracker: ExportProgressTracker;
  private configManager: ExportConfigManager;
  private validationOrchestrator: ValidationOrchestrator;
  private generators: Map<ExportFormat, any>;
  private activeSessions: Map<string, ExportSession>;

  constructor() {
    this.progressTracker = new ExportProgressTracker({ persistenceEnabled: true });
    this.configManager = new ExportConfigManager();
    this.validationOrchestrator = new ValidationOrchestrator();
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
      warnings: [],
      validationResults: new Map(),
      overrideRequests: new Map()
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
      
      // Validate the export if validation is enabled
      if (session.options.validation?.enabled !== false) {
        const validationResult = await this.validateExport(
          format,
          result,
          document,
          session
        );
        
        session.validationResults.set(format, validationResult);
        
        // Check if validation blocks the export
        if (!validationResult.valid && !this.hasApprovedOverride(session, format)) {
          return {
            ...result,
            status: 'failure',
            errors: [
              ...(result.errors || []),
              {
                code: 'VALIDATION_FAILED',
                message: 'Export validation failed',
                details: validationResult.blockers
              }
            ],
            metadata: {
              ...result.metadata,
              validationScore: validationResult.score,
              validationReport: validationResult.report
            }
          };
        }
      }
      
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
   * Validate export result
   */
  private async validateExport(
    format: ExportFormat,
    result: ExportResult,
    document: Document,
    session: ExportSession
  ): Promise<ValidationResult> {
    // Convert document to PDFDocument format if needed
    const pdfDocument: PDFDocument = {
      id: document.id,
      filename: document.name,
      pages: document.pages || [],
      metadata: {
        pageCount: document.pageCount,
        fileSize: 0
      },
      processingStatus: 'completed',
      version: 1,
      createdAt: document.processingStartTime || new Date(),
      updatedAt: document.processingEndTime || new Date()
    };

    // Collect processing errors
    const processingErrors: ErrorDetail[] = session.errors.map(e => ({
      id: `error_${Date.now()}_${Math.random()}`,
      component: 'export',
      type: e.code,
      severity: 'error' as const,
      message: e.message,
      timestamp: new Date(),
      context: e.details || {},
      recoverable: false
    }));

    // Extract metadata from result
    const metadata = {
      ...result.metadata,
      document_id: document.id,
      format,
      timestamp: new Date().toISOString(),
      version: 1,
      processing_status: result.status
    };

    // Run validation
    return await this.validationOrchestrator.validate(
      format,
      result.data || result,
      pdfDocument,
      document.zones,
      metadata,
      processingErrors
    );
  }

  /**
   * Check if an override has been approved
   */
  private hasApprovedOverride(session: ExportSession, format: ExportFormat): boolean {
    const override = session.overrideRequests?.get(format);
    return override?.status === 'approved';
  }

  /**
   * Request validation override
   */
  async requestValidationOverride(
    sessionId: string,
    format: ExportFormat,
    justification: string,
    requestedBy?: string
  ): Promise<boolean> {
    const session = this.activeSessions.get(sessionId);
    if (!session) return false;

    const validationResult = session.validationResults.get(format);
    if (!validationResult || validationResult.valid) return false;

    const overridableBlockers = validationResult.blockers.filter(b => b.canOverride);
    if (overridableBlockers.length === 0) return false;

    const overrideRequest: OverrideRequest = {
      blockers: overridableBlockers,
      justification,
      requestedBy,
      requestedAt: new Date(),
      status: 'pending'
    };

    session.overrideRequests?.set(format, overrideRequest);
    
    // In a real system, this would trigger an approval workflow
    // For now, we'll auto-approve after validation
    if (justification.length > 50) {
      overrideRequest.status = 'approved';
      overrideRequest.approvedBy = 'system';
      overrideRequest.approvedAt = new Date();
      return true;
    }

    return false;
  }

  /**
   * Get validation results for a session
   */
  getValidationResults(sessionId: string): Map<ExportFormat, ValidationResult> | undefined {
    const session = this.activeSessions.get(sessionId);
    return session?.validationResults;
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