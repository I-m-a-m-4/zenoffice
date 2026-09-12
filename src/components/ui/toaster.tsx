'use client';

import { useToast } from '@/hooks/use-toast';
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from '@/components/ui/toast';
import { CheckCircle2, AlertTriangle, WifiOff } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Toaster() {
  const { toasts } = useToast();

  return (
    <ToastProvider duration={3000}>
      {toasts.map(function ({ id, title, description, action, variant, ...props }) {
        let icon: React.ReactNode = null;
        if (variant === 'success') {
          icon = <CheckCircle2 className="h-5 w-5" />;
        } else if (variant === 'destructive') {
          icon = title === 'No Internet Connection' ? <WifiOff className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />;
        } else if (variant === 'warning') {
          icon = <AlertTriangle className="h-5 w-5" />;
        }

        return (
          <Toast key={id} variant={variant} {...props} className="p-3">
            <div className="flex w-full items-center gap-3">
              {icon && <div className="shrink-0">{icon}</div>}

              <div className="grid flex-1 gap-1">
                {title && <ToastTitle className="text-sm">{title}</ToastTitle>}
                {description && <ToastDescription className="text-xs">{description}</ToastDescription>}
              </div>

              <div className="flex items-center">
                {action}
                <div className={cn("ml-4 h-full w-px self-stretch bg-white/20", !action && "hidden")}></div>
                <ToastClose className="relative right-0 top-0 translate-x-0 translate-y-0" />
              </div>
            </div>
          </Toast>
        );
      })}
      <ToastViewport className="no-print" />
    </ToastProvider>
  );
}
