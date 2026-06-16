"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { API_BASE, getAthlete, getMe, request, updateProfile } from "@/lib/api";
import { authHeaders, clearSession, isAuthenticated } from "@/lib/auth";

interface ProfileForm {
  full_name: string;
  display_name: string;
  handle: string;
  country: string;
  bio: string;
  is_public: boolean;
}

const EMPTY: ProfileForm = {
  full_name: "",
  display_name: "",
  handle: "",
  country: "",
  bio: "",
  is_public: false,
};

export default function SettingsPage() {
  const router = useRouter();
  const [form, setForm] = React.useState<ProfileForm>(EMPTY);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [demo, setDemo] = React.useState(false);
  const [exporting, setExporting] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  React.useEffect(() => {
    let active = true;
    (async () => {
      const athleteRes = await getAthlete();
      let me = null;
      try {
        if (isAuthenticated()) me = await getMe();
      } catch {
        /* ignore */
      }
      if (!active) return;
      const a = athleteRes.data;
      setDemo(athleteRes.demo);
      setForm({
        full_name: me?.full_name || a.name || "",
        display_name: a.name || "",
        handle: "",
        country: "",
        bio: "",
        is_public: false,
      });
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  function update<K extends keyof ProfileForm>(key: K, value: ProfileForm[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setSaved(false);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await updateProfile({ ...form });
      setSaved(true);
    } catch (err) {
      setError((err as Error).message || "Could not save profile");
    } finally {
      setSaving(false);
    }
  }

  async function handleExport() {
    setExporting(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/v1/account/export`, {
        headers: { ...authHeaders() },
      });
      if (!res.ok) throw new Error(`Export failed (${res.status})`);
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "routeforge-export.json";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError((err as Error).message || "Export failed");
    } finally {
      setExporting(false);
    }
  }

  async function handleDelete() {
    if (
      !window.confirm(
        "Delete your account permanently? This cannot be undone."
      )
    )
      return;
    setDeleting(true);
    setError(null);
    try {
      await request("/account/me", { method: "DELETE" });
    } catch (err) {
      setError((err as Error).message || "Deletion failed");
      setDeleting(false);
      return;
    }
    clearSession();
    router.push("/");
  }

  if (loading) {
    return (
      <div className="container-page py-12">
        <div className="h-8 w-40 animate-pulse rounded bg-bg-elevated" />
        <div className="mt-6 h-72 animate-pulse rounded-xl bg-bg-elevated" />
      </div>
    );
  }

  return (
    <div className="container-page py-10">
      <div className="mx-auto max-w-2xl">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-black tracking-tight">Settings</h1>
          {demo && <Badge variant="warning">Demo data</Badge>}
        </div>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Profile</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSave} className="space-y-4">
              <Field
                label="Full name"
                value={form.full_name}
                onChange={(v) => update("full_name", v)}
              />
              <Field
                label="Display name"
                value={form.display_name}
                onChange={(v) => update("display_name", v)}
              />
              <Field
                label="Handle"
                value={form.handle}
                onChange={(v) => update("handle", v)}
                placeholder="travis"
              />
              <Field
                label="Country"
                value={form.country}
                onChange={(v) => update("country", v)}
                placeholder="NO"
              />
              <div>
                <label className="mb-1.5 block text-sm font-medium text-muted">
                  Bio
                </label>
                <textarea
                  value={form.bio}
                  onChange={(e) => update("bio", e.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-border bg-bg-soft px-3 py-2 text-sm outline-none focus:border-accent"
                />
              </div>
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={form.is_public}
                  onChange={(e) => update("is_public", e.target.checked)}
                  className="h-4 w-4 accent-accent"
                />
                <span className="text-sm">Make my profile public</span>
              </label>

              {error && (
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                  {error}
                </div>
              )}
              <div className="flex items-center gap-3">
                <Button type="submit" variant="accent" disabled={saving}>
                  {saving ? "Saving…" : "Save changes"}
                </Button>
                {saved && (
                  <span className="text-sm text-emerald-300">Saved ✓</span>
                )}
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Danger zone */}
        <Card className="mt-6 border-red-500/30">
          <CardHeader>
            <CardTitle className="text-red-300">Danger zone</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-medium">Export your data (GDPR)</div>
                <p className="text-xs text-muted">
                  Download a JSON copy of your account and races.
                </p>
              </div>
              <Button
                variant="outline"
                onClick={handleExport}
                disabled={exporting}
              >
                {exporting ? "Exporting…" : "Export JSON"}
              </Button>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-5">
              <div>
                <div className="text-sm font-medium text-red-300">
                  Delete account
                </div>
                <p className="text-xs text-muted">
                  Permanently remove your account and all data.
                </p>
              </div>
              <Button
                variant="danger"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? "Deleting…" : "Delete account"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-muted">{label}</label>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-border bg-bg-soft px-3 py-2 text-sm outline-none focus:border-accent"
      />
    </div>
  );
}
