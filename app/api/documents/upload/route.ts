import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import * as pdfjsLib from 'pdfjs-dist';
import type { Document, ProcessingStatus } from '@pdf-platform/shared';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = 'pdfjs-dist/build/pdf.worker.js';

interface DocumentResponse {
  document: Document;
  zones: any[];
  processingStatus: ProcessingStatus;
}

export async function POST(request: NextRequest) {
  try {
    // Parse form data
    const data = await request.formData();
    const file: File | null = data.get('file') as unknown as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No file uploaded' },
        { status: 400 }
      );
    }

    // Validate file type
    if (file.type !== 'application/pdf') {
      return NextResponse.json(
        { error: 'Only PDF files are allowed' },
        { status: 400 }
      );
    }

    // Validate file size (100MB limit)
    const maxSize = 100 * 1024 * 1024; // 100MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File size exceeds 100MB limit' },
        { status: 400 }
      );
    }

    // Generate unique document ID and filename
    const documentId = uuidv4();
    const timestamp = Date.now();
    const filename = `${timestamp}-${file.name}`;
    
    // Ensure uploads directory exists
    const uploadsDir = join(process.cwd(), 'uploads');
    try {
      await mkdir(uploadsDir, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }

    // Save file to uploads directory
    const filePath = join(uploadsDir, filename);
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filePath, buffer);

    // Extract PDF metadata
    let pageCount = 0;
    try {
      const pdfDoc = await pdfjsLib.getDocument(buffer).promise;
      pageCount = pdfDoc.numPages;
    } catch (error) {
      console.error('Failed to parse PDF:', error);
      return NextResponse.json(
        { error: 'Invalid PDF file' },
        { status: 400 }
      );
    }

    // Create document record
    const document: Document = {
      id: documentId,
      name: file.name,
      filePath: `/uploads/${filename}`,
      fileSize: file.size,
      pageCount,
      status: 'uploaded',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Initialize processing status
    const processingStatus: ProcessingStatus = {
      totalZones: 0,
      completedZones: 0,
      currentlyProcessing: [],
      estimatedTimeRemaining: 0
    };

    // TODO: Store document in database
    // For now, we'll simulate database storage
    console.log('Document uploaded:', document);

    // Start background processing (async)
    // This would typically be sent to a job queue
    initiateProcessing(document).catch(error => {
      console.error('Processing initiation failed:', error);
    });

    // Prepare response
    const response: DocumentResponse = {
      document,
      zones: [], // Initially empty, zones will be detected during processing
      processingStatus
    };

    return NextResponse.json(response, { status: 201 });

  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Upload failed' },
      { status: 500 }
    );
  }
}

// Initiate background processing
async function initiateProcessing(document: Document) {
  try {
    console.log(`Starting processing for document ${document.id}`);
    
    // TODO: Integrate with actual processing orchestrator
    // For now, simulate the process with WebSocket events
    
    // Simulate zone detection after a short delay
    setTimeout(async () => {
      // TODO: Send WebSocket event for zone detection started
      console.log(`Zone detection started for document ${document.id}`);
      
      // Simulate finding zones
      setTimeout(async () => {
        // TODO: Send WebSocket events for detected zones
        console.log(`Zone detection completed for document ${document.id}`);
      }, 2000);
      
    }, 500);
    
  } catch (error) {
    console.error('Processing initiation error:', error);
    // TODO: Send error WebSocket event
  }
}

// GET endpoint to retrieve document information
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const documentId = url.searchParams.get('id');

    if (!documentId) {
      return NextResponse.json(
        { error: 'Document ID required' },
        { status: 400 }
      );
    }

    // TODO: Retrieve from database
    // For now, return mock data
    const mockDocument: Document = {
      id: documentId,
      name: 'sample.pdf',
      filePath: '/uploads/sample.pdf',
      fileSize: 1024000,
      pageCount: 10,
      status: 'processing',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const response: DocumentResponse = {
      document: mockDocument,
      zones: [],
      processingStatus: {
        totalZones: 5,
        completedZones: 2,
        currentlyProcessing: ['zone-1', 'zone-2'],
        estimatedTimeRemaining: 30
      }
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Document retrieval error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve document' },
      { status: 500 }
    );
  }
} 