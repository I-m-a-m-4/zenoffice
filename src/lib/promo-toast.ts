import type { PromoToastConfig, PromoToastColor } from '@/types';

// Preset high-res SVGs in base64 data URLs for instant 1-click styling
export const PRESET_BANNERS = [
  {
    id: 'wps-blue',
    label: 'WPS Electric Blue',
    themeColor: 'blue' as PromoToastColor,
    previewColor: '#0078D4',
    dataUrl: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="600" height="320" viewBox="0 0 600 320">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="%230b192e"/>
          <stop offset="50%" stop-color="%230284c7"/>
          <stop offset="100%" stop-color="%231e3a8a"/>
        </linearGradient>
        <linearGradient id="gold" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="%23fbbf24"/>
          <stop offset="100%" stop-color="%23f59e0b"/>
        </linearGradient>
        <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="15" result="blur"/>
          <feComposite in="SourceGraphic" in2="blur" operator="over"/>
        </filter>
      </defs>
      <rect width="600" height="320" fill="url(%23bg)" rx="16"/>
      <circle cx="500" cy="80" r="140" fill="%2338bdf8" opacity="0.25" filter="url(%23glow)"/>
      <circle cx="80" cy="240" r="110" fill="%2360a5fa" opacity="0.2" filter="url(%23glow)"/>
      <path d="M480 70 L495 100 L530 105 L505 130 L510 165 L480 145 L450 165 L455 130 L430 105 L465 100 Z" fill="url(%23gold)" opacity="0.9"/>
      <text x="40" y="80" fill="%2338bdf8" font-family="system-ui, sans-serif" font-weight="900" font-size="20" letter-spacing="2">ZENOFFICE DESKTOP VIP</text>
      <text x="40" y="145" fill="%23ffffff" font-family="system-ui, sans-serif" font-weight="900" font-size="44">Back to School</text>
      <text x="40" y="195" fill="%23fef08a" font-family="system-ui, sans-serif" font-weight="800" font-size="34">59% OFF SPECIAL</text>
      <text x="40" y="245" fill="%23bae6fd" font-family="system-ui, sans-serif" font-size="16">Unlimited multi-branch inventory & AI stock analytics</text>
    </svg>`,
  },
  {
    id: 'zenoffice-orange',
    label: 'ZenOffice Sunset Orange',
    themeColor: 'orange' as PromoToastColor,
    previewColor: '#FF6B00',
    dataUrl: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="600" height="320" viewBox="0 0 600 320">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="%231c1005"/>
          <stop offset="40%" stop-color="%23c2410c"/>
          <stop offset="100%" stop-color="%23ea580c"/>
        </linearGradient>
        <linearGradient id="glowGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="%23fb923c"/>
          <stop offset="100%" stop-color="%23f97316"/>
        </linearGradient>
      </defs>
      <rect width="600" height="320" fill="url(%23bg)" rx="16"/>
      <circle cx="480" cy="110" r="130" fill="%23f97316" opacity="0.3"/>
      <text x="40" y="80" fill="%23fdba74" font-family="system-ui, sans-serif" font-weight="900" font-size="20" letter-spacing="2">PRO MERCHANT PASS</text>
      <text x="40" y="145" fill="%23ffffff" font-family="system-ui, sans-serif" font-weight="900" font-size="44">Upgrade to Pro</text>
      <text x="40" y="195" fill="%23fed7aa" font-family="system-ui, sans-serif" font-weight="800" font-size="34">50% Off First Month</text>
      <text x="40" y="245" fill="%23ffedd5" font-family="system-ui, sans-serif" font-size="16">Offline-first cloud POS with realtime barcode checkout</text>
    </svg>`,
  },
  {
    id: 'cyber-emerald',
    label: 'Cyber Emerald',
    themeColor: 'emerald' as PromoToastColor,
    previewColor: '#10B981',
    dataUrl: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="600" height="320" viewBox="0 0 600 320">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="%23062319"/>
          <stop offset="50%" stop-color="%23059669"/>
          <stop offset="100%" stop-color="%23047857"/>
        </linearGradient>
      </defs>
      <rect width="600" height="320" fill="url(%23bg)" rx="16"/>
      <circle cx="510" cy="90" r="140" fill="%2334d399" opacity="0.25"/>
      <text x="40" y="80" fill="%236ee7b7" font-family="system-ui, sans-serif" font-weight="900" font-size="20" letter-spacing="2">STORE GROWTH BOOSTER</text>
      <text x="40" y="145" fill="%23ffffff" font-family="system-ui, sans-serif" font-weight="900" font-size="44">Scale Your Business</text>
      <text x="40" y="195" fill="%23a7f3d0" font-family="system-ui, sans-serif" font-weight="800" font-size="34">Automated Stock & Sales</text>
      <text x="40" y="245" fill="%23d1fae5" font-family="system-ui, sans-serif" font-size="16">Track profits, sales velocity, and multi-teller staff</text>
    </svg>`,
  },
  {
    id: 'royal-purple',
    label: 'Royal Purple AI',
    themeColor: 'purple' as PromoToastColor,
    previewColor: '#8B5CF6',
    dataUrl: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="600" height="320" viewBox="0 0 600 320">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="%23190b2e"/>
          <stop offset="50%" stop-color="%237c3aed"/>
          <stop offset="100%" stop-color="%235b21b6"/>
        </linearGradient>
      </defs>
      <rect width="600" height="320" fill="url(%23bg)" rx="16"/>
      <circle cx="500" cy="100" r="120" fill="%23c084fc" opacity="0.3"/>
      <text x="40" y="80" fill="%23d8b4fe" font-family="system-ui, sans-serif" font-weight="900" font-size="20" letter-spacing="2">ZENOFFICE ZEN-AI PRO</text>
      <text x="40" y="145" fill="%23ffffff" font-family="system-ui, sans-serif" font-weight="900" font-size="44">Smart AI Copilot</text>
      <text x="40" y="195" fill="%23f3e8ff" font-family="system-ui, sans-serif" font-weight="800" font-size="34">Instant Sales Insights</text>
      <text x="40" y="245" fill="%23e9d5ff" font-family="system-ui, sans-serif" font-size="16">Ask AI about restocking, best-selling items, and profit trends</text>
    </svg>`,
  },
];

