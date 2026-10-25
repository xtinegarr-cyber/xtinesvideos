// One video or photo on its own page: yoursite.com/ava/12-beach-day
// (just /ava/12 without a title). The number finds it; any other wording,
// an old creator name or the old /ava/v/12 links redirect to the current
// address. Free creators' videos can be shared from here (for free VIP on
// Reddit).
import { notFound, permanentRedirect } from "next/navigation";
import { cache } from "react";
import VideoView from "@/components/VideoView";
import { getMediaWithCreator, listMedia } from "@/lib/creators";
import { mediaItem } from "@/lib/cards";
import { displayTitle, isoDuration, mediaIdFromParam, mediaPath } from "@/lib/format";
import { mediaDescription as describe, titleOf } from "@/lib/seo";
import { getAccess, siteUrl } from "@/lib/session";
import { SITE_NAME } from "@/lib/site";
import { VIP_PRICE_LABEL } from "@/lib/vip";
import { PASS_MINUTES } from "@/lib/vip-pass";

export const dynamic = "force-dynamic";

// Cached so the page and its metadata share one database lookup.
const find = cache(async (param) => {
  const id = mediaIdFromParam(param);
  return id ? getMediaWithCreator(id) : null;
});

/** Keeps ?r=code and the like when sending someone to the current address. */
function withQuery(path, searchParams) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams ?? {})) {
    for (const v of [].concat(value ?? [])) query.append(key, String(v));
  }
  const text = query.toString();
  return text ? `${path}?${text}` : path;
}

export async function generateMetadata({ params }) {
  const { video } = await params;
  const media = await find(video);
  if (!media) return { title: `Not found | ${SITE_NAME}` };
  const name = displayTitle(titleOf(media), media.creator_name, media.kind);
  // "Beach day - Ava Monroe | XTINE’S VIDEOS"
  const title = titleOf(media) ? `${name} - ${media.creator_name} | ${SITE_NAME}` : `${name} | ${SITE_NAME}`;
  const description = describe(media);
  const path = mediaPath(media.creator_slug, media);
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

export default async function MediaPage({ params, searchParams }) {
  const { slug, video } = await params;
  const media = await find(video);
  if (!media) notFound();
  // Old titles, old creator names or typos in the link: one address per video.
  const path = mediaPath(media.creator_slug, media);
  if (`/${slug}/${video}` !== path) permanentRedirect(withQuery(path, await searchParams));

  const access = await getAccess();
  const locked = media.creator_tier === "vip" && !access.isVip;
  const item = await mediaItem(media, locked, { withFile: true });
  const free = media.creator_tier === "free";
  if (free && media.kind === "video") {
    // The player uses the same permanent addresses the sitemap and the
    // structured data give Google. Google can't reliably index video or
    // thumbnails behind links that expire, like R2's signed ones.
    item.url = `/media/${media.id}/video`;
    item.thumbUrl = `/media/${media.id}/thumb`;
  }
  // A few more of the same kind (videos after a video), newest first.
  const more = locked
    ? []
    : await Promise.all(
        (await listMedia(media.creator_id))
          .filter((m) => Number(m.id) !== Number(media.id) && m.kind === media.kind)
          .slice(0, 6)
          .map((m) => mediaItem(m, false)),
      );

  // Tells search engines about free videos (title, thumbnail, length, date).
  let schema = null;
  if (free && media.kind === "video") {
    const site = await siteUrl();
    schema = {
      "@context": "https://schema.org",
      "@type": "VideoObject",
      name: displayTitle(titleOf(media), media.creator_name, media.kind),
      description: describe(media),
      thumbnailUrl: [`${site}/media/${media.id}/thumb`],
      // A permanent link to the file itself (the player's link expires).
      contentUrl: `${site}/media/${media.id}/video`,
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
        more={more}
        locked={locked}
        canEdit={Boolean(access.viewer?.isAdmin)}
        trackView={!access.viewer?.isAdmin}
        rewardMinutes={PASS_MINUTES}
        priceLabel={VIP_PRICE_LABEL}
      />
    </>
  );
}
