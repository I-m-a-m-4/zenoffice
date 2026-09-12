'use client';

import * as React from 'react';
import { usePOS } from '@/context/pos-context';
import { Button } from '@/components/ui/button';
import { RefreshCw, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const COOLDOWN_SECONDS = 60;

export default function RefreshButton({ size = "sm" }: { size?: "sm" | "default" | "lg" | "icon" }) {
  const { triggerRefresh } = usePOS();
  const { toast } = useToast();
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [cooldown, setCooldown] = React.useState(0);

  const handleRefresh = () => {
    setIsRefreshing(true);
    triggerRefresh();
    toast({
      variant: 'success',
      title: 'Data Refreshing',
      description: 'Your data is being updated in the background.',
    });
    setCooldown(COOLDOWN_SECONDS);

    // Simulate refresh finishing and start cooldown
    setTimeout(() => {
      setIsRefreshing(false);
    }, 1500); // Give feedback that something is happening
  };

  React.useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  const isDisabled = isRefreshing || cooldown > 0;

  return (
    <Button 
        onClick={handleRefresh} 
        disabled={isDisabled} 
        variant="outline" 
        size={size}
        className="h-9 gap-1"
    >
      {isRefreshing ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <RefreshCw className={cn("h-3.5 w-3.5", isDisabled && "opacity-50")} />
      )}
      <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
        {isDisabled && !isRefreshing ? `Wait ${cooldown}s` : 'Refresh'}
      </span>
    </Button>
  );
}
