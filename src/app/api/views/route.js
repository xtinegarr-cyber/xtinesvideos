import { getCreatorBySlug, recordView } from "@/lib/creators";
import { getViewer } from "@/lib/session";
import { clientIp, looksLikeBot, visitorHash } from "@/lib/visitors";

export async function POST(request) {
  let slug;
  try {
    ({ slug } = await request.json());
  } catch {
    return Response.json({ counted: false }, { status: 400 });
  }
  if (typeof slug !== "string" || slug.length > 100) {
    return Response.json({ counted: false }, { status: 400 });
  }

  const userAgent = request.headers.get("user-agent") || "";
  const viewer = await getViewer();
  // Bots and admins checking the site don't count toward creator pay.
  if (looksLikeBot(userAgent) || viewer?.isAdmin) return Response.json({ counted: false });

  const creator = await getCreatorBySlug(slug);
  if (!creator) return Response.json({ counted: false }, { status: 404 });

  const hash = visitorHash({ userId: viewer?.id, ip: clientIp(request.headers), userAgent });
  const counted = await recordView(creator.id, hash);
  return Response.json({ counted });
}
