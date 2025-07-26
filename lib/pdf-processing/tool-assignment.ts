import { DetectedZone, ToolRecommendation, ContentCharacteristics } from './content-analyzer';

// Core interfaces for tool assignment
export interface ToolAssignmentResult {
  zoneId: string;
  primaryTool: AssignedTool;
  fallbackTools: AssignedTool[];
  assignmentReasoning: AssignmentReasoning;
  confidence: number;
  estimatedProcessingTime: number;
  resourceRequirements: ResourceRequirement[];
}

export interface AssignedTool {
  name: string;
  priority: number;
  confidence: number;
  expectedAccuracy: number;
  processingTime: number;
  memoryRequirement: number;
  configuration: ToolConfiguration;
  capabilities: ToolCapabilities;
}

export interface ToolConfiguration {
  parameters: Record<string, any>;
  timeout: number;
  retryAttempts: number;
  parallelizable: boolean;
  resourceLimits: ResourceLimits;
}

export interface ToolCapabilities {
  supportedContentTypes: string[];
  maxDocumentSize: number;
  accuracyRating: number;
  speedRating: number;
  memoryEfficiency: number;
  complexity: 'low' | 'medium' | 'high';
  languages: string[];
  specialFeatures: string[];
}

export interface ResourceRequirement {
  type: 'memory' | 'cpu' | 'disk' | 'network';
  amount: number;
  duration: number;
  priority: 'low' | 'medium' | 'high';
}

export interface ResourceLimits {
  maxMemoryMB: number;
  maxCpuSeconds: number;
  maxDiskMB: number;
  timeoutSeconds: number;
}

export interface AssignmentReasoning {
  primaryFactors: AssignmentFactor[];
  contentAnalysis: ContentAnalysisInsight[];
  toolComparison: ToolComparison[];
  riskAssessment: RiskAssessment;
  alternativeOptions: AlternativeOption[];
}

export interface AssignmentFactor {
  name: string;
  weight: number;
  score: number;
  impact: number;
  description: string;
}

export interface ContentAnalysisInsight {
  characteristic: string;
  value: number;
  impact: 'positive' | 'negative' | 'neutral';
  reasoning: string;
}

export interface ToolComparison {
  toolName: string;
  strengths: string[];
  weaknesses: string[];
  overallScore: number;
  recommendationLevel: 'primary' | 'fallback' | 'not_recommended';
}

export interface RiskAssessment {
  overallRisk: 'low' | 'medium' | 'high';
  riskFactors: RiskFactor[];
  mitigationStrategies: MitigationStrategy[];
}

export interface RiskFactor {
  name: string;
  severity: 'low' | 'medium' | 'high';
  probability: number;
  impact: string;
  mitigation: string;
}

export interface MitigationStrategy {
  strategy: string;
  effectiveness: number;
  cost: number;
  implementation: string;
}

export interface AlternativeOption {
  description: string;
  tools: string[];
  expectedOutcome: string;
  tradeoffs: string[];
}

// Tool capability matrix
export interface ToolCapabilityMatrix {
  [toolName: string]: {
    [contentType: string]: ToolPerformanceMetrics;
  };
}

export interface ToolPerformanceMetrics {
  accuracy: number;
  speed: 'very_fast' | 'fast' | 'medium' | 'slow' | 'very_slow';
  complexity: 'low' | 'medium' | 'high';
  reliability: number;
  memoryUsage: number;
  specializations: string[];
}

// Assignment context for decision making
export interface AssignmentContext {
  documentCharacteristics: DocumentContext;
  systemResources: SystemResourceInfo;
  userPreferences: UserPreferences;
  qualityRequirements: QualityRequirements;
  timeConstraints: TimeConstraints;
  processingHistory: ProcessingHistory[];
}

export interface DocumentContext {
  totalPages: number;
  documentType: string;
  complexity: 'low' | 'medium' | 'high';
  language: string;
  hasMultimedia: boolean;
  fileSize: number;
  processingPriority: number;
}

export interface SystemResourceInfo {
  availableMemory: number;
  cpuUtilization: number;
  activeProcesses: number;
  queueLength: number;
  estimatedWaitTime: number;
}

export interface UserPreferences {
  preferredSpeed: 'fast' | 'balanced' | 'accurate';
  qualityThreshold: number;
  allowedTools: string[];
  restrictedTools: string[];
  timeoutPreference: number;
}

export interface QualityRequirements {
  minimumAccuracy: number;
  confidenceThreshold: number;
  allowFallbacks: boolean;
  requireHumanReview: boolean;
  qualityAssurance: boolean;
}

