import Link from "next/link";

const categories = [
  { slug: "mountain-bike", name: "Mountain Bike", blurb: "GoPro & Garmin mounts, bottle cages, tool holders", emoji: "🚵" },
  { slug: "automotive", name: "Automotive", blurb: "Brackets, clips, mounts, interior parts", emoji: "🚗" },
  { slug: "home", name: "Home", blurb: "Hooks, organisers, storage solutions", emoji: "🏠" },
  { slug: "business", name: "Business", blurb: "Prototypes, jigs, manufacturing fixtures", emoji: "🏭" },
  { slug: "education", name: "Education", blurb: "STEM models, school & engineering projects", emoji: "🎓" }
];

const steps = [
  { n: 1, title: "Upload your file", body: "STL, STEP, OBJ or 3MF — or just a photo, sketch or description of your idea." },
  { n: 2, title: "Get an instant quote", body: "Our engine analyses volume, weight, print time and support to price it instantly." },
  { n: 3, title: "We print & ship", body: "Track production live from review to delivery, anywhere in New Zealand." }
];

const features = [
  ["Instant quoting", "Real geometry analysis from your uploaded model — no waiting."],
  ["7 materials", "PLA, PETG, TPU, ABS, ASA, Nylon and Carbon Fibre Nylon."],
  ["Custom CAD design", "Send an idea, get a design quote and timeline from our team."],
  ["AI design assistant", "Material and print-setting suggestions for stronger, better parts."],
  ["Live order tracking", "Nine production stages from submitted to delivered."],
  ["NZ-wide shipping", "NZ Post, Aramex NZ and CourierPost with automatic tracking."]
];

export default function HomePage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "PrintForge NZ",
    description: "3D printing marketplace & manufacturing platform in New Zealand.",
    areaServed: "NZ",
    makesOffer: ["3D printing", "Custom CAD design", "Manufacturing"]
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-brand-900 via-brand-800 to-brand-950 text-white">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-20 lg:grid-cols-2 lg:py-28">
          <div>
            <span className="badge bg-white/10 text-brand-100">New Zealand’s on-demand print bureau</span>
            <h1 className="mt-4 text-4xl font-extrabold leading-tight sm:text-5xl">
              From idea to <span className="text-forge-500">printed part</span> — instantly.
            </h1>
            <p className="mt-5 max-w-xl text-lg text-brand-100">
              Upload a 3D file for an instant quote, or describe your idea and let our team and AI assistant
              design it. High-strength materials, live tracking and NZ-wide shipping.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/quote" className="btn-accent text-base">Get an instant quote</Link>
              <Link href="/custom-request" className="btn-ghost border-white/30 bg-white/10 text-white hover:bg-white/20">
                Request a custom design
              </Link>
            </div>
            <p className="mt-4 text-sm text-brand-200">No account needed to quote · Prices in NZD incl. GST</p>
          </div>

          <div className="grid place-items-center">
            <div className="card w-full max-w-sm p-6 text-slate-900">
              <h3 className="font-semibold">Sample instant quote</h3>
              <dl className="mt-4 space-y-2 text-sm">
                <Row label="Material" value="PETG · Black" />
                <Row label="Volume" value="42.6 cm³" />
                <Row label="Weight" value="54 g" />
                <Row label="Print time" value="3h 12m" />
                <div className="my-2 border-t border-slate-100" />
                <Row label="Material" value="$2.27" />
                <Row label="Machine time" value="$3.84" />
                <Row label="Labour" value="$3.65" />
                <Row label="Shipping" value="$6.50" />
                <div className="my-2 border-t border-slate-100" />
                <Row label="Total (incl. GST)" value="$18.69" bold />
              </dl>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-7xl px-4 py-16">
        <h2 className="text-center text-3xl font-bold">How it works</h2>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {steps.map((s) => (
            <div key={s.n} className="card p-6">
              <div className="grid h-10 w-10 place-items-center rounded-full bg-brand-600 font-bold text-white">{s.n}</div>
              <h3 className="mt-4 text-lg font-semibold">{s.title}</h3>
              <p className="mt-2 text-sm text-slate-600">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Categories */}
      <section className="bg-white py-16">
        <div className="mx-auto max-w-7xl px-4">
          <h2 className="text-3xl font-bold">Shop by category</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {categories.map((c) => (
              <Link key={c.slug} href={`/products?category=${c.slug}`} className="card p-5 transition hover:border-brand-400 hover:shadow-md">
                <div className="text-3xl">{c.emoji}</div>
                <h3 className="mt-3 font-semibold">{c.name}</h3>
                <p className="mt-1 text-xs text-slate-500">{c.blurb}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-7xl px-4 py-16">
        <h2 className="text-3xl font-bold">Everything in one platform</h2>
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map(([title, body]) => (
            <div key={title} className="card p-6">
              <h3 className="font-semibold text-brand-800">{title}</h3>
              <p className="mt-2 text-sm text-slate-600">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="bg-brand-900 py-16 text-white">
        <div className="mx-auto max-w-3xl px-4 text-center">
          <h2 className="text-3xl font-bold">Ready to forge something?</h2>
          <p className="mt-3 text-brand-100">Upload your model and get a price in seconds.</p>
          <Link href="/quote" className="btn-accent mt-6 text-base">Start your quote</Link>
        </div>
      </section>
    </>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-slate-500">{label}</dt>
      <dd className={bold ? "font-bold" : "font-medium"}>{value}</dd>
    </div>
  );
}
