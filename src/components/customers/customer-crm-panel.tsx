'use client';

/**
 * The CRM half of a customer: tags, a note, and a way to actually contact them.
 *
 * All three were missing. `Customer` had no `tags` and no `notes` field at all, and
 * there is no customer-directed messaging anywhere in the app — despite the app
 * generating campaign *copy* in two places with nothing able to send it.
 *
 * ## Deep links rather than a provider
 *
 * WhatsApp, SMS and email all go out through the device's own apps via `wa.me`,
 * `sms:` and `mailto:`. No provider, no API key, no per-message cost, nothing to
 * bill the shop for, and it works offline in the sense that matters — the handoff
 * is local. It is also how this market actually contacts customers.
 *
 * ## The phone-number problem, handled honestly
 *
 * `wa.me` needs a full international number. Customer phones here are free text —
 * the add-customer dialog uses a plain `<Input>`, not the E.164 `PhoneInput` — so a
 * stored number may be `+2348031234567`, `08031234567`, or anything else.
 *
 * A local number starting with a trunk `0` cannot be resolved without knowing the
 * country, so the country is taken from the shop's own phone number when that one
 * *is* in international form. If it cannot be resolved, the WhatsApp button is
 * **hidden with a reason** rather than shown as a link that silently opens an
 * "invalid number" page. SMS and email have no such requirement and always work.
 */

import * as React from 'react';
import { Loader2, Mail, MessageCircle, MessageSquare, Save, StickyNote, Tag as TagIcon, X } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { COUNTRY_CODES } from '@/components/ui/phone-input';
import { usePOS } from '@/context/pos-context';
import { useToast } from '@/hooks/use-toast';
import type { Customer } from '@/types';

/** Keep the row readable and the document small. */
const MAX_TAGS = 12;
const MAX_TAG_LENGTH = 24;
const MAX_NOTES_LENGTH = 2000;

/**
 * Turn a stored phone number into the digits `wa.me` expects, or `null` when that
 * cannot be done without guessing.
 */
export function toWhatsAppDigits(
  phone: string | undefined | null,
  businessPhone?: string | null,
): string | null {
  if (!phone) return null;
  const trimmed = String(phone).trim();
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length < 7) return null;

  // Already international.
  if (trimmed.startsWith('+')) return digits;
  // 00 is the other international prefix.
  if (digits.startsWith('00')) return digits.slice(2);

  if (digits.startsWith('0')) {
    // A trunk zero. Borrow the dialling code from the shop's own number — a shop
    // and its walk-in customers are essentially always in the same country — but
    // only when the shop's number is itself unambiguous.
    const bp = String(businessPhone ?? '').trim();
    if (bp.startsWith('+')) {
      const bpDigits = bp.replace(/\D/g, '');
      const match = COUNTRY_CODES.map(c => c.code.replace(/\D/g, ''))
        .filter(code => code && bpDigits.startsWith(code))
        // Longest match wins: 1 would otherwise shadow 1242.
        .sort((a, b) => b.length - a.length)[0];
      if (match) return `${match}${digits.slice(1)}`;
    }
    return null;
  }

  // No leading zero and no plus: ambiguous, but long enough to already carry a
  // country code in practice. Short values are refused above.
  return digits;
}

interface CustomerCrmPanelProps {
  customer: Customer;
  /** Unpaid + pending total we can see, for the payment-reminder template. */
  outstanding?: number;
  currencySymbol?: string;
}

