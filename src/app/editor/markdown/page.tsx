'use client';

import React, { useState, useRef, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  FileText, Bold, Italic, Strikethrough, Heading1, Heading2, Heading3,
  List, ListOrdered, CheckSquare, Code, Quote, Table, Link2, Image,
  Eye, Edit3, Columns, Download, Printer, Copy, Check, Sparkles,
  ArrowLeft, Cloud, Clock, RefreshCw, Upload, FileCode, CheckCircle2,
  Trash2, Undo2, Redo2, Maximize2, SplitSquareVertical
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ZenFileSyncService, ZenDocumentItem } from '@/lib/firebase-sync';
import { ZenAiDialog } from '@/components/shared/zen-ai-dialog';

const SAMPLE_MARKDOWN = `# Welcome to ZenOffice Markdown Studio

ZenOffice Markdown Studio gives you a high-performance, distraction-free environment to write, format, and preview **Markdown** documents with live rendering.

---

## ⚡ Core Features
- **Live GFM Rendering**: Tables, checklists, code blocks, and blockquotes.
- **Split View & Reading Mode**: Switch between side-by-side editing, preview only, or writing focus.
- **Academic ZenAI Copilot**: Generate notes, fix formatting, summarize, and draft content with AI.
- **Universal Export**: Export as \`.md\`, formatted HTML, or printable PDF.

---

### 📋 Interactive Task Checklist
- [x] High-performance offline markdown editor
- [x] Real-time dual-pane live preview
- [x] One-click decompression & archive tools
- [ ] Review document revisions

---

### 📊 Rich Tables Example
| Feature | ZenOffice | WPS / Other |
| :--- | :---: | :---: |
| Local-First Offline | ✅ 100% | ⚠️ Limited |
| Integrated AI Copilot | ✅ Free | 💲 Paid Add-on |
| Markdown Live Preview | ✅ Native | ❌ Separate Plugin |

---

### 💻 Code Syntax Block
\`\`\`typescript
interface DocumentProps {
  id: string;
  title: string;
  content: string;
  format: 'markdown' | 'pdf' | 'docx';
}

function processDocument(doc: DocumentProps): boolean {
  console.log(\`Editing \${doc.title} in ZenOffice!\`);
  return true;
}
\`\`\`

> *"Simplicity is prerequisite for reliability."* — Edsger W. Dijkstra
`;

function MarkdownEditorInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const docParam = searchParams.get('doc') || searchParams.get('id') || '';

  const [docTitle, setDocTitle] = useState(docParam ? decodeURIComponent(docParam) : 'Notes.md');
  const [markdown, setMarkdown] = useState<string>(SAMPLE_MARKDOWN);
  const [viewMode, setViewMode] = useState<'split' | 'edit' | 'preview'>('split');
  const [currentDoc, setCurrentDoc] = useState<ZenDocumentItem | null>(null);
  const [notification, setNotification] = useState<string | null>(null);
  const [showAiModal, setShowAiModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [history, setHistory] = useState<string[]>([SAMPLE_MARKDOWN]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const showToast = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3500);
  };

  // Load document if specified in query param
  useEffect(() => {
    let active = true;
    async function loadDocument() {
      if (!docParam) return;
      try {
        const found = await ZenFileSyncService.getDocument(docParam);
        if (!active || !found) return;
        setCurrentDoc(found);
        setDocTitle(found.name);
        if (found.fileData) {
          // If stored as base64 or plaintext
          if (found.fileData.startsWith('data:')) {
            const base64 = found.fileData.split(',')[1];
            setMarkdown(atob(base64));
          } else {
            setMarkdown(found.fileData);
          }
        }
      } catch (e) {
        console.error('Error loading markdown document', e);
      }
    }
    loadDocument();
    return () => { active = false; };
  }, [docParam]);

  // Statistics calculation
  const stats = React.useMemo(() => {
    const text = markdown.trim();
    const words = text ? text.split(/\s+/).filter(Boolean).length : 0;
    const chars = text.length;
    const lines = text ? text.split('\n').length : 0;
    const readingTime = Math.max(1, Math.ceil(words / 200));
    return { words, chars, lines, readingTime };
  }, [markdown]);

  // History tracking for undo/redo
  const updateMarkdown = (newText: string) => {
    setMarkdown(newText);
    setHasUnsavedChanges(true);
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newText);
    if (newHistory.length > 50) newHistory.shift();
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      const newIdx = historyIndex - 1;
      setHistoryIndex(newIdx);
      setMarkdown(history[newIdx]);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const newIdx = historyIndex + 1;
      setHistoryIndex(newIdx);
      setMarkdown(history[newIdx]);
    }
  };

  // Format insertion helper
  const insertFormatting = (prefix: string, suffix: string = '', defaultText: string = '') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = markdown.substring(start, end) || defaultText;

    const replacement = prefix + selectedText + suffix;
    const newMarkdown = markdown.substring(0, start) + replacement + markdown.substring(end);

    updateMarkdown(newMarkdown);

    // Reposition cursor
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, start + prefix.length + selectedText.length);
    }, 0);
  };

  // Insert template block
  const insertBlock = (template: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const before = markdown.substring(0, start);
    const after = markdown.substring(end);
    const newline = before.endsWith('\n') || before.length === 0 ? '' : '\n\n';

    const newMarkdown = before + newline + template + '\n\n' + after;
    updateMarkdown(newMarkdown);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + newline.length + template.length, start + newline.length + template.length);
    }, 0);
  };

  // File operations
  const handleSaveDocument = async (silent = false) => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      const titleWithExt = docTitle.endsWith('.md') ? docTitle : `${docTitle}.md`;
      const base64Data = 'data:text/markdown;base64,' + btoa(unescape(encodeURIComponent(markdown)));
      
      const saved = await ZenFileSyncService.saveDocument({
        id: currentDoc?.id,
        name: titleWithExt,
        type: 'word',
        category: 'Documents',
        fileData: base64Data,
        size: `${Math.round(markdown.length / 1024)} KB`,
        synced: true,
      });

      setCurrentDoc(saved);
      setHasUnsavedChanges(false);
      if (!silent) {
        showToast(`Saved "${titleWithExt}" to ZenOffice!`);
      }
    } catch (e) {
      if (!silent) showToast('Error saving document.');
    } finally {
      setIsSaving(false);
    }
  };

  // Debounced Auto-Save
  useEffect(() => {
    if (!hasUnsavedChanges || isSaving) return;

    const timer = setTimeout(() => {
      handleSaveDocument(true);
    }, 2000);

    return () => clearTimeout(timer);
  }, [hasUnsavedChanges, isSaving, markdown]);

  // Keyboard shortcut Ctrl+S
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSaveDocument(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSaveDocument]);

  const handleExportMarkdown = async () => {
    const titleWithExt = docTitle.endsWith('.md') ? docTitle : `${docTitle}.md`;
    try {
      const { save } = await import('@tauri-apps/plugin-dialog');
      const { writeTextFile } = await import('@tauri-apps/plugin-fs');
      const filePath = await save({
        defaultPath: titleWithExt,
        filters: [{ name: 'Markdown', extensions: ['md', 'markdown'] }]
      });
      if (filePath) {
        await writeTextFile(filePath, markdown);
        showToast(`Exported "${titleWithExt}" successfully!`);
        return;
      }
    } catch {
      // Web fallback
    }

    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = titleWithExt;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(`Exported ${titleWithExt}`);
  };

  const handleExportHtml = () => {
    const titleWithExt = (docTitle.replace(/\.md$/i, '') || 'document') + '.html';
    const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${docTitle}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; line-height: 1.6; max-width: 800px; margin: 40px auto; padding: 0 20px; color: #18181b; }
    h1, h2, h3 { color: #09090b; margin-top: 1.5em; }
    table { border-collapse: collapse; width: 100%; margin: 1em 0; }
    th, td { border: 1px solid #e4e4e7; padding: 8px 12px; text-align: left; }
    th { background: #f4f4f5; }
    code { background: #f4f4f5; padding: 2px 6px; border-radius: 4px; font-family: monospace; font-size: 0.9em; }
    pre { background: #18181b; color: #f4f4f5; padding: 16px; border-radius: 8px; overflow-x: auto; }
    pre code { background: none; color: inherit; padding: 0; }
    blockquote { border-left: 4px solid #ea580c; margin: 1em 0; padding-left: 16px; color: #71717a; }
  </style>
</head>
<body>
  ${document.getElementById('markdown-preview-container')?.innerHTML || ''}
</body>
</html>`;

    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = titleWithExt;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(`Exported ${titleWithExt}`);
  };

  const handleCopyMarkdown = () => {
    navigator.clipboard.writeText(markdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    showToast('Markdown copied to clipboard!');
  };

  const handleOpenFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        updateMarkdown(content);
        setDocTitle(file.name);
        showToast(`Loaded ${file.name}`);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-zinc-100 dark:bg-[#0c0c0e] font-sans text-zinc-800 dark:text-zinc-200">
      
      {/* Hidden file input */}
      <input 
        type="file" 
        ref={fileInputRef} 
        accept=".md,.markdown,.txt" 
        className="hidden" 
        onChange={handleOpenFile} 
      />

      {/* TOP HEADER */}
      <div className="h-14 bg-white dark:bg-[#121214] border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between px-3 shrink-0 select-none">
        
        {/* Left: Brand & Title */}
        <div className="flex items-center gap-3">
          <Link 
            href="/dashboard" 
            className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            title="Return to Dashboard"
          >
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center text-white shadow-xs">
              <FileCode className="w-4 h-4" />
            </div>
          </Link>

          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <input 
                type="text"
                value={docTitle}
                onChange={(e) => setDocTitle(e.target.value)}
                className="font-medium text-sm text-zinc-900 dark:text-zinc-100 bg-transparent hover:bg-zinc-100 dark:hover:bg-zinc-800 focus:bg-white dark:focus:bg-zinc-900 border border-transparent focus:border-zinc-300 dark:focus:border-zinc-700 rounded px-1.5 py-0.5 max-w-[260px] truncate outline-none transition-colors"
              />
              <span className="text-[10px] font-bold uppercase tracking-wider text-orange-600 bg-orange-50 dark:bg-orange-950/40 px-1.5 py-0.5 rounded border border-orange-200 dark:border-orange-800">
                Markdown
              </span>
              <span className="hidden sm:flex items-center gap-1 text-[11px] text-zinc-400">
                <Cloud className="w-3 h-3 text-zinc-400" />
                <span>Local Storage</span>
              </span>
            </div>

            {/* Quick Menu */}
            <div className="flex items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400 -ml-1 mt-0.5">
              <button onClick={() => fileInputRef.current?.click()} className="px-2 py-0.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100">Open</button>
              <button onClick={handleSaveDocument} className="px-2 py-0.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100">Save</button>
              <button onClick={handleExportMarkdown} className="px-2 py-0.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100">Export .md</button>
              <button onClick={handleExportHtml} className="px-2 py-0.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100">Export HTML</button>
              <button onClick={() => window.print()} className="px-2 py-0.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100">Print / PDF</button>
            </div>
          </div>
        </div>

        {/* Right side controls */}
        <div className="flex items-center gap-2">
          
          {/* View mode switcher */}
          <div className="flex items-center bg-zinc-100 dark:bg-zinc-800/80 p-0.5 rounded-lg border border-zinc-200 dark:border-zinc-700">
            <button
              onClick={() => setViewMode('edit')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md flex items-center gap-1.5 transition-colors ${
                viewMode === 'edit'
                  ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900'
              }`}
              title="Editor Only"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Edit</span>
            </button>
            <button
              onClick={() => setViewMode('split')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md flex items-center gap-1.5 transition-colors ${
                viewMode === 'split'
                  ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900'
              }`}
              title="Split View (Editor & Live Preview)"
            >
              <Columns className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Split</span>
            </button>
            <button
              onClick={() => setViewMode('preview')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md flex items-center gap-1.5 transition-colors ${
                viewMode === 'preview'
                  ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900'
              }`}
              title="Preview Only"
            >
              <Eye className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Preview</span>
            </button>
          </div>

          {/* AI Copilot */}
          <Button
            size="sm"
            onClick={() => setShowAiModal(true)}
            className="h-8 px-3 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white text-xs font-medium rounded-full shadow-xs gap-1.5 transition-all"
          >
            <Sparkles className="w-3.5 h-3.5 animate-pulse text-amber-100" />
            <span className="hidden sm:inline">ZenAI Copilot</span>
          </Button>

          {/* Save Button */}
          <Button 
            size="sm" 
            onClick={() => handleSaveDocument(false)}
            disabled={isSaving}
            className="h-8 text-xs px-3 bg-orange-600 hover:bg-orange-700 disabled:opacity-60 text-white shadow-xs font-medium gap-1.5"
            title="Save Document (Ctrl+S)"
          >
            {isSaving ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : hasUnsavedChanges ? (
              <span className="w-1.5 h-1.5 rounded-full bg-amber-200 animate-pulse" />
            ) : null}
            <span>{isSaving ? 'Saving...' : hasUnsavedChanges ? 'Save *' : 'Saved'}</span>
          </Button>

          {/* Copy Button */}
          <button 
            onClick={handleCopyMarkdown}
            className="p-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors"
            title="Copy Raw Markdown"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* FORMATTING TOOLBAR */}
      {viewMode !== 'preview' && (
        <div className="bg-white dark:bg-[#121214] border-b border-zinc-200 dark:border-zinc-800 px-3 py-1 flex items-center gap-1 overflow-x-auto no-scrollbar min-h-[40px] text-xs">
          
          {/* History */}
          <div className="flex items-center gap-0.5">
            <button 
              onClick={handleUndo} 
              disabled={historyIndex <= 0}
              className="p-1.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-40 text-zinc-600 dark:text-zinc-400"
              title="Undo"
            >
              <Undo2 className="w-3.5 h-3.5" />
            </button>
            <button 
              onClick={handleRedo} 
              disabled={historyIndex >= history.length - 1}
              className="p-1.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-40 text-zinc-600 dark:text-zinc-400"
              title="Redo"
            >
              <Redo2 className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="h-4 w-px bg-zinc-200 dark:bg-zinc-800 mx-1 shrink-0" />

          {/* Headings */}
          <div className="flex items-center gap-0.5">
            <button onClick={() => insertFormatting('# ', '', 'Heading 1')} className="px-2 py-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 font-bold" title="Heading 1">H1</button>
            <button onClick={() => insertFormatting('## ', '', 'Heading 2')} className="px-2 py-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 font-bold" title="Heading 2">H2</button>
            <button onClick={() => insertFormatting('### ', '', 'Heading 3')} className="px-2 py-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 font-bold" title="Heading 3">H3</button>
          </div>

          <div className="h-4 w-px bg-zinc-200 dark:bg-zinc-800 mx-1 shrink-0" />

          {/* Inline styles */}
          <div className="flex items-center gap-0.5">
            <button onClick={() => insertFormatting('**', '**', 'bold text')} className="p-1.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300" title="Bold (**text**)"><Bold className="w-3.5 h-3.5" /></button>
            <button onClick={() => insertFormatting('*', '*', 'italic text')} className="p-1.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300" title="Italic (*text*)"><Italic className="w-3.5 h-3.5" /></button>
            <button onClick={() => insertFormatting('~~', '~~', 'strikethrough')} className="p-1.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300" title="Strikethrough (~~text~~)"><Strikethrough className="w-3.5 h-3.5" /></button>
            <button onClick={() => insertFormatting('`', '`', 'inline code')} className="p-1.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-mono text-xs" title="Inline Code">`code`</button>
          </div>

          <div className="h-4 w-px bg-zinc-200 dark:bg-zinc-800 mx-1 shrink-0" />

          {/* Blocks & Lists */}
          <div className="flex items-center gap-0.5">
            <button onClick={() => insertFormatting('- ', '', 'List item')} className="p-1.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300" title="Bulleted List"><List className="w-3.5 h-3.5" /></button>
            <button onClick={() => insertFormatting('1. ', '', 'Numbered item')} className="p-1.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300" title="Numbered List"><ListOrdered className="w-3.5 h-3.5" /></button>
            <button onClick={() => insertFormatting('- [ ] ', '', 'Task item')} className="p-1.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300" title="Checklist / Task List"><CheckSquare className="w-3.5 h-3.5" /></button>
            <button onClick={() => insertFormatting('> ', '', 'Quote text')} className="p-1.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300" title="Blockquote"><Quote className="w-3.5 h-3.5" /></button>
            <button onClick={() => insertBlock('```typescript\n// Code here\nconsole.log("Hello, ZenOffice!");\n```')} className="p-1.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300" title="Code Block"><Code className="w-3.5 h-3.5" /></button>
          </div>

          <div className="h-4 w-px bg-zinc-200 dark:bg-zinc-800 mx-1 shrink-0" />

          {/* Tables & Media */}
          <div className="flex items-center gap-0.5">
            <button 
              onClick={() => insertBlock('| Header 1 | Header 2 | Header 3 |\n| :--- | :--- | :--- |\n| Value 1 | Value 2 | Value 3 |\n| Data A | Data B | Data C |')} 
              className="p-1.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300" 
              title="Insert Table"
            >
              <Table className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => insertFormatting('[', '](https://example.com)', 'Link text')} className="p-1.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300" title="Insert Link"><Link2 className="w-3.5 h-3.5" /></button>
            <button onClick={() => insertFormatting('![', '](https://via.placeholder.com/600x300)', 'Image Alt')} className="p-1.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300" title="Insert Image"><Image className="w-3.5 h-3.5" /></button>
            <button onClick={() => insertBlock('\n---\n')} className="px-2 py-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 font-bold" title="Horizontal Divider">Divider</button>
          </div>
        </div>
      )}

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* RAW MARKDOWN EDITOR PANE */}
        {(viewMode === 'edit' || viewMode === 'split') && (
          <div className={`h-full flex flex-col bg-white dark:bg-[#0c0c0e] ${viewMode === 'split' ? 'w-1/2 border-r border-zinc-200 dark:border-zinc-800' : 'w-full'}`}>
            <div className="px-4 py-1.5 bg-zinc-50 dark:bg-[#121214] border-b border-zinc-200 dark:border-zinc-800 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider flex items-center justify-between">
              <span>Markdown Source</span>
              <span className="text-[10px] text-zinc-400 font-normal">{stats.lines} lines</span>
            </div>
            <textarea
              ref={textareaRef}
              value={markdown}
              onChange={(e) => updateMarkdown(e.target.value)}
              placeholder="Type raw Markdown here..."
              className="flex-1 p-5 font-mono text-sm leading-relaxed text-zinc-800 dark:text-zinc-200 bg-transparent resize-none outline-none overflow-y-auto selection:bg-orange-500/20"
              spellCheck={false}
            />
          </div>
        )}

        {/* LIVE RENDERED PREVIEW PANE */}
        {(viewMode === 'preview' || viewMode === 'split') && (
          <div className={`h-full flex flex-col bg-[#fafafa] dark:bg-[#09090b] ${viewMode === 'split' ? 'w-1/2' : 'w-full'}`}>
            <div className="px-4 py-1.5 bg-zinc-50 dark:bg-[#121214] border-b border-zinc-200 dark:border-zinc-800 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider flex items-center justify-between">
              <span>Live Rendered Output</span>
              <span className="text-[10px] text-zinc-400 font-normal">{stats.words} words • ~{stats.readingTime} min read</span>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 sm:p-10 flex justify-center">
              <div 
                id="markdown-preview-container"
                className="w-full max-w-3xl bg-white dark:bg-[#121214] rounded-xl shadow-xs border border-zinc-200/80 dark:border-zinc-800/80 p-8 sm:p-12 min-h-full"
              >
                <article className="prose prose-zinc dark:prose-invert max-w-none prose-headings:font-bold prose-headings:text-zinc-900 dark:prose-headings:text-white prose-h1:text-3xl prose-h2:text-2xl prose-h3:text-xl prose-a:text-orange-600 dark:prose-a:text-orange-400 prose-code:text-orange-600 dark:prose-code:text-orange-400 prose-code:bg-orange-50 dark:prose-code:bg-orange-950/40 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none prose-pre:bg-zinc-900 prose-pre:text-zinc-100 prose-table:border prose-table:border-zinc-200 dark:prose-table:border-zinc-800 prose-th:bg-zinc-100 dark:prose-th:bg-zinc-800 prose-th:p-3 prose-td:p-3 prose-blockquote:border-l-orange-500 prose-blockquote:text-zinc-600 dark:prose-blockquote:text-zinc-400">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {markdown}
                  </ReactMarkdown>
                </article>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* BOTTOM STATUS BAR */}
      <div className="h-7 bg-white dark:bg-[#0c0c0e] border-t border-zinc-200 dark:border-zinc-800 px-4 flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400 shrink-0 select-none">
        <div className="flex items-center gap-4">
          <span>{stats.words} Words</span>
          <span>{stats.chars} Characters</span>
          <span>{stats.lines} Lines</span>
          <span>Est. Reading: {stats.readingTime} min</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-mono text-orange-600 dark:text-orange-400 font-semibold">{docTitle}</span>
          <span>UTF-8</span>
          <span>Markdown GFM</span>
        </div>
      </div>

      {/* NOTIFICATION TOAST */}
      {notification && (
        <div className="fixed bottom-9 right-6 z-50 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-4 py-2.5 rounded-lg shadow-xl text-xs font-medium flex items-center gap-2 border border-zinc-700 dark:border-zinc-300 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
          <span>{notification}</span>
        </div>
      )}

      {/* ZEN AI COPILOT DIALOG */}
      <ZenAiDialog
        isOpen={showAiModal}
        onClose={() => setShowAiModal(false)}
        documentContext={markdown}
        documentTitle={docTitle}
        editorType="document"
        onInsert={(text) => {
          insertBlock(text);
          setShowAiModal(false);
          showToast('Inserted AI content into Markdown document.');
        }}
      />

    </div>
  );
}

export default function MarkdownEditorPage() {
  return (
    <Suspense fallback={
      <div className="h-screen w-screen bg-[#0c0c0e] flex flex-col items-center justify-center text-orange-500 gap-3">
        <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm font-semibold tracking-wide text-zinc-400">Loading ZenOffice Markdown Studio...</span>
      </div>
    }>
      <MarkdownEditorInner />
    </Suspense>
  );
}
