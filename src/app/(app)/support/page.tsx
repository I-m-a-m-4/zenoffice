

'use client';
import { useRouter } from 'next/navigation';

import * as React from 'react';
import { createPortal } from 'react-dom';
import PageTitle from '@/components/shared/page-title';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Bot, HelpCircle, Loader2, Send, MessageSquare, Search as SearchIcon, ShieldCheck, Monitor, Cloud, Github, Zap, Lock, CreditCard, Users, History, Settings, TrendingUp, Info, Paperclip, Mic, Image as ImageIcon, Play, Pause, Trash2, X, Check, CheckCheck, Clock, Reply, ChevronDown } from 'lucide-react';
import { useUser, useFirestore, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, query, where, addDoc, serverTimestamp, doc, setDoc, orderBy, limit, deleteDoc, updateDoc } from 'firebase/firestore';
import type { SupportThread, SupportMessage, UserProfile } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatDistanceToNow, format } from 'date-fns';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { zenevaSupportChat, type ZenevaSupportChatInput } from '@/ai/flows/support-chat-flow';
import AIChat from '@/components/support/ai-chat';
import { cn } from '@/lib/utils';
import { usePOS } from '@/context/pos-context';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { MoreVertical, Edit2, Maximize2, Minimize2 } from 'lucide-react';
import { acquireMicStream, describeMicError, pickAudioMimeType } from '@/lib/mic';
import { useI18n } from '@/context/i18n-context';
import { ToastAction } from '@/components/ui/toast';
import { idToken } from '@/lib/id-token';
import { playNotificationSound } from '@/lib/sound';

/**
 * How many messages of a support thread are loaded. The listener was
 * unbounded, so a long-running ticket re-downloaded its entire history every
 * time the thread was opened. 200 covers any realistic conversation; older
 * messages stay in Firestore and are still visible to the admin side.
 */
const SUPPORT_MESSAGE_LIMIT = 200;

