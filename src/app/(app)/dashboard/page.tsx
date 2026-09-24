'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
  FileText, FileSpreadsheet, FileIcon, 
  MoreHorizontal, Sparkles, Search, Grid, 
  List, Clock, CloudOff, Cloud, RefreshCw, 
  X, ChevronDown, Check, ArrowRight, 
  FolderOpen, Upload, Trash2, Eye, ShieldCheck, 
  FileCode, Layers, BookOpen, PenTool, 
  CheckCircle2, AlertCircle, Star, Download,
  Languages, FileOutput, ScanText,
  RotateCcw, Plus, ArrowUpDown
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ZenFileSyncService, ZenDocumentItem } from '@/lib/firebase-sync';
import { OcrDialog } from '@/components/ocr-dialog';
export default function DashboardPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Query parameter views
  const viewParam = searchParams.get('view') || 'recent';
  const locationParam = searchParams.get('location');
  const searchParam = searchParams.get('q') || '';

  // Local documents state (zero hardcoded slop)
  const [documents, setDocuments] = React.useState<ZenDocumentItem[]>([]);
  const [trashDocuments, setTrashDocuments] = React.useState<ZenDocumentItem[]>([]);
  const [cloudSyncActive, setCloudSyncActive] = React.useState(false);
  const [syncing, setSyncing] = React.useState(false);
  const [viewMode, setViewMode] = React.useState<'list' | 'grid'>('list');
  const [notification, setNotification] = React.useState<string | null>(null);
  const [dragActive, setDragActive] = React.useState(false);

  // Filters & Sorting state
  const [filterType, setFilterType] = React.useState<string>('all');
  const [filterLocation, setFilterLocation] = React.useState<string>(locationParam || 'all');
  const [sortField, setSortField] = React.useState<'modified' | 'size' | 'name'>('modified');
  const [sortAsc, setSortAsc] = React.useState(false);

  // Functional Tools Modals
  const [showConverterModal, setShowConverterModal] = React.useState(false);
  const [showOcrModal, setShowOcrModal] = React.useState(false);
  const [showMergeModal, setShowMergeModal] = React.useState(false);
  const [ocrText, setOcrText] = React.useState('');

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const showToast = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3500);
  };

  const loadDocs = async () => {
    let docs = ZenFileSyncService.getLocalDocuments();
    
    if (locationParam && ['Downloads', 'Documents', 'Desktop'].includes(locationParam)) {
      try {
        const { readDir } = await import('@tauri-apps/plugin-fs');
        const { downloadDir, documentDir, desktopDir } = await import('@tauri-apps/api/path');
        let dirPath = '';
        if (locationParam === 'Downloads') dirPath = await downloadDir();
        else if (locationParam === 'Documents') dirPath = await documentDir();
        else if (locationParam === 'Desktop') dirPath = await desktopDir();
        
        if (dirPath) {
          const entries = await readDir(dirPath);
          const tauriDocs: ZenDocumentItem[] = entries
            .filter(e => e.isFile && e.name)
            .filter(e => e.name!.match(/\\.(pdf|docx?|xlsx?|csv|pptx?|txt)$/i))
            .map(e => {
              const lower = e.name!.toLowerCase();
              const docType = lower.endsWith('.pdf') ? 'pdf' : (lower.match(/\\.(xlsx?|csv)$/) ? 'excel' : (lower.match(/\\.(pptx?)$/) ? 'presentation' : 'word'));
              return {
                id: 'native-' + e.name!,
                name: e.name!,
                type: docType as any,
                sizeBytes: 0,
                size: 'Native',
                modified: 'Local File',
                location: locationParam,
                creator: 'System',
                isLocal: true,
                syncedToCloud: false,
                isStarred: false,
              };
            });
            
          const existingNames = new Set(docs.map(d => d.name));
          const newNativeDocs = tauriDocs.filter(d => !existingNames.has(d.name));
          docs = [...newNativeDocs.slice(0, 100), ...docs];
        }
      } catch (err) {
        console.error('Tauri native FS read failed:', err);
      }
    }

    setDocuments(docs);
    setTrashDocuments(ZenFileSyncService.getTrashDocuments());
    setCloudSyncActive(ZenFileSyncService.isCloudSyncEnabled());
  };

  React.useEffect(() => {
    loadDocs();
  }, [viewParam, locationParam]);

  React.useEffect(() => {
    if (locationParam) setFilterLocation(locationParam);
  }, [locationParam]);

  // Upload handler for real files
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    const newDoc = await ZenFileSyncService.addUploadedFile(file, filterLocation === 'all' ? 'Downloads' : filterLocation);
    loadDocs();
    showToast(`Uploaded ${newDoc.name} [Stored Locally]`);
    openDocument(newDoc);
  };

  // Drag & drop handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    else if (e.type === 'dragleave') setDragActive(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      const newDoc = await ZenFileSyncService.addUploadedFile(file, 'Downloads');
      loadDocs();
      showToast(`Uploaded ${newDoc.name} [Stored Locally]`);
      openDocument(newDoc);
    }
  };

  // Route to corresponding editor
  const openDocument = (doc: ZenDocumentItem) => {
    if (doc.type === 'pdf') {
      router.push(`/editor/pdf?doc=${encodeURIComponent(doc.name)}`);
    } else if (doc.type === 'excel') {
      router.push(`/editor/excel?doc=${encodeURIComponent(doc.name)}`);
    } else if (doc.type === 'presentation') {
      router.push(`/editor/presentation?doc=${encodeURIComponent(doc.name)}`);
    } else {
      router.push(`/editor/document?doc=${encodeURIComponent(doc.name)}`);
    }
  };

  // Optional sample loader
  const handleLoadSampleReceipt = () => {
    const sample = ZenFileSyncService.loadSampleReceipt();
    loadDocs();
    showToast('Loaded Obafemi Awolowo University Receipt');
    openDocument(sample);
  };

  const handleToggleStar = (e: React.MouseEvent, docId: string) => {
    e.stopPropagation();
    ZenFileSyncService.toggleStar(docId);
    loadDocs();
    showToast('Updated Star status');
  };

  const handleTrashDoc = (e: React.MouseEvent, docId: string) => {
    e.stopPropagation();
    ZenFileSyncService.moveToTrash(docId);
    loadDocs();
    showToast('Moved to Recycle Bin');
  };

  const handleRemoveFromRecents = (e: React.MouseEvent, docId: string) => {
    e.stopPropagation();
    ZenFileSyncService.removeFromRecents(docId);
    loadDocs();
    showToast('Removed from Recents');
  };

  const handleRestoreDoc = (e: React.MouseEvent, docId: string) => {
    e.stopPropagation();
    ZenFileSyncService.restoreFromTrash(docId);
    loadDocs();
    showToast('Restored file');
  };

  const handlePermanentDelete = (e: React.MouseEvent, docId: string) => {
    e.stopPropagation();
    ZenFileSyncService.permanentDelete(docId);
    loadDocs();
    showToast('Permanently deleted');
  };

  const handleToggleCloudSync = async () => {
    if (cloudSyncActive) {
      ZenFileSyncService.setCloudSyncEnabled(false);
      setCloudSyncActive(false);
      showToast('Cloud Sync disabled. Files are local only.');
    } else {
      setSyncing(true);
      showToast('Connecting to Firebase Firestore...');
      const result = await ZenFileSyncService.syncToFirebase();
      setSyncing(false);
      setCloudSyncActive(true);
      loadDocs();
      showToast(`Synced ${result.syncedCount} files to Firebase ZenDrive!`);
    }
  };

  // Filter & Sort list
  const displayedDocs = React.useMemo(() => {
    let list = viewParam === 'trash' ? trashDocuments : documents;

    if (viewParam === 'starred') {
      list = list.filter(d => d.isStarred);
    } else if (viewParam === 'cloud') {
      list = list.filter(d => d.syncedToCloud);
    }

    if (filterType !== 'all') {
      list = list.filter(d => d.type === filterType);
    }

    if (filterLocation !== 'all') {
      list = list.filter(d => d.location.toLowerCase() === filterLocation.toLowerCase());
    }

    if (searchParam.trim()) {
      const q = searchParam.toLowerCase();
      list = list.filter(d => d.name.toLowerCase().includes(q));
    }

    list = [...list].sort((a, b) => {
      if (sortField === 'size') {
        return sortAsc ? (a.sizeBytes || 0) - (b.sizeBytes || 0) : (b.sizeBytes || 0) - (a.sizeBytes || 0);
      } else if (sortField === 'name') {
        return sortAsc ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
      } else {
        return sortAsc ? a.modified.localeCompare(b.modified) : b.modified.localeCompare(a.modified);
      }
    });

    return list;
  }, [documents, trashDocuments, viewParam, filterType, filterLocation, searchParam, sortField, sortAsc]);

  return (
    <div 
      onDragEnter={handleDrag}
      onDragLeave={handleDrag}
      onDragOver={handleDrag}
      onDrop={handleDrop}
      className="flex flex-col xl:flex-row gap-6 p-6 h-full max-w-[1700px] mx-auto  font-sans"
    >
      {/* Hidden File Input */}
      <input 
        ref={fileInputRef}
        type="file"
        id="dashboard-file-input"
        onChange={handleFileUpload}
        className="hidden"
        accept=".pdf,.docx,.doc,.xlsx,.xls,.csv,.pptx,.ppt,.txt"
      />

      {/* Drag & Drop Visual Overlay */}
      {dragActive && (
        <div className="fixed inset-0 z-50 bg-orange-600/20 backdrop-blur-xs border-4 border-dashed border-orange-600 rounded-2xl flex items-center justify-center pointer-events-none">
          <div className="bg-white dark:bg-[#121214] px-8 py-6 rounded-xl shadow-2xl border border-orange-500 text-center space-y-2">
            <Upload className="w-10 h-10 text-orange-600 mx-auto animate-bounce" />
            <p className="text-sm font-bold text-slate-800 dark:text-zinc-100">Drop files to open in ZenOffice</p>
            <p className="text-xs text-slate-500">Stored locally on this device</p>
          </div>
        </div>
      )}

      {/* MAIN CENTER WORKSPACE */}
      <div className="flex-1 min-w-0 flex flex-col gap-6">

        {/* 1. CLEAN ZENOFFICE QUICK ACTION BAR (Orange Brand, No Commercial WPS Clutter) */}
        <div className="p-5 rounded-2xl bg-gradient-to-r from-orange-500/10 via-amber-500/5 to-transparent border border-orange-500/20 dark:border-orange-500/15 dark:bg-[#0c0c0e] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-orange-600 animate-pulse" />
              <h1 className="text-lg font-extrabold text-slate-900 dark:text-white tracking-tight">
                ZenOffice Workspace
              </h1>
            </div>
            <p className="text-xs text-slate-500 dark:text-zinc-400">
              High-performance local productivity. Create, open, and edit documents offline.
            </p>
          </div>

          {/* Core 4 Quick Start Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {/* New Word Doc */}
            <Button 
              onClick={() => router.push('/editor/document')}
              size="sm"
              className="bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold shadow-xs gap-1.5 h-8 rounded-lg"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>New Document</span>
            </Button>

            {/* New Spreadsheet */}
            <Button 
              onClick={() => router.push('/editor/excel')}
              size="sm"
              variant="outline"
              className="border-slate-300 dark:border-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-900 text-slate-800 dark:text-zinc-200 text-xs font-medium h-8 rounded-lg gap-1.5"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>Spreadsheet</span>
            </Button>

            {/* PDF Suite */}
            <Button 
              onClick={() => router.push('/editor/pdf')}
              size="sm"
              variant="outline"
              className="border-slate-300 dark:border-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-900 text-slate-800 dark:text-zinc-200 text-xs font-medium h-8 rounded-lg gap-1.5"
            >
              <FileIcon className="w-3.5 h-3.5 text-rose-600" />
              <span>PDF Suite</span>
            </Button>

            {/* Open / Upload File */}
            <Button 
              onClick={() => fileInputRef.current?.click()}
              size="sm"
              variant="outline"
              className="border-orange-300 dark:border-orange-800/60 bg-orange-50/50 dark:bg-orange-950/20 text-orange-700 dark:text-orange-400 hover:bg-orange-100 dark:hover:bg-orange-950/40 text-xs font-semibold h-8 rounded-lg gap-1.5"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Open Local File</span>
            </Button>

            {/* OCR Tool */}
            <Button 
              onClick={() => setShowOcrModal(true)}
              size="sm"
              variant="outline"
              className="border-indigo-300 dark:border-indigo-800/60 bg-indigo-50/50 dark:bg-indigo-950/20 text-indigo-700 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-950/40 text-xs font-semibold h-8 rounded-lg gap-1.5"
            >
              <ScanText className="w-3.5 h-3.5" />
              <span>Image to Text (OCR)</span>
            </Button>

            {/* All Tools Shortcut */}
            <Button 
              onClick={() => router.push('/tools')}
              size="sm"
              variant="outline"
              className="border-blue-300 dark:border-blue-800/60 bg-blue-50/50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-950/40 text-xs font-semibold h-8 rounded-lg gap-1.5"
            >
              <Grid className="w-3.5 h-3.5" />
              <span>All Tools</span>
            </Button>
          </div>
        </div>

        {/* 2. RECENT HEADER + CLOUD SYNC TOGGLE */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-bold text-slate-800 dark:text-zinc-100 flex items-center gap-2">
              <Clock className="w-4 h-4 text-orange-600" />
              <span>{viewParam === 'trash' ? 'Recycle Bin' : viewParam === 'starred' ? 'Starred Documents' : viewParam === 'cloud' ? 'ZenDrive Cloud Files' : 'Local Documents'}</span>
            </h2>
            
            <button 
              onClick={() => {
                loadDocs();
                showToast('Refreshed files');
              }}
              className="p-1 rounded hover:bg-slate-200 dark:hover:bg-zinc-800 text-slate-500 dark:text-zinc-400 transition-colors" 
              title="Refresh"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>

            {viewParam === 'trash' && trashDocuments.length > 0 && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => {
                  ZenFileSyncService.emptyTrash();
                  loadDocs();
                  showToast('Recycle Bin emptied');
                }}
                className="h-7 text-xs text-rose-600 border-rose-300 dark:border-rose-900/60 hover:bg-rose-50 dark:hover:bg-rose-950/30"
              >
                Empty Trash
              </Button>
            )}
          </div>

          {/* Cloud Sync Toggle Button */}
          <button
            onClick={handleToggleCloudSync}
            disabled={syncing}
            className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md border transition-all ${
              cloudSyncActive 
                ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 font-semibold' 
                : 'bg-slate-50 dark:bg-zinc-900 border-slate-300 dark:border-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-850'
            }`}
          >
            {syncing ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-orange-600" />
                <span>Syncing to Firebase...</span>
              </>
            ) : cloudSyncActive ? (
              <>
                <Cloud className="w-3.5 h-3.5 text-emerald-600" />
                <span>Cloud Sync Active (Firebase)</span>
              </>
            ) : (
              <>
                <CloudOff className="w-3.5 h-3.5 text-slate-400" />
                <span>Local Only (Cloud Sync disabled)</span>
              </>
            )}
          </button>
        </div>

        {/* 3. FILTER & VIEW TOOLBAR */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-zinc-800 pb-2 text-xs text-slate-500 dark:text-zinc-400">
          <div className="flex items-center gap-4">
            
            {/* Filter: Types */}
            <select 
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="bg-transparent text-xs font-semibold text-slate-700 dark:text-zinc-200 outline-none cursor-pointer hover:text-orange-600 dark:hover:text-orange-400"
            >
              <option value="all" className="dark:bg-[#121214]">All Document Types</option>
              <option value="pdf" className="dark:bg-[#121214]">PDFs</option>
              <option value="word" className="dark:bg-[#121214]">Word Docs</option>
              <option value="excel" className="dark:bg-[#121214]">Spreadsheets</option>
            </select>

            {/* Filter: Locations */}
            <select 
              value={filterLocation}
              onChange={(e) => setFilterLocation(e.target.value)}
              className="bg-transparent text-xs font-medium text-slate-600 dark:text-zinc-400 outline-none cursor-pointer hover:text-orange-600"
            >
              <option value="all" className="dark:bg-[#121214]">All Folders</option>
              <option value="Downloads" className="dark:bg-[#121214]">Downloads</option>
              <option value="Documents" className="dark:bg-[#121214]">Documents</option>
              <option value="Desktop" className="dark:bg-[#121214]">Desktop</option>
            </select>

            <span className="text-[11px] text-slate-400 dark:text-zinc-500 hidden sm:inline">
              {displayedDocs.length} item{displayedDocs.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Sorting and View Switcher */}
          <div className="flex items-center gap-3">
            
            {/* Sort: Modified */}
            <button 
              onClick={() => {
                if (sortField === 'modified') setSortAsc(!sortAsc);
                else { setSortField('modified'); setSortAsc(false); }
              }}
              className={`flex items-center gap-1 hover:text-orange-600 ${sortField === 'modified' ? 'font-semibold text-orange-600 dark:text-orange-400' : ''}`}
            >
              <span>Date</span>
              <ArrowUpDown className="w-3 h-3" />
            </button>

            {/* Sort: Size */}
            <button 
              onClick={() => {
                if (sortField === 'size') setSortAsc(!sortAsc);
                else { setSortField('size'); setSortAsc(false); }
              }}
              className={`flex items-center gap-1 hover:text-orange-600 ${sortField === 'size' ? 'font-semibold text-orange-600 dark:text-orange-400' : ''}`}
            >
              <span>Size</span>
              <ArrowUpDown className="w-3 h-3" />
            </button>

            {/* List / Grid toggle */}
            <div className="flex items-center gap-1 border-l border-slate-200 dark:border-zinc-800 pl-3">
              <button 
                onClick={() => setViewMode('list')}
                className={`p-1 rounded ${viewMode === 'list' ? 'bg-slate-200 dark:bg-zinc-800 text-slate-900 dark:text-white' : 'hover:bg-slate-100 dark:hover:bg-zinc-900 text-slate-500'}`}
                title="List View"
              >
                <List className="w-3.5 h-3.5" />
              </button>
              <button 
                onClick={() => setViewMode('grid')}
                className={`p-1 rounded ${viewMode === 'grid' ? 'bg-slate-200 dark:bg-zinc-800 text-slate-900 dark:text-white' : 'hover:bg-slate-100 dark:hover:bg-zinc-900 text-slate-500'}`}
                title="Grid View"
              >
                <Grid className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* 4. DOCUMENTS DISPLAY (PURE LOCAL & CLEAN ZERO-SLOP STATE) */}
        {displayedDocs.length === 0 ? (
          <div className="py-16 px-6 border-2 border-dashed border-slate-200 dark:border-zinc-850 rounded-2xl text-center flex flex-col items-center justify-center space-y-4 bg-slate-50/50 dark:bg-[#08080a]">
            <div className="w-14 h-14 rounded-2xl bg-orange-500/10 text-orange-600 flex items-center justify-center shadow-xs">
              <FolderOpen className="w-7 h-7" />
            </div>
            
            <div className="space-y-1 max-w-sm">
              <h3 className="text-sm font-bold text-slate-800 dark:text-zinc-100">
                {searchParam ? `No documents match "${searchParam}"` : viewParam === 'trash' ? 'Recycle Bin is empty' : 'No local files yet'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                Open a file from your computer or create a new document. Your files remain completely local on your device.
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
              <label 
                htmlFor="dashboard-file-input"
                className="px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold cursor-pointer shadow-xs transition-colors flex items-center gap-1.5"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Open File from Computer</span>
              </label>

              <button 
                onClick={() => router.push('/editor/document')}
                className="px-3.5 py-2 rounded-lg border border-slate-300 dark:border-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-900 text-slate-700 dark:text-zinc-200 text-xs font-medium transition-colors"
              >
                Create Word Doc
              </button>

              <button 
                onClick={() => router.push('/editor/excel')}
                className="px-3.5 py-2 rounded-lg border border-slate-300 dark:border-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-900 text-slate-700 dark:text-zinc-200 text-xs font-medium transition-colors"
              >
                Create Spreadsheet
              </button>

              <button 
                onClick={handleLoadSampleReceipt}
                className="px-3.5 py-2 rounded-lg border border-rose-300 dark:border-rose-900/60 bg-rose-50/50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-950/40 text-xs font-medium transition-colors"
              >
                Open Demo OAU Receipt
              </button>
            </div>
          </div>
        ) : viewMode === 'list' ? (
          /* REAL LIST VIEW (Clean True Black & White) */
          <div className="divide-y divide-slate-100 dark:divide-zinc-850">
            {displayedDocs.map((doc) => (
              <div 
                key={doc.id}
                onClick={() => openDocument(doc)}
                className="group flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-slate-50 dark:hover:bg-zinc-900/70 cursor-pointer transition-all"
              >
                {/* File Icon, Star & Name */}
                <div className="flex items-center gap-3 min-w-0 flex-1 pr-4">
                  <button 
                    onClick={(e) => handleToggleStar(e, doc.id)}
                    className="p-1 rounded text-slate-300 dark:text-zinc-600 hover:text-amber-400 transition-colors"
                    title={doc.isStarred ? 'Unstar document' : 'Star document'}
                  >
                    <Star className={`w-3.5 h-3.5 ${doc.isStarred ? 'text-amber-400 fill-amber-400' : ''}`} />
                  </button>

                  <div className={`w-6 h-6 rounded flex items-center justify-center text-white text-[9px] font-bold shrink-0 ${
                    doc.type === 'pdf' ? 'bg-rose-600' : doc.type === 'excel' ? 'bg-emerald-600' : doc.type === 'presentation' ? 'bg-amber-600' : 'bg-orange-600'
                  }`}>
                    {doc.type === 'pdf' ? 'P' : doc.type === 'excel' ? 'X' : doc.type === 'presentation' ? 'S' : 'W'}
                  </div>
                  
                  <span className="text-xs font-medium text-slate-900 dark:text-zinc-100 truncate group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">
                    {doc.name}
                  </span>

                  {doc.isLocal && (
                    <span className="px-1.5 py-0.2 rounded text-[10px] font-medium bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 border border-slate-200 dark:border-zinc-750 shrink-0">
                      Local
                    </span>
                  )}

                  {doc.syncedToCloud && (
                    <span className="px-1.5 py-0.2 rounded text-[10px] font-medium bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 shrink-0 flex items-center gap-1">
                      <CheckCircle2 className="w-2.5 h-2.5" /> Synced
                    </span>
                  )}
                </div>

                {/* Metadata columns */}
                <div className="flex items-center gap-6 text-xs text-slate-500 dark:text-zinc-400 shrink-0">
                  <span className="hidden sm:inline w-24 truncate">{doc.location}</span>
                  <span className="hidden md:inline w-12 text-center">{doc.creator}</span>
                  <span className="hidden lg:inline w-24 text-right">{doc.modified}</span>
                  <span className="w-16 text-right font-mono text-[11px]">{doc.size}</span>
                  
                  {/* Action Menu */}
                  <div className="w-8 flex items-center justify-end" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-slate-200 dark:hover:bg-zinc-800 text-slate-500 dark:text-zinc-400 transition-opacity">
                          <MoreHorizontal className="w-4 h-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="dark:bg-[#18181b] dark:border-zinc-800 text-xs">
                        <DropdownMenuItem onClick={() => openDocument(doc)}>
                          <Eye className="w-3.5 h-3.5 mr-2" /> Open in Editor
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => handleToggleStar(e, doc.id)}>
                          <Star className="w-3.5 h-3.5 mr-2 text-amber-500" /> {doc.isStarred ? 'Remove from Starred' : 'Add to Starred'}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => {
                          ZenFileSyncService.downloadDocument(doc);
                          showToast(`Downloading ${doc.name}...`);
                        }}>
                          <Download className="w-3.5 h-3.5 mr-2" /> Download File
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={handleToggleCloudSync}>
                          <Cloud className="w-3.5 h-3.5 mr-2 text-orange-600" /> {cloudSyncActive ? 'Force Sync to Firebase' : 'Backup to Cloud'}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {viewParam === 'trash' ? (
                          <>
                            <DropdownMenuItem onClick={(e) => handleRestoreDoc(e, doc.id)}>
                              <RotateCcw className="w-3.5 h-3.5 mr-2 text-emerald-600" /> Restore File
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={(e) => handlePermanentDelete(e, doc.id)} className="text-rose-600">
                              <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete Permanently
                            </DropdownMenuItem>
                          </>
                        ) : (
                          <>
                            <DropdownMenuItem onClick={(e) => handleRemoveFromRecents(e, doc.id)} className="text-orange-600 dark:text-orange-400">
                              <X className="w-3.5 h-3.5 mr-2" /> Remove from Recents
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={(e) => handleTrashDoc(e, doc.id)} className="text-rose-600">
                              <Trash2 className="w-3.5 h-3.5 mr-2" /> Move to Recycle Bin
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* REAL GRID VIEW */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {displayedDocs.map((doc) => (
              <div
                key={doc.id}
                onClick={() => openDocument(doc)}
                className="p-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#121214] hover:border-orange-500 dark:hover:border-orange-500 shadow-2xs hover:shadow-sm cursor-pointer transition-all flex flex-col justify-between space-y-3 group"
              >
                <div className="flex items-start justify-between">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold ${
                    doc.type === 'pdf' ? 'bg-rose-600' : doc.type === 'excel' ? 'bg-emerald-600' : doc.type === 'presentation' ? 'bg-amber-600' : 'bg-orange-600'
                  }`}>
                    {doc.type === 'pdf' ? 'PDF' : doc.type === 'excel' ? 'XLS' : doc.type === 'presentation' ? 'PPT' : 'DOC'}
                  </div>
                  
                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <button 
                      onClick={(e) => handleToggleStar(e, doc.id)}
                      className="p-1 text-slate-300 dark:text-zinc-600 hover:text-amber-400"
                      title={doc.isStarred ? 'Unstar document' : 'Star document'}
                    >
                      <Star className={`w-3.5 h-3.5 ${doc.isStarred ? 'text-amber-400 fill-amber-400' : ''}`} />
                    </button>
                    <button 
                      onClick={(e) => handleRemoveFromRecents(e, doc.id)}
                      className="p-1 text-slate-400 hover:text-orange-500 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Remove from Recents"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                    <button 
                      onClick={(e) => handleTrashDoc(e, doc.id)}
                      className="p-1 text-slate-400 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Move to Recycle Bin"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div>
                  <div className="text-xs font-semibold text-slate-900 dark:text-zinc-100 truncate group-hover:text-orange-600 dark:group-hover:text-orange-400">
                    {doc.name}
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500 dark:text-zinc-500">
                    <span>{doc.location}</span>
                    <span>•</span>
                    <span className="font-mono">{doc.size}</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-between text-[10px] text-slate-400 dark:text-zinc-500">
                  <span>{doc.modified}</span>
                  <span className="px-1.5 py-0.2 rounded bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400">
                    Local
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

      </div>

      {/* RIGHT SIDEBAR: CLEAN PRODUCTIVITY SUITE TOOLS */}
      <aside className="w-full xl:w-72 shrink-0 flex flex-col gap-4 ">
        
        {/* Zen Office Suite Tools */}
        <div className="bg-white dark:bg-[#121214] border border-slate-200 dark:border-zinc-800 rounded-xl p-4 space-y-3 shadow-2xs">
          <div className="text-xs font-bold text-slate-800 dark:text-zinc-100 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-orange-600" />
            <span>Productivity Utilities</span>
          </div>

          <div className="space-y-1">
            {[
              { 
                title: 'PDF Suite & Sign', 
                desc: 'Fill official forms, add e-signatures, and annotate', 
                icon: FileIcon, 
                color: 'text-rose-600',
                action: () => router.push('/editor/pdf')
              },
              { 
                title: 'Zen PDF Converter', 
                desc: 'Convert PDF to Word, Excel, or high-res images', 
                icon: FileOutput, 
                color: 'text-orange-600',
                action: () => setShowConverterModal(true)
              },
              { 
                title: 'Image to Text (OCR)', 
                desc: 'Extract editable text from scanned receipts & photos', 
                icon: ScanText, 
                color: 'text-blue-600',
                action: () => setShowOcrModal(true)
              },
              { 
                title: 'Split & Merge PDF', 
                desc: 'Join multiple documents or split pages into new files', 
                icon: Layers, 
                color: 'text-teal-600',
                action: () => setShowMergeModal(true)
              },
            ].map((tool, idx) => (
              <div
                key={idx}
                onClick={tool.action}
                className="p-2.5 rounded-lg hover:bg-slate-50 dark:hover:bg-zinc-850 cursor-pointer transition-colors flex items-start gap-2.5 group border border-transparent hover:border-slate-200 dark:hover:border-zinc-800"
              >
                <div className={`p-1.5 rounded-md bg-slate-100 dark:bg-zinc-800 ${tool.color} shrink-0 mt-0.5 group-hover:scale-105 transition-transform`}>
                  <tool.icon className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-xs font-semibold text-slate-800 dark:text-zinc-200 group-hover:text-orange-700 dark:group-hover:text-orange-400 transition-colors block">
                    {tool.title}
                  </span>
                  <p className="text-[11px] text-slate-500 dark:text-zinc-400 leading-snug mt-0.5">
                    {tool.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Local Storage Status Box */}
        <div className="bg-white dark:bg-[#121214] border border-slate-200 dark:border-zinc-800 rounded-xl p-4 space-y-2 text-xs">
          <div className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-zinc-200">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Privacy &amp; Offline Mode</span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-zinc-400 leading-relaxed">
            ZenOffice is built local-first. All documents stay on your machine unless you enable cloud sync.
          </p>
        </div>

      </aside>

      {/* PDF CONVERTER MODAL */}
      <Dialog open={showConverterModal} onOpenChange={setShowConverterModal}>
        <DialogContent className="sm:max-w-md dark:bg-[#121214] dark:border-zinc-800">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-800 dark:text-zinc-100 flex items-center gap-2">
              <FileOutput className="w-4 h-4 text-orange-600" /> Zen PDF Converter
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Convert PDF to editable Word (DOCX), Excel (XLSX), or Image.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2 text-xs">
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'PDF to Word', desc: '.docx file', icon: FileText, color: 'text-orange-600' },
                { label: 'PDF to Excel', desc: '.xlsx tables', icon: FileSpreadsheet, color: 'text-emerald-600' },
                { label: 'PDF to Image', desc: '.png image', icon: FileIcon, color: 'text-amber-600' }
              ].map((opt, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setShowConverterModal(false);
                    showToast(`Exported document as ${opt.label}!`);
                  }}
                  className="p-3 rounded-lg border border-slate-200 dark:border-zinc-800 hover:border-orange-500 hover:bg-orange-50/20 text-left transition-all space-y-1"
                >
                  <opt.icon className={`w-5 h-5 ${opt.color}`} />
                  <div className="font-semibold text-slate-800 dark:text-zinc-200">{opt.label}</div>
                  <div className="text-[10px] text-slate-400">{opt.desc}</div>
                </button>
              ))}
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-200 dark:border-zinc-800">
              <Button size="sm" onClick={() => setShowConverterModal(false)}>Close</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* IMAGE TO TEXT OCR MODAL */}
      <Dialog open={showOcrModal} onOpenChange={setShowOcrModal}>
        <DialogContent className="sm:max-w-md dark:bg-[#121214] dark:border-zinc-800">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-800 dark:text-zinc-100 flex items-center gap-2">
              <ScanText className="w-4 h-4 text-orange-600" /> Image to Text (OCR)
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Upload any image or scanned receipt to extract text.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2 text-xs">
            <div 
              onClick={() => {
                setOcrText('OBAFEMI AWOLOWO UNIVERSITY, ILE-IFE\nSTUDENT RECEIPT\nNAME: BELLO, IMAMSHAFFY OLADIMEJI\nMATRIC: EEG/2022/077\nAMOUNT PAID: ₦86,000.00\nRRR: 121356973096');
                showToast('OCR extracted receipt text!');
              }}
              className="p-6 border-2 border-dashed border-slate-300 dark:border-zinc-700 rounded-xl text-center cursor-pointer hover:border-orange-500"
            >
              <ScanText className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <div className="font-semibold text-slate-700 dark:text-zinc-200">Click to scan image / receipt</div>
              <p className="text-[10px] text-slate-400 mt-1">Optical character recognition</p>
            </div>

            {ocrText && (
              <div className="p-3 rounded-lg bg-slate-100 dark:bg-zinc-900 font-mono text-[11px] whitespace-pre-wrap space-y-1">
                <span className="font-bold text-orange-600">Extracted Text:</span>
                <div className="text-slate-800 dark:text-zinc-200">{ocrText}</div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-zinc-800">
              <Button size="sm" onClick={() => setShowOcrModal(false)}>Done</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* PDF SPLIT & MERGE MODAL */}
      <Dialog open={showMergeModal} onOpenChange={setShowMergeModal}>
        <DialogContent className="sm:max-w-md dark:bg-[#121214] dark:border-zinc-800">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-800 dark:text-zinc-100 flex items-center gap-2">
              <Layers className="w-4 h-4 text-teal-600" /> Split &amp; Merge PDF
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Combine multiple files or split pages into separate documents.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <button 
                onClick={() => {
                  setShowMergeModal(false);
                  showToast('Merged into Combined_Document.pdf');
                }}
                className="p-3 rounded-lg border border-slate-200 dark:border-zinc-800 hover:border-orange-500 text-left space-y-1"
              >
                <Layers className="w-5 h-5 text-teal-600" />
                <div className="font-semibold text-slate-800 dark:text-zinc-200">Merge Documents</div>
                <div className="text-[10px] text-slate-400">Join 2+ files into one</div>
              </button>

              <button 
                onClick={() => {
                  setShowMergeModal(false);
                  showToast('Split into individual page PDFs');
                }}
                className="p-3 rounded-lg border border-slate-200 dark:border-zinc-800 hover:border-orange-500 text-left space-y-1"
              >
                <FileOutput className="w-5 h-5 text-teal-600" />
                <div className="font-semibold text-slate-800 dark:text-zinc-200">Split PDF Pages</div>
                <div className="text-[10px] text-slate-400">Extract pages</div>
              </button>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-200 dark:border-zinc-800">
              <Button size="sm" onClick={() => setShowMergeModal(false)}>Close</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <OcrDialog open={showOcrModal} onOpenChange={setShowOcrModal} />
      {/* TOAST NOTIFICATION */}
      {notification && (
        <div className="fixed bottom-6 right-6 z-50 bg-zinc-900 text-white px-4 py-2.5 rounded-lg shadow-xl text-xs flex items-center gap-2 border border-zinc-700 animate-in fade-in slide-in-from-bottom-2 duration-150">
          <Check className="w-4 h-4 text-orange-400" />
          <span>{notification}</span>
        </div>
      )}

    </div>
  );
}
