import type { Metadata } from "next";
import { LegalLayout, LegalSection } from "@/components/LegalLayout";
import { CONTACT_EMAIL, SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: `How ${SITE_NAME} collects, uses, and protects your data.`,
};

export default function PrivacyPage() {
  return (
    <LegalLayout title="Privacy Policy" updated="30 June 2026">
      <p>
        This Privacy Policy explains how {SITE_NAME} (&ldquo;we&rdquo;,
        &ldquo;us&rdquo;) collects, uses, and protects your information when you
        use our website and services. By using {SITE_NAME}, you agree to the
        practices described here.
      </p>

      <LegalSection heading="1. Information we collect">
        <p>We collect the following, only as needed to provide the service:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Account details:</strong> your email address and a securely
            hashed password when you register.
          </li>
          <li>
            <strong>Race data you upload:</strong> map photos, GPS tracks (GPX,
            FIT, TCX), split times, and any race or training details you add.
          </li>
          <li>
            <strong>Usage data:</strong> basic technical information such as
            pages visited and approximate device/browser type, used to keep the
            service running and improve it.
          </li>
        </ul>
      </LegalSection>

      <LegalSection heading="2. How we use your information">
        <ul className="list-disc space-y-1 pl-5">
          <li>To analyse your races and generate performance reports.</li>
          <li>To create and secure your account.</li>
          <li>To process payments for paid plans.</li>
          <li>To respond to messages you send us.</li>
          <li>To maintain, debug, and improve the service.</li>
        </ul>
        <p>We do not sell your personal data to anyone.</p>
      </LegalSection>

      <LegalSection heading="3. Third-party services">
        <p>
          We rely on trusted providers to operate {SITE_NAME}. Your data may be
          processed by:
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Hosting &amp; infrastructure</strong> (e.g. Vercel, Railway)
            to run the website and store your data.
          </li>
          <li>
            <strong>AI processing</strong> to generate coaching reports. Race
            metrics may be sent to an AI provider to produce your analysis.
          </li>
          <li>
            <strong>Payments</strong> processed by a third-party payment
            provider; we never store your full card details.
          </li>
          <li>
            <strong>Contact form</strong> delivery, which forwards your message
            to us by email.
          </li>
        </ul>
      </LegalSection>

      <LegalSection heading="4. Cookies & local storage">
        <p>
          We use minimal browser storage to keep you signed in and remember
          preferences. We do not use advertising trackers.
        </p>
      </LegalSection>

      <LegalSection heading="5. Your rights (including GDPR)">
        <p>You can, at any time:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Access &amp; export</strong> a copy of your data from your
            account settings.
          </li>
          <li>
            <strong>Delete</strong> your account and associated data from your
            account settings.
          </li>
          <li>Request correction of inaccurate information.</li>
        </ul>
        <p>
          If you are in the EU/UK, you have rights under the GDPR, including the
          right to access, rectify, erase, and port your data. Contact us to
          exercise any of these rights.
        </p>
      </LegalSection>

      <LegalSection heading="6. Data retention">
        <p>
          We keep your data for as long as your account is active. When you
          delete your account, we remove your personal data and uploads, except
          where we must retain limited records for legal or accounting reasons.
        </p>
      </LegalSection>

      <LegalSection heading="7. Security">
        <p>
          Passwords are stored hashed, and data is transmitted over encrypted
          connections. No online service can be completely secure, but we take
          reasonable measures to protect your information.
        </p>
      </LegalSection>

      <LegalSection heading="8. Children">
        <p>
          {SITE_NAME} is not directed at children under 13 (or the minimum age
          in your country), and we do not knowingly collect their data.
        </p>
      </LegalSection>

      <LegalSection heading="9. Changes to this policy">
        <p>
          We may update this policy from time to time. Material changes will be
          reflected by the &ldquo;Last updated&rdquo; date above.
        </p>
      </LegalSection>

      <LegalSection heading="10. Contact">
        <p>
          Questions about your privacy? Email us at{" "}
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="font-semibold text-accent hover:underline"
          >
            {CONTACT_EMAIL}
          </a>
          .
        </p>
      </LegalSection>

      <p className="border-t border-border/60 pt-6 text-xs text-muted">
        This document is provided as general information and is not legal
        advice. Please review and adapt it to your jurisdiction before relying
        on it.
      </p>
    </LegalLayout>
  );
}
