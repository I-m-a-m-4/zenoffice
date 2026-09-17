import { Loader2 } from 'lucide-react';

export default function EditorLoading() {
  return (
    <div className="flex h-[calc(100vh-4rem)] w-full flex-col items-center justify-center bg-background">
      <div className="flex flex-col items-center space-y-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="text-muted-foreground text-sm font-medium animate-pulse">
          Loading document...
        </p>
      </div>
    </div>
  );
}
