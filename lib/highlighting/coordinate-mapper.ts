import type { Zone } from '@pdf-platform/shared';

export interface ContentLocation {
  elementId: string;
  offset: number;
  length: number;
  lineNumber?: number;
}

export interface ZoneLocation {
  zoneId: string;
  page: number;
  coordinates: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  transform?: DOMMatrix;
}

export interface CoordinateMap {
  zoneToContent: Map<string, ContentLocation>;
  contentToZone: Map<string, ZoneLocation>;
}

export interface ContentElement {
  id: string;
  zoneId: string;
  textOffset: number;
  textLength: number;
  lineNumber?: number;
}

export class CoordinateMapper {
  private map: CoordinateMap = {
    zoneToContent: new Map(),
    contentToZone: new Map()
  };
  
  private pdfViewer: any; // PDF.js viewer instance
  
  constructor(pdfViewer?: any) {
    this.pdfViewer = pdfViewer;
  }
  
  buildMapping(zones: Zone[], contentElements: ContentElement[]) {
    // Clear existing mappings
    this.map.zoneToContent.clear();
    this.map.contentToZone.clear();
    
    // Build zone to content mapping
    zones.forEach(zone => {
      const contentEl = contentElements.find(el => el.zoneId === zone.id);
      if (contentEl) {
        this.map.zoneToContent.set(zone.id, {
          elementId: contentEl.id,
          offset: contentEl.textOffset,
          length: contentEl.textLength,
          lineNumber: contentEl.lineNumber
        });
        
        this.map.contentToZone.set(contentEl.id, {
          zoneId: zone.id,
          page: zone.page || 1,
          coordinates: zone.coordinates,
          transform: this.getZoneTransform(zone)
        });
      }
    });
  }
  
  getContentLocation(zoneId: string): ContentLocation | undefined {
    return this.map.zoneToContent.get(zoneId);
  }
  
  getZoneLocation(contentId: string): ZoneLocation | undefined {
    return this.map.contentToZone.get(contentId);
  }
  
  private getZoneTransform(zone: Zone): DOMMatrix {
    // Account for PDF scaling and viewport transformation
    const scale = this.pdfViewer?.currentScale || 1;
    const page = zone.page || 1;
    const viewport = this.pdfViewer?.getPageView?.(page - 1);
    
    const matrix = new DOMMatrix();
    matrix.scaleSelf(scale, scale);
    
    if (viewport) {
      matrix.translateSelf(viewport.x || 0, viewport.y || 0);
    }
    
    return matrix;
  }
  
  // Map a point from PDF coordinates to content coordinates
  mapPdfToContent(pdfX: number, pdfY: number, page: number): { x: number; y: number } | null {
    // Find zones on this page
    const zonesOnPage = Array.from(this.map.contentToZone.values())
      .filter(loc => loc.page === page);
    
    // Find which zone contains this point
    for (const zoneLocation of zonesOnPage) {
      const { coordinates } = zoneLocation;
      if (pdfX >= coordinates.x && 
          pdfX <= coordinates.x + coordinates.width &&
          pdfY >= coordinates.y && 
          pdfY <= coordinates.y + coordinates.height) {
        
        // Found the zone, now map to content
        const contentLoc = this.map.zoneToContent.get(zoneLocation.zoneId);
        if (contentLoc) {
          // Calculate relative position within zone
          const relX = (pdfX - coordinates.x) / coordinates.width;
          const relY = (pdfY - coordinates.y) / coordinates.height;
          
          // Map to content coordinates (simplified)
          return {
            x: relX * 100, // Percentage
            y: relY * 100
          };
        }
      }
    }
    
    return null;
  }
  
  // Map a point from content coordinates to PDF coordinates
  mapContentToPdf(contentId: string, relX: number, relY: number): { x: number; y: number; page: number } | null {
    const zoneLocation = this.map.contentToZone.get(contentId);
    if (!zoneLocation) return null;
    
    const { coordinates, page } = zoneLocation;
    
    // Map relative content position to PDF coordinates
    const pdfX = coordinates.x + (relX / 100) * coordinates.width;
    const pdfY = coordinates.y + (relY / 100) * coordinates.height;
    
    return { x: pdfX, y: pdfY, page };
  }
}