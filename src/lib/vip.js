// Pure rules for who counts as VIP. No database or Stripe calls in here.

export const VIP_PRICE_LABEL = process.env.NEXT_PUBLIC_VIP_PRICE_LABEL || "$4.99";

/** A database user row -> what pages need to know about the visitor. */
export function toViewer(row) {
  if (!row) return null;
  const isAdmin = row.role === "admin";
  const vipUntil = row.vip_until ? new Date(row.vip_until) : null;
  const vipActive = Boolean(row.vip_lifetime) || Boolean(vipUntil && vipUntil.getTime() > Date.now());
  return {
    id: Number(row.id),
    // Buyers log in with their email; admin-made accounts with a username.
    username: row.username ?? row.email,
    email: row.email ?? null,
    isAdmin,
    isVip: isAdmin || vipActive,
    vipUntil: vipUntil ? vipUntil.toISOString() : null,
    vipLifetime: Boolean(row.vip_lifetime),
    hasStripe: Boolean(row.stripe_customer_id),
    stripeStatus: row.stripe_status ?? null,
    cancelAtPeriodEnd: Boolean(row.cancel_at_period_end),
  };
}

/** Only allow redirects back into this site after logging in. */
export function safeNextPath(value, fallback = "/") {
  const path = String(value || "");
  return path.startsWith("/") && !path.startsWith("//") && !path.startsWith("/\\") ? path : fallback;
}
