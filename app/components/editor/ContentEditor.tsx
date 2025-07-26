'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { 
  Bold, 
  Italic, 
  List, 
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Undo,
  Redo,
  Save,
  Check,
  AlertCircle,
  Loader2,
  Code,
  Table
} from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Zone } from '../zones/ZoneManager';

export interface ContentEditorProps {
  zone: Zone;
  content: string;
  onContentSave: (zoneId: string, content: string) => Promise<void>;
  onContentChange?: (zoneId: string, content: string) => void;
  autoSaveDelay?: number;
  enableRichText?: boolean;
  enableCollaboration?: boolean;
  collaborators?: Array<{ id: string; name: string; color: string; cursor?: number }>;
  disabled?: boolean;
}

interface EditorState {
  content: string;
  originalContent: string;
  hasChanges: boolean;
  isSaving: boolean;
  lastSaved: Date | null;
  saveError: string | null;
  selectedText: { start: number; end: number } | null;
  history: string[];
  historyIndex: number;
  isFormatting: boolean;
}

interface FormatAction {
  type: 'bold' | 'italic' | 'list' | 'ordered-list' | 'align' | 'code' | 'table';
  value?: string;
}

const AUTO_SAVE_DELAY = 2000; // 2 seconds

export function ContentEditor({
  zone,
  content: initialContent,
  onContentSave,
  onContentChange,
  autoSaveDelay = AUTO_SAVE_DELAY,
  enableRichText = true,
  enableCollaboration = false,
  collaborators = [],
  disabled = false
}: ContentEditorProps) {
  const [state, setState] = useState<EditorState>({
    content: initialContent,
    originalContent: initialContent,
    hasChanges: false,
    isSaving: false,
    lastSaved: null,
    saveError: null,
    selectedText: null,
    history: [initialContent],
    historyIndex: 0,
    isFormatting: false
  });

  const editorRef = useRef<HTMLDivElement>(null);
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout>();
  const saveInProgressRef = useRef(false);

  // Debounced auto-save
  const scheduleAutoSave = useCallback(() => {
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }

    autoSaveTimeoutRef.current = setTimeout(async () => {
      if (state.hasChanges && !saveInProgressRef.current) {
        await handleSave();
      }
    }, autoSaveDelay);
  }, [state.hasChanges, autoSaveDelay]);

  // Handle content change
  const handleContentChange = useCallback((newContent: string) => {
    setState(prev => {
      const hasChanges = newContent !== prev.originalContent;
      
      // Add to history
      const newHistory = prev.history.slice(0, prev.historyIndex + 1);
      newHistory.push(newContent);
      
      // Limit history size
      if (newHistory.length > 50) {
        newHistory.shift();
      }

      return {
        ...prev,
        content: newContent,
        hasChanges,
        history: newHistory,
        historyIndex: newHistory.length - 1,
        saveError: null
      };
    });

    // Notify parent of changes
    onContentChange?.(zone.id, newContent);

    // Schedule auto-save
    if (newContent !== state.originalContent) {
      scheduleAutoSave();
    }
  }, [zone.id, state.originalContent, onContentChange, scheduleAutoSave]);

  // Handle save
  const handleSave = useCallback(async () => {
    if (!state.hasChanges || saveInProgressRef.current) return;

    saveInProgressRef.current = true;
    setState(prev => ({ ...prev, isSaving: true, saveError: null }));

    try {
      await onContentSave(zone.id, state.content);
      
      setState(prev => ({
        ...prev,
        originalContent: prev.content,
        hasChanges: false,
        isSaving: false,
        lastSaved: new Date(),
        saveError: null
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        isSaving: false,
        saveError: error instanceof Error ? error.message : 'Failed to save content'
      }));
    } finally {
      saveInProgressRef.current = false;
    }
  }, [state.hasChanges, state.content, zone.id, onContentSave]);

  // Handle text formatting
  const applyFormat = useCallback((action: FormatAction) => {
    if (!enableRichText || !editorRef.current) return;

    setState(prev => ({ ...prev, isFormatting: true }));

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      setState(prev => ({ ...prev, isFormatting: false }));
      return;
    }

    const range = selection.getRangeAt(0);
    const selectedText = range.toString();

    if (!selectedText) {
      setState(prev => ({ ...prev, isFormatting: false }));
      return;
    }

    let formattedText = selectedText;

    switch (action.type) {
      case 'bold':
        formattedText = `**${selectedText}**`;
        break;
      case 'italic':
        formattedText = `*${selectedText}*`;
        break;
      case 'code':
        formattedText = `\`${selectedText}\``;
        break;
      case 'list':
        formattedText = selectedText.split('\n').map(line => `- ${line}`).join('\n');
        break;
      case 'ordered-list':
        formattedText = selectedText.split('\n').map((line, i) => `${i + 1}. ${line}`).join('\n');
        break;
      case 'align':
        // For alignment, we'd need a more sophisticated editor
        // This is a placeholder for demonstration
        formattedText = selectedText;
        break;
      case 'table':
        // Simple table formatting
        const lines = selectedText.split('\n');
        if (lines.length > 1) {
          formattedText = '| ' + lines[0].replace(/\t/g, ' | ') + ' |\n';
          formattedText += '|' + lines[0].split(/\t/).map(() => '---').join('|') + '|\n';
          lines.slice(1).forEach(line => {
            formattedText += '| ' + line.replace(/\t/g, ' | ') + ' |\n';
          });
        }
        break;
    }

    // Replace selected text
    range.deleteContents();
    range.insertNode(document.createTextNode(formattedText));

    // Update content
    if (editorRef.current) {
      handleContentChange(editorRef.current.innerText);
    }

    setState(prev => ({ ...prev, isFormatting: false }));
  }, [enableRichText, handleContentChange]);

  // Handle undo
  const handleUndo = useCallback(() => {
    if (state.historyIndex > 0) {
      const newIndex = state.historyIndex - 1;
      const previousContent = state.history[newIndex];
      
      setState(prev => ({
        ...prev,
        content: previousContent,
        historyIndex: newIndex,
        hasChanges: previousContent !== prev.originalContent
      }));

      if (editorRef.current) {
        editorRef.current.innerText = previousContent;
      }
    }
  }, [state.history, state.historyIndex]);

  // Handle redo
  const handleRedo = useCallback(() => {
    if (state.historyIndex < state.history.length - 1) {
      const newIndex = state.historyIndex + 1;
      const nextContent = state.history[newIndex];
      
      setState(prev => ({
        ...prev,
        content: nextContent,
        historyIndex: newIndex,
        hasChanges: nextContent !== prev.originalContent
      }));

      if (editorRef.current) {
        editorRef.current.innerText = nextContent;
      }
    }
  }, [state.history, state.historyIndex]);

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    const isCtrlOrCmd = event.ctrlKey || event.metaKey;

    if (isCtrlOrCmd && event.key === 's') {
      event.preventDefault();
      handleSave();
    } else if (isCtrlOrCmd && event.key === 'z' && !event.shiftKey) {
      event.preventDefault();
      handleUndo();
    } else if (isCtrlOrCmd && (event.key === 'y' || (event.key === 'z' && event.shiftKey))) {
      event.preventDefault();
      handleRedo();
    } else if (isCtrlOrCmd && event.key === 'b') {
      event.preventDefault();
      applyFormat({ type: 'bold' });
    } else if (isCtrlOrCmd && event.key === 'i') {
      event.preventDefault();
      applyFormat({ type: 'italic' });
    }
  }, [handleSave, handleUndo, handleRedo, applyFormat]);

  // Handle paste to strip formatting
  const handlePaste = useCallback((event: React.ClipboardEvent) => {
    event.preventDefault();
    const text = event.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, text);
  }, []);

  // Initialize content
  useEffect(() => {
    if (editorRef.current && editorRef.current.innerText !== state.content) {
      editorRef.current.innerText = state.content;
    }
  }, [state.content]);

  // Cleanup auto-save on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
      if (state.hasChanges && !saveInProgressRef.current) {
        handleSave();
      }
    };
  }, [state.hasChanges, handleSave]);

  // Calculate time since last save
  const getTimeSinceLastSave = () => {
    if (!state.lastSaved) return null;
    const seconds = Math.floor((Date.now() - state.lastSaved.getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    return `${minutes}m ago`;
  };

  return (
    <div className="content-editor flex flex-col h-full bg-white rounded-lg shadow-sm border">
      {/* Toolbar */}
      {enableRichText && (
        <div className="editor-toolbar flex items-center gap-1 p-2 border-b bg-gray-50">
          {/* Formatting buttons */}
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => applyFormat({ type: 'bold' })}
              disabled={disabled || state.isFormatting}
              title="Bold (Ctrl+B)"
            >
              <Bold className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => applyFormat({ type: 'italic' })}
              disabled={disabled || state.isFormatting}
              title="Italic (Ctrl+I)"
            >
              <Italic className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => applyFormat({ type: 'code' })}
              disabled={disabled || state.isFormatting}
              title="Code"
            >
              <Code className="w-4 h-4" />
            </Button>
          </div>

          <div className="w-px h-6 bg-gray-300 mx-1" />

          {/* List buttons */}
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => applyFormat({ type: 'list' })}
              disabled={disabled || state.isFormatting}
              title="Bullet list"
            >
              <List className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => applyFormat({ type: 'ordered-list' })}
              disabled={disabled || state.isFormatting}
              title="Numbered list"
            >
              <ListOrdered className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => applyFormat({ type: 'table' })}
              disabled={disabled || state.isFormatting}
              title="Table"
            >
              <Table className="w-4 h-4" />
            </Button>
          </div>

          <div className="w-px h-6 bg-gray-300 mx-1" />

          {/* History buttons */}
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleUndo}
              disabled={disabled || state.historyIndex === 0}
              title="Undo (Ctrl+Z)"
            >
              <Undo className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRedo}
              disabled={disabled || state.historyIndex === state.history.length - 1}
              title="Redo (Ctrl+Y)"
            >
              <Redo className="w-4 h-4" />
            </Button>
          </div>

          <div className="flex-1" />

          {/* Save status */}
          <div className="flex items-center gap-2 text-xs text-gray-600">
            {state.isSaving && (
              <>
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>Saving...</span>
              </>
            )}
            {state.hasChanges && !state.isSaving && (
              <>
                <div className="w-2 h-2 bg-yellow-500 rounded-full" />
                <span>Unsaved changes</span>
              </>
            )}
            {!state.hasChanges && state.lastSaved && (
              <>
                <Check className="w-3 h-3 text-green-600" />
                <span>Saved {getTimeSinceLastSave()}</span>
              </>
            )}
            {state.saveError && (
              <>
                <AlertCircle className="w-3 h-3 text-red-600" />
                <span className="text-red-600">Save failed</span>
              </>
            )}
          </div>

          {/* Manual save button */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleSave}
            disabled={disabled || !state.hasChanges || state.isSaving}
            title="Save (Ctrl+S)"
          >
            <Save className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* Editor content */}
      <div className="editor-content flex-1 overflow-auto">
        <div
          ref={editorRef}
          contentEditable={!disabled}
          className={`min-h-full p-4 focus:outline-none ${
            disabled ? 'opacity-50 cursor-not-allowed' : ''
          } ${zone.contentType === 'code' ? 'font-mono text-sm' : ''}`}
          onInput={(e) => handleContentChange(e.currentTarget.innerText)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          spellCheck={zone.contentType === 'text'}
          style={{
            whiteSpace: zone.contentType === 'code' ? 'pre' : 'pre-wrap',
            wordBreak: 'break-word'
          }}
        />
      </div>

      {/* Collaborator cursors */}
      {enableCollaboration && collaborators.length > 0 && (
        <div className="collaborators absolute inset-0 pointer-events-none">
          {collaborators.map(collaborator => (
            <div
              key={collaborator.id}
              className="absolute w-0.5 h-5 transition-all duration-100"
              style={{
                backgroundColor: collaborator.color,
                left: `${collaborator.cursor || 0}px`,
                top: '20px'
              }}
            >
              <span 
                className="absolute -top-5 left-0 text-xs px-1 py-0.5 rounded text-white whitespace-nowrap"
                style={{ backgroundColor: collaborator.color }}
              >
                {collaborator.name}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Zone info */}
      <div className="editor-footer flex items-center justify-between p-2 border-t bg-gray-50 text-xs text-gray-600">
        <div className="flex items-center gap-3">
          <span>Zone: {zone.id}</span>
          <span>Type: {zone.contentType}</span>
          <span>Confidence: {Math.round(zone.confidence * 100)}%</span>
        </div>
        <div className="flex items-center gap-3">
          <span>{state.content.length} characters</span>
          <span>{state.content.split(/\s+/).filter(w => w.length > 0).length} words</span>
        </div>
      </div>
    </div>
  );
}

export default ContentEditor;