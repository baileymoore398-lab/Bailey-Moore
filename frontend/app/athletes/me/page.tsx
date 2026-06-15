import { getAthlete } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScoreTrend, TimeLossTrend } from "@/components/AthleteTrends";
import { formatDuration } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AthleteProfilePage() {
  const { data: athlete, demo } = await getAthlete();
  const s = athlete.stats;

  const stats = [
    { label: "Races", value: String(s.races) },
    { label: "Distance", value: `${s.total_distance_km.toFixed(0)} km` },
    { label: "Total time", value: formatDuration(s.total_time_s) },
    { label: "Avg score", value: String(s.avg_overall_score) },
    { label: "Best score", value: String(s.best_score) },
    { label: "Avg navigation", value: String(s.avg_navigation) },
  ];

  return (
    <div className="container-page py-10">
      <div className="flex flex-wrap items-center gap-4">
        <div className="grid h-16 w-16 place-items-center rounded-2xl bg-accent text-2xl font-black text-bg">
          {athlete.name.charAt(0)}
        </div>
        <div>
          <h1 className="text-3xl font-black tracking-tight">{athlete.name}</h1>
          {athlete.email && (
            <p className="text-sm text-muted">{athlete.email}</p>
          )}
        </div>
        {demo && (
          <div className="ml-auto">
            <Badge variant="warning">Demo data — backend offline</Badge>
          </div>
        )}
      </div>

      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {stats.map((st) => (
          <Card key={st.label} className="p-4">
            <div className="stat-value">{st.value}</div>
            <div className="stat-label mt-1">{st.label}</div>
          </Card>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Score trend</CardTitle>
          </CardHeader>
          <CardContent>
            <ScoreTrend trend={athlete.trend} />
            <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted">
              <Legend color="#22d3ee" label="Overall" />
              <Legend color="#f97316" label="Navigation" />
              <Legend color="#a3e635" label="Fitness" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Time lost per race</CardTitle>
          </CardHeader>
          <CardContent>
            <TimeLossTrend trend={athlete.trend} />
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Recent races</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted">
                  <th className="px-5 py-2 font-medium">Race</th>
                  <th className="px-2 py-2 font-medium">Date</th>
                  <th className="px-2 py-2 font-medium">Distance</th>
                  <th className="px-2 py-2 font-medium">Overall</th>
                  <th className="px-5 py-2 font-medium">Time lost</th>
                </tr>
              </thead>
              <tbody>
                {[...athlete.trend].reverse().map((t) => (
                  <tr key={t.race} className="border-b border-border/50">
                    <td className="px-5 py-2.5 font-medium">{t.race}</td>
                    <td className="px-2 py-2.5 text-muted">{t.date}</td>
                    <td className="px-2 py-2.5 tabular-nums">
                      {t.distance_km.toFixed(1)} km
                    </td>
                    <td className="px-2 py-2.5 font-semibold tabular-nums text-accent">
                      {t.overall}
                    </td>
                    <td className="px-5 py-2.5 tabular-nums text-amber-300">
                      +{t.time_loss_s}s
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="h-2.5 w-2.5 rounded-full"
        style={{ backgroundColor: color }}
      />
      {label}
    </span>
  );
}
