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
  Languages, GraduationCap, LayoutTemplate, Loader2, Wand2,
  Save, FolderOpen, FileDown, CheckCheck, Paintbrush, 
  Subscript, Superscript, PaintBucket, Split, Sliders,
  Eye, FileSignature, AlertCircle, RefreshCw, ZoomIn, ZoomOut,
  Maximize, Minimize, ShieldCheck, CheckSquare, Sparkle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ZenFileSyncService, ZenDocumentItem } from '@/lib/firebase-sync';
import { 
  renderDocxToElement, 
  parseDocxToHtml, 
  exportHtmlToWordDocument,
  dataUrlToArrayBuffer 
} from '@/lib/docx-service';
import { ZenAiDialog } from '@/components/shared/zen-ai-dialog';

const FONT_FAMILIES = [
  'Times New Roman',
  'Calibri',
  'Arial',
  'Inter',
  'Georgia',
  'Courier New',
  'Segoe UI',
];

const FONT_SIZES = [
  '8', '9', '10', '11', '12', '14', '16', '18', '20', '22', '24', '28', '32', '36', '48', '72'
];

const TEXT_COLORS = [
  { label: 'Automatic Black', value: '#18181b' },
  { label: 'Zen Orange', value: '#ea580c' },
  { label: 'Deep Blue', value: '#1d4ed8' },
  { label: 'Forest Green', value: '#15803d' },
  { label: 'Crimson Red', value: '#b91c1c' },
  { label: 'Purple Violet', value: '#7e22ce' },
  { label: 'Muted Zinc', value: '#71717a' },
];

const HIGHLIGHT_COLORS = [
  { label: 'No Highlight', value: 'transparent' },
  { label: 'Bright Yellow', value: '#fef08a' },
  { label: 'Warm Orange', value: '#fed7aa' },
  { label: 'Soft Green', value: '#bbf7d0' },
  { label: 'Sky Blue', value: '#bfdbfe' },
  { label: 'Lavender Purple', value: '#e9d5ff' },
];

function DocumentEditorInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const docParam = searchParams.get('doc') || searchParams.get('id') || '';

  // Document state
  const [docTitle, setDocTitle] = useState(docParam ? decodeURIComponent(docParam) : 'Untitled_Document.docx');
  const [currentDoc, setCurrentDoc] = useState<ZenDocumentItem | null>(null);
  const [isLoadingDoc, setIsLoadingDoc] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [hasStalePlaceholder, setHasStalePlaceholder] = useState(false);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Ribbon & Navigation
  const [activeRibbonTab, setActiveRibbonTab] = useState<'home' | 'insert' | 'layout' | 'references' | 'review' | 'view' | 'tools' | 'zen-ai'>('home');
  const [zoom, setZoom] = useState(100);
  const [notification, setNotification] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'page' | 'web' | 'fullscreen'>('page');

  // Formatting state (Matching WPS Office Image 2 default: Times New Roman, 12pt)
  const [fontFamily, setFontFamily] = useState('Times New Roman');
  const [fontSize, setFontSize] = useState('12');
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [isUnderline, setIsUnderline] = useState(false);
  const [isStrikethrough, setIsStrikethrough] = useState(false);
  const [isSubscript, setIsSubscript] = useState(false);
  const [isSuperscript, setIsSuperscript] = useState(false);
  const [activeColor, setActiveColor] = useState('#18181b');
  const [activeHighlight, setActiveHighlight] = useState('transparent');
  const [isFormatPainterActive, setIsFormatPainterActive] = useState(false);
  const [copiedStyles, setCopiedStyles] = useState<string | null>(null);

  // Layout settings
  const [pageMargin, setPageMargin] = useState<'normal' | 'narrow' | 'wide'>('normal');
  const [lineSpacing, setLineSpacing] = useState<'1.0' | '1.15' | '1.5' | '2.0'>('1.15');
  const [paperTheme, setPaperTheme] = useState<'white' | 'cream' | 'dark'>('white');
  const [spellCheckEnabled, setSpellCheckEnabled] = useState(true);
  const [showCropMarks, setShowCropMarks] = useState(true);

  // Popover menus
  const [showTextColorMenu, setShowTextColorMenu] = useState(false);
  const [showHighlightColorMenu, setShowHighlightColorMenu] = useState(false);
  const [showUnderlineMenu, setShowUnderlineMenu] = useState(false);
  const [showCaseMenu, setShowCaseMenu] = useState(false);
  const [showSpacingMenu, setShowSpacingMenu] = useState(false);
  const [showPasteMenu, setShowPasteMenu] = useState(false);
  const [showFindReplaceModal, setShowFindReplaceModal] = useState(false);
  const [findText, setFindText] = useState('');
  const [replaceText, setReplaceText] = useState('');

  // Zen AI Academic Writing Dialog
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiPresetAction, setAiPresetAction] = useState<'polish' | 'cite' | 'summarize' | 'chat'>('polish');

  // AI Command Bar State
  const [aiCommandText, setAiCommandText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  // Document Content Editable Refs / State
  const editorRef = useRef<HTMLDivElement>(null);
  const [wordCount, setWordCount] = useState(221);
  const [charCount, setCharCount] = useState(1450);

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
        setIsLoadingDoc(true);
        try {
          const found = await ZenFileSyncService.getDocument(docParam);
          if (!active) return;
          if (found) {
            setCurrentDoc(found);
            setDocTitle(found.name);

            if (found.fileData && editorRef.current) {
              const lowerName = found.name.toLowerCase();
              const isDocx = lowerName.endsWith('.docx') || 
                             lowerName.endsWith('.doc') || 
                             found.type === 'word';

              const isStalePlaceholder = found.fileData.includes('Binary content cannot be previewed directly') ||
                                         found.fileData.includes('Document loaded (Binary content');

              const isRawHtml = found.fileData.trim().startsWith('<') || 
                                found.fileData.includes('zen-wps-docx') || 
                                found.fileData.includes('</p>') || 
                                found.fileData.includes('</div>');

              if (isStalePlaceholder) {
                // If it had the old placeholder string, flag it so user can reload with 1 click
                setHasStalePlaceholder(true);
                editorRef.current.innerHTML = found.fileData;
              } else if (isDocx && !isRawHtml && (found.fileData.startsWith('data:') || found.fileData.startsWith('UEsDB'))) {
                // Render with docx-preview for pixel-perfect A4 WPS Office layout
                try {
                  const res = await renderDocxToElement(found.fileData, editorRef.current);
                  setTotalPages(res.pageCount);
                  setHasStalePlaceholder(false);
                  handleContentInput();
                  showToast(`Rendered ${found.name} in WPS Office layout`);
                } catch (previewErr) {
                  console.warn('docx-preview fallback to mammoth:', previewErr);
                  try {
                    const result = await parseDocxToHtml(found.fileData);
                    if (active && editorRef.current) {
                      editorRef.current.innerHTML = result.html || '<p><br/></p>';
                      handleContentInput();
                      showToast(`Parsed ${found.name}`);
                    }
                  } catch (mammothErr) {
                    console.error('Failed to parse docx with mammoth:', mammothErr);
                    if (active && editorRef.current) {
                      editorRef.current.innerHTML = found.fileData;
                      handleContentInput();
                    }
                  }
                }
              } else {
                // Raw HTML or string content from saved document
                editorRef.current.innerHTML = found.fileData;
                const editableTargets = editorRef.current.querySelectorAll(
                  'section.zen-wps-docx, .zen-wps-docx-wrapper, .zen-wps-docx article, .zen-wps-docx p, .zen-wps-docx h1, .zen-wps-docx h2, .zen-wps-docx h3, .zen-wps-docx table, .zen-wps-docx td, .zen-wps-docx th, .zen-wps-docx span'
                );
                editableTargets.forEach((node) => {
                  const el = node as HTMLElement;
                  el.contentEditable = 'true';
                });
                handleContentInput();
              }
            }
          }
        } catch (err) {
          console.error('Failed to load document:', err);
          showToast('Failed to load document');
        } finally {
          if (active) setIsLoadingDoc(false);
        }
      }

      // Check for incoming extracted text from PDF/OCR
      const extractedText = localStorage.getItem('zen_extracted_text');
      if (extractedText && editorRef.current) {
        editorRef.current.innerHTML = extractedText.replace(/\n/g, '<br/>');
        localStorage.removeItem('zen_extracted_text');
        setDocTitle('Extracted_Document.docx');
        handleContentInput();
      }
    }

    loadDoc();
    return () => { active = false; };
  }, [docParam, router]);

  // Handle local file picking & drag-drop
  const processAndLoadFile = async (file: File) => {
    setIsLoadingDoc(true);
    setDocTitle(file.name);
    setHasStalePlaceholder(false);
    try {
      const savedDoc = await ZenFileSyncService.addUploadedFile(file, 'Documents');
      setCurrentDoc(savedDoc);

      const ext = file.name.split('.').pop()?.toLowerCase();
      if (ext === 'docx' || ext === 'doc') {
        const arrayBuffer = await file.arrayBuffer();
        if (editorRef.current) {
          try {
            const res = await renderDocxToElement(arrayBuffer, editorRef.current);
            setTotalPages(res.pageCount);
            handleContentInput();
            setHasUnsavedChanges(false);
            showToast(`Opened ${file.name} in WPS Office layout`);
          } catch (renderErr) {
            console.warn('Render fallback to mammoth:', renderErr);
            const result = await parseDocxToHtml(arrayBuffer);
            editorRef.current.innerHTML = result.html || '<p><br/></p>';
            handleContentInput();
            setHasUnsavedChanges(false);
            showToast(`Opened ${file.name}`);
          }
        }
      } else {
        const text = await file.text();
        if (editorRef.current) {
          editorRef.current.innerHTML = text.replace(/\n/g, '<br/>');
          handleContentInput();
          setHasUnsavedChanges(false);
          showToast(`Opened ${file.name}`);
        }
      }
    } catch (err) {
      console.error('Failed to open file:', err);
      showToast('Error opening file.');
    } finally {
      setIsLoadingDoc(false);
    }
  };

  const handleOpenLocalFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    await processAndLoadFile(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSaveDocument = async (silent = false) => {
    if (!editorRef.current || isSaving) return;
    setIsSaving(true);
    try {
      const content = editorRef.current.innerHTML;
      const filename = docTitle.includes('.') ? docTitle : `${docTitle}.docx`;
      const targetId = currentDoc?.id || filename;
      
      const updated = await ZenFileSyncService.saveDocument({
        id: targetId,
        name: filename,
        type: 'word',
        category: 'Documents',
        fileData: content,
        size: `${Math.max(1, Math.round(content.length / 1024))} KB`,
        sizeBytes: content.length,
        modified: new Date().toLocaleDateString(),
        synced: true,
      });

      if (updated) setCurrentDoc(updated);
      setHasUnsavedChanges(false);
      if (!silent) {
        showToast('Document saved successfully');
      }
    } catch (err) {
      console.error('Error saving document:', err);
      if (!silent) {
        showToast('Failed to save document');
      }
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
  }, [hasUnsavedChanges, isSaving]);

  // Keyboard shortcuts (Ctrl+S, Ctrl+E, Ctrl+F, Ctrl+B, Ctrl+I, Ctrl+U)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSaveDocument();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'e') {
        e.preventDefault();
        setShowAiModal(prev => !prev);
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        setShowFindReplaceModal(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentDoc, docTitle]);

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
    setHasUnsavedChanges(true);
    handleContentInput();
  };

  const handleStyleChange = (tag: string) => {
    applyFormat('formatBlock', tag);
    showToast(`Applied ${tag.toUpperCase()}`);
  };

  // Font size increment/decrement
  const changeFontSize = (delta: number) => {
    const current = parseInt(fontSize, 10) || 12;
    const next = Math.max(8, Math.min(72, current + delta));
    setFontSize(String(next));
    applyFormat('fontSize', next >= 24 ? '6' : next >= 18 ? '5' : next >= 14 ? '4' : next >= 12 ? '3' : '2');
  };

  // Change Case (Sentence, lower, UPPER, Capitalize)
  const handleChangeCase = (mode: 'upper' | 'lower' | 'title' | 'sentence') => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    const text = selection.toString();
    if (!text) return;

    let transformed = text;
    if (mode === 'upper') transformed = text.toUpperCase();
    else if (mode === 'lower') transformed = text.toLowerCase();
    else if (mode === 'title') transformed = text.replace(/\b\w/g, c => c.toUpperCase());
    else if (mode === 'sentence') transformed = text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();

    applyFormat('insertText', transformed);
    setShowCaseMenu(false);
  };

  // Format Painter
  const handleFormatPainter = () => {
    if (!isFormatPainterActive) {
      setIsFormatPainterActive(true);
      showToast('Format Painter: Click any text to apply copied formatting');
    } else {
      setIsFormatPainterActive(false);
    }
  };

  // Find & Replace
  const handleFindReplace = (replaceCurrentOnly = false) => {
    if (!findText.trim() || !editorRef.current) return;
    const content = editorRef.current.innerHTML;
    if (!content.includes(findText)) {
      showToast('Text not found in document');
      return;
    }

    if (replaceCurrentOnly) {
      editorRef.current.innerHTML = content.replace(findText, replaceText);
      showToast(`Replaced first match of "${findText}"`);
    } else {
      const regex = new RegExp(findText, 'g');
      editorRef.current.innerHTML = content.replace(regex, replaceText);
      showToast(`Replaced all matches of "${findText}"`);
    }
    setHasUnsavedChanges(true);
    handleContentInput();
  };

  // Insert Table
  const insertTable = (rows = 3, cols = 3) => {
    let tableHtml = '<table class="zen-docx-table" style="width: 100%; border-collapse: collapse; margin: 1.25rem 0; font-size: 13px; border: 1px solid #d4d4d8;"><thead><tr style="background-color: #f4f4f5;">';
    for (let c = 0; c < cols; c++) {
      tableHtml += `<th style="padding: 8px 12px; border: 1px solid #d4d4d8; text-align: left; font-weight: bold;">Header ${c + 1}</th>`;
    }
    tableHtml += '</tr></thead><tbody>';
    for (let r = 0; r < rows - 1; r++) {
      tableHtml += '<tr>';
      for (let c = 0; c < cols; c++) {
        tableHtml += `<td style="padding: 8px 12px; border: 1px solid #e4e4e7;">Data ${r + 1}, ${c + 1}</td>`;
      }
      tableHtml += '</tr>';
    }
    tableHtml += '</tbody></table><p><br></p>';
    applyFormat('insertHTML', tableHtml);
  };

  // Insert Callout Blockquote
  const insertCallout = () => {
    const calloutHtml = `
      <blockquote style="border-left: 4px solid #ea580c; padding-left: 1rem; margin: 1rem 0; color: #52525b; font-style: italic;">
        "State hypothesis, excerpt, or official notification here..."
      </blockquote><p><br></p>
    `;
    applyFormat('insertHTML', calloutHtml);
  };

  // Insert Timestamp
  const insertDate = () => {
    const now = new Date().toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
    applyFormat('insertText', ` [${now}] `);
  };

  // Insert Citation
  const insertCitation = () => {
    applyFormat('insertText', ' (Author et al., 2026)');
  };

  // Insert AI generated text into document
  const handleInsertAiText = (text: string) => {
    if (editorRef.current) {
      editorRef.current.focus();
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

  // Multi-format file export
  const handleExportWord = () => {
    const htmlContent = editorRef.current?.innerHTML || '';
    exportHtmlToWordDocument(htmlContent, docTitle);
    showToast(`Exported ${docTitle} as Word Document`);
    setShowExportMenu(false);
  };

  const handleExportHtml = () => {
    const htmlContent = editorRef.current?.innerHTML || '';
    const fullDoc = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${docTitle}</title><style>body{font-family:'Times New Roman',serif;max-width:850px;margin:2rem auto;line-height:1.5;color:#18181b;}table{width:100%;border-collapse:collapse;margin:1rem 0;}th,td{border:1px solid #d4d4d8;padding:8px;}th{background:#f4f4f5;}</style></head><body>${htmlContent}</body></html>`;
    const blob = new Blob([fullDoc], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = docTitle.replace(/\.docx?$/, '.html');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(`Exported HTML`);
    setShowExportMenu(false);
  };

  const handleExportText = () => {
    const textContent = editorRef.current?.innerText || '';
    const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = docTitle.replace(/\.docx?$/, '.txt');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(`Exported Text`);
    setShowExportMenu(false);
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
    if (pageMargin === 'narrow') return 'p-8 sm:p-12';
    if (pageMargin === 'wide') return 'p-12 sm:p-24';
    return 'p-10 sm:p-20';
  };

  // Paper theme helper
  const getPaperBg = () => {
    if (paperTheme === 'cream') return 'bg-[#fffef7] text-zinc-900';
    if (paperTheme === 'dark') return 'bg-[#121214] text-zinc-100';
    return 'bg-white dark:bg-[#121214] text-zinc-900 dark:text-zinc-100';
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#EAECEF] dark:bg-[#000000] font-sans text-zinc-800 dark:text-zinc-200">
      
      {/* Hidden file picker input for DOCX/Word files */}
      <input 
        ref={fileInputRef}
        type="file"
        accept=".docx,.doc,.txt,.html"
        className="hidden"
        onChange={handleOpenLocalFile}
      />

      {/* 1. TOP WINDOW BAR / DOCUMENT TABS */}
      <header className="h-12 bg-white dark:bg-[#0c0c0e] border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between px-3 shrink-0 select-none">
        {/* Left: Brand + Document Tab Strip */}
        <div className="flex items-center gap-1 h-full overflow-x-auto no-scrollbar items-end pt-1">
          <Link href="/dashboard" className="flex items-center gap-1.5 px-3 h-9 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors mr-1">
            <div className="w-5 h-5 rounded bg-orange-600 flex items-center justify-center text-white shadow-xs">
              <svg width="12" height="12" viewBox="0 0 200 200" fill="none">
                <path d="M44 38C44 29 51 22 60 22H118L156 60V156C156 165 149 172 140 172H60C51 172 44 165 44 156V38Z" fill="#FFFFFF"/>
                <path d="M118 22V50C118 55 122 60 128 60H156L118 22Z" fill="#FDBA74"/>
                <path d="M66 110L134 110L76 138L134 138" stroke="#EA580C" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <span className="text-xs font-bold text-zinc-900 dark:text-white tracking-tight">ZenOffice</span>
          </Link>

          {/* Active Tab (WPS style blue/orange doc badge) */}
          <div className="flex items-center gap-2 px-3.5 h-10 rounded-t-md text-xs font-semibold bg-[#F5F6F8] dark:bg-[#18181b] border-t border-x border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-xs cursor-pointer">
            <div className="w-4 h-4 rounded bg-blue-600 text-white flex items-center justify-center text-[9px] font-bold">
              W
            </div>
            <span className="max-w-[220px] truncate" title={docTitle}>{docTitle}</span>
            <span className={`text-[9px] px-1 py-0.2 rounded border ${
              hasUnsavedChanges 
                ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:border-amber-800' 
                : 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-800'
            }`}>
              {hasUnsavedChanges ? 'Unsaved' : 'Saved'}
            </span>
            <button 
              onClick={() => router.push('/dashboard')}
              className="hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 ml-1"
              title="Close Tab"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <button 
            onClick={() => {
              const newName = `Document_${Date.now().toString().slice(-4)}.docx`;
              router.push(`/editor/document?doc=${encodeURIComponent(newName)}`);
            }}
            className="w-7 h-7 rounded flex items-center justify-center text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-orange-500 transition-colors mb-1 ml-1"
            title="New Document"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* Right: Actions (Save, Open, ZenAI, Print, Export) */}
        <div className="flex items-center gap-1.5">
          {/* Open DOCX File Button */}
          <Button
            onClick={() => fileInputRef.current?.click()}
            variant="outline"
            size="sm"
            className="h-7 px-2.5 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 text-xs font-medium gap-1"
            title="Open DOCX from computer"
          >
            <FolderOpen className="w-3.5 h-3.5 text-zinc-500" /> Open
          </Button>

          {/* Quick Save Button */}
          <Button
            onClick={handleSaveDocument}
            disabled={isSaving}
            variant="outline"
            size="sm"
            className={`h-7 px-2.5 border text-xs font-medium gap-1 transition-all ${
              hasUnsavedChanges 
                ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-300 hover:bg-amber-100 hover:text-amber-900 dark:hover:text-amber-100' 
                : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 hover:text-zinc-900 dark:hover:text-zinc-100'
            }`}
            title="Save Document (Ctrl+S)"
          >
            {isSaving ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-orange-600" />
            ) : hasUnsavedChanges ? (
              <Save className="w-3.5 h-3.5 text-amber-600" />
            ) : (
              <Check className="w-3.5 h-3.5 text-emerald-600" />
            )}
            <span>{isSaving ? 'Saving...' : hasUnsavedChanges ? 'Save *' : 'Saved'}</span>
          </Button>

          {/* Zen AI Academic Writing Copilot */}
          <Button
            size="sm"
            onClick={() => setShowAiModal(true)}
            className="h-7 px-2.5 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 text-white text-xs font-semibold shadow-xs gap-1.5"
            title="ZenAI Writing Assistant"
          >
            <Sparkles className="w-3.5 h-3.5 animate-pulse text-amber-200" />
            <span className="hidden sm:inline">ZenAI Assistant</span>
          </Button>

          {/* Print */}
          <Button 
            onClick={() => window.print()}
            variant="outline" 
            size="sm" 
            className="h-7 px-2.5 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 text-xs font-medium gap-1 hidden md:flex"
            title="Print Document"
          >
            <Printer className="w-3.5 h-3.5 mr-0.5" /> Print
          </Button>

          {/* Multi-Format Export Dropdown */}
          <div className="relative">
            <Button 
              onClick={() => setShowExportMenu(!showExportMenu)}
              size="sm" 
              className="h-7 px-2.5 bg-orange-600 hover:bg-orange-700 text-white text-xs font-medium shadow-xs gap-1"
              title="Export Document"
            >
              <Download className="w-3.5 h-3.5 mr-0.5" /> Export <ChevronDown className="w-3 h-3 ml-0.5" />
            </Button>
            {showExportMenu && (
              <div className="absolute right-0 top-full mt-1 w-52 bg-white dark:bg-[#18181b] border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-xl p-1.5 z-50 flex flex-col gap-1 text-xs animate-in fade-in zoom-in-95 duration-100">
                <button
                  onClick={handleExportWord}
                  className="flex items-center gap-2.5 px-3 py-2 rounded hover:bg-orange-50 dark:hover:bg-orange-950/40 text-left text-zinc-800 dark:text-zinc-200 transition-colors"
                >
                  <FileText className="w-4 h-4 text-blue-600 shrink-0" />
                  <div>
                    <div className="font-semibold">Word Document</div>
                    <div className="text-[10px] text-zinc-400">Microsoft Word (.doc)</div>
                  </div>
                </button>
                <button
                  onClick={() => { setShowExportMenu(false); window.print(); }}
                  className="flex items-center gap-2.5 px-3 py-2 rounded hover:bg-orange-50 dark:hover:bg-orange-950/40 text-left text-zinc-800 dark:text-zinc-200 transition-colors"
                >
                  <Printer className="w-4 h-4 text-rose-500 shrink-0" />
                  <div>
                    <div className="font-semibold">PDF Document</div>
                    <div className="text-[10px] text-zinc-400">Print or Save to PDF</div>
                  </div>
                </button>
                <button
                  onClick={handleExportHtml}
                  className="flex items-center gap-2.5 px-3 py-2 rounded hover:bg-orange-50 dark:hover:bg-orange-950/40 text-left text-zinc-800 dark:text-zinc-200 transition-colors"
                >
                  <LayoutTemplate className="w-4 h-4 text-emerald-500 shrink-0" />
                  <div>
                    <div className="font-semibold">Web Page (.html)</div>
                    <div className="text-[10px] text-zinc-400">Full formatted web page</div>
                  </div>
                </button>
                <button
                  onClick={handleExportText}
                  className="flex items-center gap-2.5 px-3 py-2 rounded hover:bg-orange-50 dark:hover:bg-orange-950/40 text-left text-zinc-800 dark:text-zinc-200 transition-colors"
                >
                  <Type className="w-4 h-4 text-zinc-500 shrink-0" />
                  <div>
                    <div className="font-semibold">Plain Text (.txt)</div>
                    <div className="text-[10px] text-zinc-400">Raw unformatted text</div>
                  </div>
                </button>
              </div>
            )}
          </div>

          <button 
            onClick={handleFullscreen}
            className="p-1.5 rounded hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-500 hover:text-zinc-900"
            title="Toggle Fullscreen"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* 2. WPS OFFICE RIBBON MENU TABS (Matching Image 2) */}
      <nav className="bg-[#F9FAFB] dark:bg-[#121214] border-b border-zinc-200 dark:border-zinc-800 px-3 pt-1 flex items-center gap-1 select-none shrink-0 overflow-x-auto no-scrollbar">
        <Link 
          href="/dashboard" 
          className="px-3 py-1 text-xs font-semibold text-white bg-orange-600 hover:bg-orange-700 rounded-t transition-colors mr-2 flex items-center gap-1 shadow-2xs"
        >
          <ArrowLeft className="w-3 h-3" /> Files
        </Link>

        {[
          { id: 'home', label: 'Home' },
          { id: 'insert', label: 'Insert' },
          { id: 'layout', label: 'Page Layout' },
          { id: 'references', label: 'References' },
          { id: 'review', label: 'Review' },
          { id: 'view', label: 'View' },
          { id: 'tools', label: 'Tools' },
          { id: 'zen-ai', label: 'WPS / Zen AI' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveRibbonTab(tab.id as any)}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-t transition-all relative ${
              activeRibbonTab === tab.id
                ? 'bg-white dark:bg-[#18181b] text-blue-600 dark:text-blue-400 font-bold border-t-2 border-t-blue-600 border-x border-zinc-200 dark:border-zinc-700'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 hover:bg-zinc-200/50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {/* 3. DYNAMIC RIBBON ACTION TOOLBAR (Identical to WPS Office in Image 2) */}
      <div className="bg-white dark:bg-[#18181b] border-b border-zinc-200 dark:border-zinc-800 px-3 py-1.5 flex items-center gap-3 overflow-x-auto no-scrollbar shrink-0 shadow-2xs min-h-[58px]">
        
        {/* Undo / Redo */}
        <div className="flex items-center gap-0.5 border-r border-zinc-200 dark:border-zinc-800 pr-2">
          <button 
            onClick={() => applyFormat('undo')} 
            className="p-1 rounded hover:bg-zinc-100 text-zinc-600" 
            title="Undo (Ctrl+Z)"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button 
            onClick={() => applyFormat('redo')} 
            className="p-1 rounded hover:bg-zinc-100 text-zinc-600" 
            title="Redo (Ctrl+Y)"
          >
            <Redo2 className="w-4 h-4" />
          </button>
        </div>

        {/* HOME TAB CONTROLS (Full WPS Suite from Image 2) */}
        {activeRibbonTab === 'home' && (
          <>
            {/* 1. Clipboard: Paste & Format Painter */}
            <div className="flex items-center gap-1 border-r border-zinc-200 dark:border-zinc-800 pr-2.5">
              <button 
                onClick={() => applyFormat('paste')}
                className="flex items-center gap-1 px-2 py-1 rounded hover:bg-zinc-100 text-xs text-zinc-700 font-medium"
                title="Paste (Ctrl+V)"
              >
                <Clipboard className="w-4 h-4 text-blue-600" />
                <span>Paste</span>
              </button>
              <button 
                onClick={handleFormatPainter}
                className={`p-1.5 rounded text-xs transition-colors ${
                  isFormatPainterActive ? 'bg-blue-100 text-blue-600 border border-blue-300' : 'hover:bg-zinc-100 text-zinc-600'
                }`}
                title="Format Painter"
              >
                <Paintbrush className="w-4 h-4" />
              </button>
            </div>

            {/* 2. Font Controls: Family, Size, Grow, Shrink, Case, Clear */}
            <div className="flex items-center gap-1 border-r border-zinc-200 dark:border-zinc-800 pr-2.5">
              <select 
                value={fontFamily} 
                onChange={(e) => {
                  setFontFamily(e.target.value);
                  applyFormat('fontName', e.target.value);
                }}
                className="h-7 text-xs bg-zinc-50 border border-zinc-200 rounded px-2 outline-none text-zinc-800 w-36 cursor-pointer hover:bg-zinc-100"
              >
                {FONT_FAMILIES.map(f => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>

              <select 
                value={fontSize} 
                onChange={(e) => {
                  setFontSize(e.target.value);
                  const val = parseInt(e.target.value, 10);
                  applyFormat('fontSize', val >= 24 ? '6' : val >= 18 ? '5' : val >= 14 ? '4' : val >= 12 ? '3' : '2');
                }}
                className="h-7 text-xs bg-zinc-50 border border-zinc-200 rounded px-1.5 outline-none text-zinc-800 w-14 cursor-pointer hover:bg-zinc-100"
              >
                {FONT_SIZES.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>

              <button 
                onClick={() => changeFontSize(1)}
                className="p-1 rounded hover:bg-zinc-100 text-xs font-bold text-zinc-700" 
                title="Increase Font Size (Ctrl+])"
              >
                A⁺
              </button>
              <button 
                onClick={() => changeFontSize(-1)}
                className="p-1 rounded hover:bg-zinc-100 text-xs font-bold text-zinc-700" 
                title="Decrease Font Size (Ctrl+[)"
              >
                A⁻
              </button>

              {/* Case Change */}
              <div className="relative">
                <button 
                  onClick={() => setShowCaseMenu(!showCaseMenu)}
                  className="p-1 rounded hover:bg-zinc-100 text-xs font-medium text-zinc-700 flex items-center"
                  title="Change Case"
                >
                  <span>Aa</span>
                  <ChevronDown className="w-2.5 h-2.5 ml-0.5" />
                </button>
                {showCaseMenu && (
                  <div className="absolute top-full left-0 mt-1 w-44 bg-white border border-zinc-200 rounded shadow-lg p-1 z-50 flex flex-col text-xs">
                    <button onClick={() => handleChangeCase('sentence')} className="px-2 py-1 hover:bg-zinc-100 text-left">Sentence case</button>
                    <button onClick={() => handleChangeCase('lower')} className="px-2 py-1 hover:bg-zinc-100 text-left">lowercase</button>
                    <button onClick={() => handleChangeCase('upper')} className="px-2 py-1 hover:bg-zinc-100 text-left">UPPERCASE</button>
                    <button onClick={() => handleChangeCase('title')} className="px-2 py-1 hover:bg-zinc-100 text-left">Capitalize Each Word</button>
                  </div>
                )}
              </div>

              <button 
                onClick={() => applyFormat('removeFormat')}
                className="p-1 rounded hover:bg-zinc-100 text-zinc-500" 
                title="Clear All Formatting"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* 3. Character Formatting: Bold, Italic, Underline, Strikethrough, Sub, Super, Colors */}
            <div className="flex items-center gap-0.5 border-r border-zinc-200 dark:border-zinc-800 pr-2.5">
              <button 
                onClick={() => { setIsBold(!isBold); applyFormat('bold'); }}
                className={`p-1.5 rounded ${isBold ? 'bg-blue-100 text-blue-700 font-bold' : 'hover:bg-zinc-100 text-zinc-700'}`}
                title="Bold (Ctrl+B)"
              >
                <Bold className="w-4 h-4" />
              </button>
              <button 
                onClick={() => { setIsItalic(!isItalic); applyFormat('italic'); }}
                className={`p-1.5 rounded ${isItalic ? 'bg-blue-100 text-blue-700' : 'hover:bg-zinc-100 text-zinc-700'}`}
                title="Italic (Ctrl+I)"
              >
                <Italic className="w-4 h-4" />
              </button>
              <button 
                onClick={() => { setIsUnderline(!isUnderline); applyFormat('underline'); }}
                className={`p-1.5 rounded ${isUnderline ? 'bg-blue-100 text-blue-700' : 'hover:bg-zinc-100 text-zinc-700'}`}
                title="Underline (Ctrl+U)"
              >
                <Underline className="w-4 h-4" />
              </button>
              <button 
                onClick={() => { setIsStrikethrough(!isStrikethrough); applyFormat('strikeThrough'); }}
                className={`p-1.5 rounded ${isStrikethrough ? 'bg-blue-100 text-blue-700' : 'hover:bg-zinc-100 text-zinc-700'}`}
                title="Strikethrough"
              >
                <Strikethrough className="w-4 h-4" />
              </button>
              <button 
                onClick={() => { setIsSubscript(!isSubscript); applyFormat('subscript'); }}
                className="p-1.5 rounded hover:bg-zinc-100 text-zinc-700"
                title="Subscript (X₂)"
              >
                <Subscript className="w-4 h-4" />
              </button>
              <button 
                onClick={() => { setIsSuperscript(!isSuperscript); applyFormat('superscript'); }}
                className="p-1.5 rounded hover:bg-zinc-100 text-zinc-700"
                title="Superscript (X²)"
              >
                <Superscript className="w-4 h-4" />
              </button>

              {/* Text Highlight Color */}
              <div className="relative">
                <button
                  onClick={() => setShowHighlightColorMenu(!showHighlightColorMenu)}
                  className="p-1 rounded hover:bg-zinc-100 flex items-center text-amber-600"
                  title="Highlight Color"
                >
                  <Highlighter className="w-4 h-4" />
                  <ChevronDown className="w-2.5 h-2.5 ml-0.5" />
                </button>
                {showHighlightColorMenu && (
                  <div className="absolute top-full left-0 mt-1 w-36 bg-white border border-zinc-200 rounded shadow-lg p-1.5 z-50 flex flex-col gap-1 text-xs">
                    {HIGHLIGHT_COLORS.map(c => (
                      <button
                        key={c.label}
                        onClick={() => {
                          applyFormat('hiliteColor', c.value);
                          setActiveHighlight(c.value);
                          setShowHighlightColorMenu(false);
                        }}
                        className="flex items-center gap-2 px-2 py-1 rounded hover:bg-zinc-100 text-left"
                      >
                        <span className="w-3.5 h-3.5 rounded border border-zinc-300" style={{ backgroundColor: c.value }} />
                        <span>{c.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Font Color */}
              <div className="relative">
                <button
                  onClick={() => setShowTextColorMenu(!showTextColorMenu)}
                  className="p-1 rounded hover:bg-zinc-100 flex items-center font-bold text-zinc-800"
                  title="Font Color"
                >
                  <span className="border-b-2 border-red-600 leading-none">A</span>
                  <ChevronDown className="w-2.5 h-2.5 ml-0.5" />
                </button>
                {showTextColorMenu && (
                  <div className="absolute top-full left-0 mt-1 w-36 bg-white border border-zinc-200 rounded shadow-lg p-1.5 z-50 flex flex-col gap-1 text-xs">
                    {TEXT_COLORS.map(c => (
                      <button
                        key={c.label}
                        onClick={() => {
                          applyFormat('foreColor', c.value);
                          setActiveColor(c.value);
                          setShowTextColorMenu(false);
                        }}
                        className="flex items-center gap-2 px-2 py-1 rounded hover:bg-zinc-100 text-left"
                      >
                        <span className="w-3.5 h-3.5 rounded-full border border-zinc-300" style={{ backgroundColor: c.value }} />
                        <span>{c.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* 4. Paragraph & Alignment: Bullets, Numbers, Alignments, Line spacing */}
            <div className="flex items-center gap-0.5 border-r border-zinc-200 dark:border-zinc-800 pr-2.5">
              <button 
                onClick={() => applyFormat('insertUnorderedList')}
                className="p-1.5 rounded hover:bg-zinc-100 text-zinc-700" 
                title="Bullets"
              >
                <List className="w-4 h-4" />
              </button>
              <button 
                onClick={() => applyFormat('insertOrderedList')}
                className="p-1.5 rounded hover:bg-zinc-100 text-zinc-700" 
                title="Numbering"
              >
                <ListOrdered className="w-4 h-4" />
              </button>
              <button 
                onClick={() => applyFormat('outdent')}
                className="p-1.5 rounded hover:bg-zinc-100 text-zinc-700" 
                title="Decrease Indent"
              >
                <Minus className="w-4 h-4" />
              </button>
              <button 
                onClick={() => applyFormat('indent')}
                className="p-1.5 rounded hover:bg-zinc-100 text-zinc-700" 
                title="Increase Indent"
              >
                <Plus className="w-4 h-4" />
              </button>

              <button 
                onClick={() => applyFormat('justifyLeft')}
                className="p-1.5 rounded hover:bg-zinc-100 text-zinc-700" 
                title="Align Left"
              >
                <AlignLeft className="w-4 h-4" />
              </button>
              <button 
                onClick={() => applyFormat('justifyCenter')}
                className="p-1.5 rounded hover:bg-zinc-100 text-zinc-700" 
                title="Center"
              >
                <AlignCenter className="w-4 h-4" />
              </button>
              <button 
                onClick={() => applyFormat('justifyRight')}
                className="p-1.5 rounded hover:bg-zinc-100 text-zinc-700" 
                title="Align Right"
              >
                <AlignRight className="w-4 h-4" />
              </button>
              <button 
                onClick={() => applyFormat('justifyFull')}
                className="p-1.5 rounded hover:bg-zinc-100 text-zinc-700" 
                title="Justify"
              >
                <AlignJustify className="w-4 h-4" />
              </button>

              {/* Line spacing */}
              <div className="relative">
                <button
                  onClick={() => setShowSpacingMenu(!showSpacingMenu)}
                  className="p-1.5 rounded hover:bg-zinc-100 text-zinc-700 flex items-center"
                  title="Line Spacing"
                >
                  <Sliders className="w-4 h-4" />
                </button>
                {showSpacingMenu && (
                  <div className="absolute top-full left-0 mt-1 w-32 bg-white border border-zinc-200 rounded shadow-lg p-1 z-50 flex flex-col text-xs">
                    {(['1.0', '1.15', '1.5', '2.0'] as const).map(sp => (
                      <button 
                        key={sp}
                        onClick={() => {
                          setLineSpacing(sp);
                          setShowSpacingMenu(false);
                          showToast(`Line Spacing: ${sp}x`);
                        }}
                        className={`px-2 py-1 text-left rounded ${lineSpacing === sp ? 'bg-blue-50 font-bold text-blue-600' : 'hover:bg-zinc-100'}`}
                      >
                        {sp}x
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* 5. Quick Styles Gallery (Matching Image 2: Normal, Heading 1, Heading 2) */}
            <div className="flex items-center gap-1 border-r border-zinc-200 dark:border-zinc-800 pr-2.5">
              <button
                onClick={() => handleStyleChange('p')}
                className="px-3 py-1 bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 rounded text-xs font-medium text-zinc-800"
                title="Normal Text"
              >
                Normal
              </button>
              <button
                onClick={() => handleStyleChange('h1')}
                className="px-3 py-1 bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 rounded text-xs font-bold text-zinc-900"
                title="Heading 1"
              >
                Heading 1
              </button>
              <button
                onClick={() => handleStyleChange('h2')}
                className="px-3 py-1 bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 rounded text-xs font-semibold text-zinc-800"
                title="Heading 2"
              >
                Heading 2
              </button>
            </div>

            {/* 6. AI & Productivity Tools (Matching Image 2) */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => setShowFindReplaceModal(true)}
                className="flex items-center gap-1 px-2 py-1 rounded hover:bg-zinc-100 text-xs text-zinc-700"
                title="Find and Replace (Ctrl+F)"
              >
                <Search className="w-3.5 h-3.5 text-zinc-500" />
                <span>Find</span>
              </button>

              <button
                onClick={() => {
                  setSpellCheckEnabled(!spellCheckEnabled);
                  showToast(`AI Spell Check ${!spellCheckEnabled ? 'Enabled' : 'Disabled'}`);
                }}
                className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${
                  spellCheckEnabled ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'hover:bg-zinc-100 text-zinc-600'
                }`}
                title="AI Spell Check"
              >
                <SpellCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>AI Spell Check</span>
              </button>

              <button
                onClick={() => {
                  setAiPresetAction('polish');
                  setShowAiModal(true);
                }}
                className="flex items-center gap-1 px-2.5 py-1 rounded bg-orange-50 border border-orange-200 text-orange-700 text-xs font-semibold hover:bg-orange-100"
                title="AI Typesetting & Format Polish"
              >
                <Sparkles className="w-3.5 h-3.5 text-orange-600" />
                <span>AI Typesetting</span>
              </button>
            </div>
          </>
        )}

        {/* INSERT TAB */}
        {activeRibbonTab === 'insert' && (
          <div className="flex items-center gap-2">
            <button 
              onClick={() => insertTable(3, 3)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded hover:bg-zinc-100 border border-zinc-200 text-xs font-medium text-zinc-700"
            >
              <TableIcon className="w-4 h-4 text-blue-600" /> Insert Table
            </button>
            <button 
              onClick={() => {
                const url = prompt('Enter Image URL:');
                if (url) applyFormat('insertImage', url);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded hover:bg-zinc-100 border border-zinc-200 text-xs font-medium text-zinc-700"
            >
              <ImageIcon className="w-4 h-4 text-emerald-600" /> Picture / Image
            </button>
            <button 
              onClick={insertCallout}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded hover:bg-zinc-100 border border-zinc-200 text-xs font-medium text-zinc-700"
            >
              <Quote className="w-4 h-4 text-orange-600" /> Callout Quote
            </button>
            <button 
              onClick={insertDate}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded hover:bg-zinc-100 border border-zinc-200 text-xs font-medium text-zinc-700"
            >
              <Calendar className="w-4 h-4 text-purple-600" /> Date & Time
            </button>
            <button 
              onClick={insertCitation}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded hover:bg-zinc-100 border border-zinc-200 text-xs font-medium text-zinc-700"
            >
              <BookOpen className="w-4 h-4 text-cyan-600" /> Academic Citation
            </button>
          </div>
        )}

        {/* PAGE LAYOUT TAB */}
        {activeRibbonTab === 'layout' && (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 text-xs">
              <span className="text-zinc-500 font-medium">Margins:</span>
              <button 
                onClick={() => setPageMargin('normal')}
                className={`px-2 py-1 rounded ${pageMargin === 'normal' ? 'bg-blue-100 text-blue-700 font-bold' : 'hover:bg-zinc-100'}`}
              >
                Normal (1 in)
              </button>
              <button 
                onClick={() => setPageMargin('narrow')}
                className={`px-2 py-1 rounded ${pageMargin === 'narrow' ? 'bg-blue-100 text-blue-700 font-bold' : 'hover:bg-zinc-100'}`}
              >
                Narrow (0.5 in)
              </button>
              <button 
                onClick={() => setPageMargin('wide')}
                className={`px-2 py-1 rounded ${pageMargin === 'wide' ? 'bg-blue-100 text-blue-700 font-bold' : 'hover:bg-zinc-100'}`}
              >
                Wide
              </button>
            </div>

            <div className="flex items-center gap-1 text-xs border-l border-zinc-200 pl-3">
              <span className="text-zinc-500 font-medium">Paper Tone:</span>
              <button 
                onClick={() => setPaperTheme('white')}
                className={`px-2 py-1 rounded ${paperTheme === 'white' ? 'bg-blue-100 text-blue-700 font-bold' : 'hover:bg-zinc-100'}`}
              >
                White
              </button>
              <button 
                onClick={() => setPaperTheme('cream')}
                className={`px-2 py-1 rounded ${paperTheme === 'cream' ? 'bg-blue-100 text-blue-700 font-bold' : 'hover:bg-zinc-100'}`}
              >
                Ivory Cream
              </button>
            </div>
          </div>
        )}

        {/* REVIEW TAB */}
        {activeRibbonTab === 'review' && (
          <div className="flex items-center gap-2">
            <button 
              onClick={() => {
                setAiPresetAction('polish');
                setShowAiModal(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-orange-50 border border-orange-200 text-orange-700 text-xs font-semibold hover:bg-orange-100"
            >
              <Sparkles className="w-4 h-4 text-orange-600" /> AI Proofreader & Grammar Check
            </button>
            <button 
              onClick={() => {
                setAiPresetAction('cite');
                setShowAiModal(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded hover:bg-zinc-100 border border-zinc-200 text-xs font-medium text-zinc-700"
            >
              <GraduationCap className="w-4 h-4 text-blue-600" /> Format APA / MLA Bibliography
            </button>
          </div>
        )}

        {/* VIEW TAB */}
        {activeRibbonTab === 'view' && (
          <div className="flex items-center gap-2 text-xs">
            <button 
              onClick={() => setViewMode('page')}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded ${viewMode === 'page' ? 'bg-blue-100 text-blue-700 font-bold' : 'hover:bg-zinc-100'}`}
            >
              <FileText className="w-4 h-4" /> Page Layout
            </button>
            <button 
              onClick={() => setViewMode('web')}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded ${viewMode === 'web' ? 'bg-blue-100 text-blue-700 font-bold' : 'hover:bg-zinc-100'}`}
            >
              <LayoutTemplate className="w-4 h-4" /> Web Continuous
            </button>
            <button 
              onClick={() => setShowCropMarks(!showCropMarks)}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded ${showCropMarks ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'hover:bg-zinc-100'}`}
            >
              <CheckSquare className="w-4 h-4" /> Show Crop Marks
            </button>
          </div>
        )}

        {/* ZEN AI TAB */}
        {activeRibbonTab === 'zen-ai' && (
          <div className="flex items-center gap-2">
            <button 
              onClick={() => {
                setAiPresetAction('summarize');
                setShowAiModal(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold hover:bg-blue-100"
            >
              <Sparkles className="w-4 h-4 text-blue-600" /> Summarize Document
            </button>
            <button 
              onClick={() => {
                setAiPresetAction('chat');
                setShowAiModal(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-orange-50 border border-orange-200 text-orange-700 text-xs font-semibold hover:bg-orange-100"
            >
              <Wand2 className="w-4 h-4 text-orange-600" /> Interactive Copilot Chat
            </button>
          </div>
        )}

      </div>

      {/* ZEN AI INLINE PROMPT BAR */}
      <div className="bg-[#F0F1F4] dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 px-4 py-1.5 shrink-0 flex items-center justify-center">
        <div className="w-full max-w-[850px] relative flex items-center shadow-xs rounded-md overflow-hidden border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 focus-within:ring-2 focus-within:ring-orange-500/50">
          <div className="pl-3 pr-2 flex items-center justify-center text-orange-500">
            <Sparkles className="w-4 h-4" />
          </div>
          <form onSubmit={handleAiCommand} className="flex-1 flex items-center">
            <input 
              type="text" 
              value={aiCommandText}
              onChange={(e) => setAiCommandText(e.target.value)}
              placeholder="Ask ZenAI to write, summarize, draft letter, or format..."
              className="flex-1 h-8 bg-transparent border-none outline-none text-xs px-1 text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-400"
              disabled={isGenerating}
            />
            <Button 
              type="submit"
              disabled={isGenerating || !aiCommandText.trim()}
              variant="ghost"
              className="h-8 px-2.5 rounded-none text-orange-600 hover:text-orange-700"
            >
              {isGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
            </Button>
          </form>
        </div>
      </div>

      {/* STALE PLACEHOLDER RECOVERY BANNER */}
      {hasStalePlaceholder && (
        <div className="bg-amber-500/10 border-b border-amber-500/30 px-4 py-2 flex items-center justify-between text-xs text-amber-800 dark:text-amber-200">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              <strong>Notice:</strong> This file was loaded in an earlier session before the high-fidelity DOCX engine was configured. Select your original file to view with 100% WPS Office layout.
            </span>
          </div>
          <Button 
            size="sm" 
            onClick={() => fileInputRef.current?.click()}
            className="h-6 px-3 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold"
          >
            Select Original File
          </Button>
        </div>
      )}

      {/* 4. A4 DOCUMENT WORKSPACE CANVAS (Matching Image 2 WPS Office Layout) */}
      <main 
        className="flex-1 overflow-auto p-4 sm:p-8 flex justify-center bg-[#EAECEF] dark:bg-[#000000] relative"
        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={async (e) => {
          e.preventDefault();
          setIsDragOver(false);
          if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const file = e.dataTransfer.files[0];
            await processAndLoadFile(file);
          }
        }}
      >
        <div 
          className={`w-full max-w-[816px] min-h-[1056px] h-fit bg-white text-zinc-900 shadow-md border border-zinc-300 dark:border-zinc-700 ${getPaddingClass()} ${getPaperBg()} select-text cursor-text relative transition-all duration-150`}
          style={{ 
            zoom: zoom / 100, 
            marginBottom: '4rem',
            fontFamily,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget && editorRef.current) {
              editorRef.current.focus();
            }
          }}
        >
          {/* WPS Office Corner Crop Marks (┌ ┐ └ ┘) */}
          {showCropMarks && (
            <>
              <span className="absolute top-4 left-4 w-3 h-3 border-t-2 border-l-2 border-zinc-300 pointer-events-none" />
              <span className="absolute top-4 right-4 w-3 h-3 border-t-2 border-r-2 border-zinc-300 pointer-events-none" />
              <span className="absolute bottom-4 left-4 w-3 h-3 border-b-2 border-l-2 border-zinc-300 pointer-events-none" />
              <span className="absolute bottom-4 right-4 w-3 h-3 border-b-2 border-r-2 border-zinc-300 pointer-events-none" />
            </>
          )}

          {/* Loading Overlay */}
          {isLoadingDoc && (
            <div className="absolute inset-0 bg-white/95 dark:bg-black/95 backdrop-blur-xs flex flex-col items-center justify-center gap-3 z-30 rounded-sm">
              <Loader2 className="w-10 h-10 animate-spin text-orange-600" />
              <div className="text-center">
                <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100 block">Opening in WPS Office Layout...</span>
                <span className="text-xs text-zinc-500 block mt-1">Unpacking document hierarchy, tables, fonts, and university letterhead</span>
              </div>
            </div>
          )}

          {/* Drag Overlay */}
          {isDragOver && (
            <div className="absolute inset-0 border-2 border-dashed border-orange-500 bg-orange-500/10 backdrop-blur-xs flex flex-col items-center justify-center gap-2 z-40 rounded-sm">
              <FolderOpen className="w-12 h-12 text-orange-600 animate-bounce" />
              <span className="text-base font-bold text-orange-600">Drop DOCX or Word file here to open</span>
            </div>
          )}

          {/* Editable Document Body */}
          <div 
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            spellCheck={spellCheckEnabled}
            onInput={() => {
              setHasUnsavedChanges(true);
              handleContentInput();
            }}
            className="outline-none space-y-3 leading-relaxed min-h-[800px] select-text cursor-text focus:outline-none selection:bg-orange-500/25 selection:text-orange-950 dark:selection:text-orange-100"
            style={{ 
              fontFamily, 
              lineHeight: lineSpacing === '2.0' ? '2.0' : lineSpacing === '1.5' ? '1.5' : lineSpacing === '1.15' ? '1.25' : '1.1',
              userSelect: 'text',
              WebkitUserSelect: 'text',
            }}
          >
            <h1 className="text-2xl font-bold tracking-tight text-center pb-2">
              {docTitle.replace(/\.[^/.]+$/, '')}
            </h1>
            <p><br /></p>
          </div>
        </div>
      </main>

      {/* 5. FOOTER STATUS BAR (Exact Replica of WPS Office Image 2) */}
      <footer className="h-7 bg-[#F3F4F6] dark:bg-[#0c0c0e] border-t border-zinc-300 dark:border-zinc-800 px-4 flex items-center justify-between text-xs text-zinc-600 dark:text-zinc-400 shrink-0 select-none">
        {/* Left Side: Page, Words, AI Spell Check, AI Co-Writing, AI Proofing */}
        <div className="flex items-center gap-4">
          <span>Page: <strong>{currentPage} / {totalPages}</strong></span>
          <span>Words: <strong>{wordCount}</strong></span>
          
          <div className="flex items-center gap-1.5 border-l border-zinc-300 pl-3">
            <button 
              onClick={() => {
                setSpellCheckEnabled(!spellCheckEnabled);
                showToast(`AI Spell Check ${!spellCheckEnabled ? 'Enabled' : 'Disabled'}`);
              }}
              className="flex items-center gap-1 text-[11px] hover:text-zinc-900"
            >
              <span className={`w-2 h-2 rounded-full ${spellCheckEnabled ? 'bg-blue-600' : 'bg-zinc-400'}`} />
              <span>AI Spell Check</span>
            </button>
          </div>

          <button 
            onClick={() => {
              setAiPresetAction('chat');
              setShowAiModal(true);
            }}
            className="text-[11px] text-zinc-500 hover:text-blue-600 font-medium"
          >
            AI Co-Writing: Click to enable
          </button>

          <button 
            onClick={() => {
              setAiPresetAction('polish');
              setShowAiModal(true);
            }}
            className="text-[11px] text-zinc-500 hover:text-orange-600 font-medium"
          >
            AI Proofing
          </button>
        </div>

        {/* Right Side: View layout modes, Zoom Slider */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 border-r border-zinc-300 pr-3">
            <button 
              onClick={() => setViewMode('page')} 
              className={`p-1 rounded ${viewMode === 'page' ? 'bg-zinc-200 text-blue-600' : 'hover:bg-zinc-200'}`}
              title="Page Layout"
            >
              <FileText className="w-3.5 h-3.5" />
            </button>
            <button 
              onClick={() => setViewMode('web')} 
              className={`p-1 rounded ${viewMode === 'web' ? 'bg-zinc-200 text-blue-600' : 'hover:bg-zinc-200'}`}
              title="Web Layout"
            >
              <LayoutTemplate className="w-3.5 h-3.5" />
            </button>
            <button 
              onClick={handleFullscreen} 
              className="p-1 rounded hover:bg-zinc-200"
              title="Full Screen"
            >
              <Maximize className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Zoom Slider */}
          <div className="flex items-center gap-1.5">
            <button onClick={() => setZoom(z => Math.max(50, z - 10))} className="hover:text-blue-600 font-bold px-1">-</button>
            <input 
              type="range" 
              min="50" 
              max="200" 
              value={zoom} 
              onChange={(e) => setZoom(parseInt(e.target.value, 10))}
              className="w-16 h-1 accent-blue-600 cursor-pointer"
            />
            <span className="font-mono text-[11px] w-9 text-center">{zoom}%</span>
            <button onClick={() => setZoom(z => Math.min(200, z + 10))} className="hover:text-blue-600 font-bold px-1">+</button>
            <button onClick={() => setZoom(100)} className="text-[10px] hover:text-blue-600 font-medium ml-1">Fit</button>
          </div>
        </div>
      </footer>

      {/* Find & Replace Modal */}
      {showFindReplaceModal && (
        <div className="fixed top-24 right-8 z-50 bg-white border border-zinc-300 rounded-lg shadow-2xl p-4 w-80 text-xs animate-in fade-in zoom-in-95">
          <div className="flex items-center justify-between pb-2 mb-3 border-b border-zinc-200 font-bold text-zinc-800">
            <span>Find & Replace</span>
            <button onClick={() => setShowFindReplaceModal(false)}><X className="w-3.5 h-3.5" /></button>
          </div>
          <div className="space-y-2">
            <div>
              <label className="text-zinc-500 block mb-0.5">Find text:</label>
              <input 
                type="text" 
                value={findText} 
                onChange={(e) => setFindText(e.target.value)} 
                className="w-full border border-zinc-300 rounded px-2 py-1 outline-none focus:border-blue-500"
                placeholder="Search phrase..."
              />
            </div>
            <div>
              <label className="text-zinc-500 block mb-0.5">Replace with:</label>
              <input 
                type="text" 
                value={replaceText} 
                onChange={(e) => setReplaceText(e.target.value)} 
                className="w-full border border-zinc-300 rounded px-2 py-1 outline-none focus:border-blue-500"
                placeholder="Replacement..."
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button size="sm" variant="outline" onClick={() => handleFindReplace(true)} className="h-7 text-xs">
                Replace
              </Button>
              <Button size="sm" onClick={() => handleFindReplace(false)} className="h-7 text-xs bg-blue-600 hover:bg-blue-700 text-white">
                Replace All
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Notification Toast */}
      {notification && (
        <div className="fixed bottom-10 right-5 z-50 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-4 py-2.5 rounded-lg shadow-xl text-xs font-medium flex items-center gap-2 border border-zinc-700 animate-in fade-in slide-in-from-bottom-3 duration-200">
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
      <div className="h-screen w-screen bg-[#EAECEF] flex flex-col items-center justify-center text-blue-600 gap-3">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm font-semibold tracking-wide text-zinc-600">Loading ZenOffice Document...</span>
      </div>
    }>
      <DocumentEditorInner />
    </Suspense>
  );
}
