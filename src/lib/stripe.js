import Stripe from "stripe";
import {
  createUser,
  findUserById,
  getCheckout,
  grantVip,
  markCheckoutClaimed,
  recordSubscription,
  saveCheckout,
  userIdForSubscription,
  deleteMember,
} from "./members";

export function stripeConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_VIP_PRICE_ID);
}

export function stripe() {
  if (!globalThis.__xvStripe) globalThis.__xvStripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  return globalThis.__xvStripe;
}

const idOf = (value) => (typeof value === "string" ? value : value?.id) ?? null;

/**
 * Starts a $4.99/month VIP checkout and returns Stripe's page address.
 * Visitors don't need an account first: they pay, then create their login.
 * A logged-in member's purchase is attached to their existing account.
 */
export async function createVipCheckout(viewer, baseUrl) {
  const params = {
    mode: "subscription",
    line_items: [{ price: process.env.STRIPE_VIP_PRICE_ID, quantity: 1 }],
    allow_promotion_codes: true,
    success_url: `${baseUrl}/vip/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/vip`,
  };
  if (viewer) {
    const user = await findUserById(viewer.id);
    params.client_reference_id = String(viewer.id);
    params.metadata = { userId: String(viewer.id) };
    params.subscription_data = { metadata: { userId: String(viewer.id) } };
    if (user?.stripe_customer_id) params.customer = user.stripe_customer_id;
    else if (user?.email) params.customer_email = user.email;
  }
  const session = await stripe().checkout.sessions.create(params);
  return session.url;
}

/** Stripe's page where members update their card or cancel. */
export async function createBillingPortal(viewer, baseUrl) {
  const user = await findUserById(viewer.id);
  if (!user?.stripe_customer_id) return null;
  const portal = await stripe().billingPortal.sessions.create({
    customer: user.stripe_customer_id,
    return_url: `${baseUrl}/account`,
  });
  return portal.url;
}

function isPaid(session) {
  return (
    session?.mode === "subscription" &&
    session.status === "complete" &&
    ["paid", "no_payment_required"].includes(session.payment_status)
  );
}

/**
 * Handles a finished checkout (from the webhook or the thank-you page).
 * Purchases by logged-in members turn on VIP right away; everyone else's
 * payment is saved until they create their account.
 * Returns the checkout record, or null if it isn't paid.
 */
export async function handleCheckout(session) {
  if (!isPaid(session)) return null;
  const info = {
    sessionId: session.id,
    customerId: idOf(session.customer),
    subscriptionId: idOf(session.subscription),
    email: session.customer_details?.email?.toLowerCase() ?? null,
  };
  await saveCheckout(info);

  const userId = Number(session.client_reference_id || session.metadata?.userId);
  if (Number.isInteger(userId) && userId > 0) {
    const checkout = await getCheckout(session.id);
    if (!checkout.claimed_at) {
      const subscription = await stripe().subscriptions.retrieve(info.subscriptionId);
      await grantVip(userId, subscription);
      await markCheckoutClaimed(session.id, userId);
    }
  }
  return getCheckout(session.id);
}

/** Looks a checkout up on Stripe (never trusting the browser) and handles it. */
export async function confirmCheckout(sessionId) {
  if (!/^cs_[A-Za-z0-9_]+$/.test(String(sessionId))) return null;
  let session;
  try {
    session = await stripe().checkout.sessions.retrieve(sessionId);
  } catch (err) {
    if (err?.statusCode === 404 || err?.code === "resource_missing") return null; // made-up link
    throw err;
  }
  const checkout = await handleCheckout(session);
  return checkout ? { checkout, session } : null;
}

/**
 * After paying: creates the buyer's login (email + password) with VIP that
 * doesn't expire. Each paid checkout can create exactly one account.
 */
export async function claimCheckout({ sessionId, email, password }) {
  const confirmed = await confirmCheckout(sessionId);
  if (!confirmed) return { error: "We couldn't find a finished payment for this link." };
  if (confirmed.checkout.claimed_at) {
    return { error: "An account was already created with this payment. Log in with your email instead." };
  }

  const subscription = await stripe().subscriptions.retrieve(confirmed.checkout.subscription_id);
  const user = await createUser({
    email,
    password,
    vip: true,
    stripe: {
      customerId: confirmed.checkout.customer_id,
      subscriptionId: subscription.id,
      status: subscription.status,
    },
  });
  if (!user) return { error: "That email already has an account. Log in with it, then open this page again." };

  if (!(await markCheckoutClaimed(sessionId, user.id))) {
    // Someone finished setting up this payment a moment ago.
    await deleteMember(user.id);
    return { error: "An account was already created with this payment. Log in with your email instead." };
  }
  await recordSubscription(user.id, subscription);
  return { user };
}

/** Renewals, cancellations and failed payments: recorded for your review. */
export async function syncSubscription(subscription) {
  const userId = await userIdForSubscription(subscription);
  if (userId) await recordSubscription(userId, subscription);
}
