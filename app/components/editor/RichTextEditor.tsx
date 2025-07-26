'use client';

import React, { useRef, useEffect, useState } from 'react';
import Editor from '@monaco-editor/react';
import { Button } from '../../../components/ui/button';
import { 
  Save, 
  Undo, 
  Redo, 
  Search, 
  Download,
  Copy,
  CheckCircle
} from 'lucide-react';
import type { ExtractedContent } from '../viewer/DualPaneViewer';

interface RichTextEditorProps {
  content: ExtractedContent[];
  onSave?: (content: string) => void;
  onExport?: (format: 'txt' | 'md' | 'json') => void;
  height?: string;
}

export function RichTextEditor({ 
  content, 
  onSave, 
  onExport,
  height = '100%' 
}: RichTextEditorProps) {
  const editorRef = useRef<any>(null);
  const [isModified, setIsModified] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [wordCount, setWordCount] = useState(0);
  
  // Combine all content into a single document
  const combinedContent = content
    .map(item => {
      const header = `=== Zone: ${item.zoneId} (Confidence: ${Math.round(item.confidence * 100)}%) ===\n`;
      return header + item.content;
    })
    .join('\n\n');
  
  const handleEditorDidMount = (editor: any, monaco: any) => {
    editorRef.current = editor;
    
    // Set up keyboard shortcuts
    editor.addAction({
      id: 'save-content',
      label: 'Save Content',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS],
      run: () => {
        handleSave();
      }
    });
    
    editor.addAction({
      id: 'find-replace',
      label: 'Find and Replace',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyH],
      run: () => {
        editor.trigger('', 'editor.action.startFindReplaceAction');
      }
    });
    
    // Track modifications
    editor.onDidChangeModelContent(() => {
      setIsModified(true);
      updateWordCount(editor.getValue());
    });
    
    // Initial word count
    updateWordCount(editor.getValue());
  };
  
  const updateWordCount = (text: string) => {
    const words = text.trim().split(/\s+/).filter(word => word.length > 0);
    setWordCount(words.length);
  };
  
  const handleSave = async () => {
    if (!editorRef.current || !isModified) return;
    
    setSaveStatus('saving');
    const content = editorRef.current.getValue();
    
    try {
      await onSave?.(content);
      setIsModified(false);
      setSaveStatus('saved');
      
      // Reset status after 2 seconds
      setTimeout(() => {
        setSaveStatus('idle');
      }, 2000);
    } catch (error) {
      console.error('Save failed:', error);
      setSaveStatus('idle');
    }
  };
  
  const handleExport = (format: 'txt' | 'md' | 'json') => {
    if (!editorRef.current) return;
    
    const content = editorRef.current.getValue();
    
    switch (format) {
      case 'txt':
        downloadFile(content, 'extracted-content.txt', 'text/plain');
        break;
      case 'md':
        const markdown = convertToMarkdown(content);
        downloadFile(markdown, 'extracted-content.md', 'text/markdown');
        break;
      case 'json':
        const jsonData = convertToJSON(content);
        downloadFile(jsonData, 'extracted-content.json', 'application/json');
        break;
    }
    
    onExport?.(format);
  };
  
  const convertToMarkdown = (text: string): string => {
    // Simple conversion - enhance as needed
    return text
      .replace(/=== Zone: (.+?) ===/g, '## $1')
      .replace(/\n{3,}/g, '\n\n');
  };
  
  const convertToJSON = (text: string): string => {
    const zones = text.split(/=== Zone: (.+?) ===/g).slice(1);
    const result: any[] = [];
    
    for (let i = 0; i < zones.length; i += 2) {
      const metadata = zones[i];
      const content = zones[i + 1]?.trim() || '';
      
      result.push({
        metadata,
        content
      });
    }
    
    return JSON.stringify(result, null, 2);
  };
  
  const downloadFile = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };
  
  return (
    <div className="rich-text-editor flex flex-col h-full bg-white rounded-lg shadow-sm">
      {/* Toolbar */}
      <div className="editor-toolbar flex items-center justify-between gap-2 p-3 border-b">
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => editorRef.current?.trigger('', 'undo')}
            title="Undo (Ctrl+Z)"
          >
            <Undo className="w-4 h-4" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => editorRef.current?.trigger('', 'redo')}
            title="Redo (Ctrl+Y)"
          >
            <Redo className="w-4 h-4" />
          </Button>
          
          <div className="w-px h-6 bg-gray-300 mx-1" />
          
          <Button
            size="sm"
            variant="outline"
            onClick={() => editorRef.current?.trigger('', 'actions.find')}
            title="Find (Ctrl+F)"
          >
            <Search className="w-4 h-4" />
          </Button>
          
          <div className="w-px h-6 bg-gray-300 mx-1" />
          
          <Button
            size="sm"
            variant={isModified ? "default" : "outline"}
            onClick={handleSave}
            disabled={!isModified || saveStatus === 'saving'}
            title="Save (Ctrl+S)"
          >
            {saveStatus === 'saving' ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
            ) : saveStatus === 'saved' ? (
              <CheckCircle className="w-4 h-4" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            <span className="ml-2">
              {saveStatus === 'saving' ? 'Saving...' : 
               saveStatus === 'saved' ? 'Saved' : 'Save'}
            </span>
          </Button>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="text-sm text-gray-600">
            {wordCount} words
          </div>
          
          <div className="w-px h-6 bg-gray-300 mx-1" />
          
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleExport('txt')}
            title="Export as Text"
          >
            <Download className="w-4 h-4 mr-1" />
            TXT
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleExport('md')}
            title="Export as Markdown"
          >
            <Download className="w-4 h-4 mr-1" />
            MD
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleExport('json')}
            title="Export as JSON"
          >
            <Download className="w-4 h-4 mr-1" />
            JSON
          </Button>
        </div>
      </div>
      
      {/* Editor */}
      <div className="flex-1 min-h-0">
        <Editor
          height={height}
          defaultLanguage="plaintext"
          defaultValue={combinedContent}
          theme="vs"
          options={{
            minimap: { enabled: true },
            fontSize: 14,
            wordWrap: 'on',
            lineNumbers: 'on',
            renderWhitespace: 'selection',
            scrollBeyondLastLine: false,
            automaticLayout: true,
            formatOnPaste: true,
            formatOnType: false,
            find: {
              addExtraSpaceOnTop: false,
              autoFindInSelection: 'multiline',
              seedSearchStringFromSelection: true
            }
          }}
          onMount={handleEditorDidMount}
        />
      </div>
      
      {/* Status bar */}
      <div className="editor-status-bar flex items-center justify-between px-4 py-2 text-xs text-gray-600 border-t bg-gray-50">
        <div className="flex items-center gap-4">
          <span>Plain Text</span>
          <span>UTF-8</span>
          {isModified && <span className="text-orange-600">● Modified</span>}
        </div>
        <div className="flex items-center gap-4">
          <span>Words: {wordCount}</span>
          <span>Characters: {editorRef.current?.getValue().length || 0}</span>
        </div>
      </div>
    </div>
  );
}