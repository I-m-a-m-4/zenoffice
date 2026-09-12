'use client';

import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { generateContentPlan } from '@/ai/flows/content-strategy-flow';
import type { ContentStrategyOutput } from '@/types';
import { Newspaper, Loader2, Sparkles, Send, Copy, ArrowRight, Share2, Bot, Bookmark, BookOpen, AlertCircle } from 'lucide-react';
import { idToken } from '@/lib/id-token';

interface ContentStrategyCenterProps {
  platformStats?: {
    totalUsers: number;
    totalBusinesses: number;
    totalProducts: number;
    totalReceipts: number;
    platformGmv: number;
    averageSalesPerDay: number;
    platformAOV: number;
    topLocation: string;
    topIndustries: string[];
  };
}

export default function ContentStrategyCenter({ platformStats }: ContentStrategyCenterProps) {
  const [theme, setTheme] = React.useState('Offline POS & Power Outages');
  const [platform, setPlatform] = React.useState('Medium Article');
  const [persona, setPersona] = React.useState('General Retailers');
  const [seedKnowledge, setSeedKnowledge] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);
  const [result, setResult] = React.useState<ContentStrategyOutput | null>(null);
  
  const { toast } = useToast();

  const themesList = [
    'Offline POS & Power Outages',
    'Preventing Employee Stock Theft',
    'USD Payouts & Domiciliary Accounts',
    'Business Grants & Capital Directory',
    'Zen AI Profit Forecasting',
    'Multi-Store Scaling Realities'
  ];

  const platformsList = [
    'Medium Article',
    'Substack Newsletter',
    'LinkedIn Post',
    'Twitter Thread'
  ];

  const personasList = [
    'General Retailers',
    'Supermarkets & Minimarts',
    'Pharmacies & Chemists',
    'Fashion & Boutiques'
  ];

  const handleGenerate = async () => {
    setIsLoading(true);
    setResult(null);
    try {
      const plan = await generateContentPlan({
        theme,
        platform,
        persona,
        seedKnowledge,
        platformStats
      }, await idToken());
      setResult(plan);
      toast({
        variant: 'success',
        title: 'Strategy Formulated!',
        description: 'Zen AI has compiled your custom content blueprint.'
      });
    } catch (e: any) {
      toast({
        variant: 'destructive',
        title: 'Formulation Failed',
        description: e.message || 'The AI generator is currently overloaded.'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      variant: 'success',
      title: 'Copied!',
      description: 'Copied to clipboard successfully.'
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
      {/* Left Column: Form Configuration */}
      <Card className="lg:col-span-2 border-slate-200">
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-lg flex items-center gap-2 font-display">
              <Bot className="h-5 w-5 text-orange-600 animate-pulse" />
              AI Content Strategist
            </CardTitle>
            {platformStats && (
              <Badge className="bg-emerald-500/10 hover:bg-emerald-500/15 text-emerald-600 border border-emerald-500/20 text-[10px] font-bold">
                ● Live Stats
              </Badge>
            )}
          </div>
          <CardDescription>
            Strategize and outline high-quality marketing articles designed to drive backlink growth and convert retail merchants to Zeneva.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Core Value Theme</Label>
            <Select value={theme} onValueChange={setTheme}>
              <SelectTrigger className="border-slate-200">
                <SelectValue placeholder="Select theme" />
              </SelectTrigger>
              <SelectContent>
                {themesList.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Target Channel</Label>
              <Select value={platform} onValueChange={setPlatform}>
                <SelectTrigger className="border-slate-200">
                  <SelectValue placeholder="Select platform" />
                </SelectTrigger>
                <SelectContent>
                  {platformsList.map((p) => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Target Persona</Label>
              <Select value={persona} onValueChange={setPersona}>
                <SelectTrigger className="border-slate-200">
                  <SelectValue placeholder="Select persona" />
                </SelectTrigger>
                <SelectContent>
                  {personasList.map((pe) => (
                    <SelectItem key={pe} value={pe}>{pe}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Inject Specific Knowledge / Story (Optional)</Label>
            <Textarea
              value={seedKnowledge}
              onChange={(e) => setSeedKnowledge(e.target.value)}
              placeholder="e.g. A pharmacy owner in Ikeja named Tunde saved ₦150k after catching stock theft using our audit log alerts..."
              className="min-h-[120px] text-xs border-slate-200"
            />
          </div>
        </CardContent>
        <CardFooter>
          <Button 
            onClick={handleGenerate} 
            disabled={isLoading}
            className="w-full bg-slate-900 hover:bg-slate-950 text-white font-semibold transition-all shadow-md flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Drafting Strategy...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Formulate AI Content Blueprint
              </>
            )}
          </Button>
        </CardFooter>
      </Card>

      {/* Right Column: AI Output Strategy Display */}
      <Card className="lg:col-span-3 border-slate-200 min-h-[500px] flex flex-col">
        <CardHeader className="border-b border-slate-100 pb-4">
          <CardTitle className="text-lg flex items-center gap-2 font-display">
            <Newspaper className="h-5 w-5 text-slate-700" />
            Strategy Output
          </CardTitle>
          <CardDescription>
            Outlines, hooks, CTAs, and backlinking points formatted for instant composition.
          </CardDescription>
        </CardHeader>
        <div className="flex-grow flex flex-col justify-center">
          {isLoading ? (
            <div className="text-center p-12 space-y-4">
              <Loader2 className="h-10 w-10 animate-spin text-orange-600 mx-auto" />
              <div className="text-sm font-semibold text-slate-800 animate-pulse">Zen AI is generating outline segments...</div>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">Structuring core retail arguments, keywords, and call-to-actions to maximize signups.</p>
            </div>
          ) : result ? (
            <ScrollArea className="h-[600px] p-6">
              <div className="space-y-6">
                
                {/* Title Segment */}
                <div className="p-4 bg-orange-50/50 border border-orange-100 rounded-xl relative group">
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => copyToClipboard(result.title)}>
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <span className="text-[9px] font-bold text-orange-600 uppercase tracking-widest block mb-1">Recommended Headline</span>
                  <h3 className="text-lg font-black text-slate-900 font-display leading-tight">{result.title}</h3>
                </div>

                {/* SEO Target Keywords */}
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Target SEO Keywords</span>
                  <div className="flex flex-wrap gap-1.5">
                    {result.seoKeywords.map((kw, i) => (
                      <Badge key={i} variant="secondary" className="text-[10px] font-semibold bg-slate-100 text-slate-800">
                        {kw}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Introduction / The Hook */}
                <div className="space-y-2 border-t border-slate-100 pt-4">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Compelling Hook / Introduction</span>
                  <p className="text-sm text-slate-700 leading-relaxed italic bg-slate-50 p-4 rounded-xl border border-slate-100">
                    "{result.introduction}"
                  </p>
                </div>

                {/* Outline Sections */}
                <div className="space-y-4 border-t border-slate-100 pt-4">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Article Structure & Outline</span>
                  <div className="space-y-3">
                    {result.outline.map((section, idx) => (
                      <div key={idx} className="p-4 border border-slate-200/60 rounded-xl bg-white space-y-2">
                        <h4 className="font-bold text-sm text-slate-950 flex gap-2">
                          <span className="text-orange-600 font-mono">0{idx + 1}.</span>
                          {section.heading}
                        </h4>
                        <ul className="space-y-1.5 pl-5 list-disc text-xs text-slate-600 leading-relaxed">
                          {section.talkingPoints.map((tp, i) => (
                            <li key={i}>{tp}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Recommended CTA */}
                <div className="p-4 bg-slate-900 text-white rounded-xl space-y-2">
                  <span className="text-[9px] font-bold text-orange-400 uppercase tracking-widest block">Strategic Call-To-Action</span>
                  <p className="text-xs text-slate-300 leading-relaxed">{result.ctaText}</p>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="h-7 text-[10px] bg-transparent text-white border-white/20 hover:bg-white/10"
                    onClick={() => copyToClipboard(result.ctaText)}
                  >
                    <Copy className="h-3 w-3 mr-1" /> Copy CTA text
                  </Button>
                </div>

                {/* Backlink Recommendations */}
                <div className="space-y-2 border-t border-slate-100 pt-4">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Backlinking Recommendations</span>
                  <div className="space-y-1.5">
                    {result.backlinkOpportunities.map((op, i) => (
                      <div key={i} className="flex gap-2 text-xs text-slate-600">
                        <ArrowRight className="h-3.5 w-3.5 text-orange-500 shrink-0 self-center" />
                        <span>{op}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Growth Strategy Pitch */}
                <div className="p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-xl space-y-1">
                  <span className="text-[9px] font-bold text-emerald-600 uppercase tracking-widest block">Growth Analyst Pitch</span>
                  <p className="text-xs text-slate-600 leading-relaxed">{result.marketingPitch}</p>
                </div>

              </div>
            </ScrollArea>
          ) : (
            <div className="text-center p-12 space-y-2">
              <Bot className="h-10 w-10 text-slate-300 mx-auto" />
              <div className="text-sm font-semibold text-slate-800">Select parameters and trigger generation</div>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">Zen AI will structure a tailored marketing outline focusing on real-world retail value propositions.</p>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
