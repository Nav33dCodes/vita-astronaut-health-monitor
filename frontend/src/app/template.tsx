import type { ReactNode } from "react";

/**
 * Re-mounts on every navigation (unlike layout.tsx), giving each section a short, subtle
 * enter transition. Kept fast (220ms) so navigation feels smooth, never slow.
 */
export default function Template({ children }: { children: ReactNode }) {
  return <div className="animate-page-in">{children}</div>;
}
