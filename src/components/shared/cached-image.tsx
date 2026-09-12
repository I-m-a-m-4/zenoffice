'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { ImageManager } from '@/lib/image-manager';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { ImageOff } from 'lucide-react';
import Image from 'next/image';

interface CachedImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  fallback?: React.ReactNode;
}

/**
 * A wrapper around standard <img> that automatically caches
 * the source image locally for offline access in Tauri.
 *
 * In standard web browsers, it utilizes Next.js <Image /> for built-in
 * proxying, optimization, and avoiding CORS/hotlinking issues.
 */
export function CachedImage({ src, className, alt, fallback, ...props }: CachedImageProps) {
  const sanitizedSrc = typeof src === 'string' && !src.startsWith('data:') && !src.startsWith('blob:') && src.includes(',')
    ? src.split(',')[0].trim()
    : src;

  const [displaySrc, setDisplaySrc] = useState<string | undefined>(sanitizedSrc || undefined);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [useFallbackUrl, setUseFallbackUrl] = useState(false);
  const [isTauri, setIsTauri] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__) {
      setIsTauri(true);
    }
  }, []);

  useEffect(() => {
    if (!sanitizedSrc) {
      setError(true);
      return;
    }

    setError(false);
    setUseFallbackUrl(false);
    setDisplaySrc(sanitizedSrc);

    if (sanitizedSrc.startsWith('data:') || sanitizedSrc.startsWith('blob:')) {
      return;
    }

    let isMounted = true;

    async function load() {
      // Only do native Tauri caching if we are actually in Tauri
      if (typeof window === 'undefined' || !(window as any).__TAURI_INTERNALS__) return;

      if (ImageManager.isKnownUnreachable(sanitizedSrc as string)) {
        return;
      }

      try {
        const localUri = await ImageManager.getLocalUri(sanitizedSrc as string);
        if (isMounted && localUri) {
          setDisplaySrc(localUri);
        }
      } catch (err) {
        if (isMounted) {
          setDisplaySrc(sanitizedSrc);
        }
      }
    }

    load();

    return () => {
      isMounted = false;
    };
  }, [sanitizedSrc]);

  const handleError = useCallback(() => {
    if (!useFallbackUrl && displaySrc !== sanitizedSrc && sanitizedSrc) {
      setUseFallbackUrl(true);
      setDisplaySrc(sanitizedSrc);
    } else {
      setError(true);
      if (sanitizedSrc) ImageManager.markUnreachable(sanitizedSrc);
    }
  }, [sanitizedSrc, displaySrc, useFallbackUrl]);

  if (!sanitizedSrc || error) {
    return (
      <div className={cn("flex items-center justify-center bg-muted rounded-lg w-full h-full", className)}>
        {fallback ?? <ImageOff className="h-5 w-5 text-muted-foreground/50" />}
      </div>
    );
  }

  // Use Next.js Image on the web to bypass CORS and optimize images.
  if (!isTauri && sanitizedSrc.startsWith('http')) {
    return (
      <Image
        src={sanitizedSrc}
        alt={alt || ''}
        fill
        sizes={props.sizes || "(max-width: 768px) 100vw, 33vw"}
        className={cn("transition-opacity duration-300", className)}
        onError={() => setError(true)}
      />
    );
  }

  // Fallback for Tauri or Data URIs
  return (
    <img
      src={displaySrc || sanitizedSrc}
      className={cn("transition-opacity duration-300", className)}
      alt={alt || ''}
      onError={handleError}
      {...props}
    />
  );
}
