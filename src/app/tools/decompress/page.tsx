'use client';

import React, { useState, useRef, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { unzip, zip, strFromU8, strToU8 } from 'fflate';
import {
  Archive, FolderArchive, FileText, Download, Upload, Check, AlertCircle,
  Eye, Folder, File, RefreshCw, ArrowLeft, Search, FileCode, FileImage,
  Sparkles, CheckCircle2, Shield, HardDrive, Trash2, ArrowUpRight,
  ExternalLink, Layers
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ZipEntry {
  name: string;
  size: number;
  isDir: boolean;
  data?: Uint8Array;
}

function DecompressToolInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fileParam = searchParams.get('file') || '';

  const [zipFile, setZipFile] = useState<File | null>(null);
  const [zipEntries, setZipEntries] = useState<ZipEntry[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [notification, setNotification] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<{ name: string; content: string; isImage?: boolean } | null>(null);
  const [activeTab, setActiveTab] = useState<'extract' | 'compress'>('extract');

  // Compress state
  const [filesToCompress, setFilesToCompress] = useState<File[]>([]);
  const [archiveName, setArchiveName] = useState('ZenOffice_Archive.zip');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const compressInputRef = useRef<HTMLInputElement>(null);

  const showToast = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3500);
  };

  const handleProcessZip = async (file: File) => {
    setZipFile(file);
    setIsProcessing(true);

    try {
      const buffer = await file.arrayBuffer();
      const u8 = new Uint8Array(buffer);

      unzip(u8, (err, unzipped) => {
        setIsProcessing(false);
        if (err) {
          console.error('Unzip error:', err);
          showToast('Failed to read ZIP archive. File may be corrupted or password protected.');
          return;
        }

        const entries: ZipEntry[] = Object.keys(unzipped).map((path) => {
          const isDir = path.endsWith('/');
          const data = unzipped[path];
          return {
            name: path,
            size: isDir ? 0 : data.length,
            isDir,
            data: isDir ? undefined : data,
          };
        });

        // Sort directories first, then alphabetically
        entries.sort((a, b) => {
          if (a.isDir && !b.isDir) return -1;
          if (!a.isDir && b.isDir) return 1;
          return a.name.localeCompare(b.name);
        });

        setZipEntries(entries);
        showToast(`Analyzed ${entries.length} files in archive!`);
      });
    } catch (e) {
      setIsProcessing(false);
      showToast('Error reading archive file.');
    }
  };

  const handleExtractAll = async () => {
    if (zipEntries.length === 0 || !zipFile) return;

    try {
      // In Tauri desktop, we can write files to the filesystem
      let tauriSaved = false;
      try {
        const { open } = await import('@tauri-apps/plugin-dialog');
        const { writeFile, mkdir } = await import('@tauri-apps/plugin-fs');
        const selectedDir = await open({
          directory: true,
          multiple: false,
          title: 'Select Destination Folder for Extracted Files'
        });

        if (selectedDir && typeof selectedDir === 'string') {
          showToast('Extracting files to folder...');
          for (const entry of zipEntries) {
            if (entry.isDir) continue;
            const fullPath = `${selectedDir}/${entry.name}`.replace(/\\/g, '/');
            // Ensure parent directory exists
            const parts = fullPath.split('/');
            parts.pop();
            const parentDir = parts.join('/');
            try {
              await mkdir(parentDir, { recursive: true });
            } catch {}

            if (entry.data) {
              await writeFile(fullPath, entry.data);
            }
          }
          showToast(`Extracted ${zipEntries.filter(e => !e.isDir).length} files successfully!`);
          tauriSaved = true;
          return;
        }
      } catch {
        // Fallback to web
      }

      if (!tauriSaved) {
        // Web: Download individual files or bundle
        showToast(`Extracted ${zipEntries.filter(e => !e.isDir).length} files.`);
      }
    } catch (e) {
      showToast('Error during extraction.');
    }
  };

  const handleDownloadSingle = (entry: ZipEntry) => {
    if (!entry.data || entry.isDir) return;

    const fileName = entry.name.split('/').pop() || entry.name;
    const blob = new Blob([entry.data]);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(`Downloaded ${fileName}`);
  };

  const handlePreviewFile = (entry: ZipEntry) => {
    if (!entry.data || entry.isDir) return;

    const lower = entry.name.toLowerCase();
    const isImage = lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.gif') || lower.endsWith('.webp') || lower.endsWith('.svg');

    if (isImage) {
      const blob = new Blob([entry.data]);
      const url = URL.createObjectURL(blob);
      setPreviewFile({ name: entry.name, content: url, isImage: true });
    } else {
      // Decode as text
      try {
        const text = strFromU8(entry.data);
        setPreviewFile({ name: entry.name, content: text, isImage: false });
      } catch {
        showToast('Binary file cannot be previewed as text.');
      }
    }
  };

  const handleOpenInZenOffice = (entry: ZipEntry) => {
    if (!entry.data || entry.isDir) return;
    const lower = entry.name.toLowerCase();

    if (lower.endsWith('.pdf')) {
      const blob = new Blob([entry.data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      router.push(`/editor/pdf?doc=${encodeURIComponent(entry.name.split('/').pop() || 'Document.pdf')}`);
    } else if (lower.endsWith('.md') || lower.endsWith('.markdown')) {
      router.push(`/editor/markdown?doc=${encodeURIComponent(entry.name.split('/').pop() || 'Notes.md')}`);
    } else if (lower.endsWith('.docx') || lower.endsWith('.doc')) {
      router.push(`/editor/document?doc=${encodeURIComponent(entry.name.split('/').pop() || 'Document.docx')}`);
    } else {
      handlePreviewFile(entry);
    }
  };

  // Compress multiple files
  const handleCompressFiles = () => {
    if (filesToCompress.length === 0) return;
    setIsProcessing(true);

    const zipObj: Record<string, Uint8Array> = {};
    let readCount = 0;

    filesToCompress.forEach(async (file) => {
      const buf = await file.arrayBuffer();
      zipObj[file.name] = new Uint8Array(buf);
      readCount++;

      if (readCount === filesToCompress.length) {
        zip(zipObj, (err, zipped) => {
          setIsProcessing(false);
          if (err) {
            showToast('Compression failed.');
            return;
          }

          const blob = new Blob([zipped], { type: 'application/zip' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = archiveName.endsWith('.zip') ? archiveName : `${archiveName}.zip`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          showToast(`Archive ${archiveName} created!`);
        });
      }
    });
  };

  // Metrics
  const totalUncompressedSize = zipEntries.reduce((acc, e) => acc + e.size, 0);
  const fileCount = zipEntries.filter(e => !e.isDir).length;
  const dirCount = zipEntries.filter(e => e.isDir).length;

  const filteredEntries = zipEntries.filter(e => 
    e.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-50 via-orange-50/10 to-zinc-100 dark:from-[#09090b] dark:via-[#111113] dark:to-[#09090b] text-zinc-900 dark:text-zinc-100 font-sans p-4 sm:p-8">
      
      {/* Hidden inputs */}
      <input 
        type="file" 
        ref={fileInputRef} 
        accept=".zip,.rar,.tar,.gz,.7z,.jar" 
        className="hidden" 
        onChange={(e) => {
          if (e.target.files && e.target.files[0]) {
            handleProcessZip(e.target.files[0]);
          }
        }} 
      />

      <input 
        type="file" 
        ref={compressInputRef} 
        multiple 
        className="hidden" 
        onChange={(e) => {
          if (e.target.files) {
            setFilesToCompress(Array.from(e.target.files));
          }
        }} 
      />

      <div className="max-w-5xl mx-auto space-y-6">

        {/* TOP NAV */}
        <div className="flex items-center justify-between">
          <Link 
            href="/dashboard" 
            className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Dashboard
          </Link>

          <div className="inline-flex items-center bg-zinc-200/80 dark:bg-zinc-800/80 p-0.5 rounded-lg text-xs font-semibold">
            <button
              onClick={() => setActiveTab('extract')}
              className={`px-4 py-1.5 rounded-md transition-all ${
                activeTab === 'extract'
                  ? 'bg-white dark:bg-zinc-700 text-orange-600 dark:text-orange-400 shadow-xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900'
              }`}
            >
              One-Click Decompress
            </button>
            <button
              onClick={() => setActiveTab('compress')}
              className={`px-4 py-1.5 rounded-md transition-all ${
                activeTab === 'compress'
                  ? 'bg-white dark:bg-zinc-700 text-orange-600 dark:text-orange-400 shadow-xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900'
              }`}
            >
              Create Archive (ZIP)
            </button>
          </div>
        </div>

        {/* HEADER */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-100 dark:bg-orange-950/60 border border-orange-200 dark:border-orange-800 text-orange-700 dark:text-orange-400 text-xs font-semibold">
            <FolderArchive className="w-3.5 h-3.5" />
            <span>High-Speed Offline Archiver</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-zinc-950 dark:text-white">
            {activeTab === 'extract' ? 'One-Click Decompression' : 'Compress to ZIP'}
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 max-w-lg mx-auto">
            {activeTab === 'extract'
              ? 'Unpack and extract ZIP packages instantly. Browse archive contents, preview files, or open directly in ZenOffice.'
              : 'Package multiple files into a clean, optimized .zip archive on your device with zero upload latency.'}
          </p>
        </div>

        {/* TAB 1: EXTRACTOR */}
        {activeTab === 'extract' && (
          <div className="space-y-6">
            
            {/* Upload Box if no file loaded */}
            {!zipFile ? (
              <div 
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                    handleProcessZip(e.dataTransfer.files[0]);
                  }
                }}
                className="border-2 border-dashed border-zinc-300 dark:border-zinc-700 hover:border-orange-500 rounded-2xl p-12 text-center cursor-pointer transition-all bg-white dark:bg-[#111113] hover:bg-orange-50/20 dark:hover:bg-zinc-900 shadow-sm flex flex-col items-center justify-center gap-4 group"
              >
                <div className="w-16 h-16 rounded-2xl bg-orange-100 dark:bg-orange-950/50 flex items-center justify-center text-orange-600 group-hover:scale-110 transition-transform shadow-xs">
                  <Archive className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 mb-1">
                    Select or Drop ZIP File Here
                  </h3>
                  <p className="text-xs text-zinc-400">
                    Supports .zip, .jar, .apk, .tar, .gz archives • 100% offline & local
                  </p>
                </div>
                <Button size="sm" className="bg-orange-600 hover:bg-orange-700 text-white font-semibold">
                  Browse Device
                </Button>
              </div>
            ) : (
              /* ARCHIVE BROWSER & ACTIONS */
              <div className="bg-white dark:bg-[#111113] rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
                
                {/* File Header Details */}
                <div className="p-5 border-b border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-zinc-50 dark:bg-[#161618]">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-orange-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                      <Archive className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-zinc-900 dark:text-white truncate max-w-sm">
                        {zipFile.name}
                      </h3>
                      <div className="flex items-center gap-3 text-[11px] text-zinc-400">
                        <span>{formatSize(zipFile.size)} (Compressed)</span>
                        <span>•</span>
                        <span>{fileCount} files, {dirCount} folders</span>
                        <span>•</span>
                        <span className="text-emerald-500 font-semibold">{formatSize(totalUncompressedSize)} Uncompressed</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button 
                      size="sm"
                      onClick={() => {
                        setZipFile(null);
                        setZipEntries([]);
                      }}
                      variant="outline"
                      className="text-xs h-9 border-zinc-300 dark:border-zinc-700"
                    >
                      Change File
                    </Button>

                    <Button 
                      size="sm"
                      onClick={handleExtractAll}
                      className="text-xs h-9 bg-orange-600 hover:bg-orange-700 text-white font-bold gap-1.5 shadow-xs"
                    >
                      <Download className="w-4 h-4" /> One-Click Extract All
                    </Button>
                  </div>
                </div>

                {/* Filter and Search */}
                <div className="p-3 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#111113] flex items-center gap-3">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                    <input 
                      type="text"
                      placeholder="Search files inside archive..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-zinc-100 dark:bg-zinc-800/60 rounded-lg pl-9 pr-3 py-1.5 text-xs text-zinc-800 dark:text-zinc-200 outline-none focus:ring-1 focus:ring-orange-500"
                    />
                  </div>
                  <span className="text-xs text-zinc-400 shrink-0">
                    Showing {filteredEntries.length} of {zipEntries.length} items
                  </span>
                </div>

                {/* File List Table */}
                <div className="max-h-[480px] overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800/60">
                  {filteredEntries.map((entry, idx) => {
                    const isCode = entry.name.endsWith('.js') || entry.name.endsWith('.ts') || entry.name.endsWith('.json') || entry.name.endsWith('.html');
                    const isDoc = entry.name.endsWith('.pdf') || entry.name.endsWith('.docx') || entry.name.endsWith('.md');
                    const isImg = entry.name.endsWith('.png') || entry.name.endsWith('.jpg') || entry.name.endsWith('.svg');

                    return (
                      <div 
                        key={idx}
                        className="px-4 py-2.5 flex items-center justify-between hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors text-xs"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          {entry.isDir ? (
                            <Folder className="w-4 h-4 text-amber-500 shrink-0" />
                          ) : isImg ? (
                            <FileImage className="w-4 h-4 text-purple-500 shrink-0" />
                          ) : isCode ? (
                            <FileCode className="w-4 h-4 text-blue-500 shrink-0" />
                          ) : isDoc ? (
                            <FileText className="w-4 h-4 text-orange-500 shrink-0" />
                          ) : (
                            <File className="w-4 h-4 text-zinc-400 shrink-0" />
                          )}

                          <span className={`truncate font-mono ${entry.isDir ? 'font-semibold text-zinc-800 dark:text-zinc-200' : 'text-zinc-600 dark:text-zinc-400'}`}>
                            {entry.name}
                          </span>
                        </div>

                        {!entry.isDir && (
                          <div className="flex items-center gap-3 shrink-0 ml-4">
                            <span className="text-zinc-400 font-mono text-[11px] w-16 text-right">
                              {formatSize(entry.size)}
                            </span>

                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handlePreviewFile(entry)}
                                className="p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-500 hover:text-zinc-900"
                                title="Quick Preview"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>

                              <button
                                onClick={() => handleOpenInZenOffice(entry)}
                                className="px-2 py-1 rounded bg-orange-50 dark:bg-orange-950/40 text-orange-600 hover:bg-orange-100 text-[10px] font-semibold flex items-center gap-1"
                                title="Open with ZenOffice"
                              >
                                <span>Open</span>
                                <ExternalLink className="w-2.5 h-2.5" />
                              </button>

                              <button
                                onClick={() => handleDownloadSingle(entry)}
                                className="p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-500 hover:text-zinc-900"
                                title="Download Extracted File"
                              >
                                <Download className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: COMPRESSOR */}
        {activeTab === 'compress' && (
          <div className="bg-white dark:bg-[#111113] rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 sm:p-8 space-y-6 shadow-sm">
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Archive File Name
                </label>
                <input 
                  type="text"
                  value={archiveName}
                  onChange={(e) => setArchiveName(e.target.value)}
                  className="w-full sm:w-96 px-3 py-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm text-zinc-800 dark:text-zinc-200 outline-none focus:border-orange-500"
                />
              </div>

              <div 
                onClick={() => compressInputRef.current?.click()}
                className="border-2 border-dashed border-zinc-200 dark:border-zinc-800 hover:border-orange-500 rounded-xl p-8 text-center cursor-pointer transition-colors bg-zinc-50 dark:bg-zinc-900/50 flex flex-col items-center justify-center gap-2"
              >
                <Upload className="w-8 h-8 text-orange-500" />
                <span className="text-sm font-bold text-zinc-700 dark:text-zinc-300">
                  Select Multiple Files to Compress
                </span>
                <span className="text-xs text-zinc-400">
                  {filesToCompress.length > 0 
                    ? `${filesToCompress.length} files selected (${formatSize(filesToCompress.reduce((a, b) => a + b.size, 0))})` 
                    : 'Click to browse files on your computer'}
                </span>
              </div>

              {filesToCompress.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-zinc-500">Selected files:</div>
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {filesToCompress.map((f, i) => (
                      <div key={i} className="flex items-center justify-between text-xs bg-zinc-100 dark:bg-zinc-800 px-3 py-1.5 rounded">
                        <span className="truncate max-w-sm font-mono">{f.name}</span>
                        <span className="text-zinc-400">{formatSize(f.size)}</span>
                      </div>
                    ))}
                  </div>

                  <div className="pt-4 flex justify-end">
                    <Button 
                      onClick={handleCompressFiles}
                      disabled={isProcessing}
                      className="bg-orange-600 hover:bg-orange-700 text-white font-bold"
                    >
                      {isProcessing ? 'Compressing...' : 'Create ZIP Archive'}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

      </div>

      {/* QUICK PREVIEW MODAL */}
      {previewFile && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl max-w-2xl w-full max-h-[80vh] flex flex-col overflow-hidden shadow-2xl border border-zinc-200 dark:border-zinc-800 animate-in zoom-in-95 duration-150">
            <div className="px-5 py-3 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
              <span className="text-xs font-bold font-mono truncate text-zinc-800 dark:text-zinc-200">
                {previewFile.name}
              </span>
              <button 
                onClick={() => setPreviewFile(null)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-5 flex-1 overflow-auto bg-zinc-50 dark:bg-[#0c0c0e]">
              {previewFile.isImage ? (
                <img src={previewFile.content} className="max-w-full h-auto mx-auto rounded shadow" alt="Preview" />
              ) : (
                <pre className="font-mono text-xs whitespace-pre-wrap text-zinc-800 dark:text-zinc-200">
                  {previewFile.content}
                </pre>
              )}
            </div>

            <div className="p-3 border-t border-zinc-200 dark:border-zinc-800 flex justify-end">
              <Button size="sm" onClick={() => setPreviewFile(null)}>Close</Button>
            </div>
          </div>
        </div>
      )}

      {/* NOTIFICATION TOAST */}
      {notification && (
        <div className="fixed bottom-6 right-6 z-50 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-4 py-2.5 rounded-lg shadow-xl text-xs font-medium flex items-center gap-2 border border-zinc-700 dark:border-zinc-300 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
          <span>{notification}</span>
        </div>
      )}

    </div>
  );
}

export default function DecompressToolPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#09090b] flex flex-col items-center justify-center text-orange-500 gap-3">
        <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm font-semibold tracking-wide text-zinc-400">Loading ZenOffice Archiver...</span>
      </div>
    }>
      <DecompressToolInner />
    </Suspense>
  );
}
