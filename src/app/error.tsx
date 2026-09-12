'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { AlertCircle, RefreshCw } from 'lucide-react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error('Global Error Caught:', error);

    // If it's a ChunkLoadError, we should automatically reload the page
    if (error.name === 'ChunkLoadError' || error.message?.includes('ChunkLoadError')) {
      console.warn('ChunkLoadError detected in Error Boundary, reloading...');
      window.location.reload();
    }
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="max-w-md w-full space-y-8 text-center">
        <div className="flex justify-center">
          <div className="p-4 bg-destructive/10 rounded-full">
            <AlertCircle className="h-12 w-12 text-destructive" />
          </div>
        </div>
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Something went wrong</h1>
          <p className="text-muted-foreground">
            An unexpected error occurred while loading this page. This usually happens after an update.
          </p>
        </div>
        <div className="flex flex-col gap-3">
          <Button
            onClick={() => window.location.reload()}
            size="lg"
            className="w-full gap-2 bg-[#ea580c] hover:bg-[#ea580c]/90 text-white shadow-md rounded-xl font-semibold"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh Page
          </Button>
          <Button
            onClick={() => reset()}
            variant="outline"
            size="lg"
            className="w-full"
          >
            Try again
          </Button>
        </div>
        {error.digest && (
          <p className="text-xs text-muted-foreground opacity-50">
            Error ID: {error.digest}
          </p>
        )}
      </div>
    </div>
  );
}
