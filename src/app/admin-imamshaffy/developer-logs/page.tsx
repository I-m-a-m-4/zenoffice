'use client';

import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, limit, getDocs, onSnapshot } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { usePOS } from '@/context/pos-context';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2, Bug, MonitorSmartphone, Clock, Copy, CheckCircle2 } from 'lucide-react';
import { safeToDate } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { Button } from '@/components/ui/button';

interface ErrorLog {
  id: string;
  message: string;
  stack: string;
  url: string;
  userAgent: string;
  userId: string;
  businessId: string;
  type: string;
  createdAt: any;
}

export default function DeveloperLogsPage() {
  const { currentUserProfile, isLoading, user } = usePOS();
  const firestore = useFirestore();
  const [logs, setLogs] = useState<ErrorLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [usersMap, setUsersMap] = useState<Record<string, { name: string, email: string }>>({});
  const [businessesMap, setBusinessesMap] = useState<Record<string, string>>({});

  // Super admin check
  const isSuperAdmin = 
    currentUserProfile?.email === 'belloimam431@gmail.com' || 
    currentUserProfile?.email === 'bimex4@gmail.com' ||
    user?.email === 'belloimam431@gmail.com' ||
    user?.email === 'bimex4@gmail.com';

  useEffect(() => {
    if (!isSuperAdmin || !firestore) return;

    const q = query(
      collection(firestore, 'error_logs'),
      orderBy('createdAt', 'desc'),
      limit(50)
    );

    // Reset the last read timestamp when developer logs are viewed
    if (typeof window !== 'undefined' && isSuperAdmin) {
      localStorage.setItem('zeneva_last_viewed_errors', Date.now().toString());
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedLogs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ErrorLog[];
      setLogs(fetchedLogs);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching logs:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [isSuperAdmin, firestore]);

  useEffect(() => {
    if (!isSuperAdmin || !firestore) return;

    const fetchMappings = async () => {
      try {
        const [usersSnap, businessSnap] = await Promise.all([
          getDocs(collection(firestore, 'users')),
          getDocs(collection(firestore, 'businessInstances'))
        ]);

        const uMap: Record<string, { name: string, email: string }> = {};
        usersSnap.forEach(doc => {
          const data = doc.data();
          uMap[doc.id] = {
            name: data.name || 'Unknown User',
            email: data.email || 'No Email'
          };
        });
        setUsersMap(uMap);

        const bMap: Record<string, string> = {};
        businessSnap.forEach(doc => {
          const data = doc.data();
          bMap[doc.id] = data.name || 'Unnamed Business';
        });
        setBusinessesMap(bMap);
      } catch (err) {
        console.error("Error loading mapping details for logs page:", err);
      }
    };

    fetchMappings();
  }, [isSuperAdmin, firestore]);

  const getDeviceTypeFromUserAgent = (userAgent?: string) => {
    if (!userAgent) return 'Unknown';
    const ua = userAgent.toLowerCase();
    if (ua.includes('tauri')) return 'Desktop App';
    if (ua.includes('android') || ua.includes('iphone') || ua.includes('ipad')) return 'Mobile';
    return 'Web / Browser';
  };

  const copyStack = (stack: string, id: string) => {
    navigator.clipboard.writeText(stack);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (isLoading) {
    return <div className="flex h-full items-center justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (!isSuperAdmin) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 text-center max-w-md mx-auto">
        <Bug className="h-16 w-16 text-muted-foreground mb-4 opacity-20" />
        <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
        <p className="text-muted-foreground">You do not have permission to view Developer Logs.</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 w-full max-w-none px-4 md:px-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Developer Logs</h1>
          <p className="text-muted-foreground">Automated error reporting. Displaying the 50 most recent errors.</p>
        </div>
        <Badge variant="outline" className="gap-1.5 h-7">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          Live Monitoring Active
        </Badge>
      </div>

      <Card className="border shadow-sm">
        <CardHeader className="bg-muted/30 pb-4">
          <CardTitle className="text-lg">Recent Errors</CardTitle>
          <CardDescription>Global crashes, unhandled promises, and UI boundaries</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              Fetching logs...
            </div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <CheckCircle2 className="h-12 w-12 text-green-500/50 mb-4" />
              <h3 className="text-lg font-medium">All Systems Nominal</h3>
              <p className="text-sm text-muted-foreground">No recent errors have been logged.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-[180px]">Time</TableHead>
                    <TableHead className="w-[100px]">Type</TableHead>
                    <TableHead className="min-w-[300px]">Error Message</TableHead>
                    <TableHead className="w-[150px]">IDs</TableHead>
                    <TableHead className="w-[100px] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id} className="group">
                      <TableCell className="align-top whitespace-nowrap pt-4">
                        <div className="flex items-center text-xs text-muted-foreground">
                          <Clock className="mr-1 h-3 w-3" />
                          {log.createdAt ? formatDistanceToNow(safeToDate(log.createdAt), { addSuffix: true }) : 'Just now'}
                        </div>
                      </TableCell>
                      <TableCell className="align-top pt-4">
                        <Badge variant="secondary" className="capitalize text-[10px]">
                          {log.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="align-top pt-4 max-w-[200px] sm:max-w-md break-words whitespace-normal">
                        <div className="font-semibold text-destructive text-sm mb-1 break-words whitespace-normal">{log.message}</div>
                        {log.url && (
                          <div className="text-[10px] text-primary hover:underline truncate mb-2" title={log.url}>
                            <a href={log.url} target="_blank" rel="noopener noreferrer">
                              {log.url}
                            </a>
                          </div>
                        )}
                        {log.stack && (
                          <div className="bg-muted/50 p-2 rounded-md text-[10px] font-mono text-muted-foreground max-h-24 overflow-y-auto whitespace-pre-wrap break-words">
                            {log.stack}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="align-top pt-4">
                        <div className="space-y-2">
                          <div className="text-[10px] text-muted-foreground">
                            <span className="font-semibold block mb-0.5">Device / Agent:</span>
                            <Badge variant="outline" className="text-[9px] px-1 py-0 font-normal capitalize">
                              {getDeviceTypeFromUserAgent(log.userAgent)}
                            </Badge>
                            <span className="block text-[8px] text-muted-foreground/60 truncate max-w-[150px] mt-1" title={log.userAgent}>
                              {log.userAgent}
                            </span>
                          </div>
                          <div className="text-[10px] text-muted-foreground" title="User ID">
                            <span className="font-semibold block">User:</span>
                            {usersMap[log.userId] ? (
                              <div className="bg-muted/50 p-1 rounded border mt-0.5 space-y-0.5 max-w-[150px]">
                                <div className="font-bold text-foreground truncate">{usersMap[log.userId].name}</div>
                                <div className="text-[8px] text-muted-foreground truncate">{usersMap[log.userId].email}</div>
                              </div>
                            ) : (
                              <span className="font-mono text-[9px]">{log.userId || 'Guest'}</span>
                            )}
                          </div>
                          <div className="text-[10px] text-muted-foreground" title="Business ID">
                            <span className="font-semibold block">Business:</span>
                            {businessesMap[log.businessId] ? (
                              <span className="font-semibold text-foreground text-[9px] block truncate max-w-[150px]" title={businessesMap[log.businessId]}>
                                {businessesMap[log.businessId]}
                              </span>
                            ) : (
                              <span className="font-mono text-[9px]">{log.businessId || 'N/A'}</span>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="align-top text-right pt-4">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="h-7 text-[10px] gap-1"
                          onClick={() => copyStack(log.stack || log.message, log.id)}
                        >
                          {copiedId === log.id ? <CheckCircle2 className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                          {copiedId === log.id ? 'Copied' : 'Copy'}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
