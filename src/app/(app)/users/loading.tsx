import { SkeletonPage, SkeletonPageHeader, SkeletonTableCard } from '@/components/shared/page-skeletons';

/**
 * `PageTitle` over one full-width card (`md:col-span-2` inside a
 * `grid gap-6 md:grid-cols-2`) holding the five-column staff table: user, email,
 * role, status, actions. Matches the in-page skeleton the page already renders
 * while the user list loads, so the two do not disagree.
 */
export default function Loading() {
  return (
    <SkeletonPage>
      <SkeletonPageHeader titleWidth="w-56" />
      <SkeletonTableCard rows={5} cols={5} toolbarItems={1} />
    </SkeletonPage>
  );
}
