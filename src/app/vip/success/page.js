import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import { getViewer } from "@/lib/session";
import { SITE_NAME } from "@/lib/site";
import { stripe, stripeConfigured, syncCheckoutSession } from "@/lib/stripe";

export const dynamic = "force-dynamic";
export const metadata = { title: `Welcome to VIP – ${SITE_NAME}` };

export default async function VipSuccessPage({ searchParams }) {
  const params = await searchParams;
  const sessionId = typeof params?.session_id === "string" ? params.session_id : "";
  let viewer = await getViewer();

  // Turn VIP on right away instead of waiting for Stripe's webhook.
  if (viewer && !viewer.isVip && /^cs_[A-Za-z0-9_]+$/.test(sessionId) && stripeConfigured()) {
    try {
      const session = await stripe().checkout.sessions.retrieve(sessionId);
      if (session.client_reference_id === String(viewer.id) && session.status === "complete") {
        await syncCheckoutSession(session);
        viewer = { ...viewer, isVip: true };
      }
    } catch (err) {
      console.error("Could not confirm checkout session:", err);
    }
  }

  return (
    <>
      <SiteHeader viewer={viewer} />
      <main className="mx-auto max-w-lg px-4 pb-24 pt-16 text-center">
        {viewer?.isVip ? (
          <>
            <h1 className="text-5xl font-extrabold tracking-tight">You’re VIP</h1>
            <p className="mt-4 text-lg text-muted">Every VIP creator is unlocked for you now.</p>
            <Link href="/" className="btn-vip mt-8 h-12 px-7">
              Browse creators
            </Link>
          </>
        ) : (
          <>
            <h1 className="text-4xl font-extrabold tracking-tight">Payment received</h1>
            <p className="mt-4 text-muted">
              {viewer
                ? "VIP usually switches on within a minute. Refresh this page if it hasn’t yet."
                : "Log in with the account you just created to start watching."}
            </p>
            <Link
              href={viewer ? `/vip/success?session_id=${encodeURIComponent(sessionId)}` : "/login"}
              className="mt-8 inline-flex h-12 items-center rounded-full bg-fg px-7 font-bold text-ink"
            >
              {viewer ? "Refresh" : "Log in"}
            </Link>
          </>
        )}
      </main>
    </>
  );
}
