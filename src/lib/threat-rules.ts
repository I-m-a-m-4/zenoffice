/**
 * Threat detection rules for the admin Cyber Shield board.
 *
 * Everything here is a **pure function over data the admin panel already
 * loads** — users, businesses, receipts, audit logs. No extra Firestore reads,
 * because the owner pays for every one of them (see MEMORY: Firestore cost is a
 * standing constraint).
 *
 * The rules answer one question: *does this account look like it is being used
 * the way the app intends?* A modded or hacked client cannot hide from these,
 * because they read the **consequences** written to the database rather than
 * asking the client to confess. A repackaged APK can lie about its version and
 * skip any client-side check; it cannot create a Pro-tier product count on a
 * free plan without that count existing.
 */

export type Severity = 'critical' | 'high' | 'medium' | 'low';

export type Threat = {
  /** Stable id so the same finding does not re-alert on every render. */
  id: string;
  rule: string;
  severity: Severity;
  title: string;
  /** What was actually observed. Shown verbatim in the table. */
  detail: string;
  /** Which account or business it concerns. */
  subject: string;
  subjectId: string;
  businessId?: string;
  /** What the reviewer should do about it. */
  action: string;
  at?: Date;
};

export const SEVERITY_WEIGHT: Record<Severity, number> = {
  critical: 40,
  high: 18,
  medium: 7,
  low: 2,
};

type Business = any;
type User = any;

/** Plan caps, duplicated deliberately: this module must not import client code. */
const PLAN_PRODUCT_CAP: Record<string, number> = { starter: 50, pro: 1500 };
const PLAN_STAFF_CAP: Record<string, number> = { starter: 1, pro: 5 };

