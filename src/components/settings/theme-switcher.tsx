'use client';

import * as React from 'react';
import { useTheme } from 'next-themes';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Moon, Sun } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

export function ThemeSwitcher() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <Skeleton className="h-20 w-full" />;
  }

  const isDarkMode = resolvedTheme === 'dark';

  const toggleTheme = () => {
    setTheme(isDarkMode ? 'light' : 'dark');
  };

  return (
    <div className="flex items-center justify-between rounded-lg border p-4">
      <div className="space-y-0.5">
        <Label htmlFor="dark-mode-switch" className="text-base">
          Dark Mode
        </Label>
        <p className="text-sm text-muted-foreground">
          Enable dark mode for the application dashboard.
        </p>
      </div>
      <div className="flex items-center space-x-2">
        <Sun className={`h-5 w-5 transition-all ${!isDarkMode ? 'text-primary' : 'text-muted-foreground'}`} />
        <Switch
          id="dark-mode-switch"
          checked={isDarkMode}
          onCheckedChange={toggleTheme}
          aria-label="Toggle dark mode"
        />
        <Moon className={`h-5 w-5 transition-all ${isDarkMode ? 'text-primary' : 'text-muted-foreground'}`} />
      </div>
    </div>
  );
}
