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
  Undo2, Redo2, Cloud
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ZenFileSyncService, ZenDocumentItem } from '@/lib/firebase-sync';
import { ZenAiDialog } from '@/components/shared/zen-ai-dialog';
import { getAuth } from 'firebase/auth';

interface PdfAnnotation {
  id: string;
  type: 'highlight' | 'note' | 'text' | 'image' | 'signature' | 'redact';
  text?: string;
  imageUrl?: string;
  page: number;
  x: number;
  y: number;
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
  const [numPages, setNumPages] = useState(0);
  const [selectedTool, setSelectedTool] = useState<'select' | 'pan' | 'text' | 'highlight' | 'sign' | 'fill-form'>('select');
  const [showProModal, setShowProModal] = useState(false);
  const [proFeatureName, setProFeatureName] = useState('');
  const [viewMode, setViewMode] = useState<'canvas' | 'embed'>('canvas');
  const [showSidebar, setShowSidebar] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<'thumbnails' | 'bookmarks' | 'comments' | 'attachments' | 'signatures' | 'layers'>('thumbnails');
  const [notification, setNotification] = useState<string | null>(null);
  const [readingMode, setReadingMode] = useState(false);

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
  const [appliedSignatures, setAppliedSignatures] = useState<Array<{ id: string; type: 'text' | 'image'; text?: string; imageUrl?: string; x: number; y: number; color?: string }>>([]);

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

  // Keyboard shortcuts (Ctrl+E for AI copilot, Escape to exit reading mode)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'e') {
        e.preventDefault();
        setShowAiModal(prev => !prev);
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

        // Base scale * zoom factor
        const scale = (zoom / 100) * 1.5;
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
        pageCanvasWrapper.className = 'relative w-full flex justify-center bg-white';
        pageCanvasWrapper.style.width = `${viewport.width}px`;
        pageCanvasWrapper.style.height = `${viewport.height}px`;
        pageCanvasWrapper.style.maxWidth = '100%';

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
            textContent.items.forEach((item: any) => {
              if (!item.str || !item.str.trim()) return;

              const vp = viewport.transform;
              const it = item.transform;
              // 2D affine transform matrix multiplication: vp * it
              const a = vp[0] * it[0] + vp[2] * it[1];
              const b = vp[1] * it[0] + vp[3] * it[1];
              const e = vp[0] * it[4] + vp[2] * it[5] + vp[4];
              const f = vp[1] * it[4] + vp[3] * it[5] + vp[5];

              const fontSize = Math.max(9, Math.hypot(a, b));
              const top = f - fontSize * 0.85;
              const left = e;
              const itemWidth = Math.max(item.width * (viewport.scale || scale), 10);
              const itemHeight = fontSize * 1.25;

              const span = document.createElement('span');
              span.className = 'pdf-text-item absolute transition-all cursor-text select-text';
              span.style.left = `${left}px`;
              span.style.top = `${top}px`;
              span.style.fontSize = `${fontSize}px`;
              span.style.lineHeight = `${itemHeight}px`;
              span.style.minWidth = `${itemWidth}px`;
              span.style.height = `${itemHeight}px`;
              span.style.whiteSpace = 'pre';
              span.style.color = 'transparent';
              span.style.fontFamily = 'system-ui, -apple-system, sans-serif';
              span.innerText = item.str;
              span.title = 'Click to edit text';

              // Hover indicator
              span.onmouseenter = () => {
                if (span.getAttribute('contenteditable') !== 'true' && !span.dataset.edited) {
                  span.style.backgroundColor = 'rgba(59, 130, 246, 0.12)';
                  span.style.outline = '1px dashed rgba(59, 130, 246, 0.6)';
                  span.style.borderRadius = '2px';
                }
              };
              span.onmouseleave = () => {
                if (span.getAttribute('contenteditable') !== 'true' && !span.dataset.edited) {
                  span.style.backgroundColor = 'transparent';
                  span.style.outline = 'none';
                }
              };

              // Click to inline edit
              span.onclick = (ev) => {
                ev.stopPropagation();
                span.contentEditable = 'true';
                span.style.color = '#18181b';
                span.style.backgroundColor = '#ffffff'; // Cleanly masks underlying canvas text
                span.style.outline = '2px solid #ea580c';
                span.style.borderRadius = '2px';
                span.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)';
                span.style.zIndex = '30';
                span.focus();
              };

              span.onblur = () => {
                span.contentEditable = 'false';
                span.dataset.edited = 'true';
                span.style.color = '#18181b';
                span.style.backgroundColor = '#ffffff'; // Maintain white mask so original canvas text stays replaced
                span.style.outline = '1px solid rgba(234, 88, 12, 0.3)';
                span.style.boxShadow = 'none';
                span.style.zIndex = '10';
                showToast('Document text updated');
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
  }, [pdfBlobUrl, pdfDataBytes, zoom, rotation, viewMode, docTitle]);

