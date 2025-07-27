import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  FileJson, 
  FileSpreadsheet, 
  FileText,
  Copy,
  Check
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ExportPreviewProps {
  preview: {
    document_id: string;
    document_name: string;
    total_zones: number;
    preview_zones: number;
    formats: string[];
    previews: Record<string, any>;
    estimated_sizes: Record<string, string>;
    export_options: any;
  };
  selectedFormats: string[];
}

export const ExportPreview: React.FC<ExportPreviewProps> = ({
  preview,
  selectedFormats
}) => {
  const [copiedFormat, setCopiedFormat] = useState<string | null>(null);

  const getFormatIcon = (format: string) => {
    switch (format) {
      case 'json':
      case 'jsonl':
        return <FileJson className="w-4 h-4" />;
      case 'csv':
        return <FileSpreadsheet className="w-4 h-4" />;
      case 'txt':
      case 'markdown':
        return <FileText className="w-4 h-4" />;
      default:
        return <FileText className="w-4 h-4" />;
    }
  };

  const copyToClipboard = async (content: string, format: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedFormat(format);
      setTimeout(() => setCopiedFormat(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const formatPreviewContent = (format: string, data: any): string => {
    switch (format) {
      case 'json':
        return JSON.stringify(data, null, 2);
      
      case 'jsonl':
        if (Array.isArray(data)) {
          return data.join('\n');
        }
        return JSON.stringify(data);
      
      case 'csv':
        if (Array.isArray(data) && data.length > 0) {
          return data.map(row => 
            Array.isArray(row) ? row.join(',') : row
          ).join('\n');
        }
        return '';
      
      case 'txt':
      case 'markdown':
        return typeof data === 'string' ? data : JSON.stringify(data, null, 2);
      
      default:
        return JSON.stringify(data, null, 2);
    }
  };

  return (
    <div className="space-y-4">
      {/* Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Export Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Document:</span>
              <p className="font-medium">{preview.document_name}</p>
            </div>
            <div>
              <span className="text-gray-600">Total Zones:</span>
              <p className="font-medium">{preview.total_zones}</p>
            </div>
            <div>
              <span className="text-gray-600">Preview Zones:</span>
              <p className="font-medium">{preview.preview_zones}</p>
            </div>
            <div>
              <span className="text-gray-600">Formats:</span>
              <div className="flex gap-1 mt-1">
                {selectedFormats.map(format => (
                  <Badge key={format} variant="secondary" className="text-xs">
                    {format.toUpperCase()}
                  </Badge>
                ))}
              </div>
            </div>
          </div>

          {/* Estimated Sizes */}
          <div className="mt-4 pt-4 border-t">
            <p className="text-sm text-gray-600 mb-2">Estimated File Sizes:</p>
            <div className="grid grid-cols-3 gap-2">
              {Object.entries(preview.estimated_sizes).map(([format, size]) => (
                <div 
                  key={format}
                  className="flex items-center gap-2 text-sm"
                >
                  {getFormatIcon(format)}
                  <span className="text-gray-700">{format.toUpperCase()}:</span>
                  <span className="font-medium">{size}</span>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Format Previews */}
      <Card className="flex-1">
        <CardHeader>
          <CardTitle className="text-base">Format Previews</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Tabs defaultValue={selectedFormats[0]} className="w-full">
            <TabsList className="w-full justify-start rounded-none border-b px-4">
              {selectedFormats.map(format => (
                <TabsTrigger 
                  key={format} 
                  value={format}
                  className="gap-2"
                  data-testid={`preview-tab-${format}`}
                >
                  {getFormatIcon(format)}
                  {format.toUpperCase()}
                </TabsTrigger>
              ))}
            </TabsList>

            {selectedFormats.map(format => {
              const previewData = preview.previews[format];
              const content = formatPreviewContent(format, previewData);

              return (
                <TabsContent 
                  key={format} 
                  value={format}
                  className="m-0"
                >
                  <div className="relative">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="absolute top-2 right-2 z-10"
                      onClick={() => copyToClipboard(content, format)}
                    >
                      {copiedFormat === format ? (
                        <>
                          <Check className="w-4 h-4 mr-1" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4 mr-1" />
                          Copy
                        </>
                      )}
                    </Button>

                    <ScrollArea className="h-[400px] w-full">
                      <pre className="p-4 text-sm font-mono bg-gray-50">
                        <code>{content}</code>
                      </pre>
                    </ScrollArea>
                  </div>
                </TabsContent>
              );
            })}
          </Tabs>
        </CardContent>
      </Card>

      {/* Options Summary */}
      {preview.export_options && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Export Options</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {Object.entries(preview.export_options).map(([key, value]) => (
                <div key={key} className="flex items-center gap-2">
                  <span className="text-gray-600">
                    {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}:
                  </span>
                  <Badge variant={value ? 'default' : 'secondary'} className="text-xs">
                    {value ? 'Yes' : 'No'}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};