export interface Zone {
    id: string;
    page: number;
    coordinates: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
    content: string;
    confidence: number;
    type: 'text' | 'table' | 'diagram';
    status: 'processing' | 'completed' | 'error' | 'manual_override';
    tool: string;
    lastUpdated: Date;
}
export interface ProcessingStatus {
    totalZones: number;
    completedZones: number;
    currentlyProcessing: string[];
    estimatedTimeRemaining: number;
}
export interface Document {
    id: string;
    name: string;
    filePath: string;
    fileSize: number;
    pageCount: number;
    status: 'uploaded' | 'processing' | 'completed' | 'error';
    createdAt: Date;
    updatedAt: Date;
}
export interface ProcessingTool {
    name: string;
    supportedTypes: string[];
    priority: number;
    estimatedTime: number;
}
export type RealtimeEvents = 'zone_detected' | 'zone_processing_started' | 'zone_processing_progress' | 'zone_processing_completed' | 'zone_manual_override' | 'document_export_ready' | 'system_error';
export interface WebSocketMessage {
    type: RealtimeEvents;
    payload: any;
    timestamp: Date;
}
export interface CreateZoneRequest {
    page: number;
    coordinates: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
    type: 'text' | 'table' | 'diagram';
}
export interface UploadRequest {
    file: File;
    options: ProcessingOptions;
}
export interface ProcessingOptions {
    autoProcess?: boolean;
    confidenceThreshold?: number;
    preferredTools?: string[];
}
export interface DocumentResponse {
    document: Document;
    zones: Zone[];
    processingStatus: ProcessingStatus;
}
export interface ZoneUpdateRequest {
    content?: string;
    reprocess?: boolean;
    tool?: string;
}
export interface ExportFormat {
    type: 'rag_chunks' | 'fine_tune' | 'corrections' | 'zone_manifest' | 'export_log';
    options?: Record<string, any>;
}
export interface ExportRequest {
    formats: ExportFormat[];
    includeZones?: string[];
    options: ExportOptions;
}
export interface ExportOptions {
    includeMetadata?: boolean;
    filterConfidence?: number;
    customFields?: string[];
}
export interface PDFViewerProps {
    pdfUrl: string;
    zones: Zone[];
    selectedZone?: string;
    onZoneSelect: (zoneId: string) => void;
    onZoneCreate: (zone: CreateZoneRequest) => void;
    confidenceThreshold: number;
}
export interface DualPaneManagerProps {
    leftPanel: React.ComponentType;
    rightPanel: React.ComponentType;
    syncScrolling: boolean;
    splitRatio: number;
    onSplitChange: (ratio: number) => void;
}
export interface SyncState {
    leftScroll: number;
    rightScroll: number;
    zoom: number;
    page: number;
}
export interface ZoneEditorProps {
    zone: Zone;
    onContentUpdate: (zoneId: string, content: string) => void;
    onReprocess: (zoneId: string, tool?: string) => void;
    onRevert: (zoneId: string) => void;
    availableTools: ProcessingTool[];
    isEditing: boolean;
}
export interface DocumentState {
    document: Document | null;
    zones: Zone[];
    processing: ProcessingStatus;
    error: string | null;
}
export interface WebSocketState {
    connected: boolean;
    reconnecting: boolean;
    lastMessage: WebSocketMessage | null;
}