const faqItems: { question: string; answer: React.ReactNode; id?: string; tags: string[] }[] = [
  // --- CATEGORY: OFFLINE & SYNC (5) ---
  {
    question: "How exactly does the Offline-First synchronization work?",
    tags: ["offline", "sync", "internet", "data"],
    answer: (
        <div className="space-y-4">
            <p className="text-sm">Zeneva's core philosophy is that **your business should never wait for the internet.**</p>
            <div className="relative p-5 rounded-2xl bg-gradient-to-br from-primary/5 to-transparent border border-primary/10">
                <div className="space-y-4">
                    <div className="flex gap-3">
                        <Monitor className="h-5 w-5 text-primary shrink-0 mt-1" />
                        <div>
                            <p className="font-bold text-sm">Edge Computing</p>
                            <p className="text-xs text-muted-foreground">Every sale is processed locally on your hardware. Even without internet, your POS is fully functional.</p>
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <Cloud className="h-5 w-5 text-blue-500 shrink-0 mt-1" />
                        <div>
                            <p className="font-bold text-sm">Transactional Queueing</p>
                            <p className="text-xs text-muted-foreground">Actions made offline are queued and processed in exact order once a connection is detected to ensure data integrity.</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
  },
  {
      question: "What happens if I make a sale while the internet is completely out?",
      tags: ["pos", "offline", "sale", "offline-sync"],
      answer: <p className="text-sm">Nothing changes for your customer. You scan items, accept cash/local payments, and print the receipt exactly as usual. The status bar will show "Offline". Once internet returns, the app will silently upload the receipt in the background.</p>
  },
  {
      question: "How do I know if my data has finished syncing to the cloud?",
      tags: ["sync", "status", "cloud", "indicator"],
      answer: <p className="text-sm">Look at the **Connection Badge** in the top-right corner. A rotating loader or a "Syncing..." label indicates data is moving. A green "Online" or "Synced" checkmark means your cloud dashboard is up to date.</p>
  },
  {
      question: "Can I manage my inventory while offline?",
      tags: ["offline", "inventory", "edit", "add-product"],
      answer: <p className="text-sm">Yes. You can add new products, update prices, and edit stock levels while offline. These changes are saved to your local SQLite database and will synchronize to your online dashboard once you reconnect.</p>
  },
  {
      question: "Does the search function work when I'm offline?",
      tags: ["search", "offline-search", "products"],
      answer: <p className="text-sm">Yes. Zeneva stores your entire product and customer database locally. Searching by name, SKU, or category is just as fast (and sometimes faster) when offline because it queries your local drive directly.</p>
  },

  // --- CATEGORY: POS & SALES (8) ---
  {
    question: "Using barcode scanners for high-speed POS checkouts",
    tags: ["barcode", "scanner", "pos", "sku"],
    answer: (
      <div className="space-y-4">
        <p className="text-sm">Zeneva is optimized for **Zero-Latency Scanning**. Simply connect your USB or Bluetooth scanner. In the POS interface, just scan, and the item is instantly added to the cart.</p>
        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-xs leading-relaxed border border-blue-100 dark:border-blue-800">
            <strong>Pro Tip:</strong> Ensure your scanner is set to "Keyboard Mode" with a Carriage Return (Enter) suffix enabled.
        </div>
      </div>
    )
  },
  {
      question: "How do I perform a split payment (Cash + Card)?",
      tags: ["payment", "split", "pos", "checkout"],
      answer: <p className="text-sm">In the Checkout dialog, enter the amount being paid in the first method (e.g., Cash). Clicking the "+" next to the payment field allows you to add a second method for the remaining balance.</p>
  },
  {
      question: "Can I save a cart and recall it later (On-Hold Orders)?",
      tags: ["pos", "hold", "save-cart", "orders"],
      answer: <p className="text-sm">Yes. If a customer forgets their wallet, click the "Hold" button. You can serve the next customer, and then recall the held order when the first customer returns.</p>
  },
  {
      question: "How do I issue a refund for a returned item?",
      tags: ["refund", "return", "pos", "receipt"],
      answer: <p className="text-sm">Go to **Sales History**, find the receipt, and click "Process Refund". You can choose to refund the entire receipt or select specific items that were returned.</p>
  },
  {
      question: "Can I reprint a receipt from yesterday?",
      tags: ["receipt", "reprint", "history"],
      answer: <p className="text-sm">Yes. Navigate to the **Sales History** tab, locate the transaction by date, receipt number, or customer name, and click the "Print Receipt" icon.</p>
  },
  {
      question: "How do I sell an item with variable weight (e.g., meat, vegetables)?",
      tags: ["weight", "variable", "scale", "products"],
      answer: <p className="text-sm">When adding the product to your inventory, set its unit to 'kg' or 'lbs'. When adding it to the cart in the POS, you will be prompted to enter the exact weight, and Zeneva will calculate the price automatically.</p>
  },
  {
      question: "Does Zeneva support thermal printers and cash drawers?",
      tags: ["printer", "thermal", "cash-drawer", "hardware"],
      answer: <p className="text-sm">Yes. Zeneva communicates directly with your operating system's print spooler. Any ESC/POS thermal printer (58mm or 80mm) installed on your OS will work perfectly. Cash drawers connected via the printer's RJ11 port will kick open automatically on cash sales.</p>
  },
  {
      question: "How do I apply a discount to the entire order?",
      tags: ["discount", "pos", "checkout", "cart"],
      answer: <p className="text-sm">In the POS interface, click the "Discount" button below the subtotal. You can apply either a percentage (%) discount or a fixed amount discount to the entire cart.</p>
  },

  // --- CATEGORY: INSTALLATION & DESKTOP (4) ---
  {
      question: "What are the minimum system requirements for Zeneva Desktop?",
      tags: ["system", "requirements", "windows", "mac", "linux"],
      answer: <p className="text-sm">Zeneva is optimized to run on modest hardware. Minimum: Windows 10/11 (64-bit), 4GB RAM, and 500MB disk space. For the best experience with Zen AI local processing, we recommend 8GB RAM and an SSD.</p>
  },
  {
      question: "How do I update the desktop application to the latest version?",
      tags: ["update", "version", "download", "auto-update"],
      answer: <p className="text-sm">Zeneva checks for updates every time it launches. If a new version (e.g., v0.5.8) is available, you will see a "New Version Available" button in the Top Title Bar. Simply click it to download and relaunch with the latest features.</p>
  },
  {
      question: "Can I run Zeneva on multiple computers at the same time?",
      tags: ["multi-device", "login", "synced"],
      answer: <p className="text-sm">Yes. Your subscription allows you to log in on multiple terminals. Every sale made on one computer will synchronize with the others as soon as they are online, giving you a real-time view of your entire store.</p>
  },
  {
      question: "How to fix 'Database Initialization Error' on startup?",
      tags: ["error", "database", "sqlite", "fix"],
      answer: <p className="text-sm">This usually happens if the application is prevented from writing to its data folder. Try running Zeneva as an Administrator, or ensure that your Antivirus isn't blocking the `zeneva.db` file in your AppData directory.</p>
  },
  {
      question: "What thermal printers and hardware are supported?",
      tags: ["printer", "receipt", "hardware", "thermal"],
      answer: <p className="text-sm">We support all standard **ESC/POS** hardware. 80mm high-speed thermal printers are recommended, but 58mm portable Bluetooth printers also work perfectly with our adaptive formatting engine.</p>
  },
  {
      question: "How do I handle returns and partial refunds?",
      tags: ["refund", "return", "sales", "transaction"],
      answer: <p className="text-sm">Inside the 'Receipts' module, select the transaction and click **"Initiate Return"**. You can choose to return specific items (Partial) or the entire order (Full). Stock levels will be auto-corrected.</p>
  },
  {
      question: "Can I apply discounts to a whole order or just single items?",
      tags: ["discount", "pos", "coupon", "price"],
      answer: <p className="text-sm">Both! You can click on an individual item in the cart to set a specific discount, or use the **"Group Discount"** button at the bottom to apply a percentage or fixed-amount deduction to the entire total.</p>
  },
  {
      question: "How does the POS handle taxes and inclusive/exclusive pricing?",
      tags: ["tax", "vat", "accounting", "pos"],
      answer: <p className="text-sm">Under Business Settings, you can configure your tax rate (e.g., VAT 7.5%). You can decide whether your shelf prices already include tax or if tax should be added at the point of sale.</p>
  },

  // --- CATEGORY: INVENTORY & PRODUCTS (8) ---
  {
      question: "How do I add variation products (e.g., Colors/Sizes)?",
      tags: ["inventory", "product", "variation"],
      answer: (
          <p className="text-sm">When adding a product, enable the **"Variations"** switch. You can then add multiple types (e.g., Red, Blue, L, XL) and set individual stock levels and even different prices for each variation while keeping them under a single product entry.</p>
      )
  },
  {
      question: "What is the difference between a Product and a Service?",
      tags: ["inventory", "service", "stock"],
      answer: <p className="text-sm">Products are physical items with stock levels that decrement when sold. Services (like "Installation" or "Consulting") have no stock limit and don't require inventory tracking, making them always available for sale.</p>
  },
  {
      question: "How do I bulk import my products from an Excel or CSV file?",
      tags: ["import", "bulk", "csv", "excel", "inventory"],
      answer: <p className="text-sm">Go to **Inventory {'->'} Import**. Download our template CSV, fill in your product names, SKUs, and prices, and upload it. Zeneva can process thousands of products in seconds.</p>
  },
  {
    question: "Setting up Low Stock & Expiry Date alerts",
    tags: ["alerts", "inventory", "stock", "expiry"],
    answer: <p className="text-sm">Under each product's settings, you can define a **Minimum Stock Level**. Zeneva will proactively alert you when stock falls below this. You can also enable **Expiry Date tracking** for perishable goods.</p>
  },
  {
      question: "Can I track the 'Cost Price' to calculate profit margins?",
      tags: ["margin", "profit", "cost", "accounting"],
      answer: <p className="text-sm">Yes. By entering the Cost Price (your buy price) and Selling Price, Zen AI can automatically calculate your **Gross Profit Margin** and show you which items are your biggest money-makers.</p>
  },
  {
      question: "How do I perform a stock adjustment or audit (Visual Count)?",
      tags: ["audit", "stock-take", "adjustment", "inventory"],
      answer: <p className="text-sm">Use the **Visual Count** feature in the Inventory module. You can scan or select items and enter their actual shelf count. Zeneva will log the difference as a 'Stock Adjustment' in your audit trails.</p>
  },
  {
      question: "Does Zeneva support composite products (Bundles/Kits)?",
      tags: ["bundle", "kit", "composite", "inventory"],
      answer: <p className="text-sm">Yes. You can create a 'Bundle' product that is linked to multiple other items. When the bundle is sold, the stock levels for all its components are automatically decremented.</p>
  },
  {
      question: "How to export inventory reports for accounting?",
      tags: ["export", "accounting", "reports", "excel"],
      answer: <p className="text-sm">In the Reports module, go to **Inventory Valuation**. You can download a high-fidelity PDF or Excel sheet showing every item you own, its current value, and its total asset worth.</p>
  },

  // --- CATEGORY: ZEN AI & INTELLIGENCE (4) ---
  {
    question: "What is Zen AI and how does it maximize my profit?",
    tags: ["ai", "insight", "business", "profit"],
    answer: (
        <div className="space-y-4">
            <p className="text-sm">Zen AI acts as an **Artificial General Intelligence for your Store**. It identifies patterns in your sales that are often hidden.</p>
            <ul className="space-y-3">
                <li className="flex items-center gap-3 p-3 bg-secondary/30 rounded-lg">
                    <Badge variant="outline" className="bg-primary text-primary-foreground border-none text-[10px]">Predictive</Badge>
                    <span className="text-xs">Tells you which items will run out next week based on purchase velocity.</span>
                </li>
                <li className="flex items-center gap-3 p-3 bg-secondary/30 rounded-lg">
                    <Badge variant="outline" className="bg-emerald-500 text-white border-none text-[10px]">Smart Pricing</Badge>
                    <span className="text-xs">Suggests price adjustments based on item demand and sales frequency.</span>
                </li>
            </ul>
        </div>
    )
  },
  {
      question: "Can I generate AI insights while I am offline?",
      tags: ["ai", "offline", "intelligence"],
      answer: <p className="text-sm">Yes. Zeneva's core intelligence module is deterministic and runs locally on your computer. It analyzes your SQLite data to provide "Customer Intelligence" and "Sales Forecasts" even without internet.</p>
  },
  {
      question: "How do I use 'Report Builder' for custom analysis?",
      tags: ["reports", "custom", "ai", "builder"],
      answer: <p className="text-sm">The Report Builder allows you to combine different data points (e.g., Sales by Staff vs. Category). Zen AI can then interpret this data to show you a text-based "Strategic Summary" of your performance.</p>
  },
  {
      question: "Does the AI learn from my specific business habits?",
      tags: ["ai", "learning", "data"],
      answer: <p className="text-sm">Zen AI respects your privacy. It analyzes your data locally on your device to build a model of your business's "Sales Velocity". This data is never used to train global models that your competitors could see.</p>
  },

  // --- CATEGORY: CUSTOMERS & CRM (5) ---
  {
    question: "Managing High-Value Rewards & Loyalty Programs",
    tags: ["loyalty", "points", "customer", "rewards"],
    answer: <p className="text-sm">Zeneva includes a powerful **CRM suite**. You can enable loyalty points and set reward thresholds (e.g., 1 point per ₦100 spent). Customers can then redeem these for discounts during checkout.</p>
  },
  {
      question: "How do I track 'Store Credit' for my frequent buyers?",
      tags: ["credit", "customer", "debt", "crm"],
      answer: <p className="text-sm">In the Customer profile, you can view their 'Wallet'. If a customer overpays or has a refund returned to store credit, it is tracked here and can be selected as a payment method in the POS.</p>
  },
  {
      question: "Can I capture customer phone numbers and emails at checkout?",
      tags: ["crm", "customer", "data-collection"],
      answer: <p className="text-sm">Yes. At checkout, you can quickly search for an existing customer or click "+" to add a new one. This allows you to track their purchase history and generate AI segments for them.</p>
  },
  {
      question: "What are 'Customer Segments' and how do I use them?",
      tags: ["marketing", "segments", "vip", "churn"],
      answer: <p className="text-sm">Zen AI automatically categorizes your buyers into groups like **"VIP Patrons"** (High spend), **"At-Risk"** (Haven't visited recently), and **"Occasional Buyers"**. This helps you know who to send special offers to.</p>
  },
  {
      question: "Can I manage customer debts (Buy Now Pay Later)?",
      tags: ["debt", "credit", "sales", "unpaid"],
      answer: <p className="text-sm">Yes. Zeneva allows you to record an order as 'Unpaid'. It will track the outstanding balance on the customer's profile, and you can record payments against that debt later to balance the books.</p>
  },

  // --- CATEGORY: SECURITY & MULTI-STORE (5) ---
  {
      question: "How do I add staff members and manage their permissions?",
      tags: ["staff", "users", "permissions", "security"],
      answer: (
          <div className="space-y-3">
              <p className="text-sm">Go to **Settings {'->'} Staff Management**. You can invite team members and assign them roles:</p>
              <ul className="text-xs space-y-2 list-disc list-inside text-muted-foreground">
                  <li><strong className="text-foreground">Cashier:</strong> Only POS access, no reports or deleting items.</li>
                  <li><strong className="text-foreground">Manager:</strong> Full ops, but no business-level settings.</li>
                  <li><strong className="text-foreground">Auditor:</strong> Read-only access to all financial reports.</li>
              </ul>
          </div>
      )
  },
  {
    question: "Reviewing the Secure Audit Trail & Action Logs",
    tags: ["audit", "logs", "security", "tracking"],
    answer: <p className="text-sm">Every critical action—deleting an order, changing a price, or editing stock—is recorded in the **Immutable Audit Log**. You can see exactly WHO did WHAT and WHEN they did it.</p>
  },
  {
    question: "Is my business data backed up and secure in the cloud?",
    tags: ["backup", "security", "data", "cloud"],
    answer: <p className="text-sm">Security is our priority. We use **AES-256 Encryption** for data at rest and SSL/TLS for transit. Every night, a redundant backup is created in the cloud to ensure you never lose a single digit.</p>
  },
  {
      question: "Can I manage multiple shops under one account?",
      tags: ["multi-store", "outlet", "enterprise"],
      answer: <p className="text-sm">Absolutely. Zeneva is an **Enterprise-Ready architecture**. You can create multiple 'Outlets' and monitor stock transfers, individual shop profits, and total company performance from one master dashboard.</p>
  },
  {
      question: "How do I enable Two-Factor Authentication (2FA)?",
      tags: ["security", "2fa", "mfa", "protection"],
      answer: <p className="text-sm">Go to **Settings {'->'} My Profile**. You can enable MFA via an Authenticator App (like Google Authenticator). This ensures that even if someone knows your password, they cannot access your business data without your phone.</p>
  },
  
  // --- CATEGORY: BILLING & ACCOUNT (5) ---
  {
      question: "How do I upgrade or cancel my Zeneva subscription?",
      tags: ["billing", "subscription", "upgrade", "cancel"],
      answer: <p className="text-sm">You can manage your plan under **Settings {'->'} Subscription**. To upgrade, select your preferred plan and follow the secure checkout. To cancel, click 'Downgrade to Starter' or contact support if you wish to close your business instance entirely.</p>
  },
  {
      question: "Will I lose my data if my subscription expires?",
      tags: ["billing", "data", "expiry", "safety"],
      answer: <p className="text-sm">No. We never delete your business data without your explicit request. If your subscription expires, your account will move to 'Read-Only' mode until a payment is made, allowing you to still view and export your past records.</p>
  },
  {
      question: "Can I get a custom plan for a large enterprise with 50+ stores?",
      tags: ["enterprise", "pricing", "custom", "multi-store"],
      answer: <p className="text-sm">Yes. We offer custom **Zeneva Enterprise** solutions for high-volume retailers. Please contact our Executive Support team via the chat above or email `enterprise@zeneva.ai` for a tailored quote and dedicated account manager.</p>
  },
  {
      question: "How do I change my business name or logo in the app?",
      tags: ["settings", "branding", "logo", "business-name"],
      answer: <p className="text-sm">Go to **Settings {'->'} Business Profile**. You can upload your high-resolution logo and change your trading name. These updates will instantly reflect on your printed receipts and online storefront.</p>
  },
  {
      question: "Does Zeneva offer a free trial for the Pro features?",
      tags: ["trial", "pricing", "pro", "free"],
      answer: <p className="text-sm">We don't run a trial — we do something better. Our **Starter plan is free forever** (up to 50 products), so there's no countdown and nothing gets taken away. When you need more products, more staff accounts or Zen AI, you can upgrade to Pro or Business at any time, and drop back to Starter whenever you like without losing any of your data.</p>
  }
];

type Message = {
    sender: 'user' | 'ai';
    text: string;
};

function ZenAIChatBot({ userProfile }: { userProfile?: UserProfile }) {
    const firestore = useFirestore();
    const [messages, setMessages] = React.useState<Message[]>([]);
    const [input, setInput] = React.useState('');
    const [isLoading, setIsLoading] = React.useState(false);
    const { toast } = useToast();
    const { t } = useI18n();

    React.useEffect(() => {
        let greeting = "Hi! I'm Zen AI. Ask me anything about Zeneva, or ask me to add a product to your inventory!";
        try {
            const historyStr = sessionStorage.getItem('zeneva_recent_pages');
            if (historyStr) {
                const history: string[] = JSON.parse(historyStr);
                const lastVisited = history.reverse().find(p => p !== '/support'); // Find the most recent non-support page
                
                if (lastVisited?.startsWith('/inventory')) {
                    greeting = "Hi there! Do you need help managing your products, or are you looking for advanced features like bulk editing and variations? I can guide you!";
                } else if (lastVisited?.startsWith('/sales/pos')) {
                    greeting = "Welcome! Are you looking for help setting up your POS, connecting a printer, or applying discounts? Just ask!";
                } else if (lastVisited?.startsWith('/settings')) {
                    greeting = "Hello! Need help configuring your store or setting up staff permissions? Let me know what you're looking for.";
                } else if (lastVisited?.startsWith('/reports') || lastVisited?.startsWith('/dashboard')) {
                    greeting = "Hi! Do you need help understanding a specific report or finding the right analytics for your business?";
                }
            }
        } catch (e) {
            console.warn("Failed to read page history", e);
        }
        setMessages([{ sender: 'ai', text: greeting }]);
    }, []);

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim()) return;

        const userMessage: Message = { sender: 'user', text: input };
        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);

        try {
            const response = await zenevaSupportChat({ query: input }, await idToken());
            let aiText = response.answer || (response as any).response || t('support.aiFallback');
            const isUnanswered = response.isUnanswered || false;

            if (isUnanswered) {
                aiText = "I'm not quite sure about that. I specialize in Zeneva features like inventory, POS, and analytics. If you need help with something specific, please rephrase or reach out to our human support team!";
            }

            const aiMessage: Message = { sender: 'ai', text: aiText };
            setMessages(prev => [...prev, aiMessage]);

            // Log to Firestore for admin review
            if (firestore && userProfile) {
                try {
                    // Standard log
                    await addDoc(collection(firestore, 'ai_support_logs'), {
                        userId: userProfile.id,
                        userName: userProfile.name,
                        userEmail: userProfile.email,
                        businessId: userProfile.currentBusinessId || 'none',
                        query: input,
                        response: aiText,
                        createdAt: serverTimestamp(),
                        isUnanswered
                    });

                    // Explicitly capture unanswered questions for review
                    if (isUnanswered) {
                        await addDoc(collection(firestore, 'ai_unanswered_questions'), {
                            userId: userProfile.id,
                            userName: userProfile.name,
                            businessId: userProfile.currentBusinessId || 'none',
                            query: input,
                            createdAt: serverTimestamp(),
                            status: 'pending' // For admin review workflow
                        });
                    }
                } catch (logError) {
                    console.error("Failed to log AI chat to Firestore:", logError);
                }
            }
        } catch (error) {
            console.error("AI chat error:", error);
            toast({
                variant: 'destructive',
                title: t('support.aiErrorTitle'),
                description: t('support.aiErrorDescription')
            });
            setMessages(prev => prev.filter(m => m !== userMessage));
        } finally {
            setIsLoading(false);
        }
    };
    
    return (
        <AIChat
            messages={messages}
            input={input}
            onInputChange={setInput}
            onSendMessage={handleSendMessage}
            isLoading={isLoading}
            className="h-[60vh]"
        />
    )
}




