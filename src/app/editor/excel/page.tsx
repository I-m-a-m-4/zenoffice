import React from 'react';
import Link from 'next/link';
import { ArrowLeft, Save, Share, FileSpreadsheet, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function ExcelEditorPlaceholder() {
  return (
    <div className="flex flex-col h-screen bg-slate-50">
      {/* Editor Header */}
      <header className="h-14 border-b border-slate-200 bg-white flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild className="text-slate-500 hover:bg-slate-100 rounded-full">
            <Link href="/dashboard">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded bg-emerald-100 text-emerald-600 flex items-center justify-center">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div className="flex flex-col">
              <input 
                type="text" 
                defaultValue="Untitled Spreadsheet"
                className="text-sm font-semibold text-slate-800 bg-transparent border-transparent hover:border-slate-300 focus:border-blue-500 rounded px-1 outline-none transition-all"
              />
              <span className="text-[10px] text-slate-500 px-1">Saved to ZenDrive</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="hidden md:flex">
            <Download className="w-4 h-4 mr-2" /> Download
          </Button>
          <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700">
            <Share className="w-4 h-4 mr-2" /> Share
          </Button>
        </div>
      </header>

      {/* Editor Toolbar (Mock) */}
      <div className="h-10 border-b border-slate-200 bg-white flex items-center px-4 gap-1 overflow-x-auto shrink-0">
        {['File', 'Home', 'Insert', 'Page Layout', 'Formulas', 'Data', 'Review', 'View'].map((item) => (
          <Button key={item} variant="ghost" size="sm" className="h-8 text-slate-600 font-medium text-xs rounded-sm hover:bg-slate-100">
            {item}
          </Button>
        ))}
      </div>

      {/* Main Editor Area (Mock) */}
      <div className="flex-1 overflow-hidden p-4">
        <div className="w-full h-full bg-white border border-slate-200 rounded shadow-sm flex flex-col items-center justify-center">
           <FileSpreadsheet className="w-16 h-16 text-slate-300 mb-4" />
           <h2 className="text-xl font-bold text-slate-700">Excel Editor Module</h2>
           <p className="text-slate-500 text-sm mt-2">Placeholder for Web Excel integration</p>
        </div>
      </div>
    </div>
  );
}
