'use client';

import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Loader2, Image as ImageIcon, CheckCircle2, ExternalLink, X, ZoomIn } from 'lucide-react';
import Image from 'next/image';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

export interface WebProductImage {
    id: string;
    title?: string;
    urls: {
        regular: string;
        full: string;
        small: string;
    };
    alt_description: string;
    dimensions?: {
        width?: number;
        height?: number;
    };
    user: {
        name: string;
        links: {
            html: string;
        };
    };
}

interface UnsplashImagePickerProps {
    onImageSelect: (imageUrl: string, file: File) => void;
    initialSearchQuery?: string;
    disabled?: boolean;
}

export function UnsplashImagePicker({ onImageSelect, initialSearchQuery = '', disabled = false }: UnsplashImagePickerProps) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState(initialSearchQuery);
    const [images, setImages] = useState<WebProductImage[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedImage, setSelectedImage] = useState<WebProductImage | null>(null);
    const [isDownloading, setIsDownloading] = useState(false);
    const [zoomImage, setZoomImage] = useState<WebProductImage | null>(null);
    const abortControllerRef = useRef<AbortController | null>(null);

    // Update query when initialSearchQuery changes and modal is closed
    useEffect(() => {
        if (!open && initialSearchQuery) {
            setQuery(initialSearchQuery);
        }
    }, [initialSearchQuery, open]);

    // Focus input when modal opens
    const inputRef = useRef<HTMLInputElement>(null);
    useEffect(() => {
        if (open) {
            setTimeout(() => {
                inputRef.current?.focus();
            }, 100);
        } else {
            // Abort any ongoing request and reset preview zoom when closed
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
            setZoomImage(null);
            if (!selectedImage) {
                setImages([]);
                setError(null);
            }
        }
    }, [open, selectedImage]);

    // Auto-search when query changes (debounced)
    useEffect(() => {
        if (!open || !query.trim()) return;

        const timer = setTimeout(() => {
            if (!selectedImage) {
                handleSearch();
            }
        }, 500);

        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [query, open]);

    const handleSearch = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        
        const trimmed = query.trim();
        if (!trimmed) return;

        // Cancel previous request if still in flight
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        const controller = new AbortController();
        abortControllerRef.current = controller;

        setIsLoading(true);
        setError(null);
        setSelectedImage(null);
        setZoomImage(null);

        try {
            const response = await fetch(`/api/images/search?q=${encodeURIComponent(trimmed)}&limit=30`, {
                signal: controller.signal
            });

            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                setError(data.error || 'Unable to fetch images at the moment. Please try again.');
                return;
            }

            const data = await response.json();
            const results: WebProductImage[] = data.results || [];
            setImages(results);

            // Pre-select first image for convenient preview
            if (results.length > 0) {
                setSelectedImage(results[0]);
            }
        } catch (err: any) {
            if (err.name === 'AbortError') {
                // Request was intentionally cancelled by a newer search
                return;
            }
            setError('Could not connect to image search. Please check your connection and try again.');
        } finally {
            setIsLoading(false);
        }
    };

    // Trigger search automatically if we open with a query
    useEffect(() => {
        if (open && query && images.length === 0 && !isLoading && !error && !selectedImage) {
            handleSearch();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    const handleSelectImage = (image: WebProductImage) => {
        setSelectedImage(image);
    };

    const handleConfirmSelection = async (imageToUse?: WebProductImage) => {
        const targetImage = imageToUse || selectedImage;
        if (!targetImage) return;

        setIsDownloading(true);
        try {
            const imageUrl = targetImage.urls.regular;
            const fallbackUrl = targetImage.urls.small || '';
            
            // Call proxy with fallback support
            const proxyUrl = `/api/images/proxy?url=${encodeURIComponent(imageUrl)}${fallbackUrl ? `&fallback=${encodeURIComponent(fallbackUrl)}` : ''}`;
            const response = await fetch(proxyUrl);
            
            if (!response.ok) throw new Error('Failed to download image');
            
            const blob = await response.blob();
            
            // Create a clean sanitized file
            const filename = `product-${targetImage.id}.jpg`;
            const file = new File([blob], filename, { type: blob.type || 'image/jpeg' });
            
            onImageSelect(imageUrl, file);
            setOpen(false);
        } catch (err) {
            console.error('Error preparing image:', err);
            setError('Failed to download this image. Please select another image from the list.');
        } finally {
            setIsDownloading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" type="button" className="w-full gap-2 mt-2" disabled={disabled}>
                    <Search className="h-4 w-4" />
                    Search Web for Image
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[840px] w-[95vw] flex flex-col h-[85vh] max-h-[850px] p-4 sm:p-6">
                <DialogHeader className="pb-2 border-b">
                    <div className="flex items-center justify-between">
                        <div>
                            <DialogTitle className="text-lg font-semibold flex items-center gap-2">
                                <Search className="h-4 w-4 text-primary" />
                                Search Product Images
                            </DialogTitle>
                            <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                                Search online retail catalogues for authentic product photos and packaging.
                            </DialogDescription>
                        </div>
                        {images.length > 0 && (
                            <Badge variant="secondary" className="text-[11px] font-medium hidden sm:inline-flex">
                                {images.length} results
                            </Badge>
                        )}
                    </div>
                </DialogHeader>

                {/* Search Bar */}
                <div className="flex gap-2 mt-3">
                    <div className="relative flex-1">
                        <Input
                            ref={inputRef}
                            placeholder="e.g. Olay Regenerist Cream, Nike Air Max, Milo 400g..."
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleSearch();
                                }
                            }}
                            className="pr-8"
                        />
                        {query && (
                            <button
                                type="button"
                                onClick={() => {
                                    setQuery('');
                                    inputRef.current?.focus();
                                }}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                            >
                                <X className="h-3.5 w-3.5" />
                            </button>
                        )}
                    </div>
                    <Button type="button" onClick={() => handleSearch()} disabled={isLoading || !query.trim()} className="gap-2">
                        {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                        <span className="hidden sm:inline">Search</span>
                    </Button>
                </div>

                {/* Main Content Area */}
                <div className="flex-1 overflow-hidden flex flex-col md:flex-row gap-4 mt-3 min-h-0">
                    {/* Left/Grid: Image Results */}
                    <div className="flex-1 overflow-hidden flex flex-col border rounded-lg bg-muted/10 relative min-h-0">
                        {isLoading ? (
                            <ScrollArea className="flex-1 p-3">
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                    {Array.from({ length: 9 }).map((_, i) => (
                                        <div key={i} className="space-y-1.5">
                                            <Skeleton className="h-32 sm:h-36 w-full rounded-md" />
                                            <Skeleton className="h-3 w-3/4 rounded" />
                                        </div>
                                    ))}
                                </div>
                            </ScrollArea>
                        ) : error ? (
                            <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
                                <p className="text-destructive text-sm mb-3 font-medium">{error}</p>
                                <Button variant="outline" size="sm" onClick={() => handleSearch()}>Try Again</Button>
                            </div>
                        ) : images.length > 0 ? (
                            <ScrollArea className="flex-1 p-3">
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                    {images.map((image) => {
                                        const isSelected = selectedImage?.id === image.id;
                                        return (
                                            <div 
                                                key={image.id} 
                                                className={cn(
                                                    "group relative flex flex-col rounded-lg overflow-hidden cursor-pointer border-2 transition-all bg-card",
                                                    isSelected 
                                                        ? "border-primary ring-2 ring-primary/20 shadow-sm" 
                                                        : "border-border/60 hover:border-primary/50 hover:shadow-sm"
                                                )}
                                                onClick={() => handleSelectImage(image)}
                                            >
                                                {/* Image Container */}
                                                <div className="relative h-28 sm:h-36 w-full bg-white flex items-center justify-center overflow-hidden">
                                                    <Image
                                                        src={image.urls.small || image.urls.regular}
                                                        alt={image.alt_description || 'Product image'}
                                                        fill
                                                        sizes="(max-width: 640px) 50vw, 220px"
                                                        style={{ objectFit: 'contain' }}
                                                        unoptimized
                                                        className="p-1 transition-transform group-hover:scale-105 duration-200"
                                                    />
                                                    
                                                    {/* Retailer Pill */}
                                                    <div className="absolute top-1.5 left-1.5 bg-black/70 backdrop-blur-xs text-white text-[9px] font-medium px-1.5 py-0.5 rounded shadow-xs max-w-[85%] truncate">
                                                        {image.user.name}
                                                    </div>

                                                    {/* Zoom Action Button */}
                                                    <button
                                                        type="button"
                                                        title="Preview in high resolution"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setZoomImage(image);
                                                        }}
                                                        className="absolute bottom-1.5 right-1.5 bg-background/90 hover:bg-background text-foreground rounded p-1 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                                                    >
                                                        <ZoomIn className="h-3.5 w-3.5" />
                                                    </button>

                                                    {/* Selected Indicator */}
                                                    {isSelected && (
                                                        <div className="absolute top-1.5 right-1.5 bg-primary text-primary-foreground rounded-full p-0.5 shadow-md">
                                                            <CheckCircle2 className="h-4 w-4" />
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Product Title Label */}
                                                <div className="p-2 border-t bg-card text-[11px] font-medium line-clamp-1 text-foreground/90 group-hover:text-primary transition-colors" title={image.alt_description}>
                                                    {image.alt_description || query}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </ScrollArea>
                        ) : query && !isLoading ? (
                            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-6">
                                <ImageIcon className="h-10 w-10 mb-3 opacity-25" />
                                <p className="text-sm font-medium">No product images found for "{query}"</p>
                                <p className="text-xs text-muted-foreground mt-1">Try refining the brand or product name</p>
                            </div>
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-6">
                                <ImageIcon className="h-10 w-10 mb-3 opacity-25" />
                                <p className="text-sm font-medium">Search for a product image above</p>
                            </div>
                        )}
                    </div>

                    {/* Right Panel: High-Res Selected Preview & Inspector */}
                    {selectedImage && (
                        <div className="w-full md:w-72 shrink-0 border rounded-lg p-3.5 flex flex-col bg-card/60 backdrop-blur-xs justify-between">
                            <div className="space-y-3">
                                <div className="flex items-center justify-between pb-2 border-b">
                                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                        Selected Image
                                    </span>
                                    {selectedImage.user.links.html !== '#' && (
                                        <a
                                            href={selectedImage.user.links.html}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="text-[11px] text-primary hover:underline flex items-center gap-1 font-medium"
                                        >
                                            Source <ExternalLink className="h-3 w-3" />
                                        </a>
                                    )}
                                </div>

                                {/* Preview Display */}
                                <div 
                                    className="relative h-44 sm:h-52 w-full rounded-md border bg-white overflow-hidden cursor-pointer group flex items-center justify-center"
                                    onClick={() => setZoomImage(selectedImage)}
                                    title="Click to view fullscreen high-res"
                                >
                                    <Image
                                        src={selectedImage.urls.regular}
                                        alt={selectedImage.alt_description || 'Product preview'}
                                        fill
                                        style={{ objectFit: 'contain' }}
                                        unoptimized
                                        className="p-2 transition-transform group-hover:scale-105 duration-200"
                                    />
                                    <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-medium gap-1.5">
                                        <ZoomIn className="h-4 w-4" /> Click to Zoom
                                    </div>
                                </div>

                                {/* Metadata Details */}
                                <div className="space-y-1.5 pt-1">
                                    <p className="text-xs font-medium text-foreground line-clamp-3 leading-snug" title={selectedImage.alt_description}>
                                        {selectedImage.alt_description || query}
                                    </p>
                                    
                                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                                        <Badge variant="outline" className="text-[10px] font-normal py-0 h-5">
                                            Store: <span className="font-semibold ml-1">{selectedImage.user.name}</span>
                                        </Badge>
                                        {selectedImage.dimensions?.width && selectedImage.dimensions?.height && (
                                            <Badge variant="outline" className="text-[10px] font-normal py-0 h-5">
                                                {selectedImage.dimensions.width} × {selectedImage.dimensions.height}
                                            </Badge>
                                        )}
                                        <Badge variant="secondary" className="text-[10px] py-0 h-5 text-emerald-600 bg-emerald-500/10 border-emerald-500/20">
                                            High Res
                                        </Badge>
                                    </div>
                                </div>
                            </div>

                            {/* Direct Action */}
                            <div className="pt-4 border-t mt-3">
                                <Button
                                    type="button"
                                    className="w-full gap-2 shadow-xs"
                                    disabled={isDownloading}
                                    onClick={() => handleConfirmSelection()}
                                >
                                    {isDownloading ? (
                                        <>
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                            Downloading...
                                        </>
                                    ) : (
                                        <>
                                            <CheckCircle2 className="h-4 w-4" />
                                            Use This Image
                                        </>
                                    )}
                                </Button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Controls */}
                <div className="flex justify-between items-center mt-3 pt-3 border-t">
                    <p className="text-[11px] text-muted-foreground">
                        High-accuracy product search powered by verified retail catalogues
                    </p>
                    <div className="flex gap-2">
                        <Button variant="outline" type="button" onClick={() => setOpen(false)}>
                            Cancel
                        </Button>
                        <Button 
                            type="button" 
                            disabled={!selectedImage || isDownloading}
                            onClick={() => handleConfirmSelection()}
                        >
                            {isDownloading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Downloading...
                                </>
                            ) : (
                                'Use Image'
                            )}
                        </Button>
                    </div>
                </div>
            </DialogContent>

            {/* High-Resolution Zoom Modal */}
            {zoomImage && (
                <Dialog open={!!zoomImage} onOpenChange={(openState) => !openState && setZoomImage(null)}>
                    <DialogContent className="sm:max-w-[700px] max-h-[90vh] flex flex-col p-4">
                        <DialogHeader className="pb-2 border-b">
                            <DialogTitle className="text-sm font-semibold truncate pr-6">
                                {zoomImage.alt_description || query}
                            </DialogTitle>
                            <DialogDescription className="text-xs flex items-center gap-2">
                                <span>Source: {zoomImage.user.name}</span>
                                {zoomImage.dimensions?.width && zoomImage.dimensions?.height && (
                                    <span>• {zoomImage.dimensions.width} × {zoomImage.dimensions.height} px</span>
                                )}
                            </DialogDescription>
                        </DialogHeader>
                        
                        <div className="relative w-full h-[55vh] max-h-[500px] bg-white rounded-md my-2 flex items-center justify-center overflow-hidden border">
                            <Image
                                src={zoomImage.urls.regular}
                                alt={zoomImage.alt_description || 'High-res product preview'}
                                fill
                                style={{ objectFit: 'contain' }}
                                unoptimized
                                className="p-4"
                            />
                        </div>

                        <div className="flex justify-between items-center pt-2 border-t">
                            {zoomImage.user.links.html !== '#' ? (
                                <a
                                    href={zoomImage.user.links.html}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-xs text-primary hover:underline flex items-center gap-1 font-medium"
                                >
                                    Visit Store Page <ExternalLink className="h-3 w-3" />
                                </a>
                            ) : <div />}

                            <div className="flex gap-2">
                                <Button variant="outline" size="sm" onClick={() => setZoomImage(null)}>
                                    Back
                                </Button>
                                <Button 
                                    size="sm"
                                    disabled={isDownloading}
                                    onClick={() => {
                                        setSelectedImage(zoomImage);
                                        setZoomImage(null);
                                        handleConfirmSelection(zoomImage);
                                    }}
                                    className="gap-1.5"
                                >
                                    {isDownloading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                                    Use This Image
                                </Button>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>
            )}
        </Dialog>
    );
}
