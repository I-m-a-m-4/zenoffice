'use client';

/**
 * Shared form machinery for every cap table record type.
 *
 * There are eight record types and each needs create, edit and delete. Writing
 * that out eight times produces eight subtly different dialogs; instead the
 * field list is data and one component renders it. react-hook-form + zod is the
 * house pattern for anything past a couple of fields (see
 * `admin-imamshaffy/notifications/page.tsx`), and it is what gives per-field
 * validation messages for free.
 */

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { ZodTypeAny } from 'zod';
import { Loader2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

export interface FieldOption {
  value: string;
  label: string;
}

export interface FieldDef {
  name: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'email' | 'select' | 'checkbox' | 'textarea';
  options?: FieldOption[];
  description?: string;
  placeholder?: string;
  step?: string;
  min?: number;
  /** Full width in the two-column grid. Checkboxes and textareas default to full. */
  full?: boolean;
}

/**
 * Radix refuses a `SelectItem` with an empty value — it reserves `''` for
 * "cleared, show the placeholder". Two tabs offer a genuine "none" choice
 * (`Not part of a round`, `No class linked yet`) declared as `value: ''`, so
 * stand a sentinel in for Radix and strip it back out on the way to the form.
 * The form keeps storing `''`, which both save paths already turn into `null`.
 */
const NONE_VALUE = '__none__';

function SelectField({
  field,
  value,
  onChange,
}: {
  field: FieldDef;
  value: unknown;
  onChange: (value: string) => void;
}) {
  const options = field.options ?? [];
  const hasNoneOption = options.some((option) => option.value === '');

  return (
    <Select
      onValueChange={(next) => onChange(next === NONE_VALUE ? '' : next)}
      value={value ? String(value) : hasNoneOption ? NONE_VALUE : undefined}
    >
      <SelectTrigger>
        <SelectValue placeholder={field.placeholder ?? 'Select...'} />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value || NONE_VALUE} value={option.value || NONE_VALUE}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function EquityFormDialog<T extends Record<string, any>>({
  open,
  onOpenChange,
  title,
  description,
  schema,
  fields,
  defaultValues,
  onSubmit,
  submitLabel = 'Save',
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  schema: ZodTypeAny;
  fields: FieldDef[];
  defaultValues: T;
  onSubmit: (values: T) => Promise<void>;
  submitLabel?: string;
}) {
  const [isSaving, setIsSaving] = React.useState(false);

  const form = useForm<T>({
    resolver: zodResolver(schema as any),
    defaultValues: defaultValues as any,
  });

  // Reopening the dialog for a different record must not show the previous
  // record's values — reset whenever the identity of the target changes.
  React.useEffect(() => {
    if (open) form.reset(defaultValues as any);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, JSON.stringify(defaultValues)]);

  const handleSubmit = async (values: T) => {
    setIsSaving(true);
    try {
      await onSubmit(values);
      onOpenChange(false);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit as any)} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {fields.map((field) => (
                <FormField
                  key={field.name}
                  control={form.control}
                  name={field.name as any}
                  render={({ field: rhf }) => (
                    <FormItem
                      className={cn(
                        (field.full || field.type === 'textarea' || field.type === 'checkbox') &&
                          'sm:col-span-2',
                        field.type === 'checkbox' && 'flex flex-row items-start gap-3 space-y-0 rounded-md border p-3',
                      )}
                    >
                      {field.type === 'checkbox' ? (
                        <>
                          <FormControl>
                            <Checkbox checked={Boolean(rhf.value)} onCheckedChange={rhf.onChange} />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel>{field.label}</FormLabel>
                            {field.description && (
                              <FormDescription>{field.description}</FormDescription>
                            )}
                          </div>
                        </>
                      ) : (
                        <>
                          <FormLabel>{field.label}</FormLabel>
                          <FormControl>
                            {field.type === 'select' ? (
                              <SelectField
                                field={field}
                                value={rhf.value}
                                onChange={rhf.onChange}
                              />
                            ) : field.type === 'textarea' ? (
                              <Textarea
                                placeholder={field.placeholder}
                                {...rhf}
                                value={rhf.value ?? ''}
                              />
                            ) : (
                              <Input
                                type={field.type}
                                placeholder={field.placeholder}
                                step={field.step}
                                min={field.min}
                                {...rhf}
                                value={rhf.value ?? ''}
                              />
                            )}
                          </FormControl>
                          {field.description && (
                            <FormDescription>{field.description}</FormDescription>
                          )}
                          <FormMessage />
                        </>
                      )}
                    </FormItem>
                  )}
                />
              ))}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving && <Loader2 className="mr-2 size-4 animate-spin" />}
                {submitLabel}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Delete confirmation.
 *
 * Driven by a nullable "pending item" rather than a boolean, matching
 * `users/page.tsx` — that way the dialog always knows what it is about to
 * delete and cannot fire against a stale target.
 */
export function DeleteConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  onConfirm: () => Promise<void>;
}) {
  const [isDeleting, setIsDeleting] = React.useState(false);

  const handleConfirm = async () => {
    setIsDeleting(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              // Keep the dialog mounted while the delete runs, so the spinner is visible.
              e.preventDefault();
              void handleConfirm();
            }}
            disabled={isDeleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeleting ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <Trash2 className="mr-2 size-4" />
            )}
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** Section shell shared by every tab: title, blurb, and an action on the right. */
export function TabSection({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

/** Consistent empty state, matching the dashed-border idiom in users/page.tsx. */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-12 text-center">
      <Icon className="size-10 text-muted-foreground" />
      <h3 className="mt-4 text-lg font-semibold">{title}</h3>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/** Date helpers — forms edit `yyyy-MM-dd` strings; Firestore stores Timestamps. */
export function toDateInput(value: unknown): string {
  if (!value) return '';
  const d =
    value instanceof Date
      ? value
      : typeof (value as { toDate?: unknown })?.toDate === 'function'
        ? (value as { toDate: () => Date }).toDate()
        : new Date(value as string);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
}

export function fromDateInput(value: string): Date {
  // Parse as local midday to sidestep the timezone shift that makes a date
  // picked as the 1st save as the previous month's last day west of UTC.
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1, 12, 0, 0);
}
