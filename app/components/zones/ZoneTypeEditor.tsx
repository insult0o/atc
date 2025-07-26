'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { Zone, ProcessingTool } from './ZoneManager';
import { 
  FileText, 
  Table, 
  Image, 
  BarChart, 
  Hash, 
  AlignLeft,
  Settings,
  RefreshCw,
  AlertCircle,
  Check,
  ChevronDown
} from 'lucide-react';
import { Button } from '../../../components/ui/button';

export interface ZoneTypeEditorProps {
  zone: Zone;
  availableTools: ProcessingTool[];
  onZoneUpdate: (zoneId: string, updates: Partial<Zone>) => void;
  onReprocess?: (zoneId: string, newType: Zone['contentType']) => void;
  customTypes?: CustomZoneType[];
  disabled?: boolean;
}

export interface CustomZoneType {
  id: string;
  name: string;
  displayName: string;
  icon?: React.ReactNode;
  properties: ZoneTypeProperty[];
  validators: ZoneTypeValidator[];
}

export interface ZoneTypeProperty {
  key: string;
  label: string;
  type: 'text' | 'number' | 'boolean' | 'select' | 'color';
  defaultValue?: any;
  options?: Array<{ value: string; label: string }>;
  required?: boolean;
}

export interface ZoneTypeValidator {
  property: string;
  rule: 'required' | 'min' | 'max' | 'pattern' | 'custom';
  value?: any;
  message: string;
  validate?: (value: any) => boolean;
}

interface TypeEditorState {
  isOpen: boolean;
  selectedType: Zone['contentType'] | string;
  customProperties: Record<string, any>;
  isProcessing: boolean;
  validationErrors: Record<string, string>;
}

const DEFAULT_ZONE_TYPES: Array<{
  type: Zone['contentType'];
  displayName: string;
  icon: React.ReactNode;
  description: string;
  color: string;
}> = [
  {
    type: 'text',
    displayName: 'Text',
    icon: <FileText className="w-4 h-4" />,
    description: 'Standard text content',
    color: 'bg-green-100 text-green-800'
  },
  {
    type: 'table',
    displayName: 'Table',
    icon: <Table className="w-4 h-4" />,
    description: 'Structured tabular data',
    color: 'bg-purple-100 text-purple-800'
  },
  {
    type: 'diagram',
    displayName: 'Diagram',
    icon: <BarChart className="w-4 h-4" />,
    description: 'Charts, graphs, and diagrams',
    color: 'bg-orange-100 text-orange-800'
  },
  {
    type: 'mixed',
    displayName: 'Mixed',
    icon: <AlignLeft className="w-4 h-4" />,
    description: 'Multiple content types',
    color: 'bg-gray-100 text-gray-800'
  },
  {
    type: 'header',
    displayName: 'Header',
    icon: <Hash className="w-4 h-4" />,
    description: 'Document header or title',
    color: 'bg-blue-100 text-blue-800'
  },
  {
    type: 'footer',
    displayName: 'Footer',
    icon: <Hash className="w-4 h-4" style={{ transform: 'rotate(180deg)' }} />,
    description: 'Document footer',
    color: 'bg-red-100 text-red-800'
  }
];

