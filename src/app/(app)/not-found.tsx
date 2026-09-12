'use client';

import { FileSearch } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import PageTitle from '@/components/shared/page-title';

export default function NotFound() {
  return (
    <>
      <PageTitle title="Page Not Found" />
      <div className="flex flex-col items-center justify-center text-center p-12 border-2 border-dashed rounded-lg h-full">
        <FileSearch className="h-16 w-16 text-muted-foreground mb-4" />
        <h2 className="text-2xl font-bold">404 - Not Found</h2>
        <p className="mt-2 text-muted-foreground">
          The page you are looking for does not exist within your workspace.
        </p>
        <Button asChild className="mt-6">
          <Link href="/dashboard">Return to Dashboard</Link>
        </Button>
      </div>
    </>
  );
}
