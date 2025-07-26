-- PDF Intelligence Platform - Initial Database Schema
-- Migration: 001_initial_schema.sql
-- Created: 2024-01-15

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gin";

-- Create custom types
CREATE TYPE document_status AS ENUM (
    'uploaded',
    'processing', 
    'completed',
    'failed',
    'cancelled'
);

CREATE TYPE processing_status AS ENUM (
    'queued',
    'processing',
    'completed', 
    'failed',
    'cancelled',
    'paused'
);

CREATE TYPE processing_strategy AS ENUM (
    'auto',
    'fast',
    'accurate',
    'balanced'
);

CREATE TYPE zone_type AS ENUM (
    'text',
    'table',
    'image',
    'diagram',
    'header',
    'footer',
    'unknown'
);

CREATE TYPE zone_status AS ENUM (
    'pending',
    'processing',
    'completed',
    'failed',
    'skipped'
);

CREATE TYPE export_format AS ENUM (
    'json',
    'jsonl',
    'csv',
    'txt',
    'markdown',
    'docx',
    'pdf',
    'xml'
);

CREATE TYPE export_type AS ENUM (
    'full',
    'partial',
    'zones_only',
    'text_only',
    'metadata_only'
);

CREATE TYPE export_status AS ENUM (
    'pending',
    'processing',
    'completed',
    'failed',
    'cancelled'
);

-- Documents table
CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    filename VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    file_size_bytes BIGINT NOT NULL CHECK (file_size_bytes > 0),
    page_count INTEGER CHECK (page_count > 0),
    mime_type VARCHAR(100) NOT NULL DEFAULT 'application/pdf',
    storage_path VARCHAR(500),
    status document_status NOT NULL DEFAULT 'uploaded',
    uploaded_by VARCHAR(255),
    processing_started_at TIMESTAMPTZ,
    processing_completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Zones table
CREATE TABLE zones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    zone_index INTEGER NOT NULL CHECK (zone_index >= 0),
    page_number INTEGER NOT NULL CHECK (page_number > 0),
    zone_type zone_type NOT NULL DEFAULT 'unknown',
    coordinates JSONB NOT NULL,
    content TEXT,
    confidence DECIMAL(3,2) CHECK (confidence >= 0 AND confidence <= 1),
    processing_tool VARCHAR(100),
    status zone_status NOT NULL DEFAULT 'pending',
    error_message TEXT,
    processing_duration REAL CHECK (processing_duration >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb,
    UNIQUE(document_id, zone_index)
);

-- Processing jobs table
CREATE TABLE processing_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    status processing_status NOT NULL DEFAULT 'queued',
    strategy processing_strategy NOT NULL DEFAULT 'auto',
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    progress DECIMAL(5,2) NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
    current_zone_id UUID REFERENCES zones(id),
    total_zones INTEGER NOT NULL DEFAULT 0 CHECK (total_zones >= 0),
    completed_zones INTEGER NOT NULL DEFAULT 0 CHECK (completed_zones >= 0),
    failed_zones INTEGER NOT NULL DEFAULT 0 CHECK (failed_zones >= 0),
    error_count INTEGER NOT NULL DEFAULT 0 CHECK (error_count >= 0),
    error_message TEXT,
    estimated_completion TIMESTAMPTZ,
    priority INTEGER NOT NULL DEFAULT 5 CHECK (priority >= 1 AND priority <= 10),
    options JSONB DEFAULT '{}'::jsonb,
    metrics JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Export records table