export function ZoneTypeEditor({
  zone,
  availableTools,
  onZoneUpdate,
  onReprocess,
  customTypes = [],
  disabled = false
}: ZoneTypeEditorProps) {
  const [state, setState] = useState<TypeEditorState>({
    isOpen: false,
    selectedType: zone.contentType,
    customProperties: {},
    isProcessing: false,
    validationErrors: {}
  });

  // Get all available types (default + custom)
  const allTypes = [
    ...DEFAULT_ZONE_TYPES,
    ...customTypes.map(ct => ({
      type: ct.id,
      displayName: ct.displayName,
      icon: ct.icon || <Settings className="w-4 h-4" />,
      description: ct.name,
      color: 'bg-indigo-100 text-indigo-800'
    }))
  ];

  // Find current type info
  const currentTypeInfo = allTypes.find(t => t.type === zone.contentType) || allTypes[0];

  // Get custom type definition if applicable
  const customType = customTypes.find(ct => ct.id === zone.contentType);

  // Validate custom properties
  const validateProperties = useCallback((properties: Record<string, any>): Record<string, string> => {
    const errors: Record<string, string> = {};

    if (!customType) return errors;

    customType.validators.forEach(validator => {
      const value = properties[validator.property];

      switch (validator.rule) {
        case 'required':
          if (!value || value === '') {
            errors[validator.property] = validator.message;
          }
          break;
        case 'min':
          if (typeof value === 'number' && value < validator.value) {
            errors[validator.property] = validator.message;
          }
          break;
        case 'max':
          if (typeof value === 'number' && value > validator.value) {
            errors[validator.property] = validator.message;
          }
          break;
        case 'pattern':
          if (typeof value === 'string' && !new RegExp(validator.value).test(value)) {
            errors[validator.property] = validator.message;
          }
          break;
        case 'custom':
          if (validator.validate && !validator.validate(value)) {
            errors[validator.property] = validator.message;
          }
          break;
      }
    });

    return errors;
  }, [customType]);

  // Handle type change
  const handleTypeChange = useCallback(async (newType: string) => {
    setState(prev => ({ ...prev, selectedType: newType }));

    // Initialize custom properties if switching to custom type
    const newCustomType = customTypes.find(ct => ct.id === newType);
    if (newCustomType) {
      const defaultProps: Record<string, any> = {};
      newCustomType.properties.forEach(prop => {
        defaultProps[prop.key] = prop.defaultValue || '';
      });
      setState(prev => ({ ...prev, customProperties: defaultProps }));
    }
  }, [customTypes]);

  // Apply type change
  const applyTypeChange = useCallback(async () => {
    if (state.selectedType === zone.contentType && Object.keys(state.customProperties).length === 0) {
      setState(prev => ({ ...prev, isOpen: false }));
      return;
    }

    // Validate custom properties
    const errors = validateProperties(state.customProperties);
    if (Object.keys(errors).length > 0) {
      setState(prev => ({ ...prev, validationErrors: errors }));
      return;
    }

    setState(prev => ({ ...prev, isProcessing: true }));

    try {
      // Update zone type
      const updates: Partial<Zone> = {
        contentType: state.selectedType as Zone['contentType'],
        userModified: true,
        lastModified: new Date()
      };

      // Add custom properties if applicable
      if (customType && Object.keys(state.customProperties).length > 0) {
        updates.characteristics = {
          ...zone.characteristics,
          customProperties: state.customProperties
        };
      }

      onZoneUpdate(zone.id, updates);

      // Trigger reprocessing if requested
      if (onReprocess && state.selectedType !== zone.contentType) {
        await onReprocess(zone.id, state.selectedType as Zone['contentType']);
      }

      setState(prev => ({
        ...prev,
        isOpen: false,
        isProcessing: false,
        validationErrors: {}
      }));
    } catch (error) {
      console.error('Failed to update zone type:', error);
      setState(prev => ({
        ...prev,
        isProcessing: false,
        validationErrors: { _error: 'Failed to update zone type' }
      }));
    }
  }, [state, zone, customType, validateProperties, onZoneUpdate, onReprocess]);

  // Handle custom property change
  const handlePropertyChange = useCallback((key: string, value: any) => {
    setState(prev => ({
      ...prev,
      customProperties: {
        ...prev.customProperties,
        [key]: value
      },
      validationErrors: {
        ...prev.validationErrors,
        [key]: '' // Clear error for this field
      }
    }));
  }, []);

  // Get recommended tools for the selected type
  const getRecommendedTools = (type: string): ProcessingTool[] => {
    return availableTools.filter(tool => 
      tool.supportedTypes.includes(type) || 
      tool.supportedTypes.includes('all')
    ).sort((a, b) => b.accuracy - a.accuracy);
  };

  const recommendedTools = getRecommendedTools(state.selectedType);

  return (
    <div className="zone-type-editor">
      {/* Current type display */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-gray-600">Type:</span>
        <button
          className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors ${
            currentTypeInfo.color
          } ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-80 cursor-pointer'}`}
          onClick={() => !disabled && setState(prev => ({ ...prev, isOpen: !prev.isOpen }))}
          disabled={disabled}
        >
          {currentTypeInfo.icon}
          {currentTypeInfo.displayName}
          <ChevronDown className={`w-3 h-3 transition-transform ${state.isOpen ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* Type selector dropdown */}
      {state.isOpen && !disabled && (
        <div className="absolute z-50 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 w-80 max-h-96 overflow-auto">
          <div className="p-4">
            <h3 className="text-sm font-semibold mb-3">Select Zone Type</h3>
            
            {/* Type options */}
            <div className="space-y-2 mb-4">
              {allTypes.map(typeOption => (
                <button
                  key={typeOption.type}
                  className={`w-full flex items-start gap-3 p-3 rounded-lg border transition-all ${
                    state.selectedType === typeOption.type
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => handleTypeChange(typeOption.type)}
                >
                  <div className={`p-2 rounded-md ${typeOption.color}`}>
                    {typeOption.icon}
                  </div>
                  <div className="flex-1 text-left">
                    <div className="font-medium text-sm">{typeOption.displayName}</div>
                    <div className="text-xs text-gray-600">{typeOption.description}</div>
                  </div>
                  {state.selectedType === typeOption.type && (
                    <Check className="w-4 h-4 text-blue-500 mt-1" />
                  )}
                </button>
              ))}
            </div>

            {/* Custom properties */}
            {customType && state.selectedType === customType.id && (
              <div className="border-t pt-4">
                <h4 className="text-sm font-medium mb-3">Properties</h4>
                <div className="space-y-3">
                  {customType.properties.map(prop => (
                    <div key={prop.key}>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        {prop.label}
                        {prop.required && <span className="text-red-500 ml-1">*</span>}
                      </label>
                      {prop.type === 'text' && (
                        <input
                          type="text"
                          value={state.customProperties[prop.key] || ''}
                          onChange={(e) => handlePropertyChange(prop.key, e.target.value)}
                          className={`w-full px-2 py-1 text-sm border rounded ${
                            state.validationErrors[prop.key] ? 'border-red-500' : 'border-gray-300'
                          }`}
                        />
                      )}
                      {prop.type === 'number' && (
                        <input
                          type="number"
                          value={state.customProperties[prop.key] || 0}
                          onChange={(e) => handlePropertyChange(prop.key, parseFloat(e.target.value))}
                          className={`w-full px-2 py-1 text-sm border rounded ${
                            state.validationErrors[prop.key] ? 'border-red-500' : 'border-gray-300'
                          }`}
                        />
                      )}
                      {prop.type === 'boolean' && (
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={state.customProperties[prop.key] || false}
                            onChange={(e) => handlePropertyChange(prop.key, e.target.checked)}
                            className="rounded"
                          />
                          <span className="text-sm">{prop.label}</span>
                        </label>
                      )}
                      {prop.type === 'select' && (
                        <select
                          value={state.customProperties[prop.key] || ''}
                          onChange={(e) => handlePropertyChange(prop.key, e.target.value)}
                          className={`w-full px-2 py-1 text-sm border rounded ${
                            state.validationErrors[prop.key] ? 'border-red-500' : 'border-gray-300'
                          }`}
                        >
                          <option value="">Select...</option>
                          {prop.options?.map(opt => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      )}
                      {state.validationErrors[prop.key] && (
                        <p className="text-xs text-red-500 mt-1">{state.validationErrors[prop.key]}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recommended tools */}
            {recommendedTools.length > 0 && (
              <div className="border-t pt-4">
                <h4 className="text-sm font-medium mb-2">Recommended Tools</h4>
                <div className="space-y-1">
                  {recommendedTools.slice(0, 3).map(tool => (
                    <div key={tool.name} className="flex items-center justify-between text-xs">
                      <span>{tool.displayName}</span>
                      <span className="text-gray-500">
                        {Math.round(tool.accuracy * 100)}% accuracy
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-2 mt-4 pt-4 border-t">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setState(prev => ({ ...prev, isOpen: false }))}
                disabled={state.isProcessing}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={applyTypeChange}
                disabled={state.isProcessing}
                className="flex-1"
              >
                {state.isProcessing ? (
                  <>
                    <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Check className="w-3 h-3 mr-1" />
                    Apply Changes
                  </>
                )}
              </Button>
            </div>

            {/* Warning if type change will trigger reprocessing */}
            {onReprocess && state.selectedType !== zone.contentType && (
              <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs">
                <div className="flex gap-2">
                  <AlertCircle className="w-4 h-4 text-yellow-600 flex-shrink-0" />
                  <p className="text-yellow-800">
                    Changing the zone type will trigger content reprocessing.
                    This may take a few moments.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Processing indicator */}
      {zone.status === 'processing' && (
        <div className="mt-2 flex items-center gap-2 text-xs text-gray-600">
          <RefreshCw className="w-3 h-3 animate-spin" />
          Processing zone...
        </div>
      )}
    </div>
  );
}

export default ZoneTypeEditor;