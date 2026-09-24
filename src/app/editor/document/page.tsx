'use client';

import React, { useState, useRef, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
  ArrowLeft, Download, Printer, 
  Plus, X, Check, Sparkles, 
  Undo2, Redo2, Scissors, Copy, Clipboard, 
  Bold, Italic, Underline, Strikethrough, 
  AlignLeft, AlignCenter, AlignRight, AlignJustify, 
  List, ListOrdered, FileText, Heading1, Heading2, Quote, 
  Highlighter, CheckCircle2, Maximize2, Table as TableIcon,
  Minus, Calendar, BookOpen, Clock, ChevronDown, Trash2,
  ImageIcon, Type, Search, Settings, SpellCheck, Replace,
  Languages, GraduationCap, LayoutTemplate, Loader2, Wand2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ZenFileSyncService, ZenDocumentItem } from '@/lib/firebase-sync';
import { ZenAiDialog } from '@/components/shared/zen-ai-dialog';

const TEXT_COLORS = [
  { label: 'Default', value: '' },
  { label: 'Orange', value: '#ea580c' },
  { label: 'Emerald', value: '#10b981' },
  { label: 'Blue', value: '#2563eb' },
  { label: 'Red', value: '#dc2626' },
  { label: 'Purple', value: '#9333ea' },
  { label: 'Zinc Dark', value: '#27272a' },
];

const HIGHLIGHT_COLORS = [
  { label: 'None', value: 'transparent' },
  { label: 'Yellow Tint', value: '#fef08a' },
  { label: 'Orange Tint', value: '#fed7aa' },
  { label: 'Emerald Tint', value: '#bbf7d0' },
  { label: 'Blue Tint', value: '#bfdbfe' },
  { label: 'Purple Tint', value: '#e9d5ff' },
];

function DocumentEditorInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const docParam = searchParams.get('doc') || searchParams.get('id') || '';

  // Document state
  const [docTitle, setDocTitle] = useState(docParam ? decodeURIComponent(docParam) : 'Untitled_Document.docx');
  const [currentDoc, setCurrentDoc] = useState<ZenDocumentItem | null>(null);

  // Ribbon & Navigation
  const [activeRibbonTab, setActiveRibbonTab] = useState<'home' | 'insert' | 'layout' | 'review' | 'view'>('home');
  const [zoom, setZoom] = useState(100);
  const [notification, setNotification] = useState<string | null>(null);

  // Formatting state
  const [fontFamily, setFontFamily] = useState('Inter');
  const [fontSize, setFontSize] = useState('11');
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [isUnderline, setIsUnderline] = useState(false);
  const [isStrikethrough, setIsStrikethrough] = useState(false);
  const [textAlign, setTextAlign] = useState<'left' | 'center' | 'right' | 'justify'>('left');

  // Layout settings
  const [pageMargin, setPageMargin] = useState<'normal' | 'narrow' | 'wide'>('normal');
  const [lineSpacing, setLineSpacing] = useState<'1.15' | '1.5' | '2.0'>('1.5');
  const [paperTheme, setPaperTheme] = useState<'white' | 'cream' | 'dark'>('white');
  const [spellCheckEnabled, setSpellCheckEnabled] = useState(true);

  // Popover menus
  const [showTextColorMenu, setShowTextColorMenu] = useState(false);
  const [showHighlightColorMenu, setShowHighlightColorMenu] = useState(false);

  // Zen AI Academic Writing Dialog
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiPresetAction, setAiPresetAction] = useState<'polish' | 'cite' | 'summarize' | 'chat'>('polish');

  // AI Command Bar State
  const [aiCommandText, setAiCommandText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  // Document Content Editable Refs / State
  const editorRef = useRef<HTMLDivElement>(null);
  const [wordCount, setWordCount] = useState(120);
  const [charCount, setCharCount] = useState(780);

  const showToast = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3500);
  };

  // Load document based on docParam
  useEffect(() => {
    let active = true;

    async function loadDoc() {
      const resolved = docParam ? decodeURIComponent(docParam) : 'Untitled_Document.docx';
      setDocTitle(resolved);

      const ext = resolved.split('.').pop()?.toLowerCase();
      if (ext === 'pptx' || ext === 'ppt') {
        router.push(`/editor/presentation?doc=${encodeURIComponent(resolved)}`);
        return;
      }
      if (ext === 'xlsx' || ext === 'xls' || ext === 'csv') {
        router.push(`/editor/excel?doc=${encodeURIComponent(resolved)}`);
        return;
      }
      if (ext === 'pdf') {
        router.push(`/editor/pdf?doc=${encodeURIComponent(resolved)}`);
        return;
      }

      if (docParam) {
        const found = await ZenFileSyncService.getDocument(docParam);
        if (!active) return;
        if (found) {
          setCurrentDoc(found);
          setDocTitle(found.name);
          if (found.fileData && editorRef.current) {
            if (found.fileData.startsWith('data:')) {
              // If it's a data URL (e.g. from file upload), we shouldn't dump it directly as text unless it's text/html or text/plain
              if (found.fileData.startsWith('data:text/html') || found.fileData.startsWith('data:text/plain')) {
                const base64 = found.fileData.split(',')[1];
                if (base64) {
                  try {
                    editorRef.current.innerHTML = atob(base64);
                  } catch {
                    editorRef.current.innerHTML = "Error parsing document.";
                  }
                }
              } else {
                 editorRef.current.innerHTML = "<p><i>Document loaded (Binary content cannot be previewed directly).</i></p>";
              }
            } else {
              // Raw HTML from saved document
              editorRef.current.innerHTML = found.fileData;
            }
            handleContentInput();
          }
        }
      }

      // Check for incoming extracted text from PDF/OCR
      const extractedText = localStorage.getItem('zen_extracted_text');
      if (extractedText && editorRef.current) {
        // Format it nicely
        editorRef.current.innerHTML = extractedText.replace(/\n/g, '<br/>');
        localStorage.removeItem('zen_extracted_text');
        setDocTitle('Extracted_Document.docx');
        handleContentInput();
      }
    }

    loadDoc();
    return () => { active = false; };
  }, [docParam, router]);

  // Update live word & char count on content edit
  const handleContentInput = () => {
    if (editorRef.current) {
      const text = editorRef.current.innerText || '';
      const words = text.trim() ? text.trim().split(/\s+/).length : 0;
      setWordCount(words);
      setCharCount(text.length);
    }
  };

  // Quick document styling commands using execCommand for rich text
  const applyFormat = (command: string, value: string | undefined = undefined) => {
    document.execCommand(command, false, value);
    if (editorRef.current) editorRef.current.focus();
    handleContentInput();
  };

  const handleStyleChange = (tag: string) => {
    applyFormat('formatBlock', tag);
    showToast(`Applied ${tag.toUpperCase()}`);
  };

  // Insert Table
  const insertTable = () => {
    const tableHtml = `
      <table style="width: 100%; border-collapse: collapse; margin: 1.25rem 0; font-size: 13px;" border="1">
        <thead>
          <tr style="background-color: #f4f4f5;">
            <th style="padding: 8px 12px; border: 1px solid #d4d4d8; text-align: left; font-weight: bold;">Section / Item</th>
            <th style="padding: 8px 12px; border: 1px solid #d4d4d8; text-align: left; font-weight: bold;">Academic Notes</th>
            <th style="padding: 8px 12px; border: 1px solid #d4d4d8; text-align: left; font-weight: bold;">Key Finding</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="padding: 8px 12px; border: 1px solid #e4e4e7;">Hypothesis A</td>
            <td style="padding: 8px 12px; border: 1px solid #e4e4e7;">Preliminary experiment observations</td>
            <td style="padding: 8px 12px; border: 1px solid #e4e4e7;">Positive correlation</td>
          </tr>
          <tr>
            <td style="padding: 8px 12px; border: 1px solid #e4e4e7;">Control Group</td>
            <td style="padding: 8px 12px; border: 1px solid #e4e4e7;">Baseline physiological response</td>
            <td style="padding: 8px 12px; border: 1px solid #e4e4e7;">No deviation</td>
          </tr>
        </tbody>
      </table><p><br></p>
    `;
    applyFormat('insertHTML', tableHtml);
    // removed toast
  };

  // Insert Callout Blockquote
  const insertCallout = () => {
    const calloutHtml = `
      <blockquote style="border-left: 4px solid #ea580c; padding-left: 1rem; margin: 1rem 0; color: #71717a; font-style: italic;">
        "State hypothesis, thesis statement, or critical literature excerpt here..."
      </blockquote><p><br></p>
    `;
    applyFormat('insertHTML', calloutHtml);
    // removed toast
  };

  // Insert Timestamp
  const insertDate = () => {
    const now = new Date().toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
    applyFormat('insertText', ` [${now}] `);
    // removed toast
  };

  // Insert Citation Placeholder
  const insertCitation = () => {
    applyFormat('insertText', ' (Author et al., 2026)');
    // removed toast
  };

  // Insert Page Break Divider
  const insertHorizontalDivider = () => {
    applyFormat('insertHorizontalRule');
    // removed toast
  };

  // Insert AI generated text into document
  const handleInsertAiText = (text: string) => {
    if (editorRef.current) {
      editorRef.current.focus();
      // Format paragraphs nicely
      const formattedHtml = text
        .split('\n\n')
        .map(p => `<p>${p.replace(/\n/g, '<br/>')}</p>`)
        .join('');
      
      applyFormat('insertHTML', `<div style="margin: 1rem 0; padding: 0.75rem 1rem; background-color: rgba(234,88,12,0.06); border-left: 3px solid #ea580c; border-radius: 4px;">${formattedHtml}</div><p><br></p>`);
      showToast('AI content inserted into document');
    }
  };

  const handleAiCommand = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!aiCommandText.trim() || isGenerating) return;

    setIsGenerating(true);
    try {
      const response = await fetch('/api/zen-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          command: aiCommandText,
          context: editorRef.current?.innerText || '',
          mode: 'document'
        })
      });

      if (!response.ok) throw new Error('AI generation failed');
      
      const data = await response.json();
      if (data.text) {
        handleInsertAiText(data.text);
        setAiCommandText('');
      } else {
        throw new Error('No text returned');
      }
    } catch (error) {
      console.error('AI Command Error:', error);
      showToast('Failed to generate AI content.');
    } finally {
      setIsGenerating(false);
    }
  };


  // Real file export
  const handleExport = () => {
    const htmlContent = editorRef.current?.innerHTML || '';
    const fullDoc = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${docTitle}</title><style>body{font-family:sans-serif;max-width:800px;margin:2rem auto;line-height:1.6;color:#18181b;}</style></head><body>${htmlContent}</body></html>`;
    const blob = new Blob([fullDoc], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = docTitle.endsWith('.docx') ? docTitle.replace('.docx', '.html') : `${docTitle}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(`Exported ${docTitle}`);
  };

  const handleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  // Margin padding style helper
  const getPaddingClass = () => {
    if (pageMargin === 'narrow') return 'p-6 sm:p-10';
    if (pageMargin === 'wide') return 'p-10 sm:p-24';
    return 'p-8 sm:p-16';
  };

  // Paper theme helper
  const getPaperBg = () => {
    if (paperTheme === 'cream') return 'bg-[#fffef7] text-zinc-900';
    if (paperTheme === 'dark') return 'bg-[#121214] text-zinc-100';
    return 'bg-white dark:bg-[#121214] text-zinc-900 dark:text-zinc-100';
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-zinc-100 dark:bg-[#000000] font-sans select-none text-zinc-800 dark:text-zinc-200">

      {/* 1. TOP WINDOW BAR / DOCUMENT TABS */}
      <div className="h-14 bg-slate-200 dark:bg-[#0c0c0e] border-b border-zinc-300 dark:border-zinc-800/80 flex items-center justify-between px-2 shrink-0 select-none">
        {/* Left: Brand + Document Tab Strip */}
        <div className="flex items-center gap-1 h-full overflow-x-auto no-scrollbar items-end pt-2">
          <Link href="/dashboard" className="flex items-center gap-1.5 px-4 h-11 rounded-t-md hover:bg-slate-300/60 dark:hover:bg-zinc-800/60 transition-colors mr-1">
            <div className="w-5 h-5 rounded bg-orange-600 flex items-center justify-center text-white shadow-xs">
              <svg width="12" height="12" viewBox="0 0 200 200" fill="none">
                <path d="M44 38C44 29 51 22 60 22H118L156 60V156C156 165 149 172 140 172H60C51 172 44 165 44 156V38Z" fill="#FFFFFF"/>
                <path d="M118 22V50C118 55 122 60 128 60H156L118 22Z" fill="#FDBA74"/>
                <path d="M66 110L134 110L76 138L134 138" stroke="#EA580C" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <span className="text-xs font-bold text-zinc-900 dark:text-white tracking-tight">ZenOffice</span>
          </Link>

          {/* Active Tab */}
          <div className="flex items-center gap-2 px-4 h-11 rounded-t-md text-sm font-semibold bg-white dark:bg-[#121214] border-t border-x border-zinc-300 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-xs cursor-pointer">
            <div className="w-5 h-5 rounded-lg bg-orange-600 text-white flex items-center justify-center text-[10px] font-bold">
              W
            </div>
            <span className="max-w-[200px] truncate" title={docTitle}>{docTitle}</span>
            <span className="text-[10px] text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/40 px-1 py-0.5 rounded border border-orange-200 dark:border-orange-900/60">Local</span>
            <button 
              onClick={() => router.push('/dashboard')}
              className="hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 ml-1"
              title="Close and return to Dashboard"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <button 
            onClick={() => {
              const newName = `Document_${Date.now().toString().slice(-4)}.docx`;
              router.push(`/editor/document?doc=${encodeURIComponent(newName)}`);
            }}
            className="w-8 h-8 rounded flex items-center justify-center text-zinc-500 hover:bg-slate-300/60 dark:hover:bg-zinc-800 hover:text-orange-500 transition-colors mb-1 ml-1"
            title="Create New Blank Document"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          {/* Zen AI Academic Writing Copilot */}
          <Button
            size="sm"
            onClick={() => setShowAiModal(true)}
            className="h-7 px-2.5 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white text-xs font-semibold shadow-xs gap-1.5"
            title="ZenAI Academic Writing & Essay Copilot"
          >
            <Sparkles className="w-3.5 h-3.5 animate-pulse text-amber-200" />
            <span>ZenAI Essay Copilot</span>
          </Button>

          <Button 
            onClick={() => window.print()}
            variant="outline" 
            size="sm" 
            className="h-7 px-2.5 bg-white dark:bg-zinc-900 border-zinc-300 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-xs font-medium gap-1"
            title="Print Document"
          >
            <Printer className="w-3.5 h-3.5 mr-1" /> Print
          </Button>

          <Button 
            onClick={handleExport}
            size="sm" 
            className="h-7 px-2.5 bg-orange-600 hover:bg-orange-700 text-white text-xs font-medium shadow-xs gap-1"
          >
            <Download className="w-3.5 h-3.5 mr-1" /> Export
          </Button>

          <button 
            onClick={handleFullscreen}
            className="p-1.5 rounded hover:bg-zinc-300 dark:hover:bg-zinc-800 text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
            title="Toggle Fullscreen"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 2. RIBBON MENU TABS */}
      <div className="bg-zinc-50 dark:bg-[#121214] border-b border-zinc-200 dark:border-zinc-800 px-2 pt-1 flex items-center gap-1 select-none shrink-0 overflow-x-auto no-scrollbar">
        <Link 
          href="/dashboard" 
          className="px-3 py-1 text-xs font-semibold text-white bg-orange-600 hover:bg-orange-700 rounded-t transition-colors mr-1 flex items-center gap-1"
        >
          <ArrowLeft className="w-3 h-3" /> Files
        </Link>

        {[
          { id: 'home', label: 'Home' },
          { id: 'insert', label: 'Insert' },
          { id: 'layout', label: 'Layout' },
          { id: 'review', label: 'Review' },
          { id: 'view', label: 'View' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveRibbonTab(tab.id as any)}
            className={`px-3 py-1 text-xs font-medium rounded-t transition-all ${
              activeRibbonTab === tab.id
                ? 'bg-white dark:bg-[#18181b] text-orange-600 dark:text-orange-400 font-bold border-t border-x border-zinc-200 dark:border-zinc-800 shadow-2xs'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-200/50 dark:hover:bg-zinc-800/50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 3. DYNAMIC RIBBON ACTION TOOLBAR (WPS Style) */}
      <div className="bg-white dark:bg-[#18181b] border-b border-zinc-200 dark:border-zinc-800 px-4 py-2 flex items-start gap-4 overflow-x-auto no-scrollbar shrink-0 shadow-sm min-h-[90px]">
        
        {/* Undo/Redo (Common across all tabs) */}
        <div className="flex flex-col gap-1 border-r border-zinc-200 dark:border-zinc-800 pr-4 justify-center h-full pt-1">
          <button 
            onClick={() => applyFormat('undo')} 
            className="flex items-center gap-2 p-1.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 text-[10px] font-medium" 
            title="Undo"
          >
            <Undo2 className="w-4 h-4" /> Undo
          </button>
          <button 
            onClick={() => applyFormat('redo')} 
            className="flex items-center gap-2 p-1.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 text-[10px] font-medium" 
            title="Redo"
          >
            <Redo2 className="w-4 h-4" /> Redo
          </button>
        </div>

        {/* HOME TAB CONTROLS */}
        {activeRibbonTab === 'home' && (
          <>
            {/* Font Family & Size */}
            <div className="flex flex-col gap-2 border-r border-zinc-200 dark:border-zinc-800 pr-4 w-40 pt-1">
              <select 
                value={fontFamily} 
                onChange={(e) => {
                  setFontFamily(e.target.value);
                  applyFormat('fontName', e.target.value);
                }}
                className="h-8 text-xs bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded px-2 outline-none text-zinc-800 dark:text-zinc-200 w-full cursor-pointer hover:bg-zinc-100"
              >
                <option value="Inter">Inter (Body)</option>
                <option value="Arial">Arial</option>
                <option value="Times New Roman">Times New Roman</option>
                <option value="Georgia">Georgia</option>
                <option value="Courier New">Courier New</option>
              </select>

              <div className="flex gap-1 w-full">
                <select 
                  value={fontSize} 
                  onChange={(e) => {
                    setFontSize(e.target.value);
                    applyFormat('fontSize', e.target.value === '18' ? '5' : e.target.value === '14' ? '4' : '3');
                  }}
                  className="h-7 text-xs bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded px-1.5 outline-none text-zinc-800 dark:text-zinc-200 flex-1 cursor-pointer hover:bg-zinc-100"
                >
                  <option value="9">9</option>
                  <option value="10">10</option>
                  <option value="11">11</option>
                  <option value="12">12</option>
                  <option value="14">14</option>
                  <option value="18">18</option>
                </select>
                <button
                  onClick={() => applyFormat('removeFormat')}
                  className="p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 hover:text-zinc-900 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center bg-zinc-50 dark:bg-zinc-900"
                  title="Clear Formatting"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Styling: Bold, Italic, Underline, Strikethrough */}
            <div className="flex gap-1 border-r border-zinc-200 dark:border-zinc-800 pr-4">
              <button 
                onClick={() => { setIsBold(!isBold); applyFormat('bold'); }}
                className={`flex flex-col items-center justify-center gap-1.5 p-2 w-12 rounded-md ${isBold ? 'bg-orange-100 dark:bg-orange-950/60 text-orange-600 border border-orange-200 font-bold' : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-transparent'}`}
                title="Bold"
              >
                <Bold className="w-5 h-5" />
                <span className="text-[9px]">Bold</span>
              </button>
              <button 
                onClick={() => { setIsItalic(!isItalic); applyFormat('italic'); }}
                className={`flex flex-col items-center justify-center gap-1.5 p-2 w-12 rounded-md ${isItalic ? 'bg-orange-100 dark:bg-orange-950/60 text-orange-600 border border-orange-200 font-bold' : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-transparent'}`}
                title="Italic"
              >
                <Italic className="w-5 h-5" />
                <span className="text-[9px]">Italic</span>
              </button>
              <button 
                onClick={() => { setIsUnderline(!isUnderline); applyFormat('underline'); }}
                className={`flex flex-col items-center justify-center gap-1.5 p-2 w-14 rounded-md ${isUnderline ? 'bg-orange-100 dark:bg-orange-950/60 text-orange-600 border border-orange-200 font-bold' : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-transparent'}`}
                title="Underline"
              >
                <Underline className="w-5 h-5" />
                <span className="text-[9px]">Undrln</span>
              </button>
            </div>

            {/* Colors: Text Color & Highlight Color */}
            <div className="flex items-center gap-1 border-r border-zinc-200 dark:border-zinc-800 pr-2">
              <div className="relative">
                <button
                  onClick={() => setShowTextColorMenu(!showTextColorMenu)}
                  className="px-1.5 py-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs flex items-center gap-0.5 font-bold text-orange-600"
                  title="Text Color"
                >
                  <span>A</span>
                  <ChevronDown className="w-2.5 h-2.5" />
                </button>
                {showTextColorMenu && (
                  <div className="absolute top-full left-0 mt-1 w-32 bg-white dark:bg-[#18181b] border border-zinc-200 dark:border-zinc-700 rounded shadow-lg p-1.5 z-50 flex flex-col gap-1 text-xs">
                    {TEXT_COLORS.map(c => (
                      <button
                        key={c.label}
                        onClick={() => {
                          applyFormat('foreColor', c.value || '#000000');
                          setShowTextColorMenu(false);
                        }}
                        className="flex items-center gap-2 px-2 py-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-left"
                      >
                        <span className="w-3 h-3 rounded-full border border-zinc-300" style={{ backgroundColor: c.value || '#000' }} />
                        <span>{c.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="relative">
                <button
                  onClick={() => setShowHighlightColorMenu(!showHighlightColorMenu)}
                  className="px-1.5 py-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs flex items-center gap-0.5 text-amber-600"
                  title="Highlight Text"
                >
                  <Highlighter className="w-3.5 h-3.5" />
                  <ChevronDown className="w-2.5 h-2.5" />
                </button>
                {showHighlightColorMenu && (
                  <div className="absolute top-full left-0 mt-1 w-32 bg-white dark:bg-[#18181b] border border-zinc-200 dark:border-zinc-700 rounded shadow-lg p-1.5 z-50 flex flex-col gap-1 text-xs">
                    {HIGHLIGHT_COLORS.map(c => (
                      <button
                        key={c.label}
                        onClick={() => {
                          applyFormat('hiliteColor', c.value);
                          setShowHighlightColorMenu(false);
                        }}
                        className="flex items-center gap-2 px-2 py-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-left"
                      >
                        <span className="w-3 h-3 rounded border border-zinc-300" style={{ backgroundColor: c.value }} />
                        <span>{c.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Alignment and Lists */}
            <div className="flex gap-1 border-r border-zinc-200 dark:border-zinc-800 pr-4">
              <button 
                onClick={() => { setTextAlign('left'); applyFormat('justifyLeft'); }}
                className={`flex flex-col items-center justify-center gap-1.5 p-2 w-12 rounded-md ${textAlign === 'left' ? 'bg-orange-100 dark:bg-orange-950/60 text-orange-600 border border-orange-200' : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-transparent'}`}
                title="Align Left"
              >
                <AlignLeft className="w-5 h-5" />
                <span className="text-[9px]">Left</span>
              </button>
              <button 
                onClick={() => { setTextAlign('center'); applyFormat('justifyCenter'); }}
                className={`flex flex-col items-center justify-center gap-1.5 p-2 w-14 rounded-md ${textAlign === 'center' ? 'bg-orange-100 dark:bg-orange-950/60 text-orange-600 border border-orange-200' : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-transparent'}`}
                title="Center"
              >
                <AlignCenter className="w-5 h-5" />
                <span className="text-[9px]">Center</span>
              </button>
              <button 
                onClick={() => applyFormat('insertUnorderedList')}
                className="flex flex-col items-center justify-center gap-1.5 p-2 w-14 rounded-md text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                title="Bulleted List"
              >
                <List className="w-5 h-5" />
                <span className="text-[9px]">Bullets</span>
              </button>
            </div>

            {/* Extended WPS Style Tools */}
            <div className="flex gap-1 border-r border-zinc-200 dark:border-zinc-800 pr-4">
              <button 
                onClick={() => {
                  const query = window.prompt('Enter text to find:');
                  if (query) {
                    const found = window.find(query);
                    if (!found) showToast(`"${query}" not found.`);
                  }
                }}
                className="flex flex-col items-center justify-center gap-1.5 p-2 w-14 rounded-md text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                <Search className="w-5 h-5 text-blue-500" />
                <span className="text-[9px]">Find</span>
              </button>
              <button 
                onClick={() => {
                  setSpellCheckEnabled(!spellCheckEnabled);
                  showToast(`Spell check ${!spellCheckEnabled ? 'enabled' : 'disabled'}`);
                }}
                className={`flex flex-col items-center justify-center gap-1.5 p-2 w-16 rounded-md ${spellCheckEnabled ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'hover:bg-zinc-100 dark:hover:bg-zinc-800'} text-zinc-700 dark:text-zinc-300 transition-colors`}
              >
                <SpellCheck className="w-5 h-5 text-emerald-500" />
                <span className="text-[9px]">Spell<br/>Check</span>
              </button>
              <button 
                onClick={() => {
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.accept = 'image/*';
                  input.onchange = (e: any) => {
                    const file = e.target.files[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = (re) => {
                        applyFormat('insertImage', re.target?.result as string);
                        showToast('Image inserted');
                      };
                      reader.readAsDataURL(file);
                    }
                  };
                  input.click();
                }}
                className="flex flex-col items-center justify-center gap-1.5 p-2 w-14 rounded-md text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                <ImageIcon className="w-5 h-5 text-slate-500" />
                <span className="text-[9px]">Picture</span>
              </button>
            </div>

            {/* AI Tools */}
            <div className="flex gap-1 pr-4">
              <button 
                onClick={() => setShowAiModal(true)}
                className="flex flex-col items-center justify-center gap-1.5 p-2 w-16 rounded-md text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 transition-colors border border-transparent hover:border-amber-200"
              >
                <Sparkles className="w-5 h-5 text-amber-500" />
                <span className="text-[9px] font-semibold text-center leading-tight">AI<br/>Write</span>
              </button>
            </div>
          </>
        )}

        {/* INSERT TAB CONTROLS */}
        {activeRibbonTab === 'insert' && (
          <>
            <button
              onClick={insertTable}
              className="flex items-center gap-1 px-2.5 py-1 rounded bg-zinc-100 dark:bg-zinc-800 hover:bg-orange-100 dark:hover:bg-orange-950/60 text-zinc-800 dark:text-zinc-200 text-xs font-medium"
              title="Insert a 3x3 table with headers"
            >
              <TableIcon className="w-3.5 h-3.5 text-orange-500" />
              <span>Table</span>
            </button>

            <button
              onClick={insertCallout}
              className="flex items-center gap-1 px-2.5 py-1 rounded bg-zinc-100 dark:bg-zinc-800 hover:bg-orange-100 dark:hover:bg-orange-950/60 text-zinc-800 dark:text-zinc-200 text-xs font-medium"
              title="Insert a highlighted thesis or citation blockquote"
            >
              <Quote className="w-3.5 h-3.5 text-orange-500" />
              <span>Quote Callout</span>
            </button>

            <button
              onClick={insertCitation}
              className="flex items-center gap-1 px-2.5 py-1 rounded bg-zinc-100 dark:bg-zinc-800 hover:bg-orange-100 dark:hover:bg-orange-950/60 text-zinc-800 dark:text-zinc-200 text-xs font-medium"
              title="Insert an APA style citation placeholder"
            >
              <BookOpen className="w-3.5 h-3.5 text-orange-500" />
              <span>Citation Stamp</span>
            </button>

            <button
              onClick={insertHorizontalDivider}
              className="flex items-center gap-1 px-2.5 py-1 rounded bg-zinc-100 dark:bg-zinc-800 hover:bg-orange-100 dark:hover:bg-orange-950/60 text-zinc-800 dark:text-zinc-200 text-xs font-medium"
              title="Insert horizontal divider rule"
            >
              <Minus className="w-3.5 h-3.5 text-orange-500" />
              <span>Divider</span>
            </button>

            <button
              onClick={insertDate}
              className="flex items-center gap-1 px-2.5 py-1 rounded bg-zinc-100 dark:bg-zinc-800 hover:bg-orange-100 dark:hover:bg-orange-950/60 text-zinc-800 dark:text-zinc-200 text-xs font-medium"
              title="Insert current date"
            >
              <Calendar className="w-3.5 h-3.5 text-orange-500" />
              <span>Current Date</span>
            </button>
          </>
        )}

        {/* LAYOUT TAB CONTROLS */}
        {activeRibbonTab === 'layout' && (
          <>
            <div className="flex items-center gap-1 border-r border-zinc-200 dark:border-zinc-800 pr-2">
              <span className="text-[11px] text-zinc-400 font-medium mr-1">Margins:</span>
              <button
                onClick={() => setPageMargin('normal')}
                className={`px-2 py-1 rounded text-xs ${pageMargin === 'normal' ? 'bg-orange-100 dark:bg-orange-950/60 text-orange-600 font-bold' : 'text-zinc-700 dark:text-zinc-300'}`}
              >
                Normal (1 in)
              </button>
              <button
                onClick={() => setPageMargin('narrow')}
                className={`px-2 py-1 rounded text-xs ${pageMargin === 'narrow' ? 'bg-orange-100 dark:bg-orange-950/60 text-orange-600 font-bold' : 'text-zinc-700 dark:text-zinc-300'}`}
              >
                Narrow
              </button>
              <button
                onClick={() => setPageMargin('wide')}
                className={`px-2 py-1 rounded text-xs ${pageMargin === 'wide' ? 'bg-orange-100 dark:bg-orange-950/60 text-orange-600 font-bold' : 'text-zinc-700 dark:text-zinc-300'}`}
              >
                Wide
              </button>
            </div>

            <div className="flex items-center gap-1 border-r border-zinc-200 dark:border-zinc-800 pr-2">
              <span className="text-[11px] text-zinc-400 font-medium mr-1">Spacing:</span>
              <button
                onClick={() => setLineSpacing('1.15')}
                className={`px-2 py-1 rounded text-xs ${lineSpacing === '1.15' ? 'bg-orange-100 dark:bg-orange-950/60 text-orange-600 font-bold' : 'text-zinc-700 dark:text-zinc-300'}`}
              >
                1.15x
              </button>
              <button
                onClick={() => setLineSpacing('1.5')}
                className={`px-2 py-1 rounded text-xs ${lineSpacing === '1.5' ? 'bg-orange-100 dark:bg-orange-950/60 text-orange-600 font-bold' : 'text-zinc-700 dark:text-zinc-300'}`}
              >
                1.5x
              </button>
              <button
                onClick={() => setLineSpacing('2.0')}
                className={`px-2 py-1 rounded text-xs ${lineSpacing === '2.0' ? 'bg-orange-100 dark:bg-orange-950/60 text-orange-600 font-bold' : 'text-zinc-700 dark:text-zinc-300'}`}
                title="Double spacing for college essays"
              >
                2.0x (Academic)
              </button>
            </div>

            <div className="flex items-center gap-1">
              <span className="text-[11px] text-zinc-400 font-medium mr-1">Paper:</span>
              <button
                onClick={() => setPaperTheme('white')}
                className={`px-2 py-1 rounded text-xs ${paperTheme === 'white' ? 'bg-orange-100 dark:bg-orange-950/60 text-orange-600 font-bold' : 'text-zinc-700 dark:text-zinc-300'}`}
              >
                White
              </button>
              <button
                onClick={() => setPaperTheme('cream')}
                className={`px-2 py-1 rounded text-xs ${paperTheme === 'cream' ? 'bg-orange-100 dark:bg-orange-950/60 text-orange-600 font-bold' : 'text-zinc-700 dark:text-zinc-300'}`}
              >
                Ivory Cream
              </button>
            </div>
          </>
        )}

        {/* REVIEW TAB CONTROLS */}
        {activeRibbonTab === 'review' && (
          <>
            <div className="flex items-center gap-3 border-r border-zinc-200 dark:border-zinc-800 pr-3 text-xs text-zinc-600 dark:text-zinc-300">
              <span><strong>{wordCount}</strong> words</span>
              <span><strong>{charCount}</strong> chars</span>
              <span>~{Math.max(1, Math.ceil(wordCount / 200))} min read</span>
            </div>

            <button
              onClick={() => {
                setSpellCheckEnabled(!spellCheckEnabled);
                showToast(`Spellcheck ${!spellCheckEnabled ? 'Enabled' : 'Disabled'}`);
              }}
              className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium ${spellCheckEnabled ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800' : 'text-zinc-600'}`}
            >
              <Check className="w-3.5 h-3.5" />
              <span>Spellcheck: {spellCheckEnabled ? 'On' : 'Off'}</span>
            </button>

            <button
              onClick={() => {
                setAiPresetAction('polish');
                setShowAiModal(true);
              }}
              className="flex items-center gap-1 px-2.5 py-1 rounded bg-orange-50 dark:bg-orange-950/40 border border-orange-200 dark:border-orange-800/60 text-orange-700 dark:text-orange-400 text-xs font-semibold"
            >
              <Sparkles className="w-3.5 h-3.5 text-orange-500" />
              <span>Zen AI Proofreader</span>
            </button>

            <button
              onClick={() => {
                setAiPresetAction('cite');
                setShowAiModal(true);
              }}
              className="flex items-center gap-1 px-2.5 py-1 rounded bg-orange-50 dark:bg-orange-950/40 border border-orange-200 dark:border-orange-800/60 text-orange-700 dark:text-orange-400 text-xs font-semibold"
            >
              <BookOpen className="w-3.5 h-3.5 text-orange-500" />
              <span>Format APA / MLA</span>
            </button>
          </>
        )}

        {/* VIEW TAB CONTROLS */}
        {activeRibbonTab === 'view' && (
          <>
            <div className="flex items-center gap-1 border-r border-zinc-200 dark:border-zinc-800 pr-2 text-zinc-700 dark:text-zinc-300">
              <button 
                onClick={() => setZoom(z => Math.max(50, z - 10))} 
                className="px-2 py-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-bold"
                title="Zoom Out"
              >
                - Zoom
              </button>
              <button 
                onClick={() => setZoom(100)}
                className="px-2 py-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-mono"
                title="Reset Zoom to 100%"
              >
                {zoom}%
              </button>
              <button 
                onClick={() => setZoom(z => Math.min(200, z + 10))} 
                className="px-2 py-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-bold"
                title="Zoom In"
              >
                + Zoom
              </button>
            </div>

            <button
              onClick={handleFullscreen}
              className="flex items-center gap-1 px-2.5 py-1 rounded bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 text-zinc-800 dark:text-zinc-200 text-xs"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span>Fullscreen</span>
            </button>

            <button
              onClick={() => window.print()}
              className="flex items-center gap-1 px-2.5 py-1 rounded bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 text-zinc-800 dark:text-zinc-200 text-xs"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Preview</span>
            </button>
          </>
        )}

      </div>

      {/* ZEN AI COMMAND BAR */}
      <div className="bg-zinc-100 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 px-4 py-2 shrink-0 flex items-center justify-center">
        <div className="w-full max-w-[850px] relative flex items-center shadow-sm rounded-lg overflow-hidden border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 focus-within:ring-2 focus-within:ring-orange-500/50 focus-within:border-orange-500 transition-all">
          <div className="pl-3 pr-2 flex items-center justify-center text-orange-500">
            <Sparkles className="w-4 h-4" />
          </div>
          <form onSubmit={handleAiCommand} className="flex-1 flex items-center">
            <input 
              type="text" 
              value={aiCommandText}
              onChange={(e) => setAiCommandText(e.target.value)}
              placeholder="Ask ZenAI to write, summarize, or format..."
              className="flex-1 h-9 bg-transparent border-none outline-none text-sm px-1 text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-400"
              disabled={isGenerating}
            />
            <Button 
              type="submit"
              disabled={isGenerating || !aiCommandText.trim()}
              variant="ghost"
              className="h-9 px-3 rounded-none text-orange-600 hover:text-orange-700 hover:bg-orange-50 dark:hover:bg-orange-900/30"
            >
              {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
            </Button>
          </form>
        </div>
      </div>

      {/* 4. A4 DOCUMENT WORKSPACE CANVAS */}
      <div className="flex-1 overflow-auto p-4 sm:p-8 flex justify-center bg-zinc-200/70 dark:bg-[#000000]">
        <div 
          className={`w-full max-w-[850px] min-h-[1056px] h-fit shadow-sm rounded-sm border border-zinc-300 dark:border-zinc-800/80 ${getPaddingClass()} ${getPaperBg()} select-text`}
          style={{ zoom: zoom / 100, marginBottom: '4rem' }}
        >
          {/* Header Metadata */}
          <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-4 mb-8 text-[11px] text-zinc-400 select-none">
            <span className="font-semibold tracking-wider uppercase text-orange-600 dark:text-orange-500">{docTitle}</span>
            <span>ZenOffice Academic Workspace</span>
          </div>

          {/* Editable Document Body */}
          <div 
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            spellCheck={spellCheckEnabled}
            onInput={handleContentInput}
            className="outline-none space-y-6 leading-relaxed min-h-[600px]"
            style={{ 
              fontFamily, 
              lineHeight: lineSpacing === '2.0' ? '2.0' : lineSpacing === '1.5' ? '1.6' : '1.3' 
            }}
          >
            <h1 className="text-3xl font-extrabold tracking-tight text-zinc-950 dark:text-white pb-2 border-b-2 border-orange-600">
              {docTitle.replace(/\.[^/.]+$/, '')}
            </h1>

            <p><br /></p>
          </div>
        </div>
      </div>

      {/* 5. STATUS BAR */}
      <div className="h-6 bg-zinc-200 dark:bg-[#0c0c0e] border-t border-zinc-300 dark:border-zinc-800 px-4 flex items-center justify-between text-[11px] text-zinc-600 dark:text-zinc-400 shrink-0 select-none">
        <div className="flex items-center gap-4">
          <span>Words: <strong>{wordCount}</strong></span>
          <span>Characters: <strong>{charCount}</strong></span>
          <span>Reading Time: <strong>~{Math.max(1, Math.ceil(wordCount / 200))} min</strong></span>
          <span>Font: <strong>{fontFamily}</strong></span>
          <span>Status: <strong>Ready (Saved Offline)</strong></span>
        </div>

        <div className="flex items-center gap-3">
          <button onClick={() => setZoom(z => Math.max(50, z - 10))} className="hover:text-orange-500 font-bold">-</button>
          <span className="font-mono">{zoom}%</span>
          <button onClick={() => setZoom(z => Math.min(200, z + 10))} className="hover:text-orange-500 font-bold">+</button>
        </div>
      </div>

      {/* Floating Notification Toast */}
      {notification && (
        <div className="fixed bottom-8 right-5 z-50 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-4 py-2.5 rounded-lg shadow-xl text-xs font-medium flex items-center gap-2 border border-zinc-700 dark:border-zinc-300 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
          <span>{notification}</span>
        </div>
      )}

      {/* Zen AI Academic Writing Copilot Modal */}
      <ZenAiDialog
        isOpen={showAiModal}
        onClose={() => setShowAiModal(false)}
        documentContext={editorRef.current?.innerText || ''}
        documentTitle={docTitle}
        editorType="document"
        onInsert={(text) => {
          handleInsertAiText(text);
          setShowAiModal(false);
        }}
      />

    </div>
  );
}

export default function DocumentEditorPage() {
  return (
    <Suspense fallback={
      <div className="h-screen w-screen bg-[#000000] flex flex-col items-center justify-center text-orange-500 gap-3">
        <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm font-semibold tracking-wide text-zinc-400">Loading ZenOffice Document...</span>
      </div>
    }>
      <DocumentEditorInner />
    </Suspense>
  );
}

