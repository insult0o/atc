// Task 2: Zone Completeness Checker
// Validates zone processing status and completeness

import { Zone, ZoneType, ZoneStatus } from '../../types/zone';
import { PDFDocument } from '../../types/pdf';

export interface ZoneCompletenessCheck {
  minimumProcessedPercentage: number;  // Default: 95%
  allowedFailureTypes: string[];       // Acceptable failure reasons
  requiredZoneTypes: string[];         // Must have these zone types
  coverageCalculation: 'area' | 'count' | 'weighted';
  weightingFactors: {
    text: number;
    table: number;
    diagram: number;
  };
}

export interface ZoneValidationResult {
  valid: boolean;
  completenessScore: number;
  processedPercentage: number;
  missingZoneTypes: string[];
  failedZones: ZoneFailure[];
  coverageMap: ZoneCoverageMap;
  recommendations: string[];
}

export interface ZoneFailure {
  zoneId: string;
  zoneType: ZoneType;
  reason: string;
  impact: 'high' | 'medium' | 'low';
  recoverable: boolean;
}

export interface ZoneCoverageMap {
  totalArea: number;
  coveredArea: number;
  uncoveredRegions: Array<{
    page: number;
    bounds: { x: number; y: number; width: number; height: number };
    reason: string;
  }>;
}

export interface ZoneCompletenessDetails {
  totalZones: number;
  processedZones: number;
  failedZones: number;
  pendingZones: number;
  coveragePercentage: number;
  zoneTypeDistribution: Map<ZoneType, number>;
  processingDuration: number;
  qualityScore: number;
}

export class ZoneValidator {
  private config: ZoneCompletenessCheck;

  constructor(config?: Partial<ZoneCompletenessCheck>) {
    this.config = {
      minimumProcessedPercentage: 95,
      allowedFailureTypes: ['ocr_confidence_low', 'boundary_unclear'],
      requiredZoneTypes: ['text', 'table'],
      coverageCalculation: 'weighted',
      weightingFactors: {
        text: 1.0,
        table: 1.5,
        diagram: 1.2
      },
      ...config
    };
  }

  /**
   * Validate zone completeness for a document
   */
  public async validate(
    document: PDFDocument,
    zones: Zone[]
  ): Promise<ZoneValidationResult> {
    const processedZones = zones.filter(z => 
      z.status === 'confirmed' || z.status === 'processed'
    );
    
    const failedZones = zones.filter(z => 
      z.status === 'failed' || z.status === 'error'
    );

    // Calculate processed percentage
    const processedPercentage = this.calculateProcessedPercentage(
      zones, 
      processedZones,
      failedZones
    );

    // Check required zone types
    const missingZoneTypes = this.checkRequiredZoneTypes(zones);

    // Calculate coverage
    const coverageMap = this.calculateCoverage(document, zones);

    // Determine failures
    const zoneFailures = this.analyzeFailures(failedZones);

    // Calculate completeness score
    const completenessScore = this.calculateCompletenessScore(
      processedPercentage,
      missingZoneTypes.length,
      zoneFailures.length,
      coverageMap
    );

    // Generate recommendations
    const recommendations = this.generateRecommendations(
      processedPercentage,
      missingZoneTypes,
      zoneFailures,
      coverageMap
    );

    return {
      valid: this.isValid(processedPercentage, missingZoneTypes, zoneFailures),
      completenessScore,
      processedPercentage,
      missingZoneTypes,
      failedZones: zoneFailures,
      coverageMap,
      recommendations
    };
  }

  /**
   * Calculate percentage of successfully processed zones
   */
  private calculateProcessedPercentage(
    allZones: Zone[],
    processedZones: Zone[],
    failedZones: Zone[]
  ): number {
    if (allZones.length === 0) return 0;

    switch (this.config.coverageCalculation) {
      case 'count':
        return (processedZones.length / allZones.length) * 100;
      
      case 'area':
        return this.calculateAreaBasedPercentage(allZones, processedZones);
      
      case 'weighted':
        return this.calculateWeightedPercentage(allZones, processedZones);
      
      default:
        return (processedZones.length / allZones.length) * 100;
    }
  }