function toDate(v: any): Date | null {
  if (!v) return null;
  if (v?.toDate) { try { return v.toDate(); } catch { return null; } }
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function effective(business: Business): string {
  if (business?.accessLevel === 'lifetime') return 'business';
  const plan = business?.plan;
  if (plan !== 'pro' && plan !== 'business') return 'starter';
  const exp = toDate(business?.trialExpiresAt);
  if (exp && exp.getTime() <= Date.now()) return 'starter';
  return plan;
}

/**
 * R1 — Entitlement mismatch: paid capability without a paid plan.
 *
 * The single highest-signal rule for detecting a modded client. Client-side
 * gating can be patched out of a repackaged build, and the hardened Firestore
 * rules now reject the write — but if a row like this ever appears, either a
 * rule regressed or the write predates the fix. Either way the owner wants to
 * know the same hour, not at month end.
 */
export function detectEntitlementAbuse(
  businesses: Business[],
  productCounts: Record<string, number>,
  staffCounts: Record<string, number>,
  /** Businesses with at least one purchase on record. Null until a deep scan runs. */
  paidBusinessIds?: Set<string> | null,
): Threat[] {
  const out: Threat[] = [];
  for (const b of businesses || []) {
    const plan = effective(b);
    const name = b.name || 'Unnamed';

    const productCap = PLAN_PRODUCT_CAP[plan];
    const products = productCounts[b.id];
    if (productCap !== undefined && products !== undefined && products > productCap * 1.1) {
      out.push({
        id: `ent-prod-${b.id}`,
        rule: 'R1 Entitlement',
        severity: 'critical',
        title: 'Product cap exceeded for plan',
        detail: `${products} products on the ${plan} plan, which caps at ${productCap}.`,
        subject: name,
        subjectId: b.id,
        businessId: b.id,
        action: 'Client-side limit likely bypassed. Verify Firestore rules are deployed, then contact or downgrade.',
      });
    }

    const staffCap = PLAN_STAFF_CAP[plan];
    const staff = staffCounts[b.id];
    if (staffCap !== undefined && staff !== undefined && staff > staffCap) {
      out.push({
        id: `ent-staff-${b.id}`,
        rule: 'R1 Entitlement',
        severity: 'high',
        title: 'Staff cap exceeded for plan',
        detail: `${staff} staff accounts on the ${plan} plan, which allows ${staffCap}.`,
        subject: name,
        subjectId: b.id,
        businessId: b.id,
        action: 'Check for invitations created outside the app UI.',
      });
    }

    // Lifetime access is granted by hand from the admin panel. One appearing
    // without a matching grant in the audit trail is the exact shape of a
    // client that wrote its own entitlement.
    if (b.accessLevel === 'lifetime' && !b.lifetimeGrantedBy && !b.lifetimeGrantedAt) {
      out.push({
        id: `ent-life-${b.id}`,
        rule: 'R1 Entitlement',
        severity: 'critical',
        title: 'Unattributed lifetime access',
        detail: 'accessLevel is "lifetime" with no record of who granted it.',
        subject: name,
        subjectId: b.id,
        businessId: b.id,
        action: 'Confirm this was a manual grant. If not, treat as a self-issued upgrade and revoke.',
      });
    }

    // A paid plan with no purchase ever recorded.
    //
    // `paidBusinessIds` is only populated by the deep scan (which reads the
    // `purchases` collection). Until it has run the set is null and this rule
    // stays silent rather than accusing every legitimate customer.
    if (
      paidBusinessIds &&
      (b.plan === 'pro' || b.plan === 'business') &&
      b.accessLevel !== 'lifetime' &&
      !paidBusinessIds.has(b.id)
    ) {
      out.push({
        id: `ent-nopay-${b.id}`,
        rule: 'R1 Entitlement',
        severity: 'critical',
        title: 'Paid plan with no payment on record',
        detail: `Plan is "${b.plan}" but no purchase document exists for this business.`,
        subject: name,
        subjectId: b.id,
        businessId: b.id,
        action: 'Cross-check Paystack. A self-written plan field is the most likely cause. Manual admin grants are exempt only if they set accessLevel.',
      });
    }
  }
  return out;
}

/**
 * R2 — Tenant boundary probing.
 *
 * A user whose own document points at a business that does not exist, or whose
 * role is not one the app can issue, did not get there through the UI.
 */
export function detectIdentityAnomalies(users: User[], businesses: Business[]): Threat[] {
  const out: Threat[] = [];
  const knownBusinessIds = new Set((businesses || []).map((b) => b.id));
  const VALID_ROLES = new Set([
    'admin', 'owner', 'manager', 'operator', 'staff', 'vendor_operator', 'super-admin',
  ]);

  for (const u of users || []) {
    const who = u.email || u.name || u.id;

    if (u.businessId && knownBusinessIds.size > 0 && !knownBusinessIds.has(u.businessId)) {
      out.push({
        id: `id-orphan-${u.id}`,
        rule: 'R2 Identity',
        severity: 'medium',
        title: 'User points at a non-existent business',
        detail: `businessId "${u.businessId}" does not match any live business.`,
        subject: who,
        subjectId: u.id,
        businessId: u.businessId,
        action: 'Usually a leftover from a terminated entity. If the account is active, treat as tenant probing.',
      });
    }

    if (u.role && !VALID_ROLES.has(u.role)) {
      out.push({
        id: `id-role-${u.id}`,
        rule: 'R2 Identity',
        severity: 'critical',
        title: 'Unrecognised role value',
        detail: `Role "${u.role}" is not a role this app can assign.`,
        subject: who,
        subjectId: u.id,
        businessId: u.businessId,
        action: 'A hand-written role field. Reset the role and revoke sessions.',
      });
    }

    // Only the platform owner should ever hold super-admin.
    if (u.role === 'super-admin' && u.email !== 'belloimam431@gmail.com') {
      out.push({
        id: `id-super-${u.id}`,
        rule: 'R2 Identity',
        severity: 'critical',
        title: 'Non-owner holds super-admin',
        detail: `${who} carries role "super-admin".`,
        subject: who,
        subjectId: u.id,
        businessId: u.businessId,
        action: 'Privilege escalation. Revoke immediately and rotate the admin TOTP secret.',
      });
    }

    // A suspended account still writing is a token that outlived the kill.
    const lastActive = toDate(u.lastActiveAt);
    const suspendedAt = toDate(u.suspendedAt);
    if (u.status === 'suspended' && lastActive && suspendedAt && lastActive > suspendedAt) {
      out.push({
        id: `id-zombie-${u.id}`,
        rule: 'R2 Identity',
        severity: 'high',
        title: 'Suspended account still active',
        detail: `Activity at ${lastActive.toISOString()} is after suspension at ${suspendedAt.toISOString()}.`,
        subject: who,
        subjectId: u.id,
        businessId: u.businessId,
        action: 'Revoke refresh tokens so the live session dies now rather than at token expiry.',
      });
    }
  }
  return out;
}

/**
 * R3 — Impossible or implausible business data.
 *
 * Catches the tampering that shows up as arithmetic that cannot happen: a
 * receipt whose total does not match its own line items, negative money, or a
 * back-dated sale. A patched client that writes receipts directly skips the POS
 * maths, and this is where that shows.
 */
export function detectDataIntegrityAnomalies(receipts: any[]): Threat[] {
  const out: Threat[] = [];
  const now = Date.now();

  for (const r of (receipts || []).slice(0, 500)) {
    const label = r.receiptNumber || r.id;
    const total = Number(r.totalAmount ?? r.total ?? 0);

    if (total < 0) {
      out.push({
        id: `dat-neg-${r.id}`,
        rule: 'R3 Integrity',
        severity: 'high',
        title: 'Negative sale total',
        detail: `Receipt ${label} totals ${total}.`,
        subject: r.businessName || r.businessId || 'Unknown business',
        subjectId: r.id,
        businessId: r.businessId,
        action: 'The POS cannot produce this. Inspect how the receipt was written.',
        at: toDate(r.createdAt) || undefined,
      });
    }

    if (Array.isArray(r.items) && r.items.length > 0) {
      const computed = r.items.reduce(
        (sum: number, it: any) => sum + Number(it.price || 0) * Number(it.quantity || 0),
        0,
      );
      // 2% tolerance absorbs legitimate tax, discount and rounding lines.
      if (computed > 0 && Math.abs(computed - total) / computed > 0.02 && Math.abs(computed - total) > 100) {
        out.push({
          id: `dat-sum-${r.id}`,
          rule: 'R3 Integrity',
          severity: 'medium',
          title: 'Receipt total does not match its items',
          detail: `Items sum to ${Math.round(computed)} but the receipt records ${Math.round(total)}.`,
          subject: r.businessName || r.businessId || 'Unknown business',
          subjectId: r.id,
          businessId: r.businessId,
          action: 'Check for a client writing receipts outside the POS flow.',
          at: toDate(r.createdAt) || undefined,
        });
      }
    }

    const created = toDate(r.createdAt);
    if (created && created.getTime() > now + 36e5) {
      out.push({
        id: `dat-future-${r.id}`,
        rule: 'R3 Integrity',
        severity: 'medium',
        title: 'Sale dated in the future',
        detail: `Receipt ${label} is dated ${created.toISOString()}.`,
        subject: r.businessName || r.businessId || 'Unknown business',
        subjectId: r.id,
        businessId: r.businessId,
        action: 'Either a wrong device clock or a hand-written timestamp.',
        at: created,
      });
    }
  }
  return out;
}

/**
 * R4 — Platform posture.
 *
 * Not per-tenant: things about the deployment itself that weaken the moat.
 */
export function detectPostureIssues(opts: {
  mfaEnabled: boolean;
  suspendedCount: number;
  totalUsers: number;
}): Threat[] {
  const out: Threat[] = [];

  if (!opts.mfaEnabled) {
    out.push({
      id: 'pos-mfa',
      rule: 'R4 Posture',
      severity: 'high',
      title: 'Owner account has no second factor',
      detail: 'The super-admin login is password-only. It can read and delete every tenant.',
      subject: 'Platform owner',
      subjectId: 'platform',
      action: 'Enrol a phone factor from the Identity State card above.',
    });
  }

  if (opts.totalUsers > 20 && opts.suspendedCount / opts.totalUsers > 0.15) {
    out.push({
      id: 'pos-susp',
      rule: 'R4 Posture',
      severity: 'medium',
      title: 'High proportion of suspended accounts',
      detail: `${opts.suspendedCount} of ${opts.totalUsers} accounts are suspended.`,
      subject: 'Platform',
      subjectId: 'platform',
      action: 'Either abuse is rising or suspensions are being used for routine offboarding.',
    });
  }

  return out;
}

/** 0–100, where 100 is clean. Weighted so one critical finding is visible. */
export function healthScore(threats: Threat[]): number {
  const penalty = threats.reduce((sum, t) => sum + SEVERITY_WEIGHT[t.severity], 0);
  return Math.max(2, 100 - Math.min(98, penalty));
}

export function postureLevel(score: number): { level: string; tone: Severity | 'ok' } {
  if (score >= 90) return { level: 'OPTIMAL', tone: 'ok' };
  if (score >= 70) return { level: 'ELEVATED', tone: 'medium' };
  if (score >= 45) return { level: 'HIGH RISK', tone: 'high' };
  return { level: 'CRITICAL', tone: 'critical' };
}
