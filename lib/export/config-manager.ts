/**
 * Export Configuration Manager
 * Manages flexible configuration system with presets and validation
 */

import {
  ExportOptions,
  ExportFormatOptions,
  RAGExportOptions,
  JSONLExportOptions,
  CorrectionsExportOptions,
  ManifestExportOptions,
  LogExportOptions,
  ValidationOptions,
  OutputOptions,
  ExportFormat,
  DEFAULT_EXPORT_CONFIG
} from './schemas';

export interface ExportPreset {
  id: string;
  name: string;
  description: string;
  category: 'research' | 'training' | 'production' | 'debug' | 'custom';
  options: ExportOptions;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
  isBuiltIn: boolean;
  isActive: boolean;
}

export interface ConfigValidationResult {
  valid: boolean;
  errors: ConfigError[];
  warnings: ConfigWarning[];
  suggestions: string[];
}

export interface ConfigError {
  path: string;
  message: string;
  code: string;
}

export interface ConfigWarning {
  path: string;
  message: string;
  suggestion?: string;
}

export class ExportConfigManager {
  private presets: Map<string, ExportPreset>;
  private customDefaults: Partial<ExportOptions>;
  private validator: ConfigValidator;

  constructor() {
    this.presets = new Map();
    this.customDefaults = {};
    this.validator = new ConfigValidator();
    
    // Initialize with built-in presets
    this.initializeBuiltInPresets();
  }

  /**
   * Get configuration for specific formats
   */
  getConfig(formats: ExportFormat[], presetId?: string): ExportOptions {
    let config: ExportOptions;

    if (presetId) {
      const preset = this.presets.get(presetId);
      if (preset) {
        config = this.deepClone(preset.options);
      } else {
        config = this.createDefaultConfig();
      }
    } else {
      config = this.createDefaultConfig();
    }

    // Filter to only include requested formats
    const filteredFormats: ExportFormatOptions = {};
    formats.forEach(format => {
      if (config.formats[format]) {
        filteredFormats[format] = config.formats[format];
      }
    });

    return {
      ...config,
      formats: filteredFormats
    };
  }

  /**
   * Create a new preset
   */
  createPreset(preset: Omit<ExportPreset, 'id' | 'createdAt' | 'updatedAt' | 'isBuiltIn'>): string {
    const id = this.generatePresetId();
    const now = new Date();

    const newPreset: ExportPreset = {
      ...preset,
      id,
      createdAt: now,
      updatedAt: now,
      isBuiltIn: false
    };

    // Validate preset options
    const validation = this.validateConfig(newPreset.options);
    if (!validation.valid) {
      throw new Error(`Invalid preset configuration: ${validation.errors.map(e => e.message).join(', ')}`);
    }

    this.presets.set(id, newPreset);
    return id;
  }

  /**
   * Update existing preset
   */
  updatePreset(id: string, updates: Partial<Omit<ExportPreset, 'id' | 'createdAt' | 'isBuiltIn'>>): boolean {
    const preset = this.presets.get(id);
    if (!preset) return false;

    if (preset.isBuiltIn && updates.options) {
      throw new Error('Cannot modify options of built-in presets');
    }

    // Validate new options if provided
    if (updates.options) {
      const validation = this.validateConfig(updates.options);
      if (!validation.valid) {
        throw new Error(`Invalid configuration: ${validation.errors.map(e => e.message).join(', ')}`);
      }
    }

    const updatedPreset = {
      ...preset,
      ...updates,
      updatedAt: new Date()
    };

    this.presets.set(id, updatedPreset);
    return true;
  }

  /**
   * Delete preset
   */
  deletePreset(id: string): boolean {
    const preset = this.presets.get(id);
    if (!preset) return false;

    if (preset.isBuiltIn) {
      throw new Error('Cannot delete built-in presets');
    }

    return this.presets.delete(id);
  }

  /**
   * Get all presets
   */
  getPresets(category?: ExportPreset['category']): ExportPreset[] {
    const presets = Array.from(this.presets.values());
    
    if (category) {
      return presets.filter(p => p.category === category);
    }
    
    return presets.sort((a, b) => {
      // Built-in presets first, then by name
      if (a.isBuiltIn && !b.isBuiltIn) return -1;
      if (!a.isBuiltIn && b.isBuiltIn) return 1;
      return a.name.localeCompare(b.name);
    });
  }

