/**
 * Structured Logging Framework
 * Core logging system with consistent schema and sanitization
 */

import { createHash } from 'crypto';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'critical';

export enum LogCategory {
  EXPORT_INITIATED = 'export.initiated',
  EXPORT_COMPLETED = 'export.completed',
  EXPORT_FAILED = 'export.failed',
  VALIDATION_STARTED = 'validation.started',
  VALIDATION_PASSED = 'validation.passed',
  VALIDATION_FAILED = 'validation.failed',
  VALIDATION_OVERRIDDEN = 'validation.overridden',
  PARTIAL_SELECTED = 'partial.selected',
  PARTIAL_EXPORTED = 'partial.exported',
  ERROR_OCCURRED = 'error.occurred',
  ERROR_RECOVERED = 'error.recovered',
  PERFORMANCE_MILESTONE = 'performance.milestone',
  AUDIT_EVENT = 'audit.event'
}

export interface ExportLog {
  id: string;
  timestamp: string;
  level: LogLevel;
  category: LogCategory;
  operation: string;
  correlationId: string;
  userId?: string;
  documentId?: string;
  metadata: LogMetadata;
  performance?: PerformanceMetrics;
  error?: ErrorDetails;
  hash?: string;
}

export interface LogMetadata {
  exportType?: 'full' | 'partial';
  formats?: string[];
  selection?: any;
  configuration?: any;
  environment?: EnvironmentInfo;
  version?: string;
  [key: string]: any;
}

export interface PerformanceMetrics {
  duration: number;
  memoryUsed: number;
  cpuUsage?: number;
  ioOperations?: number;
  queueTime?: number;
  processingTime?: number;
  validationTime?: number;
}

export interface ErrorDetails {
  code: string;
  message: string;
  stack?: string;
  context?: any;
  userImpact?: 'none' | 'minimal' | 'moderate' | 'severe';
}

export interface EnvironmentInfo {
  nodeVersion: string;
  platform: string;
  hostname: string;
  pid: number;
}

export interface LoggerConfig {
  level: LogLevel;
  enableConsole: boolean;
  enableFile: boolean;
  enableRemote: boolean;
  sanitization: SanitizationConfig;
  rotation: RotationConfig;
  contextDefaults?: Partial<ExportLog>;
}

export interface SanitizationConfig {
  enabled: boolean;
  piiPatterns: RegExp[];
  sensitiveFields: string[];
  maskingStrategy: 'full' | 'partial' | 'hash';
  preserveFormat: boolean;
}

export interface RotationConfig {
  maxFileSize: number; // bytes
  maxFiles: number;
  maxAge: number; // days
  compress: boolean;
}

export class Logger {
  private config: LoggerConfig;
  private correlationId: string;
  private contextData: Partial<ExportLog>;
  private logHandlers: LogHandler[] = [];

  constructor(config?: Partial<LoggerConfig>) {
    this.config = {
      level: 'info',
      enableConsole: true,
      enableFile: true,
      enableRemote: false,
      sanitization: {
        enabled: true,
        piiPatterns: [
          /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/, // Email
          /\b\d{3}-?\d{2}-?\d{4}\b/, // SSN
          /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/, // Credit card
          /\b\d{3}[\s-]?\d{3}[\s-]?\d{4}\b/, // Phone
        ],
        sensitiveFields: ['password', 'token', 'apiKey', 'secret', 'authorization'],
        maskingStrategy: 'partial',
        preserveFormat: true
      },
      rotation: {
        maxFileSize: 100 * 1024 * 1024, // 100MB
        maxFiles: 10,
        maxAge: 30,
        compress: true
      },
      ...config
    };

    this.correlationId = this.generateCorrelationId();
    this.contextData = {};
    this.initializeHandlers();
  }

  /**
   * Set correlation ID for request tracking
   */
  setCorrelationId(id: string): void {
    this.correlationId = id;
  }

  /**
   * Set persistent context data
   */
  setContext(context: Partial<ExportLog>): void {
    this.contextData = { ...this.contextData, ...context };
  }

  /**
   * Clear context data
   */
  clearContext(): void {
    this.contextData = {};
  }

  /**
   * Core logging methods
   */
  debug(message: string, metadata?: any): void {
    this.log('debug', LogCategory.EXPORT_INITIATED, message, metadata);
  }

  info(message: string, metadata?: any): void {
    this.log('info', LogCategory.EXPORT_INITIATED, message, metadata);
  }

  warn(message: string, metadata?: any): void {
    this.log('warn', LogCategory.EXPORT_INITIATED, message, metadata);
  }

