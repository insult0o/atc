import { Zone } from '../../app/components/zones/ZoneManager';
import { ProcessingResult, ExtractionResult } from './processing-queue';
import { ToolConfidenceScore } from './tool-confidence';
import { WeightedConfidenceScore } from './confidence-weighting';

// Intelligent result merging system
export interface MergedResult {
  content: string;
  confidence: number;
  mergeStrategy: MergeStrategy;
  contributingSources: MergeCandidate[];
  mergeQuality: MergeQualityScore;
  conflicts: MergeConflict[];
  validationResults: MergeValidationResult;
  metadata: MergeMetadata;
}

export interface MergeCandidate {
  toolName: string;
  result: ProcessingResult;
  confidence: WeightedConfidenceScore;
  contribution: number;           // How much this tool contributed (0-1)
  reliability: number;            // Tool reliability for this content (0-1)
  uniqueContent: string[];        // Unique content this tool found
  quality: ExtractionQualityMetrics;
}

export interface MergeStrategy {
  algorithm: MergeAlgorithm;
  parameters: MergeParameters;
  fallbackStrategy?: MergeStrategy;
  confidenceThreshold: number;
  qualityThreshold: number;
}

export type MergeAlgorithm = 
  | 'highest_confidence'      // Select result with highest confidence
  | 'weighted_average'        // Weighted combination of all results
  | 'consensus'              // Merge based on agreement between tools
  | 'hybrid'                 // Adaptive combination of strategies
  | 'specialized'            // Use specialized tool for content type
  | 'ensemble'               // Advanced ensemble method
  | 'ml_driven';             // Machine learning based merging

export interface MergeParameters {
  minimumAgreement: number;         // Minimum agreement threshold (0-1)
  conflictResolution: ConflictResolutionStrategy;
  preserveFormatting: boolean;
  combineMetadata: boolean;
  deduplicationThreshold: number;   // Similarity threshold for deduplication
  structurePreservation: 'strict' | 'moderate' | 'loose';
}

export interface ConflictResolutionStrategy {
  method: 'confidence_based' | 'majority_vote' | 'specialized_tool' | 'manual_review' | 'ai_resolution';
  confidenceWeight: number;
  votingThreshold: number;
  specializedToolPriority: Map<string, string[]>; // content type -> preferred tools
  aiResolutionModel?: string;
}

export interface MergeQualityScore {
  coherenceScore: number;          // Logical coherence of merged content (0-1)
  completenessScore: number;       // Information completeness (0-1)
  accuracyScore: number;           // Estimated accuracy (0-1)
  consistencyScore: number;        // Internal consistency (0-1)
  structuralIntegrity: number;     // Structure preservation (0-1)
  overallQuality: number;          // Combined quality score (0-1)
}

export interface MergeConflict {
  type: ConflictType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  location: ConflictLocation;
  conflictingValues: ConflictingValue[];
  resolution: ConflictResolution;
  impact: string;
}

export type ConflictType = 
  | 'content_mismatch'       // Different content extracted
  | 'structure_conflict'     // Different structural interpretation
  | 'format_inconsistency'   // Formatting differences
  | 'boundary_disagreement'  // Zone boundary conflicts
  | 'metadata_conflict'      // Metadata inconsistencies
  | 'confidence_disparity';  // Large confidence differences

export interface ConflictLocation {
  startOffset?: number;
  endOffset?: number;
  section?: string;
  element?: string;
  description: string;
}

export interface ConflictingValue {
  toolName: string;
  value: string;
  confidence: number;
  metadata?: Record<string, any>;
}

export interface ConflictResolution {
  method: string;
  selectedValue: string;
  selectedTool: string;
  confidence: number;
  reasoning: string;
}

export interface MergeValidationResult {
  isValid: boolean;
  validationMethod: ValidationMethod;
  validationScore: number;
  issues: ValidationIssue[];
  suggestions: string[];
  requiresManualReview: boolean;
}

export type ValidationMethod = 
  | 'automated'          // Fully automated validation
  | 'human_review'       // Requires human validation
  | 'hybrid'            // Combination of automated and human
  | 'ml_validation'     // Machine learning based validation
  | 'cross_validation'; // Cross-validation with other results

export interface ValidationIssue {
  type: 'coherence' | 'completeness' | 'accuracy' | 'consistency' | 'structure';
  severity: number;
  description: string;
  location?: string;
  suggestedFix?: string;
}

export interface MergeMetadata {
  mergeTimestamp: Date;
  processingTime: number;
  toolsUsed: string[];
  mergeComplexity: number;
  confidenceRange: [number, number];
  userOverrides: UserOverride[];
  qualityMetrics: QualityMetrics;
}

export interface UserOverride {
  location: string;
  originalValue: string;
  overrideValue: string;
  reason: string;
  timestamp: Date;
}

export interface QualityMetrics {
  informationPreservation: number;  // How much info was preserved (0-1)
  noiseReduction: number;          // How much noise was filtered (0-1)
  clarityImprovement: number;      // Content clarity improvement (0-1)
  structuralEnhancement: number;   // Structure quality improvement (0-1)
}

export interface ExtractionQualityMetrics {
  textQuality: number;             // Text extraction quality (0-1)
  structureQuality: number;        // Structure preservation (0-1)
  formattingQuality: number;       // Format preservation (0-1)
  completeness: number;            // Extraction completeness (0-1)
  accuracy: number;                // Estimated accuracy (0-1)
}

// Advanced content similarity and comparison
export interface ContentComparison {
  similarity: number;              // Overall similarity (0-1)
  textSimilarity: number;          // Text content similarity (0-1)
  structuralSimilarity: number;    // Structure similarity (0-1)
  semanticSimilarity: number;      // Meaning similarity (0-1)
  differences: ContentDifference[];
  alignments: ContentAlignment[];
}

