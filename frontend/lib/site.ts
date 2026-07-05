// Site-wide config constants.

// Donation / "Support me" link. Change this to your own page — e.g.
//   Buy Me a Coffee : https://www.buymeacoffee.com/<handle>
//   Ko-fi           : https://ko-fi.com/<handle>
//   GitHub Sponsors : https://github.com/sponsors/<username>
//   PayPal          : https://paypal.me/<handle>
// You can override it at build time without editing code by setting
// NEXT_PUBLIC_DONATE_URL in your Vercel environment variables.
export const DONATE_URL =
  process.env.NEXT_PUBLIC_DONATE_URL || "https://ko-fi.com/routeforge";

// Address the Contact form sends to (and shown as a direct mailto fallback).
export const CONTACT_EMAIL =
  process.env.NEXT_PUBLIC_CONTACT_EMAIL || "route.forge.official@gmail.com";

// Formspree endpoint the contact form POSTs to. When set, messages are
// delivered without opening the visitor's email client. Override with
// NEXT_PUBLIC_FORMSPREE_URL. Set to "" to fall back to the mailto flow.
export const FORMSPREE_URL =
  process.env.NEXT_PUBLIC_FORMSPREE_URL ?? "https://formspree.io/f/mwvdqvzl";

// Canonical public URL of the site — used for SEO (sitemap, robots, Open
// Graph). Set NEXT_PUBLIC_SITE_URL in Vercel to your real domain so social
// previews and search engines point at the right place.
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://routeforge.world"
).replace(/\/$/, "");

// Display name used in legal copy.
export const SITE_NAME = "RouteForge";
