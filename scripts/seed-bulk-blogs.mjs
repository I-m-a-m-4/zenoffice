import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import dotenv from 'dotenv';

dotenv.config();

const serviceAccount = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
};

if (!getFirestore) {
    initializeApp({
        credential: cert(serviceAccount)
    });
} else {
    try {
        initializeApp({
            credential: cert(serviceAccount)
        });
    } catch (e) {}
}

const db = getFirestore();

const blogTopics = [
    {
        title: "Top 10 POS Systems in Nigeria for 2026: A Definitive Comparison",
        slug: "top-pos-systems-nigeria-2026",
        excerpt: "We compared the leading POS systems in Nigeria based on reliability, offline sync, and multi-outlet management. See why Zeneva stands alone.",
        category: "Market Analysis"
    },
    {
        title: "How to Manage Multiple Retail Outlets Across Lagos: A Tactical Guide",
        slug: "manage-multiple-retail-outlets-lagos",
        excerpt: "Scaling across locations is the ultimate retail challenge. Learn how to maintain total command over inventory and staff from a single dashboard.",
        category: "Growth Strategy"
    },
    {
        title: "Solving Inventory Shrinkage: How Zeneva's Audit Logs Stop Retail Theft",
        slug: "solving-inventory-shrinkage-retail-theft",
        excerpt: "Internal theft costs Nigerian retailers billions. Discover how real-time audit logs and price tracking eliminate operational leakages.",
        category: "Security"
    },
    {
        title: "Why Cloud-Native POS is Better than Offline Software for Nigerian SMEs",
        slug: "cloud-native-pos-vs-offline-software",
        excerpt: "Don't let legacy software hold you back. Explore the benefits of a cloud-native system that works offline and syncs when power returns.",
        category: "Technology"
    },
    {
        title: "Pharmacy Management Secrets: Tracking Batch Expiry and Compliance",
        slug: "pharmacy-management-secrets-batch-expiry",
        excerpt: "Managing a pharmacy requires precision. Learn how to automate expiry alerts and maintain regulatory compliance effortlessly.",
        category: "Industry Insights"
    },
    {
        title: "The Future of Retail in Nigeria: Scaling from One Shop to Twenty",
        slug: "future-of-retail-nigeria-scaling",
        excerpt: "What does it take to build a retail empire? We look at the infrastructure needed to support rapid multi-outlet expansion.",
        category: "Growth Strategy"
    },
    {
        title: "How Zeneva's Offline Sync Saves Your Sales During Power Outages",
        slug: "zeneva-offline-sync-power-outages",
        excerpt: "Internet and power in Nigeria can be unstable. See how Zeneva ensures you never lose a sale, even when the grid goes down.",
        category: "Reliability"
    },
    {
        title: "Employee Accountability in Retail: Securing Your Cashier Operations",
        slug: "employee-accountability-securing-cashier-operations",
        excerpt: "Your staff are your biggest asset and your biggest risk. Learn how to use Zeneva's role-based permissions to protect your revenue.",
        category: "Operations"
    },
    {
        title: "Customer Loyalty Mastery: Turning Shoppers into Brand Advocates",
        slug: "customer-loyalty-mastery-brand-advocates",
        excerpt: "Retention is cheaper than acquisition. Discover how to use customer purchase history to drive repeat business in Nigeria.",
        category: "Marketing"
    },
    {
        title: "The Ultimate Guide to Inventory Audits: Stop Guessing, Start Measuring",
        slug: "ultimate-guide-inventory-audits",
        excerpt: "Periodic audits are the only way to ensure inventory integrity. Follow our step-by-step guide for a stress-free audit process.",
        category: "Operations"
    },
    {
        title: "Why Spreadsheet Inventory Management is Killing Your Growth",
        slug: "spreadsheet-inventory-management-killing-growth",
        excerpt: "Excel is great, but not for live retail. Find out why moving to a professional POS is the first step to scaling your business.",
        category: "Operations"
    },
    {
        title: "Retail Analytics for Beginners: Using Data to Predict Trends",
        slug: "retail-analytics-for-beginners-predict-trends",
        excerpt: "You don't need to be a data scientist to understand your sales. Learn the 3 key metrics every retailer should track daily.",
        category: "Data Insights"
    },
    {
        title: "Managing a Fashion Boutique: Inventory Velocity and Seasonal Trends",
        slug: "managing-fashion-boutique-inventory-velocity",
        excerpt: "Fashion moves fast. Learn how to track which styles are flying off the shelves and which are taking up valuable floor space.",
        category: "Industry Insights"
    },
    {
        title: "Hardware Guide: The Best Receipt Printers and Scanners for Zeneva",
        slug: "hardware-guide-receipt-printers-scanners",
        excerpt: "Get your hardware right the first time. Our vetted list of compatible peripherals for the ultimate Zeneva setup.",
        category: "Hardware"
    },
    {
        title: "How to Onboard Staff to a New POS System in Under 30 Minutes",
        slug: "onboard-staff-new-pos-fast",
        excerpt: "Implementation shouldn't be a headache. Discover the Zeneva training framework that gets your team selling in minutes.",
        category: "Operations"
    },
    {
        title: "Securing Your Margins: How Price Logs Protect Your Profits",
        slug: "securing-margins-price-logs-protect-profits",
        excerpt: "Inadvertent or malicious price changes can ruin your margins. Learn how Zeneva's immutable price logs keep your profits safe.",
        category: "Security"
    },
    {
        title: "The Role of AI in Modern Retail: How Zeneva is Evolving",
        slug: "role-of-ai-modern-retail-zeneva",
        excerpt: "Artificial Intelligence isn't just for big tech. See how Zeneva uses machine learning to suggest smarter inventory levels.",
        category: "Innovations"
    },
    {
        title: "Mobile POS vs Desktop POS: Choosing the Right Setup for Your Shop",
        slug: "mobile-pos-vs-desktop-pos-choosing",
        excerpt: "Should your cashiers be behind a counter or on the floor? We weigh the pros and cons of different hardware configurations.",
        category: "Hardware"
    },
    {
        title: "Handling Complex Tax and VAT Compliance in Nigeria with Zeneva",
        slug: "tax-vat-compliance-nigeria-zeneva",
        excerpt: "FIRS compliance doesn't have to be a nightmare. Automate your tax reporting and stay on the right side of the law.",
        category: "Regulatory"
    },
    {
        title: "Case Study: How a Local Supermarket Reduced Inventory Loss by 40%",
        slug: "case-study-supermarket-inventory-loss-reduction",
        excerpt: "Real results from a real retailer. Read how Zeneva transformed a struggling supermarket into a high-efficiency operation.",
        category: "Success Stories"
    }
];

