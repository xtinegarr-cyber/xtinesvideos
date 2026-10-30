import { redirect } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import { FormError, quietButton } from "@/components/forms";
import { GetVipButton } from "@/components/VipForms";
import { manageSubscriptionAction } from "@/app/vip/actions";
import { logout } from "@/app/actions";
import { formatDate } from "@/lib/format";
import { getViewer } from "@/lib/session";
import { SITE_NAME } from "@/lib/site";

export const dynamic = "force-dynamic";
export const metadata = { title: `Your account – ${SITE_NAME}` };

function vipStatus(viewer) {
  if (viewer.isVip && viewer.vipLifetime) return "VIP";
  if (viewer.isVip) return `VIP until ${formatDate(viewer.vipUntil)}`;
  return "No VIP";
}

function subscriptionStatus(viewer) {
  if (!viewer.hasStripe) return null;
  if (viewer.cancelAtPeriodEnd) return "Canceled. You won’t be charged again.";
  switch (viewer.stripeStatus) {
    case "active":
    case "trialing":
      return "Active, renews monthly.";
    case "past_due":
    case "unpaid":
      return "Your last payment didn’t go through. Update your card to keep VIP.";
    case "canceled":
    case "incomplete_expired":
      return "Canceled. You won’t be charged again.";
    default:
      return null;
  }
}

export default async function AccountPage({ searchParams }) {
  const { error } = await searchParams;
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
            <p className="text-sm text-muted">{viewer.email ? "Email" : "Username"}</p>
            <p className="text-lg font-semibold">{viewer.username}</p>
          </div>
          <div>
            <p className="text-sm text-muted">Membership</p>
            <p className="text-lg font-semibold">{vipStatus(viewer)}</p>
            {subscriptionStatus(viewer) && <p className="mt-1 text-sm text-muted">{subscriptionStatus(viewer)}</p>}
          </div>
          {error === "billing" && (
            <FormError message="The billing page couldn’t be opened just now. Try again in a minute, or message us on Discord or Telegram." />
          )}
          <div className="flex flex-wrap gap-2 border-t border-line pt-6">
            {!viewer.isVip && (
              <GetVipButton className="h-10 px-5 text-sm" />
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
