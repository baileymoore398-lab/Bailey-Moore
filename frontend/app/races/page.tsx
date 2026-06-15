import Link from "next/link";
import { listRaces } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { StatusBadge, Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function RacesPage() {
  const { data: races, demo } = await listRaces();

  return (
    <div className="container-page py-12">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Races</h1>
          <p className="mt-2 text-muted">
            {races.length} race{races.length === 1 ? "" : "s"} analyzed.
          </p>
        </div>
        <Link href="/upload">
          <Button variant="accent">New analysis</Button>
        </Link>
      </div>

      {demo && (
        <div className="mt-4 inline-flex">
          <Badge variant="warning">Demo data — backend offline</Badge>
        </div>
      )}

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {races.map((race) => {
          const isReady = race.status === "ready";
          const inner = (
            <Card className="h-full p-5 transition-colors hover:border-accent/40">
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-base font-bold leading-snug">
                  {race.name || "Untitled race"}
                </h3>
                <StatusBadge status={String(race.status)} />
              </div>
              <p className="mt-2 text-xs text-muted">
                {formatDate(race.created_at)}
              </p>
              <div className="mt-4 flex h-24 items-center justify-center rounded-lg border border-border bg-bg-soft/60 text-3xl">
                {isReady ? "🗺️" : race.status === "failed" ? "⚠️" : "⏳"}
              </div>
              <div className="mt-4 text-sm">
                {isReady ? (
                  <span className="font-medium text-accent">
                    View analysis →
                  </span>
                ) : (
                  <span className="text-muted capitalize">{race.status}…</span>
                )}
              </div>
            </Card>
          );
          return isReady ? (
            <Link key={race.id} href={`/races/${race.id}`}>
              {inner}
            </Link>
          ) : (
            <div key={race.id} className="cursor-default opacity-90">
              {inner}
            </div>
          );
        })}
      </div>

      {races.length === 0 && (
        <Card className="mt-8 p-12 text-center">
          <p className="text-muted">No races yet.</p>
          <Link href="/upload" className="mt-4 inline-block">
            <Button variant="accent">Analyze your first race</Button>
          </Link>
        </Card>
      )}
    </div>
  );
}
