// /indexnow-key.txt: the key that proves IndexNow pings come from this
// site (see src/lib/indexnow.js). Search engines read it; it isn't secret.
import { indexNowKey } from "@/lib/indexnow";

export const dynamic = "force-dynamic";

export async function GET() {
  return new Response(await indexNowKey(), {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  });
}
