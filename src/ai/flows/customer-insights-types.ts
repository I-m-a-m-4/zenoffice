
import { z } from 'zod';

const PurchaseHistoryItemSchema = z.object({
    name: z.string(),
    quantity: z.number(),
    price: z.number(),
});

export const CustomerInsightsInputSchema = z.object({
  customerName: z.string().describe('The name of the customer.'),
  purchaseHistory: z.array(PurchaseHistoryItemSchema).describe('A list of products the customer has purchased.'),
  totalSpent: z.number().describe('The total amount of money the customer has spent.'),
  orderCount: z.number().describe('The total number of orders the customer has made.'),
});
export type CustomerInsightsInput = z.infer<typeof CustomerInsightsInputSchema>;

export const CustomerInsightsOutputSchema = z.object({
  summary: z.string().describe('A brief, insightful summary of the customer\'s value and purchasing habits (2-3 sentences).'),
  productSuggestions: z.array(z.string()).describe('A list of 2-3 specific product categories or types the customer might be interested in next.'),
  engagementTactics: z.array(z.string()).describe('A list of 2-3 actionable engagement tactics, such as a personalized email idea or a special offer.'),
});
export type CustomerInsightsOutput = z.infer<typeof CustomerInsightsOutputSchema>;
