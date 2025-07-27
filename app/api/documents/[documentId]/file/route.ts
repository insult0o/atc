import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';

export async function GET(
  request: NextRequest,
  { params }: { params: { documentId: string } }
) {
  try {
    const { documentId } = params;
    
    // For now, we'll look for files in the uploads directory
    // In a real implementation, you'd look up the file path in the database
    const uploadsDir = join(process.cwd(), 'uploads');
    
    // Try to find a file that contains this document ID or timestamp
    const { readdir } = await import('fs/promises');
    const files = await readdir(uploadsDir);
    
    // Find files that might match this document ID
    // Look for files with timestamp that matches or contains the document ID
    let targetFile = null;
    
    // If it's a local document ID (format: local_timestamp), extract timestamp
    if (documentId.startsWith('local_')) {
      const timestamp = documentId.replace('local_', '');
      targetFile = files.find(file => file.startsWith(timestamp));
    } else {
      // For UUID document IDs, find the most recent PDF file
      const pdfFiles = files.filter(file => file.endsWith('.pdf'));
      if (pdfFiles.length > 0) {
        // Sort by timestamp (most recent first)
        pdfFiles.sort((a, b) => {
          const timestampA = parseInt(a.split('-')[0]) || 0;
          const timestampB = parseInt(b.split('-')[0]) || 0;
          return timestampB - timestampA;
        });
        targetFile = pdfFiles[0];
      }
    }
    
    if (!targetFile) {
      return NextResponse.json(
        { error: 'File not found for document ID' },
        { status: 404 }
      );
    }
    
    const filePath = join(uploadsDir, targetFile);
    console.log(`📄 Serving file for document ${documentId}: ${targetFile}`);
    
    // Read and serve the file
    const fileBuffer = await readFile(filePath);
    
    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${targetFile}"`,
        'Content-Length': fileBuffer.length.toString(),
      },
    });
    
  } catch (error) {
    console.error('Error serving document file:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve document file', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 