export interface TimeConstraints {
  maxProcessingTime: number;
  deadline?: Date;
  priorityLevel: 'low' | 'medium' | 'high' | 'urgent';
  allowAsyncProcessing: boolean;
}

export interface ProcessingHistory {
  toolName: string;
  contentType: string;
  accuracy: number;
  processingTime: number;
  success: boolean;
  timestamp: Date;
  documentSimilarity?: number;
}

// Main ToolAssignmentEngine class
export class ToolAssignmentEngine {
  private capabilityMatrix: ToolCapabilityMatrix;
  private assignmentRules: AssignmentRule[];
  private performanceHistory: Map<string, ToolPerformanceHistory>;
  private conflictResolver: ToolConflictResolver;

  constructor() {
    this.capabilityMatrix = this.initializeCapabilityMatrix();
    this.assignmentRules = this.initializeAssignmentRules();
    this.performanceHistory = new Map();
    this.conflictResolver = new ToolConflictResolver();
  }

  async assignTools(
    zones: DetectedZone[], 
    context: AssignmentContext
  ): Promise<ToolAssignmentResult[]> {
    const assignments: ToolAssignmentResult[] = [];

    for (const zone of zones) {
      try {
        const assignment = await this.assignToolToZone(zone, context);
        assignments.push(assignment);
      } catch (error) {
        console.error(`Tool assignment failed for zone ${zone.id}:`, error);
        // Create fallback assignment
        assignments.push(this.createFallbackAssignment(zone));
      }
    }

    // Resolve tool conflicts and resource constraints
    return await this.conflictResolver.resolveConflicts(assignments, context);
  }

  private async assignToolToZone(
    zone: DetectedZone, 
    context: AssignmentContext
  ): Promise<ToolAssignmentResult> {
    
    // Step 1: Analyze zone characteristics
    const contentAnalysis = this.analyzeZoneContent(zone);
    
    // Step 2: Get candidate tools
    const candidateTools = this.getCandidateTools(zone.contentType, contentAnalysis);
    
    // Step 3: Score and rank tools
    const scoredTools = await this.scoreTools(candidateTools, zone, context);
    
    // Step 4: Select primary and fallback tools
    const primaryTool = scoredTools[0];
    const fallbackTools = scoredTools.slice(1, 4); // Top 3 fallbacks
    
    // Step 5: Generate assignment reasoning
    const reasoning = this.generateAssignmentReasoning(
      zone, scoredTools, contentAnalysis, context
    );
    
    // Step 6: Calculate resource requirements
    const resourceRequirements = this.calculateResourceRequirements(
      primaryTool, zone, context
    );

    return {
      zoneId: zone.id,
      primaryTool,
      fallbackTools,
      assignmentReasoning: reasoning,
      confidence: this.calculateAssignmentConfidence(primaryTool, zone),
      estimatedProcessingTime: primaryTool.processingTime,
      resourceRequirements
    };
  }

  private initializeCapabilityMatrix(): ToolCapabilityMatrix {
    return {
      unstructured: {
        text: {
          accuracy: 0.95,
          speed: 'fast',
          complexity: 'low',
          reliability: 0.98,
          memoryUsage: 50,
          specializations: ['general_text', 'mixed_content']
        },
        table: {
          accuracy: 0.75,
          speed: 'medium',
          complexity: 'medium',
          reliability: 0.85,
          memoryUsage: 75,
          specializations: ['simple_tables']
        },
        mixed: {
          accuracy: 0.85,
          speed: 'medium',
          complexity: 'medium',
          reliability: 0.90,
          memoryUsage: 60,
          specializations: ['document_parsing', 'layout_analysis']
        }
      },
      pdfplumber: {
        text: {
          accuracy: 0.88,
          speed: 'medium',
          complexity: 'medium',
          reliability: 0.92,
          memoryUsage: 80,
          specializations: ['structured_text', 'coordinate_extraction']
        },
        table: {
          accuracy: 0.85,
          speed: 'medium',
          complexity: 'medium',
          reliability: 0.88,
          memoryUsage: 100,
          specializations: ['table_detection', 'cell_extraction']
        }
      },
      camelot: {
        table: {
          accuracy: 0.95,
          speed: 'slow',
          complexity: 'high',
          reliability: 0.90,
          memoryUsage: 150,
          specializations: ['complex_tables', 'bordered_tables', 'lattice_detection']
        }
      },
      tabula: {
        table: {
          accuracy: 0.88,
          speed: 'fast',
          complexity: 'medium',
          reliability: 0.85,
          memoryUsage: 90,
          specializations: ['stream_detection', 'simple_tables']
        }
      },
      visual_analyzer: {
        diagram: {
          accuracy: 0.75,
          speed: 'very_slow',
          complexity: 'high',
          reliability: 0.70,
          memoryUsage: 300,
          specializations: ['image_analysis', 'chart_detection', 'diagram_ocr']
        }
      },
      ocr_engine: {
        diagram: {
          accuracy: 0.80,
          speed: 'slow',
          complexity: 'high',
          reliability: 0.85,
          memoryUsage: 200,
          specializations: ['text_in_images', 'scanned_documents']
        },
        text: {
          accuracy: 0.70,
          speed: 'slow',
          complexity: 'medium',
          reliability: 0.80,
          memoryUsage: 120,
          specializations: ['scanned_text', 'poor_quality_pdfs']
        }
      }
    };
  }

