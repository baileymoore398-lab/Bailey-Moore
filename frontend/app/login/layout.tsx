import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign in — RouteForge",
  description: "Sign in to your RouteForge account to analyse your races.",
  alternates: { canonical: "/login" },
  robots: { index: false },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
