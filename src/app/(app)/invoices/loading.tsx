import { SkeletonPage, SkeletonHeading, SkeletonTableCard } from '@/components/shared/page-skeletons';

/**
 * Invoices uses a raw `text-3xl` heading with a "New Invoice" action beside it,
 * then one card holding a six-column table.
 */
export default function Loading() {
  return (
    <SkeletonPage>
      <SkeletonHeading titleWidth="w-52" actions={1} />
      <SkeletonTableCard rows={7} cols={6} toolbarItems={2} />
    </SkeletonPage>
  );
}
