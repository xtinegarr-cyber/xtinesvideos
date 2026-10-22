// Creator profiles live at the top level: yoursite.com/gamercool_123
import { notFound, permanentRedirect } from "next/navigation";
import CreatorView from "@/components/CreatorView";
import { getCreatorBySlug, listMedia } from "@/lib/creators";
import { creatorCard, mediaItem } from "@/lib/cards";
import { SLUG_PATTERN } from "@/lib/format";
import { getViewer } from "@/lib/session";
import { SITE_NAME } from "@/lib/site";
import { VIP_PRICE_LABEL } from "@/lib/vip";

export const dynamic = "force-dynamic";

function findCreator(slug) {
  return SLUG_PATTERN.test(slug) ? getCreatorBySlug(slug) : null;
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const creator = await findCreator(String(slug).toLowerCase());
  if (!creator) return { title: `Creator not found | ${SITE_NAME}` };

  // Search results show "gamercool 123 - Videos | XTINE’S VIDEOS"
  const title = `${creator.name} - Videos | ${SITE_NAME}`;
  const description =
    creator.tier === "vip"
      ? `Watch ${creator.name}’s videos and photos with VIP on ${SITE_NAME}.`
      : `Watch ${creator.name}’s videos and photos for free on ${SITE_NAME}.`;
  return {
    title,
    description,
    alternates: { canonical: `/${creator.slug}` },
    openGraph: { title, description, url: `/${creator.slug}`, siteName: SITE_NAME, type: "profile" },
  };
}

export default async function CreatorPage({ params, searchParams }) {
  const { slug } = await params;
  const { tab } = await searchParams;
  // /JadeGamer -> /jadegamer, so every creator has exactly one address.
  const lower = String(slug).toLowerCase();
  if (lower !== slug && SLUG_PATTERN.test(lower)) permanentRedirect(`/${lower}`);

  const row = await findCreator(slug);
  if (!row) notFound();

  const viewer = await getViewer();
  const creator = await creatorCard(row, viewer);
  const media = await listMedia(row.id);
  const counts = {
    videos: media.filter((m) => m.kind === "video").length,
    photos: media.filter((m) => m.kind === "image").length,
  };
  // Visitors without VIP get no links to a VIP creator's files at all.
  const items = creator.locked ? [] : await Promise.all(media.map((m) => mediaItem(m, false)));

  return (
    <CreatorView
      viewer={viewer}
      creator={creator}
      items={items}
      counts={counts}
      canManage={Boolean(viewer?.isAdmin)}
      trackView={!viewer?.isAdmin}
      priceLabel={VIP_PRICE_LABEL}
      initialTab={tab === "photos" ? "photos" : "videos"}
    />
  );
}
