
'use client';

import { useState, useEffect, useCallback } from 'react';

declare global {
  interface Window {
    DodoPaymentsCheckout?: {
      DodoPayments: {
        Initialize: (config: {
          mode: 'test' | 'live';
          displayType: 'overlay' | 'inline';
          onEvent?: (event: any) => void;
        }) => void;
        Checkout: {
          open: (config: { checkoutUrl: string }) => void;
        };
      };
    };
  }
}

export default function useDodoPayments() {
  const [isScriptLoaded, setIsScriptLoaded] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleMessage = (event: MessageEvent) => {
      // Check if message is from dodopayments
      if (typeof event.origin === 'string' && event.origin.includes('dodopayments.com')) {
        let data = event.data;
        if (typeof data === 'string') {
          try {
            data = JSON.parse(data);
          } catch (e) {}
        }
        
        // Handle checkout closed or cancelled
        const isCloseEvent = 
          data === 'checkout.closed' || 
          data === 'close' || 
          data === 'checkout.cancel' ||
          (data && (
            data.event_type === 'checkout.closed' || 
            data.event === 'checkout.closed' || 
            data.event_type === 'checkout.close' ||
            data.event_type === 'checkout.cancel' ||
            data.type === 'checkout.closed' ||
            data.type === 'close'
          ));
          
        if (isCloseEvent) {
          console.log("Dodo Checkout Closed message received. Forcing close.");
          
          // 1. Call SDK close if available
          try {
            if (window.DodoPaymentsCheckout) {
              const dodo = window.DodoPaymentsCheckout.DodoPayments;
              if (dodo && (dodo as any).Checkout && typeof (dodo as any).Checkout.close === 'function') {
                (dodo as any).Checkout.close();
              }
            }
          } catch (err) {
            console.error("Error calling DodoPayments close method:", err);
          }

          // 2. Manually clean up overlay elements from DOM
          const iframes = document.querySelectorAll('iframe');
          iframes.forEach(iframe => {
            if (iframe.src && iframe.src.includes('dodopayments.com')) {
              let parent = iframe.parentElement;
              iframe.remove();
              if (parent && (parent.id.includes('dodo') || parent.className.includes('dodo') || parent.style.position === 'fixed' || parent.style.zIndex === '99999' || parent.style.zIndex === '100000')) {
                parent.remove();
              }
            }
          });

          // Also remove any elements with classes/IDs containing dodo
          const dodoElements = document.querySelectorAll('[id*="dodo"], [class*="dodo"]');
          dodoElements.forEach(el => {
            // Keep the script itself
            if (el.tagName !== 'SCRIPT') {
              el.remove();
            }
          });
        }
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        const iframes = document.querySelectorAll('iframe');
        iframes.forEach(iframe => {
          if (iframe.src && iframe.src.includes('dodopayments.com')) {
            let parent = iframe.parentElement;
            iframe.remove();
            if (parent && (parent.id.includes('dodo') || parent.className.includes('dodo') || parent.style.position === 'fixed' || parent.style.zIndex === '99999' || parent.style.zIndex === '100000')) {
              parent.remove();
            }
          }
        });
      }
    };

    window.addEventListener('message', handleMessage);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('message', handleMessage);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.DodoPaymentsCheckout) {
      setIsScriptLoaded(true);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/dodopayments-checkout@latest/dist/index.js';
    script.async = true;
    script.id = 'dodo-payments-sdk';
    
    script.onload = () => {
      setIsScriptLoaded(true);
      // Initialize with default settings
      if (window.DodoPaymentsCheckout) {
        window.DodoPaymentsCheckout.DodoPayments.Initialize({
          mode: process.env.NEXT_PUBLIC_DODO_MODE === 'live' ? 'live' : 'test',
          displayType: 'overlay',
          onEvent: (event) => {
            const isClose = event && (
              event.event_type === 'checkout.closed' || 
              event.event_type === 'checkout.cancel' || 
              event.type === 'checkout.closed' || 
              event.type === 'close'
            );
            
            if (isClose) {
              console.log("SDK Event: Checkout closed.");
              const iframes = document.querySelectorAll('iframe');
              iframes.forEach(iframe => {
                if (iframe.src && iframe.src.includes('dodopayments.com')) {
                  let parent = iframe.parentElement;
                  iframe.remove();
                  if (parent && (parent.id.includes('dodo') || parent.className.includes('dodo') || parent.style.position === 'fixed')) {
                    parent.remove();
                  }
                }
              });
            }
          }
        });
      }
    };

    script.onerror = () => {
      console.error('Dodo Payments SDK failed to load.');
    };

    document.body.appendChild(script);

    return () => {
      // Don't remove script to avoid re-loading issues
    };
  }, []);

  const initializeCheckout = useCallback((checkoutUrl: string) => {
    if (!isScriptLoaded || !window.DodoPaymentsCheckout) {
      console.error('Dodo Payments SDK not loaded yet.');
      return;
    }

    window.DodoPaymentsCheckout.DodoPayments.Checkout.open({
      checkoutUrl
    });
  }, [isScriptLoaded]);

  return { isScriptLoaded, initializeCheckout };
}
