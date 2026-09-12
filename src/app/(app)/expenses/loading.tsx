import { SkeletonPage, SkeletonPageHeader, SkeletonTableCard } from '@/components/shared/page-skeletons';

export default function Loading() {
  return (
    <SkeletonPage>
      <SkeletonPageHeader actions={2} />
      <SkeletonTableCard rows={8} cols={6} toolbarItems={3} />
    </SkeletonPage>
  );
}
