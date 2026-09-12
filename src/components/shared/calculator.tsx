'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';

import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Delete, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface CalculatorProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

export default function Calculator({ isOpen, onOpenChange }: CalculatorProps) {
  const [display, setDisplay] = React.useState('0');
  const [firstOperand, setFirstOperand] = React.useState<number | null>(null);
  const [operator, setOperator] = React.useState<string | null>(null);
  const [waitingForSecondOperand, setWaitingForSecondOperand] = React.useState(false);
  const [fullOperation, setFullOperation] = React.useState('');
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    // When the dialog opens, focus the input but move the cursor to the end
    // to prevent the default text selection/highlighting behavior.
    if (isOpen) {
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.setSelectionRange(
            inputRef.current.value.length,
            inputRef.current.value.length
          );
        }
      }, 0);
    }
  }, [isOpen]);

  const inputDigit = (digit: string) => {
    if (waitingForSecondOperand) {
      setDisplay(digit);
      setWaitingForSecondOperand(false);
    } else {
      setDisplay(display === '0' ? digit : display + digit);
    }
  };

  const inputDecimal = () => {
    if (waitingForSecondOperand) {
      setDisplay('0.');
      setWaitingForSecondOperand(false);
      return;
    }
    if (!display.includes('.')) {
      setDisplay(display + '.');
    }
  };
  
  const performOperation = (nextOperator: string) => {
    const inputValue = parseFloat(display.replace(/,/g, ''));

    if (operator && waitingForSecondOperand) {
      setOperator(nextOperator);
      setFullOperation(`${firstOperand?.toLocaleString() || ''} ${nextOperator} `);
      return;
    }

    let result = firstOperand;
    if (firstOperand === null) {
      result = inputValue;
      setFirstOperand(inputValue);
    } else if (operator) {
      result = calculate(firstOperand, inputValue, operator);
      const resultString = String(Number.isNaN(result) ? 'Error' : result)
      setDisplay(resultString);
      setFirstOperand(result);
    }

    setWaitingForSecondOperand(true);
    setOperator(nextOperator);
    setFullOperation(`${(result !== null && !Number.isNaN(result)) ? result.toLocaleString() : ''} ${nextOperator} `);
  };
  
  const calculate = (first: number, second: number, op: string): number => {
      switch (op) {
          case '+': return first + second;
          case '-': return first - second;
          case '×': return first * second;
          case '÷': return second === 0 ? NaN : first / second;
          case '%': return first % second;
          default: return second;
      }
  }

  const handleEquals = () => {
      if (operator && firstOperand !== null) {
          const inputValue = parseFloat(display.replace(/,/g, ''));
          setFullOperation(`${firstOperand.toLocaleString()} ${operator} ${inputValue.toLocaleString()} =`);
          const result = calculate(firstOperand, inputValue, operator);
          setDisplay(String(Number.isNaN(result) ? 'Error' : result));
          setFirstOperand(null);
          setOperator(null);
          setWaitingForSecondOperand(true);
      }
  }
  
  const clearCalculator = () => {
    setDisplay('0');
    setFirstOperand(null);
    setOperator(null);
    setWaitingForSecondOperand(false);
    setFullOperation('');
  };

  const handleBackspace = () => {
    if (waitingForSecondOperand) return;
    if (display === 'Error' || display === 'NaN') {
        clearCalculator();
        return;
    }
    setDisplay(display.length > 1 ? display.slice(0, -1) : '0');
  };
  
  const buttons = [
    { label: 'C', action: clearCalculator, variant: 'destructive', className: 'hover:bg-red-600 hover:text-white text-white' },
    { icon: Delete, action: handleBackspace, variant: 'secondary', key: 'backspace' },
    { label: '%', action: () => performOperation('%'), variant: 'secondary' },
    { label: '÷', action: () => performOperation('÷'), variant: 'secondary' },
    { label: '7', action: () => inputDigit('7'), variant: 'outline' },
    { label: '8', action: () => inputDigit('8'), variant: 'outline' },
    { label: '9', action: () => inputDigit('9'), variant: 'outline' },
    { label: '×', action: () => performOperation('×'), variant: 'secondary' },
    { label: '4', action: () => inputDigit('4'), variant: 'outline' },
    { label: '5', action: () => inputDigit('5'), variant: 'outline' },
    { label: '6', action: () => inputDigit('6'), variant: 'outline' },
    { label: '-', action: () => performOperation('-'), variant: 'secondary' },
    { label: '1', action: () => inputDigit('1'), variant: 'outline' },
    { label: '2', action: () => inputDigit('2'), variant: 'outline' },
    { label: '3', action: () => inputDigit('3'), variant: 'outline' },
    { label: '+', action: () => performOperation('+'), variant: 'secondary' },
    { label: '0', action: () => inputDigit('0'), variant: 'outline', className: 'col-span-2' },
    { label: '.', action: inputDecimal, variant: 'outline' },
    { label: '=', action: handleEquals, variant: 'default' },
  ];

  const formattedDisplay = () => {
    if (display === 'Error' || display === 'NaN') return 'Error';
    const [integerPart, decimalPart] = display.split('.');
    const formattedInteger = parseFloat(integerPart.replace(/,/g, '')).toLocaleString();
    return decimalPart !== undefined ? `${formattedInteger}.${decimalPart}` : formattedInteger;
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.2 }}
          className="fixed z-[100] top-24 right-8 w-full max-w-[320px]"
        >
          <motion.div
            drag
            dragMomentum={false}
            className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-2xl space-y-4 cursor-grab active:cursor-grabbing select-none w-full"
          >
            <div className="flex flex-row items-center justify-between space-y-0 pb-1">
              <h2 className="text-base font-semibold">Calculator</h2>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100"
                onClick={() => onOpenChange(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-2">
              <div className="h-8 text-right text-muted-foreground pr-4 text-lg truncate">{fullOperation}</div>
              <Input
                ref={inputRef}
                type="text"
                readOnly
                value={formattedDisplay()}
                className="text-right text-5xl font-mono h-24 p-4 bg-transparent border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
              />
              <div className="grid grid-cols-4 gap-2 pt-2">
                {buttons.map(({label, action, variant, className, icon: Icon, key}, i) => (
                  <Button
                    key={key || label || i}
                    variant={variant as any}
                    className={cn("text-2xl h-16 pointer-events-auto", className)}
                    onClick={action}
                  >
                    {Icon ? <Icon className="h-6 w-6"/> : label}
                  </Button>
                ))}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
