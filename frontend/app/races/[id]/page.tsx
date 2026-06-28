import { getAnalysis } from "@/lib/api";
import { AnalysisDashboard } from "@/components/AnalysisDashboard";

export const dynamic = "force-dynamic";

export default async function RaceAnalysisPage({
  params,
}: {
  params: { id: string };
}) {
  // The bundled "live demo" race id never exists in a real backend, so it always
  // renders sample data — flag it so the page shows a friendly demo notice
  // instead of an alarming "couldn't reach the backend" warning.
  const isSampleRace = params.id.startsWith("rc_demo");
  const { data: analysis, demo } = await getAnalysis(params.id);
  return <AnalysisDashboard analysis={analysis} demo={demo} sampleRace={isSampleRace} />;
}
