import { query, queryOne } from "./db";
import { hashPassword } from "./passwords";
import { vipFromSubscription } from "./vip";

export function findUserByUsername(username) {
  return queryOne("SELECT * FROM users WHERE username = $1", [username]);
}

export function findUserById(id) {
  return queryOne("SELECT * FROM users WHERE id = $1", [id]);
}

/**
 * Creates an account. Returns null if the username is taken.
 * `vipUntil: null` with `vip: true` gives VIP with no end date.
 */
export async function createUser({ username, password, vip = false, vipUntil = null }) {
  const passwordHash = await hashPassword(password);
  return queryOne(
    `INSERT INTO users (username, password_hash, role, vip_until, vip_lifetime)
     VALUES ($1, $2, 'member', $3, $4)
     ON CONFLICT (username) DO NOTHING
     RETURNING *`,
    [username, passwordHash, vip ? vipUntil : null, vip && !vipUntil],
  );
}

/** Everyone who has or had VIP, newest first, for the admin panel. */
export function listVipMembers() {
  return query(
    `SELECT id, username, vip_until, vip_lifetime, stripe_customer_id, stripe_status,
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

/** Saves a Stripe subscription's state onto the member's account. */
export async function applySubscription(userId, subscription) {
  const { status, vipUntil, cancelAtPeriodEnd } = vipFromSubscription(subscription);
  const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id;
  await query(
    `UPDATE users
        SET stripe_customer_id = coalesce($2, stripe_customer_id),
            stripe_subscription_id = $3,
            stripe_status = $4,
            vip_until = $5,
            cancel_at_period_end = $6
      WHERE id = $1 AND role = 'member'`,
    [userId, customerId ?? null, subscription.id, status, vipUntil, cancelAtPeriodEnd],
  );
}

/** Finds whose subscription this is: by Stripe customer, then by metadata. */
export async function userIdForSubscription(subscription) {
  const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id;
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
