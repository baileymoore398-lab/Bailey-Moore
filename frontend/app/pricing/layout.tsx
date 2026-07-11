import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Membership & Pricing — RouteForge",
  description:
    "RouteForge membership plans. Free while we're new — see what Pro, Team and Club unlock for orienteering and endurance athletes.",
  alternates: { canonical: "/pricing" },
};

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