export interface ContentDifference {
  type: 'addition' | 'deletion' | 'modification' | 'reordering';
  location: string;
  tool1Content: string;
  tool2Content: string;
  significance: number;
}

export interface ContentAlignment {
  tool1Offset: number;
  tool2Offset: number;
  length: number;
  confidence: number;
}

// Main result merger implementation
export class IntelligentResultMerger {
  private similarityCalculator: ContentSimilarityCalculator;
  private conflictResolver: ConflictResolver;
  private qualityAssessor: MergeQualityAssessor;
  private validator: MergeValidator;
  private mergeStrategies: Map<MergeAlgorithm, MergeStrategyImplementation>;

  constructor() {
    this.similarityCalculator = new ContentSimilarityCalculator();
    this.conflictResolver = new ConflictResolver();
    this.qualityAssessor = new MergeQualityAssessor();
    this.validator = new MergeValidator();
    this.mergeStrategies = this.initializeMergeStrategies();
  }

  async mergeResults(
    candidates: MergeCandidate[],
    zone: Zone,
    strategy: MergeStrategy
  ): Promise<MergedResult> {
    const startTime = performance.now();
    
    // Sort candidates by confidence
    const sortedCandidates = this.sortCandidatesByConfidence(candidates);
    
    // Analyze content similarities and differences
    const comparisons = await this.compareAllCandidates(sortedCandidates);
    
    // Detect conflicts
    const conflicts = await this.detectConflicts(sortedCandidates, comparisons);
    
    // Apply merge strategy
    const mergeImplementation = this.mergeStrategies.get(strategy.algorithm);
    if (!mergeImplementation) {
      throw new Error(`Unsupported merge algorithm: ${strategy.algorithm}`);
    }
    
    const mergedContent = await mergeImplementation.merge(
      sortedCandidates,
      comparisons,
      conflicts,
      strategy.parameters
    );
    
    // Resolve remaining conflicts
    const resolvedConflicts = await this.conflictResolver.resolveConflicts(
      conflicts,
      sortedCandidates,
      strategy.parameters.conflictResolution
    );
    
    // Assess merge quality
    const mergeQuality = await this.qualityAssessor.assessQuality(
      mergedContent,
      sortedCandidates,
      resolvedConflicts
    );
    
    // Validate merged result
    const validationResult = await this.validator.validate(
      mergedContent,
      mergeQuality,
      zone
    );
    
    // Calculate final confidence
    const finalConfidence = this.calculateMergedConfidence(
      sortedCandidates,
      mergeQuality,
      validationResult
    );
    
    const processingTime = performance.now() - startTime;
    
    return {
      content: mergedContent.content,
      confidence: finalConfidence,
      mergeStrategy: strategy,
      contributingSources: sortedCandidates,
      mergeQuality,
      conflicts: resolvedConflicts,
      validationResults: validationResult,
      metadata: {
        mergeTimestamp: new Date(),
        processingTime,
        toolsUsed: sortedCandidates.map(c => c.toolName),
        mergeComplexity: this.calculateMergeComplexity(conflicts, comparisons),
        confidenceRange: this.getConfidenceRange(sortedCandidates),
        userOverrides: [],
        qualityMetrics: mergedContent.qualityMetrics
      }
    };
  }

  private sortCandidatesByConfidence(candidates: MergeCandidate[]): MergeCandidate[] {
    return [...candidates].sort((a, b) => b.confidence.finalConfidence - a.confidence.finalConfidence);
  }

  private async compareAllCandidates(candidates: MergeCandidate[]): Promise<Map<string, ContentComparison>> {
    const comparisons = new Map<string, ContentComparison>();
    
    for (let i = 0; i < candidates.length; i++) {
      for (let j = i + 1; j < candidates.length; j++) {
        const key = `${candidates[i].toolName}_${candidates[j].toolName}`;
        const comparison = await this.similarityCalculator.compare(
          candidates[i].result,
          candidates[j].result
        );
        comparisons.set(key, comparison);
      }
    }
    
    return comparisons;
  }

