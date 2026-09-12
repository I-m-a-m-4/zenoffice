'use client';

/**
 * First-run setup.
 *
 * Zeneva today is one founder holding 100% and no outside investors. So the
 * empty state is not "here is a blank grid, go fill it in" — it is a short form
 * that records the incorporation and lands on a correct, complete cap table
 * showing the founder at 100%.
 *
 * This matters beyond convenience: every later number is relative. A funding
 * round dilutes *something*, a waterfall pays out *someone*. Recording the
 * founding issuance properly now is what makes the first round's arithmetic
 * right later.
 */

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Loader2, PieChart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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
import { percent, shares as fmtShares } from '@/lib/equity/format';

/**
 * 10,000,000 authorised with 10,000,000 issued is the conventional starting
 * point: a round number large enough that early grants are whole shares and a
 * 0.5% grant is 50,000 shares rather than a fraction.
 */
const DEFAULT_AUTHORIZED = 10_000_000;

export const SUPPORTED_CURRENCIES = [
  { code: 'NGN', label: 'Nigerian Naira (₦)' },
  { code: 'USD', label: 'US Dollar ($)' },
  { code: 'GBP', label: 'Pound Sterling (£)' },
  { code: 'EUR', label: 'Euro (€)' },
  { code: 'CAD', label: 'Canadian Dollar (C$)' },
  { code: 'ZAR', label: 'South African Rand (R)' },
  { code: 'KES', label: 'Kenyan Shilling (KSh)' },
  { code: 'GHS', label: 'Ghanaian Cedi (₵)' },
];

const setupSchema = z.object({
  companyLegalName: z.string().min(2, 'Enter the registered company name.'),
  currency: z.string().min(3),
  incorporationDate: z.string().min(1, 'Enter the incorporation date.'),
  founderName: z.string().min(2, 'Enter the founder name.'),
  founderEmail: z.string().email('Enter a valid email.').or(z.literal('')),
  authorizedShares: z.coerce.number().int().positive('Must be a positive whole number.'),
  foundingShares: z.coerce.number().int().positive('Must be a positive whole number.'),
  parValue: z.coerce.number().min(0, 'Cannot be negative.'),
});

export type SetupValues = z.infer<typeof setupSchema>;

export function EquitySetup({
  defaultFounderName,
  defaultFounderEmail,
  onSubmit,
}: {
  defaultFounderName: string;
  defaultFounderEmail: string;
  onSubmit: (values: SetupValues) => Promise<void>;
}) {
  const [isSaving, setIsSaving] = React.useState(false);

  const form = useForm<SetupValues>({
    resolver: zodResolver(setupSchema),
    defaultValues: {
      companyLegalName: 'Zeneva',
      currency: 'NGN',
      incorporationDate: new Date().toISOString().slice(0, 10),
      founderName: defaultFounderName,
      founderEmail: defaultFounderEmail,
      authorizedShares: DEFAULT_AUTHORIZED,
      foundingShares: DEFAULT_AUTHORIZED,
      parValue: 0.0001,
    },
  });

  const authorized = form.watch('authorizedShares');
  const issued = form.watch('foundingShares');
  const founderPct =
    Number(issued) > 0 ? 100 : 0; // sole holder at incorporation — always 100%
  const unissued = Math.max(0, Number(authorized || 0) - Number(issued || 0));

  const handleSubmit = async (values: SetupValues) => {
    setIsSaving(true);
    try {
      await onSubmit(values);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <Card>
        <CardHeader>
          <div className="mb-2 flex size-10 items-center justify-center rounded-xl bg-primary/10">
            <PieChart className="size-5 text-primary" />
          </div>
          <CardTitle>Set up the cap table</CardTitle>
          <CardDescription>
            Record the incorporation once, and every round, grant and exit calculation from here
            on has a correct starting point to work from.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-5">
              <FormField
                control={form.control}
                name="companyLegalName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Registered company name</FormLabel>
                    <FormControl>
                      <Input placeholder="Zeneva Ltd" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="currency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Equity currency</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {SUPPORTED_CURRENCIES.map((c) => (
                            <SelectItem key={c.code} value={c.code}>
                              {c.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Valuations and share prices. Independent of the currency your merchants
                        trade in.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="incorporationDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Incorporation date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="founderName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Founder</FormLabel>
                      <FormControl>
                        <Input placeholder="Bello Imam" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="founderEmail"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Founder email</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="you@zeneva.space" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <FormField
                  control={form.control}
                  name="authorizedShares"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Authorised shares</FormLabel>
                      <FormControl>
                        <Input type="number" min={1} step={1} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="foundingShares"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Issued to founder</FormLabel>
                      <FormControl>
                        <Input type="number" min={1} step={1} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="parValue"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Par value</FormLabel>
                      <FormControl>
                        <Input type="number" min={0} step="0.0001" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="rounded-lg border bg-muted/40 p-4 text-sm">
                <p className="font-medium">This will create</p>
                <ul className="mt-2 space-y-1 text-muted-foreground">
                  <li>
                    A <span className="font-medium text-foreground">Common</span> share class with{' '}
                    {fmtShares(Number(authorized) || 0)} authorised
                  </li>
                  <li>
                    {form.watch('founderName') || 'The founder'} holding{' '}
                    {fmtShares(Number(issued) || 0)} shares —{' '}
                    <span className="font-medium text-foreground">{percent(founderPct, 0)}</span> of
                    the company
                  </li>
                  {unissued > 0 && (
                    <li>{fmtShares(unissued)} authorised but unissued, available for future rounds</li>
                  )}
                </ul>
              </div>

              <Button type="submit" disabled={isSaving} className="w-full">
                {isSaving && <Loader2 className="mr-2 size-4 animate-spin" />}
                Create cap table
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
