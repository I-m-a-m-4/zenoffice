import { convertToModelMessages } from 'ai';

// Simulate a session that was saved as raw ModelMessages (role: 'tool') instead of UIMessages
// This could happen if old code stored them incorrectly or the Firestore data is corrupted
const rawModelMessages = [
  {
    id: 'msg_1',
    role: 'user',
    content: [{ type: 'text', text: 'update the cost price' }]
    // No 'parts' field — this was a raw ModelMessage, not UIMessage
  },
  {
    id: 'msg_2',
    role: 'tool',
    content: [
      {
        type: 'tool-result',
        toolCallId: 'call_1',
        toolName: 'proposeCostPrices',
        output: { type: 'json', value: { type: 'PROPOSAL' } }
      }
    ]
    // No 'parts' field
  }
];

// After normalization in route.ts:
// messages that have no `parts` get: parts: [{ type: 'text', text: content || '' }]
// But for role:'tool' messages, content is an array, not a string!
const normalized = rawModelMessages.map((m: any) =>
  Array.isArray(m?.parts)
    ? m
    : { ...m, parts: [{ type: 'text', text: typeof m?.content === 'string' ? m.content : '' }] },
);

console.log('Normalized:', JSON.stringify(normalized, null, 2));

async function run() {
  const { modelMessageSchema } = require('ai');

  console.log('\n--- TEST: raw ModelMessages after normalization ---');
  try {
    const converted = await convertToModelMessages(normalized as any);
    console.log('CONVERTED:', JSON.stringify(converted, null, 2));
    let ok = true;
    for (const msg of converted) {
      const res = modelMessageSchema.safeParse(msg);
      if (!res.success) {
        ok = false;
        console.error('Validation FAILED for role=' + msg.role);
        console.error(JSON.stringify(res.error.format(), null, 2));
      }
    }
    if (ok) console.log('Validation success');
  } catch (e: any) {
    console.error('Error:', e?.message);
    if (e?.cause) console.error('Cause:', JSON.stringify(e.cause, null, 2));
  }
}

run();
