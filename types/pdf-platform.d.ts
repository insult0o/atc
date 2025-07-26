declare module '@pdf-platform/shared' {
  export interface Zone {
    id: string;
    page?: number;
    coordinates: {
      x: number;
      y: number;
      width: number;
      height: number;
      rotation?: number;
    };
    type?: 'text' | 'table' | 'diagram' | 'image' | 'mixed' | 'header' | 'footer';
    confidence: number;
    status: 'detected' | 'confirmed' | 'processing' | 'completed' | 'failed';
    characteristics?: {
      textDensity: number;
      lineSpacing: number;
      wordSpacing: number;
      fontSizes: number[];
      hasStructure: boolean;
      hasImages: boolean;
      complexity: 'low' | 'medium' | 'high';
      readingOrder: number;
      language?: string;
    };
    assignedTool?: string;
    fallbackTools?: string[];
    textContent?: string;
    processingResults?: ProcessingResult[];
    userModified: boolean;
    lastModified: Date;
  }

  export interface CreateZoneRequest {
    page: number;
    coordinates: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
    type: string;
  }

  export interface ProcessingResult {
    toolName: string;
    content: string;
    confidence: number;
    processingTime: number;
    metadata: Record<string, any>;
  }
}