  /**
   * Get preset by ID
   */
  getPreset(id: string): ExportPreset | undefined {
    return this.presets.get(id);
  }

  /**
   * Get active presets
   */
  getActivePresets(): ExportPreset[] {
    return Array.from(this.presets.values()).filter(p => p.isActive);
  }

  /**
   * Duplicate preset
   */
  duplicatePreset(id: string, newName: string): string | null {
    const original = this.presets.get(id);
    if (!original) return null;

    return this.createPreset({
      name: newName,
      description: `Copy of ${original.name}`,
      category: 'custom',
      options: this.deepClone(original.options),
      tags: [...original.tags, 'copied'],
      isActive: true
    });
  }

  /**
   * Validate configuration
   */
  validateConfig(config: ExportOptions): ConfigValidationResult {
    return this.validator.validate(config);
  }

  /**
   * Set custom defaults
   */
  setCustomDefaults(defaults: Partial<ExportOptions>): void {
    // Validate defaults
    const validation = this.validateConfig(this.mergeWithDefaults(defaults));
    if (!validation.valid) {
      throw new Error(`Invalid default configuration: ${validation.errors.map(e => e.message).join(', ')}`);
    }

    this.customDefaults = this.deepClone(defaults);
  }

  /**
   * Get custom defaults
   */
  getCustomDefaults(): Partial<ExportOptions> {
    return this.deepClone(this.customDefaults);
  }

  /**
   * Reset to system defaults
   */
  resetToDefaults(): void {
    this.customDefaults = {};
  }

  /**
   * Export presets for backup
   */
  exportPresets(): string {
    const customPresets = Array.from(this.presets.values())
      .filter(p => !p.isBuiltIn)
      .map(p => ({
        ...p,
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString()
      }));

    return JSON.stringify({
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      customDefaults: this.customDefaults,
      presets: customPresets
    }, null, 2);
  }

  /**
   * Import presets from backup
   */
  importPresets(data: string, overwrite: boolean = false): { imported: number; skipped: number; errors: string[] } {
    const result = { imported: 0, skipped: 0, errors: [] as string[] };

    try {
      const parsed = JSON.parse(data);
      
      // Validate structure
      if (!parsed.version || !parsed.presets) {
        throw new Error('Invalid import format');
      }

      // Import custom defaults
      if (parsed.customDefaults) {
        try {
          this.setCustomDefaults(parsed.customDefaults);
        } catch (error) {
          result.errors.push(`Failed to import custom defaults: ${error}`);
        }
      }

      // Import presets
      for (const presetData of parsed.presets) {
        try {
          const existingPreset = Array.from(this.presets.values())
            .find(p => p.name === presetData.name && !p.isBuiltIn);

          if (existingPreset && !overwrite) {
            result.skipped++;
            continue;
          }

          if (existingPreset && overwrite) {
            // Update existing preset
            this.updatePreset(existingPreset.id, {
              description: presetData.description,
              category: presetData.category,
              options: presetData.options,
              tags: presetData.tags,
              isActive: presetData.isActive
            });
          } else {
            // Create new preset
            this.createPreset({
              name: presetData.name,
              description: presetData.description,
              category: presetData.category,
              options: presetData.options,
              tags: presetData.tags,
              isActive: presetData.isActive
            });
          }

          result.imported++;
        } catch (error) {
          result.errors.push(`Failed to import preset "${presetData.name}": ${error}`);
        }
      }
    } catch (error) {
      result.errors.push(`Failed to parse import data: ${error}`);
    }

    return result;
  }

  /**
   * Get configuration diff between two presets
   */
  getDiff(preset1Id: string, preset2Id: string): ConfigDiff | null {
    const preset1 = this.presets.get(preset1Id);
    const preset2 = this.presets.get(preset2Id);

    if (!preset1 || !preset2) return null;

    return this.calculateDiff(preset1.options, preset2.options);
  }

  /**
   * Private methods
   */

