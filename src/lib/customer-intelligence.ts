
import type { Customer, Receipt, Product, CustomerInsightsOutput } from '@/types';

/**
 * Generates local customer intelligence without the need for an AI model.
 * Uses purchase history and statistical patterns to provide business value.
 */
export function generateLocalCustomerIntelligence(
    customer: Customer,
    receipts: Receipt[],
    allProducts: Product[],
    /**
     * The shop's own currency symbol. Defaults to the naira so existing callers
     * keep working, but every money figure below used to be hardcoded to `₦` —
     * which quietly mislabelled the summary for every shop trading in anything
     * else, and the summary is prose the owner reads and trusts.
     */
    currencySymbol: string = '₦'
): CustomerInsightsOutput {
    const totalSpent = receipts.reduce((sum, r) => sum + r.total, 0);
    const orderCount = receipts.length;
    
    // Aggregation of purchased items
    const itemMap: Record<string, { quantity: number, name: string }> = {};
    receipts.forEach(r => {
        if (!r || !Array.isArray(r.items)) return;
        r.items.forEach(item => {
            if (!item || !item.productId) return;
            if (!itemMap[item.productId]) {
                itemMap[item.productId] = { quantity: 0, name: item.name || 'Unknown Product' };
            }
            itemMap[item.productId].quantity += (item.quantity || 0);
        });
    });

    const sortedItems = Object.entries(itemMap)
        .sort((a, b) => b[1].quantity - a[1].quantity)
        .map(([id, data]) => ({ id, ...data }));

    const topItems = sortedItems.slice(0, 3).map(i => i.name);
    
    // 1. Generate Summary
    let segment = 'New Customer';
    if (orderCount > 10) segment = 'VIP Patron';
    else if (orderCount > 3) segment = 'Loyal Customer';
    else if (orderCount > 0) segment = 'Recent Customer';

    const avgOrderValue = orderCount > 0 ? totalSpent / orderCount : 0;
    
    // Calculate category preferences
    const categoryMap: Record<string, number> = {};
    receipts.forEach(r => {
        if (!r || !Array.isArray(r.items)) return;
        r.items.forEach(item => {
            if (!item || !item.productId) return;
            const p = allProducts.find(prod => prod.id === item.productId);
            if (p?.category) {
                categoryMap[p.category] = (categoryMap[p.category] || 0) + (item.quantity || 0);
            }
        });
    });
    const topCategory = Object.entries(categoryMap).sort((a,b) => b[1]-a[1])[0]?.[0];

    // 1. Generate Summary
    let summary = `**Customer Segment: ${segment}**\n\n`;
    summary += `${customer.name} is a **${segment.toLowerCase()}** who has shopped with you **${orderCount} times**, contributing a lifetime value of **${currencySymbol}${totalSpent.toLocaleString()}**. `;
    
    if (topItems.length > 0) {
        summary += `Their most frequently purchased products are **${topItems.join(', ')}**. `;
    }
    
    if (topCategory) {
        summary += `They show a strong preference for items in the **${topCategory}** category. `;
    }

    if (orderCount > 0) {
        // Stated as a fact, not as a judgement. This used to read "they are among
        // your higher-spending clientele" above a hardcoded ₦25,000 — a threshold
        // that cannot be currency-neutral, and this function has no shop-wide
        // figures to compare against, so the claim could not be supported.
        summary += `Their average order is **${currencySymbol}${avgOrderValue.toLocaleString()}**. `;
    }

    // 2. Product Suggestions
    const productSuggestions: string[] = [];
    if (topItems.length > 0) {
        productSuggestions.push(`Bundled offer: Create a discount for ${topItems[0]} when paired with a new arrival.`);
    }
    if (topCategory) {
        const otherInCategory = allProducts
            .filter(p => p.category === topCategory && !topItems.includes(p.name))
            .slice(0, 2)
            .map(p => p.name);
        if (otherInCategory.length > 0) {
            productSuggestions.push(`Upsell ${otherInCategory.join(' or ')} based on their interest in ${topCategory}.`);
        }
    }
    
    // 3. Engagement Tactics
    const engagementTactics: string[] = [];
    if (segment === 'VIP Patron') {
        engagementTactics.push('Exclusive Reward: Send a "Thank You" note with a personalized 15% discount code.');
        engagementTactics.push('Priority Service: Flag this customer for express handling on all future orders.');
    } else if (segment === 'Loyal Customer') {
        engagementTactics.push('Referral Incentive: Offer 500 bonus points for every friend they refer to the shop.');
        engagementTactics.push('Feedback Request: Ask for a testimonial or review to help grow your brand.');
    } else {
        engagementTactics.push('Retention Offer: Send a 10% discount on their favorite category to encourage a repeat visit.');
    }

    return {
        summary,
        productSuggestions: productSuggestions.length > 0 ? productSuggestions : ['Analyze more transactions to unlock tailored suggestions.'],
        engagementTactics: engagementTactics.length > 0 ? engagementTactics : ['Focus on building a relationship with this new customer.'],
        createdAt: new Date()
    };
}