CREATE TABLE export_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    export_type export_type NOT NULL,
    formats export_format[] NOT NULL,
    status export_status NOT NULL DEFAULT 'pending',
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    file_paths JSONB DEFAULT '{}'::jsonb,
    file_sizes JSONB DEFAULT '{}'::jsonb,
    validation_results JSONB,
    selection JSONB,
    options JSONB DEFAULT '{}'::jsonb,
    error_message TEXT,
    created_by VARCHAR(255),
    download_count INTEGER NOT NULL DEFAULT 0 CHECK (download_count >= 0),
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Processing history table
CREATE TABLE processing_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID NOT NULL REFERENCES processing_jobs(id) ON DELETE CASCADE,
    zone_id UUID REFERENCES zones(id),
    action VARCHAR(100) NOT NULL,
    status VARCHAR(50) NOT NULL,
    details JSONB DEFAULT '{}'::jsonb,
    error_message TEXT,
    duration_ms INTEGER CHECK (duration_ms >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- User corrections table
CREATE TABLE user_corrections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    zone_id UUID NOT NULL REFERENCES zones(id) ON DELETE CASCADE,
    original_content TEXT,
    corrected_content TEXT NOT NULL,
    confidence_before DECIMAL(3,2) CHECK (confidence_before >= 0 AND confidence_before <= 1),
    confidence_after DECIMAL(3,2) NOT NULL DEFAULT 1.0 CHECK (confidence_after >= 0 AND confidence_after <= 1),
    correction_type VARCHAR(50),
    corrected_by VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Zone confidence history table
CREATE TABLE zone_confidence_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    zone_id UUID NOT NULL REFERENCES zones(id) ON DELETE CASCADE,
    confidence DECIMAL(3,2) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
    processing_tool VARCHAR(100),
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
-- Documents indexes
CREATE INDEX idx_documents_status ON documents(status);
CREATE INDEX idx_documents_created_at ON documents(created_at DESC);
CREATE INDEX idx_documents_updated_at ON documents(updated_at DESC);
CREATE INDEX idx_documents_uploaded_by ON documents(uploaded_by);
CREATE INDEX idx_documents_filename_trgm ON documents USING gin(filename gin_trgm_ops);
CREATE INDEX idx_documents_metadata_gin ON documents USING gin(metadata);

-- Zones indexes
CREATE INDEX idx_zones_document_id ON zones(document_id);
CREATE INDEX idx_zones_status ON zones(status);
CREATE INDEX idx_zones_zone_type ON zones(zone_type);
CREATE INDEX idx_zones_confidence ON zones(confidence DESC);
CREATE INDEX idx_zones_page_number ON zones(document_id, page_number);
CREATE INDEX idx_zones_coordinates_gin ON zones USING gin(coordinates);
CREATE INDEX idx_zones_content_trgm ON zones USING gin(content gin_trgm_ops);

-- Processing jobs indexes
CREATE INDEX idx_processing_jobs_document_id ON processing_jobs(document_id);
CREATE INDEX idx_processing_jobs_status ON processing_jobs(status);
CREATE INDEX idx_processing_jobs_created_at ON processing_jobs(created_at DESC);
CREATE INDEX idx_processing_jobs_priority ON processing_jobs(priority DESC, created_at);
CREATE INDEX idx_processing_jobs_progress ON processing_jobs(progress);

-- Export records indexes
CREATE INDEX idx_export_records_document_id ON export_records(document_id);
CREATE INDEX idx_export_records_status ON export_records(status);
CREATE INDEX idx_export_records_created_at ON export_records(created_at DESC);
CREATE INDEX idx_export_records_expires_at ON export_records(expires_at);
CREATE INDEX idx_export_records_export_type ON export_records(export_type);
CREATE INDEX idx_export_records_formats_gin ON export_records USING gin(formats);

-- Processing history indexes
CREATE INDEX idx_processing_history_job_id ON processing_history(job_id);
CREATE INDEX idx_processing_history_zone_id ON processing_history(zone_id);
CREATE INDEX idx_processing_history_created_at ON processing_history(created_at DESC);

-- User corrections indexes
CREATE INDEX idx_user_corrections_zone_id ON user_corrections(zone_id);
CREATE INDEX idx_user_corrections_corrected_by ON user_corrections(corrected_by);
CREATE INDEX idx_user_corrections_created_at ON user_corrections(created_at DESC);

-- Zone confidence history indexes
CREATE INDEX idx_zone_confidence_history_zone_id ON zone_confidence_history(zone_id);
CREATE INDEX idx_zone_confidence_history_recorded_at ON zone_confidence_history(recorded_at DESC);

-- Create triggers for updated_at columns
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_documents_updated_at 
    BEFORE UPDATE ON documents 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_zones_updated_at 
    BEFORE UPDATE ON zones 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_processing_jobs_updated_at 
    BEFORE UPDATE ON processing_jobs 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_export_records_updated_at 
    BEFORE UPDATE ON export_records 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create RLS (Row Level Security) policies
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE processing_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE export_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE processing_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_corrections ENABLE ROW LEVEL SECURITY;
ALTER TABLE zone_confidence_history ENABLE ROW LEVEL SECURITY;

-- Basic RLS policies (can be expanded based on auth requirements)
CREATE POLICY "Documents are viewable by authenticated users" ON documents
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Users can insert documents" ON documents
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can update their documents" ON documents
    FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Users can delete their documents" ON documents
    FOR DELETE USING (auth.role() = 'authenticated');

-- Similar policies for other tables
CREATE POLICY "Zones are viewable by authenticated users" ON zones
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Processing jobs are viewable by authenticated users" ON processing_jobs
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Export records are viewable by authenticated users" ON export_records
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Processing history is viewable by authenticated users" ON processing_history
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "User corrections are viewable by authenticated users" ON user_corrections
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Zone confidence history is viewable by authenticated users" ON zone_confidence_history
    FOR ALL USING (auth.role() = 'authenticated');

-- Create views for common queries
CREATE VIEW document_processing_summary AS
SELECT 
    d.id,
    d.filename,
    d.file_size_bytes,
    d.page_count,
    d.status as document_status,
    d.created_at as uploaded_at,
    pj.status as processing_status,
    pj.progress,
    pj.total_zones,
    pj.completed_zones,
    pj.failed_zones,
    COUNT(z.id) as zones_detected,
    COUNT(CASE WHEN z.status = 'completed' THEN 1 END) as zones_completed,
    COUNT(CASE WHEN z.status = 'failed' THEN 1 END) as zones_failed
FROM documents d
LEFT JOIN processing_jobs pj ON d.id = pj.document_id 
    AND pj.created_at = (
        SELECT MAX(created_at) 
        FROM processing_jobs 
        WHERE document_id = d.id
    )
LEFT JOIN zones z ON d.id = z.document_id
GROUP BY d.id, d.filename, d.file_size_bytes, d.page_count, 
         d.status, d.created_at, pj.status, pj.progress, 
         pj.total_zones, pj.completed_zones, pj.failed_zones;

-- Create materialized view for analytics
CREATE MATERIALIZED VIEW document_analytics AS
SELECT 
    DATE_TRUNC('day', created_at) as date,
    COUNT(*) as documents_uploaded,
    SUM(file_size_bytes) as total_bytes_uploaded,
    AVG(file_size_bytes) as avg_file_size,
    COUNT(CASE WHEN status = 'completed' THEN 1 END) as documents_completed,
    COUNT(CASE WHEN status = 'processing' THEN 1 END) as documents_processing,
    COUNT(CASE WHEN status = 'failed' THEN 1 END) as documents_failed
FROM documents
GROUP BY DATE_TRUNC('day', created_at)
ORDER BY date DESC;

-- Create index on materialized view
CREATE INDEX idx_document_analytics_date ON document_analytics(date DESC);

-- Create function to refresh analytics
CREATE OR REPLACE FUNCTION refresh_document_analytics()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY document_analytics;
END;
$$ LANGUAGE plpgsql;

-- Create function for document statistics
CREATE OR REPLACE FUNCTION get_document_stats()
RETURNS json AS $$
DECLARE
    result json;
BEGIN
    SELECT json_build_object(
        'total_documents', COUNT(*),
        'total_size_bytes', COALESCE(SUM(file_size_bytes), 0),
        'documents_by_status', json_object_agg(status, status_count),
        'documents_today', COUNT(CASE WHEN DATE(created_at) = CURRENT_DATE THEN 1 END),
        'documents_this_week', COUNT(CASE WHEN created_at >= DATE_TRUNC('week', CURRENT_DATE) THEN 1 END),
        'documents_this_month', COUNT(CASE WHEN created_at >= DATE_TRUNC('month', CURRENT_DATE) THEN 1 END),
        'average_file_size', COALESCE(AVG(file_size_bytes), 0),
        'average_processing_time', COALESCE(AVG(EXTRACT(EPOCH FROM (processing_completed_at - processing_started_at))), 0)
    ) INTO result
    FROM documents
    CROSS JOIN LATERAL (
        SELECT status, COUNT(*) as status_count
        FROM documents d2
        WHERE d2.status = documents.status
        GROUP BY status
    ) status_counts;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Create function for processing queue management
CREATE OR REPLACE FUNCTION get_next_processing_job()
RETURNS processing_jobs AS $$
DECLARE
    job processing_jobs;
BEGIN
    SELECT * INTO job
    FROM processing_jobs
    WHERE status = 'queued'
    ORDER BY priority DESC, created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED;
    
    IF FOUND THEN
        UPDATE processing_jobs
        SET status = 'processing', started_at = NOW(), updated_at = NOW()
        WHERE id = job.id;
    END IF;
    
    RETURN job;
END;
$$ LANGUAGE plpgsql;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;

-- Comments for documentation
COMMENT ON TABLE documents IS 'Stores uploaded PDF documents and their metadata';
COMMENT ON TABLE zones IS 'Stores detected zones within documents with their content and processing status';
COMMENT ON TABLE processing_jobs IS 'Tracks document processing jobs and their progress';
COMMENT ON TABLE export_records IS 'Stores export job information and generated files';
COMMENT ON TABLE processing_history IS 'Audit trail for processing operations';
COMMENT ON TABLE user_corrections IS 'Stores manual corrections made by users to extracted content';
COMMENT ON TABLE zone_confidence_history IS 'Tracks confidence score changes over time';

COMMENT ON COLUMN documents.metadata IS 'Additional document metadata stored as JSON';
COMMENT ON COLUMN zones.coordinates IS 'Zone coordinates and dimensions stored as JSON';
COMMENT ON COLUMN zones.confidence IS 'Processing confidence score between 0 and 1';
COMMENT ON COLUMN processing_jobs.priority IS 'Job priority from 1 (lowest) to 10 (highest)';
COMMENT ON COLUMN export_records.formats IS 'Array of export formats requested';
COMMENT ON COLUMN export_records.file_paths IS 'JSON object mapping format to file path';

-- Migration completion marker
INSERT INTO schema_migrations (version) VALUES ('001_initial_schema');

-- Create schema_migrations table if it doesn't exist
CREATE TABLE IF NOT EXISTS schema_migrations (
    version VARCHAR(255) PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
); 