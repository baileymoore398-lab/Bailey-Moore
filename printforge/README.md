# PrintForge NZ

A 3D printing marketplace & manufacturing platform for New Zealand — instant
quoting from uploaded 3D files, custom CAD design requests, an AI design
assistant, an online store, a full order/production workflow, printer-fleet
management and an analytics admin dashboard.

Built as a single cohesive **Next.js 14 (App Router)** application:
**TypeScript · TailwindCSS · Prisma · PostgreSQL**. Next.js route handlers are
the Node backend, so the whole thing deploys to Vercel as one app.

> **Scope note.** This repository is a complete, runnable *foundation* covering
> the core domain end-to-end. Third-party services that require credentials
> (Clerk, Stripe, OpenAI, AWS S3, NZ courier APIs) are integrated behind
> adapters with safe local fallbacks, so the platform is fully demoable with
> **zero external keys** and becomes production-grade by adding them. See
> [Integration status](#integration-status).

## What's implemented

| Area | Status |
| --- | --- |
| **Instant quote engine** | ✅ Real binary/ASCII **STL** + **OBJ** volume computation (signed-tetrahedron), weight, print time, support detection, full NZD cost breakdown w/ GST. STEP/3MF use a heuristic flagged for operator confirmation. |
| **Custom design requests** | ✅ Submit idea + category, admin notification, admin review queue. |
| **AI design assistant** | ✅ Material + print-setting suggestions. Uses OpenAI when configured, deterministic rules engine otherwise. |
| **Online store** | ✅ Categories, search, product pages, related products, reviews (with print/design quality + aggregates). |
| **Auth** | ✅ Email/password + JWT session, register (individual/business), password reset. Google/Apple via Clerk when configured. |
| **Orders & production** | ✅ 9-stage workflow (Submitted → Delivered), status history timeline, live customer tracking by order number. |
| **Payments** | ✅ Stripe PaymentIntent creation (Apple/Google Pay via Stripe automatic methods); mock intent without keys. |
| **Shipping** | ✅ Label/tracking generation for NZ Post / Aramex NZ / CourierPost (mock refs without carrier keys). |
| **Printer management** | ✅ Fleet status, filament remaining, success rate, maintenance, brand support. |
| **Admin dashboard** | ✅ Revenue (month/all-time), orders today/month, top products, customers, printer utilisation, material/filament usage. |
| **Marketing** | ✅ Discount codes (percent/fixed), gift cards, loyalty points, referral codes, newsletter (schema + discount applied at checkout). |
| **SEO** | ✅ Per-page metadata, JSON-LD (Organization + Product w/ AggregateRating), semantic markup. |

## Tech stack

- **Next.js 14** App Router (RSC + route handlers)
- **TypeScript**, **TailwindCSS**
- **Prisma** ORM + **PostgreSQL**
- **bcryptjs** + **jose** (JWT sessions), **zod** (validation)

## Getting started

```bash
cd printforge
npm install
cp .env.example .env          # set DATABASE_URL + AUTH_SECRET

npx prisma migrate dev --name init   # or: npx prisma db push
npm run seed                          # materials, products, printers, demo users
npm run dev                           # http://localhost:3000
```

### Demo accounts (from seed)

- **Admin:** `admin@printforge.nz` / `admin123`
- **Customer:** `demo@printforge.nz` / `demo1234`
- **Discount code:** `WELCOME10`

### Try the quote engine

Upload any `.stl` on `/quote`. Binary and ASCII STL volumes are computed
exactly; you'll see weight, print time, support requirement and a full NZD
cost breakdown, which can be converted straight into a tracked order.

## Project layout

```
printforge/
├─ app/
│  ├─ api/            # Node backend: auth, quote, orders, products, reviews,
│  │                  #   custom-requests, printers, checkout, ai, admin metrics
│  ├─ admin/          # Manufacturing dashboard (guarded)
│  ├─ quote/          # Instant quote
│  ├─ products/       # Store + product detail
│  ├─ orders/[id]/    # Live order tracking
│  └─ ...             # materials, custom-request, ai-assistant, auth, dashboard
├─ lib/
│  ├─ geometry.ts     # STL/OBJ mesh volume analysis
│  ├─ quote.ts        # Pricing engine
│  ├─ auth.ts         # Session auth (Clerk-compatible contract)
│  ├─ ai.ts           # AI assistant (OpenAI + rules fallback)
│  └─ integrations.ts # Stripe / shipping / S3 / email adapters
└─ prisma/
   ├─ schema.prisma   # Full data model
   └─ seed.ts         # Seed data
```

## Integration status

Everything below works with mocks out of the box; add the env var to go live:

- **Clerk** (`CLERK_SECRET_KEY`) — Google/Apple social login.
- **Stripe** (`STRIPE_SECRET_KEY`) — real payments incl. Apple/Google Pay.
- **OpenAI** (`OPENAI_API_KEY`) — LLM-powered design assistant.
- **AWS S3** (`AWS_S3_BUCKET` + keys) — durable file storage.
- **NZ Post / Aramex NZ / CourierPost** (`*_API_KEY`) — live labels & tracking.

## Roadmap (from the brief)

AI-generated 3D models · mobile app · multi-vendor marketplace · CNC / laser /
resin services · print-farm automation. The schema and adapter boundaries are
structured to accommodate these.
