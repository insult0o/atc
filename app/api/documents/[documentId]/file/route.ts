import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';

export async function GET(
  request: NextRequest,
  { params }: { params: { documentId: string } }
) {
  try {
    const { documentId } = params;
    
    // For this demo, we'll look for files in uploads directory
    // In a real app, you'd have a database to map documentId to filename
    const uploadsDir = join(process.cwd(), 'uploads');
    
    // Extract timestamp from documentId to find the file
    const timestamp = documentId.split('_')[1];
    
    if (!timestamp) {
      return NextResponse.json(
        { message: 'Invalid document ID' },
        { status: 400 }
      );
    }
    
    // Find files that start with the timestamp
    const { readdirSync } = require('fs');
    const files = readdirSync(uploadsDir);
    const matchingFile = files.find((file: string) => file.startsWith(timestamp));
    
    if (!matchingFile) {
      return NextResponse.json(
        { message: 'File not found' },
        { status: 404 }
      );
    }
    
    // Read and serve the file
    const filePath = join(uploadsDir, matchingFile);
    const fileBuffer = await readFile(filePath);
    
    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${matchingFile}"`,
        'Cache-Control': 'no-cache',
      },
    });
    
  } catch (error) {
    console.error('File serving error:', error);
    return NextResponse.json(
      { message: 'File serving failed' },
      { status: 500 }
    );
  }
} 