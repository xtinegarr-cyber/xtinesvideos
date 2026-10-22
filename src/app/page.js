import HomeView from "@/components/HomeView";
import { listCreators } from "@/lib/creators";
import { creatorCard } from "@/lib/cards";
import { getViewer } from "@/lib/session";
import { VIP_PRICE_LABEL } from "@/lib/vip";

export const dynamic = "force-dynamic";

export default async function HomePage({ searchParams }) {
  const params = await searchParams;
  const search = typeof params?.q === "string" ? params.q.trim().slice(0, 80) : "";
  const viewer = await getViewer();
  const rows = await listCreators({ search });
  const now = Date.now();
  const cards = await Promise.all(rows.map((row) => creatorCard(row, viewer, now)));

  return (
    <HomeView
      viewer={viewer}
      search={search}
      free={cards.filter((c) => c.tier === "free")}
      vip={cards.filter((c) => c.tier === "vip")}
      priceLabel={VIP_PRICE_LABEL}
    />
  );
}
