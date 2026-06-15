"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";

const features = [
  {
    title: "Smart Map Photo AI",
    icon: "🗺️",
    body: "Snap a photo of your paper map. Our vision model reads controls, georeferences the course, and aligns it to your GPS — no scanning required.",
  },
  {
    title: "GPS Analysis",
    icon: "📈",
    body: "Upload GPX, FIT, or TCX. We compute splits, speed, climb, pace and detect navigation mistakes leg by leg.",
  },
  {
    title: "AI Coach",
    icon: "🧠",
    body: "Get a personalized report: strengths, weaknesses, and concrete drills to fix the errors that actually cost you time.",
  },
  {
    title: "Video Export",
    icon: "🎬",
    body: "Render a cinematic replay of your run with a moving dot, speed heat, and mistake call-outs — ready to share.",
  },
];

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, delay: i * 0.08, ease: "easeOut" },
  }),
};

export default function LandingPage() {
  return (
    <div className="container-page">
      {/* Hero */}
      <section className="relative grid place-items-center py-24 text-center sm:py-32">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="mx-auto max-w-3xl"
        >
          <span className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-accent">
            AI race analysis
          </span>
          <h1 className="mt-6 text-balance text-5xl font-black leading-[1.05] tracking-tight sm:text-7xl">
            Forge a faster route.
            <br />
            <span className="bg-gradient-to-r from-accent via-cyan-300 to-accent-lime bg-clip-text text-transparent">
              Learn from every race.
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-pretty text-lg text-muted">
            RouteForge turns a photo of your map and a GPS track into deep,
            leg-by-leg analysis — mistake detection, performance scores, and an
            AI coach that tells you exactly how to improve.
          </p>
          <div className="mt-9 flex items-center justify-center gap-3">
            <Link href="/upload">
              <Button variant="accent" size="lg">
                Analyze a race →
              </Button>
            </Link>
            <Link href="/races/rc_demo_001">
              <Button variant="outline" size="lg">
                See a live demo
              </Button>
            </Link>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="mt-16 w-full max-w-4xl overflow-hidden rounded-2xl border border-border bg-bg-card/60 p-1 shadow-2xl shadow-accent/5"
        >
          <div className="grid grid-cols-2 gap-1 sm:grid-cols-4">
            {[
              ["2.44 km", "Distance"],
              ["15:14", "Time"],
              ["88 m", "Climb"],
              ["74", "Overall"],
            ].map(([v, l]) => (
              <div
                key={l}
                className="rounded-xl bg-bg-soft/60 px-4 py-6 text-center"
              >
                <div className="stat-value">{v}</div>
                <div className="stat-label mt-1">{l}</div>
              </div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* Feature grid */}
      <section className="py-12">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              custom={i}
              variants={fadeUp}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: "-60px" }}
              className="group rounded-2xl border border-border bg-bg-card/70 p-6 transition-colors hover:border-accent/40"
            >
              <div className="text-3xl">{f.icon}</div>
              <h3 className="mt-4 text-lg font-bold">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{f.body}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="my-20">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="relative overflow-hidden rounded-3xl border border-accent/30 bg-gradient-to-br from-bg-card to-bg-soft px-8 py-16 text-center"
        >
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(50%_120%_at_50%_0%,rgba(34,211,238,0.18),transparent)]" />
          <h2 className="relative text-3xl font-black sm:text-4xl">
            Ready to find your lost minutes?
          </h2>
          <p className="relative mx-auto mt-3 max-w-md text-muted">
            Upload your next race and get an analysis in seconds. No account
            required for the demo.
          </p>
          <div className="relative mt-8">
            <Link href="/upload">
              <Button variant="accent" size="lg">
                Start analyzing
              </Button>
            </Link>
          </div>
        </motion.div>
      </section>

      <footer className="border-t border-border/60 py-8 text-center text-sm text-muted">
        RouteForge — AI race analysis for orienteers and trail runners.
      </footer>
    </div>
  );
}
