'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { SelectionPanel, ExportSelection } from './SelectionPanel';
import { ExportPreview } from './ExportPreview';
import { ValidationPanel } from './ValidationPanel';
import { ExportOptions } from './ExportOptions';
import { exportAPI } from '@/lib/api/export';
import type { Zone } from '@/lib/types/zone';
import {
  Download,
  FileText,
  FileJson,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle,
  Loader2,
  Eye,
  Settings
} from 'lucide-react';

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentId: string;
  zones: Zone[];
  pages: number[];
}

interface ExportFormat {
  id: string;
  name: string;
  icon: React.ReactNode;
  description: string;
  available: boolean;
}

const EXPORT_FORMATS: ExportFormat[] = [
  {
    id: 'json',
    name: 'JSON',
    icon: <FileJson className="w-4 h-4" />,
    description: 'Structured data with full metadata',
    available: true
  },
  {
    id: 'jsonl',
    name: 'JSONL (RAG)',
    icon: <FileJson className="w-4 h-4" />,
    description: 'One JSON object per line, optimized for RAG systems',
    available: true
  },
  {
    id: 'csv',
    name: 'CSV',
    icon: <FileSpreadsheet className="w-4 h-4" />,
    description: 'Tabular format for spreadsheets',
    available: true
  },
  {
    id: 'txt',
    name: 'Plain Text',
    icon: <FileText className="w-4 h-4" />,
    description: 'Simple text format',
    available: true
  },
  {
    id: 'markdown',
    name: 'Markdown',
    icon: <FileText className="w-4 h-4" />,
    description: 'Formatted text with structure',
    available: true
  }
];

