/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Emit a self-contained server bundle so the Docker runner stage
  // only needs .next/standalone + .next/static (no node_modules copy).
  output: "standalone",
  images: {
    remotePatterns: [{ protocol: "http", hostname: "**" }, { protocol: "https", hostname: "**" }],
  },
};

export default nextConfig;