  private async detectConflicts(
    candidates: MergeCandidate[],
    comparisons: Map<string, ContentComparison>
  ): Promise<MergeConflict[]> {
    const conflicts: MergeConflict[] = [];
    
    // Check each comparison for conflicts
    for (const [key, comparison] of comparisons) {
      const [tool1, tool2] = key.split('_');
      
      // Content mismatch conflicts
      if (comparison.textSimilarity < 0.7) {
        const conflictingCandidates = candidates.filter(
          c => c.toolName === tool1 || c.toolName === tool2
        );
        
        conflicts.push({
          type: 'content_mismatch',
          severity: comparison.textSimilarity < 0.5 ? 'high' : 'medium',
          location: {
            description: 'Overall content extraction'
          },
          conflictingValues: conflictingCandidates.map(c => ({
            toolName: c.toolName,
            value: c.result.content || '',
            confidence: c.confidence.finalConfidence
          })),
          resolution: {
            method: 'pending',
            selectedValue: '',
            selectedTool: '',
            confidence: 0,
            reasoning: 'Requires resolution'
          },
          impact: 'Different content interpretations may lead to information loss'
        });
      }
      
      // Structure conflicts
      if (comparison.structuralSimilarity < 0.8) {
        conflicts.push({
          type: 'structure_conflict',
          severity: 'medium',
          location: {
            description: 'Document structure interpretation'
          },
          conflictingValues: [],
          resolution: {
            method: 'pending',
            selectedValue: '',
            selectedTool: '',
            confidence: 0,
            reasoning: 'Structural differences detected'
          },
          impact: 'Different structural interpretations may affect content organization'
        });
      }
      
      // Confidence disparity
      const candidate1 = candidates.find(c => c.toolName === tool1);
      const candidate2 = candidates.find(c => c.toolName === tool2);
      
      if (candidate1 && candidate2) {
        const confidenceDiff = Math.abs(
          candidate1.confidence.finalConfidence - candidate2.confidence.finalConfidence
        );
        
        if (confidenceDiff > 0.3) {
          conflicts.push({
            type: 'confidence_disparity',
            severity: confidenceDiff > 0.5 ? 'high' : 'medium',
            location: {
              description: 'Confidence assessment'
            },
            conflictingValues: [
              {
                toolName: candidate1.toolName,
                value: candidate1.result.content || '',
                confidence: candidate1.confidence.finalConfidence
              },
              {
                toolName: candidate2.toolName,
                value: candidate2.result.content || '',
                confidence: candidate2.confidence.finalConfidence
              }
            ],
            resolution: {
              method: 'confidence_based',
              selectedValue: '',
              selectedTool: '',
              confidence: 0,
              reasoning: 'Large confidence difference between tools'
            },
            impact: 'Significant confidence disparity may indicate quality issues'
          });
        }
      }
    }
    
    // Analyze specific differences for more detailed conflicts
    for (const [key, comparison] of comparisons) {
      for (const difference of comparison.differences) {
        if (difference.significance > 0.3) {
          conflicts.push({
            type: 'content_mismatch',
            severity: difference.significance > 0.7 ? 'high' : 'medium',
            location: {
              description: `Content difference at ${difference.location}`
            },
            conflictingValues: [
              {
                toolName: key.split('_')[0],
                value: difference.tool1Content,
                confidence: 0.5 // Would be calculated based on actual confidence
              },
              {
                toolName: key.split('_')[1],
                value: difference.tool2Content,
                confidence: 0.5
              }
            ],
            resolution: {
              method: 'pending',
              selectedValue: '',
              selectedTool: '',
              confidence: 0,
              reasoning: 'Content difference requires resolution'
            },
            impact: `${difference.type} of content may affect completeness`
          });
        }
      }
    }
    
    return conflicts;
  }

  private calculateMergedConfidence(
    candidates: MergeCandidate[],
    quality: MergeQualityScore,
    validation: MergeValidationResult
  ): number {
    // Weighted average of candidate confidences
    const totalWeight = candidates.reduce((sum, c) => sum + c.contribution, 0);
    const weightedConfidence = candidates.reduce(
      (sum, c) => sum + c.confidence.finalConfidence * c.contribution,
      0
    ) / (totalWeight || 1);
    
    // Apply quality adjustment
    const qualityAdjustment = quality.overallQuality;
    
    // Apply validation adjustment
    const validationAdjustment = validation.isValid ? 1.0 : 0.8;
    
    // Calculate final confidence
    const finalConfidence = weightedConfidence * qualityAdjustment * validationAdjustment;
    
    return Math.max(0, Math.min(1, finalConfidence));
  }

  private calculateMergeComplexity(
    conflicts: MergeConflict[],
    comparisons: Map<string, ContentComparison>
  ): number {
    let complexity = 0.5; // Base complexity
    
    // Add complexity for conflicts
    const severeConflicts = conflicts.filter(c => c.severity === 'high' || c.severity === 'critical').length;
    const moderateConflicts = conflicts.filter(c => c.severity === 'medium').length;
    
    complexity += severeConflicts * 0.2 + moderateConflicts * 0.1;
    
    // Add complexity for low similarity
    let lowSimilarityCount = 0;
    for (const comparison of comparisons.values()) {
      if (comparison.similarity < 0.7) lowSimilarityCount++;
    }
    complexity += lowSimilarityCount * 0.1;
    
    return Math.min(1, complexity);
  }

  private getConfidenceRange(candidates: MergeCandidate[]): [number, number] {
    const confidences = candidates.map(c => c.confidence.finalConfidence);
    return [Math.min(...confidences), Math.max(...confidences)];
  }

  private initializeMergeStrategies(): Map<MergeAlgorithm, MergeStrategyImplementation> {
    const strategies = new Map<MergeAlgorithm, MergeStrategyImplementation>();
    
    strategies.set('highest_confidence', new HighestConfidenceStrategy());
    strategies.set('weighted_average', new WeightedAverageStrategy());
    strategies.set('consensus', new ConsensusStrategy());
    strategies.set('hybrid', new HybridStrategy());
    strategies.set('specialized', new SpecializedStrategy());
    strategies.set('ensemble', new EnsembleStrategy());
    strategies.set('ml_driven', new MLDrivenStrategy());
    
    return strategies;
  }

  // Public utility methods
  async selectBestStrategy(
    candidates: MergeCandidate[],
    zone: Zone
  ): Promise<MergeStrategy> {
    // Analyze candidates to determine best strategy
    const confidenceRange = this.getConfidenceRange(candidates);
    const confidenceSpread = confidenceRange[1] - confidenceRange[0];
    
    // High confidence spread suggests using highest confidence
    if (confidenceSpread > 0.4) {
      return {
        algorithm: 'highest_confidence',
        parameters: {
          minimumAgreement: 0.7,
          conflictResolution: {
            method: 'confidence_based',
            confidenceWeight: 0.8,
            votingThreshold: 0.6,
            specializedToolPriority: new Map()
          },
          preserveFormatting: true,
          combineMetadata: true,
          deduplicationThreshold: 0.9,
          structurePreservation: 'moderate'
        },
        confidenceThreshold: 0.7,
        qualityThreshold: 0.6
      };
    }
    
    // Similar confidences suggest consensus approach
    if (confidenceSpread < 0.2 && candidates.length > 2) {
      return {
        algorithm: 'consensus',
        parameters: {
          minimumAgreement: 0.6,
          conflictResolution: {
            method: 'majority_vote',
            confidenceWeight: 0.5,
            votingThreshold: 0.5,
            specializedToolPriority: new Map()
          },
          preserveFormatting: true,
          combineMetadata: true,
          deduplicationThreshold: 0.85,
          structurePreservation: 'strict'
        },
        confidenceThreshold: 0.6,
        qualityThreshold: 0.7
      };
    }
    
    // Default to hybrid approach
    return {
      algorithm: 'hybrid',
      parameters: {
        minimumAgreement: 0.65,
        conflictResolution: {
          method: 'confidence_based',
          confidenceWeight: 0.6,
          votingThreshold: 0.55,
          specializedToolPriority: this.getSpecializedToolPriorities()
        },
        preserveFormatting: true,
        combineMetadata: true,
        deduplicationThreshold: 0.87,
        structurePreservation: 'moderate'
      },
      confidenceThreshold: 0.65,
      qualityThreshold: 0.65
    };
  }

