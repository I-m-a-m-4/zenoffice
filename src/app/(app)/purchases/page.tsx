'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function PurchasesRedirect() {
  const router = useRouter();

  React.useEffect(() => {
    router.replace('/expenses?tab=purchases');
  }, [router]);

  return (
    <div className="flex h-64 items-center justify-center">
      <div className="flex flex-col items-center gap-2 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm">Redirecting to Expenses & Purchases...</p>
      </div>
    </div>
  );
}
