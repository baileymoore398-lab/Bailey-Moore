"use client";

import { useRouter } from "next/navigation";
import { enableDemo } from "@/lib/demo";

/**
 * Opt-in "View demo" button. Turns on demo mode and sends the user to the
 * dashboard, where every section then renders the bundled sample data so they
 * can explore the product without a backend or an account.
 */
export function DemoButton({
  className,
  label = "View demo",
  to = "/dashboard",
}: {
  className?: string;
  label?: string;
  to?: string;
}) {
  const router = useRouter();
  return (
    <button
      onClick={() => {
        enableDemo();
        router.push(to);
        // Reload so server/client data hooks re-read demo mode immediately.
        setTimeout(() => window.location.reload(), 50);
      }}
      className={
        className ??
        "rounded-lg border border-border px-5 py-3 text-sm font-semibold text-white transition hover:border-accent hover:text-accent"
      }
    >
      {label}
    </button>
  );
}