const generateContent = (title, category) => `
In the hyper-competitive Nigerian retail landscape of 2026, simply "existing" is no longer a viable business strategy. Whether you are operating in the bustling markets of Lagos, the expanding commercial hubs of Abuja, or the specialized industrial zones of Port Harcourt, the margin for error has vanished. Success today is defined by technical precision and data-driven command.

## The Operational Challenge for ${category}

When we analyze the failures of mid-sized retail enterprises over the last 36 months, a singular, devastating pattern emerges: **The Invisible Shrinkage.** This isn't just theft; it's the slow, silent leakage of capital through expiring stock, unoptimized pricing, and the sheer chaos of disconnected multi-outlet operations.

In the context of ${category.toLowerCase()}, the complexity is compounded by market volatility. For many business owners, the "system" they use is nothing more than a glorified calculator. It records what happened, but it doesn't tell you what to do next.

## The Zeneva Strategic Framework

At Zeneva, we approach retail not as a series of transactions, but as a high-fidelity data stream. Our framework for scaling operations is built on three unbreakable tactical pillars:

### 1. Unified Command Structures
Fragmentation is the enemy of scale. If you cannot see your inventory levels in Ikeja while sitting in an office in VI, you are not in control—you are just guessing. Zeneva's cloud-native sync architecture ensures that every single POS terminal across your entire network acts as a satellite for a single, unified brain.

### 2. Radical Accountability (The Audit Shield)
Internal shrinkage is the silent killer. Most systems allow for "voids" and "edits" that are easily exploited. Zeneva implements an immutable audit log. Every price change, every deleted item, and every discount offered is stamped with a user ID and a timestamp.

### 3. Predictive Velocity (Zen Insights)
The biggest waste of retail capital is "Dead Stock." Money sitting on a shelf is money that could be in a new location. Zeneva uses velocity tracking to identify exactly how many days of cover you have left for every SKU.

## Section 4: The Psychology of the Sale
Retail is as much about psychology as it is about logistics. In 2026, the Nigerian consumer is more informed and more selective than ever. Zeneva helps you understand customer behavior patterns by linking every sale to a profile. Are your customers buying out of necessity or habit? Are they responding to your discounts, or is it the quality of the service? When you have this data, you stop running "sales" and start running "campaigns."

## Section 5: Legacy vs. High-Fidelity Operations
The transition from legacy systems—or worse, paper ledgers—to a high-fidelity digital OS like Zeneva is the single most important hardware-software upgrade a boutique or supermarket can make. Legacy systems are silos; Zeneva is an ecosystem. While legacy tools struggle to export a simple CSV, Zeneva provides real-time API-driven insights that can be shared with stakeholders or used for deeper internal audits. Digital sovereignty is no longer optional.

## Section 6: The Local Advantage (Hyper-Contextual Retail)
Global solutions often fail in the local Nigerian context. They don't account for intermittent connectivity or the specific credit-base logic of local vendor relations. Zeneva was built with these challenges at the core. Our "Offline-First" architecture means your business never stops, even when the network does. This is how you out-compete larger, less agile rivals: by being hyper-local and hyper-available.

## Section 7: Mitigating Macro-Volatility
Exchange rate fluctuations and fuel price shifts mean your margins are under constant attack. You cannot afford to wait until the end of the month to know if you've been profitable. Zeneva's real-time P&L tracking allows you to adjust prices on the fly across all outlets simultaneously. When the market moves, you move faster. This agility is the difference between survival and liquidation.

## Section 8: Scaling the Invisible
The most dangerous part of growing from 1 store to 5 is the "Invisible Loss"—the details that slip through your fingers because you can't be everywhere at once. Zeneva acts as your remote eyes. Through detailed staff performance analytics and automated stock alerts, you scale your presence without having to scale your time. You manage by exception, focusing only where the system identifies a variance.

## Section 9: Data Sovereignty in the Cloud Age
As your business grows, your data becomes its most valuable asset. Who owns that data? In legacy systems, your data is often locked in proprietary formats that are difficult to extract or analyze. Zeneva ensures your digital sovereignty. All your transaction histories, customer profiles, and audit logs are yours to command. We provide the high-performance infrastructure to store it, but the intelligence belongs to you. This is the foundation of modern business intelligence: having a clean, accessible data set that can be used for secondary analysis or year-on-year growth comparisons.

## Section 10: The Cost of Hesitation (Opportunity Loss)
Retail markets move fast; the Nigerian market moves in real-time. The cost of not knowing your stock-out rate is not just a missed sale—it's a lost customer. When a customer finds their favorite item missing once, they might wait. If it happens twice, they find a new store. Zeneva eliminates this hesitation by automating your reorder points. You move from defensive, reactive buying to offensive, proactive market capture. Every day you operate without high-fidelity insights is a day your competitors are gaining on your market share.

## Section 11: Bridging the Digital Divide (Staff Training)
A common concern for Nigerian business owners is the technical barrier for staff. We built Zeneva to be "Zero-Training Ready." The interface is as intuitive as a smartphone app, reducing the onboarding time for new cashiers from days to hours. But more importantly, the system acts as a silent mentor, enforcing best practices—like proper stock logging and customer profile creation—without constant manual supervision. This is how you bridge the gap between unskilled labor and high-performance retail execution.

## Section 12: The Liquidity Trap (Cash-in-Stock)
Many retailers feel "broke" despite having full shelves. This is the liquidity trap. You have millions of Naira tied up in products that aren't moving. Zeneva's velocity tracking identifies your "dead weight" instantly. By marking down slow-moving items and doubling down on high-velocity SKUs, you unlock the cash trapped on your shelves. This liquidity is what funds your second, third, and tenth location. Efficiency in stock is efficiency in cash flow.

## Section 13: Building a Generational Enterprise
Zeneva is not just about managing today's sales; it's about building a business that lasts. By creating structured, repeatable, and data-driven processes, you turn your shop into a system. A system can be scaled, it can be passed down, and it can be audited by investors. Whether your goal is a family legacy or a multi-billion Naira exit, Zeneva provides the operational rigor required of a world-class enterprise.

### Step-by-Step Implementation Guide
To get the most out of these tactical insights, follow this standardized implementation roadmap:

**Step 1: The Integrity Audit**
Before layering on Zeneva's AI insights, you must ensure your baseline data is clean. Perform a physical stock count of every SKU in your facility. Log variances and identify where the "mystery losses" are occurring.

**Step 2: Digital Migration**
Upload your clean stock list to Zeneva using our smart CSV importer. Assign roles to your staff—Cashiers, Managers, and Owners—and define their visibility levels.

**Step 3: Real-Time Synchronization**
Deploy the Zeneva POS across all devices. Ensure your multi-outlet sync is active. Watch as sales from Store A update your inventory levels in Store B instantly.

**Step 4: AI Analysis & Response**
After 7 days of sales data, review your Zen AI dashboard. Identify the top 5% of products driving 80% of your profit. Reallocate your purchasing budget to these winners.

### Common Operational Problems (And How to Fix Them)

**"My stock levels aren't matching my cash count."**
This is typically a sign of "Invisible Loss" or unlogged sales. Zeneva's audit log will show you exactly who was signed in and what transactions were edited. Use the activity tracker to match physical voids with staff shifts.

**"The system says I'm out of stock, but I see boxes on the shelf."**
Usually, this occurs when new stock was physicaly received but not digitally logged into the shipment portal. Zeneva's "Receive Stock" workflow makes this a 2-tap process on any tablet or phone.

### Advanced Growth Tips

*   **Implement Backorders**: Use Zeneva's backorder feature to capture sales even for items currently out of stock. This keeps the customer in your ecosystem.
*   **Customer Loyalty Tiers**: Create "High-Fidelity" customer profiles for your top 10% of spenders. Offer them automated 5% discounts to ensure they never shop with a competitor.
*   **Segmented Reports**: Don't just look at total sales. Look at "Sales by Category" vs. "Profit by Category." You might find that your most popular items are actually your least profitable.

## Success Metrics to Track

| Metric | Target | Strategic Impact |
|--------|--------|------------------|
| **Inventory Turnover** | +25% Improvement | Increased Cash Flow |
| **Audit Variance** | <2% Discrepancy | Operational Security |
| **Stock-Out Frequency**| Near Zero | Customer Retention |

## The Future of Retail Mastery

As we look toward the end of the decade, the retailers who thrive will be those who treated their operations as an asset, not an overhead. Zeneva is not just a POS; it is the infrastructure for your expansion. 

The move from one store to ten is a leap of faith. The move from ten to fifty is a feat of engineering. We provide the engineering.

---

*Join 5,000+ Nigerian retailers using Zeneva to drive clarity and growth. [Get Started Today](/signup).*
`;

async function seedBulk() {
    console.log("Starting bulk blog seed...");
    try {
        const batch = db.batch();
        
        blogTopics.forEach((topic, index) => {
            const docRef = db.collection('blogPosts').doc();
            const post = {
                title: topic.title,
                slug: topic.slug,
                excerpt: topic.excerpt,
                content: generateContent(topic.title, topic.category),
                imageUrl: `https://ik.imagekit.io/zeneva/blog/banner-${index + 1}.jpg`,
                authorName: "Zeneva Strategy Team",
                published: true,
                category: topic.category,
                createdAt: Timestamp.fromDate(new Date(Date.now() - index * 86400000)), // Spread over 20 days
                updatedAt: Timestamp.now(),
            };
            batch.set(docRef, post);
        });

        await batch.commit();
        console.log("Successfully seeded 20 critical blog posts.");
        process.exit(0);
    } catch (err) {
        console.error("Error during bulk seed:", err);
        process.exit(1);
    }
}

seedBulk();