  private getSpecializedToolPriorities(): Map<string, string[]> {
    return new Map([
      ['table', ['camelot', 'tabula', 'pdfplumber']],
      ['text', ['unstructured', 'pdfplumber']],
      ['diagram', ['visual_analyzer']],
      ['mixed', ['unstructured', 'pdfplumber', 'visual_analyzer']]
    ]);
  }
}

// Strategy implementations
interface MergeStrategyImplementation {
  merge(
    candidates: MergeCandidate[],
    comparisons: Map<string, ContentComparison>,
    conflicts: MergeConflict[],
    parameters: MergeParameters
  ): Promise<MergedContent>;
}

interface MergedContent {
  content: string;
  metadata: Record<string, any>;
  qualityMetrics: QualityMetrics;
}

class HighestConfidenceStrategy implements MergeStrategyImplementation {
  async merge(
    candidates: MergeCandidate[],
    comparisons: Map<string, ContentComparison>,
    conflicts: MergeConflict[],
    parameters: MergeParameters
  ): Promise<MergedContent> {
    // Simply select the highest confidence result
    const bestCandidate = candidates[0]; // Already sorted by confidence
    
    return {
      content: bestCandidate.result.content || '',
      metadata: bestCandidate.result.metadata || {},
      qualityMetrics: {
        informationPreservation: 1.0,
        noiseReduction: 0.5,
        clarityImprovement: 0.5,
        structuralEnhancement: 0.5
      }
    };
  }
}

class WeightedAverageStrategy implements MergeStrategyImplementation {
  async merge(
    candidates: MergeCandidate[],
    comparisons: Map<string, ContentComparison>,
    conflicts: MergeConflict[],
    parameters: MergeParameters
  ): Promise<MergedContent> {
    // Weighted combination of all results
    const contentParts: Array<{ content: string; weight: number }> = [];
    
    for (const candidate of candidates) {
      if (candidate.result.content) {
        contentParts.push({
          content: candidate.result.content,
          weight: candidate.confidence.finalConfidence
        });
      }
    }
    
    // Merge content parts (simplified - in practice would be more sophisticated)
    const mergedContent = this.mergeContentParts(contentParts, parameters);
    
    return {
      content: mergedContent,
      metadata: this.mergeMetadata(candidates),
      qualityMetrics: {
        informationPreservation: 0.85,
        noiseReduction: 0.7,
        clarityImprovement: 0.6,
        structuralEnhancement: 0.65
      }
    };
  }

  private mergeContentParts(
    parts: Array<{ content: string; weight: number }>,
    parameters: MergeParameters
  ): string {
    // Simplified merging - in practice would use advanced NLP
    if (parts.length === 0) return '';
    if (parts.length === 1) return parts[0].content;
    
    // For now, concatenate with deduplication
    const contentLines = new Map<string, number>();
    
    for (const part of parts) {
      const lines = part.content.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed) {
          const currentWeight = contentLines.get(trimmed) || 0;
          contentLines.set(trimmed, currentWeight + part.weight);
        }
      }
    }
    
    // Sort by weight and reconstruct
    const sortedLines = Array.from(contentLines.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([line]) => line);
    
    return sortedLines.join('\n');
  }

  private mergeMetadata(candidates: MergeCandidate[]): Record<string, any> {
    const merged: Record<string, any> = {};
    
    for (const candidate of candidates) {
      if (candidate.result.metadata) {
        Object.assign(merged, candidate.result.metadata);
      }
    }
    
    return merged;
  }
}

class ConsensusStrategy implements MergeStrategyImplementation {
  async merge(
    candidates: MergeCandidate[],
    comparisons: Map<string, ContentComparison>,
    conflicts: MergeConflict[],
    parameters: MergeParameters
  ): Promise<MergedContent> {
    // Find consensus among tools
    const consensusContent = await this.findConsensus(candidates, comparisons, parameters);
    
    return {
      content: consensusContent,
      metadata: this.extractConsensusMetadata(candidates),
      qualityMetrics: {
        informationPreservation: 0.9,
        noiseReduction: 0.8,
        clarityImprovement: 0.7,
        structuralEnhancement: 0.75
      }
    };
  }

  private async findConsensus(
    candidates: MergeCandidate[],
    comparisons: Map<string, ContentComparison>,
    parameters: MergeParameters
  ): Promise<string> {
    // Group similar results
    const groups = this.groupSimilarResults(candidates, comparisons, parameters.minimumAgreement);
    
    // Find largest consensus group
    let largestGroup: MergeCandidate[] = [];
    for (const group of groups) {
      if (group.length > largestGroup.length) {
        largestGroup = group;
      }
    }
    
    // If no consensus, fall back to highest confidence
    if (largestGroup.length < 2) {
      return candidates[0].result.content || '';
    }
    
    // Merge consensus group
    return this.mergeConsensusGroup(largestGroup);
  }