  private initializeAssignmentRules(): AssignmentRule[] {
    return [
      {
        name: 'high_accuracy_text',
        condition: (zone) => zone.contentType === 'text' && zone.confidence > 0.9,
        preferredTools: ['unstructured'],
        weight: 1.0,
        reasoning: 'High-confidence text zones work best with general text processors'
      },
      {
        name: 'complex_tables',
        condition: (zone) => zone.contentType === 'table' && 
                             zone.characteristics.complexity === 'high',
        preferredTools: ['camelot', 'pdfplumber'],
        weight: 1.2,
        reasoning: 'Complex tables require specialized table extraction tools'
      },
      {
        name: 'simple_tables',
        condition: (zone) => zone.contentType === 'table' && 
                             zone.characteristics.complexity === 'low',
        preferredTools: ['tabula', 'pdfplumber'],
        weight: 1.0,
        reasoning: 'Simple tables can use faster extraction methods'
      },
      {
        name: 'visual_content',
        condition: (zone) => zone.contentType === 'diagram' || zone.characteristics.hasImages,
        preferredTools: ['visual_analyzer', 'ocr_engine'],
        weight: 1.1,
        reasoning: 'Visual content requires specialized image processing'
      },
      {
        name: 'mixed_content',
        condition: (zone) => zone.contentType === 'mixed',
        preferredTools: ['unstructured', 'pdfplumber'],
        weight: 0.9,
        reasoning: 'Mixed content works well with versatile general processors'
      },
      {
        name: 'low_confidence_fallback',
        condition: (zone) => zone.confidence < 0.7,
        preferredTools: ['unstructured', 'ocr_engine'],
        weight: 0.8,
        reasoning: 'Low confidence zones may benefit from multiple approaches'
      }
    ];
  }

  private analyzeZoneContent(zone: DetectedZone): ContentAnalysisInsight[] {
    const insights: ContentAnalysisInsight[] = [];

    // Text density analysis
    insights.push({
      characteristic: 'text_density',
      value: zone.characteristics.textDensity,
      impact: zone.characteristics.textDensity > 0.5 ? 'positive' : 'negative',
      reasoning: `Text density of ${zone.characteristics.textDensity.toFixed(2)} indicates ${
        zone.characteristics.textDensity > 0.5 ? 'dense text content' : 'sparse or visual content'
      }`
    });

    // Structure analysis
    insights.push({
      characteristic: 'has_structure',
      value: zone.characteristics.hasStructure ? 1 : 0,
      impact: zone.characteristics.hasStructure ? 'positive' : 'neutral',
      reasoning: zone.characteristics.hasStructure 
        ? 'Structured content suggests organized data that tools can parse effectively'
        : 'Unstructured content may require more flexible parsing approaches'
    });

    // Complexity analysis
    const complexityScore = this.calculateComplexityScore(zone.characteristics);
    insights.push({
      characteristic: 'complexity',
      value: complexityScore,
      impact: complexityScore < 0.5 ? 'positive' : 'negative',
      reasoning: `Content complexity score of ${complexityScore.toFixed(2)} suggests ${
        complexityScore < 0.5 ? 'straightforward processing' : 'challenging extraction requirements'
      }`
    });

    // Visual features analysis
    if (zone.visualFeatures) {
      const visualComplexity = zone.visualFeatures.colorComplexity || 0;
      insights.push({
        characteristic: 'visual_complexity',
        value: visualComplexity,
        impact: visualComplexity > 0.7 ? 'negative' : 'neutral',
        reasoning: `Visual complexity of ${visualComplexity.toFixed(2)} ${
          visualComplexity > 0.7 ? 'may require specialized image processing' : 'is manageable'
        }`
      });
    }

    return insights;
  }