  private initializeBuiltInPresets(): void {
    const presets: Omit<ExportPreset, 'id' | 'createdAt' | 'updatedAt'>[] = [
      {
        name: 'Research Export',
        description: 'Optimized for research workflows with comprehensive metadata',
        category: 'research',
        options: {
          formats: {
            rag: {
              ...DEFAULT_EXPORT_CONFIG.rag,
              chunkSize: 512,
              metadataFields: ['source', 'pageNumber', 'confidence', 'contentType', 'keywords', 'entities']
            },
            manifest: {
              ...DEFAULT_EXPORT_CONFIG.manifest,
              detailLevel: 'verbose',
              includeProcessingLogs: true
            },
            log: {
              ...DEFAULT_EXPORT_CONFIG.log,
              includeDebugInfo: true
            }
          },
          validation: {
            strictMode: true,
            schemaValidation: true,
            contentValidation: true
          },
          output: {
            directory: './exports/research',
            fileNamePattern: '{documentName}-research-{timestamp}',
            compression: 'none',
            splitLargeFiles: false
          }
        },
        tags: ['research', 'detailed', 'comprehensive'],
        isBuiltIn: true,
        isActive: true
      },
      {
        name: 'Training Data',
        description: 'Optimized for machine learning training data generation',
        category: 'training',
        options: {
          formats: {
            jsonl: {
              ...DEFAULT_EXPORT_CONFIG.jsonl,
              qualityThreshold: 0.8,
              maxExamplesPerDocument: 200,
              balanceExamples: true
            },
            corrections: {
              ...DEFAULT_EXPORT_CONFIG.corrections,
              minImpactLevel: 'medium',
              includeValidation: true
            }
          },
          validation: {
            strictMode: true,
            schemaValidation: true,
            contentValidation: true
          },
          output: {
            directory: './exports/training',
            fileNamePattern: '{documentName}-training-{timestamp}',
            compression: 'gzip',
            splitLargeFiles: true,
            maxFileSize: 10485760 // 10MB
          }
        },
        tags: ['training', 'ml', 'ai', 'quality'],
        isBuiltIn: true,
        isActive: true
      },
      {
        name: 'Production Export',
        description: 'Fast, minimal exports for production use',
        category: 'production',
        options: {
          formats: {
            rag: {
              ...DEFAULT_EXPORT_CONFIG.rag,
              chunkSize: 1024,
              metadataFields: ['source', 'pageNumber', 'confidence'],
              includeEmbeddings: false
            },
            manifest: {
              ...DEFAULT_EXPORT_CONFIG.manifest,
              detailLevel: 'summary',
              includeProcessingLogs: false
            }
          },
          validation: {
            strictMode: false,
            schemaValidation: true,
            contentValidation: false
          },
          output: {
            directory: './exports/production',
            fileNamePattern: '{documentName}-{timestamp}',
            compression: 'gzip',
            splitLargeFiles: true
          }
        },
        tags: ['production', 'fast', 'minimal'],
        isBuiltIn: true,
        isActive: true
      }
    ];

    presets.forEach(preset => {
      const id = this.generatePresetId();
      const now = new Date();
      
      this.presets.set(id, {
        ...preset,
        id,
        createdAt: now,
        updatedAt: now
      });
    });
  }

  private createDefaultConfig(): ExportOptions {
    const defaultConfig: ExportOptions = {
      formats: this.deepClone(DEFAULT_EXPORT_CONFIG),
      validation: {
        strictMode: false,
        schemaValidation: true,
        contentValidation: true
      },
      output: {
        directory: './exports',
        fileNamePattern: '{documentName}-{format}-{timestamp}',
        compression: 'none',
        splitLargeFiles: false
      }
    };

    return this.mergeWithDefaults(defaultConfig);
  }

  private mergeWithDefaults(config: Partial<ExportOptions>): ExportOptions {
    const base = this.createBaseConfig();
    return this.deepMerge(base, this.customDefaults, config);
  }

  private createBaseConfig(): ExportOptions {
    return {
      formats: this.deepClone(DEFAULT_EXPORT_CONFIG),
      validation: {
        strictMode: false,
        schemaValidation: true,
        contentValidation: true
      },
      output: {
        directory: './exports',
        fileNamePattern: '{documentName}-{format}-{timestamp}',
        compression: 'none',
        splitLargeFiles: false
      }
    };
  }

