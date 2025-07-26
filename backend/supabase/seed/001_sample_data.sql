-- PDF Intelligence Platform - Sample Development Data
-- Seed: 001_sample_data.sql
-- Created: 2024-01-15

-- Insert sample documents
INSERT INTO documents (
    id,
    filename,
    original_filename,
    file_size_bytes,
    page_count,
    mime_type,
    storage_path,
    status,
    uploaded_by,
    created_at,
    metadata
) VALUES 
(
    '550e8400-e29b-41d4-a716-446655440001',
    'sample_aviation_manual.pdf',
    'Aviation Safety Manual.pdf',
    2048576,
    25,
    'application/pdf',
    'documents/550e8400-e29b-41d4-a716-446655440001/sample_aviation_manual.pdf',
    'completed',
    'demo@example.com',
    NOW() - INTERVAL '2 days',
    '{"file_hash": "abc123def456", "upload_ip": "127.0.0.1", "user_agent": "Mozilla/5.0"}'::jsonb
),
(
    '550e8400-e29b-41d4-a716-446655440002',
    'maintenance_procedures.pdf',
    'Aircraft Maintenance Procedures.pdf',
    3145728,
    42,
    'application/pdf',
    'documents/550e8400-e29b-41d4-a716-446655440002/maintenance_procedures.pdf',
    'processing',
    'demo@example.com',
    NOW() - INTERVAL '1 day',
    '{"file_hash": "def456ghi789", "upload_ip": "127.0.0.1", "user_agent": "Mozilla/5.0"}'::jsonb
),
(
    '550e8400-e29b-41d4-a716-446655440003',
    'flight_regulations.pdf',
    'International Flight Regulations.pdf',
    4194304,
    67,
    'application/pdf',
    'documents/550e8400-e29b-41d4-a716-446655440003/flight_regulations.pdf',
    'uploaded',
    'demo@example.com',
    NOW() - INTERVAL '3 hours',
    '{"file_hash": "ghi789jkl012", "upload_ip": "127.0.0.1", "user_agent": "Mozilla/5.0"}'::jsonb
);

-- Insert sample zones for the completed document
INSERT INTO zones (
    id,
    document_id,
    zone_index,
    page_number,
    zone_type,
    coordinates,
    content,
    confidence,
    processing_tool,
    status,
    created_at
) VALUES 
(
    '660e8400-e29b-41d4-a716-446655440001',
    '550e8400-e29b-41d4-a716-446655440001',
    0,
    1,
    'header',
    '{"x": 50, "y": 50, "width": 500, "height": 40, "page_width": 612, "page_height": 792}'::jsonb,
    'AVIATION SAFETY MANUAL',
    0.95,
    'unstructured',
    'completed',
    NOW() - INTERVAL '2 days'
),
(
    '660e8400-e29b-41d4-a716-446655440002',
    '550e8400-e29b-41d4-a716-446655440001',
    1,
    1,
    'text',
    '{"x": 50, "y": 120, "width": 500, "height": 200, "page_width": 612, "page_height": 792}'::jsonb,
    'This manual provides comprehensive guidelines for aviation safety procedures and protocols. It covers emergency procedures, maintenance requirements, and operational standards.',
    0.92,
    'unstructured',
    'completed',
    NOW() - INTERVAL '2 days'
),
(
    '660e8400-e29b-41d4-a716-446655440003',
    '550e8400-e29b-41d4-a716-446655440001',
    2,
    2,
    'table',
    '{"x": 50, "y": 150, "width": 500, "height": 300, "page_width": 612, "page_height": 792}'::jsonb,
    'Emergency Procedures Checklist\n1. Engine Failure - Follow emergency checklist\n2. Fire Detection - Activate suppression system\n3. Loss of Communication - Follow standard protocols',
    0.88,
    'unstructured',
    'completed',
    NOW() - INTERVAL '2 days'
),
(
    '660e8400-e29b-41d4-a716-446655440004',
    '550e8400-e29b-41d4-a716-446655440001',
    3,
    3,
    'image',
    '{"x": 100, "y": 200, "width": 400, "height": 250, "page_width": 612, "page_height": 792}'::jsonb,
    '[IMAGE: Aircraft emergency exits diagram]',
    0.85,
    'unstructured',
    'completed',
    NOW() - INTERVAL '2 days'
);