  private getCandidateTools(contentType: string, insights: ContentAnalysisInsight[]): string[] {
    const candidates = new Set<string>();

    // Get tools from capability matrix
    for (const [toolName, capabilities] of Object.entries(this.capabilityMatrix)) {
      if (capabilities[contentType]) {
        candidates.add(toolName);
      }
    }

    // Apply assignment rules
    for (const rule of this.assignmentRules) {
      // This is a simplified rule evaluation - would need a proper rule engine
      for (const tool of rule.preferredTools) {
        candidates.add(tool);
      }
    }

    return Array.from(candidates);
  }

  private async scoreTools(
    candidateTools: string[], 
    zone: DetectedZone, 
    context: AssignmentContext
  ): Promise<AssignedTool[]> {
    const scoredTools: AssignedTool[] = [];

    for (const toolName of candidateTools) {
      try {
        const tool = await this.createAssignedTool(toolName, zone, context);
        scoredTools.push(tool);
      } catch (error) {
        console.error(`Failed to score tool ${toolName}:`, error);
      }
    }

    // Sort by overall score (combination of confidence, accuracy, and speed)
    return scoredTools.sort((a, b) => {
      const scoreA = this.calculateOverallToolScore(a, context);
      const scoreB = this.calculateOverallToolScore(b, context);
      return scoreB - scoreA;
    });
  }

  private async createAssignedTool(
    toolName: string, 
    zone: DetectedZone, 
    context: AssignmentContext
  ): Promise<AssignedTool> {
    const capabilities = this.getToolCapabilities(toolName);
    const performance = this.capabilityMatrix[toolName]?.[zone.contentType];
    
    if (!performance) {
      throw new Error(`Tool ${toolName} not suitable for content type ${zone.contentType}`);
    }

    const confidence = this.calculateToolConfidence(toolName, zone, context);
    const processingTime = this.estimateProcessingTime(toolName, zone, context);
    const memoryRequirement = this.estimateMemoryRequirement(toolName, zone);

    return {
      name: toolName,
      priority: this.calculateToolPriority(toolName, zone, context),
      confidence,
      expectedAccuracy: performance.accuracy,
      processingTime,
      memoryRequirement,
      configuration: this.generateToolConfiguration(toolName, zone, context),
      capabilities
    };
  }

  private getToolCapabilities(toolName: string): ToolCapabilities {
    // This would typically be loaded from a configuration or database
    const capabilitiesMap: Record<string, ToolCapabilities> = {
      unstructured: {
        supportedContentTypes: ['text', 'mixed', 'table'],
        maxDocumentSize: 100 * 1024 * 1024, // 100MB
        accuracyRating: 0.95,
        speedRating: 0.85,
        memoryEfficiency: 0.90,
        complexity: 'low',
        languages: ['en', 'es', 'fr', 'de'],
        specialFeatures: ['layout_analysis', 'hierarchical_structure', 'metadata_extraction']
      },
      pdfplumber: {
        supportedContentTypes: ['text', 'table'],
        maxDocumentSize: 50 * 1024 * 1024,
        accuracyRating: 0.88,
        speedRating: 0.75,
        memoryEfficiency: 0.80,
        complexity: 'medium',
        languages: ['en'],
        specialFeatures: ['coordinate_precision', 'table_detection', 'line_analysis']
      },
      camelot: {
        supportedContentTypes: ['table'],
        maxDocumentSize: 20 * 1024 * 1024,
        accuracyRating: 0.95,
        speedRating: 0.50,
        memoryEfficiency: 0.60,
        complexity: 'high',
        languages: ['en'],
        specialFeatures: ['lattice_detection', 'stream_detection', 'complex_tables']
      },
      visual_analyzer: {
        supportedContentTypes: ['diagram', 'image'],
        maxDocumentSize: 30 * 1024 * 1024,
        accuracyRating: 0.75,
        speedRating: 0.30,
        memoryEfficiency: 0.40,
        complexity: 'high',
        languages: ['en'],
        specialFeatures: ['image_processing', 'chart_recognition', 'ocr_integration']
      }
    };

    return capabilitiesMap[toolName] || {
      supportedContentTypes: [zone.contentType],
      maxDocumentSize: 10 * 1024 * 1024,
      accuracyRating: 0.70,
      speedRating: 0.60,
      memoryEfficiency: 0.70,
      complexity: 'medium',
      languages: ['en'],
      specialFeatures: []
    };
  }

