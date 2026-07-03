import type { Metadata } from "next";
import Link from "next/link";
import { CONTACT_EMAIL } from "@/lib/site";

export const metadata: Metadata = {
  title: "FAQ",
  description:
    "Frequently asked questions about RouteForge — supported file formats, split times, accuracy, privacy, and pricing.",
};

const FAQS: { q: string; a: string }[] = [
  {
    q: "What is RouteForge?",
    a: "RouteForge is an AI race-analysis tool for orienteering, MTBO, rogaining, adventure racing and trail running. You upload a GPS track (plus optionally a map photo and split times) and it produces leg-by-leg analysis, mistake detection, performance scores, an interactive speed-coloured replay, and an AI coaching report.",
  },
  {
    q: "Which file formats can I upload?",
    a: "GPS tracks: GPX, FIT, TCX, KML, KMZ, GeoJSON, JSON and CSV. Split times: CSV, TSV, TXT, IOF XML, SPL and JSON — or simply paste your row straight from WinSplits Online. Map photos: JPG, PNG and HEIC (iPhone photos work directly).",
  },
  {
    q: "How do I add my split times from WinSplits?",
    a: "On WinSplits Online, select your row in the results table (your name and times), copy it, and paste it into the “paste from WinSplits” box on the Splits step when analyzing a race. RouteForge automatically reads your cumulative splits — including WinSplits' dot-separated time format.",
  },
  {
    q: "Why should I add split times?",
    a: "Split times pin each control to the exact moment you punched it. That makes control placement on the map, leg-by-leg timing, rankings and mistake detection far more accurate than GPS alone.",
  },
  {
    q: "How accurate is the analysis?",
    a: "Distances, speeds and climb are computed directly from your GPS track with spike rejection and elevation smoothing — typically within a few percent (limited by GPS itself). The AI coach only cites numbers computed from your actual data; it never invents figures. Adding split times further improves control placement and leg accuracy.",
  },
  {
    q: "Is RouteForge free?",
    a: "Yes — the free plan includes several analyses per month with the full replay, scores and coaching report. Paid plans remove the monthly limit and add extras; see the pricing page for details.",
  },
  {
    q: "Do I need an account?",
    a: "You can try the live demo without one. Create a free account to save your races, build up performance trends, and use the dashboard, training and club features.",
  },
  {
    q: "Is my data private?",
    a: "Yes. Your uploads belong to you, we don't sell personal data, and there are no advertising trackers. You can export or delete all of your data at any time from account settings. See our Privacy Policy for full details.",
  },
  {
    q: "Can I share my race on social media?",
    a: "Yes — every analysis has a Share Studio that generates branded photos (square, story and landscape formats) and an animated replay video of your route, ready for Instagram, TikTok, X or your club chat.",
  },
  {
    q: "My upload failed or the analysis looks wrong — what should I do?",
    a: `Check that your GPS file is one of the supported formats and contains a recorded track (not just a planned route). If something still looks off, contact us at ${CONTACT_EMAIL} — attaching the file helps us fix it fast.`,
  },
];

export default function FaqPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQS.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  return (
    <div className="container-page py-12">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
          Frequently asked questions
        </h1>
        <p className="mt-2 text-muted">
          Everything you need to know about analyzing your races with
          RouteForge.
        </p>

        <div className="mt-8 space-y-3">
          {FAQS.map((f) => (
            <details
              key={f.q}
              className="group rounded-xl border border-border bg-bg-card/70 px-5 py-4 open:border-accent/40"
            >
              <summary className="cursor-pointer list-none text-base font-bold text-white marker:content-none">
                <span className="flex items-center justify-between gap-3">
                  {f.q}
                  <span
                    aria-hidden
                    className="shrink-0 text-muted transition-transform group-open:rotate-45"
                  >
                    +
                  </span>
                </span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-muted">{f.a}</p>
            </details>
          ))}
        </div>

        <div className="mt-10 rounded-2xl border border-accent/30 bg-accent/10 p-6 text-center">
          <p className="text-sm text-white/90">
            Still have a question?{" "}
            <Link href="/contact" className="font-semibold text-accent hover:underline">
              Contact us
            </Link>{" "}
            — or just{" "}
            <Link href="/upload" className="font-semibold text-accent hover:underline">
              analyze a race
            </Link>{" "}
            and see for yourself.
          </p>
        </div>
      </div>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </div>
  );
}