  private groupSimilarResults(
    candidates: MergeCandidate[],
    comparisons: Map<string, ContentComparison>,
    threshold: number
  ): MergeCandidate[][] {
    const groups: MergeCandidate[][] = [];
    const assigned = new Set<string>();
    
    for (const candidate of candidates) {
      if (assigned.has(candidate.toolName)) continue;
      
      const group = [candidate];
      assigned.add(candidate.toolName);
      
      for (const other of candidates) {
        if (assigned.has(other.toolName)) continue;
        
        const key1 = `${candidate.toolName}_${other.toolName}`;
        const key2 = `${other.toolName}_${candidate.toolName}`;
        const comparison = comparisons.get(key1) || comparisons.get(key2);
        
        if (comparison && comparison.similarity >= threshold) {
          group.push(other);
          assigned.add(other.toolName);
        }
      }
      
      groups.push(group);
    }
    
    return groups;
  }

  private mergeConsensusGroup(group: MergeCandidate[]): string {
    // Simple implementation - in practice would be more sophisticated
    const contents = group.map(c => c.result.content || '').filter(c => c);
    if (contents.length === 0) return '';
    
    // Return content from highest confidence member of consensus group
    const bestInGroup = group.sort((a, b) => 
      b.confidence.finalConfidence - a.confidence.finalConfidence
    )[0];
    
    return bestInGroup.result.content || '';
  }

  private extractConsensusMetadata(candidates: MergeCandidate[]): Record<string, any> {
    // Extract metadata that appears in majority of candidates
    const metadataFrequency = new Map<string, Map<string, number>>();
    
    for (const candidate of candidates) {
      if (candidate.result.metadata) {
        for (const [key, value] of Object.entries(candidate.result.metadata)) {
          if (!metadataFrequency.has(key)) {
            metadataFrequency.set(key, new Map());
          }
          const valueStr = JSON.stringify(value);
          const freq = metadataFrequency.get(key)!.get(valueStr) || 0;
          metadataFrequency.get(key)!.set(valueStr, freq + 1);
        }
      }
    }
    
    // Select most frequent values
    const consensusMetadata: Record<string, any> = {};
    for (const [key, valueFreqs] of metadataFrequency) {
      let maxFreq = 0;
      let consensusValue = '';
      
      for (const [value, freq] of valueFreqs) {
        if (freq > maxFreq) {
          maxFreq = freq;
          consensusValue = value;
        }
      }
      
      if (maxFreq >= candidates.length / 2) {
        consensusMetadata[key] = JSON.parse(consensusValue);
      }
    }
    
    return consensusMetadata;
  }
}

class HybridStrategy implements MergeStrategyImplementation {
  private strategies: Map<MergeAlgorithm, MergeStrategyImplementation>;

  constructor() {
    this.strategies = new Map([
      ['highest_confidence', new HighestConfidenceStrategy()],
      ['weighted_average', new WeightedAverageStrategy()],
      ['consensus', new ConsensusStrategy()]
    ]);
  }

  async merge(
    candidates: MergeCandidate[],
    comparisons: Map<string, ContentComparison>,
    conflicts: MergeConflict[],
    parameters: MergeParameters
  ): Promise<MergedContent> {
    // Dynamically select best approach based on situation
    const algorithm = this.selectBestAlgorithm(candidates, comparisons, conflicts);
    const strategy = this.strategies.get(algorithm);
    
    if (!strategy) {
      throw new Error(`Strategy not found: ${algorithm}`);
    }
    
    const result = await strategy.merge(candidates, comparisons, conflicts, parameters);
    
    // Apply hybrid improvements
    result.content = await this.applyHybridEnhancements(result.content, candidates, conflicts);
    
    return result;
  }

  private selectBestAlgorithm(
    candidates: MergeCandidate[],
    comparisons: Map<string, ContentComparison>,
    conflicts: MergeConflict[]
  ): MergeAlgorithm {
    const avgSimilarity = this.calculateAverageSimilarity(comparisons);
    const severeConflicts = conflicts.filter(c => c.severity === 'high' || c.severity === 'critical').length;
    
    // High similarity and few conflicts: use consensus
    if (avgSimilarity > 0.8 && severeConflicts < 2) {
      return 'consensus';
    }
    
    // Low similarity or many conflicts: use highest confidence
    if (avgSimilarity < 0.6 || severeConflicts > 3) {
      return 'highest_confidence';
    }
    
    // Otherwise: weighted average
    return 'weighted_average';
  }

  private calculateAverageSimilarity(comparisons: Map<string, ContentComparison>): number {
    if (comparisons.size === 0) return 0.5;
    
    let totalSimilarity = 0;
    for (const comparison of comparisons.values()) {
      totalSimilarity += comparison.similarity;
    }
    
    return totalSimilarity / comparisons.size;
  }

  private async applyHybridEnhancements(
    content: string,
    candidates: MergeCandidate[],
    conflicts: MergeConflict[]
  ): Promise<string> {
    // Apply conflict resolutions
    let enhanced = content;
    
    for (const conflict of conflicts) {
      if (conflict.resolution.method !== 'pending' && conflict.resolution.selectedValue) {
        // Apply resolution (simplified)
        enhanced = enhanced.replace(
          conflict.conflictingValues[0].value,
          conflict.resolution.selectedValue
        );
      }
    }
    
    return enhanced;
  }
}

class SpecializedStrategy implements MergeStrategyImplementation {
  async merge(
    candidates: MergeCandidate[],
    comparisons: Map<string, ContentComparison>,
    conflicts: MergeConflict[],
    parameters: MergeParameters
  ): Promise<MergedContent> {
    // Use specialized tool based on content type
    const specializedCandidate = this.selectSpecializedTool(candidates, parameters);
    
    if (specializedCandidate) {
      return {
        content: specializedCandidate.result.content || '',
        metadata: specializedCandidate.result.metadata || {},
        qualityMetrics: {
          informationPreservation: 0.95,
          noiseReduction: 0.6,
          clarityImprovement: 0.7,
          structuralEnhancement: 0.8
        }
      };
    }
    
    // Fallback to highest confidence
    return new HighestConfidenceStrategy().merge(candidates, comparisons, conflicts, parameters);
  }

