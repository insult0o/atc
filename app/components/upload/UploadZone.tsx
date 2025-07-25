import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, File, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface UploadZoneProps {
  onUpload: (file: File) => Promise<void>;
  maxSize?: number;
}

export function UploadZone({ onUpload, maxSize = 100 * 1024 * 1024 }: UploadZoneProps) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    try {
      setError(null);
      setUploading(true);
      setProgress(0);

      // Validate file type
      if (file.type !== 'application/pdf') {
        throw new Error('Please upload a PDF file');
      }

      // Validate file size
      if (file.size > maxSize) {
        throw new Error(`File size exceeds ${maxSize / (1024 * 1024)}MB limit`);
      }

      // Create upload progress handler
      const onProgress = (percent: number) => {
        setProgress(percent);
      };

      // Start upload
      await onUpload(file);
      setProgress(100);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }, [maxSize, onUpload]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf']
    },
    maxFiles: 1,
    disabled: uploading
  });

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div
        {...getRootProps()}
        className={cn(
          'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
          isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25',
          uploading && 'opacity-50 cursor-not-allowed'
        )}
      >
        <input {...getInputProps()} />
        
        <div className="flex flex-col items-center gap-4">
          {uploading ? (
            <Upload className="w-12 h-12 text-muted-foreground animate-bounce" />
          ) : (
            <File className="w-12 h-12 text-muted-foreground" />
          )}
          
          <div className="text-lg font-medium">
            {isDragActive ? (
              'Drop the PDF here'
            ) : uploading ? (
              'Uploading...'
            ) : (
              <>
                Drag & drop your PDF here, or <span className="text-primary">browse</span>
              </>
            )}
          </div>
          
          <p className="text-sm text-muted-foreground">
            PDF files only, up to {maxSize / (1024 * 1024)}MB
          </p>
        </div>
      </div>

      {uploading && (
        <div className="mt-4">
          <Progress value={progress} className="h-2" />
          <p className="mt-2 text-sm text-center text-muted-foreground">
            Uploading... {progress.toFixed(0)}%
          </p>
        </div>
      )}

      {error && (
        <Alert variant="destructive" className="mt-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
} 