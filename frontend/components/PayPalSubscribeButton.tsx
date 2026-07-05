"use client";

import * as React from "react";
import { confirmPaypal } from "@/lib/api";
import { isAuthenticated } from "@/lib/auth";

/* Load the PayPal JS SDK once per (client-id, env), shared across buttons. */
let sdkPromise: Promise<unknown> | null = null;
function loadPaypalSdk(clientId: string, env: string): Promise<unknown> {
  if (typeof window === "undefined") return Promise.reject();
  const w = window as unknown as { paypal?: unknown };
  if (w.paypal) return Promise.resolve(w.paypal);
  if (sdkPromise) return sdkPromise;
  sdkPromise = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    const params = new URLSearchParams({
      "client-id": clientId,
      vault: "true",
      intent: "subscription",
      currency: "USD",
    });
    // Sandbox uses the same host; the client-id determines the environment.
    s.src = `https://www.paypal.com/sdk/js?${params.toString()}`;
    s.async = true;
    s.onload = () => resolve((window as unknown as { paypal?: unknown }).paypal);
    s.onerror = () => reject(new Error("Failed to load PayPal"));
    document.body.appendChild(s);
  });
  return sdkPromise;
}

/**
 * Renders official PayPal subscription buttons for one tier. On approval it
 * verifies the subscription server-side, then reports success.
 */
export function PayPalSubscribeButton({
  clientId,
  env,
  planId,
  tier,
  onSuccess,
}: {
  clientId: string;
  env: string;
  planId: string;
  tier: string;
  onSuccess: () => void;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [state, setState] = React.useState<"idle" | "loading" | "ready" | "error" | "confirming">(
    "loading"
  );
  const [msg, setMsg] = React.useState<string | null>(null);
  const authed = typeof window !== "undefined" && isAuthenticated();

  React.useEffect(() => {
    if (!authed) {
      setState("idle");
      return;
    }
    let cancelled = false;
    loadPaypalSdk(clientId, env)
      .then((paypal) => {
        if (cancelled || !ref.current) return;
        const pp = paypal as {
          Buttons: (opts: unknown) => { render: (el: HTMLElement) => void };
        };
        ref.current.innerHTML = "";
        pp.Buttons({
          style: { shape: "pill", color: "gold", layout: "vertical", label: "subscribe" },
          createSubscription: (_data: unknown, actions: { subscription: { create: (o: unknown) => Promise<string> } }) =>
            actions.subscription.create({ plan_id: planId }),
          onApprove: async (data: { subscriptionID?: string }) => {
            if (!data.subscriptionID) return;
            setState("confirming");
            try {
              await confirmPaypal(data.subscriptionID, tier);
              onSuccess();
            } catch (e) {
              setMsg((e as Error).message || "Couldn't confirm subscription.");
              setState("error");
            }
          },
          onError: () => {
            setMsg("PayPal had a problem — please try again.");
            setState("error");
          },
        }).render(ref.current);
        setState("ready");
      })
      .catch(() => {
        setMsg("Couldn't load PayPal.");
        setState("error");
      });
    return () => {
      cancelled = true;
    };
  }, [authed, clientId, env, planId, tier, onSuccess]);

  if (!authed) {
    return (
      <a
        href="/login"
        className="block w-full rounded-lg border border-border px-4 py-2.5 text-center text-sm font-semibold text-white transition hover:border-accent"
      >
        Sign in to subscribe
      </a>
    );
  }

  return (
    <div>
      {state === "loading" && (
        <div className="h-11 w-full animate-pulse rounded-lg bg-bg-elevated" />
      )}
      {state === "confirming" && (
        <p className="text-center text-xs text-muted">Confirming your subscription…</p>
      )}
      <div ref={ref} className={state === "ready" || state === "confirming" ? "" : "hidden"} />
      {state === "error" && msg && (
        <p className="mt-1 text-center text-xs text-red-300">{msg}</p>
      )}
    </div>
  );
}
