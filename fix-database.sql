-- Fix database schema issue by creating tables in public schema

-- Create documents table
CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    filename VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255),
    file_size_bytes BIGINT NOT NULL,
    page_count INTEGER,
    mime_type VARCHAR(100) DEFAULT 'application/pdf',
    storage_path TEXT,
    status VARCHAR(50) DEFAULT 'pending',
    uploaded_by VARCHAR(255),
    processing_started_at TIMESTAMP WITH TIME ZONE,
    processing_completed_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create zones table
CREATE TABLE IF NOT EXISTS zones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
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

-- Create processing_results table
CREATE TABLE IF NOT EXISTS processing_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
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

-- Create export_records table
CREATE TABLE IF NOT EXISTS export_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
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

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);
CREATE INDEX IF NOT EXISTS idx_zones_document_id ON zones(document_id);
CREATE INDEX IF NOT EXISTS idx_processing_results_document_id ON processing_results(document_id);
CREATE INDEX IF NOT EXISTS idx_export_records_document_id ON export_records(document_id);