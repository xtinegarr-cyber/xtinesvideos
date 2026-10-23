// This browser's share code, for its personal video links (?r=code).
// Creates the code on first use.
import { ensureRefCode } from "@/lib/vip-pass";

export async function GET() {
  const code = await ensureRefCode();
  return Response.json({ code }, { headers: { "Cache-Control": "no-store" } });
}
