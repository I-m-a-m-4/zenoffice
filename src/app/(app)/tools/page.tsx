'use client';

import React, { useState, useRef } from 'react';
import { 
  FileText, FileImage, FileCode2, Image, 
  Split, Combine, PenBox, Type, Lock, Unlock, 
  Printer, ArrowRight, Minimize, LayoutList, Scan,
  FileBadge2, FileSpreadsheet, FileJson, Languages, 
  X, UploadCloud, Loader2, Download, Crown, FileCode, CheckCircle2,
  ImagePlus, Settings2, Crop, Scissors, Key, Hash, Stamp
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

// --- DATA DEFINITIONS ---

const CATEGORIES = [
  {
    title: 'Core PDF Tools',
    tools: [
      { id: 'merge-pdf', name: 'Merge PDF', description: 'Combine multiple PDF files into one single document in your preferred order.', icon: Combine, color: 'text-indigo-500', bgColor: 'bg-indigo-50 dark:bg-indigo-950/30' },
      { id: 'split-pdf', name: 'Split PDF', description: 'Separate pages or extract specific page ranges from a single PDF.', icon: Split, color: 'text-cyan-500', bgColor: 'bg-cyan-50 dark:bg-cyan-950/30' },
      { id: 'compress-pdf', name: 'Compress PDF', description: 'Reduce file size while optimizing and keeping visual quality high.', icon: Minimize, color: 'text-rose-500', bgColor: 'bg-rose-50 dark:bg-rose-950/30' },
      { id: 'organize-pdf', name: 'Organize PDF', description: 'Delete unwanted pages or sort, add, and rearrange page order.', icon: LayoutList, color: 'text-amber-500', bgColor: 'bg-amber-50 dark:bg-amber-950/30' },
      { id: 'scan-pdf', name: 'Scan PDF', description: 'Turn physical paper documents into digital PDFs.', icon: Scan, color: 'text-blue-500', bgColor: 'bg-blue-50 dark:bg-blue-950/30' },
    ]
  },
  {
    title: 'Convert from PDF',
    tools: [
      { id: 'pdf-to-word', name: 'PDF to Word', description: 'Transform PDFs into editable Microsoft Word (.docx) documents.', icon: FileText, color: 'text-blue-600', bgColor: 'bg-blue-50 dark:bg-blue-950/30' },
      { id: 'pdf-to-excel', name: 'PDF to Excel', description: 'Extract table data from PDFs straight into Excel spreadsheets.', icon: FileSpreadsheet, color: 'text-emerald-500', bgColor: 'bg-emerald-50 dark:bg-emerald-950/30' },
      { id: 'pdf-to-ppt', name: 'PDF to PowerPoint', description: 'Convert PDF presentation pages into editable PPTX slides.', icon: PenBox, color: 'text-orange-500', bgColor: 'bg-orange-50 dark:bg-orange-950/30' },
      { id: 'pdf-to-jpg', name: 'PDF to JPG', description: 'Turn PDF pages into image files or extract embedded pictures.', icon: FileImage, color: 'text-purple-500', bgColor: 'bg-purple-50 dark:bg-purple-950/30' },
      { id: 'pdf-to-pdfa', name: 'PDF to PDF/A', description: 'Convert files to the ISO-standardized version for archiving.', icon: FileBadge2, color: 'text-slate-500', bgColor: 'bg-slate-50 dark:bg-slate-900' },
    ]
  },
  {
    title: 'Convert to PDF',
    tools: [
      { id: 'word-to-pdf', name: 'Word to PDF', description: 'Turn Word documents into locked-format PDFs.', icon: FileText, color: 'text-blue-600', bgColor: 'bg-blue-50 dark:bg-blue-950/30' },
      { id: 'excel-to-pdf', name: 'Excel to PDF', description: 'Convert spreadsheets into portable PDF documents.', icon: FileSpreadsheet, color: 'text-emerald-500', bgColor: 'bg-emerald-50 dark:bg-emerald-950/30' },
      { id: 'ppt-to-pdf', name: 'PowerPoint to PDF', description: 'Change presentation slides into static PDFs.', icon: PenBox, color: 'text-orange-500', bgColor: 'bg-orange-50 dark:bg-orange-950/30' },
      { id: 'jpg-to-pdf', name: 'JPG to PDF', description: 'Combine image files into a single document.', icon: Image, color: 'text-purple-500', bgColor: 'bg-purple-50 dark:bg-purple-950/30' },
      { id: 'html-to-pdf', name: 'HTML to PDF', description: 'Capture and convert web pages via URL or HTML files.', icon: FileCode, color: 'text-rose-500', bgColor: 'bg-rose-50 dark:bg-rose-950/30' },
    ]
  },
  {
    title: 'Edit & Modify PDF',
    tools: [
      { id: 'edit-pdf', name: 'Edit PDF', description: 'Add text, shapes, notes, highlights, and images directly onto your file.', icon: Type, color: 'text-sky-500', bgColor: 'bg-sky-50 dark:bg-sky-950/30' },
      { id: 'rotate-pdf', name: 'Rotate PDF', description: 'Change the layout orientation of portrait or landscape pages.', icon: Settings2, color: 'text-slate-500', bgColor: 'bg-slate-50 dark:bg-slate-900' },
      { id: 'page-numbers', name: 'Add Page Numbers', description: 'Insert custom page numbers with chosen typography.', icon: Hash, color: 'text-zinc-500', bgColor: 'bg-zinc-50 dark:bg-zinc-900' },
      { id: 'watermark-pdf', name: 'Watermark PDF', description: 'Stamp an image or text overlay across pages.', icon: Stamp, color: 'text-indigo-400', bgColor: 'bg-indigo-50 dark:bg-indigo-950/30' },
      { id: 'crop-pdf', name: 'Crop PDF', description: 'Trim margins and adjust page viewing dimensions.', icon: Crop, color: 'text-pink-500', bgColor: 'bg-pink-50 dark:bg-pink-950/30' },
    ]
  },
  {
    title: 'Security & Signatures',
    tools: [
      { id: 'sign-pdf', name: 'Sign PDF', description: 'Draw, type, or insert electronic signatures onto documents.', icon: PenBox, color: 'text-blue-500', bgColor: 'bg-blue-50 dark:bg-blue-950/30' },
      { id: 'unlock-pdf', name: 'Unlock PDF', description: 'Remove password security and printing/copying restrictions.', icon: Unlock, color: 'text-emerald-500', bgColor: 'bg-emerald-50 dark:bg-emerald-950/30' },
      { id: 'protect-pdf', name: 'Protect PDF', description: 'Encrypt sensitive documents with a user password.', icon: Lock, color: 'text-red-500', bgColor: 'bg-red-50 dark:bg-red-950/30' },
      { id: 'repair-pdf', name: 'Repair PDF', description: 'Recover data from corrupted or damaged PDF files.', icon: Settings2, color: 'text-orange-500', bgColor: 'bg-orange-50 dark:bg-orange-950/30' },
      { id: 'ocr-pdf', name: 'OCR PDF', description: 'Recognize and scan text inside scanned documents.', icon: Scan, color: 'text-cyan-500', bgColor: 'bg-cyan-50 dark:bg-cyan-950/30' },
      { id: 'compare-pdf', name: 'Compare PDF', description: 'View two file versions side-by-side to highlight differences.', icon: Split, color: 'text-violet-500', bgColor: 'bg-violet-50 dark:bg-violet-950/30' },
      { id: 'translate-pdf', name: 'Translate PDF', description: 'Translate document content using automated features.', icon: Languages, color: 'text-blue-400', bgColor: 'bg-blue-50 dark:bg-blue-950/30' },
    ]
  }
];

export default function ToolsPage() {
  const router = useRouter();
  
  // Modal State
  const [activeTool, setActiveTool] = useState<any | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [step, setStep] = useState<'upload' | 'processing' | 'done' | 'premium'>('upload');
  const [history, setHistory] = useState<any[]>([]);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleToolClick = (tool: any) => {
    setHistory(prev => [tool, ...prev.filter(t => t.id !== tool.id)].slice(0, 4));
    
    if (tool.id === 'edit-pdf' || tool.id === 'sign-pdf') {
      router.push(`/editor/pdf`);
      return;
    }
    setActiveTool(tool);
    setStep('upload');
    setFile(null);
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setFile(e.dataTransfer.files[0]);
      startProcessing();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
      startProcessing();
    }
  };

  const startProcessing = () => {
    setStep('processing');
    
    // Simulate conversion time
    setTimeout(() => {
      // Mock Premium gate for major conversion tools
      if (activeTool?.id.includes('-to-')) {
        setStep('premium');
      } else {
        setStep('done');
      }
    }, 2500);
  };

  const closeModal = () => {
    setActiveTool(null);
    setFile(null);
  };

  return (
    <div className="flex-1 overflow-auto bg-zinc-50 dark:bg-[#0c0c0e] p-6 lg:p-10 relative">
      <div className="max-w-6xl mx-auto space-y-12 pb-24">
        
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">ZenOffice Tools</h1>
          <p className="text-zinc-500 dark:text-zinc-400 mt-2">
            Every tool you need to work with PDFs in one place. Convert, edit, merge, and split with ease.
          </p>
        </div>

        {history.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-zinc-800 dark:text-zinc-200 border-b border-zinc-200 dark:border-zinc-800 pb-2">
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
                  <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-1">{tool.name}</h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2 mb-4 flex-1 leading-relaxed">
                    {tool.description}
                  </p>
                  <div className="flex items-center text-[11px] font-semibold text-orange-600 opacity-0 group-hover:opacity-100 transition-opacity mt-auto">
                    Open Tool <ArrowRight className="w-3 h-3 ml-1" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {CATEGORIES.map((category, idx) => (
          <div key={idx} className="space-y-4">
            <h2 className="text-xl font-bold text-zinc-800 dark:text-zinc-200 border-b border-zinc-200 dark:border-zinc-800 pb-2">
              {category.title}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {category.tools.map((tool) => (
                <button
                  key={tool.id}
                  onClick={() => handleToolClick(tool)}
                  className="group flex flex-col text-left bg-white dark:bg-[#121214] border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 hover:border-orange-500/50 hover:shadow-md transition-all duration-200"
                >
                  <div className={`w-10 h-10 rounded-lg ${tool.bgColor} ${tool.color} flex items-center justify-center mb-3 transition-transform group-hover:scale-105`}>
                    <tool.icon className="w-5 h-5" strokeWidth={1.5} />
                  </div>
                  <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-1">{tool.name}</h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2 mb-4 flex-1 leading-relaxed">
                    {tool.description}
                  </p>
                  <div className="flex items-center text-[11px] font-semibold text-orange-600 opacity-0 group-hover:opacity-100 transition-opacity mt-auto">
                    Try Tool <ArrowRight className="w-3 h-3 ml-1" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        ))}

      </div>

      {/* UNIVERSAL CONVERTER MODAL */}
      {activeTool && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white dark:bg-[#121214] w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 flex flex-col relative">
            
            {/* Header */}
            <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-900/50">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-md ${activeTool.bgColor} ${activeTool.color} flex items-center justify-center`}>
                  <activeTool.icon className="w-4 h-4" />
                </div>
                <h2 className="font-bold text-lg text-zinc-800 dark:text-zinc-100">{activeTool.name}</h2>
              </div>
              <button onClick={closeModal} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content Area */}
            <div className="p-8">
              {step === 'upload' && (
                <div 
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleFileDrop}
                  className="border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-xl p-10 flex flex-col items-center justify-center text-center bg-zinc-50 dark:bg-zinc-900/30 hover:bg-orange-50 dark:hover:bg-orange-900/10 hover:border-orange-300 transition-colors cursor-pointer"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <UploadCloud className="w-12 h-12 text-zinc-400 mb-4" />
                  <p className="text-zinc-700 dark:text-zinc-200 font-medium mb-1">Click or drag file here to upload</p>
                  <p className="text-xs text-zinc-500 mb-6">Supports PDF, DOCX, XLSX, PPTX, JPG</p>
                  <Button className="bg-orange-600 hover:bg-orange-700 text-white rounded-full px-6">
                    Select File
                  </Button>
                  <input type="file" className="hidden" ref={fileInputRef} onChange={handleFileSelect} />
                </div>
              )}

              {step === 'processing' && (
                <div className="py-12 flex flex-col items-center justify-center text-center space-y-4">
                  <div className="relative">
                    <div className="w-16 h-16 rounded-full border-4 border-zinc-100 dark:border-zinc-800 border-t-orange-500 animate-spin"></div>
                    <activeTool.icon className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 ${activeTool.color}`} />
                  </div>
                  <div>
                    <p className="text-lg font-bold text-zinc-800 dark:text-zinc-100">Processing Document...</p>
                    <p className="text-sm text-zinc-500">{file?.name || 'Document.pdf'}</p>
                  </div>
                </div>
              )}

              {step === 'premium' && (
                <div className="py-6 flex flex-col items-center text-center space-y-4 animate-in slide-in-from-bottom-4">
                  <div className="w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-amber-600 mb-2">
                    <Crown className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-zinc-800 dark:text-zinc-100">Pro Feature Required</h3>
                    <p className="text-sm text-zinc-500 mt-2 px-4">
                      {activeTool.name} is a premium feature. Upgrade to ZenOffice Pro for unlimited AI and conversion capabilities.
                    </p>
                  </div>
                  <div className="pt-4 flex w-full gap-3">
                    <Button variant="outline" className="flex-1" onClick={closeModal}>Cancel</Button>
                    <Button className="flex-1 bg-amber-500 hover:bg-amber-600 text-white">Upgrade Now</Button>
                  </div>
                </div>
              )}

              {step === 'done' && (
                <div className="py-8 flex flex-col items-center text-center space-y-4 animate-in zoom-in-95">
                  <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 mb-2">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-zinc-800 dark:text-zinc-100">Task Completed!</h3>
                    <p className="text-sm text-zinc-500 mt-1">
                      Your document has been successfully processed using {activeTool.name}.
                    </p>
                  </div>
                  <div className="pt-4 w-full">
                    <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white gap-2 h-12 rounded-xl" onClick={closeModal}>
                      <Download className="w-4 h-4" /> Download File
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
