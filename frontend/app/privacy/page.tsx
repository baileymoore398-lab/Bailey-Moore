import type { Metadata } from "next";
import { LegalLayout, LegalSection } from "@/components/LegalLayout";
import { CONTACT_EMAIL, SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: `How ${SITE_NAME} collects, uses, shares, and protects your personal data.`,
};

type Block = { p?: string; list?: string[] };
type Section = { heading: string; blocks: Block[] };

const SECTIONS: Section[] = [
  {
    heading: "1. Introduction",
    blocks: [
      {
        p: `${SITE_NAME} ("RouteForge", "we", "us", or "our") provides AI-assisted race-analysis tools for orienteering and related sports. This Privacy Policy explains what personal data we collect, why we collect it, how we use and share it, and the rights you have over it. It applies to our website, applications, and related services (together, the "Service").`,
      },
      {
        p: `We are the controller of the personal data described in this policy. If you have any questions, or wish to exercise your rights, contact us using the details in the "Contact us" section below. Please read this policy together with our Terms of Service.`,
      },
    ],
  },
  {
    heading: "2. Information we collect",
    blocks: [
      { p: "We collect the following categories of personal data, and only what we need to provide and improve the Service:" },
      {
        list: [
          "Account information: your email address, a securely hashed password, and (optionally) your name and athlete profile details such as display name, handle, country, and biography.",
          "Race and training content you upload: map photographs, GPS tracks (for example GPX, FIT, or TCX files), split times, and any race, event, club, or training details you choose to add.",
          "Derived analysis data: performance metrics, leg splits, route and mistake analysis, scores, and AI-generated coaching reports produced from the content you upload.",
          "Payment information: if you purchase a paid plan, our payment processor collects and processes your payment details. We do not receive or store your full card number; we receive limited information such as your subscription status and the last four digits of your card.",
          "Communications: the contents of messages you send us (for example via our contact form or by email) and our responses.",
          "Technical and usage data: information collected automatically when you use the Service, such as your IP address, device and browser type, pages viewed, and timestamps, together with diagnostic logs used to operate and secure the Service.",
        ],
      },
    ],
  },
  {
    heading: "3. How we use your information",
    blocks: [
      { p: "We use personal data for the following purposes:" },
      {
        list: [
          "To provide the Service — creating and managing your account, processing your uploads, and generating your race analysis and coaching reports.",
          "To operate paid plans — taking payment, managing subscriptions, and enforcing plan limits.",
          "To communicate with you — sending account, security, and service-related messages (such as password resets), and responding to your enquiries.",
          "To maintain, secure, debug, and improve the Service, including monitoring for fraud, abuse, and technical faults.",
          "To comply with legal obligations and to establish, exercise, or defend legal claims.",
        ],
      },
      { p: "We do not sell your personal data, and we do not use it for third-party advertising." },
    ],
  },
  {
    heading: "4. Legal bases for processing",
    blocks: [
      {
        p: "Where the EU or UK General Data Protection Regulation (GDPR) applies, we rely on the following legal bases:",
      },
      {
        list: [
          "Performance of a contract — to provide the Service you have requested and to administer your account and subscription.",
          "Legitimate interests — to secure, maintain, and improve the Service, and to communicate with you, provided these interests are not overridden by your rights.",
          "Consent — where we ask for it, for example for certain optional communications; you may withdraw consent at any time.",
          "Legal obligation — where we must process data to comply with applicable law.",
        ],
      },
      {
        p: "If you are in New Zealand, we handle personal information in accordance with the Privacy Act 2020 and its Information Privacy Principles.",
      },
    ],
  },
  {
    heading: "5. AI processing",
    blocks: [
      {
        p: "To generate coaching reports and analysis, race metrics and related summary data may be processed by third-party artificial-intelligence providers acting on our behalf. We share only the data needed to produce your analysis, and we do not authorise these providers to use your data to train their models other than as necessary to deliver the requested output. AI-generated content may contain errors and is provided for informational purposes only.",
      },
    ],
  },
  {
    heading: "6. How we share your information",
    blocks: [
      { p: "We share personal data only as described below:" },
      {
        list: [
          "Service providers (processors): trusted vendors who process data on our behalf under contract, including hosting and infrastructure providers, our AI processing provider, our payment processor, and our email delivery provider. They may only use the data to provide services to us.",
          "Other users: information you choose to make public or share (for example a public athlete profile, a shared analysis link, or an event leaderboard) will be visible to others as you direct.",
          "Legal and safety: where required by law, regulation, legal process, or governmental request, or to protect the rights, property, or safety of RouteForge, our users, or the public.",
          "Business transfers: in connection with a merger, acquisition, financing, or sale of assets, in which case we will take reasonable steps to ensure your data remains protected.",
        ],
      },
    ],
  },
  {
    heading: "7. International data transfers",
    blocks: [
      {
        p: "We and our service providers may process and store personal data in countries other than your own, including the United States. Where we transfer data internationally, we take steps to ensure an appropriate level of protection, such as relying on recognised adequacy decisions or standard contractual clauses where required by applicable law.",
      },
    ],
  },
  {
    heading: "8. Data retention",
    blocks: [
      {
        p: "We retain your personal data for as long as your account is active or as needed to provide the Service. When you delete your account, we delete or anonymise your personal data and uploaded content within a reasonable period, except where we are required to retain certain information to comply with legal, tax, accounting, or security obligations, or where data persists temporarily in routine backups.",
      },
    ],
  },
  {
    heading: "9. Security",
    blocks: [
      {
        p: "We use appropriate technical and organisational measures to protect personal data, including encryption of data in transit, hashing of passwords, and access controls. No method of transmission or storage is completely secure, so we cannot guarantee absolute security; however, we work to protect your data and to address any security incidents promptly and in accordance with applicable law.",
      },
    ],
  },
  {
    heading: "10. Your rights",
    blocks: [
      {
        p: "Depending on where you live, you may have some or all of the following rights in relation to your personal data:",
      },
      {
        list: [
          "Access — to obtain a copy of the personal data we hold about you. You can export your data directly from your account settings.",
          "Rectification — to correct inaccurate or incomplete data.",
          "Erasure — to have your data deleted. You can delete your account and associated data from your account settings.",
          "Restriction and objection — to limit or object to certain processing.",
          "Portability — to receive your data in a structured, commonly used, machine-readable format.",
          "Withdraw consent — where processing is based on consent, at any time, without affecting prior processing.",
          "Complaint — to lodge a complaint with your local data protection authority (in New Zealand, the Office of the Privacy Commissioner).",
        ],
      },
      {
        p: "To exercise any of these rights, contact us using the details below. We will respond within the timeframe required by applicable law and may need to verify your identity first.",
      },
    ],
  },
  {
    heading: "11. Cookies and similar technologies",
    blocks: [
      {
        p: "We use a small amount of browser storage (such as cookies or local storage) that is strictly necessary to operate the Service — for example, to keep you signed in and remember your preferences. We do not use advertising or cross-site tracking cookies. You can control storage through your browser settings, but disabling necessary storage may affect how the Service works.",
      },
    ],
  },
  {
    heading: "12. Children's privacy",
    blocks: [
      {
        p: "The Service is not directed to children under the age of 13 (or the minimum age required in your country), and we do not knowingly collect personal data from them. If you believe a child has provided us with personal data, please contact us and we will take steps to delete it.",
      },
    ],
  },
  {
    heading: "13. Third-party links",
    blocks: [
      {
        p: "The Service may contain links to third-party websites or services that we do not control. This policy does not apply to those third parties, and we encourage you to review their privacy policies.",
      },
    ],
  },
  {
    heading: "14. Changes to this policy",
    blocks: [
      {
        p: "We may update this Privacy Policy from time to time. When we make material changes, we will update the date at the top of this page and, where appropriate, provide additional notice. Your continued use of the Service after changes take effect constitutes acceptance of the updated policy.",
      },
    ],
  },
];

export default function PrivacyPage() {
  return (
    <LegalLayout title="Privacy Policy" updated="30 June 2026">
      {SECTIONS.map((s) => (
        <LegalSection key={s.heading} heading={s.heading}>
          {s.blocks.map((b, i) =>
            b.list ? (
              <ul key={i} className="list-disc space-y-1.5 pl-5">
                {b.list.map((item, j) => (
                  <li key={j}>{item}</li>
                ))}
              </ul>
            ) : (
              <p key={i}>{b.p}</p>
            )
          )}
        </LegalSection>
      ))}

      <LegalSection heading="15. Contact us">
        <p>
          If you have questions about this Privacy Policy, or wish to exercise
          your rights, contact us at{" "}
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="font-semibold text-accent hover:underline"
          >
            {CONTACT_EMAIL}
          </a>
          . {SITE_NAME} is operated by Bailey Moore.
        </p>
      </LegalSection>
    </LegalLayout>
  );
}
