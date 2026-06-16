"use client";

import { Badge } from "@/components/ui/badge";

/** Small badge shown when an API response fell back to bundled demo data. */
export function DemoBadge({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <Badge variant="warning" className="uppercase tracking-wider">
      Demo data
    </Badge>
  );
}
