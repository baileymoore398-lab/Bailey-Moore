import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Create account — RouteForge",
  description:
    "Create a free RouteForge account and start analysing your orienteering and endurance races.",
  alternates: { canonical: "/register" },
};

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return children;
}
