// The 30-minute VIP pass people earn by posting on Reddit. No account is
// needed: each browser gets a random code (in a cookie and in its share
// links), and passes are stored against that code.
import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { query, queryOne } from "./db";

export const REF_COOKIE = "xv_ref";
const REF_PATTERN = /^[A-Za-z0-9_-]{12}$/;
import { PASS_MINUTES } from "./free-vip";

export { PASS_MINUTES };
const ONCE_PER_HOURS = 24;

export const isRefCode = (value) => REF_PATTERN.test(String(value ?? ""));

/** This browser's code, if it has one. Safe to call anywhere. */
export async function readRefCode() {
  const value = (await cookies()).get(REF_COOKIE)?.value;
  return isRefCode(value) ? value : null;
}

/** This browser's code, created if needed. Only in server actions and API routes. */
export async function ensureRefCode() {
  const existing = await readRefCode();
  if (existing) return existing;
  const code = randomBytes(9).toString("base64url");
  (await cookies()).set(REF_COOKIE, code, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 365 * 24 * 60 * 60,
  });
  return code;
}

/**
 * The pass running for this code, starting an approved one that hasn't
 * started yet (approved by hand while the visitor was away). Null if none.
 */
export async function activePass(refCode) {
  if (!isRefCode(refCode)) return null;
  let row = await queryOne(
    "SELECT max(pass_until) AS until FROM reddit_claims WHERE ref_code = $1 AND pass_until > now()",
    [refCode],
  );
  if (!row?.until) {
    row = await queryOne(
      `UPDATE reddit_claims SET pass_until = now() + make_interval(mins => $2)
        WHERE id = (SELECT id FROM reddit_claims
                     WHERE ref_code = $1 AND status = 'approved' AND pass_until IS NULL
                     ORDER BY approved_at LIMIT 1)
        RETURNING pass_until AS until`,
      [refCode, PASS_MINUTES],
    );
  }
  return row?.until ? { until: new Date(row.until) } : null;
}

/** Why this browser or Reddit account can't claim right now (once a day), or null. */
export async function claimBlockReason({ refCode, author }) {
  const recent = await queryOne(
    `SELECT created_at FROM reddit_claims
      WHERE status <> 'rejected' AND created_at > now() - make_interval(hours => $3)
        AND (ref_code = $1 OR ($2::text IS NOT NULL AND lower(reddit_author) = lower($2::text)))
      ORDER BY created_at DESC LIMIT 1`,
    [refCode, author ?? null, ONCE_PER_HOURS],
  );
  if (!recent) return null;
  const next = new Date(new Date(recent.created_at).getTime() + ONCE_PER_HOURS * 3_600_000);
  const hours = Math.max(1, Math.ceil((next.getTime() - Date.now()) / 3_600_000));
  return `You can earn free VIP once a day. Try again in about ${hours} hour${hours === 1 ? "" : "s"}.`;
}

/**
 * Saves a claim. Approved claims start their pass right away. Returns the
 * row, or null if this post was already used.
 */
export function createClaim({ refCode, postId, postUrl, author, status, note }) {
  return queryOne(
    `INSERT INTO reddit_claims (ref_code, post_id, post_url, reddit_author, status, note, approved_at, pass_until)
     VALUES ($1, $2, $3, $4, $5, $6,
             CASE WHEN $5 = 'approved' THEN now() END,
             CASE WHEN $5 = 'approved' THEN now() + make_interval(mins => $7) END)
     ON CONFLICT DO NOTHING
     RETURNING id, status, pass_until`,
    [refCode, postId ?? null, postUrl, author ?? null, status, note ?? null, PASS_MINUTES],
  );
}

/** This browser's most recent claim, for the status on the Reddit page. */
export function latestClaim(refCode) {
  if (!isRefCode(refCode)) return null;
  return queryOne(
    `SELECT id, status, note, created_at, approved_at, pass_until FROM reddit_claims
      WHERE ref_code = $1 ORDER BY created_at DESC LIMIT 1`,
    [refCode],
  );
}

/** Waiting claims first, then the 20 most recent decisions. */
export async function listClaimsForAdmin() {
  const pending = await query(
    `SELECT * FROM reddit_claims WHERE status = 'pending' ORDER BY created_at LIMIT 100`,
  );
  const recent = await query(
    `SELECT * FROM reddit_claims WHERE status <> 'pending' ORDER BY coalesce(approved_at, created_at) DESC LIMIT 20`,
  );
  return { pending, recent };
}

/** Approve or reject a waiting claim. An approved pass starts on the visitor's next visit. */
export function decideClaim(id, approve) {
  return queryOne(
    `UPDATE reddit_claims
        SET status = $2, approved_at = CASE WHEN $2 = 'approved' THEN now() END
      WHERE id = $1 AND status = 'pending'
      RETURNING id, status`,
    [id, approve ? "approved" : "rejected"],
  );
}
