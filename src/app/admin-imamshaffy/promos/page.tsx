'use client';

import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  Save, 
  Eye, 
  Upload, 
  Image as ImageIcon, 
  CheckCircle2, 
  AlertTriangle, 
  Laptop, 
  Globe, 
  Layers, 
  Play, 
  RotateCcw, 
  ExternalLink, 
  X,
  Palette,
  ArrowRight,
  Sun,
  Moon,
  Zap
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useFirestore } from '@/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { 
  DEFAULT_PROMO_CONFIG, 
  PRESET_BANNERS, 
  THEME_STYLES 
} from '@/lib/promo-toast';
import type { 
  PromoToastConfig, 
  PromoToastColor, 
  PromoToastMode, 
  PromoToastTargetPlatform 
} from '@/types';

export default function AdminPromoToastPage() {
  const firestore = useFirestore();
  const { toast } = useToast();

  const [config, setConfig] = useState<PromoToastConfig>(DEFAULT_PROMO_CONFIG);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [previewTheme, setPreviewTheme] = useState<'dark' | 'light'>('dark');

  // Load configuration from Firestore
  useEffect(() => {
    if (!firestore) return;

    const loadSettings = async () => {
      try {
        const docRef = doc(firestore, 'platform_settings', 'promo_toast');
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          setConfig({ ...DEFAULT_PROMO_CONFIG, ...snap.data() } as PromoToastConfig);
        }
      } catch (err) {
        console.error('Failed to load promo settings:', err);
        toast({ title: 'Error', description: 'Could not load promo settings', variant: 'destructive' });
      } finally {
        setIsLoading(false);
      }
    };

    loadSettings();
  }, [firestore, toast]);

  // Save changes to Firestore
  const handleSave = async () => {
    if (!firestore) return;

    setIsSaving(true);
    try {
      const docRef = doc(firestore, 'platform_settings', 'promo_toast');
      await setDoc(docRef, {
        ...config,
        updatedAt: new Date(),
      }, { merge: true });

      toast({
        title: 'Promo Settings Saved',
        description: config.enabled ? 'Live promo campaign is now active!' : 'Promo settings updated (currently inactive).',
      });
    } catch (err) {
      console.error('Failed to save promo settings:', err);
      toast({ title: 'Save Failed', description: 'Could not save promo settings.', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  // Trigger preview on current screen
  const handleTestOnScreen = () => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('zeneva_trigger_promo_test', {
        detail: { ...config, enabled: true }
      }));
      toast({
        title: 'Pop-Up Triggered',
        description: 'Look at the bottom-right corner of your screen!',
      });
    }
  };

  // Reset campaign ID to force all merchants to see it again
  const handleResetCampaign = () => {
    const newId = `promo-wps-${Date.now().toString(36)}`;
    setConfig(prev => ({ ...prev, id: newId }));
    toast({
      title: 'New Campaign ID Generated',
      description: 'Saving will now reset dismissal timers for all merchants.',
    });
  };

  // Handle local image file upload and convert to base64
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({ title: 'Invalid File', description: 'Please select an image file (PNG, JPG, SVG, WebP).', variant: 'destructive' });
      return;
    }

    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      const result = uploadEvent.target?.result as string;
      if (result) {
        setConfig(prev => ({ ...prev, imageUrl: result }));
        toast({ title: 'Artwork Loaded', description: 'Custom design loaded into the preview.' });
      }
    };
    reader.readAsDataURL(file);
  };

  const activeTheme = THEME_STYLES[config.themeColor] || THEME_STYLES.blue;

  if (isLoading) {
    return <div className="p-12 text-center text-muted-foreground text-sm">Loading promo configurations...</div>;
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Header & Quick Action Bar */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-border/60 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-2">
              <Sparkles className="h-6 w-6 text-primary" />
              Desktop Promo Toasts (WPS Office Style)
            </h1>
            <Badge 
              variant={config.enabled ? 'default' : 'secondary'}
              className={config.enabled ? 'bg-emerald-600 text-white font-bold' : ''}
            >
              {config.enabled ? '● Active Live' : '○ Inactive'}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Display a sleek, colorful floating campaign card in the bottom-right corner of merchants' desktop and web screens.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={handleTestOnScreen}
            className="text-xs gap-1.5 border-primary/40 hover:bg-primary/10"
          >
            <Play className="h-3.5 w-3.5 text-primary" />
            Test Pop-Up on My Screen
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={isSaving}
            className="text-xs gap-1.5 bg-primary text-primary-foreground font-bold shadow-md"
          >
            <Save className="h-3.5 w-3.5" />
            {isSaving ? 'Saving...' : 'Save & Publish'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Controls and Design Options (7 cols) */}
        <div className="lg:col-span-7 space-y-5">
          
          {/* Main Activation Card */}
          <Card className="border-border/70 shadow-xs">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold">Campaign Status</CardTitle>
                  <CardDescription className="text-xs">Turn the promotional toast card on or off across the entire app.</CardDescription>
                </div>
                <div className="flex items-center gap-2.5">
                  <Label htmlFor="promo-enabled" className="text-xs font-semibold cursor-pointer">
                    {config.enabled ? 'Enabled (Showing to users)' : 'Disabled (Hidden)'}
                  </Label>
                  <Switch
                    id="promo-enabled"
                    checked={config.enabled}
                    onCheckedChange={(checked) => setConfig(prev => ({ ...prev, enabled: checked }))}
                  />
                </div>
              </div>
            </CardHeader>
          </Card>

          {/* Display Format & Custom Artwork */}
          <Card className="border-border/70 shadow-xs">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <ImageIcon className="h-4 w-4 text-primary" />
                Display Format & Custom Image Design
              </CardTitle>
              <CardDescription className="text-xs">
                Choose whether the card displays as a full poster graphic or a banner with action copy.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Display Mode Switcher */}
              <div className="grid grid-cols-2 gap-3">
                <div
                  onClick={() => setConfig(prev => ({ ...prev, displayMode: 'poster' }))}
                  className={`cursor-pointer rounded-xl border p-3.5 transition-all flex flex-col justify-between ${
                    config.displayMode === 'poster' 
                      ? 'border-primary bg-primary/10 shadow-xs ring-1 ring-primary' 
                      : 'border-border/70 bg-card hover:bg-muted/30'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-foreground">🖼️ Full Image Poster</span>
                    {config.displayMode === 'poster' && <CheckCircle2 className="h-4 w-4 text-primary" />}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    The entire card is your custom design (Figma, Canva, Photoshop). Clicking it opens the target link.
                  </p>
                </div>

                <div
                  onClick={() => setConfig(prev => ({ ...prev, displayMode: 'card' }))}
                  className={`cursor-pointer rounded-xl border p-3.5 transition-all flex flex-col justify-between ${
                    config.displayMode === 'card' 
                      ? 'border-primary bg-primary/10 shadow-xs ring-1 ring-primary' 
                      : 'border-border/70 bg-card hover:bg-muted/30'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-foreground">🗂️ Banner + Offer Card</span>
                    {config.displayMode === 'card' && <CheckCircle2 className="h-4 w-4 text-primary" />}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Image banner at top, with badge, headline, message copy, and shiny "Get my OFFER" button.
                  </p>
                </div>
              </div>

              {/* Custom Image Upload & URL */}
              <div className="space-y-2 pt-2 border-t border-border/50">
                <Label className="text-xs font-semibold">Custom Artwork / Promo Image</Label>
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="https://example.com/promo-banner.png or data:image..."
                    value={config.imageUrl}
                    onChange={(e) => setConfig(prev => ({ ...prev, imageUrl: e.target.value }))}
                    className="text-xs h-9"
                  />
                  <div className="relative shrink-0">
                    <Button variant="outline" size="sm" className="text-xs gap-1.5 h-9 cursor-pointer">
                      <Upload className="h-3.5 w-3.5" />
                      Upload File
                    </Button>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileUpload}
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    />
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Tip: Upload any graphic you design. Recommended aspect ratio is 16:9 or 2:1 (e.g. 600×320px).
                </p>
              </div>

              {/* 1-Click Preset Artwork Themes */}
              <div className="space-y-2 pt-1">
                <Label className="text-xs font-semibold text-muted-foreground">Or choose a pre-designed template:</Label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {PRESET_BANNERS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => setConfig(prev => ({ 
                        ...prev, 
                        imageUrl: preset.dataUrl, 
                        themeColor: preset.themeColor 
                      }))}
                      className="group p-2 rounded-lg border border-border/60 hover:border-primary/50 text-left transition-all bg-muted/20 hover:bg-muted/40"
                    >
                      <div className="flex items-center gap-1.5">
                        <span 
                          className="h-3 w-3 rounded-full shrink-0" 
                          style={{ backgroundColor: preset.previewColor }} 
                        />
                        <span className="text-[11px] font-bold truncate group-hover:text-primary">
                          {preset.label}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Copy, Button & Link Settings */}
          <Card className="border-border/70 shadow-xs">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Palette className="h-4 w-4 text-primary" />
                Copy, Offer & Color Theme
              </CardTitle>
              <CardDescription className="text-xs">
                Customize the text and action button for the promotional card.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Color Theme Selector */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Color Accent Aura</Label>
                <div className="flex flex-wrap gap-2">
                  {(['blue', 'orange', 'emerald', 'purple', 'amber'] as PromoToastColor[]).map((color) => {
                    const isSelected = config.themeColor === color;
                    const labels: Record<PromoToastColor, string> = {
                      blue: 'WPS Electric Blue',
                      orange: 'Zeneva Orange',
                      emerald: 'Cyber Emerald',
                      purple: 'Royal Purple',
                      amber: 'Golden Amber',
                    };
                    const colorDots: Record<PromoToastColor, string> = {
                      blue: 'bg-blue-500',
                      orange: 'bg-orange-500',
                      emerald: 'bg-emerald-500',
                      purple: 'bg-purple-500',
                      amber: 'bg-amber-500',
                    };

                    return (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setConfig(prev => ({ ...prev, themeColor: color }))}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold transition-all ${
                          isSelected 
                            ? 'border-primary bg-primary/10 text-foreground ring-1 ring-primary' 
                            : 'border-border/70 bg-card hover:bg-muted text-muted-foreground'
                        }`}
                      >
                        <span className={`h-2.5 w-2.5 rounded-full ${colorDots[color]}`} />
                        {labels[color]}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Title & Badge */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Card Title / Headline</Label>
                  <Input
                    placeholder="e.g. Upgrade to Zeneva Pro"
                    value={config.title}
                    onChange={(e) => setConfig(prev => ({ ...prev, title: e.target.value }))}
                    className="text-xs h-9"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Badge Tag</Label>
                  <Input
                    placeholder="e.g. 59% OFF · LIMITED OFFER"
                    value={config.badgeText}
                    onChange={(e) => setConfig(prev => ({ ...prev, badgeText: e.target.value }))}
                    className="text-xs h-9"
                  />
                </div>
              </div>

              {/* Description Body */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Description / Offer Details</Label>
                <Textarea
                  placeholder="Supercharge your store with multi-branch synchronization, offline POS, and AI sales predictions."
                  value={config.description}
                  onChange={(e) => setConfig(prev => ({ ...prev, description: e.target.value }))}
                  className="text-xs min-h-[70px] resize-none"
                />
              </div>

              {/* CTA Button & Target Link */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">CTA Button Label</Label>
                  <Input
                    placeholder="e.g. Get my OFFER"
                    value={config.buttonText}
                    onChange={(e) => setConfig(prev => ({ ...prev, buttonText: e.target.value }))}
                    className="text-xs h-9"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Destination URL / In-App Route</Label>
                  <Input
                    placeholder="/settings?tab=subscription"
                    value={config.targetUrl}
                    onChange={(e) => setConfig(prev => ({ ...prev, targetUrl: e.target.value }))}
                    className="text-xs h-9 font-mono"
                  />
                </div>
              </div>

              {/* Quick Destination Suggestions */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-[11px] text-muted-foreground">Quick Links:</span>
                {[
                  { label: 'Pro Subscription', url: '/settings?tab=subscription' },
                  { label: 'POS Terminal', url: '/pos' },
                  { label: 'Inventory Management', url: '/inventory' },
                  { label: 'Help & WhatsApp Support', url: '/support' },
                ].map((quick) => (
                  <button
                    key={quick.url}
                    type="button"
                    onClick={() => setConfig(prev => ({ ...prev, targetUrl: quick.url }))}
                    className="text-[10px] px-2 py-0.5 rounded bg-muted hover:bg-muted/80 text-foreground font-mono transition-colors"
                  >
                    {quick.label}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Targeting & Frequency Rules */}
          <Card className="border-border/70 shadow-xs">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Layers className="h-4 w-4 text-primary" />
                Delivery & Cooldown Rules
              </CardTitle>
              <CardDescription className="text-xs">
                Ensure the toast reaches the right users at the right frequency without being disruptive.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Target Platform */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Target Platform</Label>
                  <Select 
                    value={config.targetPlatform} 
                    onValueChange={(val: PromoToastTargetPlatform) => setConfig(prev => ({ ...prev, targetPlatform: val }))}
                  >
                    <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Devices (PC + Web)</SelectItem>
                      <SelectItem value="desktop">🪟 Windows Desktop App Only</SelectItem>
                      <SelectItem value="web">🌐 Web Browser Only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Dismissal Cooldown */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Dismissal Cooldown</Label>
                  <Select 
                    value={config.cooldownHours.toString()} 
                    onValueChange={(val) => setConfig(prev => ({ ...prev, cooldownHours: parseInt(val, 10) }))}
                  >
                    <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">Show every session</SelectItem>
                      <SelectItem value="12">Every 12 hours</SelectItem>
                      <SelectItem value="24">Every 24 hours (1 day)</SelectItem>
                      <SelectItem value="72">Every 3 days</SelectItem>
                      <SelectItem value="168">Every 7 days (1 week)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Delay before appearance */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Auto-Show Delay</Label>
                  <Select 
                    value={config.autoShowDelaySec.toString()} 
                    onValueChange={(val) => setConfig(prev => ({ ...prev, autoShowDelaySec: parseInt(val, 10) }))}
                  >
                    <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 second</SelectItem>
                      <SelectItem value="3">3 seconds (Recommended)</SelectItem>
                      <SelectItem value="5">5 seconds</SelectItem>
                      <SelectItem value="10">10 seconds</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Reset Campaign ID */}
              <div className="pt-2 border-t border-border/50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <div className="text-xs font-bold text-foreground">Campaign Identifier: <code className="font-mono text-primary font-normal">{config.id}</code></div>
                  <p className="text-[11px] text-muted-foreground">
                    Resetting the campaign ID causes the offer to show up again even for users who previously dismissed it.
                  </p>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleResetCampaign}
                  className="text-xs gap-1.5 shrink-0"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Reset Dismissals
                </Button>
              </div>
            </CardContent>
          </Card>

        </div>

        {/* Right Column: Real-Time Desktop Simulator (5 cols) */}
        <div className="lg:col-span-5 sticky top-6 space-y-3">
          <Card className="border-border/70 shadow-lg overflow-hidden bg-card/60 backdrop-blur-md">
            <CardHeader className="pb-3 border-b border-border/40">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold flex items-center gap-1.5">
                    <Laptop className="h-4 w-4 text-primary" />
                    Live Desktop Corner Simulator
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Real-time visual preview in bottom-right corner of screen.
                  </CardDescription>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setPreviewTheme(prev => prev === 'dark' ? 'light' : 'dark')}
                  title="Toggle light/dark background"
                >
                  {previewTheme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                </Button>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              {/* Simulated Desktop Window Viewport */}
              <div className={`relative h-[500px] w-full p-4 flex flex-col justify-end items-end overflow-hidden transition-colors ${
                previewTheme === 'dark' ? 'bg-[#0f172a]' : 'bg-[#e2e8f0]'
              }`}>
                {/* Simulated Desktop Wallpaper graphic */}
                <div className="absolute inset-0 opacity-20 pointer-events-none bg-[radial-gradient(#38bdf8_1px,transparent_1px)] [background-size:16px_16px]" />
                
                {/* Simulated Taskbar at Bottom */}
                <div className="absolute inset-x-0 bottom-0 h-10 bg-black/80 backdrop-blur-md border-t border-white/10 flex items-center justify-between px-3 text-[10px] text-white/70">
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 rounded-sm bg-blue-500 flex items-center justify-center font-black text-[9px] text-white">⊞</div>
                    <span className="font-semibold text-white/90">Zeneva</span>
                  </div>
                  <div className="flex items-center gap-2 font-mono text-[9px]">
                    <span>ENG</span>
                    <span>10:45 PM</span>
                  </div>
                </div>

                {/* The Toast Card Preview (Bottom-Right) */}
                <div className="relative mb-11 max-w-[340px] w-full">
                  <div className={`rounded-2xl overflow-hidden backdrop-blur-xl bg-card/95 border ${activeTheme.glowBorder} shadow-2xl shadow-black/50 select-none relative group`}>
                    
                    {/* Glowing Aura Gradient */}
                    <div className={`absolute -inset-1 bg-gradient-to-b ${activeTheme.headerGlow} opacity-70 pointer-events-none`} />

                    {/* Close Button Preview */}
                    <div className="absolute top-2.5 right-2.5 z-30 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white/80 backdrop-blur-md shadow-md">
                      <X className="h-4 w-4" />
                    </div>

                    {/* Mode A: Poster */}
                    {config.displayMode === 'poster' ? (
                      <div className="relative overflow-hidden cursor-pointer">
                        {config.imageUrl ? (
                          <img
                            src={config.imageUrl}
                            alt="Promo Poster Preview"
                            className="w-full h-auto max-h-[280px] object-cover"
                          />
                        ) : (
                          <div className="h-48 w-full bg-muted flex items-center justify-center text-xs text-muted-foreground">
                            Custom Graphic Design
                          </div>
                        )}
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent p-3 pt-6 flex items-center justify-between">
                          <span className="text-xs font-bold text-white flex items-center gap-1.5 drop-shadow-md">
                            <Sparkles className="h-3.5 w-3.5 text-yellow-300" />
                            {config.buttonText || 'Claim Offer'}
                          </span>
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-black shadow-md">
                            <ArrowRight className="h-3.5 w-3.5" />
                          </span>
                        </div>
                      </div>
                    ) : (
                      /* Mode B: Card */
                      <div className="relative flex flex-col">
                        {config.imageUrl && (
                          <div className="relative h-32 w-full overflow-hidden bg-muted/30">
                            <img
                              src={config.imageUrl}
                              alt="Banner Preview"
                              className="h-full w-full object-cover"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-card via-transparent to-black/30 pointer-events-none" />
                          </div>
                        )}
                        <div className="p-3.5 space-y-2">
                          {config.badgeText && (
                            <div className="flex items-center gap-2">
                              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${activeTheme.badgeBg}`}>
                                <Sparkles className="h-2.5 w-2.5" />
                                {config.badgeText}
                              </span>
                            </div>
                          )}
                          <div>
                            <h4 className="font-extrabold text-xs sm:text-sm leading-snug text-foreground tracking-tight">
                              {config.title || 'Special Zeneva Offer'}
                            </h4>
                            {config.description && (
                              <p className="mt-0.5 text-[11px] text-muted-foreground leading-relaxed line-clamp-2">
                                {config.description}
                              </p>
                            )}
                          </div>
                          <div className="pt-0.5">
                            <button className={`w-full py-2 px-3 rounded-xl font-bold text-[11px] flex items-center justify-center gap-1.5 transition-all ${activeTheme.buttonClass}`}>
                              <span>{config.buttonText || 'Get my OFFER'}</span>
                              <ArrowRight className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
