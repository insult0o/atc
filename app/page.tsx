'use client';

import * as React from 'react';
import { UploadZone } from '@/app/components/upload/UploadZone';

export default function Home() {
  const handleUpload = async (file: File) => {
    // Create form data
    const formData = new FormData();
    formData.append('file', file);

    // Upload file
    const response = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Upload failed');
    }

    return response.json();
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <h1 className="text-4xl font-bold mb-8">PDF Processing Platform</h1>
      <UploadZone onUpload={handleUpload} />
    </main>
  );
} 