function getCleanAudioSource(voiceUrl: string): string {
    if (!voiceUrl) return '';
    if (voiceUrl.startsWith('http://') || voiceUrl.startsWith('https://') || voiceUrl.startsWith('blob:')) {
        return voiceUrl;
    }
    if (voiceUrl.startsWith('data:')) {
        try {
            const parts = voiceUrl.split(',');
            const header = parts[0];
            const mimeMatch = header.match(/:(.*?);/);
            let mime = mimeMatch ? mimeMatch[1] : 'audio/webm';
            if (!mime.includes('audio')) mime = 'audio/webm';
            
            const bstr = atob(parts[1]);
            let n = bstr.length;
            const u8arr = new Uint8Array(n);
            while (n--) {
                u8arr[n] = bstr.charCodeAt(n);
            }
            const blob = new Blob([u8arr], { type: mime });
            return URL.createObjectURL(blob);
        } catch (e) {
            console.error("Base64 audio conversion error:", e);
            return voiceUrl;
        }
    }
    return voiceUrl;
}

function VoiceNotePlayer({ voiceUrl, voiceDuration }: { voiceUrl: string; voiceDuration?: number }) {
    const [isPlaying, setIsPlaying] = React.useState(false);
    const [progress, setProgress] = React.useState(0);
    const [audioSrc, setAudioSrc] = React.useState<string>('');
    const audioRef = React.useRef<HTMLAudioElement | null>(null);
    const { t } = useI18n();

    React.useEffect(() => {
        if (voiceUrl) {
            const src = getCleanAudioSource(voiceUrl);
            setAudioSrc(src);
            return () => {
                if (src && src.startsWith('blob:')) {
                    URL.revokeObjectURL(src);
                }
            };
        }
    }, [voiceUrl]);

    const togglePlay = () => {
        if (!audioRef.current || !audioSrc) return;
        if (isPlaying) {
            audioRef.current.pause();
            setIsPlaying(false);
        } else {
            audioRef.current.play().then(() => setIsPlaying(true)).catch((err) => {
                console.warn("Audio playback error:", err);
            });
        }
    };

    return (
        <div className="flex items-center gap-3 p-2 min-w-[220px] bg-slate-100/80 dark:bg-slate-800/80 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
            {audioSrc && (
                <audio 
                    ref={audioRef} 
                    src={audioSrc} 
                    preload="auto"
                    onTimeUpdate={() => {
                        if (audioRef.current) {
                            const current = audioRef.current.currentTime;
                            const duration = audioRef.current.duration || voiceDuration || 1;
                            setProgress((current / duration) * 100);
                        }
                    }}
                    onEnded={() => {
                        setIsPlaying(false);
                        setProgress(0);
                    }}
                    onError={(e) => console.warn("Audio element load error:", e)}
                />
            )}
            <button 
                type="button"
                onClick={togglePlay}
                className="h-9 w-9 bg-orange-500 hover:bg-orange-600 text-white rounded-full flex items-center justify-center shadow-md transition-transform hover:scale-105 active:scale-95 shrink-0"
            >
                {isPlaying ? <Pause className="h-4 w-4 fill-white" /> : <Play className="h-4 w-4 fill-white ms-0.5" />}
            </button>
            <div className="flex-1 min-w-0 space-y-1">
                <div 
                    className="h-2 w-full bg-slate-300 dark:bg-slate-700 rounded-full overflow-hidden relative cursor-pointer"
                    onClick={(e) => {
                        if (!audioRef.current) return;
                        const rect = e.currentTarget.getBoundingClientRect();
                        const clickX = e.clientX - rect.left;
                        const pct = clickX / rect.width;
                        const duration = audioRef.current.duration || voiceDuration || 1;
                        audioRef.current.currentTime = pct * duration;
                        setProgress(pct * 100);
                    }}
                >
                    <div 
                        className="h-full bg-orange-500 transition-all duration-100 rounded-full"
                        style={{ width: `${progress}%` }}
                    />
                </div>
                <div className="flex items-center justify-between text-[10px] text-muted-foreground font-mono">
                    <span>🎙️ {t('support.voiceNote')}</span>
                    <span>{voiceDuration ? `${voiceDuration}s` : t('support.audio')}</span>
                </div>
            </div>
        </div>
    );
}