  useEffect(() => {
    renderPdfPages();
  }, [renderPdfPages]);

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

  // Download PDF
  const handleDownload = async () => {
    try {
      let dataToSave = pdfDataBytes;
      if (!dataToSave && currentDoc && currentDoc.fileData) {
         const parsed = parsePdfData(currentDoc.fileData);
         if (parsed) dataToSave = parsed.bytes;
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
          // Fallback to web
        }
      }
      
      if (currentDoc) {
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
    } catch(e) {
      showToast('Error exporting PDF.');
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
    window.print();
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
                  onChange={(e) => setDocTitle(e.target.value)}
                  className="font-medium text-sm text-zinc-900 dark:text-zinc-100 bg-transparent hover:bg-zinc-100 dark:hover:bg-zinc-800 focus:bg-white dark:focus:bg-zinc-900 border border-transparent focus:border-zinc-300 dark:focus:border-zinc-700 rounded px-1.5 py-0.5 max-w-[280px] truncate outline-none transition-colors"
                />
                <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600 bg-rose-50 dark:bg-rose-950/40 px-1.5 py-0.5 rounded border border-rose-200 dark:border-rose-900">
                  PDF
                </span>
                <span className="hidden sm:flex items-center gap-1 text-[11px] text-zinc-400">
                  <Cloud className="w-3 h-3 text-zinc-400" />
                  <span>Saved</span>
                </span>
              </div>

              {/* Menu items like Google Docs */}
              <div className="flex items-center gap-0.5 text-xs text-zinc-600 dark:text-zinc-400 -ml-1 mt-0.5">
                <button onClick={() => fileInputRef.current?.click()} className="px-2 py-0.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100">File</button>
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
              size="sm" 
              onClick={handleDownload}
              className="h-8 text-xs px-3 bg-orange-600 hover:bg-orange-700 text-white shadow-xs font-medium"
            >
              <Download className="w-3.5 h-3.5 mr-1.5" /> Export
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
          {/* History */}
          <div className="flex items-center gap-0.5">
            <button 
              onClick={() => showToast('Undo')}
              className="p-1.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
              title="Undo"
            >
              <Undo2 className="w-4 h-4" />
            </button>
            <button 
              onClick={() => showToast('Redo')}
              className="p-1.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
              title="Redo"
            >
              <Redo2 className="w-4 h-4" />
            </button>
            <button 
              onClick={handlePrint}
              className="p-1.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
              title="Print"
            >
              <Printer className="w-4 h-4" />
            </button>
          </div>

          <div className="h-5 w-px bg-zinc-200 dark:bg-zinc-800 mx-1 shrink-0" />

          {/* Zoom */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setZoom(prev => Math.max(50, prev - 15))}
              className="p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400 w-10 text-center select-none">{zoom}%</span>
            <button
              onClick={() => setZoom(prev => Math.min(200, prev + 15))}
              className="p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="h-5 w-px bg-zinc-200 dark:bg-zinc-800 mx-1 shrink-0" />

          {/* Cursor Modes */}
          <div className="flex items-center gap-0.5">
            <button 
              onClick={() => setSelectedTool('select')}
              className={`h-7 px-2 rounded flex items-center gap-1 text-xs font-medium transition-colors ${
                selectedTool === 'select' 
                  ? 'bg-orange-50 dark:bg-orange-950/40 text-orange-600 font-semibold' 
                  : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
              }`}
            >
              <MousePointer2 className="w-3.5 h-3.5" />
              <span>Select</span>
            </button>
            <button 
              onClick={() => setSelectedTool('pan')}
              className={`h-7 px-2 rounded flex items-center gap-1 text-xs font-medium transition-colors ${
                selectedTool === 'pan' 
                  ? 'bg-orange-50 dark:bg-orange-950/40 text-orange-600 font-semibold' 
                  : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
              }`}
            >
              <Hand className="w-3.5 h-3.5" />
              <span>Hand</span>
            </button>
            <button 
              onClick={() => setSelectedTool('text')}
              className={`h-7 px-2 rounded flex items-center gap-1 text-xs font-medium transition-colors ${
                selectedTool === 'text' 
                  ? 'bg-orange-50 dark:bg-orange-950/40 text-orange-600 font-semibold' 
                  : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
              }`}
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
                const scrollContainer = scrollContainerRef.current;
                const docViewport = docViewportRef.current;
                const currentScrollTop = scrollContainer ? scrollContainer.scrollTop : 0;
                const defaultX = docViewport ? Math.max(40, (docViewport.clientWidth - 200) / 2) : 150;
                const newAnn: PdfAnnotation = {
                  id: `txt-${Date.now()}`, type: 'text', text: '', page: 1, x: defaultX, y: currentScrollTop + 160,
                };
                setAnnotations(prev => [...prev, newAnn]);
                showToast('Text box added. Click to edit.');
              }}
              className="h-7 px-2 rounded flex items-center gap-1 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              title="Add Text"
            >
              <TypeOutline className="w-3.5 h-3.5" />
              <span>Add Text</span>
            </button>

