"use client";

import * as React from "react";
import Link from "next/link";
import { createClub, listClubs } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DemoBadge } from "@/components/DemoBadge";

interface ClubListItem {
  id: string;
  name: string;
  slug: string;
  members: number;
}

export default function ClubsPage() {
  const [clubs, setClubs] = React.useState<ClubListItem[]>([]);
  const [demo, setDemo] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [name, setName] = React.useState("");
  const [country, setCountry] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    const { data, demo } = await listClubs();
    setClubs(data);
    setDemo(demo);
    setLoading(false);
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await createClub(name.trim(), country || undefined);
      setName("");
      setCountry("");
      await load();
    } catch (err) {
      setError((err as Error).message || "Failed to create club");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container-page space-y-8 py-8">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Clubs</h1>
          <p className="text-sm text-muted">
            Club analytics, member rankings, and event participation.
          </p>
        </div>
        <DemoBadge show={demo} />
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        <div className="space-y-3">
          {loading ? (
            <p className="text-sm text-muted">Loading clubs…</p>
          ) : clubs.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted">
                No clubs yet. Create one →
              </CardContent>
            </Card>
          ) : (
            clubs.map((c) => (
              <Link key={c.id} href={`/clubs/${c.id}`}>
                <Card className="transition-colors hover:border-accent/40">
                  <CardContent className="flex items-center justify-between gap-4 py-4">
                    <div>
                      <h3 className="font-semibold text-white">{c.name}</h3>
                      <p className="text-xs text-muted">{c.slug}</p>
                    </div>
                    <Badge variant="muted">{c.members} members</Badge>
                  </CardContent>
                </Card>
              </Link>
            ))
          )}
        </div>

        <Card className="h-fit">
          <CardContent className="space-y-4 py-5">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-white">
              Create club
            </h2>
            <form onSubmit={submit} className="space-y-3">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-muted">
                  Name
                </span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Forest OK"
                  className={inputCls}
                  required
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-muted">
                  Country
                </span>
                <input
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  placeholder="Norway"
                  className={inputCls}
                />
              </label>
              {error && <p className="text-xs text-red-300">{error}</p>}
              <Button
                type="submit"
                variant="accent"
                className="w-full"
                disabled={busy}
              >
                {busy ? "Creating…" : "Create club"}
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