  private selectSpecializedTool(
    candidates: MergeCandidate[],
    parameters: MergeParameters
  ): MergeCandidate | null {
    // Get content type from first candidate (assuming all process same zone)
    const contentType = candidates[0].result.metadata?.contentType || 'mixed';
    
    const specializedTools = parameters.conflictResolution.specializedToolPriority.get(contentType);
    if (!specializedTools) return null;
    
    // Find first available specialized tool
    for (const toolName of specializedTools) {
      const candidate = candidates.find(c => c.toolName === toolName);
      if (candidate && candidate.confidence.finalConfidence > 0.6) {
        return candidate;
      }
    }
    
    return null;
  }
}

class EnsembleStrategy implements MergeStrategyImplementation {
  async merge(
    candidates: MergeCandidate[],
    comparisons: Map<string, ContentComparison>,
    conflicts: MergeConflict[],
    parameters: MergeParameters
  ): Promise<MergedContent> {
    // Advanced ensemble method combining multiple strategies
    const strategies = [
      { strategy: new HighestConfidenceStrategy(), weight: 0.3 },
      { strategy: new ConsensusStrategy(), weight: 0.4 },
      { strategy: new WeightedAverageStrategy(), weight: 0.3 }
    ];
    
    const results: Array<{ content: string; weight: number }> = [];
    
    for (const { strategy, weight } of strategies) {
      const result = await strategy.merge(candidates, comparisons, conflicts, parameters);
      results.push({ content: result.content, weight });
    }
    
    // Combine ensemble results
    const ensembleContent = this.combineEnsembleResults(results);
    
    return {
      content: ensembleContent,
      metadata: this.mergeAllMetadata(candidates),
      qualityMetrics: {
        informationPreservation: 0.92,
        noiseReduction: 0.85,
        clarityImprovement: 0.8,
        structuralEnhancement: 0.85
      }
    };
  }

  private combineEnsembleResults(results: Array<{ content: string; weight: number }>): string {
    // Simplified - in practice would use more sophisticated combination
    if (results.length === 0) return '';
    
    // For now, return the result with highest weight that has content
    const sorted = results
      .filter(r => r.content)
      .sort((a, b) => b.weight - a.weight);
    
    return sorted[0]?.content || '';
  }

  private mergeAllMetadata(candidates: MergeCandidate[]): Record<string, any> {
    const merged: Record<string, any> = {};
    
    for (const candidate of candidates) {
      if (candidate.result.metadata) {
        for (const [key, value] of Object.entries(candidate.result.metadata)) {
          if (!merged[key]) {
            merged[key] = value;
          }
        }
      }
    }
    
    return merged;
  }
}

class MLDrivenStrategy implements MergeStrategyImplementation {
  async merge(
    candidates: MergeCandidate[],
    comparisons: Map<string, ContentComparison>,
    conflicts: MergeConflict[],
    parameters: MergeParameters
  ): Promise<MergedContent> {
    // Placeholder for ML-based merging
    // In practice, would use trained model to determine optimal merge
    
    // For now, fall back to ensemble approach
    return new EnsembleStrategy().merge(candidates, comparisons, conflicts, parameters);
  }
}

// Supporting classes
class ContentSimilarityCalculator {
  async compare(result1: ProcessingResult, result2: ProcessingResult): Promise<ContentComparison> {
    const content1 = result1.content || '';
    const content2 = result2.content || '';
    
    const textSimilarity = this.calculateTextSimilarity(content1, content2);
    const structuralSimilarity = this.calculateStructuralSimilarity(result1, result2);
    const semanticSimilarity = this.calculateSemanticSimilarity(content1, content2);
    
    const differences = this.findDifferences(content1, content2);
    const alignments = this.findAlignments(content1, content2);
    
    const overallSimilarity = (
      textSimilarity * 0.4 +
      structuralSimilarity * 0.3 +
      semanticSimilarity * 0.3
    );
    
    return {
      similarity: overallSimilarity,
      textSimilarity,
      structuralSimilarity,
      semanticSimilarity,
      differences,
      alignments
    };
  }

  private calculateTextSimilarity(text1: string, text2: string): number {
    if (!text1 || !text2) return 0;
    
    // Simple Jaccard similarity for words
    const words1 = new Set(text1.toLowerCase().split(/\s+/));
    const words2 = new Set(text2.toLowerCase().split(/\s+/));
    
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    
    return union.size > 0 ? intersection.size / union.size : 0;
  }

  private calculateStructuralSimilarity(result1: ProcessingResult, result2: ProcessingResult): number {
    // Compare metadata structure
    const struct1 = result1.metadata?.structure || {};
    const struct2 = result2.metadata?.structure || {};
    
    const keys1 = Object.keys(struct1);
    const keys2 = Object.keys(struct2);
    
    if (keys1.length === 0 && keys2.length === 0) return 1;
    if (keys1.length === 0 || keys2.length === 0) return 0;
    
    const commonKeys = keys1.filter(k => keys2.includes(k));
    return commonKeys.length / Math.max(keys1.length, keys2.length);
  }

  private calculateSemanticSimilarity(text1: string, text2: string): number {
    // Simplified semantic similarity
    // In practice, would use embeddings or more sophisticated NLP
    return this.calculateTextSimilarity(text1, text2) * 0.8 + 0.2;
  }

  private findDifferences(text1: string, text2: string): ContentDifference[] {
    const differences: ContentDifference[] = [];
    
    // Simple line-based diff
    const lines1 = text1.split('\n');
    const lines2 = text2.split('\n');
    
    // Find additions
    for (let i = 0; i < lines2.length; i++) {
      if (!lines1.includes(lines2[i]) && lines2[i].trim()) {
        differences.push({
          type: 'addition',
          location: `line ${i + 1}`,
          tool1Content: '',
          tool2Content: lines2[i],
          significance: 0.5
        });
      }
    }
    
    // Find deletions
    for (let i = 0; i < lines1.length; i++) {
      if (!lines2.includes(lines1[i]) && lines1[i].trim()) {
        differences.push({
          type: 'deletion',
          location: `line ${i + 1}`,
          tool1Content: lines1[i],
          tool2Content: '',
          significance: 0.5
        });
      }
    }
    
    return differences;
  }

