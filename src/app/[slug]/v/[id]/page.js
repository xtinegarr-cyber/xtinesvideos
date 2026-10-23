// One video or photo on its own page: yoursite.com/creator_name/v/123.
// Free creators' videos can be shared from here (for free VIP on Reddit).
import { notFound, permanentRedirect } from "next/navigation";
import VideoView from "@/components/VideoView";
import { getMediaWithCreator } from "@/lib/creators";
import { mediaItem } from "@/lib/cards";
import { getAccess } from "@/lib/session";
import { SITE_NAME } from "@/lib/site";
import { fileUrl } from "@/lib/storage";
import { VIP_PRICE_LABEL } from "@/lib/vip";
import { PASS_MINUTES } from "@/lib/vip-pass";

export const dynamic = "force-dynamic";

async function find(id) {
  return /^\d{1,15}$/.test(String(id)) ? getMediaWithCreator(Number(id)) : null;
}

export async function generateMetadata({ params }) {
  const { id } = await params;
  const media = await find(id);
  if (!media) return { title: `Not found | ${SITE_NAME}` };
  const free = media.creator_tier === "free";
  const what = media.kind === "video" ? "video" : "photo";
  const title = `${media.creator_name} ${what} | ${SITE_NAME}`;
  const description = free
    ? `Watch this ${what} from ${media.creator_name} for free on ${SITE_NAME}.`
    : `${media.creator_name} is a VIP creator. Get VIP to see this ${what} on ${SITE_NAME}.`;
  const path = `/${media.creator_slug}/v/${media.id}`;
  // Link previews (Reddit, Discord) show the thumbnail; VIP ones stay blurred.
  const image = await fileUrl(free ? media.thumb_key : media.thumb_blur_key);
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      title,
      description,
      url: path,
      siteName: SITE_NAME,
      type: media.kind === "video" ? "video.other" : "article",
      images: image ? [{ url: image, width: 640 }] : undefined,
    },
    twitter: { card: "summary_large_image", title, description, images: image ? [image] : undefined },
  };
}

export default async function MediaPage({ params }) {
  const { slug, id } = await params;
  const media = await find(id);
  if (!media) notFound();
  // Old or mistyped creator names in the link: send to the right address.
  if (slug !== media.creator_slug) permanentRedirect(`/${media.creator_slug}/v/${media.id}`);

  const access = await getAccess();
  const locked = media.creator_tier === "vip" && !access.isVip;
  const item = await mediaItem(media, locked);

  return (
    <VideoView
      viewer={access.viewer}
      isVip={access.isVip}
      creator={{ slug: media.creator_slug, name: media.creator_name, tier: media.creator_tier }}
      item={{ ...item, createdAt: new Date(media.created_at).toISOString() }}
      locked={locked}
      trackView={!access.viewer?.isAdmin}
      rewardMinutes={PASS_MINUTES}
      priceLabel={VIP_PRICE_LABEL}
    />
  );
}
