import Link from "next/link";
import { redirect } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import { quietButton } from "@/components/forms";
import { manageSubscriptionAction } from "@/app/vip/actions";
import { logout } from "@/app/actions";
import { formatDate } from "@/lib/format";
import { getViewer } from "@/lib/session";
import { SITE_NAME } from "@/lib/site";

export const dynamic = "force-dynamic";
export const metadata = { title: `Your account – ${SITE_NAME}` };

function vipStatus(viewer) {
  if (viewer.vipLifetime) return "VIP, with no end date.";
  if (viewer.isVip && viewer.cancelAtPeriodEnd) {
    return `VIP until ${formatDate(viewer.vipUntil)}. Your subscription is canceled and won’t renew.`;
  }
  if (viewer.isVip && viewer.hasStripe) return `VIP. Renews around ${formatDate(viewer.vipUntil)}.`;
  if (viewer.isVip) return `VIP until ${formatDate(viewer.vipUntil)}.`;
  if (viewer.vipUntil) return `Your VIP ended on ${formatDate(viewer.vipUntil)}.`;
  return "You don’t have VIP yet.";
}

export default async function AccountPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login?next=/account");
  if (viewer.isAdmin) redirect("/admin");

  return (
    <>
      <SiteHeader viewer={viewer} />
      <main className="mx-auto max-w-lg px-4 pb-24 pt-14">
        <h1 className="text-4xl font-extrabold tracking-tight">Your account</h1>
        <div className="mt-8 space-y-6 rounded-3xl border border-line bg-panel p-6">
          <div>
            <p className="text-sm text-muted">Username</p>
            <p className="text-lg font-semibold">{viewer.username}</p>
          </div>
          <div>
            <p className="text-sm text-muted">Membership</p>
            <p className="text-lg font-semibold">{vipStatus(viewer)}</p>
          </div>
          <div className="flex flex-wrap gap-2 border-t border-line pt-6">
            {viewer.hasStripe && (
              <form action={manageSubscriptionAction}>
                <button type="submit" className={quietButton}>
                  {viewer.isVip && !viewer.cancelAtPeriodEnd ? "Manage or cancel VIP" : "Billing and receipts"}
                </button>
              </form>
            )}
            {!viewer.isVip && (
              <Link href="/vip" className="btn-vip h-10 px-5 text-sm">
                Get VIP
              </Link>
            )}
            <form action={logout}>
              <button type="submit" className={quietButton}>
                Log out
              </button>
            </form>
          </div>
        </div>
      </main>
    </>
  );
}