  private findAlignments(text1: string, text2: string): ContentAlignment[] {
    // Simplified alignment finding
    const alignments: ContentAlignment[] = [];
    
    const lines1 = text1.split('\n');
    const lines2 = text2.split('\n');
    
    for (let i = 0; i < Math.min(lines1.length, lines2.length); i++) {
      if (lines1[i] === lines2[i] && lines1[i].trim()) {
        alignments.push({
          tool1Offset: i,
          tool2Offset: i,
          length: lines1[i].length,
          confidence: 1.0
        });
      }
    }
    
    return alignments;
  }
}

class ConflictResolver {
  async resolveConflicts(
    conflicts: MergeConflict[],
    candidates: MergeCandidate[],
    strategy: ConflictResolutionStrategy
  ): Promise<MergeConflict[]> {
    const resolved: MergeConflict[] = [];
    
    for (const conflict of conflicts) {
      const resolution = await this.resolveConflict(conflict, candidates, strategy);
      resolved.push({
        ...conflict,
        resolution
      });
    }
    
    return resolved;
  }

  private async resolveConflict(
    conflict: MergeConflict,
    candidates: MergeCandidate[],
    strategy: ConflictResolutionStrategy
  ): Promise<ConflictResolution> {
    switch (strategy.method) {
      case 'confidence_based':
        return this.resolveByConfidence(conflict, strategy.confidenceWeight);
      
      case 'majority_vote':
        return this.resolveByMajority(conflict, candidates, strategy.votingThreshold);
      
      case 'specialized_tool':
        return this.resolveBySpecializedTool(conflict, candidates, strategy.specializedToolPriority);
      
      case 'manual_review':
        return this.flagForManualReview(conflict);
      
      case 'ai_resolution':
        return this.resolveWithAI(conflict, strategy.aiResolutionModel);
      
      default:
        return this.defaultResolution(conflict);
    }
  }

  private resolveByConfidence(conflict: MergeConflict, confidenceWeight: number): ConflictResolution {
    const highestConfidence = conflict.conflictingValues.reduce((max, current) => 
      current.confidence > max.confidence ? current : max
    );
    
    return {
      method: 'confidence_based',
      selectedValue: highestConfidence.value,
      selectedTool: highestConfidence.toolName,
      confidence: highestConfidence.confidence * confidenceWeight,
      reasoning: `Selected ${highestConfidence.toolName} with highest confidence: ${highestConfidence.confidence.toFixed(2)}`
    };
  }

  private resolveByMajority(
    conflict: MergeConflict,
    candidates: MergeCandidate[],
    threshold: number
  ): ConflictResolution {
    // Count occurrences of each value
    const valueCounts = new Map<string, number>();
    
    for (const value of conflict.conflictingValues) {
      const count = valueCounts.get(value.value) || 0;
      valueCounts.set(value.value, count + 1);
    }
    
    // Find majority value
    let majorityValue = '';
    let maxCount = 0;
    
    for (const [value, count] of valueCounts) {
      if (count > maxCount) {
        maxCount = count;
        majorityValue = value;
      }
    }
    
    const majorityRatio = maxCount / conflict.conflictingValues.length;
    
    if (majorityRatio >= threshold) {
      const selectedTool = conflict.conflictingValues.find(v => v.value === majorityValue)?.toolName || '';
      
      return {
        method: 'majority_vote',
        selectedValue: majorityValue,
        selectedTool,
        confidence: majorityRatio,
        reasoning: `${maxCount} out of ${conflict.conflictingValues.length} tools agree on this value`
      };
    }
    
    // No clear majority, fall back to confidence
    return this.resolveByConfidence(conflict, 1.0);
  }

  private resolveBySpecializedTool(
    conflict: MergeConflict,
    candidates: MergeCandidate[],
    priorities: Map<string, string[]>
  ): ConflictResolution {
    // Simplified - would need content type information
    const contentType = 'mixed'; // Would be determined from context
    const preferredTools = priorities.get(contentType) || [];
    
    for (const toolName of preferredTools) {
      const value = conflict.conflictingValues.find(v => v.toolName === toolName);
      if (value) {
        return {
          method: 'specialized_tool',
          selectedValue: value.value,
          selectedTool: value.toolName,
          confidence: value.confidence,
          reasoning: `Selected specialized tool ${value.toolName} for ${contentType} content`
        };
      }
    }
    
    return this.defaultResolution(conflict);
  }

  private flagForManualReview(conflict: MergeConflict): ConflictResolution {
    return {
      method: 'manual_review',
      selectedValue: '[REQUIRES MANUAL REVIEW]',
      selectedTool: 'none',
      confidence: 0,
      reasoning: 'Conflict flagged for manual review due to complexity or criticality'
    };
  }

  private async resolveWithAI(conflict: MergeConflict, model?: string): Promise<ConflictResolution> {
    // Placeholder for AI resolution
    return {
      method: 'ai_resolution',
      selectedValue: conflict.conflictingValues[0].value,
      selectedTool: conflict.conflictingValues[0].toolName,
      confidence: 0.8,
      reasoning: 'AI model selected based on content analysis (placeholder)'
    };
  }

  private defaultResolution(conflict: MergeConflict): ConflictResolution {
    return this.resolveByConfidence(conflict, 0.8);
  }
}