  private calculateToolConfidence(
    toolName: string, 
    zone: DetectedZone, 
    context: AssignmentContext
  ): number {
    let confidence = 0.7; // Base confidence

    // Factor in tool capability match
    const performance = this.capabilityMatrix[toolName]?.[zone.contentType];
    if (performance) {
      confidence += performance.accuracy * 0.3;
    }

    // Factor in historical performance
    const history = this.performanceHistory.get(toolName);
    if (history) {
      const historicalAccuracy = this.calculateHistoricalAccuracy(history, zone);
      confidence += historicalAccuracy * 0.2;
    }

    // Factor in content characteristics match
    const characteristicsMatch = this.calculateCharacteristicsMatch(toolName, zone);
    confidence += characteristicsMatch * 0.2;

    // Factor in system resource availability
    const resourceMatch = this.calculateResourceMatch(toolName, context);
    confidence += resourceMatch * 0.1;

    return Math.min(1.0, Math.max(0.1, confidence));
  }

  private calculateComplexityScore(characteristics: ContentCharacteristics): number {
    let score = 0;

    // Factor in text density (lower is more complex for extraction)
    score += (1 - characteristics.textDensity) * 0.3;

    // Factor in font variations (more variations = more complex)
    score += Math.min(1, characteristics.fontSizes.length / 5) * 0.2;

    // Factor in structure (structured is less complex)
    score += characteristics.hasStructure ? 0 : 0.3;

    // Factor in images (images add complexity)
    score += characteristics.hasImages ? 0.2 : 0;

    return Math.min(1.0, score);
  }

  private calculateOverallToolScore(tool: AssignedTool, context: AssignmentContext): number {
    const weights = this.getContextualWeights(context);
    
    return (
      tool.confidence * weights.confidence +
      tool.expectedAccuracy * weights.accuracy +
      (1 - tool.processingTime / 1000) * weights.speed + // Normalize processing time
      (1 - tool.memoryRequirement / 500) * weights.memory // Normalize memory usage
    );
  }

  private getContextualWeights(context: AssignmentContext): Record<string, number> {
    const baseWeights = {
      confidence: 0.3,
      accuracy: 0.4,
      speed: 0.2,
      memory: 0.1
    };

    // Adjust weights based on user preferences
    if (context.userPreferences.preferredSpeed === 'fast') {
      baseWeights.speed += 0.2;
      baseWeights.accuracy -= 0.1;
      baseWeights.confidence -= 0.1;
    } else if (context.userPreferences.preferredSpeed === 'accurate') {
      baseWeights.accuracy += 0.2;
      baseWeights.speed -= 0.1;
      baseWeights.memory -= 0.1;
    }

    // Adjust for system resources
    if (context.systemResources.availableMemory < 1000) {
      baseWeights.memory += 0.2;
      baseWeights.accuracy -= 0.1;
      baseWeights.confidence -= 0.1;
    }

    return baseWeights;
  }

  private calculateToolPriority(
    toolName: string, 
    zone: DetectedZone, 
    context: AssignmentContext
  ): number {
    // Higher numbers = higher priority
    let priority = 5; // Base priority

    // Boost priority for content type specialization
    const performance = this.capabilityMatrix[toolName]?.[zone.contentType];
    if (performance && performance.accuracy > 0.9) {
      priority += 2;
    }

    // Adjust for system load
    if (context.systemResources.cpuUtilization > 0.8) {
      // Prefer faster tools when system is loaded
      if (performance?.speed === 'fast' || performance?.speed === 'very_fast') {
        priority += 1;
      }
    }

    // Adjust for user preferences
    if (context.userPreferences.allowedTools.includes(toolName)) {
      priority += 3;
    }
    if (context.userPreferences.restrictedTools.includes(toolName)) {
      priority -= 5;
    }

    return Math.max(1, Math.min(10, priority));
  }

  private estimateProcessingTime(
    toolName: string, 
    zone: DetectedZone, 
    context: AssignmentContext
  ): number {
    const baseTime = this.getBaseProcessingTime(toolName);
    const complexity = this.calculateComplexityScore(zone.characteristics);
    const zoneSize = zone.coordinates.width * zone.coordinates.height;
    
    // Scale by zone size and complexity
    let estimatedTime = baseTime * (1 + complexity) * (zoneSize / 100000);
    
    // Adjust for system load
    const loadFactor = 1 + (context.systemResources.cpuUtilization * 0.5);
    estimatedTime *= loadFactor;
    
    return Math.round(estimatedTime);
  }

