'use server';

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { requireSuperAdmin } from '@/actions/admin-guard';
import type { ContentStrategyInput, ContentStrategyOutput } from '@/types';

const PlatformStatsSchema = z.object({
  totalUsers: z.number().optional(),
  totalBusinesses: z.number().optional(),
  totalProducts: z.number().optional(),
  totalReceipts: z.number().optional(),
  platformGmv: z.number().optional(),
  averageSalesPerDay: z.number().optional(),
  platformAOV: z.number().optional(),
  topLocation: z.string().optional(),
  topIndustries: z.array(z.string()).optional(),
}).optional();

const ContentStrategyInputSchema = z.object({
  theme: z.string().describe('The core theme of the content (e.g., Offline POS, Employee theft, USD payouts).'),
  platform: z.string().describe('Target marketing platform: Medium, Substack, LinkedIn, Twitter.'),
  persona: z.string().describe('Target reader persona (e.g., Pharmacy owners, Boutique retailers).'),
  seedKnowledge: z.string().optional().describe('Optional custom context or stories to inject.'),
  platformStats: PlatformStatsSchema,
});

const SectionOutlineSchema = z.object({
  heading: z.string().describe('The section heading or title.'),
  talkingPoints: z.array(z.string()).describe('Core talking points, stats, or arguments to cover in this section.'),
});

const ContentStrategyOutputSchema = z.object({
  title: z.string().describe('Recommended title, headline, or hook for the post.'),
  seoKeywords: z.array(z.string()).describe('Target SEO keywords to optimize for.'),
  introduction: z.string().describe('A compelling introduction and hook paragraph (at least 4-5 sentences).'),
  outline: z.array(SectionOutlineSchema).describe('Step-by-step section outline for the article.'),
  ctaText: z.string().describe('Recommended Call-to-Action text incorporating zeneva.space links.'),
  backlinkOpportunities: z.array(z.string()).describe('Recommended context or anchors for inserting backlinks.'),
  marketingPitch: z.string().describe('Strategic explanation of why this piece will resonate and convert readers.'),
});

// The types live in '@/types' and consumers import them from there directly.
// Do NOT re-export them here: a 'use server' file may only export async
// functions, and Next's SWC check rejects even a type-only re-export because
// it cannot tell types from values before stripping them.
// Server Action = public endpoint. This one is only ever called from the admin
// dashboard, so it takes the stricter owner check. The guard sits outside the
// try/catch deliberately: inside it, "Not authorized." would be swallowed and
// reported to the caller as a transient AI error.
export async function generateContentPlan(input: ContentStrategyInput, idToken?: string): Promise<ContentStrategyOutput> {
  await requireSuperAdmin(idToken);
  try {
    const result = await contentStrategyFlow(input);
    return result;
  } catch (error: any) {
    console.error("Content Strategy AI Flow failed:", error);
    throw new Error("Zen AI Content Director is busy or encountered an error. Please try again.");
  }
}

const prompt = ai.definePrompt({
  name: 'contentStrategyPrompt',
  input: { schema: ContentStrategyInputSchema },
  output: { schema: ContentStrategyOutputSchema },
  prompt: `You are Zen AI, a world-class growth marketing director and B2B SaaS strategist for Zeneva. Zeneva is an offline-first, borderless retail operating system for modern merchants (mini-marts, supermarkets, boutiques, pharmacies) in Nigeria and globally.

Your task is to take the provided theme, platform, persona, custom seed knowledge, and real-time live platform metrics from the Zeneva admin dashboard, and generate a high-impact B2B marketing content blueprint.

**CONTEXT ABOUT ZENEVA:**
- **Core Value Proposition**: Unifies inventory management, multi-store POS, analytics, and local/global payments (USD and NGN) into one platform.
- **Killer Feature**: Hyper-Sync Offline POS. Works fully offline on desktop/mobile during blackouts, syncing automatically once internet returns. Saves retailers from massive losses (e.g. "Why Nigerian Retailers Lose ₦200,000+ to Internet blackouts (and How to Fix It)").
- **Target Audience**: Retailers, boutique owners, pharmacy managers, and supermarket owners in emerging markets (primarily Nigeria/Lekki/Ikeja/Lagos) looking to prevent inventory theft, track expiry dates, manage multi-currency billing, and accept global payments.
- **Grants Feature**: A Business Grants Directory is built directly into Zeneva to help retailers discover equity-free funding opportunities.

**LIVE PLATFORM METRICS & DASHBOARD INSIGHTS (Weave these statistics and milestones into the generated article copy, hook, and outlines to build extreme trust and authority):**
- Total Platform Users: {{platformStats.totalUsers}}
- Total Businesses Supported: {{platformStats.totalBusinesses}}
- Total Products Managed: {{platformStats.totalProducts}}
- Total Sales Receipts Processed: {{platformStats.totalReceipts}}
- Total Platform GMV: ₦{{platformStats.platformGmv}}
- Average Sales Velocity per Day: ₦{{platformStats.averageSalesPerDay}}
- Platform Average Order Value (AOV): ₦{{platformStats.platformAOV}}
- Dominant Territory/Location: {{platformStats.topLocation}}
- Top Active Industries: {{platformStats.topIndustries}}

**INPUTS:**
- **Core Theme**: {{theme}}
- **Platform**: {{platform}}
- **Target Persona**: {{persona}}
- **Additional Seed Context**: {{seedKnowledge}}

**OUTPUT INSTRUCTIONS:**
- Generate a JSON response matching the output schema.
- **CRITICAL**: The title, hook, and outline MUST directly quote or reference the provided live metrics where appropriate (e.g., "how we helped process over ₦[GMV] across [totalBusinesses] stores", or referencing the top location/industry, or offline-sales-saved figures).
- Write highly engaging titles like "Why Nigerian Retailers Lose ₦200,000+ to Internet blackouts (and How to Fix It)" or based on the live statistics.
- Make the content blueprint detailed, deeply practical, and tailored to the target platform (e.g., shorter and hook-heavy for LinkedIn; longer and keyword-rich for Medium/Substack). All CTA recommendations must guide the reader back to zeneva.space.`,
});

const contentStrategyFlow = ai.defineFlow(
  {
    name: 'contentStrategyFlow',
    inputSchema: ContentStrategyInputSchema,
    outputSchema: ContentStrategyOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    return output!;
  }
);
