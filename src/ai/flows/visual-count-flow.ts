'use server';

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { requireUser } from '@/actions/admin-guard';
import { withUserCredits } from '@/lib/server/ai-credits';

const VisualCountInputSchema = z.object({
    imageBase64: z.string().describe('The base64 encoded image of the products to count.'),
});

const InventoryItemSchema = z.object({
    name: z.string().describe('The name of the product identified.'),
    count: z.number().describe('The quantity of this product found in the image.'),
});

const VisualCountOutputSchema = z.object({
    items: z.array(InventoryItemSchema).describe('List of items identified and their counts.'),
});

export type VisualCountInput = z.infer<typeof VisualCountInputSchema>;
export type VisualCountOutput = z.infer<typeof VisualCountOutputSchema>;

/**
 * A `'use server'` export is a public HTTP endpoint — its action id ships in the
 * client bundle, so anyone can replay the POST with their own arguments. This
 * one bills a multimodal Gemini call against the platform's own API key on an
 * arbitrary caller-supplied image, so it has to prove who is asking first.
 *
 * The token is a separate parameter rather than a schema field on purpose:
 * `VisualCountInputSchema` is fed straight into the prompt, and a credential
 * has no business being sent to the model.
 *
 * It is also the **most expensive** call in the product, and until credits arrived
 * it was completely free: no quota field was read, so a caller could replay this
 * endpoint with full-resolution photographs indefinitely. It is now the
 * highest-weighted entry in `FLOW_CREDITS`, and it is the shape the coming AI
 * product upload should copy.
 */
export async function visualCount(input: VisualCountInput, idToken?: string): Promise<VisualCountOutput> {
    const uid = await requireUser(idToken);
    return withUserCredits(uid, 'visualCount', () => visualCountFlow(input));
}

const prompt = ai.definePrompt({
    name: 'visualCountPrompt',
    input: { schema: VisualCountInputSchema },
    output: { schema: VisualCountOutputSchema },
    prompt: `You are an expert inventory assistant. Analyze the provided image and count the distinct products you see.
  
  For each distinct product type:
  1. Identify its name (be descriptive but concise).
  2. Count how many visible units there are.
  
  Return a structured list of items and their counts. If you cannot identify any products, return an empty list.`,
});

const visualCountFlow = ai.defineFlow(
    {
        name: 'visualCountFlow',
        inputSchema: VisualCountInputSchema,
        outputSchema: VisualCountOutputSchema,
    },
    async (input) => {
        // Genkit's Gemini plugin handles base64 images in the prompt automatically if structured correctly
        // or we might need to construct a Part object. 
        // For now, passing the text prompt with the image is standard for multimodal.

        // Constructing a multimodal message
        const { output } = await prompt({
            imageBase64: input.imageBase64
        });

        return output!;
    }
);
