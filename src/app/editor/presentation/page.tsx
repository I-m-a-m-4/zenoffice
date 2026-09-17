"use client";

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { 
  Share2, Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight,
  Plus, X, Play, MonitorPlay, Square, Type, Image as ImageIcon, LayoutTemplate, Sparkles
} from 'lucide-react';
import { ZenAiDialog } from '@/components/shared/zen-ai-dialog';

export default function PresentationEditor() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [docTitle, setDocTitle] = useState('Untitled Presentation.pptx');
  const [slides, setSlides] = useState([{ id: 1, content: 'Click to add title' }]);
  const [activeSlide, setActiveSlide] = useState(1);
  const [showAiModal, setShowAiModal] = useState(false);
  
  useEffect(() => {
    const docParam = searchParams.get('doc');
    if (docParam) {
      setDocTitle(decodeURIComponent(docParam));
    }
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

  const addSlide = () => {
    const newId = slides.length + 1;
    setSlides([...slides, { id: newId, content: 'New Slide' }]);
    setActiveSlide(newId);
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
            <div className="w-5 h-5 rounded bg-orange-600 flex items-center justify-center text-white shadow-xs text-[10px] font-bold">
              P
            </div>
            <span className="text-xs font-bold text-zinc-900 dark:text-white tracking-tight">ZenOffice</span>
          </Link>

          {/* Active Document Tab */}
          <div className="flex items-center gap-2 px-4 h-11 rounded-t-md text-sm font-medium border-t border-x bg-white dark:bg-[#121214] border-[#e2dcd0] dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-xs">
            <div className="w-5 h-5 rounded bg-orange-600 text-white flex items-center justify-center text-[10px] font-bold shrink-0">
              P
            </div>
            <span className="max-w-[220px] truncate" title={docTitle}>
              {docTitle}
            </span>
            <button 
              onClick={(e) => {
                e.stopPropagation();
                router.push('/dashboard');
              }}
              className="hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 ml-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <button 
            onClick={() => {
              const newName = `Presentation_${Date.now().toString().slice(-4)}.pptx`;
              router.push(`/editor/presentation?doc=${encodeURIComponent(newName)}`);
            }}
            className="w-8 h-8 rounded flex items-center justify-center text-zinc-500 hover:bg-slate-300/60 dark:hover:bg-zinc-800 hover:text-orange-500 transition-colors mb-1 ml-1"
            title="Create New Blank Presentation"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          <button className="h-7 px-3 bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 text-xs font-semibold rounded flex items-center gap-1.5 transition-colors">
            <MonitorPlay className="w-3.5 h-3.5" /> Present
          </button>
          <button className="h-7 px-3 bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold rounded flex items-center gap-1.5 transition-colors">
            <Share2 className="w-3.5 h-3.5" /> Share
          </button>
        </div>
      </div>

      {/* 2. RIBBON MENU & WORKSPACE BAR */}
      <div className="bg-[#F0EDE6] dark:bg-[#121214] border-b border-[#e2dcd0] dark:border-zinc-800 px-3 flex items-end shrink-0 gap-1 overflow-x-auto no-scrollbar pt-1 h-9">
        {['Home', 'Insert', 'Design', 'Transitions', 'Animations', 'Slide Show', 'Review', 'View'].map(tab => (
          <button 
            key={tab}
            className={`px-4 py-1.5 text-xs font-medium transition-all relative rounded-t-sm flex items-center gap-1.5 ${
              tab === 'Home'
                ? 'bg-white dark:bg-[#18181b] text-orange-600 font-bold border-x border-t border-[#e2dcd0] dark:border-zinc-800 shadow-xs z-10'
                : 'text-zinc-600 dark:text-zinc-400 hover:bg-black/5 dark:hover:bg-zinc-800/50'
            }`}
            style={tab === 'Home' ? { borderTopColor: '#ea580c', borderTopWidth: '2px' } : {}}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* 3. RICH RIBBON ACTION TOOLBAR */}
      <div className="bg-[#F0EDE6] dark:bg-[#18181b] border-b border-[#e2dcd0] dark:border-zinc-800 px-4 py-1.5 flex items-start gap-4 w-full overflow-x-auto no-scrollbar min-h-[90px]">
        
        {/* Undo/Redo */}
        <div className="flex flex-col gap-1 border-r border-[#e2dcd0] dark:border-zinc-800 pr-4 justify-center h-full pt-1">
          <button className="flex items-center gap-2 p-1.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 text-[10px] font-medium">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></svg> Undo
          </button>
          <button className="flex items-center gap-2 p-1.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 text-[10px] font-medium">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7"/></svg> Redo
          </button>
        </div>

        {/* AI Agent Group */}
        <div className="flex items-center border-r border-[#e2dcd0] dark:border-zinc-800 pr-4 h-full">
          <button 
            onClick={() => setShowAiModal(true)}
            className="flex flex-col items-center justify-center h-full px-3 hover:bg-orange-100 dark:hover:bg-orange-900/30 rounded text-orange-600 dark:text-orange-500 gap-1 transition-colors border border-transparent hover:border-orange-200"
          >
            <Sparkles className="w-5 h-5" />
            <span className="text-[10px] font-bold">AI Editing</span>
          </button>
        </div>

        {/* Slides Group */}
        <div className="flex items-center gap-1 border-r border-[#e2dcd0] dark:border-zinc-800 pr-4 h-full">
          <button 
            onClick={addSlide}
            className="flex flex-col items-center justify-center h-full px-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded text-zinc-700 dark:text-zinc-300 gap-1"
          >
            <div className="w-6 h-5 border-2 border-orange-500 rounded-sm flex items-center justify-center">
              <Plus className="w-3 h-3 text-orange-500" />
            </div>
            <span className="text-[10px] font-medium">New Slide</span>
          </button>
          <button className="flex flex-col items-center justify-center h-full px-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded text-zinc-700 dark:text-zinc-300 gap-1">
            <LayoutTemplate className="w-5 h-5" />
            <span className="text-[10px] font-medium">Layout</span>
          </button>
        </div>

        {/* Font Group */}
        <div className="flex flex-col gap-2 border-r border-[#e2dcd0] dark:border-zinc-800 pr-4 pt-1 w-48">
          <div className="flex items-center gap-1 w-full">
            <select className="h-7 flex-1 text-xs border border-zinc-200 dark:border-zinc-700 rounded bg-white dark:bg-zinc-900 px-2 outline-none cursor-pointer">
              <option>Calibri (Body)</option>
              <option>Arial</option>
              <option>Inter</option>
            </select>
            <select className="h-7 w-14 text-xs border border-zinc-200 dark:border-zinc-700 rounded bg-white dark:bg-zinc-900 px-1 outline-none cursor-pointer">
              <option>18</option>
              <option>24</option>
              <option>32</option>
              <option>48</option>
            </select>
          </div>
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center border border-zinc-200 dark:border-zinc-700 rounded overflow-hidden shadow-xs">
              <button className="w-7 h-7 flex items-center justify-center bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300"><Bold className="w-3.5 h-3.5" /></button>
              <button className="w-7 h-7 flex items-center justify-center bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 border-l border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300"><Italic className="w-3.5 h-3.5" /></button>
              <button className="w-7 h-7 flex items-center justify-center bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 border-l border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300"><Underline className="w-3.5 h-3.5" /></button>
            </div>
            <div className="flex gap-1 text-xs font-bold px-2 py-1 rounded border border-transparent hover:border-zinc-200 hover:bg-zinc-100 cursor-pointer text-orange-600">
              A
            </div>
            <div className="flex gap-1 text-xs font-bold px-2 py-1 rounded border border-transparent hover:border-zinc-200 hover:bg-zinc-100 cursor-pointer text-amber-500 bg-amber-50">
              H
            </div>
          </div>
        </div>
        
        {/* Alignment */}
        <div className="flex items-center gap-1 border-r border-[#e2dcd0] dark:border-zinc-800 pr-4 h-full">
           <div className="grid grid-cols-2 gap-1">
             <button className="p-1.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300" title="Align Left"><AlignLeft className="w-4 h-4" /></button>
             <button className="p-1.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300" title="Align Center"><AlignCenter className="w-4 h-4" /></button>
             <button className="p-1.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300" title="Align Right"><AlignRight className="w-4 h-4" /></button>
             <button className="p-1.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300" title="Bullets">
               <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
             </button>
           </div>
        </div>

        {/* Insert Group */}
        <div className="flex items-center gap-2 border-r border-[#e2dcd0] dark:border-zinc-800 pr-4 h-full">
           <button className="flex flex-col items-center justify-center h-full px-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded text-zinc-700 dark:text-zinc-300 gap-1 transition-colors">
            <Type className="w-5 h-5 text-blue-500" />
            <span className="text-[10px] font-medium">Text Box</span>
          </button>
          <button className="flex flex-col items-center justify-center h-full px-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded text-zinc-700 dark:text-zinc-300 gap-1 transition-colors">
            <ImageIcon className="w-5 h-5 text-emerald-500" />
            <span className="text-[10px] font-medium">Pictures</span>
          </button>
          <button className="flex flex-col items-center justify-center h-full px-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded text-zinc-700 dark:text-zinc-300 gap-1 transition-colors">
            <Square className="w-5 h-5 text-amber-500" />
            <span className="text-[10px] font-medium">Shapes</span>
          </button>
        </div>
      </div>

      {/* 4. MAIN WORKSPACE */}
      <div className="flex-1 flex overflow-hidden bg-zinc-100 dark:bg-[#000000]">
        
        {/* Left Sidebar: Slide Thumbnails */}
        <div className="w-48 bg-zinc-50 dark:bg-[#0c0c0e] border-r border-zinc-200 dark:border-zinc-800 flex flex-col overflow-y-auto py-4 gap-4 items-center shrink-0">
          {slides.map((slide, idx) => (
            <div 
              key={slide.id} 
              className="flex items-start w-full px-2 gap-2"
              onClick={() => setActiveSlide(slide.id)}
            >
              <span className="text-[10px] font-bold text-zinc-400 pt-1 w-3 text-right">{idx + 1}</span>
              <div 
                className={`flex-1 aspect-video bg-white dark:bg-[#18181b] border-2 rounded shadow-sm flex items-center justify-center cursor-pointer transition-colors ${
                  activeSlide === slide.id ? 'border-orange-500' : 'border-zinc-200 dark:border-zinc-700 hover:border-orange-300'
                }`}
              >
                <span className="text-[8px] text-zinc-400 p-2 text-center break-words truncate max-w-full">
                  {slide.content}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Center: Slide Canvas */}
        <div className="flex-1 overflow-auto bg-zinc-200 dark:bg-[#000000] p-8 flex flex-col">
          <div className="flex-1 min-h-0 w-full flex items-center justify-center">
            <div className="w-full max-w-[850px] aspect-[16/9] bg-white dark:bg-zinc-900 shadow-2xl border border-zinc-200 dark:border-zinc-800 flex flex-col items-center justify-center p-12 transition-all">
              <input 
                type="text" 
                className="text-4xl font-bold text-center w-full bg-transparent outline-none border-2 border-transparent focus:border-zinc-300 dark:focus:border-zinc-700 border-dashed rounded p-4 text-zinc-800 dark:text-zinc-100 transition-colors"
                value={slides.find(s => s.id === activeSlide)?.content || ''}
                onChange={(e) => {
                  setSlides(slides.map(s => s.id === activeSlide ? { ...s, content: e.target.value } : s));
                }}
                placeholder="Click to add title"
              />
              <div className="mt-8 text-xl text-center w-full bg-transparent outline-none border-2 border-transparent hover:border-zinc-200 dark:hover:border-zinc-800 border-dashed rounded p-8 text-zinc-500 dark:text-zinc-400 cursor-text min-h-[200px] transition-colors">
                Click to add subtitle
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* 5. STATUS BAR */}
      <div className="h-8 bg-zinc-100 dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between px-4 shrink-0">
        <div className="text-[10px] font-medium text-zinc-500">
          Slide {activeSlide} of {slides.length}
        </div>
        <div className="flex items-center gap-4 text-zinc-500">
          <button className="hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors" title="Slide Show">
            <MonitorPlay className="w-4 h-4" />
          </button>
          <div className="text-[10px] font-medium">
            100%
          </div>
        </div>
      </div>

      <ZenAiDialog 
        editorType="document" 
        documentContext={JSON.stringify(slides)} 
        isOpen={showAiModal} 
        onClose={() => setShowAiModal(false)} 
      />
    </div>
  );
}
