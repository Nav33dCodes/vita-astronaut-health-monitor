import { Suspense } from "react";
import { AstronautProfile } from "@/components/crew/astronaut-profile";
import { ProfileSkeleton } from "@/components/skeletons/page-skeletons";

// The astronaut id is only known at request time, so the profile streams in.
export default function AstronautPage() {
  return (
    <Suspense fallback={<ProfileSkeleton />}>
      <AstronautProfile />
    </Suspense>
  );
}