  private getBaseProcessingTime(toolName: string): number {
    const baseTimes: Record<string, number> = {
      unstructured: 100,    // ms
      pdfplumber: 150,
      camelot: 500,
      tabula: 120,
      visual_analyzer: 2000,
      ocr_engine: 800
    };
    
    return baseTimes[toolName] || 200;
  }

  private estimateMemoryRequirement(toolName: string, zone: DetectedZone): number {
    const baseMemory = this.getBaseMemoryRequirement(toolName);
    const zoneSize = zone.coordinates.width * zone.coordinates.height;
    
    // Scale by zone size
    return Math.round(baseMemory * (1 + zoneSize / 1000000));
  }

  private getBaseMemoryRequirement(toolName: string): number {
    const baseMemory: Record<string, number> = {
      unstructured: 50,     // MB
      pdfplumber: 80,
      camelot: 150,
      tabula: 90,
      visual_analyzer: 300,
      ocr_engine: 200
    };
    
    return baseMemory[toolName] || 100;
  }

  private generateToolConfiguration(
    toolName: string, 
    zone: DetectedZone, 
    context: AssignmentContext
  ): ToolConfiguration {
    const baseConfig = this.getBaseToolConfiguration(toolName);
    
    // Customize based on zone characteristics
    if (zone.characteristics.complexity === 'high') {
      baseConfig.timeout *= 2;
      baseConfig.retryAttempts += 1;
    }
    
    // Customize based on context
    if (context.timeConstraints.priorityLevel === 'urgent') {
      baseConfig.timeout = Math.min(baseConfig.timeout, context.timeConstraints.maxProcessingTime);
    }
    
    return baseConfig;
  }

  private getBaseToolConfiguration(toolName: string): ToolConfiguration {
    const configurations: Record<string, ToolConfiguration> = {
      unstructured: {
        parameters: {
          strategy: 'auto',
          include_page_breaks: true,
          chunking_strategy: 'by_title'
        },
        timeout: 30000,
        retryAttempts: 2,
        parallelizable: true,
        resourceLimits: {
          maxMemoryMB: 200,
          maxCpuSeconds: 30,
          maxDiskMB: 100,
          timeoutSeconds: 30
        }
      },
      camelot: {
        parameters: {
          flavor: 'lattice',
          table_areas: null,
          columns: null
        },
        timeout: 60000,
        retryAttempts: 1,
        parallelizable: false,
        resourceLimits: {
          maxMemoryMB: 500,
          maxCpuSeconds: 60,
          maxDiskMB: 200,
          timeoutSeconds: 60
        }
      }
    };
    
    return configurations[toolName] || {
      parameters: {},
      timeout: 30000,
      retryAttempts: 2,
      parallelizable: true,
      resourceLimits: {
        maxMemoryMB: 200,
        maxCpuSeconds: 30,
        maxDiskMB: 100,
        timeoutSeconds: 30
      }
    };
  }

  private generateAssignmentReasoning(
    zone: DetectedZone,
    scoredTools: AssignedTool[],
    contentAnalysis: ContentAnalysisInsight[],
    context: AssignmentContext
  ): AssignmentReasoning {
    const primaryTool = scoredTools[0];
    
    return {
      primaryFactors: this.identifyPrimaryFactors(primaryTool, zone, context),
      contentAnalysis,
      toolComparison: this.generateToolComparison(scoredTools),
      riskAssessment: this.assessRisks(primaryTool, zone, context),
      alternativeOptions: this.generateAlternativeOptions(scoredTools, zone)
    };
  }

  private identifyPrimaryFactors(
    tool: AssignedTool, 
    zone: DetectedZone, 
    context: AssignmentContext
  ): AssignmentFactor[] {
    return [
      {
        name: 'content_type_match',
        weight: 0.4,
        score: tool.expectedAccuracy,
        impact: tool.expectedAccuracy * 0.4,
        description: `Tool specialization for ${zone.contentType} content`
      },
      {
        name: 'confidence_level',
        weight: 0.3,
        score: tool.confidence,
        impact: tool.confidence * 0.3,
        description: 'Overall confidence in tool selection'
      },
      {
        name: 'processing_efficiency',
        weight: 0.2,
        score: 1 - (tool.processingTime / 1000),
        impact: (1 - (tool.processingTime / 1000)) * 0.2,
        description: 'Expected processing speed and resource usage'
      },
      {
        name: 'historical_performance',
        weight: 0.1,
        score: 0.8, // Simplified
        impact: 0.08,
        description: 'Past performance on similar content'
      }
    ];
  }

