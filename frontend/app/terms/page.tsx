import type { Metadata } from "next";
import { LegalLayout, LegalSection } from "@/components/LegalLayout";
import { CONTACT_EMAIL, SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: `The terms and conditions governing your use of ${SITE_NAME}.`,
};

// Governing jurisdiction for these Terms. Change this if RouteForge is operated
// from, or you wish disputes to be governed by, a different country.
const JURISDICTION = "New Zealand";

type Block = { p?: string; list?: string[] };
type Section = { heading: string; blocks: Block[] };

const SECTIONS: Section[] = [
  {
    heading: "1. Agreement to these Terms",
    blocks: [
      {
        p: `These Terms of Service ("Terms") form a binding agreement between you and ${SITE_NAME} ("RouteForge", "we", "us", or "our") and govern your access to and use of our website, applications, and related services (together, the "Service"). By creating an account or otherwise using the Service, you agree to these Terms and to our Privacy Policy. If you do not agree, do not use the Service.`,
      },
    ],
  },
  {
    heading: "2. Definitions",
    blocks: [
      {
        list: [
          "\"Account\" means the account you create to access the Service.",
          "\"Content\" means any data, files, map images, GPS tracks, split times, text, or other materials you upload to or create with the Service.",
          "\"Plan\" means a free or paid tier of access to the Service, as described on our pricing page.",
        ],
      },
    ],
  },
  {
    heading: "3. Eligibility and accounts",
    blocks: [
      {
        list: [
          "You must be at least 13 years old (or the minimum age required in your country) and able to form a binding contract to use the Service.",
          "You agree to provide accurate, current, and complete information when registering and to keep it up to date.",
          "You are responsible for safeguarding your password and for all activity that occurs under your Account. Notify us promptly of any unauthorised use.",
          "You may not share your Account or transfer it to another person without our consent.",
        ],
      },
    ],
  },
  {
    heading: "4. The Service and licence to use it",
    blocks: [
      {
        p: "Subject to these Terms, we grant you a limited, non-exclusive, non-transferable, revocable licence to access and use the Service for your own personal or internal use. We may modify, add, or remove features of the Service at any time, and we may impose limits on certain features or restrict access to parts of the Service.",
      },
    ],
  },
  {
    heading: "5. Subscriptions, billing, and refunds",
    blocks: [
      {
        list: [
          "Paid Plans and their features and prices are described on our pricing page. Prices may change, and we will give reasonable notice of changes that affect you.",
          "Paid subscriptions are billed in advance on a recurring basis (for example monthly or annually) and renew automatically until cancelled.",
          "You can cancel at any time; cancellation takes effect at the end of the current billing period, and you retain access until then.",
          "Except where required by law, payments are non-refundable and we do not provide refunds or credits for partial periods or unused features.",
          "Prices are stated exclusive of taxes unless otherwise indicated; you are responsible for any applicable taxes.",
          "Payments are processed by a third-party payment provider, and your use of that provider is subject to its own terms and privacy policy.",
        ],
      },
    ],
  },
  {
    heading: "6. Free plans and usage limits",
    blocks: [
      {
        p: "We may offer a free Plan subject to usage limits (for example, a monthly number of analyses). We may change, limit, or discontinue any free Plan at any time. You agree not to create multiple accounts or otherwise attempt to circumvent usage limits.",
      },
    ],
  },
  {
    heading: "7. Your Content",
    blocks: [
      {
        p: "You retain all ownership rights in your Content. By uploading Content, you grant us a worldwide, non-exclusive, royalty-free licence to host, store, process, reproduce, and display that Content solely as necessary to operate and provide the Service to you (for example, to generate your analysis and, where you choose, to share it). This licence ends when you delete the relevant Content or your Account, except for copies retained in routine backups for a limited period or as required by law.",
      },
      {
        p: "You represent and warrant that you own or have the necessary rights to your Content and that your Content, and our use of it as permitted here, does not infringe the rights of any third party or violate any law.",
      },
    ],
  },
  {
    heading: "8. Acceptable use",
    blocks: [
      { p: "When using the Service, you agree not to:" },
      {
        list: [
          "Upload Content you do not have the right to use, or that is unlawful, infringing, or harmful;",
          "Attempt to access, disrupt, or interfere with the Service, its security, or other users, including by introducing malware or overloading our systems;",
          "Reverse engineer, decompile, scrape, or attempt to extract source code or data except as permitted by law;",
          "Use the Service to build or train a competing product, or resell or commercially exploit the Service without our written permission;",
          "Use the Service for any unlawful, fraudulent, or abusive purpose, or in violation of these Terms.",
        ],
      },
    ],
  },
  {
    heading: "9. Intellectual property",
    blocks: [
      {
        p: `The Service, including its software, design, text, graphics, logos, and the ${SITE_NAME} name and branding, is owned by us or our licensors and is protected by intellectual-property laws. Except for the rights expressly granted to you in these Terms, we reserve all rights in the Service. You may not use our trademarks or branding without our prior written consent.`,
      },
    ],
  },
  {
    heading: "10. AI-generated content and analysis",
    blocks: [
      {
        p: "The Service uses automated and artificial-intelligence methods to produce analysis, scores, and coaching suggestions. This output is generated automatically, may contain inaccuracies, and is provided for informational purposes only. It is not professional coaching, medical, safety, or navigational advice. You are responsible for your own training and racing decisions, and you should always exercise your own judgement and follow appropriate safety practices. We do not warrant the accuracy or completeness of any analysis or that it will improve your performance.",
      },
    ],
  },
  {
    heading: "11. Third-party services",
    blocks: [
      {
        p: "The Service may integrate with or link to third-party products and services that we do not control. We are not responsible for third-party services, and your use of them is governed by their own terms and policies.",
      },
    ],
  },
  {
    heading: "12. Privacy",
    blocks: [
      {
        p: "Our collection and use of personal data in connection with the Service is described in our Privacy Policy, which is incorporated into these Terms by reference.",
      },
    ],
  },
  {
    heading: "13. Suspension and termination",
    blocks: [
      {
        p: "You may stop using the Service and delete your Account at any time. We may suspend or terminate your access to the Service, with or without notice, if you breach these Terms, if required by law, or if we reasonably believe your use poses a risk to the Service or others. Upon termination, your right to use the Service ends. Sections that by their nature should survive termination (including ownership, disclaimers, limitation of liability, and indemnification) will survive.",
      },
    ],
  },
  {
    heading: "14. Disclaimers",
    blocks: [
      {
        p: "The Service is provided on an \"as is\" and \"as available\" basis, without warranties of any kind, whether express, implied, or statutory, including any implied warranties of merchantability, fitness for a particular purpose, and non-infringement. We do not warrant that the Service will be uninterrupted, timely, secure, or error-free, or that any data or analysis will be accurate. Nothing in these Terms excludes or limits any rights or guarantees you have under mandatory consumer-protection laws that cannot lawfully be excluded.",
      },
    ],
  },
  {
    heading: "15. Limitation of liability",
    blocks: [
      {
        p: "To the maximum extent permitted by law, RouteForge and its operator will not be liable for any indirect, incidental, special, consequential, or punitive damages, or for any loss of profits, revenue, data, or goodwill, arising out of or relating to your use of (or inability to use) the Service. To the maximum extent permitted by law, our total aggregate liability arising out of or relating to the Service will not exceed the greater of the amount you paid us for the Service in the twelve months before the event giving rise to the liability, or NZD 100.",
      },
    ],
  },
  {
    heading: "16. Indemnification",
    blocks: [
      {
        p: "You agree to indemnify and hold harmless RouteForge and its operator from and against any claims, damages, losses, and reasonable expenses (including legal fees) arising out of your Content, your use of the Service, or your breach of these Terms, to the extent permitted by law.",
      },
    ],
  },
  {
    heading: "17. Changes to the Service and these Terms",
    blocks: [
      {
        p: "We may update these Terms from time to time. When we make material changes, we will update the date at the top of this page and, where appropriate, provide additional notice. Your continued use of the Service after changes take effect constitutes acceptance of the updated Terms. If you do not agree to the changes, you must stop using the Service.",
      },
    ],
  },
  {
    heading: "18. Governing law and disputes",
    blocks: [
      {
        p: `These Terms are governed by the laws of ${JURISDICTION}, without regard to its conflict-of-laws rules, and you agree to submit to the non-exclusive jurisdiction of the courts of ${JURISDICTION} for the resolution of any dispute, except where applicable law gives you the right to bring proceedings in your own country of residence.`,
      },
    ],
  },
  {
    heading: "19. General",
    blocks: [
      {
        list: [
          "Entire agreement: these Terms and our Privacy Policy are the entire agreement between you and us regarding the Service.",
          "Severability: if any provision is held unenforceable, the remaining provisions remain in full effect.",
          "Waiver: our failure to enforce any provision is not a waiver of our right to do so later.",
          "Assignment: you may not assign these Terms without our consent; we may assign them in connection with a merger, acquisition, or sale of assets.",
          "Force majeure: we are not liable for delays or failures caused by events beyond our reasonable control.",
        ],
      },
    ],
  },
];

export default function TermsPage() {
  return (
    <LegalLayout title="Terms of Service" updated="30 June 2026">
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

      <LegalSection heading="20. Contact us">
        <p>
          Questions about these Terms? Contact us at{" "}
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
