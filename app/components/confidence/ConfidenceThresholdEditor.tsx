import React, { useState } from 'react';
import { ConfidenceVisualConfig } from './ConfidenceVisualizer';

export interface ConfidenceThresholdEditorProps {
  config: ConfidenceVisualConfig;
  onChange: (config: ConfidenceVisualConfig) => void;
  showPreview?: boolean;
}

export const ConfidenceThresholdEditor: React.FC<ConfidenceThresholdEditorProps> = ({
  config,
  onChange,
  showPreview = true
}) => {
  const [editingConfig, setEditingConfig] = useState(config);

  const handleThresholdChange = (level: 'high' | 'medium' | 'low', value: number) => {
    const newConfig = {
      ...editingConfig,
      [`${level}Confidence`]: {
        ...editingConfig[`${level}Confidence`],
        threshold: value / 100
      }
    };
    setEditingConfig(newConfig);
    onChange(newConfig);
  };

  const handleOpacityChange = (level: 'high' | 'medium' | 'low', value: number) => {
    const newConfig = {
      ...editingConfig,
      [`${level}Confidence`]: {
        ...editingConfig[`${level}Confidence`],
        opacity: value / 100
      }
    };
    setEditingConfig(newConfig);
    onChange(newConfig);
  };

  const handleColorChange = (level: 'high' | 'medium' | 'low', color: string) => {
    const newConfig = {
      ...editingConfig,
      [`${level}Confidence`]: {
        ...editingConfig[`${level}Confidence`],
        color
      }
    };
    setEditingConfig(newConfig);
    onChange(newConfig);
  };

  return (
    <div className="confidence-threshold-editor space-y-4">
      <h4 className="text-sm font-medium text-gray-700">Threshold Configuration</h4>
      
      {['high', 'medium', 'low'].map(level => {
        const configLevel = editingConfig[`${level}Confidence`];
        
        return (
          <div key={level} className="space-y-2 p-3 bg-gray-50 rounded">
            <h5 className="text-sm font-medium capitalize">{level} Confidence</h5>
            
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-gray-600">Threshold</label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={configLevel.threshold * 100}
                  onChange={(e) => handleThresholdChange(level as any, parseInt(e.target.value))}
                  className="w-full"
                />
                <span className="text-xs">{Math.round(configLevel.threshold * 100)}%</span>
              </div>
              
              <div>
                <label className="text-xs text-gray-600">Opacity</label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={configLevel.opacity * 100}
                  onChange={(e) => handleOpacityChange(level as any, parseInt(e.target.value))}
                  className="w-full"
                />
                <span className="text-xs">{Math.round(configLevel.opacity * 100)}%</span>
              </div>
            </div>
            
            <div>
              <label className="text-xs text-gray-600">Color</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={configLevel.color}
                  onChange={(e) => handleColorChange(level as any, e.target.value)}
                  className="w-8 h-8 rounded"
                />
                <span className="text-xs">{configLevel.color}</span>
              </div>
            </div>
            
            {showPreview && (
              <div
                className="mt-2 p-2 rounded border-2 text-center text-sm"
                style={{
                  backgroundColor: `${configLevel.color}20`,
                  borderColor: configLevel.color,
                  borderStyle: configLevel.borderStyle,
                  opacity: configLevel.opacity
                }}
              >
                Preview
              </div>
            )}
          </div>
        );
      })}
      
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={editingConfig.enableTransitions}
          onChange={(e) => {
            const newConfig = { ...editingConfig, enableTransitions: e.target.checked };
            setEditingConfig(newConfig);
            onChange(newConfig);
          }}
          className="rounded"
        />
        <label className="text-sm">Enable smooth transitions</label>
      </div>
    </div>
  );
};