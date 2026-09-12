'use client';

import { collection, addDoc, serverTimestamp, type Firestore } from 'firebase/firestore';
import type { UserProfile } from '@/types';

/**
 * `customer.merge` is deliberately its own action rather than a `customer.delete`
 * per record retired.
 *
 * The loss-prevention scan buckets `customer.delete` as a deletion signal
 * (`src/lib/forensics.ts`), which is right — a member of staff quietly removing
 * customer records is worth noticing. A merge produces one delete per duplicate,
 * so a manager tidying a hundred duplicated records through the Health tab would
 * light up that detector as the worst offender in the shop. The detectors match
 * on exact action strings, so a distinct name keeps a legitimate consolidation
 * out of a theft report while still recording exactly what happened.
 */
type AuditAction =
    | 'product.create' | 'product.update' | 'product.delete' | 'product.bulk_update' | 'product.stock_adjustment'
    | 'sale.create' | 'sale.void'
    | 'customer.create' | 'customer.update' | 'customer.delete' | 'customer.merge'
    | 'user.invite' | 'user.update_status' | 'user.impersonate' | 'user.stop_impersonate'
    | 'settings.update'
    | 'billing.grant_lifetime' | 'billing.extend_trial' | 'billing.assign_plan';

/**
 * Details that make an event *investigable* rather than merely recorded.
 *
 * The loss-prevention scan (`src/lib/forensics.ts`) reads these, and several of
 * its checks are impossible without them. A void log without `saleCreatedAt`
 * cannot be timed, so a cashier voiding their own sale ninety seconds later is
 * indistinguishable from a manager fixing it the next morning; a
 * `product.update` without `changes` cannot reveal a price that was cut, used
 * and put back. Nothing can backfill these after the fact, which is why they are
 * written at the moment the action happens even though nothing displays them yet.
 */
export interface AuditForensicDetails {
    /** Voids: when the sale being cancelled was originally rung up. */
    saleCreatedAt?: string;
    /** Voids: who rang the sale up, as opposed to who is cancelling it. */
    soldBy?: string;
    /** Deletions: what the system still believed was on the shelf. */
    stockAtDeletion?: number;
    /** Updates: field → before/after, for the fields worth money. */
    changes?: Record<string, { from: any; to: any }>;
}


interface AuditEvent {
    action: AuditAction;
    entity: {
        type: string;
        id: string;
        name?: string;
    };
    details?: Record<string, any> & AuditForensicDetails;
}

export const logAuditEvent = async (
    firestore: Firestore,
    businessId: string,
    user: UserProfile,
    event: AuditEvent
) => {
    try {
        const details: Record<string, any> = {
            entityName: event.entity.name || null,
            ...event.details,
        };

        // Remove undefined keys from details matching
        Object.keys(details).forEach(key => details[key] === undefined && delete details[key]);

        const logData = {
            businessId,
            branchId: user?.branchId || event.details?.branchId || null,
            userId: user?.id || 'unknown',
            userName: user?.name || 'Unknown User',
            userEmail: user?.email || 'N/A',
            userRole: user?.role || 'unknown',
            action: event.action,
            entityType: event.entity.type,
            entityId: event.entity.id,
            details,
            createdAt: serverTimestamp(),
        };

        const auditLogRef = collection(firestore, 'businessInstances', businessId, 'auditLogs');
        await addDoc(auditLogRef, logData);
    } catch (error) {
        // Log to console but don't block the user's action
        console.error('Failed to log audit event:', error);
    }
};
