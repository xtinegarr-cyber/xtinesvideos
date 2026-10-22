// Stripe calls this when someone pays, renews, cancels or a payment fails.
// Add the endpoint https://YOUR-SITE/api/stripe/webhook in the Stripe
// dashboard and put its signing secret in STRIPE_WEBHOOK_SECRET.
import { handleCheckout, stripe, stripeConfigured, syncSubscription } from "@/lib/stripe";

export async function POST(request) {
  if (!stripeConfigured() || !process.env.STRIPE_WEBHOOK_SECRET) {
    return new Response("Stripe is not configured.", { status: 503 });
  }

  const body = await request.text();
  const signature = request.headers.get("stripe-signature");
  let event;
  try {
    event = stripe().webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET);
  } catch {
    return new Response("Invalid signature.", { status: 400 });
  }

  try {
    switch (event.type) {
      // A payment went through. Saved so the buyer can create their login
      // (or VIP is added right away if they were already logged in).
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded":
        await handleCheckout(event.data.object);
        break;
      // Renewals, cancellations, failed payments: shown in the admin panel
      // for your monthly review. They never remove VIP on their own.
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await syncSubscription(event.data.object);
        break;
      default:
        break;
    }
  } catch (err) {
    console.error(`Stripe webhook ${event.type} failed:`, err);
    // A 500 makes Stripe retry later.
    return new Response("Webhook handler failed.", { status: 500 });
  }

  return Response.json({ received: true });
}
