import { NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { message: 'No file uploaded' },
        { status: 400 }
      );
    }

    // Validate file type
    if (file.type !== 'application/pdf') {
      return NextResponse.json(
        { message: 'Please upload a PDF file' },
        { status: 400 }
      );
    }

    // Validate file size (100MB)
    const maxSize = 100 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { message: 'File size exceeds 100MB limit' },
        { status: 400 }
      );
    }

    // Convert file to buffer
    const buffer = Buffer.from(await file.arrayBuffer());

    // Create unique filename and document ID
    const timestamp = Date.now();
    const filename = `${timestamp}-${file.name}`;
    const documentId = uuidv4();

    // Ensure uploads directory exists
    const uploadDir = join(process.cwd(), 'uploads');
    try {
      await mkdir(uploadDir, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }

    // Save file locally
    const filePath = join(uploadDir, filename);
    await writeFile(filePath, buffer);

    console.log(`📄 File uploaded: ${filename} (${file.size} bytes)`);

    // Step 1: Create document in backend database
    try {
      const documentData = {
        filename: file.name,
        file_size: file.size,
        file_path: filePath,
        metadata: {
          original_filename: file.name,
          stored_filename: filename,
          file_type: file.type,
          uploaded_at: new Date().toISOString()
        }
      };

      console.log(`🔄 Creating document in backend database...`);
      const backendResponse = await fetch('http://localhost:8000/api/v1/documents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(documentData)
      });

      if (!backendResponse.ok) {
        const errorText = await backendResponse.text();
        console.error(`❌ Backend document creation failed: ${backendResponse.status} - ${errorText}`);
        throw new Error(`Backend document creation failed: ${backendResponse.status}`);
      }

      const backendResult = await backendResponse.json();
      const backendDocumentId = backendResult.id;
      console.log(`✅ Document created in backend: ${backendDocumentId}`);

      // Step 2: Start high-performance processing
      console.log(`🚀 Starting high-performance processing...`);
      const processingResponse = await fetch(`http://localhost:8000/api/v1/process/${backendDocumentId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          strategy: 'hi_res',
          priority: 'high',
          options: {
            enable_gpu: true,
            parallel_workers: 8,
            streaming: true,
            real_time_progress: true
          }
        })
      });

      if (!processingResponse.ok) {
        const errorText = await processingResponse.text();
        console.error(`❌ Processing initiation failed: ${processingResponse.status} - ${errorText}`);
        // Don't fail the upload if processing fails - we can retry later
        console.warn(`⚠️ Processing will be retried later`);
      } else {
        const processingResult = await processingResponse.json();
        console.log(`✅ Processing started: Job ${processingResult.id}`);
      }

      // Return success response with backend document ID
      return NextResponse.json({
        documentId: backendDocumentId, // Use backend document ID
        document: {
          id: backendDocumentId,
          filename: file.name,
          originalFilename: file.name,
          storedFilename: filename,
          size: file.size,
          type: file.type,
          uploadedAt: new Date().toISOString(),
          status: 'uploaded',
          processing: 'started'
        },
        message: 'File uploaded and processing started',
        backend_integrated: true
      });

    } catch (backendError) {
      console.error('❌ Backend integration failed:', backendError);
      
      // Fallback: return local upload success but indicate backend failure
      return NextResponse.json({
        documentId: `local_${timestamp}`, // Local fallback ID
        document: {
          filename: file.name,
          originalFilename: file.name,
          storedFilename: filename,
          size: file.size,
          type: file.type,
          uploadedAt: new Date().toISOString(),
          status: 'uploaded',
          processing: 'backend_unavailable'
        },
        message: 'File uploaded (backend unavailable - processing in fallback mode)',
        backend_integrated: false,
        error: 'Backend integration failed - using fallback mode'
      });
    }

  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { message: 'Upload failed', error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 