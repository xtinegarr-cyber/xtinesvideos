// A permanent address for a free creator's video file, so search engines
// can fetch it (the sitemap and the video page point here). Like the
// thumbnail address, it sends visitors on to a fresh R2 link. VIP videos
// aren't available here, and other websites can't embed the file through it.
import { getMediaWithCreator } from "@/lib/creators";
import { fileUrl } from "@/lib/storage";

function hostOf(url) {
  try {
    return new URL(url).host.toLowerCase();
  } catch {
    return null;
  }
}

/** True when another website is trying to play the file on its own page. */
function embeddedElsewhere(request) {
  const from = hostOf(request.headers.get("referer"));
  if (!from) return false; // Search engines and direct visits send no referrer.
  const ours = [process.env.SITE_URL, request.url].map(hostOf);
  ours.push(request.headers.get("x-forwarded-host")?.toLowerCase(), request.headers.get("host")?.toLowerCase());
  return !ours.includes(from);
}

export async function GET(request, { params }) {
  const { id } = await params;
  const media = /^\d{1,15}$/.test(String(id)) ? await getMediaWithCreator(Number(id)) : null;
  if (!media || media.kind !== "video" || media.creator_tier !== "free") return new Response("Not found", { status: 404 });
  if (embeddedElsewhere(request)) return new Response("Watch this video on the site.", { status: 403 });
  const url = await fileUrl(media.file_key);
  if (!url) return new Response("Not found", { status: 404 });
  return new Response(null, {
    status: 302,
    // "private": a shared cache must not hand this redirect to other sites.
    headers: { Location: url, "Cache-Control": "private, max-age=3600" },
  });
}
