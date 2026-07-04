"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { PricingCards } from "@/components/PricingCards";
import { getPlans } from "@/lib/api";
import type { BillingPlans } from "@/lib/types";

export default function PricingPage() {
  const [plans, setPlans] = React.useState<BillingPlans | null>(null);
  const [demo, setDemo] = React.useState(false);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    (async () => {
      const res = await getPlans();
      setPlans(res.data);
      setDemo(res.demo);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="container-page py-16">
      <div className="mx-auto max-w-2xl text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-accent">
          Membership
        </span>
        <h1 className="mt-5 text-4xl font-black tracking-tight sm:text-5xl">
          Become a RouteForge member
        </h1>
        <p className="mt-3 text-muted">
          Free while we&apos;re new. Memberships unlock later — here&apos;s
          what&apos;s coming.
        </p>
        {demo && (
          <div className="mt-4 flex justify-center">
            <Badge variant="warning">Demo data</Badge>
          </div>
        )}
      </div>

      <div className="mt-12">
        {loading || !plans ? (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-80 animate-pulse rounded-2xl bg-bg-elevated"
              />
            ))}
          </div>
        ) : (
          <PricingCards plans={plans} />
        )}
      </div>
    </div>
  );
}
