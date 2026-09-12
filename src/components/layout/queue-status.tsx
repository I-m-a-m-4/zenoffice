import React from 'react';
import { usePOS } from '@/context/pos-context';
import { Button } from '@/components/ui/button';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Cloud, RefreshCw, UploadCloud, AlertTriangle, CheckCircle2, XCircle, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function QueueStatus() {
    const { queuedActions, isQueueProcessing, clearFailedActions, processQueue, removeFromQueue } = usePOS();
    const [isOnline, setIsOnline] = React.useState(true);

    React.useEffect(() => {
        if (typeof navigator !== 'undefined') {
            setIsOnline(navigator.onLine);
        }
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    const pendingCount = queuedActions.filter(a => a.status === 'pending').length;
    const failedCount = queuedActions.filter(a => a.status === 'failed').length;
    const totalCount = queuedActions.length;

    if (totalCount === 0) return null;

    let triggerIcon = <UploadCloud className="h-4 w-4" />;
    let triggerColor = "text-muted-foreground";
    let badgeVariant: "default" | "destructive" | "secondary" | "outline" = "secondary";

    if (failedCount > 0) {
        triggerIcon = <AlertTriangle className="h-4 w-4" />;
        triggerColor = "text-destructive";
        badgeVariant = "destructive";
    } else if (isQueueProcessing && isOnline) { // ONLY spin if physically online!
        triggerIcon = <RefreshCw className="h-4 w-4 animate-spin" />;
        triggerColor = "text-primary";
        badgeVariant = "default";
    } else if (pendingCount > 0 || !isOnline) { // If offline or pending, show static Cloud
        triggerIcon = <Cloud className="h-4 w-4" />;
        triggerColor = "text-orange-500";
    }

    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="relative group hover:bg-orange-500 hover:text-white transition-all duration-300">
                    <span className={cn(triggerColor, "group-hover:text-white transition-colors duration-300")}>{triggerIcon}</span>
                    {totalCount > 0 && (
                        <Badge variant={badgeVariant} className="absolute -top-1 -right-1 px-1 min-w-[1.25rem] h-5 flex items-center justify-center pointer-events-none group-hover:bg-white group-hover:text-orange-500 transition-colors duration-300">
                            {totalCount}
                        </Badge>
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0" align="end">
                <div className="flex items-center justify-between p-4 border-b">
                    <h4 className="font-medium">Sync Queue</h4>
                    <div className="flex gap-2">
                        {failedCount > 0 && (
                            <Button variant="outline" size="sm" onClick={clearFailedActions} className="h-7 text-xs">
                                Clear Failed
                            </Button>
                        )}
                        {!isQueueProcessing && typeof navigator !== 'undefined' && navigator.onLine && (
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => processQueue()} title="Retry Sync">
                                <RefreshCw className="h-3.5 w-3.5" />
                            </Button>
                        )}
                    </div>
                </div>
                <ScrollArea className="h-[300px]">
                    {queuedActions.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full p-4 text-muted-foreground">
                            <CheckCircle2 className="h-8 w-8 mb-2 text-green-500" />
                            <p className="text-sm">All caught up!</p>
                        </div>
                    ) : (
                        <div className="divide-y">
                            {queuedActions.map((action) => (
                                <div key={action.id} className="p-3 flex items-start gap-3">
                                    <div className="mt-1">
                                        {action.status === 'pending' && <Cloud className="h-4 w-4 text-muted-foreground" />}
                                        {action.status === 'processing' && <RefreshCw className="h-4 w-4 animate-spin text-primary" />}
                                        {action.status === 'failed' && <XCircle className="h-4 w-4 text-destructive" />}
                                        {action.status === 'synced' && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                                    </div>
                                    <div className="flex-1 space-y-1">
                                        <p className="text-sm font-medium leading-none">{action.description || 'Unknown Action'}</p>
                                        <div className="flex items-center gap-2">
                                            <Badge variant="outline" className="text-[10px] px-1 py-0 h-auto uppercase tracking-wider">{action.type.replace(/-/g, ' ')}</Badge>
                                            <span className="text-xs text-muted-foreground capitalize">{action.status}</span>
                                        </div>
                                        {action.errorMessage && (
                                            <p className="text-xs text-destructive mt-1 bg-destructive/10 p-1 rounded">
                                                {action.errorMessage}
                                            </p>
                                        )}
                                    </div>
                                    {action.status !== 'processing' && (
                                        <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => removeFromQueue(action.id)}>
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </ScrollArea>
            </PopoverContent>
        </Popover>
    );
}