            <button 
              onClick={() => document.getElementById('image-insert-input')?.click()}
              className="h-7 px-2 rounded flex items-center gap-1 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              title="Insert Image"
            >
              <ImagePlus className="w-3.5 h-3.5" />
              <span>Image</span>
            </button>

            <button 
              onClick={() => {
                const scrollContainer = scrollContainerRef.current;
                const currentScrollTop = scrollContainer ? scrollContainer.scrollTop : 0;
                const newAnn: PdfAnnotation = {
                  id: `hl-${Date.now()}`, type: 'highlight', text: `Key Concept`, page: 1, x: 120, y: currentScrollTop + 160,
                };
                setAnnotations(prev => [...prev, newAnn]);
                showToast('Highlight stamp placed.');
              }}
              className="h-7 px-2 rounded flex items-center gap-1 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              title="Highlight"
            >
              <Highlighter className="w-3.5 h-3.5" />
              <span>Highlight</span>
            </button>

            <button 
              onClick={() => {
                const scrollContainer = scrollContainerRef.current;
                const docViewport = docViewportRef.current;
                const currentScrollTop = scrollContainer ? scrollContainer.scrollTop : 0;
                const defaultX = docViewport ? Math.max(40, (docViewport.clientWidth - 200) / 2) : 150;
                const newAnn: PdfAnnotation = {
                  id: `redact-${Date.now()}`, type: 'redact', text: '', page: 1, x: defaultX, y: currentScrollTop + 160,
                };
                setAnnotations(prev => [...prev, newAnn]);
                showToast('Redact block added.');
              }}
              className="h-7 px-2 rounded flex items-center gap-1 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              title="Redact"
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
              title="Comment"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Comment</span>
            </button>