  error(message: string, error?: Error | any, metadata?: any): void {
    const errorDetails: ErrorDetails = {
      code: error?.code || 'UNKNOWN',
      message: error?.message || message,
      stack: error?.stack,
      context: metadata
    };

    this.log('error', LogCategory.ERROR_OCCURRED, message, {
      ...metadata,
      error: errorDetails
    });
  }

  critical(message: string, error?: Error | any, metadata?: any): void {
    const errorDetails: ErrorDetails = {
      code: error?.code || 'CRITICAL',
      message: error?.message || message,
      stack: error?.stack,
      context: metadata,
      userImpact: 'severe'
    };

    this.log('critical', LogCategory.ERROR_OCCURRED, message, {
      ...metadata,
      error: errorDetails
    });
  }

  /**
   * Specialized logging methods
   */
  logExport(category: LogCategory, operation: string, metadata?: any): void {
    this.log('info', category, operation, metadata);
  }

  logValidation(category: LogCategory, operation: string, metadata?: any): void {
    this.log('info', category, operation, metadata);
  }

  logPerformance(operation: string, metrics: PerformanceMetrics, metadata?: any): void {
    this.log('info', LogCategory.PERFORMANCE_MILESTONE, operation, {
      ...metadata,
      performance: metrics
    });
  }

  logAudit(operation: string, metadata?: any): void {
    this.log('info', LogCategory.AUDIT_EVENT, operation, {
      ...metadata,
      audit: true
    });
  }

  /**
   * Core logging implementation
   */
  private log(
    level: LogLevel,
    category: LogCategory,
    operation: string,
    metadata?: any
  ): void {
    if (!this.shouldLog(level)) return;

    const logEntry: ExportLog = {
      id: this.generateLogId(),
      timestamp: new Date().toISOString(),
      level,
      category,
      operation,
      correlationId: this.correlationId,
      ...this.contextData,
      metadata: {
        ...this.contextData.metadata,
        ...metadata,
        environment: this.getEnvironmentInfo()
      }
    };

    // Sanitize sensitive data
    const sanitizedEntry = this.sanitize(logEntry);

    // Add hash for integrity
    sanitizedEntry.hash = this.generateHash(sanitizedEntry);

    // Send to all handlers
    this.logHandlers.forEach(handler => {
      handler.handle(sanitizedEntry);
    });
  }

  /**
   * Check if should log based on level
   */
  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error', 'critical'];
    const configIndex = levels.indexOf(this.config.level);
    const logIndex = levels.indexOf(level);
    return logIndex >= configIndex;
  }

  /**
   * Sanitize sensitive data
   */
  private sanitize(entry: ExportLog): ExportLog {
    if (!this.config.sanitization.enabled) return entry;

    const sanitized = JSON.parse(JSON.stringify(entry));
    
    // Recursively sanitize object
    this.sanitizeObject(sanitized);

    return sanitized;
  }

  private sanitizeObject(obj: any, path: string = ''): void {
    if (!obj || typeof obj !== 'object') return;

    Object.keys(obj).forEach(key => {
      const fullPath = path ? `${path}.${key}` : key;
      
      // Check if field is sensitive
      if (this.isSensitiveField(key)) {
        obj[key] = this.maskValue(obj[key]);
        return;
      }

      // Check for PII patterns in strings
      if (typeof obj[key] === 'string') {
        obj[key] = this.sanitizeString(obj[key]);
      } else if (Array.isArray(obj[key])) {
        obj[key].forEach((item: any, index: number) => {
          if (typeof item === 'string') {
            obj[key][index] = this.sanitizeString(item);
          } else if (typeof item === 'object') {
            this.sanitizeObject(item, `${fullPath}[${index}]`);
          }
        });
      } else if (typeof obj[key] === 'object') {
        this.sanitizeObject(obj[key], fullPath);
      }
    });
  }

  private isSensitiveField(fieldName: string): boolean {
    const lowerField = fieldName.toLowerCase();
    return this.config.sanitization.sensitiveFields.some(sensitive => 
      lowerField.includes(sensitive.toLowerCase())
    );
  }

  private sanitizeString(value: string): string {
    let sanitized = value;

    // Check against PII patterns
    this.config.sanitization.piiPatterns.forEach(pattern => {
      sanitized = sanitized.replace(pattern, (match) => {
        return this.maskValue(match);
      });
    });

    return sanitized;
  }

  private maskValue(value: any): string {
    if (value === null || value === undefined) return '[REDACTED]';
    
    const strValue = String(value);
    
    switch (this.config.sanitization.maskingStrategy) {
      case 'full':
        return '[REDACTED]';
      
      case 'partial':
        if (strValue.length <= 4) return '[REDACTED]';
        return strValue.substring(0, 2) + '*'.repeat(strValue.length - 4) + strValue.substring(strValue.length - 2);
      
      case 'hash':
        return `[HASH:${createHash('sha256').update(strValue).digest('hex').substring(0, 8)}]`;
      
      default:
        return '[REDACTED]';
    }
  }

  /**
   * Generate unique log ID
   */
  private generateLogId(): string {
    return `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate correlation ID
   */
  private generateCorrelationId(): string {
    return `corr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate hash for integrity
   */
  private generateHash(entry: ExportLog): string {
    const content = JSON.stringify({
      id: entry.id,
      timestamp: entry.timestamp,
      category: entry.category,
      operation: entry.operation,
      metadata: entry.metadata
    });
    
    return createHash('sha256').update(content).digest('hex');
  }

  /**
   * Get environment information
   */
  private getEnvironmentInfo(): EnvironmentInfo {
    return {
      nodeVersion: process.version,
      platform: process.platform,
      hostname: process.env.HOSTNAME || 'unknown',
      pid: process.pid
    };
  }

  /**
   * Initialize log handlers
   */
  private initializeHandlers(): void {
    if (this.config.enableConsole) {
      this.logHandlers.push(new ConsoleLogHandler());
    }

    if (this.config.enableFile) {
      this.logHandlers.push(new FileLogHandler(this.config.rotation));
    }

    if (this.config.enableRemote) {
      // Remote handler would be initialized here
    }
  }

  /**
   * Add custom log handler
   */
  addHandler(handler: LogHandler): void {
    this.logHandlers.push(handler);
  }

  /**
   * Remove log handler
   */
  removeHandler(handler: LogHandler): void {
    const index = this.logHandlers.indexOf(handler);
    if (index !== -1) {
      this.logHandlers.splice(index, 1);
    }
  }

  /**
   * Flush all handlers
   */
  async flush(): Promise<void> {
    await Promise.all(
      this.logHandlers.map(handler => handler.flush())
    );
  }

  /**
   * Close logger
   */
  async close(): Promise<void> {
    await this.flush();
    this.logHandlers.forEach(handler => handler.close());
    this.logHandlers = [];
  }
}

