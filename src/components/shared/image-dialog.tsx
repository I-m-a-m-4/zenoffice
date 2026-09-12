
'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import Image from 'next/image';
import { X, ZoomIn } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ImageDialogProps {
  src: string | null;
  alt: string;
  isOpen: boolean;
  onClose: () => void;
}

export function ImageDialog({ src, alt, isOpen, onClose }: ImageDialogProps) {
  if (!src) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-3xl p-0 overflow-hidden bg-black/95 border-none [&>button]:text-white">
        <DialogHeader className="sr-only">
          <DialogTitle>{alt}</DialogTitle>
        </DialogHeader>
        <div className="relative w-full aspect-square md:aspect-[4/3] flex items-center justify-center">
          <Image
            src={src}
            alt={alt}
            fill
            className="object-contain"
            priority
          />
        </div>
        <div className="p-4 bg-background/10 backdrop-blur-md absolute bottom-0 left-0 right-0">
            <p className="text-white font-medium text-center">{alt}</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
