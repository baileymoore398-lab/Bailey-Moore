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
    body: "Upload GPX, FIT, TCX, KML and more. We compute splits, speed, climb, pace and detect navigation mistakes leg by leg.",
  },
  {
    title: "AI Coach",
    icon: "🧠",
    body: "Get a personalized report: strengths, weaknesses, and concrete drills to fix the errors that actually cost you time.",
  },
  {
    title: "Share Studio",
    icon: "🎬",
    body: "Turn your race into a branded photo or an animated replay video with speed colours — ready for Instagram, TikTok or your club chat.",
  },
];

const steps = [
  {
    n: "1",
    title: "Upload your race",
    body: "GPS track from your watch, a photo of the map, and your splits (paste them straight from WinSplits).",
  },
  {
    n: "2",
    title: "We analyze everything",
    body: "Leg-by-leg times, route efficiency, mistake detection and performance scores — computed in seconds.",
  },
  {
    n: "3",
    title: "Replay, learn, improve",
    body: "Watch your speed-coloured replay, read your AI coach report, and get drills that target your weakest skills.",
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

// Credibility strip under the hero — factual "works with" capabilities.
const worksWith = [
  "Strava import",
  "WinSplits paste",
  "GPX · FIT · TCX · KML",
  "Orienteering · MTBO · Rogaine · Trail",
];

/** Product-style preview card: a speed-coloured route with controls + stats. */
function HeroPreview() {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-bg-card/60 p-1 shadow-2xl shadow-accent/5">
      <div className="rounded-xl bg-bg-soft/60 p-4 sm:p-6">
        <div className="flex items-center justify-between px-1 pb-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted">
            Race replay
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/10 px-2.5 py-0.5 text-[11px] font-semibold text-accent">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
            Live analysis
          </span>
        </div>

        {/* Route mock — speed-coloured track with controls, start, finish. */}
        <svg
          viewBox="0 0 640 240"
          role="img"
          aria-label="Example analyzed route with speed colours and controls"
          className="h-auto w-full rounded-lg border border-border/60 bg-[#11140d]"
        >
          <defs>
            <linearGradient id="spd" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#3b82f6" />
              <stop offset="0.5" stopColor="#2ecf6e" />
              <stop offset="1" stopColor="#d9f56b" />
            </linearGradient>
          </defs>
          {/* contour hints */}
          <path d="M-10 60 Q160 20 330 65 T650 55" fill="none" stroke="#2c3322" strokeWidth="1.5" />
          <path d="M-10 130 Q160 90 330 135 T650 125" fill="none" stroke="#2c3322" strokeWidth="1.5" />
          <path d="M-10 200 Q160 160 330 205 T650 195" fill="none" stroke="#2c3322" strokeWidth="1.5" />
          {/* route — draws itself in on load */}
          <motion.path
            d="M60 190 L150 90 L260 130 L350 50 L450 110 L560 60"
            fill="none"
            stroke="url(#spd)"
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 2, ease: "easeInOut", delay: 0.4 }}
          />
          {/* a runner that endlessly retraces the course */}
          <motion.circle
            r="6"
            fill="#2ecf6e"
            style={{
              offsetPath:
                'path("M60 190 L150 90 L260 130 L350 50 L450 110 L560 60")',
              filter: "drop-shadow(0 0 6px rgba(46,207,110,0.9))",
            }}
            initial={{ offsetDistance: "0%" }}
            animate={{ offsetDistance: "100%" }}
            transition={{
              duration: 4,
              ease: "easeInOut",
              repeat: Infinity,
              repeatType: "reverse",
              delay: 2.2,
            }}
          />
          {/* controls */}
          {[
            [150, 90],
            [260, 130],
            [350, 50],
            [450, 110],
          ].map(([x, y], i) => (
            <g key={i}>
              <circle cx={x} cy={y} r="11" fill="none" stroke="#f97316" strokeWidth="3" />
              <text x={x} y={y - 17} textAnchor="middle" fontSize="12" fontWeight="700" fill="#fff">
                {i + 1}
              </text>
            </g>
          ))}
          {/* start triangle */}
          <path d="M60 178 L70 196 L50 196 Z" fill="#34d977" />
          {/* finish */}
          <rect x="552" y="52" width="16" height="16" rx="3" fill="#fff" />
        </svg>

        <div className="mt-4 grid grid-cols-2 gap-1 sm:grid-cols-4">
          {[
            ["2.44 km", "Distance"],
            ["15:14", "Time"],
            ["88 m", "Climb"],
            ["74", "Overall"],
          ].map(([v, l], i) => (
            <div key={l} className="rounded-xl bg-bg-card/70 px-4 py-4 text-center">
              <div className={i === 3 ? "stat-value text-accent" : "stat-value"}>{v}</div>
              <div className="stat-label mt-1">{l}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function LandingPage() {
  return (
    <div className="container-page">
      {/* Hero */}
      <section className="relative grid place-items-center py-20 text-center sm:py-28">
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
            <span className="bg-gradient-to-r from-accent via-accent-lime to-accent bg-clip-text text-transparent">
              Learn from every race.
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-pretty text-lg text-muted">
            RouteForge turns a photo of your map and a GPS track into deep,
            leg-by-leg analysis — mistake detection, performance scores, and an
            AI coach that tells you exactly how to improve.
          </p>
          <div className="mt-9 flex items-center justify-center gap-3">
            <Button variant="accent" size="lg" className="rf-breathe" asChild>
              <Link href="/upload">Analyze a race →</Link>
            </Button>
            <Link
              href="/races/rc_demo_001"
              className="inline-flex items-center justify-center rounded-lg border border-border px-6 py-3 text-base font-semibold text-white transition hover:border-accent hover:text-accent"
            >
              See a live demo
            </Link>
          </div>

          {/* Trust strip — what it works with, no fake logos or numbers. */}
          <div className="mt-10">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted/70">
              Works with your gear
            </p>
            <div className="mt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-2">
              {worksWith.map((w) => (
                <span
                  key={w}
                  className="rounded-full border border-border bg-bg-card/50 px-3 py-1 text-xs font-medium text-muted"
                >
                  {w}
                </span>
              ))}
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="mt-16 w-full max-w-4xl"
        >
          <HeroPreview />
        </motion.div>
      </section>

      {/* How it works */}
      <section className="py-14">
        <div className="text-center">
          <span className="eyebrow">Three steps</span>
          <h2 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">
            From race to insight in minutes
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-muted">
            No spreadsheets, no manual timing — upload once and get the full
            picture.
          </p>
        </div>
        <div className="relative mt-12 grid gap-4 sm:grid-cols-3">
          {/* connector line behind the step badges (desktop) */}
          <div className="pointer-events-none absolute inset-x-[16%] top-[46px] hidden h-px bg-gradient-to-r from-transparent via-accent/30 to-transparent sm:block" />
          {steps.map((s, i) => (
            <motion.div
              key={s.n}
              custom={i}
              variants={fadeUp}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: "-60px" }}
              className="card-lift relative rounded-2xl border border-border bg-bg-card/70 p-6"
            >
              <span className="relative grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-accent to-[#1c9e57] text-lg font-black text-bg shadow-lg shadow-accent/20 ring-4 ring-bg">
                {s.n}
              </span>
              <h3 className="mt-4 text-lg font-bold">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{s.body}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Feature grid */}
      <section className="py-14">
        <div className="text-center">
          <span className="eyebrow">Everything included</span>
          <h2 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">
            Built to make you faster
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-muted">
            Powerful analysis, an AI coach, and share-ready visuals — all in one
            place.
          </p>
        </div>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              custom={i}
              variants={fadeUp}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: "-60px" }}
              className="card-lift group rounded-2xl border border-border bg-bg-card/70 p-6"
            >
              <div className="grid h-12 w-12 place-items-center rounded-xl border border-accent/20 bg-gradient-to-br from-accent/20 to-accent/5 text-2xl transition-transform duration-300 group-hover:scale-110">
                {f.icon}
              </div>
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
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(50%_120%_at_50%_0%,rgba(46,207,110,0.16),transparent)]" />
          <h2 className="relative text-3xl font-black sm:text-4xl">
            Ready to find your lost minutes?
          </h2>
          <p className="relative mx-auto mt-3 max-w-md text-muted">
            Upload your next race and get an analysis in seconds. No account
            required for the demo.
          </p>
          <div className="relative mt-8">
            <Button variant="accent" size="lg" asChild>
              <Link href="/upload">Start analyzing</Link>
            </Button>
          </div>
        </motion.div>
      </section>
    </div>
  );
}
