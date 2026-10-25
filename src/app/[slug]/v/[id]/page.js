// The old video links (yoursite.com/ava/v/12) still work: they send
// visitors and search engines on, permanently, to the current address
// (yoursite.com/ava/12-beach-day), keeping ?r=code and the like.
import { notFound, permanentRedirect } from "next/navigation";
import { getMediaWithCreator } from "@/lib/creators";
import { mediaIdFromParam, mediaPath } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function OldMediaLink({ params, searchParams }) {
  const { id } = await params;
  const mediaId = mediaIdFromParam(id);
  const media = mediaId ? await getMediaWithCreator(mediaId) : null;
  if (!media) notFound();
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries((await searchParams) ?? {})) {
    for (const v of [].concat(value ?? [])) query.append(key, String(v));
  }
  const path = mediaPath(media.creator_slug, media);
  permanentRedirect(query.size ? `${path}?${query}` : path);
}
