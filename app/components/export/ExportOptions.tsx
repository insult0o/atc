import React from 'react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Info } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface ExportOptionsProps {
  options: {
    includeConfidence: boolean;
    includeTimestamps: boolean;
    includeMetadata: boolean;
    includeCoordinates: boolean;
    mergeTextZones: boolean;
    normalizeWhitespace: boolean;
  };
  onChange: (options: any) => void;
}

export const ExportOptions: React.FC<ExportOptionsProps> = ({
  options,
  onChange
}) => {
  const handleToggle = (key: string) => {
    onChange({
      ...options,
      [key]: !options[key as keyof typeof options]
    });
  };

  const optionConfigs = [
    {
      key: 'includeConfidence',
      label: 'Include Confidence Scores',
      description: 'Add confidence scores for each extracted zone',
      enabled: true
    },
    {
      key: 'includeTimestamps',
      label: 'Include Timestamps',
      description: 'Add creation and modification timestamps',
      enabled: true
    },
    {
      key: 'includeMetadata',
      label: 'Include Metadata',
      description: 'Include zone metadata and processing information',
      enabled: true
    },
    {
      key: 'includeCoordinates',
      label: 'Include Coordinates',
      description: 'Add bounding box coordinates for each zone',
      enabled: true
    },
    {
      key: 'mergeTextZones',
      label: 'Merge Text Zones',
      description: 'Combine adjacent text zones into larger blocks',
      enabled: true
    },
    {
      key: 'normalizeWhitespace',
      label: 'Normalize Whitespace',
      description: 'Clean up extra spaces and formatting',
      enabled: true
    }
  ];

  return (
    <TooltipProvider>
      <div className="space-y-4">
        <h3 className="text-sm font-medium">Export Options</h3>
        <div className="space-y-3">
          {optionConfigs.map((config) => (
            <div 
              key={config.key}
              className="flex items-center justify-between space-x-2"
            >
              <div className="flex items-center space-x-2 flex-1">
                <Switch
                  id={config.key}
                  checked={options[config.key as keyof typeof options]}
                  onCheckedChange={() => handleToggle(config.key)}
                  disabled={!config.enabled}
                  data-testid={`option-${config.key}`}
                />
                <Label 
                  htmlFor={config.key}
                  className={`flex-1 ${!config.enabled ? 'opacity-50' : ''}`}
                >
                  {config.label}
                </Label>
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="w-4 h-4 text-gray-400 cursor-help" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-sm">{config.description}</p>
                </TooltipContent>
              </Tooltip>
            </div>
          ))}
        </div>
      </div>
    </TooltipProvider>
  );
};