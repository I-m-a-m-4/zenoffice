import {
  SkeletonPage,
  SkeletonPageHeader,
  SkeletonStatCards,
  SkeletonTableCard,
} from '@/components/shared/page-skeletons';

/** `PageTitle`, three summary cards across, then the seven-column order table. */
export default function Loading() {
  return (
    <SkeletonPage>
      <SkeletonPageHeader titleWidth="w-44" />
      <SkeletonStatCards count={3} cols="md:grid-cols-3" />
      <SkeletonTableCard rows={5} cols={7} toolbarItems={2} />
    </SkeletonPage>
  );
}