export const DEFAULT_PROMO_CONFIG: PromoToastConfig = {
  id: 'promo-wps-style-v1',
  enabled: false,
  displayMode: 'card',
  imageUrl: PRESET_BANNERS[0].dataUrl,
  badgeText: '59% OFF · BACK TO SCHOOL',
  title: 'Upgrade to ZenOffice Pro',
  description: 'Supercharge your store with multi-branch synchronization, offline POS, and AI sales predictions.',
  buttonText: 'Get my OFFER',
  targetUrl: '/settings?tab=subscription',
  themeColor: 'blue',
  targetPlatform: 'all',
  cooldownHours: 24,
  autoShowDelaySec: 3,
};

export interface ThemeStyle {
  glowBorder: string;
  badgeBg: string;
  buttonClass: string;
  accentText: string;
  headerGlow: string;
}

export const THEME_STYLES: Record<PromoToastColor, ThemeStyle> = {
  blue: {
    glowBorder: 'border-blue-500/40 shadow-blue-500/20 ring-blue-500/20',
    badgeBg: 'bg-blue-600 text-white shadow-xs',
    buttonClass: 'bg-gradient-to-r from-blue-600 via-sky-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-lg shadow-blue-500/25',
    accentText: 'text-blue-500 dark:text-blue-400',
    headerGlow: 'from-blue-600/25 via-blue-500/10 to-transparent',
  },
  orange: {
    glowBorder: 'border-orange-500/40 shadow-orange-500/20 ring-orange-500/20',
    badgeBg: 'bg-orange-600 text-white shadow-xs',
    buttonClass: 'bg-gradient-to-r from-orange-500 via-amber-600 to-orange-600 hover:from-orange-400 hover:to-orange-500 text-white shadow-lg shadow-orange-500/25',
    accentText: 'text-orange-500 dark:text-orange-400',
    headerGlow: 'from-orange-600/25 via-orange-500/10 to-transparent',
  },
  emerald: {
    glowBorder: 'border-emerald-500/40 shadow-emerald-500/20 ring-emerald-500/20',
    badgeBg: 'bg-emerald-600 text-white shadow-xs',
    buttonClass: 'bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-500 hover:to-teal-500 text-white shadow-lg shadow-emerald-500/25',
    accentText: 'text-emerald-500 dark:text-emerald-400',
    headerGlow: 'from-emerald-600/25 via-emerald-500/10 to-transparent',
  },
  purple: {
    glowBorder: 'border-purple-500/40 shadow-purple-500/20 ring-purple-500/20',
    badgeBg: 'bg-purple-600 text-white shadow-xs',
    buttonClass: 'bg-gradient-to-r from-purple-600 via-violet-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-lg shadow-purple-500/25',
    accentText: 'text-purple-500 dark:text-purple-400',
    headerGlow: 'from-purple-600/25 via-purple-500/10 to-transparent',
  },
  amber: {
    glowBorder: 'border-amber-500/40 shadow-amber-500/20 ring-amber-500/20',
    badgeBg: 'bg-amber-500 text-amber-950 font-bold shadow-xs',
    buttonClass: 'bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-bold shadow-lg shadow-amber-500/25',
    accentText: 'text-amber-500 dark:text-amber-400',
    headerGlow: 'from-amber-600/25 via-amber-500/10 to-transparent',
  },
};
