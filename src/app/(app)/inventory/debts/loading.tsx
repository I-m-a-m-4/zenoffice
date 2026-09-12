import {
  SkeletonPage,
  SkeletonHeading,
  SkeletonStatCards,
  SkeletonTableCard,
} from '@/components/shared/page-skeletons';

/**
 * Debts leads with a raw `text-3xl` heading, then four cards at
 * `md:grid-cols-2 lg:grid-cols-4`, then the four-column debtor table.
 */
export default function Loading() {
  return (
    <SkeletonPage>
      <SkeletonHeading titleWidth="w-56" actions={1} />
      <SkeletonStatCards count={4} cols="md:grid-cols-2 lg:grid-cols-4" />
      <SkeletonTableCard rows={7} cols={4} toolbarItems={2} />
    </SkeletonPage>
  );
}
