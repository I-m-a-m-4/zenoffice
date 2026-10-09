'use client';

import React, { useState, useRef, useEffect, Suspense, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
  ArrowLeft, Download, Printer, Search, 
  ZoomIn, ZoomOut, RotateCw, Highlighter, 
  PenTool, X, Plus, CheckCircle2,
  Maximize2, MessageSquare, Layers, Bookmark, 
  Upload, FileText, Shield, ExternalLink, RefreshCw, Eye,
  Sparkles, StickyNote, Type, ImageIcon, FileSignature, 
  FileArchive, ScanText, Scissors, Languages,
  MousePointer2, Hand, TextSelect, MoveVertical, Square, Image, FileInput, 
  LayoutTemplate, ImagePlus, Combine, Split, PenBox, TypeOutline,
  Undo2, Redo2, Cloud, Save, Loader2, Check, FileSpreadsheet
} from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { ZenFileSyncService, ZenDocumentItem } from '@/lib/firebase-sync';
import { ZenAiDialog } from '@/components/shared/zen-ai-dialog';
import { notifyFileDownloaded } from '@/components/shared/download-watcher';
import { getAuth } from 'firebase/auth';
import * as XLSX from 'xlsx';

interface PdfAnnotation {
  id: string;
  type: 'highlight' | 'note' | 'text' | 'image' | 'signature' | 'redact';
  text?: string;
  imageUrl?: string;
  page: number;
  x: number;
  y: number;
  width?: number;
  height?: number;
}

interface HistoryAction {
  type: 'edit-text' | 'add-ann' | 'remove-ann' | 'add-sig' | 'remove-sig';
  elementId?: string;
  prevText?: string;
  newText?: string;
  annotation?: PdfAnnotation;
  signature?: any;
}

function PDFEditorInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const docParam = searchParams.get('doc') || searchParams.get('id') || '';

  // File input & canvas container refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const blankEditorRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const docViewportRef = useRef<HTMLDivElement>(null);

  // Document & view state
  const [docTitle, setDocTitle] = useState(docParam ? decodeURIComponent(docParam) : 'Document.pdf');
  const [blankDocText, setBlankDocText] = useState('');
  const [currentDoc, setCurrentDoc] = useState<ZenDocumentItem | null>(null);
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [pdfDataBytes, setPdfDataBytes] = useState<Uint8Array | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRendering, setIsRendering] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [showTabDropdown, setShowTabDropdown] = useState(false);

  // Viewer state
  const [zoom, setZoom] = useState(100);
  const [rotation, setRotation] = useState(0);
  const [selectedTool, setSelectedTool] = useState<'select' | 'pan' | 'text' | 'add-text' | 'highlight' | 'redact' | 'sign' | 'fill-form'>('select');
  const selectedToolRef = useRef(selectedTool);
  useEffect(() => {
    selectedToolRef.current = selectedTool;
  }, [selectedTool]);

  const zoomRef = useRef(zoom);
  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);
  const [showProModal, setShowProModal] = useState(false);
  const [proFeatureName, setProFeatureName] = useState('');
  const [viewMode, setViewMode] = useState<'canvas' | 'embed'>('canvas');
  const [showSidebar, setShowSidebar] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<'thumbnails' | 'bookmarks' | 'comments' | 'attachments' | 'signatures' | 'layers'>('thumbnails');
  const [notification, setNotification] = useState<string | null>(null);
  const [readingMode, setReadingMode] = useState(false);

  // Undo / Redo history
  const [undoStack, setUndoStack] = useState<HistoryAction[]>([]);
  const [redoStack, setRedoStack] = useState<HistoryAction[]>([]);

  // Split & Merge state
  const [showSplitMergeModal, setShowSplitMergeModal] = useState(false);
  const [splitMergeTab, setSplitMergeTab] = useState<'split' | 'merge'>('split');
  const [splitPageRange, setSplitPageRange] = useState('1');
  const mergeFileInputRef = useRef<HTMLInputElement>(null);

  // Hand tool panning ref
  const isPanningRef = useRef(false);
  const panStartRef = useRef({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 });

  // Annotations, Notes & Zen AI state
  const [annotations, setAnnotations] = useState<PdfAnnotation[]>([]);
  const [extractedPdfText, setExtractedPdfText] = useState<string>('');
  const [showAiModal, setShowAiModal] = useState<boolean>(false);
  const [pdfSearchQuery, setPdfSearchQuery] = useState<string>('');
  const [showNoteModal, setShowNoteModal] = useState<boolean>(false);
  const [newNoteContent, setNewNoteContent] = useState<string>('');
  const [pendingCoords, setPendingCoords] = useState<{ page: number; x: number; y: number } | null>(null);

  // Signature modal state
  const [showSignModal, setShowSignModal] = useState(false);
  const [signTab, setSignTab] = useState<'type' | 'draw'>('type');
  const [signatureText, setSignatureText] = useState('Bello Imam');
  const [signatureColor, setSignatureColor] = useState('#ea580c');
  
  // Signature Canvas Ref for Drawing
  const signCanvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawingSign, setIsDrawingSign] = useState(false);

  // Dragging state
  const [draggedAnnId, setDraggedAnnId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [appliedSignatures, setAppliedSignatures] = useState<Array<{ id: string; type: 'text' | 'image'; text?: string; imageUrl?: string; x: number; y: number; color?: string; width?: number; height?: number }>>([]);

  // Save, Export & Dirty state
  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Payment / upgrade state
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [upgradeSuccess, setUpgradeSuccess] = useState(false);

  const loadFlutterwaveScript = (): Promise<boolean> => {
    return new Promise((resolve) => {
      if (typeof window === 'undefined') return resolve(false);
      if (typeof (window as any).FlutterwaveCheckout === 'function') {
        return resolve(true);
      }

      const existingScript = document.getElementById('flutterwave-checkout-script') as HTMLScriptElement;
      if (existingScript) {
        existingScript.addEventListener('load', () => resolve(true));
        existingScript.addEventListener('error', () => resolve(false));
        if (typeof (window as any).FlutterwaveCheckout === 'function') return resolve(true);
        return;
      }

      const script = document.createElement('script');
      script.id = 'flutterwave-checkout-script';
      script.src = 'https://checkout.flutterwave.com/v3.js';
      script.async = true;
      script.onload = () => resolve(true);
      script.onerror = () => {
        console.error('Failed to load Flutterwave checkout script');
        resolve(false);
      };
      document.body.appendChild(script);
    });
  };

  const handleUpgrade = async () => {
    const user = getAuth().currentUser;
    if (!user) {
      showToast('You must be logged in to upgrade.');
      return;
    }

    const scriptLoaded = await loadFlutterwaveScript();
    if (!scriptLoaded || typeof (window as any).FlutterwaveCheckout !== 'function') {
      showToast('Could not load payment gateway. Please check your internet connection.');
      return;
    }

    const publicKey = process.env.NEXT_PUBLIC_FLUTTERWAVE_PUBLIC_KEY || 'FLWPUBK-33162c3bb2bb347a6606f3e44645f1c9-X';

    try {
      (window as any).FlutterwaveCheckout({
        public_key: publicKey,
        tx_ref: `zenoffice-pro-${Date.now()}`,
        amount: 9999,
        currency: 'NGN',
        payment_options: 'card,mobilemoney,ussd,banktransfer',
        customer: {
          email: user.email || 'user@zenoffice.app',
          name: user.displayName || user.email?.split('@')[0] || 'ZenOffice User',
          phone_number: '08000000000',
        },
        customizations: {
          title: 'ZenOffice Premium',
          description: 'Upgrade to ZenOffice Premium for unlimited PDF tools.',
          logo: 'https://zeneva.space/logo.png',
        },
        callback: async (response: any) => {
          const txId = response.transaction_id || response.tx_ref || response.flw_ref;
          if (response.status === 'successful' || response.status === 'completed') {
            setIsUpgrading(true);
            try {
              const res = await fetch('/api/upgrade/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  transaction_id: txId,
                  userId: user.uid,
                  plan: 'pro',
                }),
              });
              const data = await res.json();
              if (data.success) {
                setUpgradeSuccess(true);
                setShowProModal(false);
                showToast('🎉 You are now on ZenOffice Premium!');
              } else {
                showToast('Payment received, but upgrade failed. Please contact support.');
              }
            } catch {
              showToast('Upgrade verification failed. Please contact support.');
            } finally {
              setIsUpgrading(false);
            }
          } else {
            showToast('Payment was not completed.');
          }
        },
        onclose: () => {
          setIsUpgrading(false);
        },
      });
    } catch (err) {
      console.error('FlutterwaveCheckout invocation error:', err);
      showToast('Payment initiation failed. Please try again.');
    }
  };

  const showToast = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3500);
  };

  // Convert Base64 data URL to bytes and Blob URL
  const parsePdfData = (dataUrl: string): { blobUrl: string; bytes: Uint8Array } | null => {
    try {
      let base64 = dataUrl;
      let mime = 'application/pdf';

      if (dataUrl.startsWith('data:')) {
        const parts = dataUrl.split(',');
        const mimeMatch = parts[0].match(/:(.*?);/);
        if (mimeMatch) mime = mimeMatch[1];
        base64 = parts.length > 1 ? parts[1] : parts[0];
      }

      const binary = atob(base64);
      const len = binary.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: mime });
      const blobUrl = URL.createObjectURL(blob);
      return { blobUrl, bytes };
    } catch (e) {
      console.warn('Could not parse PDF data', e);
      return null;
    }
  };

  // Keyboard shortcuts (Ctrl+E for AI copilot, Ctrl+S for Save, Escape to exit reading mode)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'e') {
        e.preventDefault();
        setShowAiModal(prev => !prev);
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSaveDocument();
      }
      if (e.key === 'Escape') {
        setReadingMode(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    let active = true;

    async function loadDoc() {
      setIsLoading(true);
      const resolvedTitle = docParam ? decodeURIComponent(docParam) : 'Document.pdf';
      setDocTitle(resolvedTitle);

      if (!docParam) {
        setIsLoading(false);
        return;
      }

      try {
        const found = await ZenFileSyncService.getDocument(docParam);
        if (!active) return;

        if (found) {
          setCurrentDoc(found);
          setDocTitle(found.name);

          if (found.fileData) {
            const parsed = parsePdfData(found.fileData);
            if (parsed) {
              setPdfBlobUrl(parsed.blobUrl);
              setPdfDataBytes(parsed.bytes);
            } else {
              setPdfBlobUrl(found.fileData);
            }
          } else {
            setPdfBlobUrl(null);
            setPdfDataBytes(null);
          }
        } else {
          setPdfBlobUrl(null);
          setPdfDataBytes(null);
        }
      } catch (err) {
        console.error('Failed to load PDF doc', err);
      } finally {
        if (active) setIsLoading(false);
      }
    }

    loadDoc();
    return () => { active = false; };
  }, [docParam]);

  // Load PDF.js library dynamically from CDN
  const loadPdfJsLibrary = async (): Promise<any> => {
    if (typeof window === 'undefined') return null;
    if ((window as any).pdfjsLib) return (window as any).pdfjsLib;

    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js';
      script.async = true;
      script.onload = () => {
        const lib = (window as any).pdfjsLib;
        if (lib) {
          lib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
          resolve(lib);
        } else {
          reject(new Error('Failed to load PDF.js'));
        }
      };
      script.onerror = () => reject(new Error('Failed to load PDF.js script'));
      document.head.appendChild(script);
    });
  };

  // Render PDF pages onto HTML5 canvas elements (100% immune to iframe/CSP blocking!)
  const renderPdfPages = useCallback(async () => {
    if (!pdfBlobUrl && !pdfDataBytes) return;
    if (viewMode !== 'canvas') return;

    setIsRendering(true);
    try {
      const pdfjs = await loadPdfJsLibrary();
      if (!pdfjs) return;

      const loadingTask = pdfDataBytes
        ? pdfjs.getDocument({ data: pdfDataBytes })
        : pdfjs.getDocument(pdfBlobUrl);

      const pdf = await loadingTask.promise;
      setNumPages(pdf.numPages);

      const container = canvasContainerRef.current;
      if (!container) return;
      container.innerHTML = '';

      let fullExtractedText = '';

      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);

        try {
          const textContent = await page.getTextContent();
          
          // Sort items by Y (descending) then X (ascending)
          const items = textContent.items.sort((a: any, b: any) => {
             const yDiff = b.transform[5] - a.transform[5];
             if (Math.abs(yDiff) > 5) return yDiff; // Different lines
             return a.transform[4] - b.transform[4]; // Same line, sort by X
          });

          let pageStr = '';
          let lastY: number | null = null;
          let lastX = 0;
          
          items.forEach((item: any) => {
            const y = item.transform[5];
            const x = item.transform[4];
            
            if (lastY === null) {
               pageStr += item.str;
            } else {
               if (Math.abs(lastY - y) > 5) {
                 // New line
                 pageStr += '\n' + item.str;
               } else {
                 // Same line, compute gap
                 const gap = Math.max(0, x - lastX);
                 // Assuming average char width is roughly 6-8 pixels
                 const spacesCount = Math.max(1, Math.round(gap / 8)); 
                 pageStr += ' '.repeat(spacesCount) + item.str;
               }
            }
            lastY = y;
            lastX = x + (item.width || item.str.length * 6);
          });
          
          // Use pre format to keep the spacing
          fullExtractedText += `<h3>--- Page ${pageNum} ---</h3><pre style="font-family: monospace; white-space: pre-wrap; font-size: 13px; line-height: 1.5; margin-bottom: 2rem;">${pageStr}</pre>`;
        } catch (e) {
          // Non-blocking text extraction
        }

        // Sharp base scale for high-DPI canvas
        const scale = 1.5;
        const viewport = page.getViewport({ scale, rotation });

        // Page wrapper container
        const pageWrapper = document.createElement('div');
        pageWrapper.className = 'relative mb-6 rounded-lg overflow-hidden bg-white shadow-sm border border-zinc-200 dark:border-zinc-800 transition-all flex flex-col items-center';
        pageWrapper.id = `pdf-page-${pageNum}`;

        // Page header indicator
        const pageHeader = document.createElement('div');
        pageHeader.className = 'w-full bg-zinc-100 dark:bg-zinc-800/80 px-3 py-1 flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-700/60 select-none';
        pageHeader.innerHTML = `<span>Page ${pageNum} of ${pdf.numPages}</span><span class="text-[10px] font-mono text-orange-600 dark:text-orange-400 font-semibold">${docTitle}</span>`;
        pageWrapper.appendChild(pageHeader);

        // Canvas & Interactive Text Layer Wrapper
        const pageCanvasWrapper = document.createElement('div');
        pageCanvasWrapper.className = 'relative flex justify-center bg-white shadow-sm';
        pageCanvasWrapper.style.width = `${viewport.width}px`;
        pageCanvasWrapper.style.height = `${viewport.height}px`;

        // Interactive click handler for adding new text anywhere on page
        pageCanvasWrapper.onclick = (e) => {
          if (selectedToolRef.current === 'add-text') {
            e.stopPropagation();
            const rect = pageCanvasWrapper.getBoundingClientRect();
            const currentScale = (zoomRef.current || 100) / 100;
            const clickX = Math.round((e.clientX - rect.left) / currentScale);
            const clickY = Math.round((e.clientY - rect.top) / currentScale);

            const newAnn: PdfAnnotation = {
              id: `text-${Date.now()}`,
              type: 'text',
              text: 'Type text here...',
              page: pageNum,
              x: Math.max(10, clickX),
              y: Math.max(10, clickY),
            };
            setAnnotations(prev => [...prev, newAnn]);
            setUndoStack(prev => [...prev, { type: 'add-ann', annotation: newAnn }]);
            setSelectedTool('select');
            showToast('New text box added! Click to edit and drag.');
          }
        };

        // Canvas
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        canvas.className = 'block bg-white';
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        pageCanvasWrapper.appendChild(canvas);

        // Interactive Click-To-Edit Text Layer
        const textLayer = document.createElement('div');
        textLayer.className = 'absolute inset-0 overflow-hidden pointer-events-auto select-text';
        textLayer.style.width = '100%';
        textLayer.style.height = '100%';

        try {
          const textContent = await page.getTextContent();
          if (textContent && textContent.items) {
            const validItems = textContent.items.filter((it: any) => it.str && it.str.trim());
            // Safe non-destructive deduplication (only filter exact duplicates within 0.75pt)
            const itemsToRender: any[] = [];
            for (let idx = 0; idx < validItems.length; idx++) {
              const it = validItems[idx];
              const isDupe = itemsToRender.some(prev => 
                Math.abs(prev.transform[4] - it.transform[4]) < 0.75 && 
                Math.abs(prev.transform[5] - it.transform[5]) < 0.75
              );
              if (!isDupe) {
                itemsToRender.push({ ...it, _uniqueId: `span-${pageNum}-${idx}` });
              }
            }

            itemsToRender.forEach((item: any) => {
              const vp = viewport.transform;
              const it = item.transform;
              // 2D affine transform matrix multiplication: vp * it
              const a = vp[0] * it[0] + vp[2] * it[1];
              const b = vp[1] * it[0] + vp[3] * it[1];
              const e = vp[0] * it[4] + vp[2] * it[5] + vp[4];
              const f = vp[1] * it[4] + vp[3] * it[5] + vp[5];

              const styleObj = textContent.styles ? textContent.styles[item.fontName] : null;
              const fontFam = (styleObj?.fontFamily || '').toLowerCase();
              const fnLower = (item.fontName || '').toLowerCase();

              // Determine serif / times font family
              const isSerif = fontFam.includes('serif') || 
                              fnLower.includes('times') || 
                              fnLower.includes('serif') || 
                              fnLower.includes('roman') ||
                              fnLower.includes('f2') || 
                              fnLower.includes('f3') || 
                              fnLower.includes('f4');
              const isMono = fontFam.includes('mono') || fnLower.includes('courier');
              const isBold = fnLower.includes('bold') || fnLower.includes('f3');
              const isItalic = fnLower.includes('italic') || fnLower.includes('oblique') || fnLower.includes('f4');

              const fontSize = Math.max(9, Math.hypot(a, b));
              // Baseline alignment in canvas coordinate space
              const top = f - (fontSize * 0.81);
              const left = e;
              const itemWidth = Math.max(item.width * (viewport.scale || scale), 16);
              const itemHeight = fontSize * 1.25;

              const span = document.createElement('span');
              span.id = item._uniqueId;
              span.className = 'pdf-text-item absolute transition-all cursor-text select-text';
              span.style.left = `${left}px`;
              span.style.top = `${top}px`;
              span.style.fontSize = `${fontSize}px`;
              span.style.lineHeight = '1';
              span.style.minWidth = `${itemWidth}px`;
              span.style.height = `${itemHeight}px`;
              span.style.whiteSpace = 'pre';
              span.style.color = 'transparent';
              span.style.zIndex = '20';
              span.style.pointerEvents = 'auto';

              if (isSerif) {
                span.style.fontFamily = '"Times New Roman", Times, Georgia, serif';
              } else if (isMono) {
                span.style.fontFamily = '"Courier New", Courier, monospace';
              } else {
                span.style.fontFamily = 'Arial, Helvetica, sans-serif';
              }
              if (isBold) span.style.fontWeight = 'bold';
              if (isItalic) span.style.fontStyle = 'italic';

              span.innerText = item.str;
              span.title = 'Click to edit text';

              // Store unscaled PDF points for true vector replacement in pdf-lib
              span.dataset.pdfX = String(it[4]);
              span.dataset.pdfY = String(it[5]);
              span.dataset.pdfWidth = String(item.width);
              span.dataset.pdfHeight = String(Math.hypot(it[0], it[1]));
              span.dataset.originalText = item.str;
              span.dataset.pageNum = String(pageNum);
              span.dataset.fontName = item.fontName || '';
              span.dataset.fontFamily = isSerif ? 'serif' : isMono ? 'monospace' : 'sans-serif';
              span.dataset.fontBold = isBold ? 'true' : 'false';
              span.dataset.fontItalic = isItalic ? 'true' : 'false';

              // Visual hover indicator
              span.onmouseenter = () => {
                if (span.getAttribute('contenteditable') !== 'true' && span.dataset.edited !== 'true') {
                  span.style.backgroundColor = 'rgba(234, 88, 12, 0.12)';
                  span.style.outline = '1.5px dashed rgba(234, 88, 12, 0.7)';
                  span.style.borderRadius = '3px';
                }
              };
              span.onmouseleave = () => {
                if (span.getAttribute('contenteditable') !== 'true' && span.dataset.edited !== 'true') {
                  if (selectedToolRef.current === 'fill-form') {
                    span.style.backgroundColor = 'rgba(59, 130, 246, 0.12)';
                    span.style.outline = '1.5px dashed rgba(59, 130, 246, 0.7)';
                  } else {
                    span.style.backgroundColor = 'transparent';
                    span.style.outline = 'none';
                  }
                }
              };

              // Click to inline edit or use active tool
              const handleStartEdit = (ev: MouseEvent) => {
                ev.stopPropagation();

                const currentTool = selectedToolRef.current;
                if (currentTool === 'highlight') {
                  span.style.backgroundColor = 'rgba(254, 240, 138, 0.85)';
                  span.style.outline = 'none';
                  span.dataset.highlighted = 'true';
                  showToast('Text highlighted');
                  setHasUnsavedChanges(true);
                  return;
                }
                if (currentTool === 'redact') {
                  span.style.backgroundColor = '#18181b';
                  span.style.color = '#18181b';
                  span.dataset.redacted = 'true';
                  showToast('Text redacted');
                  setHasUnsavedChanges(true);
                  return;
                }

                // Standard Edit Mode
                span.contentEditable = 'true';
                span.style.color = '#18181b';
                span.style.backgroundColor = '#ffffff'; // Cleanly masks underlying canvas text
                span.style.boxShadow = '0 0 0 3px #ffffff, 0 2px 12px rgba(0,0,0,0.2)';
                span.style.padding = '2px 4px';
                span.style.margin = '-2px -4px';
                span.style.outline = '2px solid #ea580c';
                span.style.borderRadius = '3px';
                span.style.zIndex = '50';
                span.focus();

                // Select text contents so user can replace or type immediately
                try {
                  const range = document.createRange();
                  range.selectNodeContents(span);
                  const sel = window.getSelection();
                  sel?.removeAllRanges();
                  sel?.addRange(range);
                } catch {}
              };

              span.onclick = handleStartEdit;
              span.ondblclick = handleStartEdit;

              span.oninput = () => {
                span.dataset.edited = 'true';
                setHasUnsavedChanges(true);
              };

              span.onblur = () => {
                span.contentEditable = 'false';
                const cleanNew = span.innerText.replace(/\u00a0/g, ' ').replace(/\r?\n/g, ' ').trim();
                const cleanOrig = (span.dataset.originalText || '').replace(/\u00a0/g, ' ').replace(/\r?\n/g, ' ').trim();
                const hasChanged = cleanNew !== cleanOrig;
                if (hasChanged) {
                  span.dataset.edited = 'true';
                  span.style.color = '#18181b';
                  span.style.backgroundColor = '#ffffff';
                  span.style.boxShadow = '0 0 0 2px #ffffff';
                  span.style.padding = '2px 4px';
                  span.style.margin = '-2px -4px';
                  span.style.outline = 'none';
                  span.style.zIndex = '25';
                  setHasUnsavedChanges(true);
                  setUndoStack(prev => [...prev, {
                    type: 'edit-text',
                    elementId: span.id,
                    prevText: cleanOrig,
                    newText: cleanNew,
                  }]);
                  setRedoStack([]);
                  showToast('Document text updated! Click Save to keep changes.');
                } else {
                  span.dataset.edited = 'false';
                  span.style.color = 'transparent';
                  span.style.backgroundColor = selectedToolRef.current === 'fill-form' ? 'rgba(59, 130, 246, 0.12)' : 'transparent';
                  span.style.boxShadow = 'none';
                  span.style.padding = '0';
                  span.style.margin = '0';
                  span.style.outline = selectedToolRef.current === 'fill-form' ? '1.5px dashed rgba(59, 130, 246, 0.7)' : 'none';
                  span.style.zIndex = '20';
                }
              };

              span.onkeydown = (ev) => {
                if (ev.key === 'Enter') {
                  ev.preventDefault();
                  span.blur();
                }
                if (ev.key === 'Escape') {
                  span.blur();
                }
              };

              textLayer.appendChild(span);
            });
          }
        } catch (e) {
          // Non-blocking text layer error
        }

        pageCanvasWrapper.appendChild(textLayer);
        pageWrapper.appendChild(pageCanvasWrapper);
        container.appendChild(pageWrapper);

        // Render page to canvas context
        await page.render({ canvasContext: context, viewport }).promise;
      }

      setExtractedPdfText(fullExtractedText);
    } catch (err) {
      console.warn('Canvas render notice, offering fallback:', err);
    } finally {
      setIsRendering(false);
    }
  }, [pdfBlobUrl, pdfDataBytes, rotation, viewMode, docTitle]);

  useEffect(() => {
    renderPdfPages();
  }, [renderPdfPages]);

  // Highlight all receipt fields when 'fill-form' tool is selected
  useEffect(() => {
    const container = canvasContainerRef.current;
    if (!container) return;
    const spans = container.querySelectorAll<HTMLElement>('.pdf-text-item');
    if (selectedTool === 'fill-form') {
      spans.forEach(s => {
        if (s.getAttribute('contenteditable') !== 'true' && s.dataset.edited !== 'true') {
          s.style.backgroundColor = 'rgba(59, 130, 246, 0.12)';
          s.style.outline = '1.5px dashed rgba(59, 130, 246, 0.7)';
          s.style.borderRadius = '3px';
        }
      });
    } else {
      spans.forEach(s => {
        if (s.getAttribute('contenteditable') !== 'true' && s.dataset.edited !== 'true' && s.dataset.highlighted !== 'true' && s.dataset.redacted !== 'true') {
          s.style.backgroundColor = 'transparent';
          s.style.outline = 'none';
        }
      });
    }
  }, [selectedTool]);

  // Handle local file selection
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    await processAndLoadFile(files[0]);
  };

  const processAndLoadFile = async (file: File) => {
    setIsLoading(true);
    try {
      const newDoc = await ZenFileSyncService.addUploadedFile(file, 'Downloads');
      setCurrentDoc(newDoc);
      setDocTitle(newDoc.name);

      if (newDoc.fileData) {
        const parsed = parsePdfData(newDoc.fileData);
        if (parsed) {
          setPdfBlobUrl(parsed.blobUrl);
          setPdfDataBytes(parsed.bytes);
        } else {
          setPdfBlobUrl(newDoc.fileData);
        }
      }

      showToast(`Loaded ${newDoc.name}`);
      router.replace(`/editor/pdf?doc=${encodeURIComponent(newDoc.name)}`);
    } catch (err) {
      console.error('Error processing PDF file', err);
      showToast('Error reading PDF file.');
    } finally {
      setIsLoading(false);
    }
  };

  // Drag & drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        await processAndLoadFile(file);
      } else {
        showToast('Please drop a valid PDF file.');
      }
    }
  };

  // Zoom controls
  const handleZoom = (delta: number) => {
    setZoom(prev => Math.min(220, Math.max(50, prev + delta)));
  };

  const handleResetZoom = () => setZoom(100);

  // Rotate page
  const handleRotate = () => {
    setRotation(prev => (prev + 90) % 360);
  };

  // Undo / Redo handlers
  const handleUndo = () => {
    if (undoStack.length === 0) {
      showToast('Nothing to undo');
      return;
    }
    const lastAction = undoStack[undoStack.length - 1];
    setUndoStack(prev => prev.slice(0, -1));
    setRedoStack(prev => [...prev, lastAction]);

    if (lastAction.type === 'edit-text' && lastAction.elementId) {
      const el = document.getElementById(lastAction.elementId);
      if (el) {
        el.innerText = lastAction.prevText || '';
        el.dataset.edited = lastAction.prevText !== el.dataset.originalText ? 'true' : 'false';
        if (lastAction.prevText === el.dataset.originalText) {
          el.style.color = 'transparent';
          el.style.backgroundColor = 'transparent';
          el.style.boxShadow = 'none';
        }
      }
      showToast('Undone text edit');
    } else if (lastAction.type === 'add-ann' && lastAction.annotation) {
      setAnnotations(prev => prev.filter(a => a.id !== lastAction.annotation?.id));
      showToast('Undone annotation');
    } else if (lastAction.type === 'remove-ann' && lastAction.annotation) {
      setAnnotations(prev => [...prev, lastAction.annotation!]);
      showToast('Restored annotation');
    } else if (lastAction.type === 'add-sig' && lastAction.signature) {
      setAppliedSignatures(prev => prev.filter(s => s.id !== lastAction.signature?.id));
      showToast('Undone signature');
    } else if (lastAction.type === 'remove-sig' && lastAction.signature) {
      setAppliedSignatures(prev => [...prev, lastAction.signature!]);
      showToast('Restored signature');
    }
  };

  const handleRedo = () => {
    if (redoStack.length === 0) {
      showToast('Nothing to redo');
      return;
    }
    const nextAction = redoStack[redoStack.length - 1];
    setRedoStack(prev => prev.slice(0, -1));
    setUndoStack(prev => [...prev, nextAction]);

    if (nextAction.type === 'edit-text' && nextAction.elementId) {
      const el = document.getElementById(nextAction.elementId);
      if (el) {
        el.innerText = nextAction.newText || '';
        el.dataset.edited = 'true';
        el.style.color = '#18181b';
        el.style.backgroundColor = '#ffffff';
        el.style.boxShadow = '0 0 0 1.5px #ffffff';
      }
      showToast('Redone text edit');
    } else if (nextAction.type === 'add-ann' && nextAction.annotation) {
      setAnnotations(prev => [...prev, nextAction.annotation!]);
      showToast('Re-applied annotation');
    } else if (nextAction.type === 'remove-ann' && nextAction.annotation) {
      setAnnotations(prev => prev.filter(a => a.id !== nextAction.annotation?.id));
      showToast('Removed annotation');
    } else if (nextAction.type === 'add-sig' && nextAction.signature) {
      setAppliedSignatures(prev => [...prev, nextAction.signature!]);
      showToast('Re-applied signature');
    } else if (nextAction.type === 'remove-sig' && nextAction.signature) {
      setAppliedSignatures(prev => prev.filter(s => s.id !== nextAction.signature?.id));
      showToast('Removed signature');
    }
  };

  // Real PDF to Word Export
  const handlePdfToWord = () => {
    try {
      showToast('Generating Word document (.doc)...');
      const contentHtml = `
        <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
        <head><meta charset='utf-8'><title>${docTitle}</title></head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; padding: 2rem;">
          <h1 style="color: #ea580c;">${docTitle}</h1>
          <hr style="border: 0; border-top: 1px solid #e4e4e7; margin: 1rem 0;" />
          ${extractedPdfText || '<p>Document content extracted from ZenOffice PDF Suite</p>'}
        </body>
        </html>
      `;
      const blob = new Blob(['\ufeff', contentHtml], { type: 'application/msword;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = docTitle.replace(/\.pdf$/i, '') + '.doc';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('Word document exported successfully!');
    } catch (e) {
      console.error('Word export error', e);
      showToast('Failed to export Word document');
    }
  };

  // Real PDF to Excel Export
  const handlePdfToExcel = () => {
    try {
      showToast('Generating Excel spreadsheet (.xlsx)...');
      const textToParse = extractedPdfText.replace(/<[^>]+>/g, '\n');
      const lines = textToParse.split('\n').map(l => l.trim()).filter(Boolean);
      
      const rows: string[][] = [];
      lines.forEach(line => {
        if (line.includes(':')) {
          const parts = line.split(':');
          rows.push([parts[0].trim(), parts.slice(1).join(':').trim()]);
        } else if (line.includes('\t')) {
          rows.push(line.split('\t').map(s => s.trim()));
        } else {
          rows.push([line]);
        }
      });

      const ws = XLSX.utils.aoa_to_sheet(rows.length > 0 ? rows : [['Document', docTitle], ['Status', 'Extracted via ZenOffice']]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Extracted Data');
      XLSX.writeFile(wb, docTitle.replace(/\.pdf$/i, '') + '.xlsx');
      showToast('Excel spreadsheet exported successfully!');
    } catch (e) {
      console.error('Excel export error', e);
      showToast('Failed to export Excel spreadsheet');
    }
  };

  // PDF Splitter
  const handleSplitPdf = async (pageNumberStr: string) => {
    if (!pdfDataBytes) {
      showToast('No PDF loaded to split');
      return;
    }
    try {
      showToast('Extracting selected pages...');
      const targetPageNum = parseInt(pageNumberStr.trim(), 10) || 1;
      const pdfDoc = await PDFDocument.load(pdfDataBytes, { ignoreEncryption: true });
      const totalPages = pdfDoc.getPageCount();
      if (targetPageNum < 1 || targetPageNum > totalPages) {
        showToast(`Page must be between 1 and ${totalPages}`);
        return;
      }

      const newPdf = await PDFDocument.create();
      const [copiedPage] = await newPdf.copyPages(pdfDoc, [targetPageNum - 1]);
      newPdf.addPage(copiedPage);

      const splitBytes = await newPdf.save();
      const blob = new Blob([splitBytes as unknown as BlobPart], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${docTitle.replace(/\.pdf$/i, '')}_Page_${targetPageNum}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setShowSplitMergeModal(false);
      showToast(`Page ${targetPageNum} extracted and downloaded!`);
    } catch (e) {
      console.error('Split error', e);
      showToast('Failed to split PDF');
    }
  };

  // PDF Merger
  const handleMergePdfFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !pdfDataBytes) return;

    try {
      showToast('Merging PDF documents...');
      const fileBuffer = await file.arrayBuffer();
      const baseDoc = await PDFDocument.load(pdfDataBytes, { ignoreEncryption: true });
      const incomingDoc = await PDFDocument.load(new Uint8Array(fileBuffer), { ignoreEncryption: true });

      const incomingPages = await baseDoc.copyPages(incomingDoc, incomingDoc.getPageIndices());
      incomingPages.forEach(p => baseDoc.addPage(p));

      const mergedBytes = await baseDoc.save();
      const mergedBase64 = uint8ArrayToBase64(mergedBytes);
      const mergedDataUrl = `data:application/pdf;base64,${mergedBase64}`;

      // Update in memory and persist
      setPdfDataBytes(mergedBytes);
      const blob = new Blob([mergedBytes as unknown as BlobPart], { type: 'application/pdf' });
      setPdfBlobUrl(URL.createObjectURL(blob));

      const targetId = currentDoc?.id || docTitle;
      await ZenFileSyncService.updateDocumentContent(targetId, mergedDataUrl);
      setShowSplitMergeModal(false);
      showToast(`Successfully merged ${file.name} (${incomingPages.length} new pages added)!`);
    } catch (e) {
      console.error('Merge error', e);
      showToast('Failed to merge PDF documents');
    }
  };

  // Fast, stack-safe Uint8Array to base64 converter
  const uint8ArrayToBase64 = (bytes: Uint8Array): string => {
    let binary = '';
    const len = bytes.byteLength;
    const chunkSize = 8192;
    for (let i = 0; i < len; i += chunkSize) {
      const chunk = bytes.subarray(i, Math.min(i + chunkSize, len));
      binary += String.fromCharCode.apply(null, chunk as unknown as number[]);
    }
    return btoa(binary);
  };

  // Compile edited PDF pages, text overlays, signatures, and annotations into real vector PDF bytes
  const compileEditedPdfDocument = async (): Promise<{ dataUrl: string; bytes: Uint8Array } | null> => {
    try {
      // Defocus any active editable element so blur handlers commit edits
      if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      await new Promise(r => setTimeout(r, 60));

      const isBlankDoc = !pdfBlobUrl && !pdfDataBytes;

      // 1. Blank Document Mode (compile from contentEditable sheet)
      if (isBlankDoc) {
        const editorEl = blankEditorRef.current;
        if (!editorEl) return null;

        const canvas = await html2canvas(editorEl, {
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff'
        });

        const imgData = canvas.toDataURL('image/jpeg', 0.95);
        const w = editorEl.offsetWidth || 816;
        const h = editorEl.offsetHeight || 1056;

        const pdf = new jsPDF({
          orientation: w > h ? 'landscape' : 'portrait',
          unit: 'pt',
          format: [w, h]
        });
        pdf.addImage(imgData, 'JPEG', 0, 0, w, h);

        const arrayBuffer = pdf.output('arraybuffer');
        const dataUrl = pdf.output('datauristring');
        return { dataUrl, bytes: new Uint8Array(arrayBuffer) };
      }

      // 2. Vector PDF Compilation using pdf-lib (Preserves 100% vector text, zero rasterization, keeps file editable)
      const container = canvasContainerRef.current;
      if (pdfDataBytes && container) {
        try {
          const pdfDoc = await PDFDocument.load(pdfDataBytes, { ignoreEncryption: true });
          const pages = pdfDoc.getPages();
          const docRect = docViewportRef.current?.getBoundingClientRect();

          const timesFont = await pdfDoc.embedFont(StandardFonts.TimesRoman);
          const timesBoldFont = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
          const timesItalicFont = await pdfDoc.embedFont(StandardFonts.TimesRomanItalic);
          const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
          const helveticaBoldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
          const courierFont = await pdfDoc.embedFont(StandardFonts.Courier);

          for (let i = 0; i < pages.length; i++) {
            const pageNum = i + 1;
            const pdfPage = pages[i];
            const pageHeight = pdfPage.getHeight();
            const pageWidth = pdfPage.getWidth();

            const pageWrapper = container.querySelector<HTMLElement>(`#pdf-page-${pageNum}`);
            if (!pageWrapper) continue;

            const pageCanvasWrapper = (pageWrapper.querySelector<HTMLElement>('.relative.w-full.flex.justify-center.bg-white') ||
                                        pageWrapper.querySelector<HTMLElement>('div:has(canvas)') ||
                                        pageWrapper) as HTMLElement;
            const canvasWrapperWidth = pageCanvasWrapper?.offsetWidth || pageWidth;
            const canvasWrapperHeight = pageCanvasWrapper?.offsetHeight || pageHeight;
            const scaleX = pageWidth / canvasWrapperWidth;
            const scaleY = pageHeight / canvasWrapperHeight;

            // A. Apply Edited Text Spans (vector whiteout + vector replacement on exact baseline)
            const editedSpans = Array.from(pageWrapper.querySelectorAll<HTMLElement>('.pdf-text-item[data-edited="true"]'));
            for (const span of editedSpans) {
              const origText = span.dataset.originalText || '';
              const rawNewText = span.innerText;
              const cleanText = rawNewText.replace(/\u00a0/g, ' ').replace(/\r?\n/g, ' ').trim();
              const cleanOrig = origText.replace(/\u00a0/g, ' ').replace(/\r?\n/g, ' ').trim();
              if (cleanText === cleanOrig) continue;

              const pdfX = parseFloat(span.dataset.pdfX || '0');
              const pdfY = parseFloat(span.dataset.pdfY || '0');
              const origWidth = parseFloat(span.dataset.pdfWidth || '0');
              const fontSize = parseFloat(span.dataset.pdfHeight || '10');

              let fontToUse = helveticaFont;
              const isSerif = span.dataset.fontFamily === 'serif';
              const isMono = span.dataset.fontFamily === 'monospace';
              const isBold = span.dataset.fontBold === 'true';
              const isItalic = span.dataset.fontItalic === 'true';

              if (isSerif) {
                if (isBold) fontToUse = timesBoldFont;
                else if (isItalic) fontToUse = timesItalicFont;
                else fontToUse = timesFont;
              } else if (isMono) {
                fontToUse = courierFont;
              } else {
                if (isBold) fontToUse = helveticaBoldFont;
                else fontToUse = helveticaFont;
              }

              const newWidth = fontToUse.widthOfTextAtSize(cleanText, fontSize);
              const maskWidth = Math.max(origWidth, newWidth) + 4;
              const maskHeight = fontSize * 1.25;
              const maskY = pdfY - (fontSize * 0.22);

              // Vector whiteout rectangle cleanly covers the original text
              pdfPage.drawRectangle({
                x: Math.max(0, pdfX - 2),
                y: maskY,
                width: maskWidth,
                height: maskHeight,
                color: rgb(1, 1, 1),
              });

              // Vector replacement text written directly at exact baseline
              pdfPage.drawText(cleanText, {
                x: pdfX,
                y: pdfY,
                size: fontSize,
                font: fontToUse,
                color: rgb(0.09, 0.09, 0.11),
              });
            }

            // B. Apply Signatures for this page
            if (pageCanvasWrapper && docRect) {
              const pageRect = pageCanvasWrapper.getBoundingClientRect();
              const pageTop = pageRect.top - docRect.top;
              const pageBottom = pageTop + pageRect.height;
              const pageLeft = pageRect.left - docRect.left;

              for (const sig of appliedSignatures) {
                if (sig.y >= pageTop && sig.y < pageBottom) {
                  const relX = (sig.x - pageLeft) * scaleX;
                  const sigH = (sig.height || 48) * scaleY;
                  const relY = pageHeight - ((sig.y - pageTop) * scaleY) - sigH;
                  const sigW = (sig.width || 140) * scaleX;

                  if (sig.type === 'text') {
                    pdfPage.drawText(sig.text || '', {
                      x: relX,
                      y: relY,
                      size: Math.max(12, 18 * scaleY),
                      font: timesItalicFont,
                      color: rgb(0.92, 0.35, 0.05),
                    });
                  } else if (sig.imageUrl) {
                    try {
                      const imgRes = await fetch(sig.imageUrl);
                      const imgBuffer = await imgRes.arrayBuffer();
                      const embedded = (sig.imageUrl.startsWith('data:image/jpeg') || sig.imageUrl.startsWith('data:image/jpg'))
                        ? await pdfDoc.embedJpg(imgBuffer)
                        : await pdfDoc.embedPng(imgBuffer);
                      pdfPage.drawImage(embedded, {
                        x: relX,
                        y: relY,
                        width: sigW,
                        height: sigH,
                      });
                    } catch (imgErr) {
                      console.warn('Could not embed signature image:', imgErr);
                    }
                  }
                }
              }

              // C. Apply Annotations for this page
              for (const ann of annotations) {
                if (ann.y >= pageTop && ann.y < pageBottom) {
                  const relX = (ann.x - pageLeft) * scaleX;
                  const annH = (ann.height || 22) * scaleY;
                  const relY = pageHeight - ((ann.y - pageTop) * scaleY) - annH;
                  const annW = (ann.width || 120) * scaleX;

                  if (ann.type === 'highlight') {
                    pdfPage.drawRectangle({
                      x: relX,
                      y: relY,
                      width: annW,
                      height: annH,
                      color: rgb(0.99, 0.88, 0.28),
                      opacity: 0.45,
                    });
                  } else if (ann.type === 'redact') {
                    pdfPage.drawRectangle({
                      x: relX,
                      y: relY,
                      width: annW,
                      height: annH,
                      color: rgb(0.09, 0.09, 0.11),
                    });
                  } else if (ann.text) {
                    pdfPage.drawRectangle({
                      x: relX,
                      y: relY,
                      width: annW,
                      height: annH,
                      color: rgb(1, 1, 1),
                      borderColor: rgb(0.92, 0.35, 0.05),
                      borderWidth: 1,
                    });
                    pdfPage.drawText(ann.text, {
                      x: relX + 4,
                      y: relY + 4,
                      size: Math.max(9, 11 * scaleY),
                      font: helveticaFont,
                      color: rgb(0.09, 0.09, 0.11),
                    });
                  }
                }
              }
            }
          }

          const savedBytes = await pdfDoc.save();
          const base64Data = uint8ArrayToBase64(savedBytes);
          const dataUrl = `data:application/pdf;base64,${base64Data}`;
          return { dataUrl, bytes: savedBytes };
        } catch (pdfLibErr) {
          console.warn('pdf-lib vector compile warning, attempting fallback:', pdfLibErr);
        }
      }

      // Fallback: Multi-Page Canvas Capture Mode
      if (!container) return null;
      const pageWrappers = Array.from(container.querySelectorAll<HTMLElement>('[id^="pdf-page-"]'));
      if (pageWrappers.length === 0) {
        if (pdfDataBytes) {
          let dataUrl = currentDoc?.fileData;
          if (!dataUrl) {
            dataUrl = `data:application/pdf;base64,${uint8ArrayToBase64(pdfDataBytes)}`;
          }
          return { dataUrl, bytes: pdfDataBytes };
        }
        return null;
      }

      let pdf: jsPDF | null = null;
      const originalScrollTop = scrollContainerRef.current?.scrollTop || 0;

      for (let i = 0; i < pageWrappers.length; i++) {
        const pageWrapper = pageWrappers[i];
        const pageCanvasWrapper = (pageWrapper.querySelector<HTMLElement>('.relative.w-full.flex.justify-center.bg-white') ||
                                    pageWrapper.querySelector<HTMLElement>('div:has(canvas)') ||
                                    pageWrapper) as HTMLElement;
        if (!pageCanvasWrapper) continue;

        pageWrapper.scrollIntoView({ block: 'nearest' });
        await new Promise(r => setTimeout(r, 20));

        const pageCanvas = await html2canvas(pageCanvasWrapper, {
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff'
        });

        const pageImgData = pageCanvas.toDataURL('image/jpeg', 0.95);
        const ptWidth = pageCanvasWrapper.offsetWidth || 595;
        const ptHeight = pageCanvasWrapper.offsetHeight || 842;

        if (!pdf) {
          pdf = new jsPDF({
            orientation: ptWidth > ptHeight ? 'landscape' : 'portrait',
            unit: 'pt',
            format: [ptWidth, ptHeight]
          });
          pdf.addImage(pageImgData, 'JPEG', 0, 0, ptWidth, ptHeight);
        } else {
          pdf.addPage([ptWidth, ptHeight], ptWidth > ptHeight ? 'landscape' : 'portrait');
          pdf.addImage(pageImgData, 'JPEG', 0, 0, ptWidth, ptHeight);
        }
      }

      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = originalScrollTop;
      }

      if (!pdf) return null;
      const arrayBuffer = pdf.output('arraybuffer');
      const dataUrl = pdf.output('datauristring');
      return { dataUrl, bytes: new Uint8Array(arrayBuffer) };
    } catch (err) {
      console.error('Failed to compile edited PDF:', err);
      return null;
    }
  };

  // Save Document Changes to Local & Cloud Sync + Update File on PC
  const handleSaveDocument = async () => {
    setIsSaving(true);
    showToast('Saving document changes...');
    try {
      const compiled = await compileEditedPdfDocument();
      if (compiled) {
        const targetId = currentDoc?.id || docTitle;
        await ZenFileSyncService.updateDocumentContent(targetId, compiled.dataUrl);

        // Update in-memory state
        setPdfDataBytes(compiled.bytes);
        const newBlob = new Blob([compiled.bytes as unknown as BlobPart], { type: 'application/pdf' });
        setPdfBlobUrl(URL.createObjectURL(newBlob));

        if (currentDoc) {
          setCurrentDoc(prev => prev ? { ...prev, fileData: compiled.dataUrl, sizeBytes: compiled.bytes.length } : null);
        }
        setHasUnsavedChanges(false);

        // Update the physical file on user's PC
        let savedToPc = false;
        const isTauri = typeof window !== 'undefined' && !!(window as any).__TAURI_INTERNALS__;
        const fileName = docTitle.endsWith('.pdf') ? docTitle : `${docTitle}.pdf`;

        if (isTauri) {
          try {
            const { writeFile } = await import('@tauri-apps/plugin-fs');
            const { downloadDir, documentDir, desktopDir, join } = await import('@tauri-apps/api/path');
            let dir = '';
            const loc = currentDoc?.location;
            if (loc === 'Downloads') dir = await downloadDir();
            else if (loc === 'Documents') dir = await documentDir();
            else if (loc === 'Desktop') dir = await desktopDir();
            else dir = await downloadDir();

            if (dir) {
              const targetPath = await join(dir, fileName);
              await writeFile(targetPath, compiled.bytes);
              savedToPc = true;
              showToast(`Saved to PC: ${fileName}`);
            }
          } catch (tauriErr) {
            console.warn('Tauri direct file write notice:', tauriErr);
          }
        }

        if (!savedToPc) {
          // In web browser (e.g. localhost): trigger direct browser download to update file on user's PC
          const blob = new Blob([compiled.bytes as unknown as BlobPart], { type: 'application/pdf' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = fileName;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          setTimeout(() => URL.revokeObjectURL(url), 1000);
          showToast(`Document saved & downloaded to PC (${fileName})!`);

          notifyFileDownloaded({
            name: fileName,
            size: `${(compiled.bytes.length / 1024).toFixed(1)} KB`,
            type: 'pdf'
          });
        } else {
          notifyFileDownloaded({
            name: fileName,
            size: `${(compiled.bytes.length / 1024).toFixed(1)} KB`,
            type: 'pdf'
          });
        }
      } else {
        showToast('No document loaded to save.');
      }
    } catch (err) {
      console.error('Error saving document:', err);
      showToast('Failed to save document.');
    } finally {
      setIsSaving(false);
    }
  };

  // Download / Export PDF with All Modifications Preserved
  const handleDownload = async () => {
    setIsExporting(true);
    showToast('Compiling and exporting PDF...');
    try {
      const compiled = await compileEditedPdfDocument();
      const dataToSave = compiled?.bytes || pdfDataBytes;

      // Automatically persist latest changes to storage
      if (compiled) {
        const targetId = currentDoc?.id || docTitle;
        ZenFileSyncService.updateDocumentContent(targetId, compiled.dataUrl).catch(console.error);
        setPdfDataBytes(compiled.bytes);
        setHasUnsavedChanges(false);
      }

      if (dataToSave) {
        try {
          const { save } = await import('@tauri-apps/plugin-dialog');
          const { writeFile } = await import('@tauri-apps/plugin-fs');
          const filePath = await save({
            defaultPath: docTitle.endsWith('.pdf') ? docTitle : `${docTitle}.pdf`,
            filters: [{ name: 'PDF', extensions: ['pdf'] }]
          });
          if (filePath) {
            await writeFile(filePath, dataToSave);
            showToast(`Exported ${docTitle} successfully!`);
            return;
          }
        } catch (tauriErr) {
          // Fallback to web download
        }
      }

      if (compiled) {
        const blob = new Blob([compiled.bytes as unknown as BlobPart], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = docTitle.endsWith('.pdf') ? docTitle : `${docTitle}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast(`Exported ${docTitle} successfully!`);
      } else if (currentDoc) {
        ZenFileSyncService.downloadDocument(currentDoc);
        showToast(`Exported ${currentDoc.name}`);
      } else if (pdfBlobUrl) {
        const a = document.createElement('a');
        a.href = pdfBlobUrl;
        a.download = docTitle.endsWith('.pdf') ? docTitle : `${docTitle}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        showToast(`Exported ${docTitle}`);
      } else {
        showToast('No PDF loaded to export.');
      }
    } catch (e) {
      console.error('Error exporting PDF:', e);
      showToast('Error exporting PDF.');
    } finally {
      setIsExporting(false);
    }
  };

  // Convert PDF to Editable Document
  const handleEditDocument = async () => {
    // If no PDF file is loaded, immediately navigate to the blank document editor where the user can type
    if (!pdfBlobUrl && !pdfDataBytes) {
      const docName = docTitle.replace(/\.pdf$/i, '.docx');
      router.push(`/editor/document?doc=${encodeURIComponent(docName)}`);
      return;
    }

    setIsExtracting(true);
    setOcrProgress(0);
    let finalExtractedText = extractedPdfText;

    try {
      // If pdf.js found very little text, assume it's a scanned document
      if (extractedPdfText.trim().length < 50) {
        showToast('Running AI OCR on scanned document...');
        
        // Dynamically import tesseract.js
        const { createWorker } = await import('tesseract.js');
        const worker = await createWorker('eng', 1, {
          logger: m => {
            if (m.status === 'recognizing text') {
              setOcrProgress(Math.floor(m.progress * 100));
            }
          }
        });
        
        const container = canvasContainerRef.current;
        if (container) {
          const canvases = container.querySelectorAll('canvas');
          let ocrText = '';
          for (let i = 0; i < canvases.length; i++) {
            const dataUrl = canvases[i].toDataURL('image/png');
            const { data } = await worker.recognize(dataUrl);
            ocrText += `<h3>--- Page ${i + 1} ---</h3><div style="font-family: monospace; white-space: pre-wrap; font-size: 14px; line-height: 1.6; margin-bottom: 2rem;">${data.text}</div>`;
          }
          finalExtractedText = ocrText;
        }
        await worker.terminate();
      }

      if (finalExtractedText.trim().length > 0) {
        localStorage.setItem('zen_extracted_text', finalExtractedText);
        showToast('Document converted to editable format!');
        router.push('/editor/document?doc=Extracted_Document.docx');
      } else {
        showToast('Could not extract any text from this document.');
      }
    } catch (err) {
      console.error('Extraction error:', err);
      showToast('Error converting document to editable format.');
    } finally {
      setIsExtracting(false);
    }
  };

  // Open in new tab
  const handleOpenInNewTab = () => {
    if (pdfBlobUrl) {
      window.open(pdfBlobUrl, '_blank');
    } else {
      showToast('Please load a PDF file first.');
    }
  };

  // Print PDF
  const handlePrint = () => {
    if (pdfBlobUrl) {
      const printIframe = document.createElement('iframe');
      printIframe.style.position = 'fixed';
      printIframe.style.right = '0';
      printIframe.style.bottom = '0';
      printIframe.style.width = '0';
      printIframe.style.height = '0';
      printIframe.style.border = '0';
      printIframe.src = pdfBlobUrl;
      printIframe.onload = () => {
        try {
          printIframe.contentWindow?.focus();
          printIframe.contentWindow?.print();
        } catch {
          window.print();
        }
      };
      document.body.appendChild(printIframe);
    } else {
      window.print();
    }
  };

  // Fullscreen toggle
  const handleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  // Add signature
  const handleAddSignature = () => {
    const scrollContainer = scrollContainerRef.current;
    const docViewport = docViewportRef.current;
    const currentScrollTop = scrollContainer ? scrollContainer.scrollTop : 0;
    const defaultX = docViewport ? Math.max(40, (docViewport.clientWidth - 220) / 2) : 200;
    const defaultY = currentScrollTop + 180;

    if (signTab === 'type') {
      if (!signatureText.trim()) return;
      const newSign = {
        id: `sign-${Date.now()}`,
        type: 'text' as const,
        text: signatureText,
        x: defaultX,
        y: defaultY,
        color: signatureColor,
      };
      setAppliedSignatures(prev => [...prev, newSign]);
      setHasUnsavedChanges(true);
    } else {
      if (!signCanvasRef.current) return;
      const dataUrl = signCanvasRef.current.toDataURL('image/png');
      const newSign = {
        id: `sign-${Date.now()}`,
        type: 'image' as const,
        imageUrl: dataUrl,
        x: defaultX,
        y: defaultY,
      };
      setAppliedSignatures(prev => [...prev, newSign]);
      setHasUnsavedChanges(true);
    }
    setShowSignModal(false);
    showToast('Signature placed on document.');
  };

  // Drawing logic for Signature Canvas
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = signCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.beginPath();
    ctx.moveTo(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
    setIsDrawingSign(true);
  };
  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawingSign) return;
    const canvas = signCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.lineTo(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
    ctx.strokeStyle = signatureColor;
    ctx.lineWidth = 3;
    ctx.stroke();
  };
  const endDrawing = () => {
    setIsDrawingSign(false);
  };
  const clearSignCanvas = () => {
    const canvas = signCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  // Global Dragging Logic
  const handleGlobalMouseMove = (e: React.MouseEvent) => {
    if (!draggedAnnId) return;
    const docRect = docViewportRef.current?.getBoundingClientRect();
    const currentContainerX = docRect ? e.clientX - docRect.left : e.clientX;
    const currentContainerY = docRect ? e.clientY - docRect.top : e.clientY;

    const newX = Math.max(0, currentContainerX - dragOffset.x);
    const newY = Math.max(0, currentContainerY - dragOffset.y);

    if (draggedAnnId.startsWith('sign-')) {
      setAppliedSignatures(prev => prev.map(s => s.id === draggedAnnId ? { ...s, x: newX, y: newY } : s));
    } else {
      setAnnotations(prev => prev.map(a => a.id === draggedAnnId ? { ...a, x: newX, y: newY } : a));
    }
  };

  const handleGlobalMouseUp = () => {
    if (draggedAnnId) {
      setDraggedAnnId(null);
    }
  };

  // Add study note
  const handleAddNote = () => {
    if (!newNoteContent.trim()) return;
    const scrollContainer = scrollContainerRef.current;
    const currentScrollTop = scrollContainer ? scrollContainer.scrollTop : 0;
    const newNote: PdfAnnotation = {
      id: `note-${Date.now()}`,
      type: 'note',
      text: newNoteContent.trim(),
      page: pendingCoords?.page || 1,
      x: pendingCoords?.x || 100,
      y: (pendingCoords?.y || 140) + currentScrollTop,
    };
    setAnnotations(prev => [...prev, newNote]);
    setNewNoteContent('');
    setShowNoteModal(false);
    showToast(`Study note attached.`);
  };

  // Search in PDF text
  const handleSearchPdf = () => {
    if (!pdfSearchQuery.trim()) return;
    const q = pdfSearchQuery.toLowerCase();
    if (extractedPdfText && extractedPdfText.toLowerCase().includes(q)) {
      const pages = extractedPdfText.split('--- Page ');
      let foundPage = 1;
      for (let i = 1; i < pages.length; i++) {
        if (pages[i].toLowerCase().includes(q)) {
          foundPage = i;
          break;
        }
      }
      const el = document.getElementById(`pdf-page-${foundPage}`);
      el?.scrollIntoView({ behavior: 'smooth' });
      showToast(`Found "${pdfSearchQuery}" on Page ${foundPage}`);
    } else {
      showToast(`"${pdfSearchQuery}" not found in document text.`);
    }
  };

  return (
    <div 
      className="flex flex-col h-screen w-screen overflow-hidden bg-zinc-100 dark:bg-[#000000] font-sans text-zinc-800 dark:text-zinc-200"
      onMouseMove={handleGlobalMouseMove}
      onMouseUp={handleGlobalMouseUp}
      onMouseLeave={handleGlobalMouseUp}
    >
      
      {/* Hidden file picker input for PDF */}
      <input 
        type="file" 
        ref={fileInputRef} 
        accept="application/pdf" 
        className="hidden" 
        onChange={handleFileChange} 
      />

      {/* Hidden image picker input for Insert Picture */}
      <input 
        type="file" 
        id="image-insert-input"
        accept="image/*" 
        className="hidden" 
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onload = (event) => {
              if (event.target?.result) {
                const scrollContainer = scrollContainerRef.current;
                const currentScrollTop = scrollContainer ? scrollContainer.scrollTop : 0;
                const newAnn: PdfAnnotation = {
                  id: `img-${Date.now()}`,
                  type: 'image',
                  imageUrl: event.target.result as string,
                  page: 1,
                  x: 150,
                  y: currentScrollTop + 160,
                };
                setAnnotations(prev => [...prev, newAnn]);
                showToast('Image inserted. You can now drag it.');
              }
            };
            reader.readAsDataURL(file);
            e.target.value = ''; // reset
          }
        }} 
      />

      {/* 1. GOOGLE DOCS STYLE HEADER */}
      {!readingMode && (
        <>
        <div className="h-14 bg-white dark:bg-[#0c0c0e] border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between px-3 shrink-0 select-none">
          {/* Left: App Brand, Document Title, and Menu Bar */}
          <div className="flex items-center gap-3">
            <Link 
              href="/dashboard" 
              className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              title="Return to Dashboard"
            >
              <div className="w-8 h-8 rounded-lg bg-orange-600 flex items-center justify-center text-white shadow-xs">
                <svg width="18" height="18" viewBox="0 0 200 200" fill="none">
                  <path d="M44 38C44 29 51 22 60 22H118L156 60V156C156 165 149 172 140 172H60C51 172 44 165 44 156V38Z" fill="#FFFFFF"/>
                  <path d="M118 22V50C118 55 122 60 128 60H156L118 22Z" fill="#FDBA74"/>
                  <path d="M66 110L134 110L76 138L134 138" stroke="#EA580C" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            </Link>

            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <input 
                  type="text"
                  value={docTitle}
                  onChange={(e) => {
                    setDocTitle(e.target.value);
                    setHasUnsavedChanges(true);
                  }}
                  className="font-medium text-sm text-zinc-900 dark:text-zinc-100 bg-transparent hover:bg-zinc-100 dark:hover:bg-zinc-800 focus:bg-white dark:focus:bg-zinc-900 border border-transparent focus:border-zinc-300 dark:focus:border-zinc-700 rounded px-1.5 py-0.5 max-w-[280px] truncate outline-none transition-colors"
                />
                <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600 bg-rose-50 dark:bg-rose-950/40 px-1.5 py-0.5 rounded border border-rose-200 dark:border-rose-900">
                  PDF
                </span>
                <span className="hidden sm:flex items-center gap-1.5 text-[11px] text-zinc-400">
                  {isSaving ? (
                    <>
                      <Loader2 className="w-3 h-3 text-orange-500 animate-spin" />
                      <span className="text-orange-500">Saving...</span>
                    </>
                  ) : hasUnsavedChanges ? (
                    <span className="text-amber-500 font-medium">● Unsaved changes</span>
                  ) : (
                    <>
                      <Check className="w-3 h-3 text-emerald-500" />
                      <span className="text-zinc-400">Saved</span>
                      <span className="hidden md:inline-flex items-center gap-1 ml-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60">
                        <PenTool className="w-2.5 h-2.5" /> Editable
                      </span>
                    </>
                  )}
                </span>
              </div>

              {/* Menu items like Google Docs */}
              <div className="flex items-center gap-0.5 text-xs text-zinc-600 dark:text-zinc-400 -ml-1 mt-0.5">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="px-2 py-0.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100">File</button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="dark:bg-[#18181b] dark:border-zinc-800 text-xs">
                    <DropdownMenuItem onClick={handleSaveDocument}>
                      <Save className="w-3.5 h-3.5 mr-2 text-orange-500" /> Save Document (Ctrl+S)
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleDownload}>
                      <Download className="w-3.5 h-3.5 mr-2" /> Export as PDF
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
                      <Upload className="w-3.5 h-3.5 mr-2" /> Open New PDF...
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handlePrint}>
                      <Printer className="w-3.5 h-3.5 mr-2" /> Print Document
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                <button onClick={() => setSelectedTool('select')} className="px-2 py-0.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100">Edit</button>
                <button onClick={() => setReadingMode(true)} className="px-2 py-0.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100">View</button>
                <button onClick={() => document.getElementById('image-insert-input')?.click()} className="px-2 py-0.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100">Insert</button>
                <button onClick={() => setShowAiModal(true)} className="px-2 py-0.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100">Tools</button>
              </div>
            </div>
          </div>

          {/* Right side: Clean Google Docs Actions */}
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => setShowAiModal(true)}
              className="h-8 px-3 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white text-xs font-medium rounded-full shadow-xs gap-1.5 transition-all"
            >
              <Sparkles className="w-3.5 h-3.5 animate-pulse text-amber-100" />
              <span className="hidden sm:inline">ZenAI Copilot</span>
            </Button>

            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => fileInputRef.current?.click()}
              className="h-8 text-xs px-3 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800"
            >
              <Upload className="w-3.5 h-3.5 mr-1.5 text-zinc-500" /> Open PDF
            </Button>

            <Button 
              variant="outline"
              size="sm" 
              onClick={handleSaveDocument}
              disabled={isSaving}
              className="h-8 text-xs px-3 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100 gap-1.5"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-orange-600" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5 text-zinc-500" />
                  <span>Save</span>
                </>
              )}
            </Button>

            <Button 
              size="sm" 
              onClick={handleDownload}
              disabled={isExporting}
              className="h-8 text-xs px-3 bg-orange-600 hover:bg-orange-700 text-white shadow-xs font-medium gap-1.5"
            >
              {isExporting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Exporting...</span>
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5" />
                  <span>Export</span>
                </>
              )}
            </Button>

            <button 
              onClick={handleFullscreen}
              className="p-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors"
              title="Toggle Fullscreen"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 2. COMPACT, TIGHTLY GROUPED TOOLBAR (Google Docs Style) */}
        <div className="bg-white dark:bg-[#121214] border-b border-zinc-200 dark:border-zinc-800 px-3 py-1 flex items-center gap-1 overflow-x-auto no-scrollbar min-h-[42px]">
          {/* History (Undo / Redo / Print) */}
          <div className="flex items-center gap-0.5">
            <button 
              onClick={handleUndo}
              disabled={undoStack.length === 0}
              className={`p-1.5 rounded transition-colors ${undoStack.length > 0 ? 'hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-200 cursor-pointer' : 'opacity-40 text-zinc-400 cursor-not-allowed'}`}
              title="Undo (Ctrl+Z)"
            >
              <Undo2 className="w-4 h-4" />
            </button>
            <button 
              onClick={handleRedo}
              disabled={redoStack.length === 0}
              className={`p-1.5 rounded transition-colors ${redoStack.length > 0 ? 'hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-200 cursor-pointer' : 'opacity-40 text-zinc-400 cursor-not-allowed'}`}
              title="Redo (Ctrl+Y)"
            >
              <Redo2 className="w-4 h-4" />
            </button>
            <button 
              onClick={handlePrint}
              className="p-1.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
              title="Print Document"
            >
              <Printer className="w-4 h-4" />
            </button>
          </div>

          <div className="h-5 w-px bg-zinc-200 dark:bg-zinc-800 mx-1 shrink-0" />

          {/* Instant Responsive Zoom */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => handleZoom(-15)}
              className="p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
              title="Zoom Out (-15%)"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleResetZoom}
              className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 w-11 text-center select-none hover:text-orange-600 cursor-pointer transition-colors"
              title="Reset Zoom to 100%"
            >
              {zoom}%
            </button>
            <button
              onClick={() => handleZoom(15)}
              className="p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
              title="Zoom In (+15%)"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="h-5 w-px bg-zinc-200 dark:bg-zinc-800 mx-1 shrink-0" />

          {/* Cursor Modes */}
          <div className="flex items-center gap-0.5">
            <button 
              onClick={() => { setSelectedTool('select'); showToast('Select & Edit Mode active'); }}
              className={`h-7 px-2 rounded flex items-center gap-1 text-xs font-medium transition-colors ${
                selectedTool === 'select' 
                  ? 'bg-orange-50 dark:bg-orange-950/40 text-orange-600 font-semibold ring-1 ring-orange-400/50' 
                  : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
              }`}
              title="Select & Edit Mode (Click any text to edit inline)"
            >
              <MousePointer2 className="w-3.5 h-3.5" />
              <span>Select & Edit</span>
            </button>
            <button 
              onClick={() => { setSelectedTool('pan'); showToast('Hand Tool active: drag to scroll'); }}
              className={`h-7 px-2 rounded flex items-center gap-1 text-xs font-medium transition-colors ${
                selectedTool === 'pan' 
                  ? 'bg-orange-50 dark:bg-orange-950/40 text-orange-600 font-semibold ring-1 ring-orange-400/50' 
                  : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
              }`}
              title="Hand Tool (Click & drag page to pan smoothly)"
            >
              <Hand className="w-3.5 h-3.5" />
              <span>Hand</span>
            </button>
            <button 
              onClick={() => { setSelectedTool('text'); showToast('Text Select active'); }}
              className={`h-7 px-2 rounded flex items-center gap-1 text-xs font-medium transition-colors ${
                selectedTool === 'text' 
                  ? 'bg-orange-50 dark:bg-orange-950/40 text-orange-600 font-semibold ring-1 ring-orange-400/50' 
                  : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
              }`}
              title="Text Select Mode"
            >
              <TextSelect className="w-3.5 h-3.5" />
              <span>Text Select</span>
            </button>
          </div>

          <div className="h-5 w-px bg-zinc-200 dark:bg-zinc-800 mx-1 shrink-0" />

          {/* Insert & Markup Tools */}
          <div className="flex items-center gap-0.5">
            <button 
              onClick={() => {
                const isAdd = selectedTool !== 'add-text';
                setSelectedTool(isAdd ? 'add-text' : 'select');
                showToast(isAdd ? 'Click anywhere on the document to place a new text box' : 'Select mode');
              }}
              className={`h-7 px-2 rounded flex items-center gap-1 text-xs font-medium transition-colors ${
                selectedTool === 'add-text'
                  ? 'bg-orange-50 dark:bg-orange-950/40 text-orange-600 font-semibold ring-1 ring-orange-500'
                  : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
              }`}
              title="Click anywhere on the PDF page to add text"
            >
              <TypeOutline className="w-3.5 h-3.5" />
              <span>Add Text</span>
            </button>

            <button 
              onClick={() => document.getElementById('image-insert-input')?.click()}
              className="h-7 px-2 rounded flex items-center gap-1 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              title="Insert Image / Picture"
            >
              <ImagePlus className="w-3.5 h-3.5" />
              <span>Image</span>
            </button>

            <button 
              onClick={() => {
                const isHl = selectedTool !== 'highlight';
                setSelectedTool(isHl ? 'highlight' : 'select');
                showToast(isHl ? 'Click any text on the page to highlight it yellow' : 'Select mode');
              }}
              className={`h-7 px-2 rounded flex items-center gap-1 text-xs font-medium transition-colors ${
                selectedTool === 'highlight'
                  ? 'bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 font-semibold ring-1 ring-amber-500'
                  : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
              }`}
              title="Highlight text marker"
            >
              <Highlighter className="w-3.5 h-3.5" />
              <span>Highlight</span>
            </button>

            <button 
              onClick={() => {
                const isRedact = selectedTool !== 'redact';
                setSelectedTool(isRedact ? 'redact' : 'select');
                showToast(isRedact ? 'Click any text to blackout redact' : 'Select mode');
              }}
              className={`h-7 px-2 rounded flex items-center gap-1 text-xs font-medium transition-colors ${
                selectedTool === 'redact'
                  ? 'bg-zinc-900 text-white font-semibold ring-1 ring-zinc-700'
                  : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
              }`}
              title="Redact sensitive data"
            >
              <Square className="w-3.5 h-3.5" />
              <span>Redact</span>
            </button>

            <button 
              onClick={() => {
                setPendingCoords({ page: 1, x: 140, y: 200 });
                setShowNoteModal(true);
              }}
              className="h-7 px-2 rounded flex items-center gap-1 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              title="Add Comment"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Comment</span>
            </button>

            <button 
              onClick={() => {
                setPendingCoords({ page: 1, x: 220, y: 180 });
                setShowNoteModal(true);
              }}
              className="h-7 px-2 rounded flex items-center gap-1 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              title="Add Sticky Note"
            >
              <StickyNote className="w-3.5 h-3.5" />
              <span>Note</span>
            </button>
          </div>

          <div className="h-5 w-px bg-zinc-200 dark:bg-zinc-800 mx-1 shrink-0" />

          {/* Fill & Sign */}
          <div className="flex items-center gap-0.5">
            <button 
              onClick={() => setShowSignModal(true)}
              className="h-7 px-2 rounded flex items-center gap-1 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              title="Sign Document"
            >
              <FileSignature className="w-3.5 h-3.5 text-orange-600" />
              <span>Sign</span>
            </button>
            <button 
              onClick={() => {
                const isForm = selectedTool !== 'fill-form';
                setSelectedTool(isForm ? 'fill-form' : 'select');
                showToast(isForm ? 'Form Filler active: All fields highlighted for 1-click edit' : 'Select mode');
              }}
              className={`h-7 px-2 rounded flex items-center gap-1 text-xs font-medium transition-colors ${
                selectedTool === 'fill-form'
                  ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 font-semibold ring-1 ring-blue-500'
                  : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
              }`}
              title="Form Filler: Highlights all editable lines on the receipt"
            >
              <LayoutTemplate className="w-3.5 h-3.5" />
              <span>Fill Form</span>
            </button>
          </div>

          <div className="h-5 w-px bg-zinc-200 dark:bg-zinc-800 mx-1 shrink-0" />

          {/* Functional Conversions & Tools */}
          <div className="flex items-center gap-0.5">
            <button 
              onClick={handlePdfToWord}
              className="h-7 px-2 rounded flex items-center gap-1 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              title="Convert & Export to Word document (.doc)"
            >
              <FileText className="w-3.5 h-3.5 text-blue-600" />
              <span>PDF to Word</span>
            </button>
            <button 
              onClick={handlePdfToExcel}
              className="h-7 px-2 rounded flex items-center gap-1 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              title="Convert & Export tables to Excel spreadsheet (.xlsx)"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>PDF to Excel</span>
            </button>
            <button 
              onClick={() => setShowSplitMergeModal(true)}
              className="h-7 px-2 rounded flex items-center gap-1 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              title="Split or Merge PDF documents"
            >
              <Split className="w-3.5 h-3.5 text-orange-600" />
              <span>Split / Merge</span>
            </button>
          </div>
        </div>
        </>
      )}

      {/* READING MODE FLOATING CONTROLS */}
      {readingMode && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => setShowAiModal(true)}
            className="h-9 px-3 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white shadow-lg rounded-full gap-1.5 transition-transform hover:scale-105"
            title="ZenAI Academic Study Copilot"
          >
            <Sparkles className="w-4 h-4 animate-pulse text-amber-200" />
            <span>ZenAI Study Copilot</span>
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => setReadingMode(false)}
            className="h-9 w-9 p-0 bg-white dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white shadow-lg rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all hover:scale-105"
            title="Exit Reading Mode (Esc)"
          >
            <Maximize2 className="w-4 h-4 text-orange-500" />
          </Button>
        </div>
      )}

      {/* OCR PROGRESS OVERLAY */}
      {isExtracting && (
        <div className="absolute inset-0 z-[100] bg-black/60 flex items-center justify-center backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-900 p-8 rounded-xl shadow-2xl max-w-sm w-full flex flex-col items-center">
            <RefreshCw className="w-10 h-10 text-orange-600 animate-spin mb-4" />
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-2">Analyzing Document</h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 text-center mb-6">
              {ocrProgress > 0 
                ? `Running AI OCR on scanned pages... (${ocrProgress}%)`
                : 'Extracting text layer and structure...'}
            </p>
            {ocrProgress > 0 && (
              <div className="w-full bg-zinc-200 dark:bg-zinc-800 h-2 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-orange-600 transition-all duration-300"
                  style={{ width: `${ocrProgress}%` }}
                ></div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 4. MAIN WORKSPACE WITH CANVAS */}
      <div 
        className="flex-1 flex overflow-hidden relative bg-[#F8F9FA] dark:bg-[#09090b]"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Left Sidebar Mini Toggle */}
        {!readingMode && (
          <div className="w-10 bg-white dark:bg-[#0c0c0e] border-r border-zinc-200 dark:border-zinc-800 flex flex-col items-center py-3 gap-3 shrink-0 text-zinc-400 dark:text-zinc-500">
            <button 
              onClick={() => setShowAiModal(true)}
              className="p-1.5 rounded transition-colors hover:bg-black/5 dark:hover:bg-zinc-800"
              title="ZenAI Study Copilot"
            >
              <Sparkles className="w-[18px] h-[18px]" strokeWidth={1.5} />
            </button>
            <button 
              onClick={() => { setShowSidebar(true); setSidebarTab('bookmarks'); }}
              className={`p-1.5 rounded transition-colors ${showSidebar && sidebarTab === 'bookmarks' ? 'bg-black/10 text-zinc-900' : 'hover:bg-black/5 dark:hover:bg-zinc-800'}`}
              title="Bookmarks"
            >
              <Bookmark className="w-[18px] h-[18px]" strokeWidth={1.5} />
            </button>
            <button 
              onClick={() => { setShowSidebar(true); setSidebarTab('thumbnails'); }}
              className={`p-1.5 rounded transition-colors ${showSidebar && sidebarTab === 'thumbnails' ? 'bg-black/10 text-zinc-900' : 'hover:bg-black/5 dark:hover:bg-zinc-800'}`}
              title="Page Thumbnails"
            >
              <FileText className="w-[18px] h-[18px]" strokeWidth={1.5} />
            </button>
            <button 
              onClick={() => { setShowSidebar(true); setSidebarTab('comments'); }}
              className={`p-1.5 rounded transition-colors ${showSidebar && sidebarTab === 'comments' ? 'bg-black/10 text-zinc-900' : 'hover:bg-black/5 dark:hover:bg-zinc-800'}`}
              title="Signatures & Annotations"
            >
              <MessageSquare className="w-[18px] h-[18px]" strokeWidth={1.5} />
            </button>
            <button 
              onClick={() => { setShowSidebar(true); setSidebarTab('attachments'); }}
              className={`p-1.5 rounded transition-colors ${showSidebar && sidebarTab === 'attachments' ? 'bg-black/10 text-zinc-900' : 'hover:bg-black/5 dark:hover:bg-zinc-800'}`}
              title="Attachments"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
            </button>
            <button 
              onClick={() => { setShowSidebar(true); setSidebarTab('signatures'); }}
              className={`p-1.5 rounded transition-colors ${showSidebar && sidebarTab === 'signatures' ? 'bg-black/10 text-zinc-900' : 'hover:bg-black/5 dark:hover:bg-zinc-800'}`}
              title="Signatures"
            >
              <PenTool className="w-[18px] h-[18px]" strokeWidth={1.5} />
            </button>
            <button 
              onClick={() => { setShowSidebar(true); setSidebarTab('layers'); }}
              className={`p-1.5 rounded transition-colors ${showSidebar && sidebarTab === 'layers' ? 'bg-black/10 text-zinc-900' : 'hover:bg-black/5 dark:hover:bg-zinc-800'}`}
              title="Layers"
            >
              <Layers className="w-[18px] h-[18px]" strokeWidth={1.5} />
            </button>
          </div>
        )}

        {/* Collapsible Sidebar Details Panel */}
        {showSidebar && !readingMode && (
          <div className="w-56 bg-zinc-50 dark:bg-[#121214] border-r border-zinc-200 dark:border-zinc-800 flex flex-col shrink-0">
            <div className="p-2.5 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              <span className="capitalize">{sidebarTab}</span>
              <button onClick={() => setShowSidebar(false)} className="text-zinc-400 hover:text-zinc-600">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="p-3 text-xs text-zinc-600 dark:text-zinc-400 flex-1 overflow-y-auto">
              {sidebarTab === 'thumbnails' && (
                <div className="space-y-3">
                  <div className="border border-orange-500 rounded p-2 bg-white dark:bg-zinc-900 text-center shadow-xs">
                    <FileText className="w-8 h-8 text-orange-500 mx-auto mb-1" />
                    <span className="text-[11px] font-semibold text-zinc-900 dark:text-white block truncate">{docTitle}</span>
                    <span className="text-[10px] text-zinc-400">{numPages} page(s) loaded</span>
                  </div>
                  {numPages > 1 && (
                    <div className="space-y-1.5 pt-2">
                      {[...Array(numPages)].map((_, i) => (
                        <button
                          key={i}
                          onClick={() => {
                            const el = document.getElementById(`pdf-page-${i + 1}`);
                            el?.scrollIntoView({ behavior: 'smooth' });
                          }}
                          className="w-full text-left px-2 py-1.5 rounded hover:bg-zinc-200 dark:hover:bg-zinc-800 text-[11px] flex items-center justify-between"
                        >
                          <span>Page {i + 1}</span>
                          <span className="text-zinc-400 text-[10px]">Jump →</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {sidebarTab === 'comments' && (
                <div className="space-y-3">
                  <div>
                    <div className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">Signatures ({appliedSignatures.length})</div>
                    {appliedSignatures.map(sig => (
                      <div key={sig.id} className="p-2 bg-white dark:bg-zinc-900 rounded border border-zinc-200 dark:border-zinc-800 text-[11px] flex items-center justify-between mb-1">
                        <div>
                          <div className="font-semibold text-orange-600 font-serif italic">{sig.text}</div>
                        </div>
                        <button onClick={() => setAppliedSignatures(p => p.filter(s => s.id !== sig.id))} className="text-zinc-400 hover:text-red-500">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                    {appliedSignatures.length === 0 && (
                      <div className="text-zinc-400 text-[10px]">No signatures placed.</div>
                    )}
                  </div>

                  <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800">
                    <div className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">Study Notes &amp; Highlights ({annotations.length})</div>
                    {annotations.map(ann => (
                      <div key={ann.id} className="p-2 bg-white dark:bg-zinc-900 rounded border border-zinc-200 dark:border-zinc-800 text-[11px] flex items-center justify-between mb-1">
                        <div>
                          <div className="font-semibold text-zinc-800 dark:text-zinc-200">{ann.type === 'highlight' ? '🖍️ Highlight' : '📝 Note'} (P.{ann.page})</div>
                          <div className="text-zinc-500 text-[10px] truncate max-w-[140px]">{ann.text}</div>
                        </div>
                        <button onClick={() => setAnnotations(p => p.filter(a => a.id !== ann.id))} className="text-zinc-400 hover:text-red-500">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                    {annotations.length === 0 && (
                      <div className="text-zinc-400 text-[10px]">No annotations added.</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Central Document Canvas with Hand Panning */}
        <div 
          ref={scrollContainerRef} 
          onMouseDown={(e) => {
            if (selectedTool === 'pan') {
              isPanningRef.current = true;
              panStartRef.current = {
                x: e.clientX,
                y: e.clientY,
                scrollLeft: scrollContainerRef.current?.scrollLeft || 0,
                scrollTop: scrollContainerRef.current?.scrollTop || 0,
              };
            }
          }}
          onMouseMove={(e) => {
            if (isPanningRef.current && scrollContainerRef.current) {
              const dx = e.clientX - panStartRef.current.x;
              const dy = e.clientY - panStartRef.current.y;
              scrollContainerRef.current.scrollLeft = panStartRef.current.scrollLeft - dx;
              scrollContainerRef.current.scrollTop = panStartRef.current.scrollTop - dy;
            }
          }}
          onMouseUp={() => { isPanningRef.current = false; }}
          className={`flex-1 h-full w-full overflow-auto flex flex-col items-center p-2 sm:p-6 relative ${selectedTool === 'pan' ? 'cursor-grab active:cursor-grabbing select-none' : ''}`}
        >
          
          {isLoading ? (
            <div className="flex flex-col items-center justify-center my-auto gap-3 text-zinc-500 dark:text-zinc-400">
              <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm font-medium">Loading {docTitle}...</span>
            </div>
          ) : (pdfBlobUrl || pdfDataBytes) ? (
            <div 
              ref={docViewportRef} 
              style={{
                transform: `scale(${zoom / 100})`,
                transformOrigin: 'top center',
                transition: 'transform 0.12s ease-out'
              }}
              className="w-fit flex flex-col items-center relative"
            >
              
              {/* Overlay Signatures (Anchored to Document, scrolls naturally) */}
              {appliedSignatures.map(sig => (
                <div 
                  key={sig.id}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    setDraggedAnnId(sig.id);
                    const docRect = docViewportRef.current?.getBoundingClientRect();
                    const currentContainerX = docRect ? e.clientX - docRect.left : e.clientX;
                    const currentContainerY = docRect ? e.clientY - docRect.top : e.clientY;
                    setDragOffset({ x: currentContainerX - sig.x, y: currentContainerY - sig.y });
                  }}
                  className="absolute z-30 pointer-events-auto px-1 py-0.5 flex items-center gap-2 cursor-grab active:cursor-grabbing group select-none"
                  style={{ top: `${sig.y}px`, left: `${sig.x}px` }}
                >
                  {sig.type === 'text' ? (
                    <span className="font-serif italic text-xl drop-shadow-none" style={{ color: sig.color || '#ea580c' }}>{sig.text}</span>
                  ) : (
                    <img src={sig.imageUrl} className="h-12 w-auto pointer-events-none filter drop-shadow-sm" alt="Drawn Signature" />
                  )}
                  <button 
                    onClick={(e) => { e.stopPropagation(); setAppliedSignatures(prev => prev.filter(s => s.id !== sig.id)) }}
                    className="text-zinc-400 hover:text-rose-500 ml-1 opacity-0 group-hover:opacity-100 transition-opacity absolute -top-2 -right-2 bg-white dark:bg-zinc-800 rounded-full border border-zinc-200 dark:border-zinc-700 shadow-sm p-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}

              {/* Overlay Study Notes & Highlights (Anchored to Document, scrolls naturally) */}
              {annotations.map(ann => (
                <div 
                  key={ann.id}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    setDraggedAnnId(ann.id);
                    const docRect = docViewportRef.current?.getBoundingClientRect();
                    const currentContainerX = docRect ? e.clientX - docRect.left : e.clientX;
                    const currentContainerY = docRect ? e.clientY - docRect.top : e.clientY;
                    setDragOffset({ x: currentContainerX - ann.x, y: currentContainerY - ann.y });
                  }}
                  className={`absolute z-30 pointer-events-auto px-3 py-1.5 rounded-lg shadow-xl flex items-center gap-2 border cursor-grab active:cursor-grabbing group ${
                    ann.type === 'highlight' 
                      ? 'bg-amber-200/90 text-amber-900 border-amber-400 font-semibold text-xs' 
                      : ann.type === 'text'
                      ? 'bg-transparent border-transparent hover:border-zinc-300 dark:hover:border-zinc-700 text-lg'
                      : ann.type === 'image'
                      ? 'bg-transparent border-transparent p-0'
                      : ann.type === 'redact'
                      ? 'bg-zinc-900 text-zinc-100 border-zinc-900 font-sans text-xs p-2 rounded-none'
                      : 'bg-white/95 dark:bg-zinc-900/95 text-zinc-900 dark:text-zinc-100 border-orange-500 font-sans text-xs'
                  }`}
                  style={{ top: `${ann.y}px`, left: `${ann.x}px` }}
                >
                  {ann.type === 'text' ? (
                    <input 
                      autoFocus
                      type="text" 
                      value={ann.text} 
                      onChange={(e) => setAnnotations(prev => prev.map(a => a.id === ann.id ? { ...a, text: e.target.value } : a))}
                      className="bg-transparent outline-none border-b border-transparent focus:border-orange-500 text-zinc-900 dark:text-white"
                      placeholder="Type here..."
                    />
                  ) : ann.type === 'image' ? (
                    <img src={ann.imageUrl} className="max-w-[200px] h-auto rounded pointer-events-none" alt="Inserted" />
                  ) : ann.type === 'redact' ? (
                    <textarea 
                      autoFocus
                      value={ann.text} 
                      onChange={(e) => setAnnotations(prev => prev.map(a => a.id === ann.id ? { ...a, text: e.target.value } : a))}
                      className="bg-zinc-900 text-white outline-none border-none min-w-[100px] min-h-[40px] resize placeholder-zinc-500"
                      placeholder="Redacted"
                    />
                  ) : (
                    <span>{ann.type === 'highlight' ? '🖍️' : '📝'} {ann.text}</span>
                  )}
                  <button 
                    onClick={(e) => { e.stopPropagation(); setAnnotations(prev => prev.filter(a => a.id !== ann.id)) }}
                    className="text-zinc-400 hover:text-rose-500 ml-1 opacity-0 group-hover:opacity-100 transition-opacity absolute -top-2 -right-2 bg-white dark:bg-zinc-800 rounded-full border border-zinc-200 dark:border-zinc-700 shadow-sm p-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}



              {/* View Mode 1: Pure HTML5 Canvas Rendering (No iframes, zero blocking!) */}
              {viewMode === 'canvas' ? (
                <>
                  <div 
                    ref={canvasContainerRef} 
                    className={`w-full flex flex-col items-center pb-24 ${selectedTool === 'pan' ? 'cursor-grab active:cursor-grabbing' : selectedTool === 'text' || selectedTool === 'add-text' ? 'cursor-text' : 'cursor-default'}`}
                  />
                </>
              ) : (
                /* View Mode 2: Native PDF Object/Embed */
                <div className="w-full h-[850px] bg-white dark:bg-[#121214] rounded-xl shadow-2xl overflow-hidden border border-zinc-300 dark:border-zinc-800">
                  <object
                    data={pdfBlobUrl || ''}
                    type="application/pdf"
                    className="w-full h-full"
                  >
                    <iframe
                      src={pdfBlobUrl || ''}
                      className="w-full h-full border-none"
                      title={docTitle}
                    />
                  </object>
                </div>
              )}

            </div>
          ) : (
            /* BLANK DOCUMENT PAGE CANVAS - GOOGLE DOCS STYLE */
            <div className="w-full flex flex-col items-center py-6 sm:py-10 pb-28">
              {/* The A4 Document Sheet */}
              <div 
                onClick={() => blankEditorRef.current?.focus()}
                className="w-full max-w-[816px] min-h-[1056px] h-fit bg-white dark:bg-[#121214] shadow-[0_1px_3px_rgba(0,0,0,0.1),0_1px_2px_rgba(0,0,0,0.06)] border border-zinc-200/90 dark:border-zinc-800 p-12 sm:p-20 select-text flex flex-col cursor-text transition-all rounded-[2px]"
              >
                {/* Editable Document Body */}
                <div 
                  ref={blankEditorRef}
                  contentEditable
                  suppressContentEditableWarning
                  spellCheck={true}
                  onInput={(e) => {
                    setBlankDocText((e.target as HTMLDivElement).innerText);
                    setHasUnsavedChanges(true);
                  }}
                  className="outline-none flex-1 leading-relaxed text-zinc-900 dark:text-zinc-100 text-base font-sans min-h-[850px] empty:before:content-['Type_@_to_insert_or_start_typing...'] empty:before:text-zinc-400 empty:before:cursor-text"
                />
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Floating Zoom & Page Controls (Fixed to screen viewport, rock-solid instant controls) */}
      <div className="fixed bottom-6 right-6 z-40 bg-white/95 dark:bg-zinc-800/95 backdrop-blur-md border border-zinc-200 dark:border-zinc-700 rounded-full shadow-xl flex items-center p-1.5 gap-1 select-none pointer-events-auto">
        <button 
          onClick={() => handleZoom(-15)} 
          className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 transition-colors cursor-pointer"
          title="Zoom Out (-15%)"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button 
          onClick={handleResetZoom}
          className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 w-11 text-center select-none hover:text-orange-600 cursor-pointer transition-colors"
          title="Reset Zoom to 100%"
        >
          {zoom}%
        </button>
        <button 
          onClick={() => handleZoom(15)} 
          className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 transition-colors cursor-pointer"
          title="Zoom In (+15%)"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <div className="w-px h-4 bg-zinc-300 dark:bg-zinc-600 mx-1" />
        <button 
          onClick={() => setZoom(100)} 
          className="px-2.5 h-7 rounded-full text-[10px] font-semibold hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 transition-colors cursor-pointer"
          title="Fit to Actual Size (100%)"
        >
          Fit Size
        </button>
      </div>

      {/* Signature Modal */}
      {showSignModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#121214] border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                <PenTool className="w-4 h-4 text-orange-500" /> Add Digital Signature
              </h3>
              <button onClick={() => setShowSignModal(false)} className="text-zinc-400 hover:text-zinc-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex bg-zinc-100 dark:bg-zinc-900 p-1 rounded-lg mb-4">
              <button 
                onClick={() => setSignTab('type')}
                className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${signTab === 'type' ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}
              >
                Type
              </button>
              <button 
                onClick={() => setSignTab('draw')}
                className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${signTab === 'draw' ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}
              >
                Draw
              </button>
            </div>

            <div className="space-y-4">
              {signTab === 'type' ? (
                <>
                  <div>
                    <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5 block">
                      Signer Full Name
                    </label>
                    <input 
                      type="text" 
                      value={signatureText} 
                      onChange={(e) => setSignatureText(e.target.value)}
                      className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg text-sm outline-none focus:border-orange-500 text-zinc-900 dark:text-white"
                      placeholder="Type your name..." 
                    />
                  </div>

                  <div className="p-4 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-dashed border-zinc-300 dark:border-zinc-700 text-center">
                    <span className="text-xs text-zinc-400 block mb-2">Signature Preview:</span>
                    <span className="text-2xl font-serif italic tracking-wider" style={{ color: signatureColor }}>
                      {signatureText || 'Your Signature'}
                    </span>
                  </div>
                </>
              ) : (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block">
                      Draw Signature
                    </label>
                    <button onClick={clearSignCanvas} className="text-[10px] text-zinc-500 hover:text-orange-500">
                      Clear
                    </button>
                  </div>
                  <div className="rounded-lg bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 overflow-hidden cursor-crosshair">
                    <canvas 
                      ref={signCanvasRef}
                      width={400}
                      height={150}
                      className="w-full h-[150px] touch-none"
                      onMouseDown={startDrawing}
                      onMouseMove={draw}
                      onMouseUp={endDrawing}
                      onMouseLeave={endDrawing}
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between pt-2">
                <div className="flex gap-2">
                  {['#ea580c', '#000000', '#2563eb', '#16a34a', '#dc2626'].map(c => (
                    <button 
                      key={c}
                      onClick={() => setSignatureColor(c)}
                      className={`w-6 h-6 rounded-full border-2 ${signatureColor === c ? 'border-orange-500' : 'border-transparent'}`}
                      style={{ backgroundColor: c }}
                      title="Select Color"
                    />
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setShowSignModal(false)}
                    className="border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300"
                  >
                    Cancel
                  </Button>
                  <Button 
                    size="sm"
                    onClick={handleAddSignature}
                    className="bg-orange-600 hover:bg-orange-700 text-white font-medium"
                  >
                    Place Signature Stamp
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Study Note Modal */}
      {showNoteModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#121214] border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                <StickyNote className="w-4 h-4 text-orange-500" /> Add Academic Study Note
              </h3>
              <button onClick={() => setShowNoteModal(false)} className="text-zinc-400 hover:text-zinc-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5 block">
                  Note / Exam Reminder
                </label>
                <textarea 
                  rows={3}
                  value={newNoteContent} 
                  onChange={(e) => setNewNoteContent(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg text-xs outline-none focus:border-orange-500 text-zinc-900 dark:text-white resize-none"
                  placeholder="E.g., Review reaction mechanisms for Quiz 3, Section 4.2..." 
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setShowNoteModal(false)}
                  className="border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300"
                >
                  Cancel
                </Button>
                <Button 
                  size="sm"
                  onClick={handleAddNote}
                  className="bg-orange-600 hover:bg-orange-700 text-white font-medium"
                >
                  Attach Note
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ZenOffice Pro Modal */}
      {showProModal && (
        <div className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-8 w-full max-w-lg shadow-2xl relative overflow-hidden">
            <div className="absolute -top-16 -right-16 w-32 h-32 bg-orange-500/10 rounded-full blur-2xl"></div>
            
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-extrabold text-zinc-900 dark:text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-orange-500" /> Export: {proFeatureName}
              </h3>
              <button onClick={() => setShowProModal(false)} className="text-zinc-400 hover:text-zinc-600 bg-zinc-100 dark:bg-zinc-800 p-1.5 rounded-full">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-center space-y-4 mb-8 relative z-10">
              <div className="w-16 h-16 bg-orange-100 dark:bg-orange-950/50 rounded-2xl mx-auto flex items-center justify-center">
                <FileArchive className="w-8 h-8 text-orange-600 dark:text-orange-400" />
              </div>
              <p className="text-sm text-zinc-600 dark:text-zinc-300">
                You are about to export this document via the <strong className="text-orange-600 dark:text-orange-400">ZenOffice Cloud Engine</strong>. To proceed with the <strong>{proFeatureName}</strong> conversion, please upgrade to ZenOffice Premium or connect your own API key in Settings.
              </p>
            </div>

            <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-4 border border-zinc-200 dark:border-zinc-700/50 mb-6 flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                <span>File Size:</span>
                <span className="font-mono text-orange-600 dark:text-orange-400">
                  {pdfDataBytes 
                    ? (pdfDataBytes.length / 1024 / 1024).toFixed(2) 
                    : currentDoc?.sizeBytes 
                      ? (currentDoc.sizeBytes / 1024 / 1024).toFixed(2) 
                      : 'Unknown'
                  } MB
                </span>
              </div>
              <div className="flex items-center justify-between text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                <span>Pages Detected:</span>
                <span className="font-mono">{numPages}</span>
              </div>
              <div className="flex items-center justify-between text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                <span>OCR Target Language:</span>
                <span className="font-mono">English</span>
              </div>
            </div>

            <div className="flex flex-col gap-3 relative z-10">
              <Button 
                onClick={handleUpgrade}
                disabled={isUpgrading}
                className="w-full bg-gradient-to-r from-orange-600 to-amber-500 hover:from-orange-700 hover:to-amber-600 text-white font-bold h-11 text-base rounded-xl shadow-lg shadow-orange-500/20 disabled:opacity-60"
              >
                {isUpgrading ? (
                  <span className="flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin" /> Activating Premium...
                  </span>
                ) : (
                  'Upgrade to Premium – ₦9,999'
                )}
              </Button>
              <Button 
                variant="outline"
                onClick={() => setShowProModal(false)}
                className="w-full bg-transparent border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 font-medium h-11 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                Maybe Later
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Split & Merge Suite Modal */}
      {showSplitMergeModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#121214] border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                <Split className="w-4 h-4 text-orange-600" /> Split & Merge PDF Suite
              </h3>
              <button onClick={() => setShowSplitMergeModal(false)} className="text-zinc-400 hover:text-zinc-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex bg-zinc-100 dark:bg-zinc-900 p-1 rounded-lg mb-4">
              <button 
                onClick={() => setSplitMergeTab('split')}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-colors ${splitMergeTab === 'split' ? 'bg-white dark:bg-zinc-800 text-orange-600 dark:text-orange-400 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}
              >
                Split Document
              </button>
              <button 
                onClick={() => setSplitMergeTab('merge')}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-colors ${splitMergeTab === 'merge' ? 'bg-white dark:bg-zinc-800 text-orange-600 dark:text-orange-400 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}
              >
                Merge Documents
              </button>
            </div>

            {splitMergeTab === 'split' ? (
              <div className="space-y-4">
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Extract a specific page from <strong>{docTitle}</strong> into a new standalone PDF file.
                </p>
                <div>
                  <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                    Select Page Number (1 to {numPages || 1})
                  </label>
                  <input 
                    type="number"
                    min="1"
                    max={numPages || 1}
                    value={splitPageRange}
                    onChange={(e) => setSplitPageRange(e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg text-sm outline-none focus:border-orange-500 text-zinc-900 dark:text-white"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button 
                    variant="outline"
                    size="sm"
                    onClick={() => setShowSplitMergeModal(false)}
                    className="border-zinc-300 dark:border-zinc-700"
                  >
                    Cancel
                  </Button>
                  <Button 
                    size="sm"
                    onClick={() => handleSplitPdf(splitPageRange)}
                    className="bg-orange-600 hover:bg-orange-700 text-white"
                  >
                    Extract & Download Page
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Select a second PDF document to append to the end of <strong>{docTitle}</strong>.
                </p>
                <input 
                  type="file" 
                  ref={mergeFileInputRef}
                  accept="application/pdf"
                  className="hidden"
                  onChange={handleMergePdfFile}
                />
                <Button 
                  onClick={() => mergeFileInputRef.current?.click()}
                  className="w-full h-12 border border-dashed border-orange-500/50 bg-orange-50/50 dark:bg-orange-950/20 text-orange-600 hover:bg-orange-100 flex items-center justify-center gap-2"
                >
                  <Upload className="w-4 h-4" />
                  <span>Choose Second PDF to Merge</span>
                </Button>
                <div className="flex justify-end pt-2">
                  <Button 
                    variant="outline"
                    size="sm"
                    onClick={() => setShowSplitMergeModal(false)}
                    className="border-zinc-300 dark:border-zinc-700"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Floating Notification Toast */}
      {notification && (
        <div className="fixed bottom-5 right-5 z-50 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-4 py-2.5 rounded-lg shadow-xl text-xs font-medium flex items-center gap-2 border border-zinc-700 dark:border-zinc-300 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
          <span>{notification}</span>
        </div>
      )}

      {/* Zen AI Academic Study Assistant Modal */}
      <ZenAiDialog
        isOpen={showAiModal}
        onClose={() => setShowAiModal(false)}
        documentContext={extractedPdfText || `PDF Document: ${docTitle}\nPages: ${numPages}`}
        documentTitle={docTitle}
        editorType="pdf"
        onInsert={(text) => {
          const scrollContainer = scrollContainerRef.current;
          const currentScrollTop = scrollContainer ? scrollContainer.scrollTop : 0;
          const newAnn: PdfAnnotation = {
            id: `ai-${Date.now()}`,
            type: 'note',
            text: `AI Study Note: ${text.slice(0, 80)}...`,
            page: 1,
            x: 100,
            y: currentScrollTop + 120,
          };
          setAnnotations(prev => [...prev, newAnn]);
          setShowAiModal(false);
          showToast('AI Study Note placed on document.');
        }}
      />

    </div>
  );
}

export default function PDFEditorPage() {
  return (
    <Suspense fallback={
      <div className="h-screen w-screen bg-[#000000] flex flex-col items-center justify-center text-orange-500 gap-3">
        <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm font-semibold tracking-wide text-zinc-400">Loading ZenOffice PDF Suite...</span>
      </div>
    }>
      <PDFEditorInner />
    </Suspense>
  );
}
