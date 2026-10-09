"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { 
  ChevronLeft, FileText, Download, Save, Printer, Share2, 
  Settings, Bold, Italic, Underline, AlignLeft, AlignCenter, 
  AlignRight, Search, Plus, X, Type, LayoutGrid, Image as ImageIcon,
  MoreHorizontal, ChevronDown, Check, Columns, Rows, Sparkles,
  RefreshCw
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { ZenFileSyncService, ZenDocumentItem } from '@/lib/firebase-sync';
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
  const [currentDoc, setCurrentDoc] = useState<ZenDocumentItem | null>(null);
  const [sheetName, setSheetName] = useState('Sheet1');
  const [isLoaded, setIsLoaded] = useState(false);

  // Save, Export & Status state
  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);
  const [notification, setNotification] = useState<string | null>(null);
  
  // Resizing State
  const [colWidths, setColWidths] = useState<Record<string, number>>({});
  const [resizingCol, setResizingCol] = useState<string | null>(null);
  const [startX, setStartX] = useState(0);
  const [startWidth, setStartWidth] = useState(0);

  const showToast = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  };
  
  useEffect(() => {
    const loadExcelFile = async () => {
      const docParam = searchParams.get('doc');
      if (docParam) {
        setDocTitle(decodeURIComponent(docParam));
        const docObj = await ZenFileSyncService.getDocument(docParam);
        if (docObj) {
          setCurrentDoc(docObj);
        }
        
        if (docObj?.fileData) {
          try {
            const base64Data = docObj.fileData.includes(',') 
              ? docObj.fileData.split(',')[1] 
              : docObj.fileData;
            
            const workbook = XLSX.read(base64Data, { type: 'base64' });
            
            if (workbook.SheetNames.length > 0) {
              const firstSheetName = workbook.SheetNames[0];
              setSheetName(firstSheetName);
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
      setIsLoaded(true);
    };
    
    loadExcelFile();
  }, [searchParams]);

  // Generate binary and data URL representation of current spreadsheet
  const generateWorkbookData = useCallback(() => {
    let maxR = 20;
    let maxC = 10;
    
    // Find boundary of entered cell data
    Object.keys(cellData).forEach(cellRef => {
      if (cellData[cellRef] !== undefined && cellData[cellRef] !== null && String(cellData[cellRef]).trim() !== '') {
        try {
          const decoded = XLSX.utils.decode_cell(cellRef);
          if (decoded.r + 1 > maxR) maxR = decoded.r + 1;
          if (decoded.c + 1 > maxC) maxC = decoded.c + 1;
        } catch {}
      }
    });

    const range = { 
      s: { c: 0, r: 0 }, 
      e: { c: Math.max(COLS - 1, maxC - 1), r: Math.max(20, maxR - 1) } 
    };
    const worksheet: XLSX.WorkSheet = { '!ref': XLSX.utils.encode_range(range) };

    Object.entries(cellData).forEach(([cellRef, val]) => {
      if (val !== undefined && val !== null && val !== '') {
        const strVal = String(val);
        const trimmed = strVal.trim();
        const num = Number(trimmed);
        if (trimmed.startsWith('=')) {
          worksheet[cellRef] = { t: 's', f: trimmed.substring(1), v: trimmed };
        } else if (!isNaN(num) && trimmed !== '') {
          worksheet[cellRef] = { t: 'n', v: num };
        } else {
          worksheet[cellRef] = { t: 's', v: strVal };
        }
      }
    });

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, worksheet, sheetName || 'Sheet1');

    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'base64' });
    const dataUrl = `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${wbout}`;
    const arrayBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const bytes = new Uint8Array(arrayBuffer);

    return { dataUrl, bytes, workbook: wb };
  }, [cellData, sheetName]);

  // Save spreadsheet to storage (local and cloud sync)
  const handleSaveSpreadsheet = useCallback(async (silent = false) => {
    if (isSaving) return;
    setIsSaving(true);
    if (!silent) showToast('Saving spreadsheet...');
    try {
      const { dataUrl, bytes } = generateWorkbookData();
      const filename = docTitle.toLowerCase().endsWith('.xlsx') ? docTitle : `${docTitle}.xlsx`;
      
      const updated = await ZenFileSyncService.saveDocument({
        id: currentDoc?.id || filename,
        name: filename,
        type: 'excel',
        category: 'Spreadsheets',
        fileData: dataUrl,
        size: `${(bytes.length / 1024).toFixed(1)} KB`,
        sizeBytes: bytes.length,
        modified: new Date().toLocaleDateString(),
        synced: true,
      });

      setCurrentDoc(updated);
      setHasUnsavedChanges(false);
      setLastSavedTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      if (!silent) {
        showToast('Spreadsheet saved successfully!');
      }
    } catch (err) {
      console.error('Failed to save spreadsheet:', err);
      if (!silent) showToast('Failed to save spreadsheet');
    } finally {
      setIsSaving(false);
    }
  }, [isSaving, generateWorkbookData, docTitle, currentDoc]);

  // Debounced auto-save on modifications
  useEffect(() => {
    if (!isLoaded || !hasUnsavedChanges || isSaving) return;

    const timer = setTimeout(() => {
      handleSaveSpreadsheet(true);
    }, 2000);

    return () => clearTimeout(timer);
  }, [hasUnsavedChanges, isLoaded, isSaving, handleSaveSpreadsheet]);

  // Export spreadsheet as .xlsx file (Tauri native save dialog + browser fallback)
  const handleExportSpreadsheet = async () => {
    setIsExporting(true);
    showToast('Exporting spreadsheet...');
    try {
      const { bytes, dataUrl } = generateWorkbookData();
      const filename = docTitle.toLowerCase().endsWith('.xlsx') ? docTitle : `${docTitle}.xlsx`;

      // Persist changes
      const targetId = currentDoc?.id || filename;
      ZenFileSyncService.updateDocumentContent(targetId, dataUrl).catch(console.error);
      setHasUnsavedChanges(false);

      // 1. Try desktop Tauri native save dialog
      try {
        const { save } = await import('@tauri-apps/plugin-dialog');
        const { writeFile } = await import('@tauri-apps/plugin-fs');
        const filePath = await save({
          defaultPath: filename,
          filters: [{ name: 'Excel Spreadsheet (*.xlsx)', extensions: ['xlsx'] }]
        });
        if (filePath) {
          await writeFile(filePath, bytes);
          showToast(`Exported "${filename}" successfully!`);
          return;
        }
      } catch (tauriErr) {
        // Fallback to web browser download
      }

      // 2. Web browser download fallback
      const blob = new Blob([bytes as unknown as BlobPart], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast(`Exported "${filename}"!`);
    } catch (err) {
      console.error('Failed to export spreadsheet:', err);
      showToast('Failed to export spreadsheet');
    } finally {
      setIsExporting(false);
    }
  };

  // Keyboard shortcuts (Ctrl+S for save, Ctrl+E for AI copilot)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSaveSpreadsheet(false);
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'e') {
        e.preventDefault();
        setShowAiModal(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSaveSpreadsheet]);

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
    setHasUnsavedChanges(true);
    if (activeCell === id) {
      setFormulaValue(val);
    }
  };

  const handleCellFocus = (id: string) => {
    setActiveCell(id);
    setFormulaValue(cellData[id] || '');
  };

  const handleFormulaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setFormulaValue(val);
    setCellData(prev => ({ ...prev, [activeCell]: val }));
    setHasUnsavedChanges(true);
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

          {/* Auto-Save & Sync Status Badge */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 mb-1 rounded text-[11px] font-medium bg-slate-200/60 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
            {isSaving ? (
              <>
                <RefreshCw className="w-3 h-3 animate-spin text-emerald-600" />
                <span>Saving...</span>
              </>
            ) : hasUnsavedChanges ? (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                <span className="text-amber-700 dark:text-amber-400">Unsaved</span>
              </>
            ) : (
              <>
                <Check className="w-3 h-3 text-emerald-600" />
                <span className="text-emerald-700 dark:text-emerald-400">
                  Saved{lastSavedTime ? ` (${lastSavedTime})` : ''}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          <button 
            onClick={() => handleSaveSpreadsheet(false)}
            disabled={isSaving}
            className="h-7 px-3 bg-white dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 border border-[#e2dcd0] dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 hover:text-zinc-900 dark:hover:text-white disabled:opacity-60 text-xs font-semibold rounded flex items-center gap-1.5 transition-colors shadow-xs"
            title="Save Spreadsheet (Ctrl+S)"
          >
            {isSaving ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-600" />
            ) : (
              <Save className="w-3.5 h-3.5 text-emerald-600" />
            )}
            <span>{isSaving ? 'Saving...' : 'Save'}</span>
          </button>

          <button 
            onClick={handleExportSpreadsheet}
            disabled={isExporting}
            className="h-7 px-3 bg-white dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 border border-[#e2dcd0] dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 text-xs font-semibold rounded flex items-center gap-1.5 transition-colors shadow-xs"
            title="Export to .xlsx file"
          >
            {isExporting ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Download className="w-3.5 h-3.5" />
            )}
            <span>Export</span>
          </button>

          <button 
            onClick={() => {
              if (navigator.share) {
                navigator.share({ title: docTitle, url: window.location.href }).catch(() => {});
              } else {
                navigator.clipboard?.writeText(window.location.href);
                showToast('Link copied to clipboard!');
              }
            }}
            className="h-7 px-3 bg-white dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 border border-[#e2dcd0] dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 text-xs font-semibold rounded flex items-center gap-1.5 transition-colors shadow-xs"
          >
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

      {/* Toast Notification Banner */}
      {notification && (
        <div className="fixed bottom-12 right-6 z-50 bg-zinc-900/95 dark:bg-zinc-100 dark:text-zinc-900 text-white text-xs px-3.5 py-2.5 rounded-lg shadow-xl border border-zinc-700/60 flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <div className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
          <span>{notification}</span>
        </div>
      )}

      <ZenAiDialog 
        editorType="excel" 
        documentContext={JSON.stringify(cellData)} 
        isOpen={showAiModal} 
        onClose={() => setShowAiModal(false)} 
      />
    </div>
  );
}
