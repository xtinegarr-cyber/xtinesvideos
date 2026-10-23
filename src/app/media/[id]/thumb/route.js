// A permanent address for a video's or photo's thumbnail, for link
// previews, search engines and the sitemap. File links on R2 expire after
// a few hours, so this sends visitors on to a fresh one. VIP creators'
// thumbnails are always the blurred copy here.
import { getMediaWithCreator } from "@/lib/creators";
import { fileUrl } from "@/lib/storage";

export async function GET(_request, { params }) {
  const { id } = await params;
  const media = /^\d{1,15}$/.test(String(id)) ? await getMediaWithCreator(Number(id)) : null;
  const url = media && (await fileUrl(media.creator_tier === "free" ? media.thumb_key : media.thumb_blur_key));
  if (!url) return new Response("Not found", { status: 404 });
  return new Response(null, {
    status: 302,
    headers: { Location: url, "Cache-Control": "public, max-age=3600" },
  });
}
