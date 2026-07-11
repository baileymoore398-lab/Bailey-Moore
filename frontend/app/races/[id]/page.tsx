"use client";

import * as React from "react";
import { getAnalysis } from "@/lib/api";
import { AnalysisDashboard } from "@/components/AnalysisDashboard";
import type { Analysis } from "@/lib/types";

// Client component so the request carries the signed-in user's token (which
// lives in localStorage and is unavailable during server rendering). Rendering
// this on the server always fetched unauthenticated → demo data for real users.
export default function RaceAnalysisPage({ params }: { params: { id: string } }) {
  const [analysis, setAnalysis] = React.useState<Analysis | null>(null);
  const [demo, setDemo] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  // The bundled "live demo" race id never exists in a real backend, so it
  // always renders sample data — flag it for a friendly demo notice.
  const isSampleRace = params.id.startsWith("rc_demo");

  React.useEffect(() => {
    let active = true;
    (async () => {
      const { data, demo: isDemo } = await getAnalysis(params.id);
      if (!active) return;
      setAnalysis(data);
      setDemo(isDemo);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [params.id]);

  if (loading || !analysis) {
    return (
      <div className="container-page py-12">
        <div className="h-8 w-64 animate-pulse rounded bg-bg-elevated" />
        <div className="mt-6 h-96 animate-pulse rounded-2xl bg-bg-elevated" />
      </div>
    );
  }

  return <AnalysisDashboard analysis={analysis} demo={demo} sampleRace={isSampleRace} />;
}
