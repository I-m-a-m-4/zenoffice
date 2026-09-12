'use client';

import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';

// Extend the Window interface to include PaystackPop
declare global {
  interface Window {
    PaystackPop?: {
      setup: (options: PaystackSetupConfig) => {
        openIframe: () => void;
      };
    };
  }
}

interface PaystackCustomField {
  display_name: string;
  variable_name: string;
  value: string;
}

interface PaystackMetadata {
  custom_fields?: PaystackCustomField[];
  [key: string]: any;
}

interface PaystackSetupConfig {
  key: string;
  email: string;
  amount: number; // in kobo
  currency?: string;
  ref?: string;
  callback?: (response: { reference: string }) => void;
  onClose?: () => void;
  plan?: string;
  metadata?: PaystackMetadata;
  subaccount?: string;
}

export interface PaystackHookConfig {
  key: string;
  email: string;
  amount: number;
  currency?: string;
  reference?: string;
  ref?: string;
  onSuccess?: (response: { reference: string; [key: string]: any } | string) => void;
  onClose?: () => void;
  plan?: string;
  metadata?: PaystackMetadata;
  subaccount?: string;
}

const SCRIPT_URL = 'https://js.paystack.co/v1/inline.js';
const SCRIPT_ID = 'paystack-sdk';
let scriptPromise: Promise<void> | null = null;

const loadScript = (): Promise<void> => {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.PaystackPop) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.getElementById(SCRIPT_ID);
    if (existing) {
      if (window.PaystackPop) {
        resolve();
        return;
      }
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => {
        scriptPromise = null;
        existing.remove();
        reject(new Error('Paystack SDK failed to load.'));
      }, { once: true });
      return;
    }

    const script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.src = SCRIPT_URL;
    script.async = true;

    // 15s timeout
    const timeout = setTimeout(() => {
      scriptPromise = null;
      script.remove();
      reject(new Error('Paystack SDK load timed out'));
    }, 15000);

    script.onload = () => {
      clearTimeout(timeout);
      resolve();
    };

    script.onerror = (e) => {
      clearTimeout(timeout);
      console.warn('Paystack SDK network timeout or blocked:', e);
      scriptPromise = null;
      script.remove();
      reject(new Error('Paystack SDK failed to load.'));
    };

    document.body.appendChild(script);
  });

  return scriptPromise;
};

export const usePaystack = () => {
  const [isSdkReady, setIsSdkReady] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    let mounted = true;
    loadScript()
      .then(() => {
        if (mounted) setIsSdkReady(true);
      })
      .catch((err) => {
        // Silently capture prefetch error without spamming toasts during page load
        if (mounted) setIsSdkReady(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const initializePayment = useCallback(async (config: PaystackHookConfig) => {
    if (!window.PaystackPop) {
      try {
        await loadScript();
        setIsSdkReady(true);
      } catch (err) {
        console.error('Paystack load error:', err);
        toast({
          variant: 'destructive',
          title: 'Payment Gateway Error',
          description: 'Could not connect to payment gateway. Please check your internet connection and try again.',
        });
        config.onClose?.();
        return;
      }
    }

    if (!window.PaystackPop) {
      toast({
        variant: 'destructive',
        title: 'Payment Gateway Error',
        description: 'Payment system is temporarily unavailable. Please try again.',
      });
      config.onClose?.();
      return;
    }

    const paystackConfig: PaystackSetupConfig = {
      key: config.key,
      email: config.email,
      amount: config.amount,
      currency: config.currency || 'NGN',
      ref: config.reference || config.ref,
      plan: config.plan,
      metadata: config.metadata,
      subaccount: config.subaccount,
      callback: (response: any) => {
        if (config.onSuccess) {
          // Pass the full response object with reference guaranteed
          config.onSuccess(response);
        }
      },
      onClose: () => {
        if (config.onClose) {
          config.onClose();
        }
      },
    };

    try {
      const handler = window.PaystackPop.setup(paystackConfig);
      handler.openIframe();
    } catch (e: any) {
      console.error('Error opening Paystack iframe:', e);
      toast({
        variant: 'destructive',
        title: 'Payment Error',
        description: 'Could not open the payment gateway. Please try again.',
      });
      config.onClose?.();
    }
  }, [toast]);

  return { isSdkReady, isScriptLoaded: isSdkReady, initializePayment };
};

export default usePaystack;
