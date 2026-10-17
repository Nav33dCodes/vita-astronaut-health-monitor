import { Suspense } from "react";
import { AstronautProfile } from "@/components/crew/astronaut-profile";
import { Spinner } from "@/components/ui/primitives";

// The astronaut id is only known at request time, so the profile streams in.
export default function AstronautPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <AstronautProfile />
    </Suspense>
  );
}
