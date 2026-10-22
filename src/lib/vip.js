// Pure rules for who counts as VIP. No database or Stripe calls in here.

export const VIP_PRICE_LABEL = process.env.NEXT_PUBLIC_VIP_PRICE_LABEL || "$4.99";
const GRACE_MS = 24 * 60 * 60 * 1000;
const ACTIVE_STATUSES = new Set(["active", "trialing", "past_due"]);

/** A database user row -> what pages need to know about the visitor. */
export function toViewer(row) {
  if (!row) return null;
  const isAdmin = row.role === "admin";
  const vipUntil = row.vip_until ? new Date(row.vip_until) : null;
  const vipActive = Boolean(row.vip_lifetime) || Boolean(vipUntil && vipUntil.getTime() > Date.now());
  return {
    id: Number(row.id),
    username: row.username,
    isAdmin,
    isVip: isAdmin || vipActive,
    vipUntil: vipUntil ? vipUntil.toISOString() : null,
    vipLifetime: Boolean(row.vip_lifetime),
    hasStripe: Boolean(row.stripe_customer_id),
    stripeStatus: row.stripe_status ?? null,
    cancelAtPeriodEnd: Boolean(row.cancel_at_period_end),
  };
}

/**
 * Stripe subscription -> VIP access. Paid-up subscribers keep VIP until
 * their billing period ends (plus a day of grace so renewals never cause a
 * gap). Canceling keeps access until the end of what they paid for.
 */
export function vipFromSubscription(sub, now = Date.now()) {
  // Newer Stripe API versions moved the period end onto subscription items.
  const periodEnd = sub.current_period_end ?? sub.items?.data?.[0]?.current_period_end ?? null;
  const cancelAtPeriodEnd = Boolean(sub.cancel_at_period_end || sub.cancel_at);
  let vipUntil = new Date(now);
  if (ACTIVE_STATUSES.has(sub.status) && periodEnd) {
    vipUntil = new Date(periodEnd * 1000 + (cancelAtPeriodEnd ? 0 : GRACE_MS));
  }
  return { status: sub.status, vipUntil, cancelAtPeriodEnd };
}

/** Only allow redirects back into this site after logging in. */
export function safeNextPath(value, fallback = "/") {
  const path = String(value || "");
  return path.startsWith("/") && !path.startsWith("//") && !path.startsWith("/\\") ? path : fallback;
}
