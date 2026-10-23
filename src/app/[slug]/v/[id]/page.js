// One video or photo on its own page: yoursite.com/creator_name/v/123.
// Free creators' videos can be shared from here (for free VIP on Reddit).
import { notFound, permanentRedirect } from "next/navigation";
import VideoView from "@/components/VideoView";
import { getMediaWithCreator } from "@/lib/creators";
import { mediaItem } from "@/lib/cards";
import { displayTitle, isoDuration } from "@/lib/format";
import { getAccess, siteUrl } from "@/lib/session";
import { SITE_NAME } from "@/lib/site";
import { VIP_PRICE_LABEL } from "@/lib/vip";
import { PASS_MINUTES } from "@/lib/vip-pass";

export const dynamic = "force-dynamic";

async function find(id) {
  return /^\d{1,15}$/.test(String(id)) ? getMediaWithCreator(Number(id)) : null;
}

function describe(media) {
  const what = media.kind === "video" ? "video" : "photo";
  const named = media.title ? `“${media.title}”, a ${what} from ${media.creator_name}` : `this ${what} from ${media.creator_name}`;
  return media.creator_tier === "free"
    ? `Watch ${named}, free on ${SITE_NAME}.`
    : `${media.creator_name} is a VIP creator. Get VIP to see ${named} on ${SITE_NAME}.`;
}

export async function generateMetadata({ params }) {
  const { id } = await params;
  const media = await find(id);
  if (!media) return { title: `Not found | ${SITE_NAME}` };
  const name = displayTitle(media.title, media.creator_name, media.kind);
  // "Beach day - Ava Monroe | XTINE’S VIDEOS"
  const title = media.title ? `${name} - ${media.creator_name} | ${SITE_NAME}` : `${name} | ${SITE_NAME}`;
  const description = describe(media);
  const path = `/${media.creator_slug}/v/${media.id}`;
  // A permanent thumbnail address, so link previews never break. VIP ones are blurred.
  const image = `/media/${media.id}/thumb`;
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
      images: [{ url: image, width: 640 }],
    },
    twitter: { card: "summary_large_image", title, description, images: [image] },
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
  const free = media.creator_tier === "free";

  // Tells search engines about free videos (title, thumbnail, length, date).
  let schema = null;
  if (free && media.kind === "video") {
    const site = await siteUrl();
    schema = {
      "@context": "https://schema.org",
      "@type": "VideoObject",
      name: displayTitle(media.title, media.creator_name, media.kind),
      description: describe(media),
      thumbnailUrl: [`${site}/media/${media.id}/thumb`],
      uploadDate: new Date(media.created_at).toISOString(),
      duration: media.duration_seconds ? isoDuration(media.duration_seconds) : undefined,
      author: { "@type": "Person", name: media.creator_name, url: `${site}/${media.creator_slug}` },
    };
  }

  return (
    <>
      {schema && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, "\\u003c") }} />
      )}
      <VideoView
        viewer={access.viewer}
        isVip={access.isVip}
        creator={{ slug: media.creator_slug, name: media.creator_name, tier: media.creator_tier }}
        item={{ ...item, createdAt: new Date(media.created_at).toISOString() }}
        locked={locked}
        canEdit={Boolean(access.viewer?.isAdmin)}
        trackView={!access.viewer?.isAdmin}
        rewardMinutes={PASS_MINUTES}
        priceLabel={VIP_PRICE_LABEL}
      />
    </>
  );
}
