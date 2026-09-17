"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { 
  ChevronLeft, FileText, Download, Save, Printer, Share2, 
  Settings, Bold, Italic, Underline, AlignLeft, AlignCenter, 
  AlignRight, Search, Plus, X, Type, LayoutGrid, Image as ImageIcon,
  MoreHorizontal, ChevronDown, Check, Columns, Rows, Sparkles
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { ZenFileSyncService } from '@/lib/firebase-sync';
import { ZenAiDialog } from '@/components/shared/zen-ai-dialog';

const COLS = 26; // A to Z
const ROWS = 100;

export default function SpreadsheetEditor() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [docTitle, setDocTitle] = useState('Untitled Spreadsheet.xlsx');
  const [activeCell, setActiveCell] = useState('A1');
  const [cellData, setCellData] = useState<Record<string, string>>({});
  const [formulaValue, setFormulaValue] = useState('');
  const [showAiModal, setShowAiModal] = useState(false);
  
  // Resizing State
  const [colWidths, setColWidths] = useState<Record<string, number>>({});
  const [resizingCol, setResizingCol] = useState<string | null>(null);
  const [startX, setStartX] = useState(0);
  const [startWidth, setStartWidth] = useState(0);
  
  useEffect(() => {
    const loadExcelFile = async () => {
      const docParam = searchParams.get('doc');
      if (docParam) {
        setDocTitle(decodeURIComponent(docParam));
        const docObj = await ZenFileSyncService.getDocument(docParam);
        
        if (docObj?.fileData) {
          try {
            const base64Data = docObj.fileData.includes(',') 
              ? docObj.fileData.split(',')[1] 
              : docObj.fileData;
            
            const workbook = XLSX.read(base64Data, { type: 'base64' });
            
            if (workbook.SheetNames.length > 0) {
              const firstSheetName = workbook.SheetNames[0];
              const worksheet = workbook.Sheets[firstSheetName];
              const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1:Z100');
              
              const newCellData: Record<string, string> = {};
              for (let R = range.s.r; R <= range.e.r; R++) {
                for (let C = range.s.c; C <= range.e.c; C++) {
                  const cellRef = XLSX.utils.encode_cell({c: C, r: R});
                  const cell = worksheet[cellRef];
                  if (cell && cell.w !== undefined) {
                    newCellData[cellRef] = cell.w.toString();
                  } else if (cell && cell.v !== undefined) {
                    newCellData[cellRef] = cell.v.toString();
                  }
                }
              }
              setCellData(newCellData);
            }
          } catch (e) {
            console.error("Failed to parse Excel file", e);
          }
        }
      }
    };
    
    loadExcelFile();
  }, [searchParams]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'e') {
        e.preventDefault();
        setShowAiModal(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (resizingCol) {
        const diff = e.clientX - startX;
        setColWidths(prev => ({
          ...prev,
          [resizingCol]: Math.max(50, startWidth + diff)
        }));
      }
    };
    const handleMouseUp = () => setResizingCol(null);

    if (resizingCol) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizingCol, startX, startWidth]);

  const handleMouseDown = (e: React.MouseEvent, col: string) => {
    e.preventDefault();
    setResizingCol(col);
    setStartX(e.clientX);
    setStartWidth(colWidths[col] || 100);
  };

  const handleCellChange = (id: string, val: string) => {
    setCellData(prev => ({ ...prev, [id]: val }));
    if (activeCell === id) {
      setFormulaValue(val);
    }
  };

  const handleCellFocus = (id: string) => {
    setActiveCell(id);
    setFormulaValue(cellData[id] || '');
  };

  const handleFormulaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormulaValue(e.target.value);
    setCellData(prev => ({ ...prev, [activeCell]: e.target.value }));
  };

  const renderHeaders = () => {
    const headers = [];
    headers.push(<th key="corner" className="w-10 h-6 bg-slate-100 dark:bg-zinc-800 border-r border-b border-zinc-300 dark:border-zinc-700 select-none sticky left-0 z-20"></th>);
    for (let i = 0; i < COLS; i++) {
      const letter = String.fromCharCode(65 + i);
      const width = colWidths[letter] || 100;
      headers.push(
        <th 
          key={letter} 
          style={{ width: width, minWidth: width, maxWidth: width }}
          className="h-6 bg-slate-100 dark:bg-zinc-800 border-r border-b border-zinc-300 dark:border-zinc-700 font-normal text-xs text-center text-zinc-600 dark:text-zinc-400 select-none relative"
        >
          {letter}
          <div 
            onMouseDown={(e) => handleMouseDown(e, letter)}
            className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-emerald-500 z-10"
          />
        </th>
      );
    }
    return <tr>{headers}</tr>;
  };

  const renderRows = () => {
    const rows = [];
    for (let r = 1; r <= ROWS; r++) {
      const cells = [];
      cells.push(
        <td key={`row-${r}`} className="w-10 h-6 bg-slate-100 dark:bg-zinc-800 border-r border-b border-zinc-300 dark:border-zinc-700 font-normal text-xs text-center text-zinc-600 dark:text-zinc-400 select-none sticky left-0 z-10">
          {r}
        </td>
      );
      for (let c = 0; c < COLS; c++) {
        const letter = String.fromCharCode(65 + c);
        const cellId = `${letter}${r}`;
        const isSelected = activeCell === cellId;
        const width = colWidths[letter] || 100;
        
        cells.push(
          <td 
            key={cellId} 
            style={{ width: width, minWidth: width, maxWidth: width }}
            className={`h-6 border-r border-b border-zinc-200 dark:border-zinc-800 p-0 relative ${isSelected ? 'outline outline-2 outline-emerald-500 z-10' : ''}`}
            onClick={() => handleCellFocus(cellId)}
          >
            <input 
              type="text"
              className="w-full h-full px-1 text-xs bg-transparent focus:outline-none text-zinc-800 dark:text-zinc-200"
              value={cellData[cellId] || ''}
              onChange={(e) => handleCellChange(cellId, e.target.value)}
              onFocus={() => handleCellFocus(cellId)}
            />
          </td>
        );
      }
      rows.push(<tr key={r}>{cells}</tr>);
    }
    return rows;
  };

  return (
    <div className="flex flex-col h-screen bg-white dark:bg-[#0c0c0e] font-sans overflow-hidden">
      
      {/* 1. TOP WINDOW BAR / TABS */}
      <div className="h-14 bg-[#F0EDE6] dark:bg-[#0c0c0e] border-b border-[#e2dcd0] dark:border-zinc-800 flex items-center justify-between px-2 shrink-0 select-none">
        
        {/* Left: App Brand & Tab Strip */}
        <div className="flex items-center gap-1 h-full overflow-x-auto no-scrollbar items-end pt-2">
          <Link 
            href="/dashboard" 
            className="flex items-center gap-1.5 px-4 h-11 rounded-t-md hover:bg-slate-300/60 dark:hover:bg-zinc-800/60 transition-colors mr-1"
          >
            <div className="w-5 h-5 rounded bg-emerald-600 flex items-center justify-center text-white shadow-xs text-[10px] font-bold">
              X
            </div>
            <span className="text-xs font-bold text-zinc-900 dark:text-white tracking-tight">ZenOffice</span>
          </Link>

          {/* Active Document Tab */}
          <div className="flex items-center gap-2 px-4 h-11 rounded-t-md text-sm font-medium border-t border-x bg-white dark:bg-[#121214] border-[#e2dcd0] dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-xs">
            <div className="w-5 h-5 rounded bg-emerald-600 text-white flex items-center justify-center text-[10px] font-bold shrink-0">
              X
            </div>
            <span className="max-w-[220px] truncate" title={docTitle}>
              {docTitle}
            </span>
            <button 
              onClick={() => router.push('/dashboard')}
              className="hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 ml-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          <button className="h-7 px-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded flex items-center gap-1.5 transition-colors">
            <Share2 className="w-3.5 h-3.5" /> Share
          </button>
        </div>
      </div>

      {/* 2. RIBBON MENU & WORKSPACE BAR */}
      <div className="bg-[#F0EDE6] dark:bg-[#121214] border-b border-[#e2dcd0] dark:border-zinc-800 px-3 flex items-end shrink-0 gap-1 overflow-x-auto no-scrollbar pt-1 h-9">
        {['Home', 'Insert', 'Page Layout', 'Formulas', 'Data', 'Review', 'View'].map(tab => (
          <button 
            key={tab}
            className={`px-4 py-1.5 text-xs font-medium transition-all relative rounded-t-sm flex items-center gap-1.5 ${
              tab === 'Home'
                ? 'bg-white dark:bg-[#18181b] text-emerald-600 font-bold border-x border-t border-[#e2dcd0] dark:border-zinc-800 shadow-xs z-10'
                : 'text-zinc-600 dark:text-zinc-400 hover:bg-black/5 dark:hover:bg-zinc-800/50'
            }`}
            style={tab === 'Home' ? { borderTopColor: '#10b981', borderTopWidth: '2px' } : {}}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* 3. RICH RIBBON ACTION TOOLBAR */}
      <div className="bg-[#F0EDE6] dark:bg-[#18181b] border-b border-[#e2dcd0] dark:border-zinc-800 px-4 py-1.5 flex items-center gap-4 w-full overflow-x-auto no-scrollbar min-h-[60px]">
        
        {/* AI Agent Group */}
        <div className="flex items-center border-r border-[#e2dcd0] dark:border-zinc-800 pr-4 h-full">
          <button 
            onClick={() => setShowAiModal(true)}
            className="flex flex-col items-center justify-center h-full px-3 hover:bg-orange-100 dark:hover:bg-orange-900/30 rounded text-orange-600 dark:text-orange-500 gap-1 transition-colors"
          >
            <Sparkles className="w-5 h-5" />
            <span className="text-[10px] font-bold">AI Editing</span>
          </button>
        </div>

        {/* Font Group */}
        <div className="flex items-center gap-1 border-r border-[#e2dcd0] dark:border-zinc-800 pr-4">
          <select className="h-7 text-xs border border-zinc-200 dark:border-zinc-700 rounded bg-white dark:bg-zinc-900 px-2 outline-none">
            <option>Calibri</option>
            <option>Arial</option>
            <option>Times New Roman</option>
          </select>
          <select className="h-7 w-14 text-xs border border-zinc-200 dark:border-zinc-700 rounded bg-white dark:bg-zinc-900 px-2 outline-none">
            <option>11</option>
            <option>12</option>
            <option>14</option>
          </select>
          <div className="flex items-center ml-2 border border-zinc-200 dark:border-zinc-700 rounded overflow-hidden">
            <button className="w-7 h-7 flex items-center justify-center bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800"><Bold className="w-3.5 h-3.5" /></button>
            <button className="w-7 h-7 flex items-center justify-center bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 border-l border-zinc-200 dark:border-zinc-700"><Italic className="w-3.5 h-3.5" /></button>
            <button className="w-7 h-7 flex items-center justify-center bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 border-l border-zinc-200 dark:border-zinc-700"><Underline className="w-3.5 h-3.5" /></button>
          </div>
        </div>

        {/* Alignment Group */}
        <div className="flex items-center gap-1 border-r border-[#e2dcd0] dark:border-zinc-800 pr-4">
          <div className="flex items-center border border-zinc-200 dark:border-zinc-700 rounded overflow-hidden">
            <button className="w-7 h-7 flex items-center justify-center bg-zinc-100 dark:bg-zinc-800"><AlignLeft className="w-3.5 h-3.5" /></button>
            <button className="w-7 h-7 flex items-center justify-center bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 border-l border-zinc-200 dark:border-zinc-700"><AlignCenter className="w-3.5 h-3.5" /></button>
            <button className="w-7 h-7 flex items-center justify-center bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 border-l border-zinc-200 dark:border-zinc-700"><AlignRight className="w-3.5 h-3.5" /></button>
          </div>
        </div>
      </div>

      {/* 4. FORMULA BAR */}
      <div className="h-8 bg-white dark:bg-[#121214] border-b border-zinc-200 dark:border-zinc-800 flex items-center px-2 shrink-0">
        <div className="w-16 h-full flex items-center justify-center text-xs font-semibold text-zinc-600 border-r border-zinc-200 dark:border-zinc-800">
          {activeCell}
        </div>
        <div className="px-2 text-zinc-400 font-serif italic font-bold">fx</div>
        <input 
          type="text" 
          value={formulaValue}
          onChange={handleFormulaChange}
          className="flex-1 h-full px-2 text-xs outline-none bg-transparent dark:text-zinc-200" 
          placeholder="Enter formula or text..."
        />
      </div>

      {/* 5. GRID WORKSPACE */}
      <div className="flex-1 overflow-auto bg-zinc-100 dark:bg-[#000000]">
        <table className="border-collapse bg-white dark:bg-[#18181b]">
          <thead>
            {renderHeaders()}
          </thead>
          <tbody>
            {renderRows()}
          </tbody>
        </table>
      </div>

      {/* 6. BOTTOM SHEETS TAB */}
      <div className="h-8 bg-[#F0EDE6] dark:bg-[#0c0c0e] border-t border-[#e2dcd0] dark:border-zinc-800 flex items-center px-2 shrink-0">
        <button className="px-4 h-full bg-white dark:bg-zinc-800 text-emerald-600 text-xs font-semibold border-t-2 border-emerald-500 shadow-sm">
          Sheet1
        </button>
        <button className="px-4 h-full hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-600 text-xs flex items-center justify-center transition-colors">
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      <ZenAiDialog 
        editorType="excel" 
        documentContext={JSON.stringify(cellData)} 
        isOpen={showAiModal} 
        onClose={() => setShowAiModal(false)} 
      />
    </div>
  );
}
