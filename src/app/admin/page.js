import AdminView from "@/components/admin/AdminView";
import { listCreatorsForAdmin, siteStats } from "@/lib/creators";
import { isNew } from "@/lib/format";
import { listUnclaimedCheckouts, listVipMembers } from "@/lib/members";
import { requireAdmin, siteUrl } from "@/lib/session";
import { SITE_NAME } from "@/lib/site";
import { fileUrl, storageConfigured } from "@/lib/storage";
import { stripeConfigured } from "@/lib/stripe";

export const dynamic = "force-dynamic";
export const metadata = { title: `Admin panel – ${SITE_NAME}`, robots: { index: false } };

export default async function AdminPage() {
  const viewer = await requireAdmin();
  const [stats, creatorRows, memberRows, checkoutRows, base] = await Promise.all([
    siteStats(),
    listCreatorsForAdmin(),
    listVipMembers(),
    listUnclaimedCheckouts(),
    siteUrl(),
  ]);
  const now = Date.now();

  const creators = await Promise.all(
    creatorRows.map(async (c) => ({
      id: Number(c.id),
      slug: c.slug,
      name: c.name,
      tier: c.tier,
      views: Number(c.view_count) || 0,
      views7d: Number(c.views_7d) || 0,
      mediaCount: Number(c.media_count) || 0,
      createdAt: new Date(c.created_at).toISOString(),
      isNew: isNew(c.created_at, now),
      imageUrl: await fileUrl(c.avatar_key),
    })),
  );

  const members = memberRows.map((m) => ({
    id: Number(m.id),
    login: m.username ?? m.email,
    stripeStatus: m.stripe_status ?? null,
    active: Boolean(m.active),
    lifetime: Boolean(m.vip_lifetime),
    vipUntil: m.vip_until ? new Date(m.vip_until).toISOString() : null,
    viaStripe: Boolean(m.stripe_customer_id),
    cancelAtPeriodEnd: Boolean(m.cancel_at_period_end),
    createdAt: new Date(m.created_at).toISOString(),
  }));

  return (
    <AdminView
      viewer={viewer}
      stats={{
        creators: Number(stats.creators) || 0,
        views: Number(stats.views) || 0,
        views_7d: Number(stats.views_7d) || 0,
        media: Number(stats.media) || 0,
        vip_members: Number(stats.vip_members) || 0,
      }}
      creators={creators}
      members={members}
      pendingCheckouts={checkoutRows.map((c) => ({
        sessionId: c.session_id,
        email: c.email,
        createdAt: new Date(c.created_at).toISOString(),
        setupUrl: `${base}/vip/success?session_id=${c.session_id}`,
      }))}
      storageReady={storageConfigured()}
      stripeReady={stripeConfigured()}
    />
  );
}