-- Insert sample processing jobs
INSERT INTO processing_jobs (
    id,
    document_id,
    status,
    strategy,
    started_at,
    completed_at,
    progress,
    total_zones,
    completed_zones,
    failed_zones,
    options,
    created_at
) VALUES 
(
    '770e8400-e29b-41d4-a716-446655440001',
    '550e8400-e29b-41d4-a716-446655440001',
    'completed',
    'balanced',
    NOW() - INTERVAL '2 days' + INTERVAL '5 minutes',
    NOW() - INTERVAL '2 days' + INTERVAL '15 minutes',
    100.0,
    4,
    4,
    0,
    '{"tools": ["unstructured"], "quality": "high"}'::jsonb,
    NOW() - INTERVAL '2 days'
),
(
    '770e8400-e29b-41d4-a716-446655440002',
    '550e8400-e29b-41d4-a716-446655440002',
    'processing',
    'auto',
    NOW() - INTERVAL '1 day' + INTERVAL '2 hours',
    NULL,
    65.0,
    8,
    5,
    1,
    '{"tools": ["unstructured", "layoutlm"]}'::jsonb,
    NOW() - INTERVAL '1 day'
);

-- Insert sample export records
INSERT INTO export_records (
    id,
    document_id,
    export_type,
    formats,
    status,
    started_at,
    completed_at,
    file_paths,
    file_sizes,
    validation_results,
    options,
    expires_at,
    created_at
) VALUES 
(
    '880e8400-e29b-41d4-a716-446655440001',
    '550e8400-e29b-41d4-a716-446655440001',
    'full',
    ARRAY['json', 'csv', 'txt']::export_format[],
    'completed',
    NOW() - INTERVAL '1 day',
    NOW() - INTERVAL '1 day' + INTERVAL '30 seconds',
    '{"json": "exports/880e8400-e29b-41d4-a716-446655440001.json", "csv": "exports/880e8400-e29b-41d4-a716-446655440001.csv", "txt": "exports/880e8400-e29b-41d4-a716-446655440001.txt"}'::jsonb,
    '{"json": 2048, "csv": 1536, "txt": 1024}'::jsonb,
    '{"is_valid": true, "score": 95.5, "errors": [], "warnings": ["Minor formatting inconsistencies"]}'::jsonb,
    '{"include_confidence": true, "include_timestamps": true}'::jsonb,
    NOW() + INTERVAL '6 days',
    NOW() - INTERVAL '1 day'
);

-- Insert sample processing history
INSERT INTO processing_history (
    id,
    job_id,
    zone_id,
    action,
    status,
    details,
    duration_ms,
    created_at
) VALUES 
(
    '990e8400-e29b-41d4-a716-446655440001',
    '770e8400-e29b-41d4-a716-446655440001',
    '660e8400-e29b-41d4-a716-446655440001',
    'zone_processing_started',
    'success',
    '{"tool": "unstructured", "zone_type": "header"}'::jsonb,
    250,
    NOW() - INTERVAL '2 days' + INTERVAL '5 minutes'
),
(
    '990e8400-e29b-41d4-a716-446655440002',
    '770e8400-e29b-41d4-a716-446655440001',
    '660e8400-e29b-41d4-a716-446655440001',
    'zone_processing_completed',
    'success',
    '{"tool": "unstructured", "confidence": 0.95, "content_length": 20}'::jsonb,
    2500,
    NOW() - INTERVAL '2 days' + INTERVAL '5 minutes' + INTERVAL '2.5 seconds'
);

-- Insert sample user corrections
INSERT INTO user_corrections (
    id,
    zone_id,
    original_content,
    corrected_content,
    confidence_before,
    confidence_after,
    correction_type,
    corrected_by,
    created_at
) VALUES 
(
    'aa0e8400-e29b-41d4-a716-446655440001',
    '660e8400-e29b-41d4-a716-446655440002',
    'This manual provides comprehensive guidelines for aviation safety procedures and protocols. It covers emergency procedures, maintenance requirements, and operational standards.',
    'This manual provides comprehensive guidelines for aviation safety procedures and protocols. It covers emergency procedures, maintenance requirements, and operational standards for commercial aviation.',
    0.92,
    1.0,
    'content_enhancement',
    'demo@example.com',
    NOW() - INTERVAL '1 day'
);

-- Insert sample zone confidence history
INSERT INTO zone_confidence_history (
    id,
    zone_id,
    confidence,
    processing_tool,
    recorded_at
) VALUES 
(
    'bb0e8400-e29b-41d4-a716-446655440001',
    '660e8400-e29b-41d4-a716-446655440001',
    0.95,
    'unstructured',
    NOW() - INTERVAL '2 days' + INTERVAL '5 minutes'
),
(
    'bb0e8400-e29b-41d4-a716-446655440002',
    '660e8400-e29b-41d4-a716-446655440002',
    0.92,
    'unstructured',
    NOW() - INTERVAL '2 days' + INTERVAL '6 minutes'
),
(
    'bb0e8400-e29b-41d4-a716-446655440003',
    '660e8400-e29b-41d4-a716-446655440002',
    0.94,
    'layoutlm',
    NOW() - INTERVAL '1 day'
);

-- Refresh materialized view with sample data
REFRESH MATERIALIZED VIEW document_analytics; 