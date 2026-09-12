
'use client';

import { useState, useEffect } from 'react';
import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { RefreshCw, ArrowUpCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * TauriUpdater Component
 * Automatically checks for updates and shows a restart button when ready.
 */
export function TauriUpdater() {
  const { toast } = useToast();
  const [updateReady, setUpdateReady] = useState(false);
  const [newVersion, setNewVersion] = useState('');
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);

  useEffect(() => {
    // Only run in Tauri environment
    if (typeof window === 'undefined' || !(window as any).__TAURI_INTERNALS__) return;

    const checkForUpdates = async () => {
      try {
        const update = await check();
        if (update) {
          setNewVersion(update.version);
          console.log(`Update available: ${update.version}`);
          
          toast({
            title: "Update Available",
            description: `A new version (v${update.version}) is downloading in the background.`,
            duration: 8000,
          });

          setIsDownloading(true);
          let downloaded = 0;
          let totalSize: number | null = null;

          await update.downloadAndInstall((event) => {
            switch (event.event) {
              case 'Started':
                totalSize = event.data.contentLength ?? null;
                console.log(`Started downloading ${totalSize} bytes`);
                break;
              case 'Progress':
                downloaded += event.data.chunkLength;
                if (totalSize) {
                  const percent = Math.round((downloaded / totalSize) * 100);
                  setDownloadProgress(percent);
                }
                break;
              case 'Finished':
                setIsDownloading(false);
                setUpdateReady(true);
                toast({
                  title: "Update Downloaded",
                  description: "Zeneva is ready to update. Click the restart button to apply.",
                  variant: "success",
                });
                break;
            }
          });
        }
      } catch (error) {
        console.error('Failed to check for updates:', error);
      }
    };

    checkForUpdates();
    const interval = setInterval(checkForUpdates, 3600000); // Check every hour
    return () => clearInterval(interval);
  }, [toast]);

  const handleRestart = async () => {
    try {
      await relaunch();
    } catch (err) {
      console.error('Failed to relaunch:', err);
      window.location.reload(); // Fallback
    }
  };

  return (
    <AnimatePresence>
      {(updateReady || isDownloading) && (
        <motion.div 
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -50, opacity: 0 }}
          className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] no-print"
        >
          <div className="bg-primary text-primary-foreground px-4 py-2 rounded-full shadow-2xl flex items-center gap-3 border border-white/20 backdrop-blur-md">
            {isDownloading ? (
               <div className="flex items-center gap-3 min-w-[200px]">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <div className="flex-1 space-y-1">
                    <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider">
                      <span>Downloading v{newVersion}</span>
                      <span>{downloadProgress}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-white/20 rounded-full overflow-hidden">
                      <motion.div 
                        className="h-full bg-white" 
                        initial={{ width: 0 }}
                        animate={{ width: `${downloadProgress}%` }}
                      />
                    </div>
                  </div>
               </div>
            ) : (
              <>
                <ArrowUpCircle className="h-5 w-5 animate-pulse" />
                <span className="text-sm font-medium">New Version v{newVersion} Ready</span>
                <div className="h-4 w-[1px] bg-white/30 mx-1" />
                <Button 
                  size="sm" 
                  variant="secondary" 
                  onClick={handleRestart}
                  className="h-8 rounded-full px-4 font-bold text-xs"
                >
                  <RefreshCw className="mr-2 h-3 w-3" />
                  RESTART NOW
                </Button>
              </>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
