"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CONTACT_EMAIL, FORMSPREE_URL } from "@/lib/site";

const inputCls =
  "w-full rounded-lg border border-border bg-bg-soft px-3 py-2 text-sm outline-none focus:border-accent";

export default function ContactPage() {
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [subject, setSubject] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [status, setStatus] = React.useState<
    "idle" | "sending" | "sent" | "mailto" | "error"
  >("idle");
  const [copied, setCopied] = React.useState(false);

  function openMailto() {
    const subj = subject.trim() || `RouteForge enquiry from ${name || "a user"}`;
    const body =
      `${message}\n\n` +
      `—\nFrom: ${name || "(no name)"}` +
      (email ? `\nReply to: ${email}` : "");
    window.location.href =
      `mailto:${CONTACT_EMAIL}` +
      `?subject=${encodeURIComponent(subj)}` +
      `&body=${encodeURIComponent(body)}`;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // No endpoint configured → fall back to opening the email client.
    if (!FORMSPREE_URL) {
      openMailto();
      setStatus("mailto");
      return;
    }

    setStatus("sending");
    try {
      const res = await fetch(FORMSPREE_URL, {
        method: "POST",
        headers: { Accept: "application/json" },
        body: (() => {
          const fd = new FormData();
          fd.append("name", name);
          if (email) {
            fd.append("email", email);
            fd.append("_replyto", email);
          }
          fd.append(
            "_subject",
            subject.trim() || `RouteForge enquiry from ${name || "a user"}`
          );
          fd.append("message", message);
          return fd;
        })(),
      });
      if (!res.ok) throw new Error(`Form error ${res.status}`);
      setStatus("sent");
      setName("");
      setEmail("");
      setSubject("");
      setMessage("");
    } catch {
      // Network/endpoint failure → let them send via their email client.
      openMailto();
      setStatus("error");
    }
  }

  const sending = status === "sending";

  async function copyEmail() {
    try {
      await navigator.clipboard.writeText(CONTACT_EMAIL);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable — the address is shown anyway */
    }
  }

  return (
    <div className="container-page grid min-h-[80vh] place-items-center py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-lg"
      >
        <Card className="p-8">
          <h1 className="text-2xl font-black tracking-tight">Get in touch</h1>
          <p className="mt-1 text-sm text-muted">
            Questions, feedback, or a bug to report? Send us a message and
            we&apos;ll get back to you.
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-muted">
                  Name
                </label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  className={inputCls}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-muted">
                  Your email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className={inputCls}
                />
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-muted">
                Subject
              </label>
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="What's this about?"
                className={inputCls}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-muted">
                Message
              </label>
              <textarea
                required
                rows={5}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Write your message…"
                className={inputCls + " resize-none"}
              />
            </div>

            {status === "sent" && (
              <div className="rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-sm text-accent">
                Thanks — your message has been sent. We&apos;ll get back to you
                soon.
              </div>
            )}
            {(status === "mailto" || status === "error") && (
              <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
                {status === "error"
                  ? "We couldn't send the form just now, so your email app should have opened instead. "
                  : "Your email app should have opened with the message ready to send. "}
                If it didn&apos;t, email us directly at{" "}
                <a
                  href={`mailto:${CONTACT_EMAIL}`}
                  className="font-semibold underline"
                >
                  {CONTACT_EMAIL}
                </a>
                .
              </div>
            )}

            <Button
              type="submit"
              variant="accent"
              size="lg"
              className="w-full"
              disabled={!message.trim() || sending}
            >
              {sending ? "Sending…" : "Send message"}
            </Button>
          </form>

          <div className="mt-6 flex flex-col items-center gap-2 border-t border-border/60 pt-5 text-center text-sm text-muted">
            <span>Or reach us directly:</span>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="font-semibold text-accent hover:underline"
              >
                {CONTACT_EMAIL}
              </a>
              <button
                type="button"
                onClick={copyEmail}
                className="rounded-md border border-border px-2 py-1 text-xs font-medium text-muted transition hover:text-white"
              >
                {copied ? "Copied ✓" : "Copy"}
              </button>
            </div>
          </div>
        </Card>
      </motion.div>
    </div>
  );
}
