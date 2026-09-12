/**
 * Owner-only assistant for the cap table.
 *
 * Separate from `/api/chat` on purpose, and the separation is a security
 * boundary rather than tidiness:
 *
 * - `/api/chat` authenticates a *tenant* (businessId + userId) and hands the
 *   model the whole 41-tool merchant toolkit with no whitelist. Anything added
 *   there is callable by every shop on the platform.
 * - This route authenticates the *platform owner* against a verified ID token,
 *   and only ever constructs `createCapTableTools`. A merchant cannot reach it,
 *   and the merchant assistant cannot reach the cap table.
 *
 * Everything the tools return is read-only. There is no write path here at all —
 * unlike the merchant assistant, which proposes writes for client-side approval,
 * this one cannot change the cap table under any prompt. Equity records are
 * edited through the forms on the page, where they are validated and audited.
 */

import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { streamText, convertToModelMessages, stepCountIs, type UIMessage } from 'ai';
import { NextResponse } from 'next/server';
import { adminFirestore } from '@/firebase/admin';
import { requireSuperAdmin, corsHeaders } from '../_guard';
import { createCapTableTools } from './cap-table-tools';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const google = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY,
});

const SYSTEM_PROMPT = `You are Zen, advising the founder of Zeneva on their own company's equity.

You are talking to Bello Imam, the founder and CEO. This is his personal cap
table — his ownership of his own company. Speak to him directly and plainly.

## What you are for

He is running a company, not studying finance. He has told you outright that he
does not know some of these terms. So:

- **Explain before you answer.** If a reply uses "pre-money", "fully diluted" or
  "liquidation preference", say what it means in the same breath, briefly.
- **Call \`explainTerm\` rather than defining things yourself.** Those
  definitions are the ones the app shows, so using them keeps you and the screen
  consistent. Explain in your own words only for something not in the glossary.
- **Never let a number stand alone.** "That's 20%" is not an answer. "That's 20%
  of the company — a fifth, permanently, for a one-off cheque" is.

## The thing he is most worried about, and he is right to be

Zeneva is early and growing. At a low valuation a small cheque buys a large,
irreversible share of the company. He has said he believes Zeneva will become
very valuable, and he does not want to sell equity cheaply now.

So when any investment comes up:

- Call \`priceAnInvestment\` and show what it actually buys. Do not estimate.
- If the stake is large for the money, say so directly. Do not soften it.
- Remind him that dilution is permanent — you cannot buy the percentage back
  later at the old price.
- But do not be reflexively negative. Money at a fair price that grows the
  company leaves him better off owning less of something bigger. The question is
  always the *price*, never the fact of raising.

## On valuation

He may want to simply declare what Zeneva is worth. That is legitimate — early
valuations are negotiated, not calculated — but be straight with him:

- A number he sets himself is a *founder estimate*. It is fine for planning and
  for anchoring a negotiation. An investor will push back on it.
- The defensible ways to reach a number are a revenue multiple (ARR times a
  multiple), comparable companies, or what someone last actually paid.
- Whatever he picks, urge him to record the *basis* — the ARR and multiple, the
  comparable used. In six months neither of you will remember otherwise.
- A valuation that is too high has a cost too: a round that fails to clear it, or
  a later down round.

## How to answer

- Call a tool rather than reasoning from memory. The tools compute from the same
  engine the page renders, so your numbers and his screen always agree.
- The tool output is already on his screen as a card. Do not re-read the rows
  back to him. Say what stands out and what to do about it.
- Currency amounts come back as plain numbers in the company's currency; do not
  invent a symbol you were not given.
- If there is no valuation recorded, say so plainly and offer to work through
  setting one. Do not invent a share price.
- Short paragraphs. No preamble. He is busy.

## Limits

You read the cap table; you never change it. If he asks you to record something,
tell him which tab does it — Stakeholders for people, Transactions for issuing
shares, Rounds for a raise, Valuation for what the company is worth. Editing
happens in the forms, where it is validated and written to the audit trail.`;

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function POST(req: Request) {
  const auth = await requireSuperAdmin(req);
  if (!auth.ok) return auth.res;

  if (!adminFirestore) {
    return NextResponse.json(
      { error: 'Server not configured for administrative actions.' },
      { status: 500, headers: corsHeaders },
    );
  }

  let messages: UIMessage[];
  try {
    const body = await req.json();
    messages = body?.messages;
    if (!Array.isArray(messages)) throw new Error('messages must be an array');
  } catch {
    return NextResponse.json(
      { error: 'Expected a JSON body with a messages array.' },
      { status: 400, headers: corsHeaders },
    );
  }

  // Transcripts saved by an older build stored `content` strings;
  // `convertToModelMessages` only understands `parts`. Normalise first, exactly
  // as the merchant route does, so an old chat does not 400 on reopen.
  const normalised = messages.map((m: any) =>
    Array.isArray(m?.parts)
      ? m
      : { ...m, parts: [{ type: 'text', text: typeof m?.content === 'string' ? m.content : '' }] },
  );

  let modelMessages;
  try {
    // `convertToModelMessages` is async — it returns a Promise, not an array.
    // Without the await, `streamText` gets the Promise and the request dies
    // inside the provider with "messages.some is not a function", which the
    // stream then reports as the assistant's reply.
    modelMessages = await convertToModelMessages(normalised as UIMessage[]);
  } catch (e) {
    // Mirrors the merchant route: a transcript the SDK cannot parse returns a
    // friendly 400 rather than a 500 the owner cannot act on.
    console.error('Failed to convert cap table chat history:', e);
    return NextResponse.json(
      { error: 'That conversation could not be read. Start a new chat.' },
      { status: 400, headers: corsHeaders },
    );
  }

  const result = streamText({
    model: google('gemini-3.6-flash'),
    system: SYSTEM_PROMPT,
    messages: modelMessages,
    // Lower than the merchant route's 24. These tools are few and cheap, and a
    // cap table question rarely needs more than a couple of calls plus the
    // explanation — this bounds a loop without cutting real work short.
    stopWhen: stepCountIs(12),
    tools: createCapTableTools({ db: adminFirestore }),
  });

  return result.toUIMessageStreamResponse({
    sendReasoning: false,
    onError: (error: unknown) => {
      console.error('Cap table assistant error:', error);
      return error instanceof Error ? error.message : 'Something went wrong.';
    },
  });
}
