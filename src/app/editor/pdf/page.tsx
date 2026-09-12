import React from 'react';
import Link from 'next/link';
import { ArrowLeft, Save, Share, FileIcon, Download, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function PDFEditorPlaceholder() {
  return (
    <div className="flex flex-col h-screen bg-zinc-800">
      {/* Editor Header */}
      <header className="h-14 border-b border-zinc-700 bg-zinc-900 flex items-center justify-between px-4 shrink-0 text-white">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild className="text-zinc-400 hover:bg-zinc-800 hover:text-white rounded-full">
            <Link href="/dashboard">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded bg-rose-500/20 text-rose-400 flex items-center justify-center">
              <FileIcon className="w-5 h-5" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-zinc-100 px-1">Document.pdf</span>
              <span className="text-[10px] text-zinc-500 px-1">Read Only</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="hidden md:flex border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-white bg-transparent">
            <Download className="w-4 h-4 mr-2" /> Download
          </Button>
          <Button variant="outline" size="sm" className="hidden md:flex border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-white bg-transparent">
            <Printer className="w-4 h-4 mr-2" /> Print
          </Button>
        </div>
      </header>

      {/* Editor Toolbar (Mock) */}
      <div className="h-12 border-b border-zinc-700 bg-zinc-800 flex items-center justify-center px-4 gap-4 shrink-0">
        <div className="flex items-center gap-2 bg-zinc-900 rounded p-1">
           <Button variant="ghost" size="sm" className="h-8 text-zinc-300 hover:bg-zinc-700 hover:text-white">-</Button>
           <span className="text-xs text-zinc-300 w-12 text-center">100%</span>
           <Button variant="ghost" size="sm" className="h-8 text-zinc-300 hover:bg-zinc-700 hover:text-white">+</Button>
        </div>
      </div>

      {/* Main Editor Area (Mock) */}
      <div className="flex-1 overflow-auto p-8 flex justify-center">
        <div className="w-full max-w-[816px] min-h-[1056px] bg-zinc-100 shadow-xl flex flex-col items-center justify-center">
           <FileIcon className="w-16 h-16 text-zinc-300 mb-4" />
           <h2 className="text-xl font-bold text-zinc-700">PDF Viewer Module</h2>
           <p className="text-zinc-500 text-sm mt-2">Placeholder for PDF Viewer and Editor</p>
        </div>
      </div>
    </div>
  );
}