  private generateToolComparison(tools: AssignedTool[]): ToolComparison[] {
    return tools.slice(0, 3).map((tool, index) => ({
      toolName: tool.name,
      strengths: this.identifyToolStrengths(tool),
      weaknesses: this.identifyToolWeaknesses(tool),
      overallScore: tool.confidence * tool.expectedAccuracy,
      recommendationLevel: index === 0 ? 'primary' : 'fallback'
    }));
  }

  private identifyToolStrengths(tool: AssignedTool): string[] {
    const strengths: string[] = [];
    
    if (tool.expectedAccuracy > 0.9) strengths.push('High accuracy');
    if (tool.processingTime < 500) strengths.push('Fast processing');
    if (tool.capabilities.memoryEfficiency > 0.8) strengths.push('Memory efficient');
    if (tool.capabilities.specialFeatures.length > 2) strengths.push('Feature rich');
    
    return strengths;
  }

  private identifyToolWeaknesses(tool: AssignedTool): string[] {
    const weaknesses: string[] = [];
    
    if (tool.expectedAccuracy < 0.8) weaknesses.push('Lower accuracy');
    if (tool.processingTime > 1000) weaknesses.push('Slower processing');
    if (tool.memoryRequirement > 200) weaknesses.push('High memory usage');
    if (tool.capabilities.complexity === 'high') weaknesses.push('Complex setup');
    
    return weaknesses;
  }

  private assessRisks(
    tool: AssignedTool, 
    zone: DetectedZone, 
    context: AssignmentContext
  ): RiskAssessment {
    const riskFactors: RiskFactor[] = [];
    
    // Accuracy risk
    if (tool.expectedAccuracy < context.qualityRequirements.minimumAccuracy) {
      riskFactors.push({
        name: 'accuracy_below_threshold',
        severity: 'high',
        probability: 0.8,
        impact: 'May not meet quality requirements',
        mitigation: 'Use fallback tools or human review'
      });
    }
    
    // Performance risk
    if (tool.processingTime > context.timeConstraints.maxProcessingTime) {
      riskFactors.push({
        name: 'processing_timeout',
        severity: 'medium',
        probability: 0.6,
        impact: 'May exceed time constraints',
        mitigation: 'Use faster alternative tools'
      });
    }
    
    // Resource risk
    if (tool.memoryRequirement > context.systemResources.availableMemory * 0.8) {
      riskFactors.push({
        name: 'memory_exhaustion',
        severity: 'high',
        probability: 0.7,
        impact: 'May cause system instability',
        mitigation: 'Use more memory-efficient tools or queue processing'
      });
    }
    
    const overallRisk = this.calculateOverallRisk(riskFactors);
    
    return {
      overallRisk,
      riskFactors,
      mitigationStrategies: this.generateMitigationStrategies(riskFactors)
    };
  }

  private calculateOverallRisk(riskFactors: RiskFactor[]): 'low' | 'medium' | 'high' {
    if (riskFactors.length === 0) return 'low';
    
    const highRiskCount = riskFactors.filter(r => r.severity === 'high').length;
    const mediumRiskCount = riskFactors.filter(r => r.severity === 'medium').length;
    
    if (highRiskCount > 0) return 'high';
    if (mediumRiskCount > 1) return 'medium';
    return 'low';
  }

  private generateMitigationStrategies(riskFactors: RiskFactor[]): MitigationStrategy[] {
    const strategies: MitigationStrategy[] = [];
    
    for (const risk of riskFactors) {
      strategies.push({
        strategy: risk.mitigation,
        effectiveness: risk.severity === 'high' ? 0.8 : 0.9,
        cost: risk.severity === 'high' ? 0.7 : 0.3,
        implementation: `Implement ${risk.mitigation.toLowerCase()} for ${risk.name}`
      });
    }
    
    return strategies;
  }

  private generateAlternativeOptions(tools: AssignedTool[], zone: DetectedZone): AlternativeOption[] {
    const alternatives: AlternativeOption[] = [];
    
    // Multi-tool approach
    if (tools.length > 1) {
      alternatives.push({
        description: 'Use multiple tools and merge results',
        tools: tools.slice(0, 2).map(t => t.name),
        expectedOutcome: 'Higher accuracy through consensus',
        tradeoffs: ['Longer processing time', 'Higher resource usage', 'Complex result merging']
      });
    }
    
    // Conservative approach
    const highAccuracyTools = tools.filter(t => t.expectedAccuracy > 0.9);
    if (highAccuracyTools.length > 0) {
      alternatives.push({
        description: 'Use only high-accuracy tools',
        tools: highAccuracyTools.map(t => t.name),
        expectedOutcome: 'Maximum accuracy with potential speed tradeoff',
        tradeoffs: ['Potentially slower processing', 'Higher resource requirements']
      });
    }
    
    return alternatives;
  }

