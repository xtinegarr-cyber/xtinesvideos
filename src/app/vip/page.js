import VipView from "@/components/VipView";
import { getViewer } from "@/lib/session";
import { SITE_NAME } from "@/lib/site";
import { stripeConfigured } from "@/lib/stripe";
import { VIP_PRICE_LABEL } from "@/lib/vip";

export const dynamic = "force-dynamic";
export const metadata = { title: `Get VIP – ${SITE_NAME}` };

export default async function VipPage() {
  const viewer = await getViewer();
  return <VipView viewer={viewer} priceLabel={VIP_PRICE_LABEL} configured={stripeConfigured()} />;
}
