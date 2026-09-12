'use client';

import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, PackageX, RefreshCw, Smartphone, Monitor, Globe, HelpCircle } from 'lucide-react';
import { scanForUninstalls, getUninstallStats, type UninstallScanResult } from '@/actions/uninstalls';
import { idToken } from '@/lib/id-token';
import { useToast } from '@/hooks/use-toast';

/** Presentation for each install channel recorded on a token. */
const CHANNELS: Record<string, { label: string; hint: string; icon: React.ElementType }> = {
  play: { label: 'Google Play', hint: 'Android installs', icon: Smartphone },
  microsoft: { label: 'Microsoft Store', hint: 'Windows desktop installs', icon: Monitor },
  tauri: { label: 'Direct download', hint: 'macOS / sideloaded desktop', icon: Monitor },
  web: { label: 'Web & PWA', hint: 'Browser, not a store install', icon: Globe },
  unknown: { label: 'Unknown', hint: 'Registered before tracking shipped', icon: HelpCircle },
};

function channelInfo(channel: string) {
  return CHANNELS[channel] || { label: channel, hint: 'Unrecognised channel', icon: HelpCircle };
}

export default function UninstallTracker() {
  const { toast } = useToast();
  const [stats, setStats] = React.useState<UninstallScanResult | null>(null);
  const [isScanning, setIsScanning] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    idToken()
      .then((t) => getUninstallStats(t))
      .then((r) => { if (!cancelled) setStats(r); })
      .catch(() => { /* card just shows the empty state */ })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const runScan = async () => {
    setIsScanning(true);
    try {
      const result = await scanForUninstalls(await idToken());
      if (!result.ok) {
        toast({ variant: 'destructive', title: 'Scan failed', description: result.error || 'Unknown error.' });
        return;
      }
      setStats(result);
      toast({
        title: 'Scan complete',
        description: `${result.scanned} device${result.scanned === 1 ? '' : 's'} checked — ${result.newlyUninstalled} newly uninstalled.`,
      });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Scan failed', description: error?.message || 'Unknown error.' });
    } finally {
      setIsScanning(false);
    }
  };

  const rows = (stats?.byChannel || []).filter((r) => r.active > 0 || r.uninstalled > 0);
  const totalUninstalled = rows.reduce((sum, r) => sum + r.uninstalled, 0);

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <PackageX className="h-5 w-5 text-red-500" />
          App Uninstalls
        </CardTitle>
        <CardDescription>
          Devices whose install is gone, grouped by where it came from. Detected by
          validating push tokens — no notification is sent to anyone.
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-6 justify-center">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading last scan…
          </div>
        ) : !stats ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No scan has run yet. Run one to build the first snapshot.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-lg border bg-background text-center">
                <p className="text-2xl font-bold">{stats.scanned.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Devices checked</p>
              </div>
              <div className="p-3 rounded-lg border bg-background text-center">
                <p className="text-2xl font-bold text-red-500">{totalUninstalled.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Uninstalled</p>
              </div>
              <div className="p-3 rounded-lg border bg-background text-center">
                <p className="text-2xl font-bold text-emerald-500">{stats.stillActive.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Still installed</p>
              </div>
            </div>

            {rows.length > 0 && (
              <div className="flex flex-col gap-2">
                {rows.map((row) => {
                  const info = channelInfo(row.channel);
                  const Icon = info.icon;
                  const total = row.active + row.uninstalled;
                  const pct = total > 0 ? Math.round((row.uninstalled / total) * 100) : 0;
                  return (
                    <div key={row.channel} className="flex items-center justify-between p-3 rounded-lg border bg-background">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="p-2 bg-muted rounded-full shrink-0">
                          <Icon className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold truncate">{info.label}</p>
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">{info.hint}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 pl-3">
                        <Badge variant={row.uninstalled > 0 ? 'destructive' : 'outline'}>
                          {row.uninstalled} gone
                        </Badge>
                        <span className="text-xs text-muted-foreground w-10 text-right">{pct}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {stats.scannedAt && (
              <p className="text-[11px] text-muted-foreground">
                Last scanned {new Date(stats.scannedAt).toLocaleString()}
                {stats.malformed > 0 && ` · ${stats.malformed} token(s) unreadable, not counted as uninstalls`}
              </p>
            )}
          </>
        )}

        <div className="rounded-lg border border-dashed p-3 bg-muted/30">
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            <span className="font-semibold text-foreground">Read this as an upper bound.</span>{' '}
            Only devices that enabled notifications are visible here, and the same
            signal fires if someone clears app data or revokes notification
            permission. Windows cannot distinguish a Store install from a
            sideloaded one, so Microsoft Store means Windows desktop. For exact
            figures use the Partner Center and Play Console dashboards.
          </p>
        </div>

        <Button onClick={runScan} disabled={isScanning} className="w-full">
          {isScanning ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Scanning devices…</>
          ) : (
            <><RefreshCw className="mr-2 h-4 w-4" /> Run uninstall scan</>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
