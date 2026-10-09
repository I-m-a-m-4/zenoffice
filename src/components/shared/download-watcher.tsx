'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { 
  FolderArchive, FileText, FileCode, FileSpreadsheet, 
  X, Check, ExternalLink, HardDrive, Download, Sparkles
} from 'lucide-react';

export interface DownloadNotificationItem {
  name: string;
  size?: string;
  path?: string;
  type: 'zip' | 'pdf' | 'docx' | 'xlsx' | 'md' | 'other';
}

export function DownloadWatcher() {
  const router = useRouter();
  const [downloadItem, setDownloadItem] = useState<DownloadNotificationItem | null>(null);
  const [noMoreNotifications, setNoMoreNotifications] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const dismissedFilesRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    // Check if user disabled notifications
    if (typeof window !== 'undefined') {
      const disabled = localStorage.getItem('zenoffice_hide_download_notifications');
      if (disabled === 'true') {
        setNoMoreNotifications(true);
        return;
      }
    }

    // 1. Listen for custom window event (triggered whenever any download or conversion finishes)
    const handleDownloadEvent = (e: any) => {
      if (noMoreNotifications) return;
      const detail = e.detail as DownloadNotificationItem;
      if (detail && detail.name) {
        setDownloadItem(detail);
        setIsVisible(true);
      }
    };

    window.addEventListener('zenoffice-file-downloaded' as any, handleDownloadEvent);

    // 2. Listen to Tauri native downloads watcher event
    let unlistenTauriEvent: (() => void) | null = null;
    (async () => {
      try {
        const { listen } = await import('@tauri-apps/api/event');
        unlistenTauriEvent = await listen<string>('downloaded-file', (event) => {
          if (noMoreNotifications) return;
          const fullPath = event.payload;
          const fileName = fullPath.split(/[/\\]/).pop() || fullPath;
          const lower = fileName.toLowerCase();
          let type: DownloadNotificationItem['type'] = 'other';
          if (lower.endsWith('.zip') || lower.endsWith('.rar') || lower.endsWith('.tar.gz')) type = 'zip';
          else if (lower.endsWith('.pdf')) type = 'pdf';
          else if (lower.endsWith('.docx')) type = 'docx';
          else if (lower.endsWith('.xlsx')) type = 'xlsx';
          else if (lower.endsWith('.md')) type = 'md';

          setDownloadItem({
            name: fileName,
            path: fullPath,
            type
          });
          setIsVisible(true);
        });
      } catch {}
    })();

    // 3. In Tauri desktop mode: poll the Downloads folder for new files
    let intervalId: any = null;
    let isTauriEnv = false;

    async function initTauriWatcher() {
      try {
        const { downloadDir } = await import('@tauri-apps/api/path');
        const { readDir, stat } = await import('@tauri-apps/plugin-fs');
        isTauriEnv = true;
        const downloadsPath = await downloadDir();

        // Check recent files every 4 seconds
        intervalId = setInterval(async () => {
          if (noMoreNotifications) return;
          try {
            const entries = await readDir(downloadsPath);
            const now = Date.now();

            for (const entry of entries) {
              if (entry.name && !entry.isDirectory) {
                const lower = entry.name.toLowerCase();
                const isRelevant = lower.endsWith('.zip') || lower.endsWith('.rar') || lower.endsWith('.tar.gz') || lower.endsWith('.pdf') || lower.endsWith('.docx') || lower.endsWith('.xlsx') || lower.endsWith('.md');
                
                if (isRelevant && !dismissedFilesRef.current.has(entry.name)) {
                  try {
                    const fileStat = await stat(`${downloadsPath}/${entry.name}`);
                    // If file was modified/created in the last 15 seconds
                    const mtime = fileStat.mtime ? new Date(fileStat.mtime).getTime() : 0;
                    if (now - mtime < 15000 && mtime > 0) {
                      dismissedFilesRef.current.add(entry.name);
                      
                      let type: DownloadNotificationItem['type'] = 'other';
                      if (lower.endsWith('.zip') || lower.endsWith('.rar') || lower.endsWith('.tar.gz')) type = 'zip';
                      else if (lower.endsWith('.pdf')) type = 'pdf';
                      else if (lower.endsWith('.docx')) type = 'docx';
                      else if (lower.endsWith('.xlsx')) type = 'xlsx';
                      else if (lower.endsWith('.md')) type = 'md';

                      const sizeMB = fileStat.size ? `${(fileStat.size / (1024 * 1024)).toFixed(1)} MB` : undefined;

                      setDownloadItem({
                        name: entry.name,
                        size: sizeMB,
                        path: `${downloadsPath}/${entry.name}`,
                        type
                      });
                      setIsVisible(true);
                      break;
                    }
                  } catch {}
                }
              }
            }
          } catch {}
        }, 6000);
      } catch {
        // Not in Tauri or plugin not available
      }
    }

    initTauriWatcher();

    return () => {
      window.removeEventListener('zenoffice-file-downloaded' as any, handleDownloadEvent);
      if (unlistenTauriEvent) unlistenTauriEvent();
      if (intervalId) clearInterval(intervalId);
    };
  }, [noMoreNotifications]);

  const handleDismiss = () => {
    setIsVisible(false);
    if (noMoreNotifications) {
      localStorage.setItem('zenoffice_hide_download_notifications', 'true');
    }
  };

  const handleToggleNoMore = (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    setNoMoreNotifications(checked);
    if (checked) {
      localStorage.setItem('zenoffice_hide_download_notifications', 'true');
    } else {
      localStorage.removeItem('zenoffice_hide_download_notifications');
    }
  };

  const handlePrimaryAction = () => {
    if (!downloadItem) return;
    setIsVisible(false);

    if (downloadItem.type === 'zip') {
      router.push(`/tools/decompress?file=${encodeURIComponent(downloadItem.name)}`);
    } else if (downloadItem.type === 'pdf') {
      router.push(`/editor/pdf?doc=${encodeURIComponent(downloadItem.name)}`);
    } else if (downloadItem.type === 'md') {
      router.push(`/editor/markdown?doc=${encodeURIComponent(downloadItem.name)}`);
    } else if (downloadItem.type === 'docx') {
      router.push(`/editor/document?doc=${encodeURIComponent(downloadItem.name)}`);
    } else if (downloadItem.type === 'xlsx') {
      router.push(`/editor/excel?doc=${encodeURIComponent(downloadItem.name)}`);
    } else {
      router.push('/dashboard');
    }
  };

  const handleSecondaryAction = () => {
    if (!downloadItem) return;
    setIsVisible(false);

    if (downloadItem.type === 'zip') {
      // Upload to ZenDrive
      router.push(`/dashboard?filter=all`);
    } else if (downloadItem.type === 'pdf') {
      router.push('/tools?tool=pdf-to-word');
    } else {
      router.push('/dashboard');
    }
  };

  if (!isVisible || !downloadItem) return null;

  return (
    <div 
      className="fixed bottom-6 right-6 z-[9999] w-[340px] bg-[#18181b]/95 dark:bg-[#121214]/95 backdrop-blur-md text-white border border-zinc-700/80 rounded-xl shadow-2xl p-4 transition-all animate-in slide-in-from-bottom-5 duration-300 font-sans select-none"
      style={{ boxShadow: '0 20px 40px rgba(0,0,0,0.45)' }}
    >
      {/* HEADER: App Logo + Title + Close */}
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center text-white text-[10px] font-bold">
            Z
          </div>
          <span className="text-xs font-semibold text-zinc-300 tracking-wide">
            ZenOffice
          </span>
        </div>

        <button 
          onClick={handleDismiss}
          className="text-zinc-400 hover:text-white p-0.5 rounded transition-colors"
          title="Close notification"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* TITLE */}
      <h4 className="text-sm font-bold text-white mb-2 flex items-center gap-1.5">
        <span>File Downloaded</span>
      </h4>

      {/* FILE INFO */}
      <div className="bg-zinc-800/60 rounded-lg p-2.5 mb-3 flex items-center gap-2.5 border border-zinc-700/50">
        <div className="w-8 h-8 rounded-lg bg-orange-600/20 text-orange-400 flex items-center justify-center shrink-0">
          {downloadItem.type === 'zip' ? (
            <FolderArchive className="w-4 h-4 text-amber-400" />
          ) : downloadItem.type === 'pdf' ? (
            <FileText className="w-4 h-4 text-rose-400" />
          ) : downloadItem.type === 'md' ? (
            <FileCode className="w-4 h-4 text-orange-400" />
          ) : downloadItem.type === 'xlsx' ? (
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
          ) : (
            <FileText className="w-4 h-4 text-blue-400" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="text-xs font-medium text-zinc-100 truncate font-mono">
            {downloadItem.name}
          </div>
          {downloadItem.size && (
            <div className="text-[10px] text-zinc-400 mt-0.5">
              {downloadItem.size}
            </div>
          )}
        </div>
      </div>

      {/* ACTION BUTTONS (WPS Style) */}
      <div className="flex items-center gap-2 mb-3">
        <button
          onClick={handlePrimaryAction}
          className="flex-1 bg-[#0284c7] hover:bg-[#0369a1] text-white text-xs font-semibold py-2 px-3 rounded-lg shadow-sm transition-all text-center"
        >
          {downloadItem.type === 'zip'
            ? 'One-click decompression'
            : downloadItem.type === 'pdf'
            ? 'Open in PDF Suite'
            : downloadItem.type === 'md'
            ? 'Open in Markdown Studio'
            : 'Open with ZenOffice'}
        </button>

        <button
          onClick={handleSecondaryAction}
          className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium py-2 px-3 rounded-lg border border-zinc-700 transition-colors text-center shrink-0"
        >
          {downloadItem.type === 'zip' ? 'Upload to ZenDrive' : 'Dismiss'}
        </button>
      </div>

      {/* FOOTER CHECKBOX */}
      <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between text-[11px] text-zinc-400">
        <label className="flex items-center gap-1.5 cursor-pointer hover:text-zinc-300">
          <input 
            type="checkbox"
            checked={noMoreNotifications}
            onChange={handleToggleNoMore}
            className="w-3.5 h-3.5 rounded border-zinc-600 bg-zinc-800 text-orange-600 focus:ring-0 cursor-pointer accent-orange-600"
          />
          <span>No more new Download file notifications</span>
        </label>
      </div>
    </div>
  );
}

// Global helper to trigger download notification programmatically
export function notifyFileDownloaded(item: DownloadNotificationItem) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('zenoffice-file-downloaded', { detail: item }));
  }
}
