'use client';

import * as React from 'react';
import { useEffect, useState, useRef } from 'react';
import { getAuth } from 'firebase/auth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import {
  Database, RefreshCw, Calendar, ShieldCheck, Play, Loader2,
  HardDrive, AlertTriangle, FileText, ChevronRight
} from 'lucide-react';

interface BackupSchedule {
  name: string;
  createTime: string;
  updateTime: string;
  dailyRecurrence?: any;
  weeklyRecurrence?: any;
  retention: string;
}

interface BackupInfo {
  name: string;
  database: string;
  createTime: string;
  expireTime: string;
  state: string;
}

interface DatabaseInfo {
  name: string;
  uid: string;
  createTime: string;
  type: string;
  state: string;
}

interface LogEntry {
  time: string;
  message: string;
}

export default function BackupsAdminPage() {
  const { toast } = useToast();
  const [schedules, setSchedules] = useState<BackupSchedule[]>([]);
  const [backups, setBackups] = useState<BackupInfo[]>([]);
  const [databases, setDatabases] = useState<DatabaseInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Recovery form states
  const [businessId, setBusinessId] = useState('');
  const [sourceDbId, setSourceDbId] = useState('restored-db');
  const [isDryRun, setIsDryRun] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isRecovering, setIsRecovering] = useState(false);

  const logsEndRef = useRef<HTMLDivElement>(null);

  const fetchBackupData = async () => {
    setIsLoading(true);
    try {
      const auth = getAuth();
      const user = auth.currentUser;
      if (!user) {
        toast({ variant: 'destructive', title: 'Unauthorized', description: 'Please authenticate first.' });
        return;
      }

      const token = await user.getIdToken();
      const res = await fetch('/api/admin/backups/schedules', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to fetch backup configurations.');
      }

      const data = await res.json();
      setSchedules(data.schedules);
      setBackups(data.backups);
      setDatabases(data.databases);
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBackupData();
  }, []);

  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  const handleRecover = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessId.trim()) {
      toast({ variant: 'destructive', title: 'Validation Error', description: 'Please enter a valid Business ID.' });
      return;
    }

    setIsRecovering(true);
    setLogs([]);

    try {
      const auth = getAuth();
      const user = auth.currentUser;
      if (!user) throw new Error('Not authenticated');

      const token = await user.getIdToken();
      const response = await fetch('/api/admin/backups/recover', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          businessId: businessId.trim(),
          sourceDbId: sourceDbId.trim(),
          isDryRun,
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(errText || 'Failed to start recovery operation.');
      }

      // Stream the response body
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('ReadableStream not supported by browser.');
      }

      let partialChunk = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = (partialChunk + chunk).split('\n');
        partialChunk = lines.pop() || '';

        for (const line of lines) {
          if (line.trim()) {
            try {
              const parsedLog: LogEntry = JSON.parse(line);
              setLogs((prev) => [...prev, parsedLog]);
            } catch {
              setLogs((prev) => [...prev, { time: new Date().toISOString(), message: line }]);
            }
          }
        }
      }

      toast({
        variant: 'success',
        title: 'Operation Finished',
        description: isDryRun ? 'Dry run simulation finished.' : 'Data recovery completed successfully!',
      });
      fetchBackupData();
    } catch (err: any) {
      setLogs((prev) => [...prev, { time: new Date().toISOString(), message: `CRITICAL ERROR: ${err.message}` }]);
      toast({ variant: 'destructive', title: 'Recovery Failed', description: err.message });
    } finally {
      setIsRecovering(false);
    }
  };

  const getDbName = (path: string) => path.split('/').pop() || path;

  return (
    <div className="space-y-8 p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-primary to-violet-500 bg-clip-text text-transparent">
            Backups & Data Recovery Control Panel
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage Firestore automated backup schedules, view backups, and perform single-tenant targeted recoveries.
          </p>
        </div>
        <Button onClick={fetchBackupData} disabled={isLoading} variant="outline" className="shrink-0 flex items-center gap-2">
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-muted-foreground text-sm">Querying Google Cloud Firestore admin environment...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Schedules, Backups and Active Databases */}
          <div className="lg:col-span-1 space-y-6">
            {/* Backup Schedules */}
            <Card className="border border-border/50 bg-card/60 backdrop-blur-md shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-primary" />
                  Backup Schedules
                </CardTitle>
                <CardDescription>Configured daily/weekly Firestore backup loops.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {schedules.length === 0 ? (
                  <div className="text-center py-6 border border-dashed border-border rounded-lg">
                    <p className="text-xs text-muted-foreground">No active backup schedules found.</p>
                  </div>
                ) : (
                  schedules.map((schedule) => (
                    <div key={schedule.name} className="p-4 rounded-xl border border-border/80 bg-background/40 hover:bg-background/80 transition-colors space-y-2">
                      <div className="flex items-center justify-between">
                        <Badge variant="success" className="text-[10px] font-bold">ACTIVE</Badge>
                        <span className="text-[10px] text-muted-foreground">Retention: {parseInt(schedule.retention) / 86400} days</span>
                      </div>
                      <p className="text-xs font-mono truncate text-muted-foreground select-all">{getDbName(schedule.name)}</p>
                      <div className="text-[10px] text-muted-foreground flex justify-between">
                        <span>Created: {new Date(schedule.createTime).toLocaleDateString()}</span>
                        <span>Daily: {schedule.dailyRecurrence ? 'Yes' : 'No'}</span>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            {/* Backups List */}
            <Card className="border border-border/50 bg-card/60 backdrop-blur-md shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <HardDrive className="h-5 w-5 text-primary" />
                  Backups Catalog
                </CardTitle>
                <CardDescription>Available restore points stored in GCS.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {backups.length === 0 ? (
                  <div className="text-center py-8 border border-dashed border-border rounded-lg bg-muted/20">
                    <AlertTriangle className="h-5 w-5 mx-auto text-amber-500 mb-2" />
                    <p className="text-xs text-muted-foreground">No backup archives populated yet.</p>
                    <p className="text-[10px] text-muted-foreground/60 mt-1 max-w-[200px] mx-auto">
                      Daily backups run automatically at midnight. The first backup will appear here tomorrow.
                    </p>
                  </div>
                ) : (
                  backups.map((backup) => (
                    <div key={backup.name} className="p-3 rounded-lg border border-border bg-background/50 text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold truncate max-w-[120px]">{getDbName(backup.name)}</span>
                        <Badge variant={backup.state === 'READY' ? 'success' : 'outline'}>{backup.state}</Badge>
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        <p>Date: {new Date(backup.createTime).toLocaleString()}</p>
                        <p>Expires: {new Date(backup.expireTime).toLocaleDateString()}</p>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            {/* Project Databases */}
            <Card className="border border-border/50 bg-card/60 backdrop-blur-md shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <Database className="h-5 w-5 text-primary" />
                  Project Databases
                </CardTitle>
                <CardDescription>All active Firestore database instances.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {databases.map((db) => (
                  <div key={db.name} className="p-3 rounded-lg border border-border/80 bg-background/30 flex items-center justify-between text-xs">
                    <div className="space-y-0.5">
                      <p className="font-bold text-foreground">{getDbName(db.name)}</p>
                      <p className="text-[10px] text-muted-foreground">Type: {db.type}</p>
                    </div>
                    <Badge variant={db.state === 'READY' ? 'success' : 'outline'}>{db.state}</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Targeted Tenant Recovery Console */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="border border-border/50 bg-card/75 backdrop-blur-lg shadow-sm">
              <CardHeader>
                <CardTitle className="text-xl font-bold flex items-center gap-2">
                  <ShieldCheck className="h-6 w-6 text-primary animate-pulse" />
                  Targeted Tenant Data Recovery
                </CardTitle>
                <CardDescription>
                  Copy and restore all records (business profile, products, receipts, users, sessions) for a specific business ID from a source database into the live production database.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleRecover} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Business ID */}
                    <div className="space-y-2">
                      <Label htmlFor="businessId" className="text-sm font-semibold">Business / Merchant ID</Label>
                      <Input
                        id="businessId"
                        placeholder="e.g. biz_xxxxxxxxxxxx"
                        value={businessId}
                        onChange={(e) => setBusinessId(e.target.value)}
                        disabled={isRecovering}
                        className="h-11 shadow-none"
                      />
                      <p className="text-[10px] text-muted-foreground">
                        Tip: You can copy this from the Users page or search.
                      </p>
                    </div>

                    {/* Source Database */}
                    <div className="space-y-2">
                      <Label htmlFor="sourceDb" className="text-sm font-semibold">Source Database ID</Label>
                      <Input
                        id="sourceDb"
                        placeholder="e.g. restored-db"
                        value={sourceDbId}
                        onChange={(e) => setSourceDbId(e.target.value)}
                        disabled={isRecovering}
                        className="h-11 shadow-none font-mono"
                      />
                      <p className="text-[10px] text-muted-foreground">
                        The restored backup instance (e.g. `restored-db`).
                      </p>
                    </div>
                  </div>

                  {/* Dry Run Checkbox */}
                  <div className="flex items-center space-x-2 p-3 bg-muted/40 rounded-lg border border-border">
                    <Checkbox
                      id="dryRun"
                      checked={isDryRun}
                      onCheckedChange={(checked) => setIsDryRun(checked === true)}
                      disabled={isRecovering}
                    />
                    <div className="grid gap-1.5 leading-none">
                      <Label
                        htmlFor="dryRun"
                        className="text-xs font-semibold leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                      >
                        Run as Dry Run simulation
                      </Label>
                      <p className="text-[10px] text-muted-foreground">
                        Scans the source database and counts documents without writing or overwriting any production data.
                      </p>
                    </div>
                  </div>

                  {/* Submit Button */}
                  <Button type="submit" disabled={isRecovering} className="w-full h-12 text-sm font-bold flex items-center justify-center gap-2">
                    {isRecovering ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin" />
                        Executing Migration...
                      </>
                    ) : (
                      <>
                        <Play className="h-5 w-5 fill-current" />
                        Start Targeted Tenant Recovery
                      </>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Live Progress Logs */}
            {(logs.length > 0 || isRecovering) && (
              <Card className="border border-border/50 bg-black/90 dark:bg-black/95 text-green-400 font-mono shadow-inner rounded-xl overflow-hidden">
                <CardHeader className="pb-3 border-b border-green-950 bg-black/40">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2 text-green-500">
                    <FileText className="h-4 w-4" />
                    Interactive Migration Log Output
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  <div className="h-[280px] overflow-y-auto space-y-1.5 text-xs custom-scrollbar">
                    {logs.map((log, index) => (
                      <div key={index} className="flex gap-2 items-start leading-relaxed">
                        <span className="text-green-800 shrink-0 select-none">
                          {new Date(log.time).toLocaleTimeString()}
                        </span>
                        <span className="text-green-700 select-none">
                          <ChevronRight className="h-3 w-3 inline shrink-0" />
                        </span>
                        <span className={log.message.startsWith('ERROR') ? 'text-red-500 font-bold' : log.message.startsWith('Recovery operation completed') ? 'text-blue-400 font-bold' : ''}>
                          {log.message}
                        </span>
                      </div>
                    ))}
                    {isRecovering && (
                      <div className="flex gap-2 items-center text-green-500 animate-pulse">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        <span>Awaiting next log chunk...</span>
                      </div>
                    )}
                    <div ref={logsEndRef} />
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
