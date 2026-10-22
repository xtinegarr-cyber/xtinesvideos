// Stripe sends buyers here after paying. New buyers create their login
// (email + password) here; it comes with VIP that doesn't expire.
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import { ClaimForm } from "@/components/VipForms";
import { getViewer } from "@/lib/session";
import { SITE_NAME } from "@/lib/site";
import { confirmCheckout, stripeConfigured } from "@/lib/stripe";

export const dynamic = "force-dynamic";
export const metadata = { title: `Welcome to VIP – ${SITE_NAME}`, robots: { index: false } };

function Message({ title, children, action }) {
  return (
    <div className="text-center">
      <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">{title}</h1>
      <p className="mt-4 text-lg text-muted">{children}</p>
      {action && <div className="mt-8 flex justify-center">{action}</div>}
    </div>
  );
}

const browseButton = (
  <Link href="/" className="btn-vip h-12 px-7">
    Browse creators
  </Link>
);

export default async function VipSuccessPage({ searchParams }) {
  const { session_id: sessionId = "" } = await searchParams;
  const viewer = await getViewer();
  const here = `/vip/success?session_id=${encodeURIComponent(sessionId)}`;

  let confirmed = null;
  let lookupFailed = false;
  if (sessionId && stripeConfigured()) {
    try {
      confirmed = await confirmCheckout(sessionId);
    } catch (err) {
      console.error("Could not confirm checkout:", err);
      lookupFailed = true;
    }
  }
  const checkout = confirmed?.checkout;
  const claimedByViewer = checkout?.claimed_by && viewer && Number(checkout.claimed_by) === viewer.id;

  let content;
  if (claimedByViewer || (viewer?.isVip && !checkout)) {
    content = (
      <Message title="You’re VIP" action={browseButton}>
        Every VIP creator is unlocked for you now.
      </Message>
    );
  } else if (lookupFailed) {
    content = (
      <Message
        title="Almost there"
        action={
          <Link href={here} className="btn-vip h-12 px-7">
            Try again
          </Link>
        }
      >
        We couldn’t check your payment with Stripe just now. Your payment is safe; try again in a minute.
      </Message>
    );
  } else if (!checkout) {
    content = (
      <Message
        title="Payment not finished"
        action={
          <Link href="/vip" className="btn-vip h-12 px-7">
            Back to VIP
          </Link>
        }
      >
        We couldn’t find a completed payment for this link. If you were charged, contact us on Discord or Telegram.
      </Message>
    );
  } else if (checkout.claimed_at) {
    content = (
      <Message
        title="Your account is ready"
        action={
          <Link href="/login?next=/" className="btn-vip h-12 px-7">
            Log in
          </Link>
        }
      >
        An account was already created with this payment. Log in with your email and password.
      </Message>
    );
  } else {
    content = (
      <div>
        <div className="text-center">
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">Payment complete</h1>
          <p className="mt-4 text-lg text-muted">Create your login to start watching. Your account comes with VIP.</p>
        </div>
        <div className="mx-auto mt-8 max-w-sm rounded-3xl border border-gold/25 bg-panel/80 p-6">
          <ClaimForm sessionId={sessionId} email={checkout.email ?? ""} />
        </div>
      </div>
    );
  }

  return (
    <>
      <SiteHeader viewer={viewer} />
      <main className="mx-auto max-w-lg px-4 pb-24 pt-14">{content}</main>
    </>
  );
}
