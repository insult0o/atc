/**
 * Human-Readable Log Generator
 * Creates formatted logs in markdown, plain text, JSON, or HTML
 */

import {
  ExportLog,
  LogHeader,
  LogSummary,
  LogSection,
  ErrorEntry,
  WarningEntry,
  LogFooter,
  LogExportOptions,
  ExportFormat,
  ExportResult,
  ExportError,
  ExportWarning
} from '../schemas';

interface ExportSession {
  exportId: string;
  documentId: string;
  documentName: string;
  exportFormats: ExportFormat[];
  startTime: Date;
  endTime?: Date;
  results: Map<ExportFormat, ExportResult>;
  globalErrors: Error[];
  globalWarnings: string[];
}

export class LogGenerator {
  private options: LogExportOptions;
  private formatter: LogFormatter;

  constructor(options: Partial<LogExportOptions> = {}) {
    this.options = {
      format: options.format || 'markdown',
      includeDebugInfo: options.includeDebugInfo || false,
      sectionsToInclude: options.sectionsToInclude || ['summary', 'exports', 'errors', 'warnings'],
      maxErrorDetails: options.maxErrorDetails || 10,
      timestampFormat: options.timestampFormat || 'ISO'
    };

    this.formatter = this.createFormatter(this.options.format);
  }

