import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { query, queryOne } from "./db";
import { hashToken, newSessionToken } from "./passwords";
import { toViewer } from "./vip";
import { activePass, readRefCode } from "./vip-pass";

export const SESSION_COOKIE = "xv_session";
const SESSION_DAYS = 30;

export async function startSession(userId) {
  const token = newSessionToken();
  const expires = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await query("DELETE FROM sessions WHERE expires_at < now()");
  await query("INSERT INTO sessions (id, user_id, expires_at) VALUES ($1, $2, $3)", [
    hashToken(token),
    userId,
    expires,
  ]);
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires,
  });
}

export async function endSession() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) await query("DELETE FROM sessions WHERE id = $1", [hashToken(token)]);
  store.delete(SESSION_COOKIE);
}

/** The logged-in visitor for this request, or null. */
export const getViewer = cache(async () => {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const row = await queryOne(
    `SELECT u.* FROM sessions s
       JOIN users u ON u.id = s.user_id
      WHERE s.id = $1 AND s.expires_at > now()`,
    [hashToken(token)],
  );
  return toViewer(row);
});

/**
 * Who can see VIP content on this request: VIP members, plus anyone with
 * a 30-minute pass from posting on Reddit (no account needed).
 * `viewer` is still the logged-in member (or null) for everything else.
 */
export const getAccess = cache(async () => {
  const viewer = await getViewer();
  const pass = viewer?.isVip ? null : await activePass(await readRefCode());
  return { viewer, pass, isVip: Boolean(viewer?.isVip || pass) };
});

/** For admin pages and server actions: sends everyone else to the login page. */
export async function requireAdmin() {
  const viewer = await getViewer();
  if (!viewer?.isAdmin) redirect("/login?next=/admin");
  return viewer;
}

/** For admin API routes, which answer with an error instead of redirecting. */
export async function adminOrNull() {
  const viewer = await getViewer();
  return viewer?.isAdmin ? viewer : null;
}

/** The site's public address, for links sent to Stripe. */
export async function siteUrl() {
  if (process.env.SITE_URL) return process.env.SITE_URL.replace(/\/+$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") || h.get("host") || "localhost:3000";
  const proto = h.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
