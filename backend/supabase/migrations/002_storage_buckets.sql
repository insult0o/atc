-- PDF Intelligence Platform - Storage Buckets Setup
-- Migration: 002_storage_buckets.sql
-- Created: 2024-01-15

-- Create storage buckets for file management
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
    (
        'documents',
        'documents',
        false,
        52428800, -- 50MB limit
        ARRAY['application/pdf']
    ),
    (
        'exports',
        'exports', 
        false,
        104857600, -- 100MB limit
        ARRAY[
            'application/json',
            'application/jsonl',
            'text/csv',
            'text/plain',
            'text/markdown',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/pdf',
            'application/xml',
            'application/zip'
        ]
    ),
    (
        'thumbnails',
        'thumbnails',
        true,
        10485760, -- 10MB limit
        ARRAY[
            'image/jpeg',
            'image/png',
            'image/webp',
            'image/svg+xml'
        ]
    );

-- Create storage policies for documents bucket
CREATE POLICY "Authenticated users can upload documents" ON storage.objects
    FOR INSERT WITH CHECK (
        auth.role() = 'authenticated' 
        AND bucket_id = 'documents'
    );

CREATE POLICY "Authenticated users can view their documents" ON storage.objects
    FOR SELECT USING (
        auth.role() = 'authenticated' 
        AND bucket_id = 'documents'
    );

CREATE POLICY "Authenticated users can update their documents" ON storage.objects
    FOR UPDATE USING (
        auth.role() = 'authenticated' 
        AND bucket_id = 'documents'
    );

CREATE POLICY "Authenticated users can delete their documents" ON storage.objects
    FOR DELETE USING (
        auth.role() = 'authenticated' 
        AND bucket_id = 'documents'
    );

-- Create storage policies for exports bucket
CREATE POLICY "Authenticated users can upload exports" ON storage.objects
    FOR INSERT WITH CHECK (
        auth.role() = 'authenticated' 
        AND bucket_id = 'exports'
    );

CREATE POLICY "Authenticated users can view their exports" ON storage.objects
    FOR SELECT USING (
        auth.role() = 'authenticated' 
        AND bucket_id = 'exports'
    );

CREATE POLICY "Authenticated users can delete their exports" ON storage.objects
    FOR DELETE USING (
        auth.role() = 'authenticated' 
        AND bucket_id = 'exports'
    );

-- Create storage policies for thumbnails bucket (public read)
CREATE POLICY "Anyone can view thumbnails" ON storage.objects
    FOR SELECT USING (bucket_id = 'thumbnails');

CREATE POLICY "Authenticated users can upload thumbnails" ON storage.objects
    FOR INSERT WITH CHECK (
        auth.role() = 'authenticated' 
        AND bucket_id = 'thumbnails'
    );

CREATE POLICY "Authenticated users can delete thumbnails" ON storage.objects
    FOR DELETE USING (
        auth.role() = 'authenticated' 
        AND bucket_id = 'thumbnails'
    );

-- Create function to clean up orphaned storage objects
CREATE OR REPLACE FUNCTION cleanup_orphaned_storage_objects()
RETURNS void AS $$
BEGIN
    -- Clean up orphaned document files
    DELETE FROM storage.objects
    WHERE bucket_id = 'documents'
    AND name NOT IN (
        SELECT REPLACE(storage_path, 'documents/', '')
        FROM documents 
        WHERE storage_path IS NOT NULL
    );
    
    -- Clean up orphaned export files
    DELETE FROM storage.objects
    WHERE bucket_id = 'exports'
    AND name NOT IN (
        SELECT jsonb_object_keys(file_paths)
        FROM export_records 
        WHERE file_paths IS NOT NULL
    );
    
    -- Clean up expired export files
    DELETE FROM storage.objects
    WHERE bucket_id = 'exports'
    AND name IN (
        SELECT jsonb_object_keys(file_paths)
        FROM export_records 
        WHERE expires_at < NOW()
    );
END;
$$ LANGUAGE plpgsql;

-- Create function to get storage usage statistics
CREATE OR REPLACE FUNCTION get_storage_stats()
RETURNS json AS $$
DECLARE
    result json;
BEGIN
    SELECT json_build_object(
        'documents', json_build_object(
            'count', COUNT(CASE WHEN bucket_id = 'documents' THEN 1 END),
            'total_size', COALESCE(SUM(CASE WHEN bucket_id = 'documents' THEN metadata->>'size' END)::bigint, 0)
        ),
        'exports', json_build_object(
            'count', COUNT(CASE WHEN bucket_id = 'exports' THEN 1 END),
            'total_size', COALESCE(SUM(CASE WHEN bucket_id = 'exports' THEN metadata->>'size' END)::bigint, 0)
        ),
        'thumbnails', json_build_object(
            'count', COUNT(CASE WHEN bucket_id = 'thumbnails' THEN 1 END),
            'total_size', COALESCE(SUM(CASE WHEN bucket_id = 'thumbnails' THEN metadata->>'size' END)::bigint, 0)
        ),
        'total_size', COALESCE(SUM((metadata->>'size')::bigint), 0)
    ) INTO result
    FROM storage.objects;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Migration completion marker
INSERT INTO schema_migrations (version) VALUES ('002_storage_buckets'); 