function UserSupportChat({ userProfile }: { userProfile: UserProfile }) {
    const router = useRouter();
    const { currentBusiness } = usePOS();
    const firestore = useFirestore();
    const { toast } = useToast();
    const { t } = useI18n();

    const [thread, setThread] = React.useState<SupportThread | null>(null);
    const [message, setMessage] = React.useState('');
    const [isLoading, setIsLoading] = React.useState(true);
    const [isSending, setIsSending] = React.useState(false);

    // Media & Voice states
    const [editModalOpen, setEditModalOpen] = React.useState(false);
    const [editMessageText, setEditMessageText] = React.useState('');
    const [editMessageId, setEditMessageId] = React.useState<string | null>(null);
    const [isRecording, setIsRecording] = React.useState(false);
    const [recordingSeconds, setRecordingSeconds] = React.useState(0);
    const recTimerRef = React.useRef<any>(null);
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    // Audio Playback & Media recorder references
    const [playingAudioId, setPlayingAudioId] = React.useState<string | null>(null);
    const [optimisticMessages, setOptimisticMessages] = React.useState<any[]>([]);
    const [previewFile, setPreviewFile] = React.useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
    const [caption, setCaption] = React.useState('');
    const [activeLightboxUrl, setActiveLightboxUrl] = React.useState<string | null>(null);
    const mediaRecorderRef = React.useRef<MediaRecorder | null>(null);
    const audioChunksRef = React.useRef<Blob[]>([]);
    const prevMessageCountRef = React.useRef(0);

    /**
     * Object URLs handed to an <img>, released only when this page unmounts.
     *
     * Revoking a blob URL is only safe once React has *committed* the removal of
     * the element showing it, and a `setState` does not do that synchronously. Both
     * revoke sites here used to sit on the line directly after the state update
     * that dropped the image — so the blob died while its `<img>` was still
     * mounted, and the next paint or reconcile re-requested a URL that no longer
     * resolved. Chrome reports that as `(blocked:other)` with 0 bytes, which is a
     * broken image with no error event and nothing in the console.
     *
     * It showed up on the image-send path in particular because the Firestore
     * listener delivers the real message at roughly the same moment, so the list
     * re-renders and the doomed optimistic node gets asked for its src again —
     * which is why one blob appeared blocked several times over in the network log.
     *
     * Deferring to unmount trades a few kilobytes per image touched in a session
     * for an ordering guarantee, which is the right way round: the volume is one
     * blob per image the user actually picks or sends, and the page is not
     * long-lived.
     */
    const blobUrlsRef = React.useRef<string[]>([]);
    const trackBlobUrl = React.useCallback((url: string) => {
        blobUrlsRef.current.push(url);
    }, []);
    React.useEffect(() => () => {
        blobUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
        blobUrlsRef.current = [];
    }, []);

    const threadQuery = useMemoFirebase(
        () => (firestore && userProfile?.id) ? query(collection(firestore, 'supportThreads'), where('userId', '==', userProfile.id)) : null,
        [firestore, userProfile?.id]
    );
    
    const { data: threads, isLoading: isLoadingThreads } = useCollection<SupportThread>(threadQuery);

    React.useEffect(() => {
        if (!isLoadingThreads) {
            if (threads && threads.length > 0) {
                const sorted = [...threads].sort((a, b) => {
                    const getMs = (t: any) => {
                        if (!t) return 0;
                        if (typeof t.toMillis === 'function') return t.toMillis();
                        if (t.seconds) return t.seconds * 1000;
                        return new Date(t).getTime() || 0;
                    };
                    return getMs(b.lastMessageAt || b.createdAt) - getMs(a.lastMessageAt || a.createdAt);
                });
                const activeThread = sorted[0];
                setThread(activeThread);
                // When the user opens the support page, clear the unread admin badge
                // by marking isReadByUser: true on any thread with a pending admin message.
                if (firestore && activeThread?.id && activeThread?.isReadByUser === false) {
                    updateDoc(doc(firestore, 'supportThreads', activeThread.id), { isReadByUser: true }).catch(() => {});
                }
            }
            setIsLoading(false);
        }
    }, [threads, isLoadingThreads]);
    
    // Bounded to the most recent SUPPORT_MESSAGE_LIMIT messages. Fetched
    // descending and reversed for display below: the thread renders oldest to
    // newest, so an ascending limit would have kept the *oldest* messages and
    // hidden the part of the conversation anyone actually needs.
    const messagesQuery = useMemoFirebase(
        () => (firestore && thread) ? query(collection(firestore, 'supportThreads', thread.id, 'messages'), orderBy('createdAt', 'desc'), limit(SUPPORT_MESSAGE_LIMIT)) : null,
        [firestore, thread]
    );

    const safeFormatFullTime = (val: any) => {
        if (!val) return '';
        try {
            const date = val.toDate ? val.toDate() : new Date(val);
            return format(date, 'PPpp');
        } catch (e) {
            return '';
        }
    };

    const safeFormatTime = (val: any) => {
        if (!val) return '';
        try {
            const date = val.toDate ? val.toDate() : new Date(val);
            return format(date, 'h:mm a');
        } catch (e) {
            return '';
        }
    };

    const { data: messages, isLoading: isLoadingMessages } = useCollection<SupportMessage>(messagesQuery);
    const scrollAreaRef = React.useRef<HTMLDivElement>(null);
    const chatContainerRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        if (previewUrl && chatContainerRef.current) {
            // Wait a tick for layout then smooth scroll into view
            setTimeout(() => {
                chatContainerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
            }, 100);
        }
    }, [previewUrl]);

    const allMessages = React.useMemo(() => {
        // messagesQuery fetches newest-first so the limit keeps recent history;
        // flip it back to chronological for the thread view.
        const chronological = [...(messages || [])].reverse();
        return [...chronological, ...optimisticMessages];
    }, [messages, optimisticMessages]);

    const scrollToBottom = React.useCallback((behavior: ScrollBehavior = 'smooth') => {
        if (scrollAreaRef.current) {
            const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
            if (scrollContainer) {
                scrollContainer.scrollTo({ top: scrollContainer.scrollHeight, behavior });
            }
        }
    }, []);

    React.useEffect(() => {
        if (allMessages && allMessages.length > 0) {
            if (prevMessageCountRef.current === 0) {
                scrollToBottom('auto');
                setTimeout(() => scrollToBottom('auto'), 50);
            } else if (allMessages.length > prevMessageCountRef.current) {
                scrollToBottom('smooth');
                const lastMsg = allMessages[allMessages.length - 1];
                if (lastMsg?.senderId === 'admin') {
                    playNotificationSound();
                }
            }
            prevMessageCountRef.current = allMessages.length;
        }
    }, [allMessages, scrollToBottom]);

    React.useEffect(() => {
        if (thread && firestore && messages) {
            messages.forEach((msg: any) => {
                if (msg.senderId === 'admin' && !msg.isSeen) {
                    const msgRef = doc(firestore, `supportThreads/${thread.id}/messages`, msg.id);
                    updateDoc(msgRef, { isSeen: true, isDelivered: true }).catch(err => {
                        console.warn("Failed to mark message as seen:", err);
                    });
                }
            });
        }
    }, [thread, firestore, messages]);

    const uploadImage = async (file: File): Promise<string> => {
        try {
            const formData = new FormData();
            formData.append('file', file);
            
            const response = await fetch('/api/upload', {
                method: 'POST',
                body: formData
            });
            
            if (response.ok) {
                const resData = await response.json();
                if (resData.url) {
                    return resData.url;
                }
            }
        } catch (e) {
            console.warn("ImageKit upload failed, falling back to ImgBB:", e);
        }
        return uploadImageToImgBB(file);
    };

    const uploadImageToImgBB = async (file: File): Promise<string> => {
        const apiKey = process.env.NEXT_PUBLIC_IMGBB_API_KEY || '2ec1d17c7ad748bbb605eda60a54a896';
        const formData = new FormData();
        formData.append('image', file);
        
        const response = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            throw new Error('Failed to upload image to ImgBB');
        }
        
        const resData = await response.json();
        return resData.data.url;
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Replacing an un-sent preview. The old blob's <img> is still mounted until
        // the state update below commits, so this goes to the registry too — the
        // rule is only useful if it holds everywhere.
        if (previewUrl) trackBlobUrl(previewUrl);

        // Generate local Object URL for immediate preview display
        const localUrl = URL.createObjectURL(file);
        setPreviewFile(file);
        setPreviewUrl(localUrl);
        setCaption(''); // Clear previous caption
    };

    const handleSendPreview = async () => {
        if (!previewFile || !firestore) return;

        const fileToUpload = previewFile;
        const localUrl = previewUrl;
        const typedCaption = caption;

        // Instantly close the preview screen
        setPreviewFile(null);
        setPreviewUrl(null);
        setCaption('');

        const tempId = 'temp_' + Date.now();

        // Add optimistic temporary message to the local state
        const tempMessage = {
            id: tempId,
            senderId: userProfile.id,
            senderName: userProfile.name || currentBusiness?.name || 'Unknown User',
            createdAt: new Date(),
            mediaUrl: localUrl,
            isUploading: true,
            text: typedCaption || '📷 Sent an image'
        };
        setOptimisticMessages(prev => [...prev, tempMessage]);

        try {
            // Upload to ImageKit (fallback to ImgBB)
            const remoteUrl = await uploadImage(fileToUpload);

            // Ensure support thread exists
            let currentThread = thread;
            if (!currentThread) {
                const newThreadRef = doc(firestore, 'supportThreads', `${userProfile.id}_ceo_${Math.random().toString(36).substring(2, 10)}`);
                const newThreadData: Omit<SupportThread, 'id'> = {
                    userId: userProfile.id,
                    userName: userProfile.name || currentBusiness?.name || 'Unknown User',
                    userEmail: userProfile.email,
                    subject: 'Direct CEO Chat',
                    status: 'open',
                    lastMessageAt: serverTimestamp(),
                    lastMessage: typedCaption || '📷 Sent an image',
                    lastMessageSnippet: typedCaption || '📷 Sent an image',
                    lastMessageSender: 'user',
                    lastMessageSenderId: userProfile.id,
                    isReadByAdmin: false,
                    createdAt: serverTimestamp(),
                };
                await setDoc(newThreadRef, newThreadData);
                currentThread = { ...newThreadData, id: newThreadRef.id, createdAt: new Date(), lastMessageAt: new Date() };
                setThread(currentThread);
            }

            // Write real message record to Firestore
            const messageRef = collection(firestore, 'supportThreads', currentThread.id, 'messages');
            await addDoc(messageRef, {
                senderId: userProfile.id,
                senderName: userProfile.name || currentBusiness?.name || 'Unknown User',
                createdAt: serverTimestamp(),
                mediaUrl: remoteUrl,
                text: typedCaption || '📷 Sent an image'
            });

            try {
                fetch('/api/support/notify', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        message: typedCaption || '📷 Sent an image', 
                        userName: userProfile.name || currentBusiness?.name || 'Unknown User', 
                        businessName: currentBusiness?.name 
                    })
                }).catch(e => console.error("Error calling notify API:", e));
            } catch(e) {}

            // Update thread snippet metadata
            const threadRef = doc(firestore, 'supportThreads', currentThread.id);
            await setDoc(threadRef, {
                lastMessageAt: serverTimestamp(),
                lastMessage: typedCaption || '📷 Sent an image',
                lastMessageSnippet: typedCaption || '📷 Sent an image',
                lastMessageSender: 'user',
                lastMessageSenderId: userProfile.id,
                isReadByAdmin: false,
                status: 'open'
            }, { merge: true });

        } catch (err) {
            console.error("Failed to upload/send image:", err);
            toast({ variant: 'destructive', title: t('errors.genericTitle'), description: t('support.imageSendFailed') });
        } finally {
            /*
             * Drop the optimistic row, but do NOT revoke its blob here.
             *
             * `setOptimisticMessages` is asynchronous: the `<img src="blob:…">` is
             * still mounted on the line below, and the real message is arriving from
             * the Firestore listener at the same time, so the list re-renders and
             * re-requests that src. Revoking synchronously here is what produced the
             * `(blocked:other)` 0-byte image requests. Released on unmount instead.
             */
            setOptimisticMessages(prev => prev.filter(m => m.id !== tempId));
            if (localUrl) trackBlobUrl(localUrl);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleSendMessage = async () => {
        if (!message.trim() || !firestore) return;
        
        setIsSending(true);
        let currentThread = thread;
        
        try {
            if (!currentThread) {
                // Auto-create thread with subject "Direct CEO Chat"
                const newThreadRef = doc(firestore, 'supportThreads', `${userProfile.id}_ceo_${Math.random().toString(36).substring(2, 10)}`);
                const newThreadData: Omit<SupportThread, 'id'> = {
                    userId: userProfile.id,
                    userName: userProfile.name || currentBusiness?.name || 'Unknown User',
                    userEmail: userProfile.email,
                    subject: 'Direct CEO Chat',
                    status: 'open',
                    lastMessageAt: serverTimestamp(),
                    lastMessage: message,
                    lastMessageSnippet: message,
                    lastMessageSender: 'user',
                    lastMessageSenderId: userProfile.id,
                    isReadByAdmin: false,
                    createdAt: serverTimestamp(),
                };
                await setDoc(newThreadRef, newThreadData);
                currentThread = { ...newThreadData, id: newThreadRef.id, createdAt: new Date(), lastMessageAt: new Date() };
                setThread(currentThread);
            }

            const messageRef = collection(firestore, 'supportThreads', currentThread.id, 'messages');
            const payload: any = {
                senderId: userProfile.id,
                senderName: userProfile.name || currentBusiness?.name || 'Unknown User',
                createdAt: serverTimestamp(),
                text: message
            };

            await addDoc(messageRef, payload);

            try {
                fetch('/api/support/notify', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        message, 
                        userName: userProfile.name || currentBusiness?.name || 'Unknown User', 
                        businessName: currentBusiness?.name 
                    })
                }).catch(e => console.error("Error calling notify API:", e));
            } catch(e) {}

            const threadRef = doc(firestore, 'supportThreads', currentThread.id);
            await setDoc(threadRef, {
                lastMessageAt: serverTimestamp(),
                lastMessage: message,
                lastMessageSnippet: message,
                lastMessageSender: 'user',
                lastMessageSenderId: userProfile.id,
                isReadByAdmin: false,
                status: 'open'
            }, { merge: true });

            setMessage('');
            toast({ variant: 'success', title: t('support.messageSent') });
        } catch (error) {
            console.error("Failed to send message:", error);
            toast({ variant: 'destructive', title: t('errors.genericTitle'), description: t('support.messageSendFailed') });
        } finally {
            setIsSending(false);
        }
    };

    const handleSaveEditedMessage = async () => {
        if (!editMessageId || !thread || !firestore || !editMessageText.trim()) return;
        try {
            const msgRef = doc(firestore, 'supportThreads', thread.id, 'messages', editMessageId);
            await updateDoc(msgRef, {
                text: editMessageText,
                updatedAt: serverTimestamp()
            });
            const threadRef = doc(firestore, 'supportThreads', thread.id);
            await setDoc(threadRef, {
                lastMessageSnippet: editMessageText,
                lastMessageAt: serverTimestamp()
            }, { merge: true });
            
            setEditModalOpen(false);
            setEditMessageId(null);
            setEditMessageText('');
            toast({ variant: 'success', title: t('support.messageUpdated'), description: t('support.messageUpdatedDescription') });
        } catch (e) {
            console.error("Failed to update message:", e);
            toast({ variant: 'destructive', title: t('errors.genericTitle'), description: t('support.messageUpdateFailed') });
        }
    };

    const handleDeleteMessage = async (msgId: string) => {
        if (!thread) return;
        try {
            await deleteDoc(doc(firestore, `supportThreads/${thread.id}/messages`, msgId));
            toast({ variant: 'success', title: t('support.messageDeleted'), description: t('support.messageDeletedDescription') });
        } catch (e) {
            toast({ variant: 'destructive', title: t('errors.genericTitle'), description: t('support.messageDeleteFailed') });
        }
    };

    const startRecording = async () => {
        try {
            const stream = await acquireMicStream();
            audioChunksRef.current = [];
            const mimeType = pickAudioMimeType();
            const mediaRecorder = new MediaRecorder(stream, { mimeType });
            mediaRecorderRef.current = mediaRecorder;

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
                
                const reader = new FileReader();
                reader.readAsDataURL(audioBlob);
                reader.onloadend = async () => {
                    const base64Audio = reader.result as string;
                    setIsSending(true);
                    let currentThread = thread;
                    try {
                        if (!currentThread) {
                            const newThreadRef = doc(firestore, 'supportThreads', `${userProfile.id}_ceo_${Math.random().toString(36).substring(2, 10)}`);
                            const newThreadData: Omit<SupportThread, 'id'> = {
                                userId: userProfile.id,
                                userName: userProfile.name || currentBusiness?.name || 'Unknown User',
                                userEmail: userProfile.email,
                                subject: 'Direct CEO Chat',
                                status: 'open',
                                lastMessageAt: serverTimestamp(),
                                lastMessage: `🎙️ Voice note (${recordingSeconds}s)`,
                                lastMessageSnippet: `🎙️ Voice note (${recordingSeconds}s)`,
                                lastMessageSender: 'user',
                                lastMessageSenderId: userProfile.id,
                                isReadByAdmin: false,
                                createdAt: serverTimestamp(),
                            };
                            await setDoc(newThreadRef, newThreadData);
                            currentThread = { ...newThreadData, id: newThreadRef.id, createdAt: new Date(), lastMessageAt: new Date() };
                            setThread(currentThread);
                        }

                        const messagesRef = collection(firestore, `supportThreads/${currentThread.id}/messages`);
                        await addDoc(messagesRef, {
                            senderId: userProfile.id,
                            senderName: userProfile.name || currentBusiness?.name || 'Unknown User',
                            voiceUrl: base64Audio,
                            voiceDuration: recordingSeconds,
                            createdAt: serverTimestamp(),
                        });

                        try {
                            fetch('/api/support/notify', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ 
                                    message: `🎙️ Voice note (${recordingSeconds}s)`, 
                                    userName: userProfile.name || currentBusiness?.name || 'Unknown User', 
                                    businessName: currentBusiness?.name 
                                })
                            }).catch(e => console.error("Error calling notify API:", e));
                        } catch(e) {}

                        const threadRef = doc(firestore, 'supportThreads', currentThread.id);
                        await setDoc(threadRef, {
                            lastMessageSnippet: `🎙️ Voice note (${recordingSeconds}s)`,
                            lastMessage: `🎙️ Voice note (${recordingSeconds}s)`,
                            lastMessageSender: 'user',
                            lastMessageSenderId: userProfile.id,
                            lastMessageAt: serverTimestamp(),
                            isReadByAdmin: false,
                            status: 'open'
                        }, { merge: true });

                        toast({ variant: 'success', title: t('support.voiceNoteSent') });
                    } catch (e) {
                        toast({ variant: 'destructive', title: t('errors.genericTitle'), description: t('support.voiceNoteSendFailed') });
                    } finally {
                        setIsSending(false);
                    }
                };
            };

            mediaRecorder.start();
            setIsRecording(true);
            setRecordingSeconds(0);
            recTimerRef.current = setInterval(() => {
                setRecordingSeconds(s => s + 1);
            }, 1000);
        } catch (err) {
            const failure = describeMicError(err);
            console.error(`Microphone unavailable (${failure.kind}):`, err);
            toast({
                variant: 'destructive',
                title: t(failure.titleKey),
                description: t(failure.bodyKey),
                action: failure.recoverable
                    ? <ToastAction altText={t('common.tryAgain')} onClick={() => { void startRecording(); }}>{t('common.tryAgain')}</ToastAction>
                    : undefined,
            });
        }
    };

    const cancelRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.onstop = null;
            mediaRecorderRef.current.stop();
            mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
        }
        clearInterval(recTimerRef.current);
        setIsRecording(false);
        setRecordingSeconds(0);
    };

    const stopAndSendVoice = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
            mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
        }
        clearInterval(recTimerRef.current);
        setIsRecording(false);
    };

    if (isLoading) {
        return <div className="h-full flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }

    return (
        <div ref={chatContainerRef} className="flex flex-col h-full bg-[#efeae2] dark:bg-slate-950 rounded-xl border overflow-hidden shadow-lg relative">
            <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                accept="image/*" 
                className="hidden" 
            />

            <div className="flex items-center gap-3 border-b p-3 bg-white dark:bg-slate-900 z-10 shadow-sm">
                <Avatar className="h-10 w-10 ring-2 ring-primary/20">
                    <AvatarFallback className="bg-primary text-primary-foreground font-bold">BI</AvatarFallback>
                </Avatar>
                <div>
                    <h4 className="text-sm font-bold leading-none text-slate-800 dark:text-white">Bello Imam</h4>
                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></span>
                        {t('support.ceoStatus')}
                    </p>
                </div>
            </div>

            <ScrollArea className="flex-1 p-4 bg-[url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')] bg-repeat bg-[size:360px]" ref={scrollAreaRef}>
                 <div className="space-y-3 pt-2">
                    {/* Simulated Greeting from CEO */}
                    <div className="flex items-start gap-2 justify-start">
                        <Avatar className="h-8 w-8 bg-primary text-primary-foreground">
                            <AvatarFallback className="bg-primary text-primary-foreground font-bold">CEO</AvatarFallback>
                        </Avatar>
                        <div className="rounded-xl rounded-tl-none p-3 max-w-[80%] bg-white dark:bg-slate-900 shadow-sm border">
                            <p className="text-sm leading-relaxed text-slate-800 dark:text-slate-100 font-medium">{t('support.ceoGreeting')}</p>
                            <p className="text-[9px] text-muted-foreground mt-1">{t('support.ceoOffice')}</p>
                        </div>
                    </div>

                    {isLoadingMessages && <div className="text-center p-4"><Loader2 className="h-6 w-6 animate-spin mx-auto"/></div>}
                    
                    {allMessages.map(msg => {
                        if (!msg || !msg.id) return null;
                        const isUser = msg.senderId === userProfile.id;
                        return (
                            <div key={msg.id} className={cn('flex items-end gap-1 group', isUser ? 'justify-end' : 'justify-start')}>
                                 <div className={cn(
                                     "max-w-[70%] rounded-xl p-2.5 relative shadow-sm transition-all duration-300", 
                                     isUser 
                                        ? 'bg-orange-100 dark:bg-orange-950/40 text-slate-800 dark:text-slate-100 rounded-tr-none pe-8' 
                                        : 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded-tl-none'
                                  )}>
                                     {/* Three-dot dropdown menu instead of hover trash */}
                                     {isUser && !msg.isUploading && (
                                         <div className="absolute top-1.5 end-1.5 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                                             <DropdownMenu modal={false}>
                                                 <DropdownMenuTrigger asChild>
                                                     <button className="h-6 w-6 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center border hover:bg-slate-200 dark:hover:bg-slate-700">
                                                         <MoreVertical className="h-3.5 w-3.5 text-slate-600 dark:text-slate-300" />
                                                     </button>
                                                 </DropdownMenuTrigger>
                                                 <DropdownMenuContent align="end" className="w-[100px]">
                                                     {msg.text && (
                                                         <DropdownMenuItem onClick={() => {
                                                             setEditMessageId(msg.id);
                                                             setEditMessageText(msg.text || '');
                                                             setEditModalOpen(true);
                                                         }}>
                                                             <Edit2 className="h-3.5 w-3.5 me-2" /> {t('common.edit')}
                                                         </DropdownMenuItem>
                                                     )}
                                                     <DropdownMenuItem onClick={() => handleDeleteMessage(msg.id)} className="text-red-500 focus:text-red-500">
                                                         <Trash2 className="h-3.5 w-3.5 me-2" /> {t('common.delete')}
                                                     </DropdownMenuItem>
                                                 </DropdownMenuContent>
                                             </DropdownMenu>
                                         </div>
                                     )}

                                      {msg.mediaUrl && (
                                          <div 
                                              className="mb-2 rounded-lg overflow-hidden border max-w-sm relative group/img cursor-pointer" 
                                              onClick={() => setActiveLightboxUrl(msg.mediaUrl)}
                                          >
                                              <img src={msg.mediaUrl} alt={t('support.attachedFile')} className="w-full h-auto object-cover max-h-60 group-hover/img:scale-105 transition-transform duration-300" />
                                              {msg.isUploading && (
                                                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center backdrop-blur-[1px]">
                                                      <div className="h-10 w-10 rounded-full bg-black/45 border border-white/20 flex items-center justify-center animate-spin">
                                                          <Loader2 className="h-5 w-5 text-white" />
                                                      </div>
                                                  </div>
                                              )}
                                          </div>
                                      )}
                                      {msg.replyTo && (
                                          <div className="mb-2 p-2 rounded-lg bg-black/5 dark:bg-white/10 border-s-4 border-orange-500 text-xs">
                                              <p className="font-semibold text-orange-600 dark:text-orange-400 text-[11px]">{msg.replyTo.senderName}</p>
                                              <p className="text-slate-600 dark:text-slate-300 text-[11px] truncate">{msg.replyTo.text}</p>
                                          </div>
                                      )}

                                      {msg.voiceUrl && (
                                          <div className="mb-2">
                                              <VoiceNotePlayer voiceUrl={msg.voiceUrl} voiceDuration={msg.voiceDuration} />
                                          </div>
                                      )}

                                        {msg.text && (
                                            <div className="text-sm leading-relaxed whitespace-pre-wrap break-words prose prose-sm dark:prose-invert max-w-none">
                                                <ReactMarkdown
                                                    remarkPlugins={[remarkGfm]}
                                                    components={{
                                                        a: ({node, ...props}) => <a {...props} className="text-orange-600 hover:text-orange-700 hover:underline break-all" target="_blank" rel="noopener noreferrer" />
                                                    }}
                                                >
                                                    {msg.text}
                                                </ReactMarkdown>
                                            </div>
                                        )}

                                     <div className="flex items-center justify-end gap-1 mt-1 text-[9px] opacity-75">
                                         {msg.updatedAt && <span className="italic font-medium text-slate-500 dark:text-slate-400 me-0.5">{t('support.edited')} •</span>}
                                         <span>{safeFormatTime(msg.createdAt)}</span>
                                         <Popover>
                                             <PopoverTrigger asChild>
                                                 <button className="text-slate-400 hover:text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800 rounded outline-none p-0.5" aria-label="View full time">
                                                     <Info className="h-2.5 w-2.5" />
                                                 </button>
                                             </PopoverTrigger>
                                             <PopoverContent className="w-auto p-2 text-xs font-medium" align="end" side="top">
                                                 {safeFormatFullTime(msg.createdAt)}
                                             </PopoverContent>
                                         </Popover>
                                         {isUser && (
                                             msg.isUploading || msg.isPending || !msg.createdAt ? (
                                                 <Clock className="h-3 w-3 text-slate-500 animate-pulse" />
                                             ) : msg.isSeen ? (
                                                 <CheckCheck className="h-3.5 w-3.5 text-blue-500" /> 
                                             ) : (
                                                 <Check className="h-3.5 w-3.5 text-slate-400" />
                                             )
                                         )}
                                     </div>
                                 </div>
                            </div>
                        );
                    })}
                 </div>
            </ScrollArea>
            
            <div className="bg-[#f0f0f0] dark:bg-slate-900 p-3 border-t flex flex-col gap-2">
                <div className="flex items-center gap-2">
                    <Button type="button" size="icon" variant="ghost" aria-label={t('support.attachFile')} title={t('support.attachFile')} className="h-10 w-10 text-slate-600 dark:text-slate-400 hover:bg-slate-200/50 hover:text-slate-900 dark:hover:text-slate-100" onClick={() => fileInputRef.current?.click()}>
                        <ImageIcon className="h-5 w-5" />
                    </Button>

                    {isRecording ? (
                        <div className="flex-1 flex items-center justify-between bg-white dark:bg-slate-800 px-3 py-2 rounded-lg border h-10 animate-pulse">
                            <div className="flex items-center gap-2 text-rose-500">
                                <span className="h-2.5 w-2.5 rounded-full bg-rose-500 animate-ping"></span>
                                <span className="text-xs font-bold font-mono">{t('support.recordingSeconds', { count: recordingSeconds })}</span>
                            </div>
                            <div className="flex-1 flex items-center gap-2">
                                <Button size="sm" variant="ghost" className="text-xs text-muted-foreground" onClick={cancelRecording}>{t('common.cancel')}</Button>
                                <Button size="sm" variant="default" className="text-xs h-7 bg-orange-600 text-white" onClick={stopAndSendVoice}>{t('support.send')}</Button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex-1 flex items-center gap-2">
                            <Textarea 
                                placeholder={editMessageId ? t('support.editYourMessage') : t('support.typeToCeo')}
                                value={message} 
                                onChange={(e) => setMessage(e.target.value)} 
                                disabled={isSending} 
                                className="flex-1 min-h-[60px] md:min-h-[40px] bg-white dark:bg-slate-800 border-none ring-1 ring-border resize-y rounded-lg text-sm"
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        handleSendMessage();
                                    }
                                }}
                            />
                            <Button type="button" size="icon" variant="ghost" aria-label={t('support.recordVoiceNote')} title={t('support.recordVoiceNote')} className="h-10 w-10 text-slate-600 dark:text-slate-400 hover:bg-slate-200/50 hover:text-slate-900 dark:hover:text-slate-100" onClick={startRecording}>
                                <Mic className="h-5 w-5" />
                            </Button>
                        </div>
                    )}

                    {!isRecording && (
                        <Button onClick={handleSendMessage} disabled={!message.trim() || isSending} size="icon" aria-label={t('support.send')} className="h-10 w-10 rounded-lg bg-orange-600 text-white hover:bg-orange-700 flex-shrink-0">
                            {isSending ? <Loader2 className="h-4 w-4 animate-spin"/> : <Send className="h-4 w-4" />}
                        </Button>
                    )}
                </div>
            </div>

            {/* Inline Premium Edit Message Panel */}
            {editModalOpen && typeof document !== 'undefined' && createPortal(
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-[2px] flex items-center justify-center p-4 z-[99999]">
                    <div className="w-full max-w-sm bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xl flex flex-col gap-3">
                        <div className="flex items-center justify-between border-b pb-2">
                            <div className="flex items-center gap-2 font-bold text-sm text-orange-600">
                                <Edit2 className="h-4 w-4" /> {t('support.editMessage')}
                            </div>
                            <button 
                                onClick={() => setEditModalOpen(false)}
                                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                        <div className="flex-1">
                            <Textarea 
                                value={editMessageText}
                                onChange={(e) => setEditMessageText(e.target.value)}
                                className="min-h-[100px] w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 text-xs focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-y"
                                placeholder={t('support.editMessagePlaceholder')}
                            />
                        </div>
                        <div className="flex justify-end gap-2 text-xs">
                            <Button variant="ghost" size="sm" className="rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-900 h-8" onClick={() => setEditModalOpen(false)}>
                                {t('common.cancel')}
                            </Button>
                            <Button size="sm" className="bg-orange-600 text-white hover:bg-orange-700 rounded-lg h-8 px-3" onClick={handleSaveEditedMessage} disabled={!editMessageText.trim()}>
                                {t('common.save')}
                            </Button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
            {/* WhatsApp-style Image Upload Preview Panel */}
            {previewUrl && (
                <div className="absolute inset-0 bg-[#efeae2] dark:bg-[#0b141a] z-50 rounded-xl flex flex-col justify-between overflow-hidden animate-fade-in text-slate-800 dark:text-white">
                    {/* Header */}
                    <div className="flex items-center justify-between p-4 bg-white/80 dark:bg-slate-900/60 backdrop-blur-md border-b border-slate-200/60 dark:border-white/5">
                        <button 
                            onClick={() => {
                                // Same ordering trap as the send path: the preview
                                // <img> is unmounted by the state updates below, which
                                // have not been committed yet. Hand it to the unmount
                                // registry rather than revoking it out from under a
                                // live element.
                                if (previewUrl) trackBlobUrl(previewUrl);
                                setPreviewFile(null);
                                setPreviewUrl(null);
                                setCaption('');
                            }}
                            className="h-10 w-10 rounded-full flex items-center justify-center hover:bg-slate-200/60 dark:hover:bg-white/10 transition-colors text-slate-700 dark:text-white"
                        >
                            <X className="h-6 w-6" />
                        </button>
                        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{t('support.preview')}</span>
                        <div className="w-10"></div> {/* Spacer to center the title */}
                    </div>

                    {/* Image Container */}
                    <div className="flex-1 flex items-center justify-center p-6 overflow-hidden">
                        <img 
                            src={previewUrl} 
                            alt={t('support.preview')}
                            className="max-h-[60vh] max-w-full object-contain rounded-lg shadow-xl border border-slate-200/50 dark:border-white/10" 
                        />
                    </div>

                    {/* Footer (Caption Input + Send Button) */}
                    <div className="p-4 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-t border-slate-200/60 dark:border-white/5 flex items-center gap-3">
                        <div className="flex-1 relative">
                            <input
                                type="text"
                                value={caption}
                                onChange={(e) => setCaption(e.target.value)}
                                placeholder={t('support.captionPlaceholder')}
                                className="w-full bg-slate-100 dark:bg-[#1f2c34] text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 text-sm py-3 px-4 rounded-xl border border-slate-200 dark:border-white/5 focus:outline-none focus:ring-2 focus:ring-orange-500"
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        handleSendPreview();
                                    }
                                }}
                            />
                        </div>
                        <Button
                            onClick={handleSendPreview}
                            size="icon"
                            aria-label={t('support.send')}
                            className="h-12 w-12 rounded-full bg-orange-600 hover:bg-orange-700 text-white flex-shrink-0 flex items-center justify-center shadow-lg transition-transform hover:scale-105 active:scale-95"
                        >
                            <Send className="h-5 w-5" />
                        </Button>
                    </div>
                </div>
            )}
            {/* Fullscreen Image Lightbox Modal using React Portal */}
            {activeLightboxUrl && typeof document !== 'undefined' && createPortal(
                <div 
                    className="fixed inset-0 z-[99999] bg-black/95 backdrop-blur-lg flex flex-col items-center justify-center p-4 md:p-8 animate-fade-in select-none"
                    onClick={() => setActiveLightboxUrl(null)}
                >
                    {/* Top action bar */}
                    <div className="absolute top-4 end-4 flex items-center gap-3 z-10" onClick={(e) => e.stopPropagation()}>
                        <a 
                            href={activeLightboxUrl} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="text-white hover:text-orange-400 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-all text-xs font-semibold px-4 flex items-center gap-1.5"
                            title={t('support.openOriginalImage')}
                        >
                            {t('support.openOriginal')}
                        </a>
                        <button 
                            className="text-white hover:text-rose-400 p-2.5 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
                            onClick={() => setActiveLightboxUrl(null)}
                        >
                            <X className="h-6 w-6" />
                        </button>
                    </div>

                    {/* Deep expanded high-res image display */}
                    <div className="relative max-w-[95vw] max-h-[92vh] flex items-center justify-center overflow-auto p-2" onClick={(e) => e.stopPropagation()}>
                        <img 
                            src={activeLightboxUrl} 
                            alt={t('support.expandedView')}
                            className="max-h-[90vh] max-w-[95vw] w-auto h-auto object-contain rounded-xl shadow-2xl ring-1 ring-white/10 cursor-zoom-out" 
                            onClick={() => setActiveLightboxUrl(null)}
                        />
                    </div>
                </div>,
                document.body
            )}
        </div>
    )
}

