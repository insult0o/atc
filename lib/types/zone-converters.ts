// Zone type conversion utilities
import { Zone as StandardZone, ZoneType, ZoneStatus } from './zone';
import { Zone as ComponentZone } from '../../app/components/zones/ZoneManager';

/**
 * Convert from component Zone format to standard Zone format
 */
export function componentZoneToStandard(componentZone: ComponentZone): StandardZone {
  return {
    id: componentZone.id,
    pageNumber: componentZone.pageNumber,
    bounds: componentZone.coordinates, // Use coordinates as bounds
    type: mapComponentTypeToStandard(componentZone.contentType),
    confidence: componentZone.confidence,
    status: mapComponentStatusToStandard(componentZone.status),
    characteristics: componentZone.characteristics,
    assignedTool: componentZone.assignedTool,
    fallbackTools: componentZone.fallbackTools,
    textContent: componentZone.textContent,
    processingResults: componentZone.processingResults,
    userModified: componentZone.userModified,
    lastModified: componentZone.lastModified
  };
}

/**
 * Convert from standard Zone format to component Zone format
 */
export function standardZoneToComponent(standardZone: StandardZone): ComponentZone {
  return {
    id: standardZone.id,
    coordinates: standardZone.bounds,
    bounds: standardZone.bounds, // Duplicate for compatibility
    contentType: mapStandardTypeToComponent(standardZone.type),
    confidence: standardZone.confidence || 0.8,
    characteristics: standardZone.characteristics || getDefaultCharacteristics(),
    assignedTool: standardZone.assignedTool,
    fallbackTools: standardZone.fallbackTools || [],
    status: mapStandardStatusToComponent(standardZone.status),
    pageNumber: standardZone.pageNumber,
    textContent: standardZone.textContent,
    processingResults: standardZone.processingResults,
    userModified: standardZone.userModified,
    lastModified: standardZone.lastModified
  };
}

/**
 * Convert array of zones from component to standard format
 */
export function convertZonesToStandard(componentZones: ComponentZone[]): StandardZone[] {
  return componentZones.map(componentZoneToStandard);
}

/**
 * Convert array of zones from standard to component format
 */
export function convertZonesToComponent(standardZones: StandardZone[]): ComponentZone[] {
  return standardZones.map(standardZoneToComponent);
}

/**
 * Map component contentType values to standard type values
 */
function mapComponentTypeToStandard(componentType: ComponentZone['contentType']): ZoneType {
  const typeMap: Record<ComponentZone['contentType'], ZoneType> = {
    'text': 'text',
    'table': 'table',
    'diagram': 'diagram',
    'mixed': 'mixed',
    'header': 'header',
    'footer': 'footer'
  };
  
  return typeMap[componentType] || 'text';
}

/**
 * Map component status values to standard status values
 */
function mapComponentStatusToStandard(componentStatus: ComponentZone['status']): ZoneStatus {
  const statusMap: Record<ComponentZone['status'], ZoneStatus> = {
    'detected': 'detected',
    'confirmed': 'confirmed', 
    'processing': 'processing',
    'completed': 'completed',
    'failed': 'failed'
  };
  
  return statusMap[componentStatus] || 'detected';
}

/**
 * Map standard type values to component contentType values
 */
function mapStandardTypeToComponent(standardType: ZoneType): ComponentZone['contentType'] {
  const typeMap: Record<ZoneType, ComponentZone['contentType']> = {
    'text': 'text',
    'table': 'table',
    'diagram': 'diagram',
    'image': 'diagram', // Map image to diagram for component compatibility
    'mixed': 'mixed',
    'header': 'header',
    'footer': 'footer'
  };
  
  return typeMap[standardType] || 'text';
}

/**
 * Map standard status values to component status values
 */
function mapStandardStatusToComponent(standardStatus: ZoneStatus): ComponentZone['status'] {
  const statusMap: Record<ZoneStatus, ComponentZone['status']> = {
    'detected': 'detected',
    'confirmed': 'confirmed',
    'processing': 'processing', 
    'processed': 'completed',
    'completed': 'completed',
    'failed': 'failed',
    'error': 'failed',
    'pending': 'detected'
  };
  
  return statusMap[standardStatus] || 'detected';
}

/**
 * Get default characteristics for zones that don't have them
 */
function getDefaultCharacteristics() {
  return {
    textDensity: 0.5,
    lineSpacing: 12,
    wordSpacing: 4,
    fontSizes: [12],
    hasStructure: false,
    hasImages: false,
    complexity: 'medium' as const,
    readingOrder: 1
  };
} 