  /**
   * Generate export log from session
   */
  async generateLog(session: ExportSession): Promise<ExportResult> {
    const startTime = Date.now();
    const errors: ExportError[] = [];
    const warnings: ExportWarning[] = [];

    try {
      // Create log structure
      const log = this.createLogStructure(session);

      // Validate log
      const validationResults = this.validateLog(log);
      warnings.push(...validationResults.warnings);

      // Format log content
      const formattedContent = this.formatter.format(log);

      return {
        exportId: `log-${session.exportId}-${Date.now()}`,
        format: 'log',
        status: errors.length === 0 ? 'success' : 'partial',
        itemCount: 1,
        fileSize: Buffer.byteLength(formattedContent, 'utf-8'),
        errors,
        warnings,
        metadata: {
          processingTime: Date.now() - startTime,
          logFormat: this.options.format,
          sectionsIncluded: this.options.sectionsToInclude,
          documentName: session.documentName
        }
      };
    } catch (error) {
      return {
        exportId: `log-${session.exportId}-${Date.now()}`,
        format: 'log',
        status: 'failure',
        errors: [{
          code: 'LOG_GENERATION_FAILED',
          message: 'Failed to generate export log',
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
   * Create log structure from export session
   */
  private createLogStructure(session: ExportSession): ExportLog {
    const header = this.createHeader(session);
    const summary = this.createSummary(session);
    const sections = this.createSections(session);
    const errors = this.extractErrors(session);
    const warnings = this.extractWarnings(session);
    const footer = this.createFooter(session);

    return {
      header,
      summary,
      sections,
      errors,
      warnings,
      footer
    };
  }

  /**
   * Create log header
   */
  private createHeader(session: ExportSession): LogHeader {
    return {
      title: `Export Log - ${session.documentName}`,
      exportId: session.exportId,
      timestamp: this.formatTimestamp(session.startTime),
      documentName: session.documentName,
      exportFormats: session.exportFormats,
      version: '1.0.0' // Could be pulled from package.json
    };
  }

  /**
   * Create summary section
   */
  private createSummary(session: ExportSession): LogSummary {
    const results = Array.from(session.results.values());
    const successfulExports = results.filter(r => r.status === 'success').length;
    const failedExports = results.filter(r => r.status === 'failure').length;
    const processingTime = session.endTime 
      ? (session.endTime.getTime() - session.startTime.getTime()) / 1000
      : 0;

    // Calculate file sizes
    const fileSizes: Record<ExportFormat, number> = {} as any;
    session.results.forEach((result, format) => {
      fileSizes[format] = result.fileSize || 0;
    });

    // Generate highlights
    const highlights = this.generateHighlights(session);

    return {
      totalItems: results.reduce((sum, r) => sum + (r.itemCount || 0), 0),
      successfulExports,
      failedExports,
      processingTime,
      fileSizes,
      highlights
    };
  }

  /**
   * Create log sections based on options
   */
  private createSections(session: ExportSession): LogSection[] {
    const sections: LogSection[] = [];

    if (this.options.sectionsToInclude.includes('summary')) {
      sections.push(this.createSummarySection(session));
    }

    if (this.options.sectionsToInclude.includes('exports')) {
      sections.push(this.createExportsSection(session));
    }

    if (this.options.sectionsToInclude.includes('errors') && this.hasErrors(session)) {
      sections.push(this.createErrorsSection(session));
    }

    if (this.options.sectionsToInclude.includes('warnings') && this.hasWarnings(session)) {
      sections.push(this.createWarningsSection(session));
    }

    if (this.options.includeDebugInfo) {
      sections.push(this.createDebugSection(session));
    }

    return sections;
  }

  /**
   * Create summary section
   */
  private createSummarySection(session: ExportSession): LogSection {
    const results = Array.from(session.results.values());
    
    return {
      title: 'Export Summary',
      level: 2,
      content: {
        'Document': session.documentName,
        'Export ID': session.exportId,
        'Formats Requested': session.exportFormats.join(', '),
        'Start Time': this.formatTimestamp(session.startTime),
        'End Time': session.endTime ? this.formatTimestamp(session.endTime) : 'In Progress',
        'Total Duration': session.endTime 
          ? `${((session.endTime.getTime() - session.startTime.getTime()) / 1000).toFixed(2)}s`
          : 'N/A',
        'Success Rate': `${this.calculateSuccessRate(results)}%`
      }
    };
  }

  /**
   * Create exports detail section
   */
  private createExportsSection(session: ExportSession): LogSection {
    const subsections: LogSection[] = [];

    session.results.forEach((result, format) => {
      subsections.push({
        title: `${format.toUpperCase()} Export`,
        level: 3,
        content: this.formatExportResult(result)
      });
    });

    return {
      title: 'Export Details',
      level: 2,
      content: '',
      subsections
    };
  }

  /**
   * Create errors section
   */
  private createErrorsSection(session: ExportSession): LogSection {
    const allErrors: Array<{ format: string; error: ExportError }> = [];

    // Collect errors from each format
    session.results.forEach((result, format) => {
      result.errors?.forEach(error => {
        allErrors.push({ format, error });
      });
    });

    // Add global errors
    session.globalErrors.forEach((error, index) => {
      allErrors.push({
        format: 'global',
        error: {
          code: 'GLOBAL_ERROR',
          message: error.message || 'Unknown error',
          details: error.stack
        }
      });
    });

    // Limit errors if needed
    const displayErrors = allErrors.slice(0, this.options.maxErrorDetails);
    const truncated = allErrors.length > displayErrors.length;

    const content = displayErrors.map(({ format, error }) => 
      `[${format}] ${error.code}: ${error.message}`
    );

    if (truncated) {
      content.push(`... and ${allErrors.length - displayErrors.length} more errors`);
    }

    return {
      title: 'Errors',
      level: 2,
      content
    };
  }

  /**
   * Create warnings section
   */
  private createWarningsSection(session: ExportSession): LogSection {
    const allWarnings: string[] = [];

    // Collect warnings from each format
    session.results.forEach((result, format) => {
      result.warnings?.forEach(warning => {
        allWarnings.push(`[${format}] ${warning.code}: ${warning.message}`);
      });
    });

    // Add global warnings
    session.globalWarnings.forEach(warning => {
      allWarnings.push(`[global] ${warning}`);
    });

    return {
      title: 'Warnings',
      level: 2,
      content: allWarnings
    };
  }

  /**
   * Create debug section
   */
  private createDebugSection(session: ExportSession): LogSection {
    const debugInfo: Record<string, any> = {
      'Node Version': process.version,
      'Platform': process.platform,
      'Memory Usage': `${Math.round(process.memoryUsage().heapUsed / 1048576)}MB`,
      'Export Options': {}
    };

    // Add format-specific debug info
    session.results.forEach((result, format) => {
      debugInfo['Export Options'][format] = result.metadata || {};
    });

    return {
      title: 'Debug Information',
      level: 2,
      content: debugInfo
    };
  }

  /**
   * Extract errors from session
   */
  private extractErrors(session: ExportSession): ErrorEntry[] {
    const errors: ErrorEntry[] = [];

    session.results.forEach((result, format) => {
      result.errors?.forEach(error => {
        errors.push({
          timestamp: this.formatTimestamp(new Date()),
          code: error.code,
          message: error.message,
          context: {
            format,
            item: error.item,
            details: this.options.includeDebugInfo ? error.details : undefined
          }
        });
      });
    });

    // Add global errors
    session.globalErrors.forEach(error => {
      errors.push({
        timestamp: this.formatTimestamp(new Date()),
        code: 'SYSTEM_ERROR',
        message: error.message || 'Unknown error',
        context: { source: 'global' },
        stackTrace: this.options.includeDebugInfo ? error.stack : undefined
      });
    });

    return errors;
  }

  /**
   * Extract warnings from session
   */
  private extractWarnings(session: ExportSession): WarningEntry[] {
    const warnings: WarningEntry[] = [];

    session.results.forEach((result, format) => {
      result.warnings?.forEach(warning => {
        warnings.push({
          timestamp: this.formatTimestamp(new Date()),
          code: warning.code,
          message: warning.message,
          context: {
            format,
            item: warning.item
          },
          suggestion: warning.suggestion
        });
      });
    });

    return warnings;
  }

  /**
   * Create log footer
   */
  private createFooter(session: ExportSession): LogFooter {
    const endTime = session.endTime || new Date();
    const duration = (endTime.getTime() - session.startTime.getTime()) / 1000;

    const notes: string[] = [];
    
    // Add completion status
    if (session.endTime) {
      notes.push('Export completed successfully');
    } else {
      notes.push('Export log generated during processing');
    }

    // Add recommendations
    const results = Array.from(session.results.values());
    const failureCount = results.filter(r => r.status === 'failure').length;
    
    if (failureCount > 0) {
      notes.push(`${failureCount} export(s) failed - review errors for details`);
    }

    const totalWarnings = results.reduce((sum, r) => sum + (r.warnings?.length || 0), 0);
    if (totalWarnings > 10) {
      notes.push('High number of warnings detected - consider reviewing export quality');
    }

    return {
      generatedAt: this.formatTimestamp(new Date()),
      exportDuration: duration,
      platformVersion: '1.0.0',
      additionalNotes: notes
    };
  }

  /**
   * Helper methods
   */

  private formatTimestamp(date: Date): string {
    switch (this.options.timestampFormat) {
      case 'ISO':
        return date.toISOString();
      case 'locale':
        return date.toLocaleString();
      case 'unix':
        return date.getTime().toString();
      default:
        return date.toISOString();
    }
  }

  private generateHighlights(session: ExportSession): string[] {
    const highlights: string[] = [];
    const results = Array.from(session.results.values());

    // Success rate
    const successRate = this.calculateSuccessRate(results);
    if (successRate === 100) {
      highlights.push('✅ All exports completed successfully');
    } else if (successRate >= 80) {
      highlights.push(`⚡ ${successRate}% export success rate`);
    } else {
      highlights.push(`⚠️ Only ${successRate}% of exports succeeded`);
    }

    // Item counts
    const totalItems = results.reduce((sum, r) => sum + (r.itemCount || 0), 0);
    if (totalItems > 1000) {
      highlights.push(`📊 Processed ${totalItems.toLocaleString()} items`);
    }

    // Performance
    if (session.endTime) {
      const duration = (session.endTime.getTime() - session.startTime.getTime()) / 1000;
      if (duration < 10) {
        highlights.push(`🚀 Fast export completed in ${duration.toFixed(1)}s`);
      }
    }

    // Format-specific highlights
    if (session.results.has('rag')) {
      const ragResult = session.results.get('rag');
      if (ragResult?.itemCount) {
        highlights.push(`🧩 Generated ${ragResult.itemCount} RAG chunks`);
      }
    }

    if (session.results.has('jsonl')) {
      const jsonlResult = session.results.get('jsonl');
      if (jsonlResult?.metadata?.averageQuality > 0.8) {
        highlights.push('🎯 High-quality training data generated');
      }
    }

    return highlights;
  }

  private calculateSuccessRate(results: ExportResult[]): number {
    if (results.length === 0) return 0;
    const successful = results.filter(r => r.status === 'success').length;
    return Math.round((successful / results.length) * 100);
  }

  private formatExportResult(result: ExportResult): Record<string, any> {
    const formatted: Record<string, any> = {
      'Status': result.status,
      'Items': result.itemCount || 0,
      'File Size': result.fileSize ? `${(result.fileSize / 1024).toFixed(2)}KB` : 'N/A',
      'Errors': result.errors?.length || 0,
      'Warnings': result.warnings?.length || 0
    };

    // Add metadata if available
    if (result.metadata) {
      Object.entries(result.metadata).forEach(([key, value]) => {
        if (typeof value !== 'object') {
          formatted[key] = value;
        }
      });
    }

    return formatted;
  }

  private hasErrors(session: ExportSession): boolean {
    return Array.from(session.results.values()).some(r => r.errors && r.errors.length > 0) ||
           session.globalErrors.length > 0;
  }

  private hasWarnings(session: ExportSession): boolean {
    return Array.from(session.results.values()).some(r => r.warnings && r.warnings.length > 0) ||
           session.globalWarnings.length > 0;
  }

  private createFormatter(format: 'markdown' | 'plain' | 'json' | 'html'): LogFormatter {
    switch (format) {
      case 'markdown':
        return new MarkdownFormatter();
      case 'plain':
        return new PlainTextFormatter();
      case 'json':
        return new JSONFormatter();
      case 'html':
        return new HTMLFormatter();
      default:
        return new MarkdownFormatter();
    }
  }

  private validateLog(log: ExportLog): { warnings: ExportWarning[] } {
    const warnings: ExportWarning[] = [];

    // Check for empty sections
    if (log.sections.length === 0) {
      warnings.push({
        code: 'EMPTY_LOG',
        message: 'Log contains no sections',
        suggestion: 'Check sectionsToInclude configuration'
      });
    }

    // Check error count
    if (log.errors.length > 50) {
      warnings.push({
        code: 'EXCESSIVE_ERRORS',
        message: 'Log contains excessive number of errors',
        suggestion: 'Consider truncating error details'
      });
    }

    return { warnings };
  }

  /**
   * Export log to file
   */
  async exportToFile(log: ExportLog, filePath: string): Promise<void> {
    const fs = await import('fs/promises');
    const content = this.formatter.format(log);
    await fs.writeFile(filePath, content, 'utf-8');
  }
}

/**
 * Base formatter interface
 */
abstract class LogFormatter {
  abstract format(log: ExportLog): string;
}

/**
 * Markdown formatter
 */
class MarkdownFormatter extends LogFormatter {
  format(log: ExportLog): string {
    const lines: string[] = [];

    // Header
    lines.push(`# ${log.header.title}`);
    lines.push('');
    lines.push(`**Export ID:** ${log.header.exportId}`);
    lines.push(`**Date:** ${log.header.timestamp}`);
    lines.push(`**Document:** ${log.header.documentName}`);
    lines.push(`**Formats:** ${log.header.exportFormats.join(', ')}`);
    lines.push('');

    // Summary
    lines.push('## Summary');
    lines.push('');
    log.summary.highlights.forEach(highlight => {
      lines.push(`- ${highlight}`);
    });
    lines.push('');
    lines.push(`**Total Items:** ${log.summary.totalItems}`);
    lines.push(`**Successful Exports:** ${log.summary.successfulExports}`);
    lines.push(`**Failed Exports:** ${log.summary.failedExports}`);
    lines.push(`**Processing Time:** ${log.summary.processingTime.toFixed(2)}s`);
    lines.push('');

    // Sections
    log.sections.forEach(section => {
      lines.push(...this.formatSection(section));
    });

    // Errors
    if (log.errors.length > 0) {
      lines.push('## Errors');
      lines.push('');
      log.errors.forEach(error => {
        lines.push(`- **[${error.timestamp}]** ${error.code}: ${error.message}`);
        if (error.stackTrace) {
          lines.push('  ```');
          lines.push(`  ${error.stackTrace}`);
          lines.push('  ```');
        }
      });
      lines.push('');
    }

    // Warnings
    if (log.warnings.length > 0) {
      lines.push('## Warnings');
      lines.push('');
      log.warnings.forEach(warning => {
        lines.push(`- **[${warning.timestamp}]** ${warning.code}: ${warning.message}`);
        if (warning.suggestion) {
          lines.push(`  💡 ${warning.suggestion}`);
        }
      });
      lines.push('');
    }

    // Footer
    lines.push('---');
    lines.push(`Generated: ${log.footer.generatedAt}`);
    lines.push(`Duration: ${log.footer.exportDuration.toFixed(2)}s`);
    lines.push(`Platform Version: ${log.footer.platformVersion}`);
    
    if (log.footer.additionalNotes && log.footer.additionalNotes.length > 0) {
      lines.push('');
      lines.push('**Notes:**');
      log.footer.additionalNotes.forEach(note => {
        lines.push(`- ${note}`);
      });
    }

    return lines.join('\n');
  }

  private formatSection(section: LogSection, lines: string[] = []): string[] {
    const heading = '#'.repeat(section.level) + ' ' + section.title;
    lines.push(heading);
    lines.push('');

    if (typeof section.content === 'string') {
      lines.push(section.content);
    } else if (Array.isArray(section.content)) {
      section.content.forEach(item => {
        lines.push(`- ${item}`);
      });
    } else if (typeof section.content === 'object') {
      Object.entries(section.content).forEach(([key, value]) => {
        if (typeof value === 'object') {
          lines.push(`**${key}:**`);
          lines.push('```json');
          lines.push(JSON.stringify(value, null, 2));
          lines.push('```');
        } else {
          lines.push(`**${key}:** ${value}`);
        }
      });
    }
    lines.push('');

    if (section.subsections) {
      section.subsections.forEach(subsection => {
        this.formatSection(subsection, lines);
      });
    }

    return lines;
  }
}

/**
 * Plain text formatter
 */
class PlainTextFormatter extends LogFormatter {
  format(log: ExportLog): string {
    const lines: string[] = [];
    const separator = '='.repeat(60);

    // Header
    lines.push(separator);
    lines.push(log.header.title.toUpperCase());
    lines.push(separator);
    lines.push(`Export ID: ${log.header.exportId}`);
    lines.push(`Date: ${log.header.timestamp}`);
    lines.push(`Document: ${log.header.documentName}`);
    lines.push(`Formats: ${log.header.exportFormats.join(', ')}`);
    lines.push('');

    // Continue with plain text formatting...
    // (Similar to markdown but without special characters)

    return lines.join('\n');
  }
}

/**
 * JSON formatter
 */
class JSONFormatter extends LogFormatter {
  format(log: ExportLog): string {
    return JSON.stringify(log, null, 2);
  }
}

/**
 * HTML formatter
 */
class HTMLFormatter extends LogFormatter {
  format(log: ExportLog): string {
    // Basic HTML formatting
    return `
<!DOCTYPE html>
<html>
<head>
  <title>${log.header.title}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    h1, h2, h3 { color: #333; }
    .summary { background: #f5f5f5; padding: 10px; }
    .error { color: red; }
    .warning { color: orange; }
  </style>
</head>
<body>
  <h1>${log.header.title}</h1>
  <!-- Continue with HTML formatting... -->
</body>
</html>`;
  }
}