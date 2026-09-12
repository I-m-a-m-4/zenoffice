import { SkeletonPage, SkeletonPageHeader, SkeletonTableCard } from '@/components/shared/page-skeletons';

/** `PageTitle` with the forensic-scan action, over the seven-column log table. */
export default function Loading() {
  return (
    <SkeletonPage>
      <SkeletonPageHeader titleWidth="w-40" actions={1} />
      <SkeletonTableCard rows={9} cols={6} toolbarItems={2} />
    </SkeletonPage>
  );
}
