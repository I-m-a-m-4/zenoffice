'use client';

import React, { useState, useEffect } from 'react';
import { 
  Sparkles, X, Key, BookOpen, HelpCircle, 
  FileCheck, Quote, Send, Loader2, Copy, 
  Check, Settings, GraduationCap, ArrowRight, Table
} from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface ZenAiDialogProps {
  isOpen: boolean;
  onClose: () => void;
  documentContext?: string;
  documentTitle?: string;
  editorType?: 'pdf' | 'document' | 'excel';
  onInsert?: (text: string) => void;
}

export function ZenAiDialog({
  isOpen,
  onClose,
  documentContext = '',
  documentTitle = 'Document',
  editorType = 'pdf',
  onInsert,
}: ZenAiDialogProps) {
  const [prompt, setPrompt] = useState('');
  const [selectedAction, setSelectedAction] = useState<'explain' | 'quiz' | 'summarize' | 'cite' | 'polish' | 'formula' | 'chat'>('explain');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Zen API Key state (saved in localStorage for convenience)
  const [zenApiKey, setZenApiKey] = useState('');
  const [showKeyConfig, setShowKeyConfig] = useState(false);
  const [keySaved, setKeySaved] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedKey = localStorage.getItem('zenoffice_zen_api_key') || '';
      setZenApiKey(savedKey);
    }
  }, []);

  if (!isOpen) return null;

  const handleSaveKey = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('zenoffice_zen_api_key', zenApiKey.trim());
      setKeySaved(true);
      setTimeout(() => setKeySaved(false), 2500);
      setShowKeyConfig(false);
    }
  };

  const handleRunAction = async (actionType: 'explain' | 'quiz' | 'summarize' | 'cite' | 'polish' | 'formula' | 'chat', customQuery?: string) => {
    setSelectedAction(actionType);
    setLoading(true);
    setResult(null);

    try {
      const res = await fetch('/api/zen-ai', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-zen-key': zenApiKey.trim(),
        },
        body: JSON.stringify({
          action: actionType,
          prompt: customQuery || prompt,
          documentText: documentContext,
          customApiKey: zenApiKey.trim(),
          model: 'llama-3.3-70b-versatile',
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (data.error === 'MISSING_API_KEY') {
          setShowKeyConfig(true);
          setResult('⚠️ Please provide your free Groq API key (starts with gsk_...) in the settings above to unlock unlimited student study tools.');
        } else {
          setResult(`Error: ${data.message || 'Failed to generate response'}`);
        }
      } else {
        setResult(data.result);
      }
    } catch (err: any) {
      setResult(`Network error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!result) return;
    navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
      <div className="bg-white dark:bg-[#121214] border border-zinc-300 dark:border-zinc-800 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden text-zinc-900 dark:text-zinc-100">
        
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50 dark:bg-[#0c0c0e]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-orange-600 flex items-center justify-center text-white shadow-xs">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold flex items-center gap-2">
                <span>ZenOffice Academic AI</span>
                <span className="text-[10px] bg-orange-100 dark:bg-orange-950/60 text-orange-700 dark:text-orange-400 px-2 py-0.5 rounded-full font-semibold border border-orange-200 dark:border-orange-800">
                  Zen AI Core
                </span>
              </h3>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                Study &amp; Document Co-pilot for {documentTitle}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setShowKeyConfig(!showKeyConfig)}
              className="p-1.5 rounded-lg text-zinc-500 hover:text-orange-500 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"
              title="Zen AI Key Settings"
            >
              <Key className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* API Key Configuration Drawer */}
        {showKeyConfig && (
          <div className="p-4 bg-orange-50/50 dark:bg-orange-950/30 border-b border-orange-200 dark:border-orange-900/60 text-xs">
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-semibold text-orange-900 dark:text-orange-200 flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-orange-600" /> Zen AI Custom Key
              </span>
              <button 
                onClick={() => setZenApiKey('')}
                className="text-[11px] text-orange-600 hover:underline"
              >
                Clear Key
              </button>
            </div>
            <p className="text-[11px] text-zinc-600 dark:text-zinc-400 mb-2 leading-relaxed">
              Enter your Zen AI Custom Access Key below to unlock unlimited rate limits.
            </p>
            <div className="flex gap-2">
              <input
                type="password"
                value={zenApiKey}
                onChange={(e) => setZenApiKey(e.target.value)}
                placeholder="zen_..."
                className="flex-1 px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 font-mono text-xs outline-none focus:border-orange-500 text-zinc-900 dark:text-white"
              />
              <Button 
                size="sm" 
                onClick={handleSaveKey}
                className="bg-orange-600 hover:bg-orange-700 text-white text-xs px-3"
              >
                {keySaved ? <Check className="w-3.5 h-3.5 mr-1 text-white" /> : null}
                {keySaved ? 'Saved!' : 'Save Key'}
              </Button>
            </div>
          </div>
        )}

        {/* Action Pills for Students */}
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex flex-wrap gap-2 shrink-0 bg-white dark:bg-[#121214]">
          <button
            onClick={() => handleRunAction('explain')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${
              selectedAction === 'explain'
                ? 'bg-orange-600 text-white shadow-xs'
                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" /> Explain Document
          </button>

          <button
            onClick={() => handleRunAction('quiz')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${
              selectedAction === 'quiz'
                ? 'bg-orange-600 text-white shadow-xs'
                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
            }`}
          >
            <HelpCircle className="w-3.5 h-3.5" /> Generate 5 Quiz Questions
          </button>

          <button
            onClick={() => handleRunAction('summarize')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${
              selectedAction === 'summarize'
                ? 'bg-orange-600 text-white shadow-xs'
                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
            }`}
          >
            <FileCheck className="w-3.5 h-3.5" /> Revision Cheat Sheet
          </button>

          <button
            onClick={() => handleRunAction('cite')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${
              selectedAction === 'cite'
                ? 'bg-orange-600 text-white shadow-xs'
                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
            }`}
          >
            <Quote className="w-3.5 h-3.5" /> Citation (APA/MLA)
          </button>

          {editorType === 'excel' && (
            <button
              onClick={() => handleRunAction('formula')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${
                selectedAction === 'formula'
                  ? 'bg-orange-600 text-white shadow-xs'
                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
              }`}
            >
              <Table className="w-3.5 h-3.5" /> Excel Formula
            </button>
          )}

          {editorType === 'document' && (
            <button
              onClick={() => handleRunAction('polish')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${
                selectedAction === 'polish'
                  ? 'bg-orange-600 text-white shadow-xs'
                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
              }`}
            >
              <GraduationCap className="w-3.5 h-3.5" /> Academic Tone Polish
            </button>
          )}
        </div>

        {/* Content & Results Scroll Area */}
        <div className="flex-1 p-5 overflow-y-auto min-h-[220px] max-h-[380px] bg-zinc-50/50 dark:bg-[#0c0c0e]">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-48 gap-3 text-zinc-500">
              <Loader2 className="w-7 h-7 animate-spin text-orange-600" />
              <span className="text-xs font-medium">Zen AI is analyzing your document...</span>
            </div>
          ) : result ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-zinc-200 dark:border-zinc-800">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-orange-600">
                  AI Study Insights
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopy}
                    className="text-[11px] flex items-center gap-1 text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Copied' : 'Copy'}</span>
                  </button>

                  {onInsert && (
                    <Button
                      size="sm"
                      onClick={() => onInsert(result)}
                      className="h-6 text-[11px] px-2 bg-orange-600 hover:bg-orange-700 text-white"
                    >
                      Insert into Document
                    </Button>
                  )}
                </div>
              </div>

              <div className="text-xs leading-relaxed text-zinc-800 dark:text-zinc-200 whitespace-pre-wrap font-sans space-y-2">
                {result}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-44 text-center text-zinc-400">
              <Sparkles className="w-8 h-8 text-orange-500/40 mb-2" />
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                Select an action above or ask a specific question below.
              </p>
              <p className="text-[11px] text-zinc-400 max-w-sm mt-1">
                Perfect for preparing for tests, understanding lecture notes, or generating exam practice questions.
              </p>
            </div>
          )}
        </div>

        {/* Input Box */}
        <div className="p-3 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#121214] flex items-center gap-2">
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !loading && prompt.trim()) {
                handleRunAction('chat', prompt);
              }
            }}
            placeholder="Ask a question about this document or enter an essay prompt..."
            className="flex-1 px-3 py-2 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-xs outline-none focus:border-orange-500 text-zinc-900 dark:text-white"
          />
          <Button
            size="sm"
            onClick={() => handleRunAction('chat', prompt)}
            disabled={loading || !prompt.trim()}
            className="bg-orange-600 hover:bg-orange-700 text-white text-xs px-3"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
          </Button>
        </div>

      </div>
    </div>
  );
}