export default function CustomerCrmPanel({
  customer,
  outstanding = 0,
  currencySymbol = '',
}: CustomerCrmPanelProps) {
  const { addToQueue, business } = usePOS();
  const { toast } = useToast();

  const [tags, setTags] = React.useState<string[]>(customer.tags || []);
  const [tagDraft, setTagDraft] = React.useState('');
  const [notes, setNotes] = React.useState(customer.notes || '');
  const [savingTags, setSavingTags] = React.useState(false);
  const [savingNotes, setSavingNotes] = React.useState(false);

  // Re-sync when the queue flush or a sync brings a newer version of the row.
  React.useEffect(() => {
    setTags(customer.tags || []);
  }, [customer.tags]);
  React.useEffect(() => {
    setNotes(customer.notes || '');
  }, [customer.notes]);

  const notesDirty = (customer.notes || '') !== notes;

  const persist = async (values: Partial<Customer>) => {
    await addToQueue({
      type: 'update-customer',
      payload: { id: customer.id, values },
    } as any);
  };

  const commitTags = async (next: string[]) => {
    setTags(next);
    setSavingTags(true);
    try {
      await persist({ tags: next });
    } catch {
      setTags(customer.tags || []);
      toast({ variant: 'destructive', title: 'Could not save tags' });
    } finally {
      setSavingTags(false);
    }
  };

  const addTag = () => {
    const value = tagDraft.trim().slice(0, MAX_TAG_LENGTH);
    if (!value) return;
    // Case-insensitive dedupe: "Wholesale" and "wholesale" are one tag, and two
    // spellings of the same label make the filter useless.
    if (tags.some(t => t.toLowerCase() === value.toLowerCase())) {
      setTagDraft('');
      return;
    }
    if (tags.length >= MAX_TAGS) {
      toast({ title: `That's the ${MAX_TAGS}-tag limit`, description: 'Remove one to add another.' });
      return;
    }
    setTagDraft('');
    void commitTags([...tags, value]);
  };

  const removeTag = (tag: string) => {
    void commitTags(tags.filter(t => t !== tag));
  };

  const saveNotes = async () => {
    setSavingNotes(true);
    try {
      await persist({ notes: notes.slice(0, MAX_NOTES_LENGTH) });
      toast({ variant: 'success', title: 'Note saved' });
    } catch {
      toast({ variant: 'destructive', title: 'Could not save the note' });
    } finally {
      setSavingNotes(false);
    }
  };

  const firstName = (customer.name || '').trim().split(/\s+/)[0] || 'there';
  const shopName = business?.name || 'us';

  const greeting = `Hello ${firstName}, this is ${shopName}. `;
  const reminder =
    outstanding > 0
      ? `Hello ${firstName}, this is ${shopName}. Our records show an outstanding balance of ${currencySymbol}${Math.round(outstanding).toLocaleString()} on your account. Please let us know if you have any questions.`
      : null;

  const waDigits = toWhatsAppDigits(customer.phone, business?.settings?.phone);
  const smsNumber = (customer.phone || '').replace(/[^\d+]/g, '');

  const openLink = (href: string) => {
    if (typeof window !== 'undefined') window.open(href, '_blank', 'noopener,noreferrer');
  };

  const contactHref = {
    whatsapp: (body: string) => `https://wa.me/${waDigits}?text=${encodeURIComponent(body)}`,
    sms: (body: string) => `sms:${smsNumber}?&body=${encodeURIComponent(body)}`,
    email: (body: string) =>
      `mailto:${customer.email}?subject=${encodeURIComponent(`A message from ${shopName}`)}&body=${encodeURIComponent(body)}`,
  };

  const hasAnyChannel = !!waDigits || !!smsNumber || !!customer.email;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageCircle className="h-4 w-4 text-primary" />
            Get in touch
          </CardTitle>
          <CardDescription className="text-xs">
            Opens your own WhatsApp, messages or mail app with the message ready to
            send — nothing is sent from Zeneva.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {!hasAnyChannel ? (
            <p className="text-sm text-muted-foreground">
              No phone number or email on file for {firstName}. Add one with Edit above.
            </p>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                {waDigits && (
                  <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => openLink(contactHref.whatsapp(greeting))}>
                    <MessageCircle className="h-3.5 w-3.5" />
                    WhatsApp
                  </Button>
                )}
                {smsNumber && (
                  <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => openLink(contactHref.sms(greeting))}>
                    <MessageSquare className="h-3.5 w-3.5" />
                    Text
                  </Button>
                )}
                {customer.email && (
                  <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => openLink(contactHref.email(greeting))}>
                    <Mail className="h-3.5 w-3.5" />
                    Email
                  </Button>
                )}
              </div>

              {reminder && (
                <div className="rounded-md border border-destructive/30 bg-destructive/5 p-2.5">
                  <p className="mb-2 text-xs font-medium text-destructive">
                    Owes {currencySymbol}
                    {Math.round(outstanding).toLocaleString()} — send a polite reminder
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {waDigits && (
                      <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs" onClick={() => openLink(contactHref.whatsapp(reminder))}>
                        <MessageCircle className="h-3 w-3" />
                        WhatsApp
                      </Button>
                    )}
                    {smsNumber && (
                      <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs" onClick={() => openLink(contactHref.sms(reminder))}>
                        <MessageSquare className="h-3 w-3" />
                        Text
                      </Button>
                    )}
                    {customer.email && (
                      <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs" onClick={() => openLink(contactHref.email(reminder))}>
                        <Mail className="h-3 w-3" />
                        Email
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {!waDigits && customer.phone && (
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  WhatsApp needs the number in international form (starting with{' '}
                  <code>+</code>). {firstName}&apos;s number is saved as a local one, and
                  guessing the country code could message a stranger — edit the number to
                  add it.
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <TagIcon className="h-4 w-4 text-primary" />
            Tags
            {savingTags && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
          </CardTitle>
          <CardDescription className="text-xs">
            Your own labels — &ldquo;wholesale&rdquo;, &ldquo;pays late&rdquo;. Filter the
            customer list by any of them.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {tags.map(tag => (
                <Badge key={tag} variant="secondary" className="gap-1 pe-1 font-normal">
                  {tag}
                  <button
                    type="button"
                    onClick={() => removeTag(tag)}
                    className="rounded-full p-0.5 hover:bg-background/60"
                    aria-label={`Remove tag ${tag}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <Input
              value={tagDraft}
              onChange={e => setTagDraft(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addTag();
                }
              }}
              placeholder="Add a tag and press Enter"
              maxLength={MAX_TAG_LENGTH}
              className="h-8 text-xs"
            />
            <Button variant="outline" size="sm" className="h-8 shrink-0 text-xs" onClick={addTag} disabled={!tagDraft.trim()}>
              Add
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <StickyNote className="h-4 w-4 text-primary" />
            Note
          </CardTitle>
          <CardDescription className="text-xs">
            Anything worth remembering next time they walk in. Visible to your team.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Textarea
            value={notes}
            onChange={e => setNotes(e.target.value.slice(0, MAX_NOTES_LENGTH))}
            placeholder="Prefers the 50cl bottles. Always asks for Tunde."
            rows={4}
            className="text-sm"
          />
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground">
              {notes.length}/{MAX_NOTES_LENGTH}
            </span>
            <Button size="sm" className="h-7 gap-1.5 text-xs" onClick={saveNotes} disabled={!notesDirty || savingNotes}>
              {savingNotes ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
              {notesDirty ? 'Save note' : 'Saved'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
