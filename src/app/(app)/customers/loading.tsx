import { SkeletonPage, SkeletonTableCard } from '@/components/shared/page-skeletons';

/**
 * Like Receipts, Customers puts its title inside a single full-width card and
 * carries the search plus filter chips in the same header. The table runs to
 * eight columns but the last is a narrow actions menu, so seven bars reads right.
 */
export default function Loading() {
  return (
    <SkeletonPage>
      <SkeletonTableCard rows={8} cols={7} toolbarItems={3} />
    </SkeletonPage>
  );
}
