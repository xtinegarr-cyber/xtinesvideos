import Stripe from "stripe";
import { applySubscription, findUserById, userIdForSubscription } from "./members";

export function stripeConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_VIP_PRICE_ID);
}

export function stripe() {
  if (!globalThis.__xvStripe) globalThis.__xvStripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  return globalThis.__xvStripe;
}

/** Starts a $4.99/month VIP checkout for a logged-in member; returns its URL. */
export async function createVipCheckout(viewer, baseUrl) {
  const user = await findUserById(viewer.id);
  const params = {
    mode: "subscription",
    line_items: [{ price: process.env.STRIPE_VIP_PRICE_ID, quantity: 1 }],
    client_reference_id: String(viewer.id),
    metadata: { userId: String(viewer.id) },
    subscription_data: { metadata: { userId: String(viewer.id) } },
    allow_promotion_codes: true,
    success_url: `${baseUrl}/vip/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/vip`,
  };
  if (user?.stripe_customer_id) params.customer = user.stripe_customer_id;
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

/** After checkout: link the Stripe customer to the account and turn on VIP. */
export async function syncCheckoutSession(session) {
  if (session.mode !== "subscription" || !session.subscription) return false;
  const userId = Number(session.client_reference_id || session.metadata?.userId);
  if (!Number.isInteger(userId) || userId <= 0) return false;
  const subscriptionId = typeof session.subscription === "string" ? session.subscription : session.subscription.id;
  const subscription = await stripe().subscriptions.retrieve(subscriptionId);
  await applySubscription(userId, subscription);
  return true;
}

/** Renewals, cancellations and failed payments all arrive here. */
export async function syncSubscription(subscription) {
  const userId = await userIdForSubscription(subscription);
  if (userId) await applySubscription(userId, subscription);
}
