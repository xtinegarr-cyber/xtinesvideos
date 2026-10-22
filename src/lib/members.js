import { query, queryOne } from "./db";
import { hashPassword } from "./passwords";

const customerIdOf = (obj) => (typeof obj?.customer === "string" ? obj.customer : obj?.customer?.id) ?? null;

/** Finds an account by username (admin-made) or email (bought VIP). */
export function findUserByLogin(login) {
  const value = String(login || "").trim().toLowerCase();
  if (!value) return null;
  return queryOne("SELECT * FROM users WHERE username = $1 OR lower(email) = $1 LIMIT 1", [value]);
}

export function findUserById(id) {
  return queryOne("SELECT * FROM users WHERE id = $1", [id]);
}

/**
 * Creates a member account. Returns null if the username, email or Stripe
 * customer already belongs to someone.
 * vip: true with no vipUntil = VIP with no end date.
 */
export async function createUser({
  username = null,
  email = null,
  password,
  vip = false,
  vipUntil = null,
  stripe = {},
}) {
  const passwordHash = await hashPassword(password);
  return queryOne(
    `INSERT INTO users (username, email, password_hash, role, vip_until, vip_lifetime,
                        stripe_customer_id, stripe_subscription_id, stripe_status)
     VALUES ($1, $2, $3, 'member', $4, $5, $6, $7, $8)
     ON CONFLICT DO NOTHING
     RETURNING *`,
    [
      username,
      email,
      passwordHash,
      vip ? vipUntil : null,
      vip && !vipUntil,
      stripe.customerId ?? null,
      stripe.subscriptionId ?? null,
      stripe.status ?? null,
    ],
  );
}

/** Everyone who has or had VIP, newest first, for the admin panel. */
export function listVipMembers() {
  return query(
    `SELECT id, username, email, vip_until, vip_lifetime, stripe_customer_id, stripe_status,
            cancel_at_period_end, created_at,
            (vip_lifetime OR vip_until > now()) AS active
       FROM users
      WHERE role = 'member' AND (vip_lifetime OR vip_until IS NOT NULL OR stripe_customer_id IS NOT NULL)
      ORDER BY created_at DESC`,
  );
}

export async function deleteMember(id) {
  await query("DELETE FROM users WHERE id = $1 AND role = 'member'", [id]);
}

/**
 * Records a Stripe subscription's latest state on the member's account so
 * the admin can see cancellations and failed payments. VIP itself is left
 * alone: you decide who keeps it in the monthly review.
 */
export async function recordSubscription(userId, subscription) {
  await query(
    `UPDATE users
        SET stripe_customer_id = coalesce($2, stripe_customer_id),
            stripe_subscription_id = $3,
            stripe_status = $4,
            cancel_at_period_end = $5
      WHERE id = $1 AND role = 'member'`,
    [
      userId,
      customerIdOf(subscription),
      subscription.id,
      subscription.status,
      Boolean(subscription.cancel_at_period_end || subscription.cancel_at),
    ],
  );
}

/** Turns on VIP (no end date) for an existing member who just paid. */
export async function grantVip(userId, subscription) {
  await recordSubscription(userId, subscription);
  await query("UPDATE users SET vip_lifetime = true WHERE id = $1 AND role = 'member'", [userId]);
}

/** Finds whose subscription this is: by Stripe customer, then by metadata. */
export async function userIdForSubscription(subscription) {
  const customerId = customerIdOf(subscription);
  if (customerId) {
    const row = await queryOne("SELECT id, stripe_subscription_id FROM users WHERE stripe_customer_id = $1", [customerId]);
    if (row) {
      // Ignore late events from an older subscription the member replaced.
      if (row.stripe_subscription_id && row.stripe_subscription_id !== subscription.id && subscription.status !== "active") {
        return null;
      }
      return Number(row.id);
    }
  }
  const fromMetadata = Number(subscription.metadata?.userId);
  return Number.isInteger(fromMetadata) && fromMetadata > 0 ? fromMetadata : null;
}

// ---- Paid checkouts waiting for the buyer to create their account ----

/** Remembers a paid checkout. Safe to call more than once. */
export function saveCheckout({ sessionId, customerId, subscriptionId, email }) {
  return query(
    `INSERT INTO vip_checkouts (session_id, customer_id, subscription_id, email)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (session_id) DO NOTHING`,
    [sessionId, customerId, subscriptionId, email],
  );
}

export function getCheckout(sessionId) {
  return queryOne("SELECT * FROM vip_checkouts WHERE session_id = $1", [sessionId]);
}

/** Marks a checkout as used. False if someone already used it. */
export async function markCheckoutClaimed(sessionId, userId) {
  const rows = await query(
    `UPDATE vip_checkouts SET claimed_by = $2, claimed_at = now()
      WHERE session_id = $1 AND claimed_at IS NULL
      RETURNING session_id`,
    [sessionId, userId],
  );
  return rows.length > 0;
}

/** People who paid but haven't created their login yet. */
export function listUnclaimedCheckouts() {
  return query(
    `SELECT session_id, email, created_at FROM vip_checkouts
      WHERE claimed_at IS NULL
      ORDER BY created_at DESC
      LIMIT 50`,
  );
}
