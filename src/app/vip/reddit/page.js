import RedditVipView from "@/components/RedditVipView";
import { listCreators } from "@/lib/creators";
import { getAccess } from "@/lib/session";
import { SITE_NAME } from "@/lib/site";
import { VIP_PRICE_LABEL } from "@/lib/vip";
import { claimBlockReason, latestClaim, PASS_MINUTES, readRefCode } from "@/lib/vip-pass";

export const dynamic = "force-dynamic";
export const metadata = {
  title: `Get free VIP – ${SITE_NAME}`,
  description: `Share a free creator’s video on Reddit and get ${PASS_MINUTES} minutes of VIP on ${SITE_NAME}.`,
};

export default async function RedditVipPage() {
  const access = await getAccess();
  const refCode = await readRefCode();
  const claim = await latestClaim(refCode);
  // Already used today's free VIP (and it isn't still running or waiting).
  const usedToday =
    refCode && !access.pass && claim?.status !== "pending" ? await claimBlockReason({ refCode }) : null;
  const freeCreators = (await listCreators())
    .filter((c) => c.tier === "free")
    .slice(0, 12)
    .map((c) => ({ slug: c.slug, name: c.name }));

  return (
    <RedditVipView
      viewer={access.viewer}
      isVip={access.isVip}
      pass={access.pass ? { until: access.pass.until.toISOString() } : null}
      claim={claim ? { status: claim.status } : null}
      usedToday={usedToday}
      minutes={PASS_MINUTES}
      freeCreators={freeCreators}
      priceLabel={VIP_PRICE_LABEL}
    />
  );
}
