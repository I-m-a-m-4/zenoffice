'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { ThemeProvider } from '@/components/theme-provider';
import { Button } from '@/components/ui/button';
import { 
  Home, FolderOpen, Clock, Star, Share2, 
  Cloud, HardDrive, Download, Search, 
  Plus, Settings, HelpCircle, FileText,
  FileSpreadsheet, FileIcon, Sparkles,
  Sun, Moon, Bell, Monitor, Minus, Square, X,
  RefreshCw, Trash2, Check, ExternalLink,
  ShieldCheck, ArrowRight, Laptop, User, LogOut
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { getAuth, signOut } from 'firebase/auth';
import { ZenFileSyncService } from '@/lib/firebase-sync';

function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  
  // UI Dialog states
  const [showSettingsModal, setShowSettingsModal] = React.useState(false);
  const [showNewDocModal, setShowNewDocModal] = React.useState(false);
  const [showConnectCloudModal, setShowConnectCloudModal] = React.useState<string | null>(null);
  
  // New document form
  const [newDocName, setNewDocName] = React.useState('');
  const [newDocType, setNewDocType] = React.useState<'word' | 'excel' | 'pdf'>('word');
  
  // Top bar open tabs
  const [openTabs, setOpenTabs] = React.useState<Array<{ id: string; name: string; path: string; type: string }>>([]);
  const [storageDisplay, setStorageDisplay] = React.useState({ formatted: '0 KB', percent: 1 });
  const [notification, setNotification] = React.useState<string | null>(null);
  const [searchQuery, setSearchQuery] = React.useState('');

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const showToast = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3500);
  };

  const updateStorage = () => {
    const stats = ZenFileSyncService.getTotalStorageUsage();
    setStorageDisplay(stats);
  };

  React.useEffect(() => {
    setMounted(true);
    updateStorage();
  }, [pathname]);

  const handleLogout = async () => {
    try {
      await signOut(getAuth());
      router.push('/login');
    } catch {
      router.push('/login');
    }
  };

  const handleToggleFullscreen = () => {
    if (typeof document === 'undefined') return;
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      showToast('Entered Fullscreen Mode');
    } else {
      document.exitFullscreen().catch(() => {});
      showToast('Exited Fullscreen Mode');
    }
  };

  const closeTab = (e: React.MouseEvent, tabId: string) => {
    e.stopPropagation();
    e.preventDefault();
    setOpenTabs(prev => prev.filter(t => t.id !== tabId));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    const newDoc = await ZenFileSyncService.addUploadedFile(file);
    updateStorage();
    showToast(`Uploaded ${newDoc.name} [Stored Locally]`);
    
    const targetPath = newDoc.type === 'pdf' ? `/editor/pdf?doc=${encodeURIComponent(newDoc.name)}` : newDoc.type === 'excel' ? `/editor/excel?doc=${encodeURIComponent(newDoc.name)}` : `/editor/document?doc=${encodeURIComponent(newDoc.name)}`;
    setOpenTabs(prev => [...prev.filter(t => t.name !== newDoc.name), { id: newDoc.id, name: newDoc.name, path: targetPath, type: newDoc.type }]);
    router.push(targetPath);
  };

  const handleCreateDocument = () => {
    if (!newDocName.trim()) {
      showToast('Please enter a document name');
      return;
    }
    const doc = ZenFileSyncService.createNewDocument(newDocName.trim(), newDocType);
    setShowNewDocModal(false);
    setNewDocName('');
    updateStorage();
    showToast(`Created ${doc.name}`);

    const targetPath = doc.type === 'pdf' ? `/editor/pdf?doc=${encodeURIComponent(doc.name)}` : doc.type === 'excel' ? `/editor/excel?doc=${encodeURIComponent(doc.name)}` : `/editor/document?doc=${encodeURIComponent(doc.name)}`;
    setOpenTabs(prev => [...prev.filter(t => t.name !== doc.name), { id: doc.id, name: doc.name, path: targetPath, type: doc.type }]);
    router.push(targetPath);
  };

  const handleClearLocalCache = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('zenoffice_user_documents');
      updateStorage();
      setShowSettingsModal(false);
      showToast('Local document storage reset.');
      router.push('/dashboard');
    }
  };

  const isHomeActive = pathname === '/dashboard' || pathname === '/';

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#F5F6F8] dark:bg-[#000000] font-sans text-slate-800 dark:text-zinc-100  transition-colors duration-150">
      
      {/* Global Hidden File Input */}
      <input 
        ref={fileInputRef}
        type="file"
        id="global-layout-file-input"
        onChange={handleFileUpload}
        className="hidden"
        accept=".pdf,.docx,.doc,.xlsx,.xls,.csv,.pptx,.ppt,.txt"
      />

      {/* 1. TOP WINDOW BAR (True Black Dark theme + Orange brand identity) */}
      <header className="h-16 bg-[#F0EDE6] dark:bg-[#121214] border-b border-slate-300 dark:border-zinc-800 flex items-center justify-between px-2 shrink-0  transition-colors">
        
        {/* Left: Brand & Open Document Tabs */}
        <div className="flex items-center gap-1 h-full overflow-x-auto no-scrollbar items-end pt-2">
          {/* Main App Brand Tab */}
          <Link 
            href="/dashboard"
            className={`flex items-center gap-2 px-4 h-11 rounded-t-md text-sm font-semibold border-t border-x cursor-pointer transition-all ${
              isHomeActive 
                ? 'bg-white dark:bg-[#000000] border-slate-300 dark:border-zinc-800 text-slate-900 dark:text-white shadow-xs' 
                : 'bg-transparent border-transparent text-slate-600 dark:text-zinc-400 hover:bg-slate-300/50 dark:hover:bg-zinc-800/60'
            }`}
          >
            {/* Orange Zen Vector Logo */}
            <div className="w-4 h-4 rounded bg-orange-600 flex items-center justify-center text-white shadow-xs">
              <svg width="10" height="10" viewBox="0 0 200 200" fill="none">
                <path d="M44 38C44 29 51 22 60 22H118L156 60V156C156 165 149 172 140 172H60C51 172 44 165 44 156V38Z" fill="#FFFFFF"/>
                <path d="M118 22V50C118 55 122 60 128 60H156L118 22Z" fill="#FDBA74"/>
                <path d="M66 110L134 110L76 138L134 138" stroke="#EA580C" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <span className="font-bold tracking-tight text-orange-600 dark:text-orange-500">ZenOffice</span>
          </Link>

          {/* Open Document Tabs */}
          {openTabs.map((tab) => {
            const isCurrent = pathname.startsWith(tab.path);
            return (
              <div 
                key={tab.id}
                onClick={() => router.push(tab.path)}
                className={`flex items-center gap-2 px-4 h-11 rounded-t-md text-sm font-medium border-t border-x cursor-pointer transition-all ${
                  isCurrent 
                    ? 'bg-white dark:bg-[#000000] border-slate-300 dark:border-zinc-800 text-slate-900 dark:text-white font-semibold shadow-xs' 
                    : 'bg-transparent border-transparent text-slate-600 dark:text-zinc-400 hover:bg-slate-300/50 dark:hover:bg-zinc-800/60'
                }`}
              >
                <div className={`w-4 h-4 rounded-xs flex items-center justify-center text-[10px] font-bold text-white ${
                  tab.type === 'pdf' ? 'bg-rose-600' : tab.type === 'excel' ? 'bg-emerald-600' : 'bg-orange-600'
                }`}>
                  {tab.type === 'pdf' ? 'P' : tab.type === 'excel' ? 'X' : 'W'}
                </div>
                <span className="max-w-[150px] truncate">{tab.name}</span>
                <button 
                  onClick={(e) => closeTab(e, tab.id)}
                  className="hover:bg-slate-300 dark:hover:bg-zinc-800 rounded p-0.5 text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            );
          })}

          {/* Plus button to open new tab */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button 
                className="w-8 h-8 rounded flex items-center justify-center text-slate-500 dark:text-zinc-400 hover:bg-slate-300/60 dark:hover:bg-zinc-800 hover:text-slate-900 dark:hover:text-white transition-colors ml-1 mb-1"
                title="New Document Tab"
              >
                <Plus className="w-5 h-5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48 dark:bg-[#18181b] dark:border-zinc-800 text-xs">
              <DropdownMenuLabel>Create Document</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => { setNewDocType('word'); setShowNewDocModal(true); }}>
                <FileText className="w-3.5 h-3.5 text-orange-600 mr-2" /> Word Document
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { setNewDocType('excel'); setShowNewDocModal(true); }}>
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 mr-2" /> Excel Spreadsheet
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push('/editor/pdf')}>
                <FileIcon className="w-3.5 h-3.5 text-rose-600 mr-2" /> PDF Viewer &amp; Sign
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
                <FolderOpen className="w-3.5 h-3.5 text-slate-500 mr-2" /> Open Local File...
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Center: Search Bar */}
        <div className="hidden md:flex items-center justify-center flex-1 max-w-2xl mx-4">
          <div className="relative w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-zinc-500" />
            <input 
              type="text" 
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                router.push(`/dashboard?q=${encodeURIComponent(e.target.value)}`);
              }}
              placeholder="Search for documents" 
              className="w-full h-10 pl-11 pr-4 rounded-full bg-white dark:bg-[#18181b] border border-slate-200 dark:border-zinc-800 text-sm text-slate-800 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all shadow-sm"
            />
          </div>
        </div>

        {/* Right: Theme Switcher, Notifications, Settings, Profile, Window Controls */}
        <div className="flex items-center gap-1.5 shrink-0">
          
          {/* Theme Toggle (Dark / Light) with Pure Black Dark */}
          <button 
            onClick={() => {
              const next = resolvedTheme === 'dark' ? 'light' : 'dark';
              setTheme(next);
              showToast(`Theme: ${next === 'dark' ? 'True Black Dark' : 'Clean Light'}`);
            }}
            className="w-9 h-9 flex items-center justify-center rounded-md hover:bg-slate-300/60 dark:hover:bg-zinc-800 text-slate-600 dark:text-zinc-300 transition-colors"
            title={`Switch to ${resolvedTheme === 'dark' ? 'Light' : 'Black Dark'} Theme`}
          >
            {mounted && resolvedTheme === 'dark' ? (
              <Sun className="w-5 h-5 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-slate-600" />
            )}
          </button>

          {/* Notifications Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button 
                className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-slate-300/60 dark:hover:bg-zinc-800 text-slate-600 dark:text-zinc-300 transition-colors relative"
                title="Notifications"
              >
                <Bell className="w-3.5 h-3.5" />
                <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-orange-600 rounded-full" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72 dark:bg-[#18181b] dark:border-zinc-800 text-xs p-2">
              <DropdownMenuLabel className="flex items-center justify-between pb-1">
                <span>System Status</span>
                <span className="text-[10px] text-orange-600 font-normal">Online</span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <div className="space-y-2 py-1">
                <div className="p-2 rounded bg-slate-50 dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800 space-y-1">
                  <div className="font-semibold text-slate-800 dark:text-zinc-200">Local-First Storage Active</div>
                  <p className="text-[11px] text-slate-500 dark:text-zinc-400">Documents are saved locally on your device with zero cloud bloat.</p>
                </div>
                <div className="p-2 rounded bg-slate-50 dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800 space-y-1">
                  <div className="font-semibold text-slate-800 dark:text-zinc-200">Firebase Cloud Ready</div>
                  <p className="text-[11px] text-slate-500 dark:text-zinc-400">Turn on Drive Sync anytime to backup documents to Firebase.</p>
                </div>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Settings Button */}
          <button 
            onClick={() => setShowSettingsModal(true)}
            className="w-9 h-9 flex items-center justify-center rounded-md hover:bg-slate-300/60 dark:hover:bg-zinc-800 text-slate-600 dark:text-zinc-300 transition-colors"
            title="Settings"
          >
            <Settings className="w-5 h-5" />
          </button>

          {/* User Profile Avatar Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-1.5 pl-2 pr-2 border-l border-slate-300 dark:border-zinc-800 outline-none h-8">
                <Avatar className="h-8 w-8 border border-slate-300 dark:border-zinc-700">
                  <AvatarImage src="" />
                  <AvatarFallback className="bg-orange-600 text-white text-xs font-bold">
                    BI
                  </AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 dark:bg-[#18181b] dark:border-zinc-800 text-xs">
              <DropdownMenuLabel>
                <div className="font-semibold">Bello Imamshaffy</div>
                <div className="text-[10px] text-slate-500 font-normal">ZenOffice Desktop User</div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setShowSettingsModal(true)}>
                <Settings className="w-3.5 h-3.5 mr-2" /> Preferences
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-rose-600">
                <LogOut className="w-3.5 h-3.5 mr-2" /> Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Window controls */}
          <div className="hidden lg:flex items-center gap-1 pl-1">
            <button 
              onClick={() => showToast('ZenOffice running in local background')}
              className="w-6 h-6 flex items-center justify-center hover:bg-slate-300/60 dark:hover:bg-zinc-800 rounded text-slate-500"
              title="Minimize"
            >
              <Minus className="w-3 h-3" />
            </button>
            <button 
              onClick={handleToggleFullscreen}
              className="w-6 h-6 flex items-center justify-center hover:bg-slate-300/60 dark:hover:bg-zinc-800 rounded text-slate-500"
              title="Maximize / Toggle Fullscreen"
            >
              <Square className="w-2.5 h-2.5" />
            </button>
            <button 
              onClick={() => router.push('/dashboard')}
              className="w-6 h-6 flex items-center justify-center hover:bg-rose-500 hover:text-white rounded text-slate-500"
              title="Close to Home"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>
      </header>

      {/* 2. DUAL SIDEBAR + MAIN WORKSPACE (Pure Black Dark Theme) */}
      <div className="flex flex-1 overflow-hidden">
        
        {/* 2A. LEFTMOST SLIM APP SWITCHER RAIL */}
        <aside className="w-24 bg-[#F0EDE6] dark:bg-[#121214] border-r border-slate-300 dark:border-zinc-800 flex flex-col items-center py-4 gap-4 shrink-0 ">
          <Link 
            href="/dashboard"
            className={`w-14 h-14 rounded-2xl flex flex-col items-center justify-center text-xs font-semibold transition-all ${
              isHomeActive 
                ? 'bg-orange-600 text-white shadow-md' 
                : 'text-slate-600 dark:text-zinc-400 hover:bg-orange-200 dark:hover:bg-zinc-800'
            }`}
            title="Home"
          >
            <Home className="w-6 h-6 mb-1" />
            <span>Home</span>
          </Link>

          <Link 
            href="/editor/document"
            className="w-14 h-14 rounded-2xl flex flex-col items-center justify-center text-xs font-semibold text-slate-600 hover:text-orange-600 dark:text-zinc-400 hover:bg-orange-200 dark:hover:bg-zinc-800 transition-all"
            title="Zen Document (Word)"
          >
            <FileText className="w-6 h-6 mb-1 text-orange-600 dark:text-orange-500" />
            <span>Docs</span>
          </Link>

          <Link 
            href="/editor/excel"
            className="w-14 h-14 rounded-2xl flex flex-col items-center justify-center text-xs font-semibold text-slate-600 hover:text-emerald-600 dark:text-zinc-400 hover:bg-emerald-100 dark:hover:bg-zinc-800 transition-all"
            title="Zen Spreadsheet (Excel)"
          >
            <FileSpreadsheet className="w-6 h-6 mb-1 text-emerald-600 dark:text-emerald-500" />
            <span>Sheets</span>
          </Link>

          <Link 
            href="/editor/pdf"
            className="w-14 h-14 rounded-2xl flex flex-col items-center justify-center text-xs font-semibold text-slate-600 hover:text-rose-600 dark:text-zinc-400 hover:bg-rose-100 dark:hover:bg-zinc-800 transition-all"
            title="Zen PDF Suite"
          >
            <FileIcon className="w-6 h-6 mb-1 text-rose-600 dark:text-rose-500" />
            <span>PDF</span>
          </Link>

          <Link 
            href="/tools"
            className={`w-14 h-14 rounded-2xl flex flex-col items-center justify-center text-xs font-semibold transition-all ${
              pathname.startsWith('/tools')
                ? 'bg-purple-600 text-white shadow-md' 
                : 'text-slate-600 dark:text-zinc-400 hover:bg-purple-200 dark:hover:bg-zinc-800 hover:text-purple-600'
            }`}
            title="PDF Tools"
          >
            <Settings className={`w-6 h-6 mb-1 ${pathname.startsWith('/tools') ? '' : 'text-purple-600 dark:text-purple-500'}`} />
            <span>Tools</span>
          </Link>
        </aside>

        {/* 2B. SECONDARY FILE EXPLORER SUB-SIDEBAR */}
        <aside className="w-64 bg-[#F0EDE6] dark:bg-[#0c0c0e] border-r border-slate-300 dark:border-zinc-800 flex flex-col justify-between shrink-0  overflow-y-auto">
          <div className="p-3 space-y-4">
            
            {/* Primary Action Buttons (Orange + Open) */}
            <div className="space-y-2">
              <Button 
                onClick={() => setShowNewDocModal(true)}
                className="w-full bg-orange-600 hover:bg-orange-700 text-white h-10 text-sm font-semibold shadow-sm justify-center gap-1.5 rounded-lg"
              >
                <Plus className="w-4 h-4" />
                <span>New Document</span>
              </Button>

              <button 
                onClick={() => fileInputRef.current?.click()}
                className="w-full border border-slate-300 dark:border-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-900 text-slate-700 dark:text-zinc-200 h-9 text-sm font-medium flex items-center justify-center gap-1.5 rounded-lg cursor-pointer transition-colors shadow-sm bg-white dark:bg-[#121214]"
              >
                <FolderOpen className="w-4 h-4 text-slate-500 dark:text-zinc-400" />
                <span>Open File</span>
              </button>
            </div>

            {/* Quick Navigation Tree */}
            <nav className="space-y-0.5">
              <button 
                onClick={() => router.push('/dashboard?view=recent')}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-semibold text-slate-700 dark:text-zinc-200 hover:bg-slate-200/60 dark:hover:bg-zinc-900 transition-colors"
              >
                <Clock className="w-3.5 h-3.5 text-orange-600" />
                <span>Recent</span>
              </button>
              <button 
                onClick={() => router.push('/dashboard?view=starred')}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-medium text-slate-600 dark:text-zinc-400 hover:bg-slate-200/60 dark:hover:bg-zinc-900 transition-colors"
              >
                <Star className="w-3.5 h-3.5 text-amber-500" />
                <span>Starred</span>
              </button>
            </nav>

            {/* Cloud Storage Section */}
            <div className="pt-2 border-t border-slate-200 dark:border-zinc-850">
              <div className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider px-2.5 mb-1">
                <span>Cloud</span>
              </div>
              <div className="space-y-0.5">
                <button
                  onClick={() => router.push('/dashboard?view=cloud')}
                  className="w-full flex items-center gap-2 px-2.5 py-1 rounded-md text-xs text-orange-600 dark:text-orange-400 font-medium hover:bg-orange-50/50 dark:hover:bg-zinc-900 transition-colors"
                >
                  <Cloud className="w-3.5 h-3.5 opacity-90 text-orange-600" />
                  <span>ZenDrive</span>
                </button>

                <button
                  onClick={() => router.push('/dashboard?view=trash')}
                  className="w-full flex items-center gap-2 px-2.5 py-1 rounded-md text-xs text-slate-600 dark:text-zinc-400 hover:bg-slate-200/50 dark:hover:bg-zinc-900 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5 opacity-70 text-rose-500" />
                  <span>Recycle Bin</span>
                </button>
              </div>
            </div>

            {/* Local Storage Section */}
            <div className="pt-2 border-t border-slate-200 dark:border-zinc-850">
              <div className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider px-2.5 mb-1">
                <span>Local Folders</span>
              </div>
              <div className="space-y-0.5">
                {[
                  { label: 'Downloads', loc: 'Downloads', icon: Download },
                  { label: 'Documents', loc: 'Documents', icon: FileText },
                  { label: 'Desktop', loc: 'Desktop', icon: Monitor },
                ].map((item) => (
                  <button
                    key={item.loc}
                    onClick={() => router.push(`/dashboard?location=${encodeURIComponent(item.loc)}`)}
                    className="w-full flex items-center gap-2 px-2.5 py-1 rounded-md text-xs text-slate-600 dark:text-zinc-400 hover:bg-slate-200/50 dark:hover:bg-zinc-900 transition-colors"
                  >
                    <item.icon className="w-3.5 h-3.5 opacity-70" />
                    <span>{item.label}</span>
                  </button>
                ))}

                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full flex items-center gap-2 px-2.5 py-1 rounded-md text-xs text-slate-600 dark:text-zinc-400 hover:bg-slate-200/50 dark:hover:bg-zinc-900 transition-colors"
                >
                  <FolderOpen className="w-3.5 h-3.5 opacity-70" />
                  <span>Browse Device...</span>
                </button>
              </div>
            </div>

          </div>

          <div className="mt-auto px-3 pb-3">
            <Link href="/billing" className="relative group block w-full">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-orange-500 via-rose-500 to-amber-500 rounded-lg blur opacity-60 group-hover:opacity-100 transition duration-1000 group-hover:duration-200 animate-pulse"></div>
              <button className="relative w-full flex items-center justify-between px-3 py-2 bg-white dark:bg-[#121214] border border-slate-200 dark:border-zinc-800 rounded-lg shadow-sm">
                <div className="flex items-center gap-2 text-orange-600">
                  <Sparkles className="w-4 h-4" />
                  <span className="text-xs font-bold text-slate-800 dark:text-zinc-100">Upgrade to Pro</span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-orange-600 transition-colors" />
              </button>
            </Link>
          </div>

          {/* Bottom Storage Quota Meter Widget */}
          <div className="p-3 border-t border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#121214]">
            <div className="flex items-center justify-between text-[11px] mb-1.5">
              <span className="text-slate-600 dark:text-zinc-400 font-medium">{storageDisplay.formatted} / 1GB</span>
              <button 
                onClick={() => {
                  updateStorage();
                  showToast('Storage recalculated');
                }}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 p-0.5 rounded" 
                title="Recalculate Storage"
              >
                <RefreshCw className="w-3 h-3" />
              </button>
            </div>
            <div className="w-full h-1.5 bg-slate-100 dark:bg-zinc-800 rounded-full overflow-hidden">
              <div 
                className="h-full bg-orange-600 rounded-full transition-all duration-300"
                style={{ width: `${storageDisplay.percent}%` }}
              />
            </div>
          </div>
        </aside>

        {/* 2C. MAIN PAGE CONTENT WORKSPACE (Pure Black Dark Theme) */}
        <main className="flex-1 overflow-y-auto bg-white dark:bg-[#000000] transition-colors">
          {children}
        </main>
      </div>

      {/* NEW DOCUMENT CREATION MODAL */}
      <Dialog open={showNewDocModal} onOpenChange={setShowNewDocModal}>
        <DialogContent className="sm:max-w-md dark:bg-[#121214] dark:border-zinc-800">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-800 dark:text-zinc-100">
              Create New Document
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Choose your document type and name.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300 block mb-1.5">
                File Name
              </label>
              <input 
                type="text"
                value={newDocName}
                onChange={(e) => setNewDocName(e.target.value)}
                placeholder="e.g. My Document or Project Plan"
                className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-zinc-700 dark:bg-zinc-900 outline-none focus:border-orange-500 text-slate-900 dark:text-zinc-100"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300 block mb-1.5">
                Format
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'word', label: 'Word Doc', icon: FileText, color: 'text-orange-600', border: 'border-orange-500 bg-orange-50/50 dark:bg-orange-950/20' },
                  { id: 'excel', label: 'Spreadsheet', icon: FileSpreadsheet, color: 'text-emerald-600', border: 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20' },
                  { id: 'pdf', label: 'PDF Suite', icon: FileIcon, color: 'text-rose-600', border: 'border-rose-500 bg-rose-50/50 dark:bg-rose-950/20' },
                ].map(opt => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setNewDocType(opt.id as any)}
                    className={`p-3 rounded-lg border text-left flex flex-col gap-1.5 transition-all ${
                      newDocType === opt.id ? opt.border : 'border-slate-200 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-900'
                    }`}
                  >
                    <opt.icon className={`w-5 h-5 ${opt.color}`} />
                    <span className="text-xs font-semibold">{opt.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-zinc-800">
              <Button variant="ghost" size="sm" onClick={() => setShowNewDocModal(false)}>Cancel</Button>
              <Button size="sm" onClick={handleCreateDocument} className="bg-orange-600 hover:bg-orange-700 text-white">Create</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* SETTINGS MODAL */}
      <Dialog open={showSettingsModal} onOpenChange={setShowSettingsModal}>
        <DialogContent className="sm:max-w-md dark:bg-[#121214] dark:border-zinc-800">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-800 dark:text-zinc-100 flex items-center gap-2">
              <Settings className="w-4 h-4 text-slate-500" /> ZenOffice Preferences
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Custom appearance and local storage settings.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2 text-xs">
            <div className="flex items-center justify-between py-2 border-b border-slate-200 dark:border-zinc-800">
              <div>
                <div className="font-semibold text-slate-800 dark:text-zinc-200">Theme</div>
                <div className="text-[11px] text-slate-500">Switch between light and pure black dark</div>
              </div>
              <div className="flex items-center gap-1">
                <Button 
                  size="sm" 
                  variant={resolvedTheme === 'light' ? 'default' : 'outline'}
                  onClick={() => setTheme('light')} 
                  className={`h-7 text-xs ${resolvedTheme === 'light' ? 'bg-orange-600 text-white' : ''}`}
                >
                  Light
                </Button>
                <Button 
                  size="sm" 
                  variant={resolvedTheme === 'dark' ? 'default' : 'outline'}
                  onClick={() => setTheme('dark')} 
                  className={`h-7 text-xs ${resolvedTheme === 'dark' ? 'bg-orange-600 text-white' : ''}`}
                >
                  Pure Black Dark
                </Button>
              </div>
            </div>

            <div className="flex items-center justify-between py-2 border-b border-slate-200 dark:border-zinc-800">
              <div>
                <div className="font-semibold text-slate-800 dark:text-zinc-200">Firebase Cloud Sync</div>
                <div className="text-[11px] text-slate-500">Optional cloud synchronization</div>
              </div>
              <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                Connected
              </span>
            </div>

            <div className="flex items-center justify-between py-2">
              <div>
                <div className="font-semibold text-rose-600">Reset Local Storage</div>
                <div className="text-[11px] text-slate-500">Clear cached documents from this device</div>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleClearLocalCache}
                className="h-7 text-xs text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950 border-rose-200"
              >
                Clear
              </Button>
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-200 dark:border-zinc-800">
              <Button size="sm" onClick={() => setShowSettingsModal(false)}>Done</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

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

export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <AppShell>{children}</AppShell>
    </ThemeProvider>
  );
}