/**
 * Log Handler Interface
 */
export interface LogHandler {
  handle(entry: ExportLog): void;
  flush(): Promise<void>;
  close(): void;
}

/**
 * Console Log Handler
 */
export class ConsoleLogHandler implements LogHandler {
  private colorMap: Record<LogLevel, string> = {
    debug: '\x1b[36m', // Cyan
    info: '\x1b[32m',  // Green
    warn: '\x1b[33m',  // Yellow
    error: '\x1b[31m', // Red
    critical: '\x1b[35m' // Magenta
  };

  handle(entry: ExportLog): void {
    const color = this.colorMap[entry.level];
    const reset = '\x1b[0m';
    
    const message = `${color}[${entry.timestamp}] [${entry.level.toUpperCase()}] [${entry.category}]${reset} ${entry.operation}`;
    
    console.log(message);
    
    if (entry.metadata && Object.keys(entry.metadata).length > 0) {
      console.log('  Metadata:', JSON.stringify(entry.metadata, null, 2));
    }
    
    if (entry.error) {
      console.error('  Error:', entry.error);
    }
  }

  async flush(): Promise<void> {
    // Console writes are synchronous
  }

  close(): void {
    // Nothing to close for console
  }
}

/**
 * File Log Handler
 */
export class FileLogHandler implements LogHandler {
  private buffer: ExportLog[] = [];
  private flushInterval: NodeJS.Timer;
  private currentFile?: string;
  private bytesWritten: number = 0;

  constructor(private config: RotationConfig) {
    // Flush buffer every 5 seconds
    this.flushInterval = setInterval(() => {
      this.flush().catch(console.error);
    }, 5000);
  }

  handle(entry: ExportLog): void {
    this.buffer.push(entry);
    
    // Flush if buffer is getting large
    if (this.buffer.length >= 100) {
      this.flush().catch(console.error);
    }
  }

  async flush(): Promise<void> {
    if (this.buffer.length === 0) return;

    const entries = [...this.buffer];
    this.buffer = [];

    // In a real implementation, this would write to a file
    // For now, we'll just track the size
    const content = entries.map(e => JSON.stringify(e)).join('\n') + '\n';
    this.bytesWritten += Buffer.byteLength(content);

    // Check rotation
    if (this.bytesWritten >= this.config.maxFileSize) {
      await this.rotate();
    }
  }

  private async rotate(): Promise<void> {
    // In a real implementation, this would rotate log files
    this.bytesWritten = 0;
  }

  close(): void {
    clearInterval(this.flushInterval);
    this.flush().catch(console.error);
  }
}

/**
 * Create default logger instance
 */
export const logger = new Logger();

/**
 * Create logger with custom config
 */
export function createLogger(config?: Partial<LoggerConfig>): Logger {
  return new Logger(config);
}