class MergeQualityAssessor {
  async assessQuality(
    mergedContent: MergedContent,
    candidates: MergeCandidate[],
    conflicts: MergeConflict[]
  ): Promise<MergeQualityScore> {
    const coherenceScore = this.assessCoherence(mergedContent.content);
    const completenessScore = this.assessCompleteness(mergedContent.content, candidates);
    const accuracyScore = this.estimateAccuracy(mergedContent, candidates, conflicts);
    const consistencyScore = this.assessConsistency(mergedContent.content);
    const structuralIntegrity = this.assessStructure(mergedContent);
    
    const overallQuality = (
      coherenceScore * 0.2 +
      completenessScore * 0.25 +
      accuracyScore * 0.25 +
      consistencyScore * 0.15 +
      structuralIntegrity * 0.15
    );
    
    return {
      coherenceScore,
      completenessScore,
      accuracyScore,
      consistencyScore,
      structuralIntegrity,
      overallQuality
    };
  }

  private assessCoherence(content: string): number {
    // Simple coherence check
    if (!content) return 0;
    
    const sentences = content.split(/[.!?]+/).filter(s => s.trim());
    if (sentences.length < 2) return 0.8;
    
    // Check for reasonable sentence length distribution
    const avgLength = sentences.reduce((sum, s) => sum + s.length, 0) / sentences.length;
    const reasonableLength = avgLength > 10 && avgLength < 200;
    
    return reasonableLength ? 0.85 : 0.65;
  }

  private assessCompleteness(content: string, candidates: MergeCandidate[]): number {
    if (!content) return 0;
    
    // Check how much content from each candidate is preserved
    let totalPreserved = 0;
    let totalOriginal = 0;
    
    for (const candidate of candidates) {
      const originalContent = candidate.result.content || '';
      const originalWords = new Set(originalContent.toLowerCase().split(/\s+/));
      const mergedWords = new Set(content.toLowerCase().split(/\s+/));
      
      const preserved = [...originalWords].filter(w => mergedWords.has(w)).length;
      totalPreserved += preserved;
      totalOriginal += originalWords.size;
    }
    
    return totalOriginal > 0 ? totalPreserved / totalOriginal : 0.5;
  }

  private estimateAccuracy(
    mergedContent: MergedContent,
    candidates: MergeCandidate[],
    conflicts: MergeConflict[]
  ): number {
    // Base accuracy on candidate confidences
    const avgConfidence = candidates.reduce(
      (sum, c) => sum + c.confidence.finalConfidence,
      0
    ) / candidates.length;
    
    // Reduce for unresolved conflicts
    const unresolvedConflicts = conflicts.filter(
      c => c.resolution.method === 'pending' || c.resolution.confidence < 0.5
    );
    const conflictPenalty = unresolvedConflicts.length * 0.05;
    
    return Math.max(0.5, avgConfidence - conflictPenalty);
  }

  private assessConsistency(content: string): number {
    if (!content) return 0;
    
    // Simple consistency checks
    const lines = content.split('\n');
    
    // Check for consistent formatting
    const indentations = lines
      .filter(l => l.trim())
      .map(l => l.match(/^\s*/)?.[0].length || 0);
    
    const uniqueIndents = new Set(indentations).size;
    const consistentIndentation = uniqueIndents <= 3; // Allow up to 3 indent levels
    
    return consistentIndentation ? 0.9 : 0.7;
  }

  private assessStructure(mergedContent: MergedContent): number {
    // Check structural metadata preservation
    const hasMetadata = Object.keys(mergedContent.metadata).length > 0;
    const hasQualityMetrics = mergedContent.qualityMetrics.informationPreservation > 0;
    
    let score = 0.7; // Base score
    if (hasMetadata) score += 0.15;
    if (hasQualityMetrics) score += 0.15;
    
    return Math.min(1, score);
  }
}

class MergeValidator {
  async validate(
    mergedContent: MergedContent,
    quality: MergeQualityScore,
    zone: Zone
  ): Promise<MergeValidationResult> {
    const issues: ValidationIssue[] = [];
    
    // Check coherence
    if (quality.coherenceScore < 0.6) {
      issues.push({
        type: 'coherence',
        severity: 0.7,
        description: 'Merged content lacks coherence',
        suggestedFix: 'Review merge strategy or use manual review'
      });
    }
    
    // Check completeness
    if (quality.completenessScore < 0.7) {
      issues.push({
        type: 'completeness',
        severity: 0.6,
        description: 'Significant content may be missing',
        suggestedFix: 'Consider using consensus or ensemble strategy'
      });
    }
    
    // Check accuracy
    if (quality.accuracyScore < 0.65) {
      issues.push({
        type: 'accuracy',
        severity: 0.8,
        description: 'Low confidence in merge accuracy',
        suggestedFix: 'Manual verification recommended'
      });
    }
    
    const isValid = issues.length === 0 || issues.every(i => i.severity < 0.7);
    const requiresManualReview = issues.some(i => i.severity >= 0.8);
    
    return {
      isValid,
      validationMethod: requiresManualReview ? 'human_review' : 'automated',
      validationScore: quality.overallQuality,
      issues,
      suggestions: this.generateSuggestions(issues, quality),
      requiresManualReview
    };
  }

  private generateSuggestions(issues: ValidationIssue[], quality: MergeQualityScore): string[] {
    const suggestions: string[] = [];
    
    if (quality.coherenceScore < 0.7) {
      suggestions.push('Consider using a single high-confidence tool instead of merging');
    }
    
    if (quality.completenessScore < 0.8) {
      suggestions.push('Try consensus strategy to preserve more content');
    }
    
    if (quality.accuracyScore < 0.7) {
      suggestions.push('Use specialized tools for this content type');
    }
    
    if (issues.length > 3) {
      suggestions.push('Complex merge - consider manual review or simpler strategy');
    }
    
    return suggestions;
  }
}

// Export singleton instance
export const resultMerger = new IntelligentResultMerger();