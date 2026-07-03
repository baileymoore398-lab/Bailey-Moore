import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="container-page grid min-h-[70vh] place-items-center py-16 text-center">
      <div className="mx-auto max-w-md">
        {/* A lost control marker — mispunched. */}
        <div className="mx-auto grid h-20 w-20 place-items-center rounded-full border-4 border-[#f97316]">
          <span className="text-3xl">🧭</span>
        </div>
        <h1 className="mt-6 text-5xl font-black tracking-tight">
          4<span className="text-accent">0</span>4
        </h1>
        <h2 className="mt-2 text-xl font-bold">Mispunch — wrong control.</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          This page doesn&apos;t exist (or it moved). Relocate to a known
          feature and attack again.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Button variant="accent" asChild>
            <Link href="/">Back to start</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/dashboard">Dashboard</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
