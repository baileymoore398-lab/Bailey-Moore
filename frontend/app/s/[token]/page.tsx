import type { Metadata } from "next";
import { API_BASE } from "@/lib/api";
import { SharePage } from "@/components/SharePage";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: { token: string };
}): Promise<Metadata> {
  const { token } = params;
  const ogImage = `${API_BASE}/api/v1/share/${token}/og-image.svg`;
  const title = "RouteForge — Shared analysis";
  const description =
    "View this shared race analysis or event leaderboard on RouteForge.";

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      images: [ogImage],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
    },
  };
}

export default function SharedPage({
  params,
}: {
  params: { token: string };
}) {
  return <SharePage token={params.token} />;
}