  /**
   * Calculate area-based processing percentage
   */
  private calculateAreaBasedPercentage(
    allZones: Zone[],
    processedZones: Zone[]
  ): number {
    const totalArea = allZones.reduce((sum, zone) => 
      sum + (zone.bounds.width * zone.bounds.height), 0
    );
    
    const processedArea = processedZones.reduce((sum, zone) => 
      sum + (zone.bounds.width * zone.bounds.height), 0
    );

    return totalArea > 0 ? (processedArea / totalArea) * 100 : 0;
  }

  /**
   * Calculate weighted processing percentage
   */
  private calculateWeightedPercentage(
    allZones: Zone[],
    processedZones: Zone[]
  ): number {
    const calculateWeight = (zone: Zone): number => {
      const weight = this.config.weightingFactors[zone.type] || 1.0;
      const area = zone.bounds.width * zone.bounds.height;
      return area * weight;
    };

    const totalWeight = allZones.reduce((sum, zone) => 
      sum + calculateWeight(zone), 0
    );
    
    const processedWeight = processedZones.reduce((sum, zone) => 
      sum + calculateWeight(zone), 0
    );

    return totalWeight > 0 ? (processedWeight / totalWeight) * 100 : 0;
  }

  /**
   * Check if all required zone types are present
   */
  private checkRequiredZoneTypes(zones: Zone[]): string[] {
    const presentTypes = new Set(zones.map(z => z.type));
    return this.config.requiredZoneTypes.filter(type => 
      !presentTypes.has(type as ZoneType)
    );
  }

  /**
   * Calculate zone coverage map
   */
  private calculateCoverage(
    document: PDFDocument,
    zones: Zone[]
  ): ZoneCoverageMap {
    const pageAreas = new Map<number, number>();
    const coveredAreas = new Map<number, number>();
    const uncoveredRegions: ZoneCoverageMap['uncoveredRegions'] = [];

    // Calculate total area per page
    document.pages.forEach((page, index) => {
      const area = page.width * page.height;
      pageAreas.set(index, area);
      coveredAreas.set(index, 0);
    });

    // Calculate covered areas
    zones.forEach(zone => {
      if (zone.status === 'confirmed' || zone.status === 'processed') {
        const area = zone.bounds.width * zone.bounds.height;
        const currentCovered = coveredAreas.get(zone.pageNumber) || 0;
        coveredAreas.set(zone.pageNumber, currentCovered + area);
      }
    });

    // Find uncovered regions
    document.pages.forEach((page, pageIndex) => {
      const pageCoverage = (coveredAreas.get(pageIndex) || 0) / 
                          (pageAreas.get(pageIndex) || 1);
      
      if (pageCoverage < 0.95) {
        // Simplified uncovered region detection
        uncoveredRegions.push({
          page: pageIndex,
          bounds: {
            x: 0,
            y: 0,
            width: page.width,
            height: page.height * (1 - pageCoverage)
          },
          reason: 'insufficient_zone_coverage'
        });
      }
    });

    const totalArea = Array.from(pageAreas.values()).reduce((a, b) => a + b, 0);
    const coveredArea = Array.from(coveredAreas.values()).reduce((a, b) => a + b, 0);

    return {
      totalArea,
      coveredArea,
      uncoveredRegions
    };
  }

  /**
   * Analyze zone failures
   */
  private analyzeFailures(failedZones: Zone[]): ZoneFailure[] {
    return failedZones.map(zone => {
      const isAllowedFailure = this.config.allowedFailureTypes.includes(
        zone.errorDetails?.type || 'unknown'
      );

      return {
        zoneId: zone.id,
        zoneType: zone.type,
        reason: zone.errorDetails?.message || 'Unknown failure',
        impact: this.determineFailureImpact(zone),
        recoverable: isAllowedFailure
      };
    });
  }

  /**
   * Determine the impact of a zone failure
   */
  private determineFailureImpact(zone: Zone): 'high' | 'medium' | 'low' {
    // High impact for critical zone types
    if (zone.type === 'table' || zone.type === 'diagram') {
      return 'high';
    }
    
    // High impact for large zones
    const area = zone.bounds.width * zone.bounds.height;
    if (area > 10000) {
      return 'high';
    }
    
    // Medium impact for required zone types
    if (this.config.requiredZoneTypes.includes(zone.type)) {
      return 'medium';
    }
    
    return 'low';
  }

