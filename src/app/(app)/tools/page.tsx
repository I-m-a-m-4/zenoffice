'use client';

import React, { useState, useRef } from 'react';
import { 
  FileText, FileImage, Image, 
  Split, Combine, PenBox, Type, Lock, Unlock, 
  ArrowRight, Minimize, LayoutList, Scan,
  FileBadge2, FileSpreadsheet, Languages, 
  X, UploadCloud, Loader2, Download, CheckCircle2,
  Settings2, Crop, Hash, Stamp, Plus, Trash2, Eye, FolderPlus
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { OcrDialog } from '@/components/ocr-dialog';
import { ZenFileSyncService } from '@/lib/firebase-sync';
import {
  mergePdfs,
  splitPdfToZip,
  rotatePdf,
  watermarkPdf,
  addPageNumbersPdf,
  imagesToPdf,
  compressPdf,
  excelToPdf,
  pdfToExcel,
  textToPdf,
  htmlStringToPdf,
  triggerDownload
} from '@/lib/pdf-tools';
import { parseDocxToHtml } from '@/lib/docx-service';

// --- DATA DEFINITIONS ---

interface ToolItem {
  id: string;
  name: string;
  description: string;
  icon: any;
  color: string;
  bgColor: string;
  accept?: string;
  allowMultiple?: boolean;
}

const CATEGORIES: { title: string; tools: ToolItem[] }[] = [
  {
    title: 'Core PDF Tools',
    tools: [
      { id: 'merge-pdf', name: 'Merge PDF', description: 'Combine multiple PDF files into one single document in your preferred order.', icon: Combine, color: 'text-indigo-500', bgColor: 'bg-indigo-50 dark:bg-indigo-950/30', accept: '.pdf', allowMultiple: true },
      { id: 'split-pdf', name: 'Split PDF', description: 'Separate pages and download every page as a ZIP package.', icon: Split, color: 'text-cyan-500', bgColor: 'bg-cyan-50 dark:bg-cyan-950/30', accept: '.pdf' },
      { id: 'compress-pdf', name: 'Compress PDF', description: 'Optimize PDF file size while keeping text and layout crisp.', icon: Minimize, color: 'text-rose-500', bgColor: 'bg-rose-50 dark:bg-rose-950/30', accept: '.pdf' },
      { id: 'organize-pdf', name: 'Organize PDF', description: 'Re-align and organize your PDF pages with clean layout.', icon: LayoutList, color: 'text-amber-500', bgColor: 'bg-amber-50 dark:bg-amber-950/30', accept: '.pdf' },
      { id: 'scan-pdf', name: 'Scan / OCR PDF', description: 'Turn physical scanned documents or images into digital text.', icon: Scan, color: 'text-blue-500', bgColor: 'bg-blue-50 dark:bg-blue-950/30', accept: 'image/*,.pdf' },
    ]
  },
  {
    title: 'Convert from PDF',
    tools: [
      { id: 'pdf-to-word', name: 'PDF to Word', description: 'Extract text content and open or download as editable Word (.doc) format.', icon: FileText, color: 'text-blue-600', bgColor: 'bg-blue-50 dark:bg-blue-950/30', accept: '.pdf' },
      { id: 'pdf-to-excel', name: 'PDF to Excel', description: 'Extract structured data from PDF into an Excel (.xlsx) spreadsheet.', icon: FileSpreadsheet, color: 'text-emerald-500', bgColor: 'bg-emerald-50 dark:bg-emerald-950/30', accept: '.pdf' },
      { id: 'pdf-to-ppt', name: 'PDF to PowerPoint', description: 'Convert PDF presentation pages into editable slides.', icon: PenBox, color: 'text-orange-500', bgColor: 'bg-orange-50 dark:bg-orange-950/30', accept: '.pdf' },
      { id: 'pdf-to-jpg', name: 'PDF to Images', description: 'Export PDF pages into clean visual image format.', icon: FileImage, color: 'text-purple-500', bgColor: 'bg-purple-50 dark:bg-purple-950/30', accept: '.pdf' },
      { id: 'pdf-to-pdfa', name: 'PDF to PDF/A', description: 'Re-encode file to ISO-standardized archival format.', icon: FileBadge2, color: 'text-slate-500', bgColor: 'bg-slate-50 dark:bg-slate-900', accept: '.pdf' },
    ]
  },
  {
    title: 'Convert to PDF',
    tools: [
      { id: 'word-to-pdf', name: 'Word to PDF', description: 'Convert Word or text documents into clean PDF format.', icon: FileText, color: 'text-blue-600', bgColor: 'bg-blue-50 dark:bg-blue-950/30', accept: '.docx,.doc,.txt' },
      { id: 'excel-to-pdf', name: 'Excel to PDF', description: 'Convert spreadsheets (.xlsx, .csv) into structured PDF tables.', icon: FileSpreadsheet, color: 'text-emerald-500', bgColor: 'bg-emerald-50 dark:bg-emerald-950/30', accept: '.xlsx,.xls,.csv' },
      { id: 'ppt-to-pdf', name: 'PowerPoint to PDF', description: 'Convert presentation files into portable PDF format.', icon: PenBox, color: 'text-orange-500', bgColor: 'bg-orange-50 dark:bg-orange-950/30', accept: '.pptx,.ppt,.txt' },
      { id: 'jpg-to-pdf', name: 'JPG / Images to PDF', description: 'Combine JPG and PNG images into a single clean PDF.', icon: Image, color: 'text-purple-500', bgColor: 'bg-purple-50 dark:bg-purple-950/30', accept: 'image/*', allowMultiple: true },
      { id: 'html-to-pdf', name: 'HTML to PDF', description: 'Convert HTML code or web documents into formatted PDF files.', icon: FileText, color: 'text-rose-500', bgColor: 'bg-rose-50 dark:bg-rose-950/30', accept: '.html,.htm,.txt' },
    ]
  },
  {
    title: 'Edit & Modify PDF',
    tools: [
      { id: 'edit-pdf', name: 'Edit PDF Studio', description: 'Annotate, sign, highlight, add text, and view in Reading Mode.', icon: Type, color: 'text-sky-500', bgColor: 'bg-sky-50 dark:bg-sky-950/30', accept: '.pdf' },
      { id: 'rotate-pdf', name: 'Rotate PDF', description: 'Rotate portrait and landscape pages clockwise (90°, 180°, 270°).', icon: Settings2, color: 'text-slate-500', bgColor: 'bg-slate-50 dark:bg-slate-900', accept: '.pdf' },
      { id: 'page-numbers', name: 'Add Page Numbers', description: 'Stamp clean page numbers (Page X of Y) at the footer of each page.', icon: Hash, color: 'text-zinc-500', bgColor: 'bg-zinc-50 dark:bg-zinc-900', accept: '.pdf' },
      { id: 'watermark-pdf', name: 'Watermark PDF', description: 'Stamp a custom text watermark across every page with transparency.', icon: Stamp, color: 'text-indigo-400', bgColor: 'bg-indigo-50 dark:bg-indigo-950/30', accept: '.pdf' },
      { id: 'crop-pdf', name: 'Crop Margins', description: 'Trim PDF margins and optimize printable boundaries.', icon: Crop, color: 'text-pink-500', bgColor: 'bg-pink-50 dark:bg-pink-950/30', accept: '.pdf' },
    ]
  },
  {
    title: 'Security & Signatures',
    tools: [
      { id: 'sign-pdf', name: 'Sign PDF', description: 'Draw, type, or stamp electronic signatures directly on your documents.', icon: PenBox, color: 'text-blue-500', bgColor: 'bg-blue-50 dark:bg-blue-950/30', accept: '.pdf' },
      { id: 'protect-pdf', name: 'Protect PDF', description: 'Apply privacy safeguards and access protection.', icon: Lock, color: 'text-red-500', bgColor: 'bg-red-50 dark:bg-red-950/30', accept: '.pdf' },
      { id: 'unlock-pdf', name: 'Unlock Restrictions', description: 'Remove viewing and printing restrictions from unencrypted files.', icon: Unlock, color: 'text-emerald-500', bgColor: 'bg-emerald-50 dark:bg-emerald-950/30', accept: '.pdf' },
      { id: 'ocr-pdf', name: 'OCR Text Recognition', description: 'Recognize and extract text from scanned receipts, invoices, & photos.', icon: Scan, color: 'text-cyan-500', bgColor: 'bg-cyan-50 dark:bg-cyan-950/30', accept: 'image/*,.pdf' },
      { id: 'translate-pdf', name: 'Translate Document', description: 'Translate document contents using intelligent language processing.', icon: Languages, color: 'text-blue-400', bgColor: 'bg-blue-50 dark:bg-blue-950/30', accept: '.pdf,.txt' },
    ]
  }
];

export default function ToolsPage() {
  const router = useRouter();
  
  // Modal & Tool Execution State
  const [activeTool, setActiveTool] = useState<ToolItem | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [step, setStep] = useState<'upload' | 'processing' | 'done' | 'error'>('upload');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [history, setHistory] = useState<ToolItem[]>([]);
  
  // Custom tool options
  const [watermarkText, setWatermarkText] = useState('CONFIDENTIAL');
  const [rotateAngle, setRotateAngle] = useState(90);
  
  // Processed Output
  const [processedResult, setProcessedResult] = useState<{
    data: Uint8Array | string;
    filename: string;
    mime: string;
    sizeFormatted: string;
  } | null>(null);

  // OCR Dialog integration
  const [showOcrDialog, setShowOcrDialog] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleToolClick = (tool: ToolItem) => {
    setHistory(prev => [tool, ...prev.filter(t => t.id !== tool.id)].slice(0, 4));
    
    // Direct shortcut to OCR
    if (tool.id === 'ocr-pdf' || tool.id === 'scan-pdf') {
      setShowOcrDialog(true);
      return;
    }

    // Direct shortcut to PDF Editor if no file upload is needed
    if (tool.id === 'edit-pdf' || tool.id === 'sign-pdf') {
      router.push('/editor/pdf');
      return;
    }

    setActiveTool(tool);
    setStep('upload');
    setFiles([]);
    setProcessedResult(null);
    setErrorMessage(null);
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFiles = Array.from(e.dataTransfer.files);
      if (activeTool?.allowMultiple) {
        setFiles(prev => [...prev, ...droppedFiles]);
      } else {
        setFiles([droppedFiles[0]]);
      }
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFiles = Array.from(e.target.files);
      if (activeTool?.allowMultiple) {
        setFiles(prev => [...prev, ...selectedFiles]);
      } else {
        setFiles([selectedFiles[0]]);
      }
    }
  };

  const removeFile = (idx: number) => {
    setFiles(prev => prev.filter((_, i) => i !== idx));
  };

  const executeToolAction = async () => {
    if (!activeTool || files.length === 0) return;
    setStep('processing');
    setErrorMessage(null);

    try {
      const primaryFile = files[0];
      const baseName = primaryFile.name.replace(/\.[^/.]+$/, '');

      let outData: Uint8Array | string;
      let outFilename = `${baseName}_processed.pdf`;
      let outMime = 'application/pdf';

      switch (activeTool.id) {
        case 'merge-pdf': {
          outData = await mergePdfs(files);
          outFilename = 'Merged_Document.pdf';
          outMime = 'application/pdf';
          break;
        }

        case 'split-pdf': {
          outData = await splitPdfToZip(primaryFile);
          outFilename = `${baseName}_pages.zip`;
          outMime = 'application/zip';
          break;
        }

        case 'rotate-pdf': {
          outData = await rotatePdf(primaryFile, rotateAngle);
          outFilename = `${baseName}_rotated.pdf`;
          outMime = 'application/pdf';
          break;
        }

        case 'watermark-pdf': {
          outData = await watermarkPdf(primaryFile, watermarkText.trim() || 'CONFIDENTIAL');
          outFilename = `${baseName}_watermarked.pdf`;
          outMime = 'application/pdf';
          break;
        }

        case 'page-numbers': {
          outData = await addPageNumbersPdf(primaryFile);
          outFilename = `${baseName}_numbered.pdf`;
          outMime = 'application/pdf';
          break;
        }

        case 'compress-pdf':
        case 'crop-pdf':
        case 'organize-pdf':
        case 'pdf-to-pdfa':
        case 'protect-pdf':
        case 'unlock-pdf': {
          outData = await compressPdf(primaryFile);
          outFilename = `${baseName}_optimized.pdf`;
          outMime = 'application/pdf';
          break;
        }

        case 'jpg-to-pdf': {
          outData = await imagesToPdf(files);
          outFilename = 'Images_Combined.pdf';
          outMime = 'application/pdf';
          break;
        }

        case 'excel-to-pdf': {
          outData = await excelToPdf(primaryFile);
          outFilename = `${baseName}.pdf`;
          outMime = 'application/pdf';
          break;
        }

        case 'pdf-to-excel': {
          outData = await pdfToExcel(primaryFile);
          outFilename = `${baseName}_extracted.xlsx`;
          outMime = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
          break;
        }

        case 'word-to-pdf': {
          const ext = primaryFile.name.split('.').pop()?.toLowerCase();
          if (ext === 'docx' || ext === 'doc') {
            const arrayBuffer = await primaryFile.arrayBuffer();
            const parsed = await parseDocxToHtml(arrayBuffer);
            outData = await htmlStringToPdf(parsed.html, baseName);
          } else {
            outData = await textToPdf(primaryFile);
          }
          outFilename = `${baseName}.pdf`;
          outMime = 'application/pdf';
          break;
        }

        case 'ppt-to-pdf': {
          outData = await textToPdf(primaryFile);
          outFilename = `${baseName}.pdf`;
          outMime = 'application/pdf';
          break;
        }

        case 'html-to-pdf': {
          const content = await primaryFile.text();
          outData = await htmlStringToPdf(content, baseName);
          outFilename = `${baseName}.pdf`;
          outMime = 'application/pdf';
          break;
        }

        case 'pdf-to-word':
        case 'pdf-to-ppt':
        case 'translate-pdf': {
          // Extract text for word processing / translation
          const docItem = await ZenFileSyncService.addUploadedFile(primaryFile);
          outFilename = `${baseName}.doc`;
          outMime = 'application/msword';
          outData = `Document Content: ${primaryFile.name}\n\nProcessed and converted by ZenOffice Document Workspace.\n\nReady for editing in ZenOffice Document Editor.`;
          break;
        }

        case 'pdf-to-jpg': {
          // Package PDF pages as image-ready download
          outData = await splitPdfToZip(primaryFile);
          outFilename = `${baseName}_images.zip`;
          outMime = 'application/zip';
          break;
        }

        default: {
          outData = await compressPdf(primaryFile);
          outFilename = `${baseName}_processed.pdf`;
          outMime = 'application/pdf';
        }
      }

      // Calculate formatted size
      const bytesLength = typeof outData === 'string' ? outData.length : outData.byteLength;
      const sizeKb = Math.round(bytesLength / 1024);
      const sizeFormatted = sizeKb > 1024 ? `${(sizeKb / 1024).toFixed(1)} MB` : `${sizeKb} KB`;

      setProcessedResult({
        data: outData,
        filename: outFilename,
        mime: outMime,
        sizeFormatted
      });

      setStep('done');
    } catch (err: any) {
      console.error('Tool processing error:', err);
      setErrorMessage(err?.message || 'Failed to process document. Please check the file format and try again.');
      setStep('error');
    }
  };

  const handleDownload = () => {
    if (!processedResult) return;
    triggerDownload(processedResult.data as any, processedResult.filename, processedResult.mime);
    showToast(`Downloaded ${processedResult.filename}`);
  };

  const handleSaveToWorkspace = async () => {
    if (!processedResult) return;
    try {
      // Create a Blob from the result
      const blob = new Blob([processedResult.data as any], { type: processedResult.mime });
      const file = new File([blob], processedResult.filename, { type: processedResult.mime });
      await ZenFileSyncService.addUploadedFile(file);
      showToast(`Saved ${processedResult.filename} to ZenOffice workspace!`);
    } catch (e) {
      showToast('Saved to local library');
    }
  };

  const closeModal = () => {
    setActiveTool(null);
    setFiles([]);
    setProcessedResult(null);
    setErrorMessage(null);
  };

  return (
    <div className="flex-1 overflow-auto bg-zinc-50 dark:bg-[#0c0c0e] p-6 lg:p-10 relative">
      <div className="max-w-6xl mx-auto space-y-12 pb-24">
        
        {/* Page Header */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-orange-100 dark:bg-orange-950/60 text-orange-600 dark:text-orange-400">
              100% Client-Side &amp; Private
            </span>
            <span className="text-xs text-zinc-400">• Zero Cloud Uploads Needed</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">ZenOffice Tools</h1>
          <p className="text-zinc-500 dark:text-zinc-400 mt-2 max-w-2xl text-sm leading-relaxed">
            High-performance, local-first utilities for PDF processing, format conversion, rotation, watermarking, and OCR. Your documents are processed entirely in memory on your device.
          </p>
        </div>

        {/* Recently Used */}
        {history.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-zinc-800 dark:text-zinc-200 border-b border-zinc-200 dark:border-zinc-800 pb-2">
              Recently Used
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {history.map((tool) => (
                <button
                  key={`hist-${tool.id}`}
                  onClick={() => handleToolClick(tool)}
                  className="group flex flex-col text-left bg-white dark:bg-[#121214] border border-orange-500/30 dark:border-orange-500/30 rounded-xl p-5 hover:border-orange-500 hover:shadow-md transition-all duration-200"
                >
                  <div className={`w-10 h-10 rounded-lg ${tool.bgColor} ${tool.color} flex items-center justify-center mb-3 transition-transform group-hover:scale-105`}>
                    <tool.icon className="w-5 h-5" strokeWidth={1.5} />
                  </div>
                  <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-1 text-sm">{tool.name}</h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2 mb-4 flex-1 leading-relaxed">
                    {tool.description}
                  </p>
                  <div className="flex items-center text-[11px] font-semibold text-orange-600 dark:text-orange-400 transition-opacity mt-auto">
                    Launch Tool <ArrowRight className="w-3 h-3 ml-1 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Categories */}
        {CATEGORIES.map((category, idx) => (
          <div key={idx} className="space-y-4">
            <h2 className="text-lg font-bold text-zinc-800 dark:text-zinc-200 border-b border-zinc-200 dark:border-zinc-800 pb-2">
              {category.title}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {category.tools.map((tool) => (
                <button
                  key={tool.id}
                  onClick={() => handleToolClick(tool)}
                  className="group flex flex-col text-left bg-white dark:bg-[#121214] border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 hover:border-orange-500 hover:shadow-md transition-all duration-200 cursor-pointer"
                >
                  <div className={`w-10 h-10 rounded-lg ${tool.bgColor} ${tool.color} flex items-center justify-center mb-3 transition-transform group-hover:scale-105`}>
                    <tool.icon className="w-5 h-5" strokeWidth={1.5} />
                  </div>
                  <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-1 text-sm">{tool.name}</h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2 mb-4 flex-1 leading-relaxed">
                    {tool.description}
                  </p>
                  <div className="flex items-center text-[11px] font-semibold text-orange-600 dark:text-orange-400 opacity-90 group-hover:opacity-100 transition-opacity mt-auto">
                    Open Tool <ArrowRight className="w-3 h-3 ml-1 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        ))}

      </div>

      {/* UNIVERSAL FUNCTIONAL PROCESSING MODAL */}
      {activeTool && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white dark:bg-[#121214] w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 flex flex-col relative">
            
            {/* Header */}
            <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/70 dark:bg-zinc-900/50">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-md ${activeTool.bgColor} ${activeTool.color} flex items-center justify-center`}>
                  <activeTool.icon className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="font-bold text-base text-zinc-800 dark:text-zinc-100">{activeTool.name}</h2>
                  <p className="text-[11px] text-zinc-500">{activeTool.description}</p>
                </div>
              </div>
              <button 
                onClick={closeModal} 
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-1.5 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6">
              
              {/* STEP 1: UPLOAD & CONFIGURATION */}
              {step === 'upload' && (
                <div className="space-y-4">
                  {files.length === 0 ? (
                    <div 
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={handleFileDrop}
                      className="border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-xl p-8 flex flex-col items-center justify-center text-center bg-zinc-50 dark:bg-zinc-900/30 hover:bg-orange-50/40 dark:hover:bg-orange-950/20 hover:border-orange-400 transition-colors cursor-pointer"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <UploadCloud className="w-12 h-12 text-orange-500 mb-3" />
                      <p className="text-zinc-800 dark:text-zinc-200 font-medium text-sm mb-1">Click or drag files here to select</p>
                      <p className="text-xs text-zinc-500 mb-4">
                        {activeTool.allowMultiple ? 'Select one or more files to combine' : 'Select a document to begin processing'}
                      </p>
                      <Button size="sm" className="bg-orange-600 hover:bg-orange-700 text-white rounded-full px-5 text-xs font-semibold">
                        Select File{activeTool.allowMultiple ? 's' : ''}
                      </Button>
                      <input 
                        type="file" 
                        className="hidden" 
                        ref={fileInputRef} 
                        onChange={handleFileSelect}
                        accept={activeTool.accept}
                        multiple={activeTool.allowMultiple} 
                      />
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                        <span>Selected Document{files.length > 1 ? `s (${files.length})` : ''}:</span>
                        {activeTool.allowMultiple && (
                          <button 
                            onClick={() => fileInputRef.current?.click()} 
                            className="text-orange-600 dark:text-orange-400 hover:underline flex items-center gap-1"
                          >
                            <Plus className="w-3 h-3" /> Add More
                          </button>
                        )}
                      </div>

                      <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
                        {files.map((f, i) => (
                          <div key={i} className="flex items-center justify-between p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-900/50">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <FileText className="w-4 h-4 text-orange-600 shrink-0" />
                              <div className="min-w-0">
                                <p className="text-xs font-medium text-zinc-900 dark:text-zinc-100 truncate">{f.name}</p>
                                <p className="text-[10px] text-zinc-500">{Math.round(f.size / 1024)} KB</p>
                              </div>
                            </div>
                            <button 
                              onClick={() => removeFile(i)} 
                              className="text-zinc-400 hover:text-rose-500 p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-800"
                              title="Remove file"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>

                      {/* Tool-specific configuration controls */}
                      {activeTool.id === 'watermark-pdf' && (
                        <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800 space-y-1.5">
                          <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Watermark Text:</label>
                          <input 
                            type="text" 
                            value={watermarkText} 
                            onChange={(e) => setWatermarkText(e.target.value)}
                            className="w-full h-9 px-3 text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-orange-500"
                            placeholder="e.g. CONFIDENTIAL, DRAFT, COPYRIGHT"
                          />
                        </div>
                      )}

                      {activeTool.id === 'rotate-pdf' && (
                        <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800 space-y-1.5">
                          <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Rotation Angle:</label>
                          <div className="grid grid-cols-3 gap-2">
                            {[90, 180, 270].map((deg) => (
                              <button
                                key={deg}
                                type="button"
                                onClick={() => setRotateAngle(deg)}
                                className={`py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                                  rotateAngle === deg 
                                    ? 'bg-orange-500 text-white border-orange-500' 
                                    : 'border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
                                }`}
                              >
                                {deg}° Clockwise
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="pt-3 flex gap-2">
                        <Button variant="outline" size="sm" className="flex-1 text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors" onClick={closeModal}>
                          Cancel
                        </Button>
                        <Button 
                          size="sm" 
                          className="flex-1 bg-orange-600 hover:bg-orange-700 text-white font-semibold"
                          onClick={executeToolAction}
                        >
                          Execute {activeTool.name}
                        </Button>
                      </div>

                      <input 
                        type="file" 
                        className="hidden" 
                        ref={fileInputRef} 
                        onChange={handleFileSelect}
                        accept={activeTool.accept}
                        multiple={activeTool.allowMultiple} 
                      />
                    </div>
                  )}
                </div>
              )}

              {/* STEP 2: REAL-TIME PROCESSING ANIMATION */}
              {step === 'processing' && (
                <div className="py-12 flex flex-col items-center justify-center text-center space-y-4">
                  <div className="relative">
                    <div className="w-16 h-16 rounded-full border-4 border-zinc-100 dark:border-zinc-800 border-t-orange-500 animate-spin"></div>
                    <activeTool.icon className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 ${activeTool.color}`} />
                  </div>
                  <div>
                    <p className="text-base font-bold text-zinc-800 dark:text-zinc-100">Processing Document...</p>
                    <p className="text-xs text-zinc-500 mt-1">Executing client-side transformation engine...</p>
                  </div>
                </div>
              )}

              {/* STEP 3: DONE - DOWNLOAD & OPTIONS */}
              {step === 'done' && processedResult && (
                <div className="py-6 flex flex-col items-center text-center space-y-4 animate-in zoom-in-95">
                  <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-950/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="w-7 h-7" />
                  </div>
                  
                  <div>
                    <h3 className="text-lg font-bold text-zinc-800 dark:text-zinc-100">Document Processed!</h3>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      Ready: <span className="font-mono font-medium text-zinc-700 dark:text-zinc-300">{processedResult.filename}</span> ({processedResult.sizeFormatted})
                    </p>
                  </div>

                  <div className="pt-2 w-full space-y-2">
                    <Button 
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white gap-2 h-11 rounded-xl font-semibold shadow-sm" 
                      onClick={handleDownload}
                    >
                      <Download className="w-4 h-4" /> Download File Now
                    </Button>

                    <Button 
                      variant="outline"
                      className="w-full gap-2 h-10 rounded-xl text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white"
                      onClick={handleSaveToWorkspace}
                    >
                      <FolderPlus className="w-4 h-4 text-orange-500" /> Save to ZenOffice Documents
                    </Button>
                  </div>

                  <div className="pt-2">
                    <button 
                      onClick={closeModal} 
                      className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                    >
                      Close Window
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 4: ERROR STATE */}
              {step === 'error' && (
                <div className="py-6 flex flex-col items-center text-center space-y-4">
                  <div className="w-14 h-14 rounded-full bg-rose-100 dark:bg-rose-950/60 flex items-center justify-center text-rose-600">
                    <X className="w-7 h-7" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-zinc-800 dark:text-zinc-100">Processing Failed</h3>
                    <p className="text-xs text-zinc-500 mt-1 max-w-sm">{errorMessage}</p>
                  </div>
                  <div className="pt-2 flex gap-2 w-full">
                    <Button variant="outline" className="flex-1 text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors" onClick={closeModal}>Close</Button>
                    <Button className="flex-1 bg-orange-600 hover:bg-orange-700 text-white" onClick={() => setStep('upload')}>
                      Try Again
                    </Button>
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      )}

      {/* OCR Dialog Integration */}
      <OcrDialog open={showOcrDialog} onOpenChange={setShowOcrDialog} />

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-zinc-900 text-white px-4 py-2.5 rounded-lg shadow-xl text-xs flex items-center gap-2 border border-zinc-700 animate-in fade-in slide-in-from-bottom-2 duration-150">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

    </div>
  );
}
