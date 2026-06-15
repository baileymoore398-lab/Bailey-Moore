import { getAnalysis } from "@/lib/api";
import { AnalysisDashboard } from "@/components/AnalysisDashboard";

export const dynamic = "force-dynamic";

export default async function RaceAnalysisPage({
  params,
}: {
  params: { id: string };
}) {
  const { data: analysis, demo } = await getAnalysis(params.id);
  return <AnalysisDashboard analysis={analysis} demo={demo} />;
}
