'use client';

import * as React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { cn } from '@/lib/utils';

/**
 * Markdown for Zen AI replies, and for any other stored text that was authored
 * with `**bold**` / `-` bullets (notification bodies, for one).
 *
 * The model emits `**bold**`, `-` bullets and the occasional table. Rendering
 * that as plain text is what made answers look like raw source, so everything
 * goes through react-markdown with GFM (tables, strikethrough, autolinks).
 *
 * Styles are written out rather than using @tailwindcss/typography's `prose`
 * class: prose sets its own font sizes and vertical rhythm, which fights the
 * compact chat column. Only the elements the model actually produces are
 * mapped — anything else falls back to the browser default.
 *
 * `className` overrides the wrapper's type/colour so callers outside the chat
 * (muted body copy, smaller text) can restyle without forking the component.
 */
export const Markdown = React.memo(function Markdown({
  children,
  className,
}: {
  children: string;
  className?: string;
}) {
  return (
    <div className={cn('text-sm leading-relaxed text-foreground break-words', className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
          strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
          em: ({ children }) => <em className="italic">{children}</em>,

          ul: ({ children }) => <ul className="my-2 space-y-1 list-disc pl-4 marker:text-muted-foreground">{children}</ul>,
          ol: ({ children }) => <ol className="my-2 space-y-1 list-decimal pl-4 marker:text-muted-foreground">{children}</ol>,
          li: ({ children }) => <li className="pl-0.5">{children}</li>,

          h1: ({ children }) => <h1 className="text-base font-bold mt-3 mb-1.5 first:mt-0">{children}</h1>,
          h2: ({ children }) => <h2 className="text-sm font-bold mt-3 mb-1.5 first:mt-0">{children}</h2>,
          h3: ({ children }) => <h3 className="text-sm font-semibold mt-2.5 mb-1 first:mt-0">{children}</h3>,

          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2 hover:opacity-80">
              {children}
            </a>
          ),

          code: ({ className, children, ...props }) => {
            // react-markdown v10 no longer passes `inline`; a fenced block is
            // the one that carries a language- class or contains a newline.
            const text = String(children ?? '');
            const isBlock = /language-/.test(className ?? '') || text.includes('\n');
            if (!isBlock) {
              return (
                <code className="px-1 py-0.5 rounded bg-muted text-[0.85em] font-mono text-foreground" {...props}>
                  {children}
                </code>
              );
            }
            return (
              <code className="block overflow-x-auto p-2.5 rounded-lg bg-muted text-xs font-mono my-2" {...props}>
                {children}
              </code>
            );
          },
          pre: ({ children }) => <>{children}</>,

          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-border pl-3 my-2 text-muted-foreground">{children}</blockquote>
          ),
          hr: () => <hr className="my-3 border-border" />,

          // Wide tables scroll in their own box instead of stretching the column.
          table: ({ children }) => (
            <div className="overflow-x-auto my-2 rounded-lg border border-border/50">
              <table className="w-full text-xs">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-muted/40">{children}</thead>,
          th: ({ children }) => <th className="text-left font-semibold px-2.5 py-1.5 whitespace-nowrap">{children}</th>,
          td: ({ children }) => <td className="px-2.5 py-1.5 border-t border-border/40">{children}</td>,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
});
