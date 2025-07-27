-- PDF Intelligence Platform Database Initialization
-- This script sets up the database schema for metadata storage

-- Create database if not exists (handled by POSTGRES_DB env var)

-- Create schemas
CREATE SCHEMA IF NOT EXISTS pdf_processing;
CREATE SCHEMA IF NOT EXISTS analytics;

-- Create tables for document metadata
CREATE TABLE IF NOT EXISTS pdf_processing.documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    filename VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    mime_type VARCHAR(100) DEFAULT 'application/pdf',
    upload_timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    processing_status VARCHAR(50) DEFAULT 'pending',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create tables for processing results
CREATE TABLE IF NOT EXISTS pdf_processing.processing_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID REFERENCES pdf_processing.documents(id) ON DELETE CASCADE,
    processor_version VARCHAR(50) NOT NULL,
    strategy VARCHAR(50) NOT NULL,
    processing_time_ms INTEGER NOT NULL,
    element_count INTEGER NOT NULL,
    quality_score DECIMAL(3,2),
    cached BOOLEAN DEFAULT FALSE,
    error_message TEXT,
    result_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create tables for document zones
CREATE TABLE IF NOT EXISTS pdf_processing.zones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID REFERENCES pdf_processing.documents(id) ON DELETE CASCADE,
    zone_type VARCHAR(50) NOT NULL,
    page_number INTEGER NOT NULL,
    zone_order INTEGER DEFAULT 0,
    bbox JSONB NOT NULL,
    coordinates JSONB,
    content TEXT,
    confidence DECIMAL(3,2),
    position_type VARCHAR(50),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Keep the original table name as an alias for compatibility
CREATE VIEW pdf_processing.document_zones AS SELECT * FROM pdf_processing.zones;

-- Create tables for analytics
CREATE TABLE IF NOT EXISTS analytics.processing_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID REFERENCES pdf_processing.documents(id) ON DELETE CASCADE,
    processing_time_ms INTEGER NOT NULL,
    quality_score DECIMAL(3,2),
    elements_count INTEGER NOT NULL,
    strategy VARCHAR(50) NOT NULL,
    cached BOOLEAN DEFAULT FALSE,
    zones_detected INTEGER DEFAULT 0,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_documents_upload_timestamp ON pdf_processing.documents(upload_timestamp);
CREATE INDEX IF NOT EXISTS idx_documents_processing_status ON pdf_processing.documents(processing_status);
CREATE INDEX IF NOT EXISTS idx_processing_results_document_id ON pdf_processing.processing_results(document_id);
CREATE INDEX IF NOT EXISTS idx_zones_document_id ON pdf_processing.zones(document_id);
CREATE INDEX IF NOT EXISTS idx_zones_page_number ON pdf_processing.zones(page_number);
CREATE INDEX IF NOT EXISTS idx_zones_zone_type ON pdf_processing.zones(zone_type);
CREATE INDEX IF NOT EXISTS idx_processing_stats_timestamp ON analytics.processing_stats(timestamp);

-- Create functions for automatic timestamp updates
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_documents_updated_at BEFORE UPDATE ON pdf_processing.documents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_zones_updated_at BEFORE UPDATE ON pdf_processing.zones
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert sample configuration
INSERT INTO pdf_processing.documents (filename, file_path, file_size, processing_status, metadata) 
VALUES ('README.md', '/app/README.md', 1024, 'completed', '{"sample": true}')
ON CONFLICT DO NOTHING;

-- Create export records table
CREATE TABLE IF NOT EXISTS pdf_processing.export_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID REFERENCES pdf_processing.documents(id) ON DELETE CASCADE,
    export_type VARCHAR(50) NOT NULL,
    formats TEXT[] NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    file_paths JSONB DEFAULT '{}',
    file_sizes JSONB DEFAULT '{}',
    validation_results JSONB,
    selection JSONB,
    options JSONB DEFAULT '{}',
    error_message TEXT,
    created_by VARCHAR(255),
    download_count INTEGER DEFAULT 0,
    expires_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for export records
CREATE INDEX IF NOT EXISTS idx_export_records_document_id ON pdf_processing.export_records(document_id);
CREATE INDEX IF NOT EXISTS idx_export_records_status ON pdf_processing.export_records(status);
CREATE INDEX IF NOT EXISTS idx_export_records_expires_at ON pdf_processing.export_records(expires_at);
CREATE INDEX IF NOT EXISTS idx_export_records_created_at ON pdf_processing.export_records(created_at);

-- Add trigger for export records timestamp update
CREATE TRIGGER update_export_records_updated_at BEFORE UPDATE ON pdf_processing.export_records
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Grant permissions
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA pdf_processing TO pdf_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA analytics TO pdf_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA pdf_processing TO pdf_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA analytics TO pdf_user; 