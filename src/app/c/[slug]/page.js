import { notFound } from "next/navigation";
import CreatorView from "@/components/CreatorView";
import { getCreatorBySlug, listMedia } from "@/lib/creators";
import { creatorCard, mediaItem } from "@/lib/cards";
import { getViewer } from "@/lib/session";
import { SITE_NAME } from "@/lib/site";
import { VIP_PRICE_LABEL } from "@/lib/vip";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const creator = await getCreatorBySlug(slug);
  return { title: creator ? `${creator.name} – ${SITE_NAME}` : `Creator not found – ${SITE_NAME}` };
}

export default async function CreatorPage({ params }) {
  const { slug } = await params;
  const row = await getCreatorBySlug(slug);
  if (!row) notFound();

  const viewer = await getViewer();
  const creator = await creatorCard(row, viewer);
  const media = await listMedia(row.id);
  const items = await Promise.all(media.map((m) => mediaItem(m, creator.locked)));

  return (
    <CreatorView
      viewer={viewer}
      creator={creator}
      items={items}
      canManage={Boolean(viewer?.isAdmin)}
      trackView={!viewer?.isAdmin}
      priceLabel={VIP_PRICE_LABEL}
    />
  );
}
