import { SkeletonPage, SkeletonTableCard } from '@/components/shared/page-skeletons';

/**
 * Receipts has no `PageTitle` — its title lives inside the card header, beside a
 * search box and the two `type="date"` inputs. Seven columns: receipt, customer,
 * date, time, payment method, total, actions.
 */
export default function Loading() {
  return (
    <SkeletonPage>
      <SkeletonTableCard rows={8} cols={7} toolbarItems={3} />
    </SkeletonPage>
  );
}
