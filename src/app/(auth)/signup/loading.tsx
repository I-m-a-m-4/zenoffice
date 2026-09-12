import { Loader } from 'lucide-react';

export default function Loading() {
  return (
    <div className="flex h-screen w-full items-center justify-center flex-col gap-2 bg-background">
      <Loader className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}
