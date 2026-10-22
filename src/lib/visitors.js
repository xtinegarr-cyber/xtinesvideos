import { createHmac } from "node:crypto";

const BOT_PATTERN = /bot|crawl|spider|slurp|preview|facebookexternalhit|headless|lighthouse|curl|wget|python-requests/i;

export function looksLikeBot(userAgent) {
  return !userAgent || BOT_PATTERN.test(userAgent);
}

/**
 * Best guess at the visitor's real IP. Cloudflare's header is preferred
 * because Cloudflare overwrites it; X-Forwarded-For can be faked by clients.
 */
export function clientIp(headers) {
  const cf = headers.get("cf-connecting-ip");
  if (cf) return cf.trim();
  const real = headers.get("x-real-ip");
  if (real) return real.trim();
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return "unknown";
}

function secret() {
  const value = process.env.APP_SECRET;
  if (!value && process.env.NODE_ENV === "production") {
    console.warn("APP_SECRET is not set. Set it so visitor IDs cannot be guessed.");
  }
  return value || "dev-only-secret";
}

/**
 * A one-way ID for "this visitor". Logged-in members are identified by
 * account; everyone else by IP + browser. Raw IPs are never stored.
 */
export function visitorHash({ userId, ip, userAgent }) {
  const identity = userId ? `user:${userId}` : `anon:${ip}|${userAgent || ""}`;
  return createHmac("sha256", secret()).update(identity).digest("hex");
}
