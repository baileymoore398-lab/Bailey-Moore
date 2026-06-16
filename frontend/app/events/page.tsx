"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createEvent, listEvents } from "@/lib/api";
import type { EventDetail } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DemoBadge } from "@/components/DemoBadge";
import { formatDate } from "@/lib/utils";

export default function EventsPage() {
  const router = useRouter();
  const [events, setEvents] = React.useState<EventDetail[]>([]);
  const [demo, setDemo] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [creating, setCreating] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [name, setName] = React.useState("");
  const [discipline, setDiscipline] = React.useState("orienteering");
  const [date, setDate] = React.useState("");
  const [location, setLocation] = React.useState("");

  const load = React.useCallback(async () => {
    setLoading(true);
    const { data, demo } = await listEvents();
    setEvents(data);
    setDemo(demo);
    setLoading(false);
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const ev = await createEvent({
        name: name.trim(),
        discipline,
        date: date || null,
        location: location || null,
      });
      router.push(`/events/${ev.id}`);
    } catch (err) {
      setError((err as Error).message || "Failed to create event");
      setCreating(false);
    }
  };

  return (
    <div className="container-page space-y-8 py-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Events</h1>
          <p className="text-sm text-muted">
            Host multi-competitor events with leaderboards and synchronized replay.
          </p>
        </div>
        <DemoBadge show={demo} />
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        {/* Event list */}
        <div className="space-y-3">
          {loading ? (
            <p className="text-sm text-muted">Loading events…</p>
          ) : events.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted">
                No events yet. Create your first one →
              </CardContent>
            </Card>
          ) : (
            events.map((ev) => (
              <Link key={ev.id} href={`/events/${ev.id}`}>
                <Card className="transition-colors hover:border-accent/40">
                  <CardContent className="flex items-center justify-between gap-4 py-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="truncate font-semibold text-white">
                          {ev.name}
                        </h3>
                        <StatusBadge status={ev.status} />
                      </div>
                      <p className="mt-0.5 text-xs text-muted">
                        {ev.discipline}
                        {ev.location ? ` · ${ev.location}` : ""}
                        {ev.date ? ` · ${formatDate(ev.date)}` : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Badge variant="muted">{ev.entry_count} entries</Badge>
                      <Badge variant="accent">{ev.matched_gps} GPS</Badge>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))
          )}
        </div>

        {/* Create form */}
        <Card className="h-fit">
          <CardContent className="space-y-4 py-5">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-white">
              Create event
            </h2>
            <form onSubmit={submit} className="space-y-3">
              <Field label="Name">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Spring Forest Cup"
                  className={inputCls}
                  required
                />
              </Field>
              <Field label="Discipline">
                <select
                  value={discipline}
                  onChange={(e) => setDiscipline(e.target.value)}
                  className={inputCls}
                >
                  <option value="orienteering">Orienteering</option>
                  <option value="trail">Trail</option>
                  <option value="rogaine">Rogaine</option>
                  <option value="mtbo">MTB-O</option>
                </select>
              </Field>
              <Field label="Date">
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className={inputCls}
                />
              </Field>
              <Field label="Location">
                <input
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Oslo, Norway"
                  className={inputCls}
                />
              </Field>
              {error && <p className="text-xs text-red-300">{error}</p>}
              <Button
                type="submit"
                variant="accent"
                className="w-full"
                disabled={creating}
              >
                {creating ? "Creating…" : "Create event"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-border bg-bg-soft px-3 py-2 text-sm text-white outline-none placeholder:text-muted focus:border-accent/60 focus:ring-2 focus:ring-accent/30";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted">{label}</span>
      {children}
    </label>
  );
}