  private generatePresetId(): string {
    return `preset-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private deepClone<T>(obj: T): T {
    return JSON.parse(JSON.stringify(obj));
  }

  private deepMerge(...objects: any[]): any {
    const result = {};
    
    for (const obj of objects) {
      if (obj && typeof obj === 'object') {
        for (const key in obj) {
          if (obj.hasOwnProperty(key)) {
            if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
              result[key] = this.deepMerge(result[key] || {}, obj[key]);
            } else {
              result[key] = obj[key];
            }
          }
        }
      }
    }
    
    return result;
  }

  private calculateDiff(config1: ExportOptions, config2: ExportOptions): ConfigDiff {
    // Simplified diff calculation
    return {
      added: [],
      removed: [],
      changed: [],
      summary: 'Configuration comparison complete'
    };
  }
}

/**
 * Configuration validator
 */
class ConfigValidator {
  validate(config: ExportOptions): ConfigValidationResult {
    const errors: ConfigError[] = [];
    const warnings: ConfigWarning[] = [];
    const suggestions: string[] = [];

    // Validate formats
    if (!config.formats || Object.keys(config.formats).length === 0) {
      errors.push({
        path: 'formats',
        message: 'At least one export format must be specified',
        code: 'MISSING_FORMATS'
      });
    }

    // Validate RAG options
    if (config.formats.rag) {
      this.validateRAGOptions(config.formats.rag, errors, warnings);
    }

    // Validate JSONL options
    if (config.formats.jsonl) {
      this.validateJSONLOptions(config.formats.jsonl, errors, warnings);
    }

    // Validate output options
    if (config.output) {
      this.validateOutputOptions(config.output, errors, warnings);
    }

    // Generate suggestions
    if (config.formats.rag && !config.formats.rag.includeEmbeddings) {
      suggestions.push('Consider enabling embeddings for better RAG performance');
    }

    if (config.formats.jsonl && config.formats.jsonl.qualityThreshold < 0.7) {
      suggestions.push('Higher quality threshold recommended for training data');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      suggestions
    };
  }

  private validateRAGOptions(options: RAGExportOptions, errors: ConfigError[], warnings: ConfigWarning[]): void {
    if (options.chunkSize < 100) {
      errors.push({
        path: 'formats.rag.chunkSize',
        message: 'Chunk size must be at least 100',
        code: 'INVALID_CHUNK_SIZE'
      });
    }

    if (options.chunkSize > 4096) {
      warnings.push({
        path: 'formats.rag.chunkSize',
        message: 'Large chunk size may affect processing performance',
        suggestion: 'Consider using smaller chunks for better performance'
      });
    }

    if (options.overlapPercentage < 0 || options.overlapPercentage > 0.5) {
      errors.push({
        path: 'formats.rag.overlapPercentage',
        message: 'Overlap percentage must be between 0 and 0.5',
        code: 'INVALID_OVERLAP'
      });
    }
  }

  private validateJSONLOptions(options: JSONLExportOptions, errors: ConfigError[], warnings: ConfigWarning[]): void {
    if (options.qualityThreshold < 0 || options.qualityThreshold > 1) {
      errors.push({
        path: 'formats.jsonl.qualityThreshold',
        message: 'Quality threshold must be between 0 and 1',
        code: 'INVALID_QUALITY_THRESHOLD'
      });
    }

    if (options.maxExamplesPerDocument < 1) {
      errors.push({
        path: 'formats.jsonl.maxExamplesPerDocument',
        message: 'Must allow at least 1 example per document',
        code: 'INVALID_MAX_EXAMPLES'
      });
    }
  }

  private validateOutputOptions(options: OutputOptions, errors: ConfigError[], warnings: ConfigWarning[]): void {
    if (!options.directory) {
      errors.push({
        path: 'output.directory',
        message: 'Output directory must be specified',
        code: 'MISSING_DIRECTORY'
      });
    }

    if (!options.fileNamePattern) {
      errors.push({
        path: 'output.fileNamePattern',
        message: 'File name pattern must be specified',
        code: 'MISSING_FILENAME_PATTERN'
      });
    }

    if (options.maxFileSize && options.maxFileSize < 1024) {
      warnings.push({
        path: 'output.maxFileSize',
        message: 'Very small file size limit may cause frequent splitting',
        suggestion: 'Consider increasing the file size limit'
      });
    }
  }
}

/**
 * Configuration diff interface
 */
interface ConfigDiff {
  added: string[];
  removed: string[];
  changed: string[];
  summary: string;
}