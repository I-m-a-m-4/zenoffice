'use client';

import React, { useRef, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Camera, X, RefreshCw, CheckCircle2, Upload, Loader2, Image as ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface CameraCaptureProps {
    onCapture: (file: File) => void;
    isProcessing?: boolean;
}

export function CameraCapture({ onCapture, isProcessing = false }: CameraCaptureProps) {
    const [preview, setPreview] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { toast } = useToast();

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.size > 5 * 1024 * 1024) {
                toast({
                    variant: "destructive",
                    title: "File too large",
                    description: "Please select an image under 5MB."
                });
                return;
            }

            const reader = new FileReader();
            reader.onloadend = () => {
                setPreview(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleConfirm = () => {
        if (fileInputRef.current?.files?.[0]) {
            onCapture(fileInputRef.current.files[0]);
        }
    };

    const clearImage = () => {
        setPreview(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const triggerCamera = () => {
        fileInputRef.current?.click();
    };

    return (
        <div className="w-full space-y-4">
            <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                ref={fileInputRef}
                onChange={handleFileChange}
            />

            {!preview ? (
                <div
                    onClick={triggerCamera}
                    className="border-2 border-dashed border-muted-foreground/25 rounded-xl p-8 flex flex-col items-center justify-center gap-4 cursor-pointer hover:bg-muted/50 transition-colors h-64"
                >
                    <div className="p-4 bg-primary/10 rounded-full">
                        <Camera className="w-8 h-8 text-primary" />
                    </div>
                    <div className="text-center space-y-1">
                        <h3 className="font-semibold text-lg">Take a Photo</h3>
                        <p className="text-sm text-muted-foreground">Tap to scan shelves or products</p>
                    </div>
                    <Button variant="secondary" size="sm" className="mt-2">
                        <Upload className="w-4 h-4 mr-2" />
                        Or upload image
                    </Button>
                </div>
            ) : (
                <div className="relative rounded-xl overflow-hidden bg-black aspect-video sm:aspect-auto sm:h-[400px]">
                    <img
                        src={preview}
                        alt="Preview"
                        className="w-full h-full object-contain"
                    />

                    {/* Overlay Actions */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex flex-col justify-end p-6">
                        <div className="flex items-center gap-4 justify-center">
                            <Button
                                variant="outline"
                                size="lg"
                                className="rounded-full h-12 w-12 p-0 border-white/20 bg-white/10 text-white hover:bg-white/20"
                                onClick={clearImage}
                                disabled={isProcessing}
                            >
                                <RefreshCw className="w-5 h-5" />
                            </Button>

                            <Button
                                size="lg"
                                className="rounded-full px-8 h-14 text-base font-semibold shadow-xl shadow-primary/20"
                                onClick={handleConfirm}
                                disabled={isProcessing}
                            >
                                {isProcessing ? (
                                    <>
                                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                        Analyzing...
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle2 className="w-5 h-5 mr-2" />
                                        Count Items
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>

                    <Button
                        variant="ghost"
                        size="icon"
                        className="absolute top-4 right-4 text-white hover:bg-white/20 rounded-full"
                        onClick={clearImage}
                        disabled={isProcessing}
                    >
                        <X className="w-6 h-6" />
                    </Button>
                </div>
            )}
        </div>
    );
}
