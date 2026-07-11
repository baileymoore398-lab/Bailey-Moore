/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Emit a self-contained server bundle so the Docker runner stage
  // only needs .next/standalone + .next/static (no node_modules copy).
  output: "standalone",
  images: {
    // Restrict to our own domain (the app uses inline SVG, so this is mostly
    // future-proofing) rather than allowing any host over http/https.
    remotePatterns: [
      { protocol: "https", hostname: "routeforge.world" },
      { protocol: "https", hostname: "*.routeforge.world" },
    ],
  },
};

export default nextConfig;