  private calculateResourceRequirements(
    tool: AssignedTool, 
    zone: DetectedZone, 
    context: AssignmentContext
  ): ResourceRequirement[] {
    return [
      {
        type: 'memory',
        amount: tool.memoryRequirement,
        duration: tool.processingTime,
        priority: 'high'
      },
      {
        type: 'cpu',
        amount: this.estimateCpuUsage(tool, zone),
        duration: tool.processingTime,
        priority: 'medium'
      },
      {
        type: 'disk',
        amount: this.estimateDiskUsage(tool, zone),
        duration: tool.processingTime * 2, // Temporary files
        priority: 'low'
      }
    ];
  }

  private estimateCpuUsage(tool: AssignedTool, zone: DetectedZone): number {
    // Simplified CPU estimation based on tool complexity and zone size
    const baseUsage = tool.capabilities.complexity === 'high' ? 80 : 
                     tool.capabilities.complexity === 'medium' ? 50 : 30;
    
    const zoneComplexity = this.calculateComplexityScore(zone.characteristics);
    return Math.round(baseUsage * (1 + zoneComplexity));
  }

  private estimateDiskUsage(tool: AssignedTool, zone: DetectedZone): number {
    // Simplified disk estimation - temporary files during processing
    const zoneSize = zone.coordinates.width * zone.coordinates.height;
    return Math.round(zoneSize / 10000); // MB
  }

  private calculateAssignmentConfidence(tool: AssignedTool, zone: DetectedZone): number {
    return (tool.confidence + tool.expectedAccuracy + zone.confidence) / 3;
  }

  private createFallbackAssignment(zone: DetectedZone): ToolAssignmentResult {
    // Create a basic assignment when tool assignment fails
    const fallbackTool: AssignedTool = {
      name: 'unstructured',
      priority: 1,
      confidence: 0.5,
      expectedAccuracy: 0.7,
      processingTime: 1000,
      memoryRequirement: 100,
      configuration: this.getBaseToolConfiguration('unstructured'),
      capabilities: this.getToolCapabilities('unstructured')
    };

    return {
      zoneId: zone.id,
      primaryTool: fallbackTool,
      fallbackTools: [],
      assignmentReasoning: {
        primaryFactors: [],
        contentAnalysis: [],
        toolComparison: [],
        riskAssessment: {
          overallRisk: 'medium',
          riskFactors: [],
          mitigationStrategies: []
        },
        alternativeOptions: []
      },
      confidence: 0.5,
      estimatedProcessingTime: 1000,
      resourceRequirements: []
    };
  }

  // Helper methods for performance history
  private calculateHistoricalAccuracy(
    history: ToolPerformanceHistory, 
    zone: DetectedZone
  ): number {
    // Simplified historical accuracy calculation
    return 0.8; // Would implement actual historical analysis
  }

  private calculateCharacteristicsMatch(toolName: string, zone: DetectedZone): number {
    // Simplified characteristics matching
    return 0.7; // Would implement actual characteristic matching
  }

  private calculateResourceMatch(toolName: string, context: AssignmentContext): number {
    // Simplified resource matching
    return 0.8; // Would implement actual resource availability checking
  }
}

// Supporting interfaces and classes
interface AssignmentRule {
  name: string;
  condition: (zone: DetectedZone) => boolean;
  preferredTools: string[];
  weight: number;
  reasoning: string;
}

interface ToolPerformanceHistory {
  toolName: string;
  totalExecutions: number;
  successRate: number;
  averageAccuracy: number;
  averageProcessingTime: number;
  recentPerformance: ProcessingHistory[];
}

class ToolConflictResolver {
  async resolveConflicts(
    assignments: ToolAssignmentResult[], 
    context: AssignmentContext
  ): Promise<ToolAssignmentResult[]> {
    // Simplified conflict resolution
    // In a real implementation, this would handle resource conflicts,
    // tool dependencies, and processing order optimization
    return assignments;
  }
}

// Export default instance
export const toolAssignmentEngine = new ToolAssignmentEngine(); 