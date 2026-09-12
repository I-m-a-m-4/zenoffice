import {
  SkeletonPage,
  SkeletonPageHeader,
  SkeletonStatCards,
  SkeletonTableCard,
} from '@/components/shared/page-skeletons';

/** `PageTitle`, the three-across status cards (`grid-cols-1 md:grid-cols-3`), then the alert table. */
export default function Loading() {
  return (
    <SkeletonPage>
      <SkeletonPageHeader titleWidth="w-48" actions={1} />
      <SkeletonStatCards count={3} cols="grid-cols-1 md:grid-cols-3" />
      <SkeletonTableCard rows={6} cols={4} toolbarItems={2} />
    </SkeletonPage>
  );
}