export default function SupportPage() {
    const { user, isUserLoading } = useUser();
    const firestore = useFirestore();
    const { t } = useI18n();

    const userDocRef = useMemoFirebase(() => (user ? doc(firestore, 'users', user.uid) : null), [user, firestore]);
    const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserProfile>(userDocRef);

    const isLoading = isUserLoading || isProfileLoading;
    const [faqSearch, setFaqSearch] = React.useState('');
    const [isChatMaximized, setIsChatMaximized] = React.useState(false);
    const [isFaqDialogExpanded, setIsFaqDialogExpanded] = React.useState(false);

    // Track FAQ searches to understand user intent
    React.useEffect(() => {
        if (!faqSearch.trim() || faqSearch.trim().length < 3) return;

        const timer = setTimeout(async () => {
            try {
                if (firestore && userProfile) {
                    await addDoc(collection(firestore, 'faq_search_logs'), {
                        query: faqSearch.trim().toLowerCase(),
                        userId: userProfile.id,
                        userName: userProfile.name,
                        businessId: userProfile.currentBusinessId || 'none',
                        createdAt: serverTimestamp()
                    });
                }
            } catch (error) {
                console.error("Failed to log FAQ search:", error);
            }
        }, 1000); // Wait 1 second after user stops typing before logging

        return () => clearTimeout(timer);
    }, [faqSearch, firestore, userProfile]);

    const filteredFaqs = React.useMemo(() => {
        if (!faqSearch.trim()) return faqItems;
        const search = faqSearch.toLowerCase();
        return faqItems.filter(item => 
            item.question.toLowerCase().includes(search) || 
            item.tags.some(tag => tag.toLowerCase().includes(search))
        );
    }, [faqSearch]);

    return (
        <div className="space-y-8 pb-10">
            <PageTitle title={t('support.pageTitle')} subtitle={t('support.pageSubtitle')} />
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Side: Direct Line to the CEO */}
                <div className={`${isChatMaximized ? 'lg:col-span-3 min-h-[85vh]' : 'lg:col-span-2 min-h-[80vh]'} flex flex-col transition-all duration-300 resize-y overflow-hidden border border-transparent pb-1`}>
                    <div className="flex items-center justify-between mb-4 pb-2 border-b">
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-xl font-bold text-slate-900 dark:text-white">{t('support.directLine')}</h2>
                                <span className="text-[10px] font-semibold bg-orange-100 dark:bg-orange-950/60 text-orange-700 dark:text-orange-300 px-2 py-0.5 rounded-full border border-orange-200 dark:border-orange-800">
                                    ⚡ {t('support.repliesWithinMinutes')}
                                </span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">{t('support.directLineHint')}</p>
                        </div>
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-8 w-8 p-0 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white"
                            onClick={() => setIsChatMaximized(!isChatMaximized)}
                            title={isChatMaximized ? t('support.shrinkChat') : t('support.expandChat')}
                        >
                            {isChatMaximized ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                        </Button>
                    </div>
                    <div className="flex-1 h-full min-h-[500px]">
                        {isLoading ? (
                            <div className="h-full flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
                        ) : userProfile ? (
                            <UserSupportChat userProfile={userProfile} />
                        ) : (
                            <div className="h-full flex items-center justify-center text-muted-foreground text-center">{t('support.profileLoadFailed')}</div>
                        )}
                    </div>
                </div>

                {/* Right Side: FAQs & Zen AI Assistant (Hidden when chat is maximized) */}
                {!isChatMaximized && (
                    <div className="space-y-6">
                        <div>
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">{t('support.quickResources')}</h2>
                        </div>

                        {/* Zen AI Card */}
                        <Card className="shadow-sm border">
                            <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
                                <div>
                                    <CardTitle className="flex items-center gap-2 text-base">
                                        <Bot className="h-5 w-5 text-primary" />
                                        {t('support.chatWithZen')}
                                    </CardTitle>
                                    <CardDescription>{t('support.chatWithZenDescription')}</CardDescription>
                                </div>
                                <Dialog>
                                    <Button asChild variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white">
                                        <DialogTrigger title={t('support.expandAiStrategist')}>
                                            <Maximize2 className="h-4 w-4 text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white" />
                                        </DialogTrigger>
                                    </Button>
                                    <DialogContent className="max-w-xl h-[80vh] flex flex-col p-6">
                                        <DialogHeader>
                                            <DialogTitle>{t('support.zenAssistantTitle')}</DialogTitle>
                                            <DialogDescription>{t('support.zenAssistantDescription')}</DialogDescription>
                                        </DialogHeader>
                                        <div className="flex-1 overflow-hidden mt-4">
                                            <ZenAIChatBot userProfile={userProfile || undefined} />
                                        </div>
                                    </DialogContent>
                                </Dialog>
                            </CardHeader>
                            <CardContent>
                                <Dialog>
                                    <Button asChild className="w-full animate-pulse-orange">
                                        <DialogTrigger>{t('support.launchAiStrategist')}</DialogTrigger>
                                    </Button>
                                    <DialogContent className="max-w-xl h-[80vh] flex flex-col p-6">
                                        <DialogHeader>
                                            <DialogTitle>{t('support.zenAssistantTitle')}</DialogTitle>
                                            <DialogDescription>{t('support.zenAssistantDescription')}</DialogDescription>
                                        </DialogHeader>
                                        <div className="flex-1 overflow-hidden mt-4">
                                            <ZenAIChatBot userProfile={userProfile || undefined} />
                                        </div>
                                    </DialogContent>
                                </Dialog>
                            </CardContent>
                        </Card>

                        {/* FAQs Card */}
                        <Card className="shadow-sm border">
                            <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
                                <div>
                                    <CardTitle className="flex items-center gap-2 text-base">
                                        <HelpCircle className="h-5 w-5 text-amber-500" />
                                        {t('support.faqsAndGuides')}
                                    </CardTitle>
                                    <CardDescription>{t('support.faqsDescription')}</CardDescription>
                                </div>
                                <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    className="h-8 w-8 p-0 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white"
                                    onClick={() => setIsFaqDialogExpanded(true)}
                                    title={t('support.expandFaqs')}
                                >
                                    <Maximize2 className="h-4 w-4 text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white" />
                                </Button>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                 <div className="relative">
                                    <SearchIcon className="absolute start-3 top-1/2 h-4 w-4 text-muted-foreground -translate-y-1/2" />
                                    <Input
                                        className="ps-10 h-9 bg-muted/20 border-none ring-1 ring-border text-xs"
                                        placeholder={t('support.searchAnswers')}
                                        value={faqSearch}
                                        onChange={(e) => setFaqSearch(e.target.value)}
                                    />
                                 </div>

                                 <Accordion type="single" collapsible className="w-full space-y-2 max-h-[300px] overflow-y-auto pe-1">
                                    {filteredFaqs.length > 0 ? (
                                        filteredFaqs.map((item, index) => (
                                            <AccordionItem key={index} value={`faq-${index}`} className="border rounded-lg px-3 bg-muted/5 border-transparent">
                                                <AccordionTrigger className="hover:no-underline hover:underline font-semibold text-xs text-start py-2.5">{item.question}</AccordionTrigger>
                                                <AccordionContent className="text-xs text-muted-foreground leading-relaxed pb-3">
                                                    {item.answer}
                                                </AccordionContent>
                                            </AccordionItem>
                                        ))
                                    ) : (
                                        <div className="text-center py-6 text-xs text-muted-foreground">{t('support.noMatches')}</div>
                                    )}
                                </Accordion>
                            </CardContent>
                        </Card>
                    </div>
                )}
            </div>

            {/* Expanded FAQs & Guides Modal */}
            <Dialog open={isFaqDialogExpanded} onOpenChange={setIsFaqDialogExpanded}>
                <DialogContent className="max-w-4xl h-[85vh] flex flex-col p-6 rounded-xl">
                    <DialogHeader className="border-b pb-3">
                        <DialogTitle className="text-xl font-bold flex items-center gap-2 text-slate-900 dark:text-white">
                            <HelpCircle className="h-6 w-6 text-amber-500" /> {t('support.knowledgeBase')}
                        </DialogTitle>
                        <DialogDescription className="text-sm">
                            {t('support.knowledgeBaseDescription')}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex-1 flex flex-col min-h-0 gap-4 mt-4">
                         <div className="relative w-full max-w-md">
                            <SearchIcon className="absolute start-3 top-1/2 h-4 w-4 text-muted-foreground -translate-y-1/2" />
                            <Input
                                className="ps-10 h-10 bg-muted/20 border-none ring-1 ring-border text-sm"
                                placeholder={t('support.searchAllGuides')}
                                value={faqSearch}
                                onChange={(e) => setFaqSearch(e.target.value)}
                            />
                         </div>

                         <ScrollArea className="flex-1 pe-2">
                             <Accordion type="single" collapsible className="w-full space-y-3">
                                {filteredFaqs.length > 0 ? (
                                    filteredFaqs.map((item, index) => (
                                        <AccordionItem key={index} value={`expanded-faq-${index}`} className="border border-slate-200 dark:border-slate-800 rounded-xl px-4 bg-muted/5">
                                            <AccordionTrigger className="hover:no-underline hover:underline font-semibold text-sm text-start py-4">{item.question}</AccordionTrigger>
                                            <AccordionContent className="text-sm text-muted-foreground leading-relaxed pb-4">
                                                {item.answer}
                                            </AccordionContent>
                                        </AccordionItem>
                                    ))
                                ) : (
                                    <div className="text-center py-10 text-muted-foreground">{t('support.noMatchingGuides')}</div>
                                )}
                            </Accordion>
                         </ScrollArea>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
