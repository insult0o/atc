// Zone type definitions

export type ZoneType = 'text' | 'table' | 'diagram' | 'image' | 'mixed' | 'header' | 'footer';
export type ZoneStatus = 'detected' | 'confirmed' | 'processing' | 'processed' | 'completed' | 'failed' | 'error' | 'pending';

export interface Zone {
  id: string;
  pageNumber: number;
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
    rotation?: number;
  };
  type: ZoneType;
  confidence?: number;
  status: ZoneStatus;
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
  errorDetails?: {
    type: string;
    message: string;
    timestamp: Date;
    recoverable?: boolean;
  };
}

export interface ProcessingResult {
  toolName: string;
  content: string;
  confidence: number;
  processingTime: number;
  metadata: Record<string, any>;
}