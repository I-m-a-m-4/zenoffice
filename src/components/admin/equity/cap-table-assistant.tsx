'use client';

/**
 * Zen AI, scoped to the cap table.
 *
 * Talks to `/api/admin/chat` — the owner-only route — not `/api/chat`, which is
 * the tenant assistant. Bearer token goes on every request; the route verifies
 * it against the platform owner before constructing any tool.
 *
 * Two things from `docs/zen-ai.md` that this must get right, because both fail
 * silently rather than loudly:
 *
 * 1. **On `ai@7`, `useChat` accepts neither `api` nor `body`.** They are
 *    transport concerns. Passing them is silently ignored, and the auth header
 *    never leaves the browser — every prompt then 401s.
 * 2. **A stack trace whose line numbers do not match the source means a stale
 *    service worker**, not a bad edit. `npm run build` leaves a production
 *    `public/sw.js` that the dev server happily serves.
 */

import * as React from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, isToolUIPart, getToolName } from 'ai';
import { getAuth } from 'firebase/auth';
import { ArrowUp, Loader2, Sparkles, SquarePen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Markdown } from '@/components/ai-insights/markdown';
import { ToolResult } from '@/components/ai-insights/tool-renderer';
import { ZenMark } from '@/components/ai-insights/zen-mark';
import type { CapTableSummary } from '@/lib/equity/types';

/**
 * Starter questions.
 *
 * Written as the owner would actually ask them, not as tool names. The first two
 * are the questions that prompted this panel existing.
 */
const SUGGESTIONS = [
  'What is Zeneva worth right now, and how would I even work that out?',
  'If someone offers ₦100,000 for shares, how much of the company does that buy?',
  'What does "fully diluted" mean?',
  'What happens to my ownership if I raise money next year?',
];

export function CapTableAssistant({ summary }: { summary: CapTableSummary }) {
  const [input, setInput] = React.useState('');
  const scrollRef = React.useRef<HTMLDivElement>(null);

  // Transport, not useChat options — see the note at the top of this file.
  const transport = React.useMemo(
    () =>
      new DefaultChatTransport({
        api: '/api/admin/chat',
        prepareSendMessagesRequest: async ({ messages, body }) => {
          // Read the token per send rather than closing over it: an ID token
          // lasts an hour, and a long session outlives the one captured at mount.
          const token = await getAuth().currentUser?.getIdToken();
          const headers: Record<string, string> = {};
          if (token) headers.Authorization = `Bearer ${token}`;
          return { body: { ...body, messages }, headers };
        },
      }),
    [],
  );

  const { messages, setMessages, sendMessage, status, error } = useChat({ transport });

  const isLoading = status === 'submitted' || status === 'streaming';

  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, isLoading]);

  const submit = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;
    void sendMessage({ text: trimmed });
    setInput('');
  };

  return (
    <Card className="flex h-[600px] flex-col overflow-hidden">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <ZenMark className="size-[22px]" />
          <div>
            <p className="text-sm font-semibold leading-none">Ask Zen</p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Equity questions, in plain language
            </p>
          </div>
        </div>
        {messages.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setMessages([])}
            className="gap-1.5 text-xs"
          >
            <SquarePen className="size-3.5" />
            New
          </Button>
        )}
      </div>

      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col justify-center">
            <div className="mb-4 text-center">
              <Sparkles className="mx-auto size-6 text-primary" />
              <p className="mt-2 text-sm font-medium">Not sure what a term means?</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Ask anything about your equity — nothing here is a silly question.
              </p>
            </div>
            <div className="space-y-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => submit(s)}
                  className="w-full rounded-lg border bg-card px-3 py-2.5 text-left text-xs transition-colors hover:bg-accent"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((message, i) => {
            const isUser = message.role === 'user';
            const streaming = isLoading && !isUser && i === messages.length - 1;

            return (
              <div key={message.id} className={cn('flex gap-2.5', isUser && 'justify-end')}>
                {!isUser && (
                  <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border bg-background">
                    <ZenMark className="size-4" animated={streaming} />
                  </div>
                )}

                <div className={cn('min-w-0 space-y-2', isUser ? 'max-w-[85%]' : 'flex-1')}>
                  {message.parts?.map((part: any, pi: number) => {
                    if (part.type === 'text') {
                      return isUser ? (
                        <div
                          key={pi}
                          className="rounded-2xl border border-stone-200 bg-stone-100 px-3 py-2 text-sm dark:border-stone-700 dark:bg-stone-800"
                        >
                          {part.text}
                        </div>
                      ) : (
                        <div key={pi} className="text-sm">
                          <Markdown>{part.text}</Markdown>
                        </div>
                      );
                    }

                    // Tool cards render themselves from `output.type`. A tool
                    // returning no type renders as nothing — see zen-ai.md.
                    if (isToolUIPart(part) && part.state === 'output-available') {
                      return (
                        <div key={pi} className="my-2">
                          {/* onApprove/onReject are required by the shared
                              renderer but unreachable here: this assistant has
                              no write tools, so it can never emit a PROPOSAL
                              card. They throw rather than no-op, so a future
                              write tool fails loudly instead of silently
                              dropping the owner's approval. */}
                          <ToolResult
                            output={part.output}
                            onApprove={() => {
                              throw new Error(
                                'The cap table assistant is read-only and cannot propose writes.',
                              );
                            }}
                            onReject={() => {
                              throw new Error(
                                'The cap table assistant is read-only and cannot propose writes.',
                              );
                            }}
                          />
                        </div>
                      );
                    }

                    if (isToolUIPart(part) && part.state === 'output-error') {
                      return (
                        <p key={pi} className="text-xs text-destructive">
                          {getToolName(part)} could not run.
                        </p>
                      );
                    }

                    return null;
                  })}
                </div>
              </div>
            );
          })
        )}

        {isLoading && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" />
            Working through the numbers...
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs">
            {error.message || 'Something went wrong.'}
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(input);
        }}
        className="flex shrink-0 gap-2 border-t p-3"
      >
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about your equity..."
          disabled={isLoading}
          className="text-sm"
        />
        <Button type="submit" size="icon" disabled={isLoading || !input.trim()} className="shrink-0">
          <ArrowUp className="size-4" />
        </Button>
      </form>
    </Card>
  );
}
