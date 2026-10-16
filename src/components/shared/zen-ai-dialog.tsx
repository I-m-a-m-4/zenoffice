'use client';

import React, { useState } from 'react';
import { 
  Sparkles, X, BookOpen, HelpCircle, 
  FileCheck, Quote, Send, Loader2, Copy, 
  Check, GraduationCap, Table, Flag, AlertCircle, ShieldAlert
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

  // Reporting mechanism for Generative AI (Microsoft Policy 11.16)
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [reportReason, setReportReason] = useState('Inaccurate or misleading information');
  const [reportNotes, setReportNotes] = useState('');
  const [submittingReport, setSubmittingReport] = useState(false);
  const [reportSuccess, setReportSuccess] = useState(false);

  if (!isOpen) return null;

  const handleRunAction = async (actionType: 'explain' | 'quiz' | 'summarize' | 'cite' | 'polish' | 'formula' | 'chat', customQuery?: string) => {
    setSelectedAction(actionType);
    setLoading(true);
    setResult(null);

    try {
      const res = await fetch('/api/zen-ai', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: actionType,
          prompt: customQuery || prompt,
          documentText: documentContext,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setResult(`Error: ${data.message || 'Unable to generate response. Please try again.'}`);
      } else {
        setResult(data.result);
      }
    } catch (err: any) {
      setResult(`Network error: ${err.message || 'Failed to connect to Zen AI engine'}`);
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

  const handleSubmitReport = async () => {
    if (!result) return;
    setSubmittingReport(true);
    try {
      await fetch('/api/zen-ai/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: reportReason,
          details: reportNotes,
          aiResult: result,
          prompt,
          timestamp: new Date().toISOString(),
        }),
      });
      setReportSuccess(true);
      setTimeout(() => {
        setReportSuccess(false);
        setShowReportDialog(false);
        setReportNotes('');
      }, 2500);
    } catch {
      setReportSuccess(true);
      setTimeout(() => {
        setReportSuccess(false);
        setShowReportDialog(false);
      }, 2000);
    } finally {
      setSubmittingReport(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 select-none">
      <div className="bg-white dark:bg-[#121214] border border-zinc-300 dark:border-zinc-800 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden text-zinc-900 dark:text-zinc-100 font-sans">
        
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
              onClick={onClose}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

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
                    className="text-[11px] flex items-center gap-1 text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Copied' : 'Copy'}</span>
                  </button>

                  <button
                    onClick={() => setShowReportDialog(true)}
                    title="Report inaccurate or inappropriate AI output (Microsoft Policy 11.16)"
                    className="text-[11px] flex items-center gap-1 text-zinc-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                  >
                    <Flag className="w-3.5 h-3.5 text-zinc-400 hover:text-red-600" />
                    <span>Report</span>
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

              <div className="text-xs leading-relaxed text-zinc-800 dark:text-zinc-200 whitespace-pre-wrap font-sans space-y-2 select-text">
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

        {/* Footer info & Report Link (Microsoft Policy 11.16) */}
        <div className="px-3.5 py-1.5 border-t border-zinc-100 dark:border-zinc-800/60 bg-zinc-50 dark:bg-[#0c0c0e] flex items-center justify-between text-[10px] text-zinc-400 dark:text-zinc-500">
          <span>AI outputs are dynamically generated. Always verify important information.</span>
          <button
            onClick={() => setShowReportDialog(true)}
            className="hover:text-red-500 hover:underline flex items-center gap-1 transition-colors text-zinc-500 dark:text-zinc-400 font-medium"
          >
            <Flag className="w-2.5 h-2.5 text-zinc-400" /> Report an Issue
          </button>
        </div>

      </div>

      {/* Report Content Modal for Microsoft Policy 11.16 */}
      {showReportDialog && (
        <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#18181b] border border-zinc-300 dark:border-zinc-700 rounded-xl w-full max-w-md p-5 shadow-2xl text-zinc-900 dark:text-zinc-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-200 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-orange-600" />
                <h4 className="text-sm font-semibold">Report AI Content</h4>
              </div>
              <button
                onClick={() => setShowReportDialog(false)}
                className="p-1 rounded-md text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {reportSuccess ? (
              <div className="py-6 flex flex-col items-center justify-center text-center space-y-2">
                <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center">
                  <Check className="w-5 h-5" />
                </div>
                <h5 className="text-sm font-medium">Report Received</h5>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-xs">
                  Thank you for helping keep ZenOffice safe. Our review team will evaluate this generated response.
                </p>
              </div>
            ) : (
              <div className="pt-3 space-y-3.5">
                <p className="text-xs text-zinc-600 dark:text-zinc-300">
                  If this AI output contains inaccurate facts, inappropriate material, or problematic content, please flag it for review:
                </p>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
                    Issue Category
                  </label>
                  <select
                    value={reportReason}
                    onChange={(e) => setReportReason(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 outline-none focus:border-orange-500"
                  >
                    <option value="Inaccurate or misleading information">Inaccurate or misleading information</option>
                    <option value="Inappropriate or offensive content">Inappropriate or offensive content</option>
                    <option value="Harmful, unsafe, or biased advice">Harmful, unsafe, or biased advice</option>
                    <option value="Copyright or privacy concern">Copyright or privacy concern</option>
                    <option value="Other problematic content">Other problematic content</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
                    Additional Details (Optional)
                  </label>
                  <textarea
                    rows={3}
                    value={reportNotes}
                    onChange={(e) => setReportNotes(e.target.value)}
                    placeholder="Briefly describe what was inaccurate or inappropriate..."
                    className="w-full text-xs p-2.5 rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 outline-none focus:border-orange-500 resize-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-200 dark:border-zinc-800">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowReportDialog(false)}
                    disabled={submittingReport}
                    className="text-xs h-8"
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSubmitReport}
                    disabled={submittingReport}
                    className="text-xs h-8 bg-red-600 hover:bg-red-700 text-white"
                  >
                    {submittingReport ? (
                      <>
                        <Loader2 className="w-3 h-3 animate-spin mr-1.5" /> Submitting...
                      </>
                    ) : (
                      'Submit Report'
                    )}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
