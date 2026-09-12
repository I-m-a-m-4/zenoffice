/**
 * Turning what a person typed into a number, and a product name into something
 * two spellings of it can be compared on.
 *
 * This module is the reason the importer can accept messy input at all, and every
 * rule in it is here because a real file broke without it. It is pure and has no
 * imports on purpose: it is the part most worth testing, and the part where being
 * quietly wrong is most expensive — a mis-parsed cost price is a wrong margin on
 * every report the shop ever runs afterwards.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Money
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Currency markers stripped before parsing.
 *
 * `#` is in here because it is how a great many Nigerian sellers write ₦ on a
 * keyboard that has no naira key — `#12,000` is a price, not a hashtag, and it
 * turns up constantly in pasted WhatsApp price lists. `N` is handled separately
 * below because it cannot be stripped blindly: `N95` is a mask, not ₦95.
 */
const CURRENCY_MARKS = /[₦$£€¥₵₹#]|(?:NGN|USD|GBP|EUR|KES|GHS|ZAR|INR|XOF|XAF)/gi;

/**
 * Trailing shorthand for "and no kobo/cents".
 *
 * `1,200/=` and `1200=` are both a flat 1,200 in East and West African
 * bookkeeping. A naive parse of `1200/=` yields 1200 anyway, but `1,200/-` would
 * lose the trailing dash to the negative-number check, so both are removed here
 * before signs are looked at.
 */
const TRAILING_FLAT = /[\/=\-]+\s*$/;

/** `12k` → 12,000; `1.2m` → 1,200,000. */
const MAGNITUDE: Record<string, number> = { k: 1_000, m: 1_000_000, b: 1_000_000_000 };

/**
 * Parse a money cell to a plain number, or `null` when it holds no number.
 *
 * `null` and `0` are different answers and callers depend on the difference: an
 * empty cost-price cell must not overwrite a cost price the shop already knows,
 * whereas a cell that genuinely says `0` must.
 *
 * ## Separators
 *
 * The hard case is that `1.200` means 1,200 in half the world and 1.2 in the
 * other half, and a Nigerian shop's Excel export can contain either depending on
 * whose laptop made it. The rules, in order:
 *
 * 1. Both `,` and `.` present → whichever comes **last** is the decimal point.
 *    `1.234,56` and `1,234.56` both resolve correctly and neither needs a locale.
 * 2. One separator, appearing more than once → it is a thousands separator.
 *    `1.234.567` is unambiguous.
 * 3. One separator, once, with exactly three digits after it → thousands.
 *    `1,500` is 1500 and `1.500` is 1500. This is the rule that costs the most
 *    and earns the most: it is wrong for a genuine `1.500` meaning one-and-a-half,
 *    which does not occur in a price list, and right for the `1.500` that a
 *    German-locale Excel writes for fifteen hundred, which does.
 * 4. Otherwise → decimal point. `12,50` is 12.50 and `12.5` is 12.5.
 */
export function parseMoney(input: unknown): number | null {
  if (typeof input === 'number') return Number.isFinite(input) ? input : null;
  if (input == null) return null;

  let text = String(input).trim();
  if (!text) return null;

  // Accounting negatives: (500) is -500.
  const parenthesised = /^\((.*)\)$/.exec(text);
  if (parenthesised) text = `-${parenthesised[1]}`;

  text = text.replace(CURRENCY_MARKS, ' ');
  // Bare `N`/`n` only when it is glued to the front of a number, so `N12000`
  // parses and the `N` in `N95 Mask` survives to be nobody's problem here.
  text = text.replace(/(^|\s)[Nn](?=\s*[\d.,])/g, '$1 ');
  text = text.replace(TRAILING_FLAT, '');

  const negative = /^-/.test(text.trim()) || /\bless\b/i.test(text);

  // A magnitude suffix must be the last letter of the numeric run: `12k` yes,
  // `12 kg` no — that is a weight, and treating it as 12,000 would be absurd.
  const magnitudeMatch = /(\d)\s*([kmb])\b(?!\s*g\b)/i.exec(text);
  const magnitude = magnitudeMatch ? MAGNITUDE[magnitudeMatch[2].toLowerCase()] : 1;

  const digits = text.replace(/[^0-9.,]/g, '');
  if (!/\d/.test(digits)) return null;

  const value = resolveSeparators(digits);
  if (value == null) return null;

  const result = value * magnitude;
  if (!Number.isFinite(result)) return null;
  return negative ? -Math.abs(result) : result;
}

/** Applies the four separator rules above to a string of digits, `.` and `,`. */
function resolveSeparators(digits: string): number | null {
  const lastComma = digits.lastIndexOf(',');
  const lastDot = digits.lastIndexOf('.');

  let decimalAt = -1;
  if (lastComma >= 0 && lastDot >= 0) {
    decimalAt = Math.max(lastComma, lastDot);
  } else if (lastComma >= 0 || lastDot >= 0) {
    const sep = lastComma >= 0 ? ',' : '.';
    const at = lastComma >= 0 ? lastComma : lastDot;
    const occurrences = digits.split(sep).length - 1;
    const trailing = digits.length - at - 1;
    // Rule 2 and rule 3 both mean "thousands", so decimalAt stays -1.
    if (occurrences === 1 && trailing !== 3) decimalAt = at;
  }

  const whole = decimalAt >= 0 ? digits.slice(0, decimalAt) : digits;
  const fraction = decimalAt >= 0 ? digits.slice(decimalAt + 1) : '';
  const cleanWhole = whole.replace(/[.,]/g, '');
  const cleanFraction = fraction.replace(/[.,]/g, '');

  if (!cleanWhole && !cleanFraction) return null;
  const parsed = Number(`${cleanWhole || '0'}.${cleanFraction || '0'}`);
  return Number.isFinite(parsed) ? parsed : null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Quantities
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Multi-unit words, and how many single items each one is.
 *
 * Only the ones that are unambiguous everywhere. A "bag" is 50kg of rice in one
 * shop and 10 sachets of water in the next, so it is deliberately absent: an
 * importer that silently turns `3 bags` into 150 has invented stock the shop does
 * not have. `carton` and `dozen` are here because a carton count is meaningless
 * without a pack size anyway, so `2 cartons` stays 2 and only the *unit name* is
 * captured — the multiplier is what the owner sets on the product afterwards.
 */
const PACK_WORDS = [
  'carton', 'ctn', 'cartons',
  'dozen', 'doz',
  'pack', 'packs', 'pkt', 'packet', 'packets',
  'crate', 'crates',
  'roll', 'rolls',
  'box', 'boxes',
  'piece', 'pieces', 'pcs', 'pc', 'unit', 'units',
  'sachet', 'sachets',
  'bottle', 'bottles',
  'tin', 'tins',
  'bag', 'bags',
];

const PACK_WORD_RE = new RegExp(`\\b(${PACK_WORDS.join('|')})\\b`, 'i');

/**
 * Parse a stock cell to a whole number, or `null` when it holds no count.
 *
 * Rounds rather than truncating, and floors at zero: negative stock is a thing
 * Firestore will happily hold and the POS will happily refuse to sell, so a
 * file exported mid-reconciliation with `-3` imports as 0 and says so in the
 * row's issues rather than poisoning the till.
 */
export function parseQuantity(input: unknown): number | null {
  if (typeof input === 'number') {
    return Number.isFinite(input) ? Math.max(0, Math.round(input)) : null;
  }
  const money = parseMoney(input);
  if (money == null) return null;
  return Math.max(0, Math.round(money));
}

/** True when the cell parsed to something negative before it was floored. */
export function wasNegative(input: unknown): boolean {
  const money = parseMoney(input);
  return money != null && money < 0;
}

/**
 * The unit word in a cell, canonicalised, or `undefined`.
 *
 * Feeds `baseUnit`, which the POS uses for its unit-of-measure display. Returned
 * separately from the quantity so `"20 cartons"` yields 20 *and* `Carton`, and
 * neither has to be re-derived from the other.
 */
export function parseUnit(input: unknown): string | undefined {
  if (input == null) return undefined;
  const match = PACK_WORD_RE.exec(String(input));
  if (!match) return undefined;
  return canonicalUnit(match[1]);
}

const UNIT_CANON: Record<string, string> = {
  ctn: 'Carton', carton: 'Carton', cartons: 'Carton',
  doz: 'Dozen', dozen: 'Dozen',
  pkt: 'Packet', packet: 'Packet', packets: 'Packet',
  pack: 'Pack', packs: 'Pack',
  crate: 'Crate', crates: 'Crate',
  roll: 'Roll', rolls: 'Roll',
  box: 'Box', boxes: 'Box',
  pcs: 'Piece', pc: 'Piece', piece: 'Piece', pieces: 'Piece',
  unit: 'Piece', units: 'Piece',
  sachet: 'Sachet', sachets: 'Sachet',
  bottle: 'Bottle', bottles: 'Bottle',
  tin: 'Tin', tins: 'Tin',
  bag: 'Bag', bags: 'Bag',
};

export function canonicalUnit(word: string): string {
  return UNIT_CANON[word.toLowerCase()] ?? word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

// ─────────────────────────────────────────────────────────────────────────────
// Sizes
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A pack size reduced to a base unit, so two spellings of it compare equal.
 *
 * This is the single most valuable thing in the module for duplicate detection.
 * `Coca Cola 50cl` and `Coca-Cola Original 500ml` are the same product and no
 * amount of string similarity will tell you that — `50cl` and `500ml` share not
 * one character. Reduced to `{ value: 500, unit: 'ml' }` they are identical.
 */
export type Size = { value: number; unit: 'ml' | 'g' | 'count' };

/** Multipliers into the base unit for each spelling we accept. */
const SIZE_UNITS: Record<string, { base: Size['unit']; factor: number }> = {
  ml: { base: 'ml', factor: 1 },
  cl: { base: 'ml', factor: 10 },
  dl: { base: 'ml', factor: 100 },
  l: { base: 'ml', factor: 1000 },
  lt: { base: 'ml', factor: 1000 },
  ltr: { base: 'ml', factor: 1000 },
  litre: { base: 'ml', factor: 1000 },
  liter: { base: 'ml', factor: 1000 },
  litres: { base: 'ml', factor: 1000 },
  liters: { base: 'ml', factor: 1000 },
  cc: { base: 'ml', factor: 1 },
  mg: { base: 'g', factor: 0.001 },
  g: { base: 'g', factor: 1 },
  gr: { base: 'g', factor: 1 },
  gm: { base: 'g', factor: 1 },
  gms: { base: 'g', factor: 1 },
  gram: { base: 'g', factor: 1 },
  grams: { base: 'g', factor: 1 },
  kg: { base: 'g', factor: 1000 },
  kgs: { base: 'g', factor: 1000 },
  kilo: { base: 'g', factor: 1000 },
  kilos: { base: 'g', factor: 1000 },
};

const SIZE_RE = new RegExp(
  `(\\d+(?:[.,]\\d+)?)\\s*(${Object.keys(SIZE_UNITS).sort((a, b) => b.length - a.length).join('|')})\\b`,
  'i',
);

/** `"Indomie 70g x 40"` → `{ value: 70, unit: 'g' }`. `null` when there is none. */
export function extractSize(name: string): Size | null {
  if (!name) return null;
  const match = SIZE_RE.exec(name);
  if (!match) return null;
  const value = Number(match[1].replace(',', '.'));
  if (!Number.isFinite(value)) return null;
  const spec = SIZE_UNITS[match[2].toLowerCase()];
  if (!spec) return null;
  return { value: Math.round(value * spec.factor * 1000) / 1000, unit: spec.base };
}

/** Same physical size, however it was spelled. */
export function sizesEqual(a: Size | null, b: Size | null): boolean {
  if (!a || !b) return false;
  if (a.unit !== b.unit) return false;
  // A tenth of a millilitre of slack absorbs `0.5l` vs `500ml` rounding.
  return Math.abs(a.value - b.value) < 0.1;
}

export function formatSize(size: Size): string {
  return `${size.value}${size.unit === 'count' ? '' : size.unit}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Names
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Words carrying no identity, removed before names are compared.
 *
 * Every one of these appears in one spelling of a product and not the other, and
 * keeping them is what makes `Coca-Cola Original 500ml` and `Coca Cola 50cl`
 * score as different products. Brand words are obviously absent — dropping
 * `Coca` would merge Coke and Pepsi.
 */
const NOISE_WORDS = new Set([
  'original', 'classic', 'regular', 'standard', 'normal',
  'new', 'old', 'fresh', 'premium', 'quality', 'genuine',
  'pack', 'packet', 'piece', 'pieces', 'pcs', 'pc', 'unit', 'units',
  'bottle', 'bottles', 'can', 'cans', 'tin', 'tins', 'sachet', 'sachets',
  'the', 'and', 'of', 'for', 'with', 'in', 'a', 'an',
  'assorted', 'mixed', 'each', 'per', 'item', 'product', 'goods',
]);

/**
 * Casefold a name into its comparable form.
 *
 * Diacritics folded, `&` spelled out, punctuation to spaces, sizes rewritten in
 * their base unit, noise words dropped, tokens sorted. Sorting is what makes
 * `Milo Refill 400g` and `400g Refill Milo` the same string — word order in a
 * hand-typed product name carries no information and treating it as if it does
 * creates duplicates for no reason.
 *
 * The size is *appended* rather than left where it appeared, so it survives token
 * sorting in a predictable place and `extractSize` can still be compared
 * separately when a caller wants to be stricter.
 */
export function normalizeName(name: string): string {
  if (!name) return '';

  const size = extractSize(name);

  let text = name
    .normalize('NFKD')
    .replace(/\p{Mn}/gu, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[''`]/g, '')
    // Drop the size run wherever it sat; it is re-appended below.
    .replace(SIZE_RE, ' ')
    // `x40`, `* 24`, `(12)` are pack counts, not identity.
    .replace(/\b[x*]\s*\d+\b/g, ' ')
    .replace(/\(\s*\d+\s*\)/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

  const tokens = text
    .split(/\s+/)
    .filter((t) => t.length > 0 && !NOISE_WORDS.has(t))
    // A bare single letter left over from punctuation splitting is noise. A
    // single digit is not: "Peak 3" and "Peak 5" are different milk tins.
    .filter((t) => t.length > 1 || /\d/.test(t))
    .sort();

  const base = tokens.join(' ');
  return size ? `${base} ${formatSize(size)}`.trim() : base;
}

/** The comparable tokens of a name, size excluded. Used for overlap scoring. */
export function nameTokens(name: string): Set<string> {
  const normalized = normalizeName(name);
  const size = extractSize(name);
  const sizeToken = size ? formatSize(size) : null;
  return new Set(
    normalized.split(' ').filter((t) => t.length > 0 && t !== sizeToken),
  );
}

/**
 * How alike two names are, 0–1.
 *
 * Containment rather than plain Jaccard: `Coca Cola` against
 * `Coca Cola Zero Sugar Lemon` is 1.0 on containment and 0.4 on Jaccard, and for
 * matching an imported short name against an existing long one, containment is
 * the question actually being asked. The shorter set's coverage is what counts,
 * with a mild penalty for how much extra the longer one carries so that a
 * two-token name does not match everything that contains it.
 */
export function nameSimilarity(a: string, b: string): number {
  const ta = nameTokens(a);
  const tb = nameTokens(b);
  if (ta.size === 0 || tb.size === 0) return 0;

  let shared = 0;
  const [small, large] = ta.size <= tb.size ? [ta, tb] : [tb, ta];
  for (const token of small) if (large.has(token)) shared++;

  const containment = shared / small.size;
  const extra = large.size - shared;
  // Each unmatched token in the longer name costs 8%, capped so a long name
  // never drops a genuine containment hit below the possible-match threshold.
  const penalty = Math.min(0.3, extra * 0.08);
  return Math.max(0, containment - penalty);
}

/**
 * Title-case a name that arrived shouting or entirely lowercase.
 *
 * Legacy POS exports are very often `COCA COLA 50CL`, and importing that verbatim
 * makes every receipt and shelf label shout. Mixed case is left exactly alone —
 * if the owner wrote `iPhone 15 Pro`, that is the name.
 */
export function tidyName(name: string): string {
  const trimmed = name.replace(/\s+/g, ' ').trim();
  if (!trimmed) return '';

  const letters = trimmed.replace(/[^a-zA-Z]/g, '');
  if (!letters) return trimmed;

  const isShouting = letters === letters.toUpperCase() && letters.length > 3;
  const isWhispering = letters === letters.toLowerCase();
  if (!isShouting && !isWhispering) return trimmed;

  return trimmed.replace(/[a-zA-Z']+/g, (word) => {
    // Units and short measure words keep their conventional lowercase.
    if (/^(ml|cl|l|g|kg|mg|cc|pcs|pc)$/i.test(word)) return word.toLowerCase();
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// SKUs and barcodes
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Canonicalise a SKU for equality testing.
 *
 * Zeneva has no separate barcode field — the scanner matches on `sku`, so a SKU
 * *is* the barcode when one exists. That makes this function the deterministic
 * half of duplicate detection, and it must be conservative: anything that could
 * merge two genuinely different codes is worse than missing a match. So case and
 * surrounding whitespace/punctuation go, and nothing else does.
 *
 * A leading zero is significant and stays. UPC-A `012345678905` and EAN-13
 * `0012345678905` are the same article, but establishing that needs a check-digit
 * calculation, and getting it wrong merges two products. Left alone deliberately.
 */
export function normalizeSku(sku: unknown): string {
  if (sku == null) return '';
  return String(sku).trim().replace(/[\s\-_.]/g, '').toUpperCase();
}

/**
 * True when a string is plausibly a real product code rather than a row number.
 *
 * Spreadsheets are full of `1`, `2`, `3` columns that a mapper is tempted to read
 * as SKUs, and matching on those would merge unrelated products across two
 * imports. A code must be at least four characters, or contain a letter.
 */
export function isPlausibleSku(sku: string): boolean {
  const clean = normalizeSku(sku);
  if (!clean) return false;
  if (/[A-Z]/.test(clean)) return clean.length >= 2;
  return clean.length >= 4;
}

// ─────────────────────────────────────────────────────────────────────────────
// Dates
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parse an expiry cell to `YYYY-MM-DD`, or `null`.
 *
 * Day-first is assumed for the ambiguous `03/04/2027` case, because the market
 * this ships to writes dates day-first and an expiry three months out matters
 * more than one four months out. Unambiguous forms (`2027-04-03`, a four-digit
 * year anywhere, a month name) are read as written and never guessed at.
 */
export function parseDate(input: unknown): string | null {
  if (input == null) return null;
  if (input instanceof Date) {
    return Number.isNaN(input.getTime()) ? null : localYmd(input);
  }

  const text = String(input).trim();
  if (!text) return null;

  // ISO first: unambiguous and the cheapest to recognise.
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(text);
  if (iso) return ymd(+iso[1], +iso[2], +iso[3]);

  // A month name removes all ambiguity, so try it before the numeric forms.
  if (/[a-z]{3}/i.test(text)) {
    const parsed = new Date(text);
    if (!Number.isNaN(parsed.getTime())) return localYmd(parsed);
  }

  const parts = text.match(/\d+/g);
  if (!parts || parts.length < 2) return null;

  const nums = parts.map(Number);

  // Year-first (`2027/04/03`) is unambiguous — a 4-digit leading component can
  // only be a year.
  if (nums.length >= 3 && nums[0] > 1000) return ymd(nums[0], nums[1], nums[2]);

  if (nums.length === 2) {
    // `MM/YYYY` or `MM/YY` — an expiry with no day means end of that month.
    const [month, rawYear] = nums;
    return endOfMonth(rawYear > 1000 ? rawYear : 2000 + rawYear, month);
  }

  // Three numbers, year last. Day-first unless the second component is the only
  // one that can be a day: `04/25/2027` is a US export and means 25 April.
  const [first, second, rawYear] = nums;
  const year = rawYear > 1000 ? rawYear : 2000 + rawYear;
  if (second > 12 && first <= 12) return ymd(year, first, second);
  return ymd(year, second, first);
}

/**
 * A `Date` rendered as `YYYY-MM-DD` in the **local** calendar.
 *
 * `toISOString().slice(0, 10)` is the obvious way to do this and is wrong for every
 * timezone ahead of UTC. `new Date('3 April 2027')` is local midnight, which in Lagos
 * (UTC+1) is 2027-04-02T23:00Z, so the ISO string reads 2 April — an expiry date a day
 * early, every time, for the whole market this ships to. Reading the local components
 * back is what keeps the date the one that was written.
 */
function localYmd(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function ymd(year: number, month: number, day: number): string | null {
  if (!year || !month || !day) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function endOfMonth(year: number, month: number): string | null {
  if (month < 1 || month > 12) return null;
  const date = new Date(Date.UTC(year, month, 0));
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}
