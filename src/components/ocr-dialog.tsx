'use client';

import * as React from 'react';
import { createWorker } from 'tesseract.js';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Upload, FileText, Loader2, Copy, Check } from 'lucide-react';

interface OcrDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function OcrDialog({ open, onOpenChange }: OcrDialogProps) {
  const [image, setImage] = React.useState<string | null>(null);
  const [text, setText] = React.useState('');
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const [copied, setCopied] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setImage(reader.result as string);
      setText('');
      setProgress(0);
    };
    reader.readAsDataURL(file);
  };

  const processImage = async () => {
    if (!image) return;
    setIsProcessing(true);
    setText('');
    
    try {
      const worker = await createWorker('eng', 1, {
        logger: m => {
          if (m.status === 'recognizing text') {
            setProgress(Math.round(m.progress * 100));
          }
        }
      });
      
      const { data: { text } } = await worker.recognize(image);
      setText(text);
      await worker.terminate();
    } catch (err) {
      console.error('OCR Error:', err);
      setText('An error occurred during text extraction. Please try a different image.');
    } finally {
      setIsProcessing(false);
      setProgress(0);
    }
  };

  const copyText = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleReset = () => {
    setImage(null);
    setText('');
    setProgress(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] bg-background">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScanTextIcon className="w-5 h-5 text-indigo-500" />
            Image to Text (OCR)
          </DialogTitle>
          <DialogDescription>
            Extract editable text from images, receipts, and scanned documents instantly using local AI.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 h-[400px]">
          {/* Left Side: Upload & Image Preview */}
          <div className="flex flex-col border rounded-lg overflow-hidden relative bg-slate-50 dark:bg-zinc-900">
            {!image ? (
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                <div className="w-16 h-16 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center mb-4">
                  <Upload className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
                </div>
                <h3 className="font-semibold text-slate-800 dark:text-zinc-200 mb-1">Upload Image</h3>
                <p className="text-xs text-slate-500 mb-4">PNG, JPG, or GIF up to 5MB</p>
                <Button onClick={() => fileInputRef.current?.click()} size="sm" variant="outline">
                  Browse Files
                </Button>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileUpload} 
                  className="hidden" 
                  accept="image/*"
                />
              </div>
            ) : (
              <>
                <img src={image} alt="Uploaded for OCR" className="object-contain w-full h-full" />
                <div className="absolute bottom-2 left-2 right-2 flex justify-between gap-2">
                  <Button size="sm" variant="secondary" className="flex-1 shadow-sm" onClick={handleReset} disabled={isProcessing}>
                    Clear
                  </Button>
                  <Button size="sm" className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm" onClick={processImage} disabled={isProcessing}>
                    {isProcessing ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        {progress}%
                      </>
                    ) : (
                      'Extract Text'
                    )}
                  </Button>
                </div>
              </>
            )}
          </div>

          {/* Right Side: Text Output */}
          <div className="flex flex-col border rounded-lg overflow-hidden bg-white dark:bg-zinc-950 relative">
            <div className="bg-slate-100 dark:bg-zinc-900 px-3 py-2 border-b text-xs font-semibold flex items-center justify-between text-slate-600 dark:text-zinc-300">
              <span className="flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5" /> Extracted Text
              </span>
              {text && (
                <Button size="icon" variant="ghost" className="h-6 w-6 rounded-md" onClick={copyText} title="Copy Text">
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                </Button>
              )}
            </div>
            <div className="flex-1 p-3 overflow-y-auto text-sm">
              {isProcessing ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400">
                  <div className="w-48 h-2 bg-slate-200 dark:bg-zinc-800 rounded-full overflow-hidden mb-3">
                    <div className="h-full bg-indigo-500 transition-all duration-300" style={{ width: `${progress}%` }}></div>
                  </div>
                  <p className="animate-pulse">Analyzing image...</p>
                </div>
              ) : text ? (
                <pre className="whitespace-pre-wrap font-sans text-slate-700 dark:text-zinc-200">{text}</pre>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-400 dark:text-zinc-600 italic">
                  Extracted text will appear here.
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ScanTextIcon(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 7V5a2 2 0 0 1 2-2h2" />
      <path d="M17 3h2a2 2 0 0 1 2 2v2" />
      <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
      <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
      <path d="M7 8h8" />
      <path d="M7 12h10" />
      <path d="M7 16h6" />
    </svg>
  );
}
