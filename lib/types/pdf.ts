// PDF document type definitions

export interface PDFDocument {
  id: string;
  filename: string;
  pages: PDFPage[];
  metadata: {
    title?: string;
    author?: string;
    subject?: string;
    keywords?: string;
    creator?: string;
    producer?: string;
    creationDate?: Date;
    modDate?: Date;
    pageCount: number;
    fileSize: number;
  };
  processingStatus: 'pending' | 'processing' | 'completed' | 'failed';
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface PDFPage {
  pageNumber: number;
  width: number;
  height: number;
  rotation: number;
  content?: {
    text?: string;
    images?: PDFImage[];
    fonts?: PDFFont[];
  };
  processingMetadata?: {
    ocrApplied: boolean;
    processingTime: number;
    confidence: number;
  };
}

export interface PDFImage {
  id: string;
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  format: string;
  resolution: number;
  size: number;
}

export interface PDFFont {
  name: string;
  size: number;
  weight: string;
  style: string;
}