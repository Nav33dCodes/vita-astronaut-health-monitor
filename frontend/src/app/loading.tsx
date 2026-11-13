import { OverviewSkeleton } from "@/components/skeletons/page-skeletons";

/** Instant, prerendered loading state for this route: the same layout the page fills in. */
export default function Loading() {
  return <OverviewSkeleton />;
}