  /**
   * Calculate overall completeness score
   */
  private calculateCompletenessScore(
    processedPercentage: number,
    missingTypesCount: number,
    failureCount: number,
    coverageMap: ZoneCoverageMap
  ): number {
    let score = processedPercentage;

    // Deduct for missing required types
    score -= missingTypesCount * 10;

    // Deduct for failures
    score -= failureCount * 2;

    // Consider coverage
    const coveragePercentage = (coverageMap.coveredArea / coverageMap.totalArea) * 100;
    score = (score + coveragePercentage) / 2;

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Generate recommendations for improving completeness
   */
  private generateRecommendations(
    processedPercentage: number,
    missingZoneTypes: string[],
    zoneFailures: ZoneFailure[],
    coverageMap: ZoneCoverageMap
  ): string[] {
    const recommendations: string[] = [];

    if (processedPercentage < this.config.minimumProcessedPercentage) {
      recommendations.push(
        `Process additional zones to reach ${this.config.minimumProcessedPercentage}% threshold`
      );
    }

    if (missingZoneTypes.length > 0) {
      recommendations.push(
        `Add missing zone types: ${missingZoneTypes.join(', ')}`
      );
    }

    const highImpactFailures = zoneFailures.filter(f => f.impact === 'high');
    if (highImpactFailures.length > 0) {
      recommendations.push(
        `Address ${highImpactFailures.length} high-impact zone failures`
      );
    }

    if (coverageMap.uncoveredRegions.length > 0) {
      recommendations.push(
        `Review ${coverageMap.uncoveredRegions.length} uncovered regions`
      );
    }

    return recommendations;
  }

  /**
   * Determine if validation passes
   */
  private isValid(
    processedPercentage: number,
    missingZoneTypes: string[],
    zoneFailures: ZoneFailure[]
  ): boolean {
    // Check minimum processing threshold
    if (processedPercentage < this.config.minimumProcessedPercentage) {
      return false;
    }

    // Check required zone types
    if (missingZoneTypes.length > 0) {
      return false;
    }

    // Check for unrecoverable failures
    const unrecoverableFailures = zoneFailures.filter(f => !f.recoverable);
    if (unrecoverableFailures.length > 0) {
      return false;
    }

    return true;
  }

  /**
   * Get detailed zone completeness information
   */
  public getDetails(zones: Zone[]): ZoneCompletenessDetails {
    const startTime = Date.now();
    
    const statusCounts = zones.reduce((acc, zone) => {
      acc[zone.status] = (acc[zone.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const typeDistribution = new Map<ZoneType, number>();
    zones.forEach(zone => {
      typeDistribution.set(zone.type, (typeDistribution.get(zone.type) || 0) + 1);
    });

    const processedZones = zones.filter(z => 
      z.status === 'confirmed' || z.status === 'processed'
    );

    const qualityScore = this.calculateQualityScore(zones);

    return {
      totalZones: zones.length,
      processedZones: statusCounts['confirmed'] + statusCounts['processed'] || 0,
      failedZones: statusCounts['failed'] + statusCounts['error'] || 0,
      pendingZones: statusCounts['pending'] || 0,
      coveragePercentage: (processedZones.length / zones.length) * 100,
      zoneTypeDistribution: typeDistribution,
      processingDuration: Date.now() - startTime,
      qualityScore
    };
  }

  /**
   * Calculate quality score based on zone confidence
   */
  private calculateQualityScore(zones: Zone[]): number {
    const processedZones = zones.filter(z => 
      z.status === 'confirmed' || z.status === 'processed'
    );

    if (processedZones.length === 0) return 0;

    const avgConfidence = processedZones.reduce((sum, zone) => 
      sum + (zone.confidence || 0), 0
    ) / processedZones.length;

    return avgConfidence * 100;
  }
}

// Export singleton instance
export const zoneValidator = new ZoneValidator();