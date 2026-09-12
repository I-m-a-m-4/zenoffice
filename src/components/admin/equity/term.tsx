'use client';

/**
 * An inline term with its definition one tap away.
 *
 * Wraps a word in a dotted underline; hovering or tapping shows the plain-language
 * definition from `src/lib/equity/glossary.ts` — the same text the assistant's
 * `explainTerm` tool returns, so the page and the chat never disagree.
 *
 * Popover rather than a native `title` attribute: `title` does not appear on
 * touch at all, and this page is read on phones.
 */

import * as React from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { lookupTerm } from '@/lib/equity/glossary';
import { cn } from '@/lib/utils';

export function Term({
  k,
  children,
  className,
}: {
  /** Glossary key, e.g. "pre-money". */
  k: string;
  children: React.ReactNode;
  className?: string;
}) {
  const entry = lookupTerm(k);

  // An unknown key renders as plain text rather than a dead affordance — a
  // dotted underline that explains nothing is worse than no underline.
  if (!entry) return <>{children}</>;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'cursor-help underline decoration-dotted decoration-muted-foreground/60 underline-offset-2 transition-colors hover:decoration-foreground',
            className,
          )}
        >
          {children}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 text-left" align="start">
        <p className="text-sm font-semibold">{entry.term}</p>
        <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{entry.long}</p>
        {entry.why && (
          <p className="mt-2 border-t pt-2 text-xs leading-relaxed">
            <span className="font-medium">Why it matters: </span>
            <span className="text-muted-foreground">{entry.why}</span>
          </p>
        )}
        {entry.example && (
          <p className="mt-2 rounded-md bg-muted/60 px-2 py-1.5 text-[11px] leading-relaxed text-muted-foreground">
            {entry.example}
          </p>
        )}
      </PopoverContent>
    </Popover>
  );
}