export const ExportDialog: React.FC<ExportDialogProps> = ({
  open,
  onOpenChange,
  documentId,
  zones,
  pages
}) => {
  const [activeTab, setActiveTab] = useState('selection');
  const [selection, setSelection] = useState<ExportSelection>({
    type: 'all',
    zoneIds: new Set(zones.map(z => z.id)),
    pageNumbers: new Set(pages),
    totalCount: zones.length
  });
  const [selectedFormats, setSelectedFormats] = useState<Set<string>>(new Set(['json']));
  const [exportOptions, setExportOptions] = useState({
    includeConfidence: true,
    includeTimestamps: true,
    includeMetadata: true,
    includeCoordinates: false,
    mergeTextZones: false,
    normalizeWhitespace: false
  });
  const [exportId, setExportId] = useState<string | null>(null);

  // Preview query
  const { data: preview, isLoading: previewLoading, error: previewError } = useQuery({
    queryKey: ['export-preview', documentId, selection, selectedFormats, exportOptions],
    queryFn: async () => {
      return await exportAPI.previewExport({
        document_id: documentId,
        export_type: selection.type === 'all' ? 'full' : 'partial',
        formats: Array.from(selectedFormats) as any[],
        selection: selection.type !== 'all' ? {
          zone_ids: Array.from(selection.zoneIds),
          page_ranges: selection.type === 'pages' ? 
            Array.from(selection.pageNumbers).map(p => [p, p]) : undefined
        } : undefined,
        options: exportOptions
      });
    },
    enabled: open && selectedFormats.size > 0,
    staleTime: 30000 // Cache for 30 seconds
  });

  // Validation query
  const { data: validation, isLoading: validationLoading } = useQuery({
    queryKey: ['export-validation', documentId, selection, selectedFormats],
    queryFn: async () => {
      return await exportAPI.validateExport({
        document_id: documentId,
        export_type: selection.type === 'all' ? 'full' : 'partial',
        formats: Array.from(selectedFormats) as any[],
        selection: selection.type !== 'all' ? {
          zone_ids: Array.from(selection.zoneIds)
        } : undefined,
        options: exportOptions
      });
    },
    enabled: open && activeTab === 'validation'
  });

  // Generate export mutation
  const generateMutation = useMutation({
    mutationFn: async () => {
      return await exportAPI.generateExport({
        document_id: documentId,
        export_type: selection.type === 'all' ? 'full' : 'partial',
        formats: Array.from(selectedFormats) as any[],
        selection: selection.type !== 'all' ? {
          zone_ids: Array.from(selection.zoneIds),
          page_ranges: selection.type === 'pages' ? 
            Array.from(selection.pageNumbers).map(p => [p, p]) : undefined
        } : undefined,
        options: exportOptions
      });
    },
    onSuccess: (data) => {
      setExportId(data.export_record?.id || data.id);
      // Start polling for export status
      pollExportStatus(data.export_record?.id || data.id);
    }
  });

  // Export status query
  const { data: exportStatus, refetch: refetchStatus } = useQuery({
    queryKey: ['export-status', exportId],
    queryFn: async () => {
      if (!exportId) return null;
      return await exportAPI.getExportStatus(exportId);
    },
    enabled: !!exportId,
    refetchInterval: (data) => {
      // Stop polling when export is complete or failed
      if (data?.status === 'completed' || data?.status === 'failed') {
        return false;
      }
      return 1000; // Poll every second
    }
  });

  // Poll export status
  const pollExportStatus = useCallback(async (id: string) => {
    // Polling is handled by react-query's refetchInterval
  }, []);

  // Download export
  const downloadExport = useCallback(async (format: string) => {
    if (!exportId || !exportStatus || exportStatus.status !== 'completed') return;

    try {
      const blob = await exportAPI.downloadExport(
        exportId, 
        format,
        `export-${documentId}-${format}.${format}`
      );

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `export-${documentId}-${format}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download failed:', error);
    }
  }, [exportId, exportStatus, documentId]);

  // Handle format selection
  const handleFormatToggle = useCallback((formatId: string) => {
    const newFormats = new Set(selectedFormats);
    if (newFormats.has(formatId)) {
      newFormats.delete(formatId);
    } else {
      newFormats.add(formatId);
    }
    setSelectedFormats(newFormats);
  }, [selectedFormats]);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setActiveTab('selection');
      setExportId(null);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
        data-testid="export-dialog"
      >
        <DialogHeader>
          <DialogTitle>Export Document</DialogTitle>
          <DialogDescription>
            Configure and generate exports for your document
          </DialogDescription>
        </DialogHeader>

        <Tabs 
          value={activeTab} 
          onValueChange={setActiveTab}
          className="flex-1 flex flex-col overflow-hidden"
        >
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="selection" data-testid="tab-selection">
              Selection
            </TabsTrigger>
            <TabsTrigger value="formats" data-testid="tab-formats">
              Formats
            </TabsTrigger>
            <TabsTrigger value="preview" data-testid="tab-preview">
              Preview
            </TabsTrigger>
            <TabsTrigger value="validation" data-testid="tab-validation">
              Validation
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto mt-4">
            <TabsContent value="selection" className="h-full">
              <SelectionPanel
                zones={zones}
                pages={pages}
                onSelectionChange={setSelection}
                initialSelection={selection}
              />
            </TabsContent>

            <TabsContent value="formats" className="space-y-4">
              <div className="space-y-2">
                <h3 className="text-sm font-medium">Select Export Formats</h3>
                <div className="grid grid-cols-2 gap-3">
                  {EXPORT_FORMATS.map((format) => (
                    <div
                      key={format.id}
                      onClick={() => format.available && handleFormatToggle(format.id)}
                      className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                        selectedFormats.has(format.id)
                          ? 'border-blue-500 bg-blue-50'
                          : format.available
                          ? 'hover:bg-gray-50'
                          : 'opacity-50 cursor-not-allowed'
                      }`}
                      data-testid={`format-${format.id}`}
                    >
                      <div className="flex items-start gap-3">
                        {format.icon}
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{format.name}</span>
                            {selectedFormats.has(format.id) && (
                              <CheckCircle className="w-4 h-4 text-blue-500" />
                            )}
                          </div>
                          <p className="text-sm text-gray-600 mt-1">
                            {format.description}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t">
                <ExportOptions
                  options={exportOptions}
                  onChange={setExportOptions}
                />
              </div>
            </TabsContent>

            <TabsContent value="preview" className="h-full">
              {previewLoading ? (
                <div className="flex items-center justify-center h-64">
                  <Loader2 className="w-6 h-6 animate-spin" />
                </div>
              ) : previewError ? (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Failed to generate preview. Please try again.
                  </AlertDescription>
                </Alert>
              ) : preview ? (
                <ExportPreview
                  preview={preview}
                  selectedFormats={Array.from(selectedFormats)}
                />
              ) : null}
            </TabsContent>

            <TabsContent value="validation" className="h-full">
              {validationLoading ? (
                <div className="flex items-center justify-center h-64">
                  <Loader2 className="w-6 h-6 animate-spin" />
                </div>
              ) : validation ? (
                <ValidationPanel validation={validation} />
              ) : null}
            </TabsContent>
          </div>
        </Tabs>

        <DialogFooter className="border-t pt-4">
          {!exportId ? (
            <>
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                data-testid="cancel-button"
              >
                Cancel
              </Button>
              <Button
                onClick={() => generateMutation.mutate()}
                disabled={selectedFormats.size === 0 || generateMutation.isPending}
                data-testid="generate-button"
              >
                {generateMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 mr-2" />
                    Generate Export
                  </>
                )}
              </Button>
            </>
          ) : (
            <div className="w-full">
              {exportStatus?.status === 'processing' && (
                <div className="mb-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm">Processing export...</span>
                    <span className="text-sm text-gray-600">
                      {Math.round((exportStatus.progress || 0) * 100)}%
                    </span>
                  </div>
                  <Progress value={(exportStatus.progress || 0) * 100} />
                </div>
              )}

              {exportStatus?.status === 'completed' && (
                <div className="space-y-3">
                  <Alert>
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <AlertDescription>
                      Export completed successfully!
                    </AlertDescription>
                  </Alert>

                  <div className="grid grid-cols-2 gap-2">
                    {Array.from(selectedFormats).map((format) => (
                      <Button
                        key={format}
                        variant="outline"
                        size="sm"
                        onClick={() => downloadExport(format)}
                        data-testid={`download-${format}`}
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Download {format.toUpperCase()}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {exportStatus?.status === 'failed' && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Export failed: {exportStatus.error_message || 'Unknown error'}
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};