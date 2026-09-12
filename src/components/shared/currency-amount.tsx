import React from 'react';
import { cn } from '@/lib/utils';

interface CurrencyAmountProps {
  symbol: string;
  amount: number;
  className?: string;
  symbolClassName?: string;
  fractionClassName?: string;
  hideFraction?: boolean;
}

export function CurrencyAmount({ 
  symbol, 
  amount, 
  className = "",
  symbolClassName = "text-[0.6em] font-medium opacity-80 mr-[0.1em] tracking-tight relative -top-[0.25em]",
  fractionClassName = "text-[0.65em] font-medium opacity-80 ml-[0.05em]",
  hideFraction = false
}: CurrencyAmountProps) {
  // Always format to 2 decimal places to guarantee a dot unless we specifically want to hide fractions
  const formatted = amount.toLocaleString(undefined, { 
    minimumFractionDigits: hideFraction ? 0 : 2, 
    maximumFractionDigits: hideFraction ? 0 : 2 
  });
  
  const parts = formatted.split(/[.,]/);
  
  // If there's no fraction (e.g. locale doesn't use it or hideFraction is true)
  if (parts.length === 1 || hideFraction) {
    return (
      <span className={cn("inline-flex items-baseline", className)}>
        <span className={symbolClassName}>{symbol}</span>
        <span>{formatted}</span>
      </span>
    );
  }

  // Find the separator used for decimals (usually . or ,)
  const lastDot = formatted.lastIndexOf('.');
  const lastComma = formatted.lastIndexOf(',');
  
  let separatorIndex = -1;
  if (lastDot > lastComma) separatorIndex = lastDot;
  else if (lastComma > lastDot) separatorIndex = lastComma;

  if (separatorIndex === -1) {
    return (
      <span className={cn("inline-flex items-baseline", className)}>
        <span className={symbolClassName}>{symbol}</span>
        <span>{formatted}</span>
      </span>
    );
  }

  const integerPart = formatted.substring(0, separatorIndex);
  const fractionPart = formatted.substring(separatorIndex);

  return (
    <span className={cn("inline-flex items-baseline", className)}>
      <span className={symbolClassName}>{symbol}</span>
      <span>{integerPart}</span>
      <span className={fractionClassName}>{fractionPart}</span>
    </span>
  );
}
