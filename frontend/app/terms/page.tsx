import type { Metadata } from "next";
import { LegalLayout, LegalSection } from "@/components/LegalLayout";
import { CONTACT_EMAIL, SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: `The terms governing your use of ${SITE_NAME}.`,
};

export default function TermsPage() {
  return (
    <LegalLayout title="Terms of Service" updated="30 June 2026">
      <p>
        These Terms of Service (&ldquo;Terms&rdquo;) govern your use of{" "}
        {SITE_NAME}. By creating an account or using the service, you agree to
        these Terms. If you do not agree, please do not use {SITE_NAME}.
      </p>

      <LegalSection heading="1. The service">
        <p>
          {SITE_NAME} provides AI-assisted race analysis for orienteering and
          related sports — including map/GPS processing, performance metrics,
          mistake detection, replay, and coaching reports. We may add, change,
          or remove features over time.
        </p>
      </LegalSection>

      <LegalSection heading="2. Your account">
        <ul className="list-disc space-y-1 pl-5">
          <li>You must provide accurate information when registering.</li>
          <li>
            You are responsible for keeping your password secure and for
            activity under your account.
          </li>
          <li>You must be old enough to form a binding contract in your country.</li>
        </ul>
      </LegalSection>

      <LegalSection heading="3. Acceptable use">
        <p>You agree not to:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Upload content you do not have the right to use.</li>
          <li>
            Attempt to disrupt, reverse-engineer, or gain unauthorised access to
            the service.
          </li>
          <li>Use the service for unlawful purposes or to harm others.</li>
        </ul>
      </LegalSection>

      <LegalSection heading="4. Your content">
        <p>
          You retain ownership of the maps, GPS tracks, and other content you
          upload. You grant {SITE_NAME} a limited licence to store and process
          that content solely to provide the service to you (for example, to
          generate your analysis). You can delete your content and account at any
          time.
        </p>
      </LegalSection>

      <LegalSection heading="5. AI analysis disclaimer">
        <p>
          {SITE_NAME} produces automated analysis and coaching suggestions for
          informational purposes only. It may contain errors and is not a
          substitute for professional coaching, medical, or safety advice.
          Always use your own judgement; we do not guarantee the accuracy of any
          analysis or that following it will improve your results.
        </p>
      </LegalSection>

      <LegalSection heading="6. Payments & subscriptions">
        <ul className="list-disc space-y-1 pl-5">
          <li>Paid plans and their features are described on our pricing page.</li>
          <li>
            Subscriptions renew automatically until cancelled; you can cancel at
            any time and retain access until the end of the current period.
          </li>
          <li>
            Except where required by law, payments are non-refundable.
          </li>
        </ul>
      </LegalSection>

      <LegalSection heading="7. Termination">
        <p>
          You may stop using {SITE_NAME} and delete your account at any time. We
          may suspend or terminate accounts that violate these Terms or that we
          reasonably believe pose a risk to the service or other users.
        </p>
      </LegalSection>

      <LegalSection heading="8. Disclaimers">
        <p>
          The service is provided &ldquo;as is&rdquo; and &ldquo;as
          available&rdquo;, without warranties of any kind. We do not warrant
          that the service will be uninterrupted, error-free, or secure.
        </p>
      </LegalSection>

      <LegalSection heading="9. Limitation of liability">
        <p>
          To the maximum extent permitted by law, {SITE_NAME} and its creator
          will not be liable for any indirect, incidental, or consequential
          damages, or for any loss of data, arising from your use of the
          service.
        </p>
      </LegalSection>

      <LegalSection heading="10. Changes to these Terms">
        <p>
          We may update these Terms from time to time. Continued use of the
          service after changes take effect constitutes acceptance of the
          updated Terms.
        </p>
      </LegalSection>

      <LegalSection heading="11. Contact">
        <p>
          Questions about these Terms? Email{" "}
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