            <button 
              onClick={() => {
                setPendingCoords({ page: 1, x: window.innerWidth / 2, y: window.innerHeight / 2 });
                setShowNoteModal(true);
              }}
              className="h-7 px-2 rounded flex items-center gap-1 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              title="Sticky Note"
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
            >
              <FileSignature className="w-3.5 h-3.5 text-orange-600" />
              <span>Sign</span>
            </button>
            <button 
              onClick={() => setSelectedTool('fill-form')}
              className={`h-7 px-2 rounded flex items-center gap-1 text-xs font-medium transition-colors ${
                selectedTool === 'fill-form'
                  ? 'bg-orange-50 dark:bg-orange-950/40 text-orange-600 font-semibold'
                  : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
              }`}
            >
              <LayoutTemplate className="w-3.5 h-3.5" />
              <span>Fill Form</span>
            </button>
          </div>

          <div className="h-5 w-px bg-zinc-200 dark:bg-zinc-800 mx-1 shrink-0" />

          {/* Conversions & Tools */}
          <div className="flex items-center gap-0.5">
            <button 
              onClick={() => { setProFeatureName('PDF to Word'); setShowProModal(true); }}
              className="h-7 px-2 rounded flex items-center gap-1 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>PDF to Word</span>
            </button>
            <button 
              onClick={() => { setProFeatureName('PDF to Excel'); setShowProModal(true); }}
              className="h-7 px-2 rounded flex items-center gap-1 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              <FileArchive className="w-3.5 h-3.5" />
              <span>PDF to Excel</span>
            </button>
            <button 
              onClick={() => { setProFeatureName('Split & Merge'); setShowProModal(true); }}
              className="h-7 px-2 rounded flex items-center gap-1 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              <Split className="w-3.5 h-3.5" />
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

        {/* Central Document Canvas */}
        <div ref={scrollContainerRef} className="flex-1 h-full w-full overflow-y-auto flex flex-col items-center p-2 sm:p-6 relative">
          
          {isLoading ? (
            <div className="flex flex-col items-center justify-center my-auto gap-3 text-zinc-500 dark:text-zinc-400">
              <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm font-medium">Loading {docTitle}...</span>
            </div>
          ) : (pdfBlobUrl || pdfDataBytes) ? (
            <div ref={docViewportRef} className="w-full max-w-4xl flex flex-col items-center relative">
              
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
                    className={`w-full flex flex-col items-center pb-24 ${selectedTool === 'pan' ? 'cursor-grab active:cursor-grabbing' : selectedTool === 'text' ? 'cursor-text' : 'cursor-default'}`}
                  />
                  {/* Floating Zoom & Page Controls (WPS Style overlay) */}
                  <div className="fixed bottom-24 right-6 z-40 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-full shadow-lg flex items-center p-1.5 gap-1">
                    <button onClick={() => handleZoom(-10)} className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300">
                      <ZoomOut className="w-4 h-4" />
                    </button>
                    <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300 w-12 text-center select-none">{zoom}%</span>
                    <button onClick={() => handleZoom(10)} className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300">
                      <ZoomIn className="w-4 h-4" />
                    </button>
                    <div className="w-px h-4 bg-zinc-300 dark:bg-zinc-600 mx-1" />
                    <button onClick={() => setZoom(100)} className="px-2 h-7 rounded-full text-[10px] font-medium hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300">
                      Fit Size
                    </button>
                  </div>
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
                  onInput={(e) => setBlankDocText((e.target as HTMLDivElement).innerText)}
                  className="outline-none flex-1 leading-relaxed text-zinc-900 dark:text-zinc-100 text-base font-sans min-h-[850px] empty:before:content-['Type_@_to_insert_or_start_typing...'] empty:before:text-zinc-400 empty:before:cursor-text"
                />
              </div>
            </div>
          )}

        </div>
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
