import React from 'react';
import Link from 'next/link';
import { ArrowLeft, Save, Share, FileText, Download, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function DocumentEditorPlaceholder() {
  return (
    <div className="flex flex-col h-screen bg-slate-100">
      {/* Editor Header */}
      <header className="h-14 border-b border-slate-200 bg-white flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild className="text-slate-500 hover:bg-slate-100 rounded-full">
            <Link href="/dashboard">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded bg-blue-100 text-blue-600 flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
            <div className="flex flex-col">
              <input 
                type="text" 
                defaultValue="Untitled Document"
                className="text-sm font-semibold text-slate-800 bg-transparent border-transparent hover:border-slate-300 focus:border-blue-500 rounded px-1 outline-none transition-all"
              />
              <span className="text-[10px] text-slate-500 px-1">Saved to ZenDrive</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="hidden md:flex text-slate-600">
            <Printer className="w-4 h-4 mr-2" /> Print
          </Button>
          <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
            <Share className="w-4 h-4 mr-2" /> Share
          </Button>
        </div>
      </header>

      {/* Editor Toolbar (Mock) */}
      <div className="h-10 border-b border-slate-200 bg-white flex items-center px-4 gap-1 overflow-x-auto shrink-0">
        {['File', 'Edit', 'View', 'Insert', 'Format', 'Tools', 'Extensions', 'Help'].map((item) => (
          <Button key={item} variant="ghost" size="sm" className="h-8 text-slate-600 font-medium text-xs rounded-sm hover:bg-slate-100">
            {item}
          </Button>
        ))}
      </div>

      {/* Main Editor Area (Mock) */}
      <div className="flex-1 overflow-auto p-8 flex justify-center">
        <div className="w-full max-w-[816px] min-h-[1056px] bg-white shadow-md border border-slate-200 p-12 flex flex-col items-center justify-center">
           <FileText className="w-16 h-16 text-slate-300 mb-4" />
           <h2 className="text-xl font-bold text-slate-700">Word Editor Module</h2>
           <p className="text-slate-500 text-sm mt-2">Placeholder for Rich Text Document editing</p>
        </div>
      </div>
    </div>
  );
}
