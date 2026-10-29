// Permanent address for a creator's profile picture (for SEO + link previews).
// R2 links expire, so this redirects to a fresh signed one.
import { getCreatorById } from "@/lib/creators";
import { fileUrl } from "@/lib/storage";

export async function GET(_request, { params }) {
  const { id } = await params;
  const creator = /^\d{1,15}$/.test(String(id)) ? await getCreatorById(Number(id)) : null;
  if (!creator) return new Response("Not found", { status: 404 });

  // Free creators: real picture. VIP: blurred (what the public sees).
  const key = creator.tier === "vip" ? creator.avatar_blur_key : creator.avatar_key;
  const url = await fileUrl(key);
  if (!url) return new Response("Not found", { status: 404 });

  return new Response(null, {
    status: 302,
    headers: {
      Location: url,
      "Cache-Control": "public, max-age=3600",
    },
  });
}
