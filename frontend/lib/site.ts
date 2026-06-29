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
