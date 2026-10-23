// Looks up Reddit posts for the "post on Reddit, get 30 minutes of VIP"
// reward. With REDDIT_CLIENT_ID and REDDIT_CLIENT_SECRET (a Reddit app) it
// uses Reddit's API; without them it tries Reddit's public post data. If
// Reddit can't be reached or blocks the server, the caller sends the post
// to the admin panel to approve by hand instead.

const USER_AGENT = process.env.REDDIT_USER_AGENT || "web:xtines-videos:1.0";
const POST_ID = /^[a-z0-9]{4,12}$/i;
const TIMEOUT_MS = 8000;
// Posts older than this don't count, so old posts can't be reused.
export const MAX_POST_AGE_HOURS = 24;

export function redditApiConfigured() {
  return Boolean(process.env.REDDIT_CLIENT_ID && process.env.REDDIT_CLIENT_SECRET);
}

/**
 * A link someone pasted -> { postId } for a normal post link, { shareUrl }
 * for the app's short share links (/r/name/s/AbC123), or null.
 */
export function parsePostLink(input) {
  let url;
  try {
    url = new URL(String(input ?? "").trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  if (host === "redd.it") {
    const id = url.pathname.split("/")[1] ?? "";
    return POST_ID.test(id) ? { postId: id.toLowerCase() } : null;
  }
  if (host !== "reddit.com" && !host.endsWith(".reddit.com")) return null;
  const comments = url.pathname.match(/\/comments\/([a-z0-9]+)/i);
  if (comments && POST_ID.test(comments[1])) return { postId: comments[1].toLowerCase() };
  const share = url.pathname.match(/^\/r\/([A-Za-z0-9_]+)\/s\/([A-Za-z0-9]+)\/?$/);
  if (share) return { shareUrl: `https://www.reddit.com/r/${share[1]}/s/${share[2]}` };
  return null;
}

export const postUrlFor = (postId) => `https://www.reddit.com/comments/${postId}`;

/** Follows an app share link to the post it points at. Null if Reddit won't say. */
export async function resolveShareLink(shareUrl) {
  try {
    const res = await fetch(shareUrl, {
      redirect: "manual",
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const location = res.headers.get("location");
    return location ? (parsePostLink(new URL(location, shareUrl).href)?.postId ?? null) : null;
  } catch {
    return null;
  }
}

async function apiToken() {
  const cached = globalThis.__xvRedditToken;
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;
  const auth = Buffer.from(`${process.env.REDDIT_CLIENT_ID}:${process.env.REDDIT_CLIENT_SECRET}`).toString("base64");
  const res = await fetch("https://www.reddit.com/api/v1/access_token", {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "User-Agent": USER_AGENT, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.access_token) throw new Error(`Reddit login failed (${res.status})`);
  globalThis.__xvRedditToken = { token: data.access_token, expiresAt: Date.now() + (data.expires_in || 3600) * 1000 };
  return data.access_token;
}

/**
 * { reachable: true, post } (post is null if it doesn't exist), or
 * { reachable: false } when Reddit can't be reached or blocks the server.
 */
export async function fetchPost(postId) {
  if (!POST_ID.test(postId)) return { reachable: true, post: null };
  try {
    let res;
    if (redditApiConfigured()) {
      res = await fetch(`https://oauth.reddit.com/api/info?id=t3_${postId}&raw_json=1`, {
        headers: { Authorization: `Bearer ${await apiToken()}`, "User-Agent": USER_AGENT },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } else {
      res = await fetch(`https://www.reddit.com/api/info.json?id=t3_${postId}&raw_json=1`, {
        headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    }
    if (!res.ok) return { reachable: false, status: res.status };
    const data = await res.json().catch(() => null);
    if (!data?.data || !Array.isArray(data.data.children)) return { reachable: false };
    return { reachable: true, post: data.data.children[0]?.data ?? null };
  } catch (err) {
    console.error("Reddit lookup failed:", err?.message || err);
    return { reachable: false };
  }
}

/**
 * Links in a post to one of the site's video pages (/creator/v/123?r=code).
 * Returns [{ slug, mediaId, code }].
 */
export function findSiteLinks(post, siteHost) {
  const host = siteHost.toLowerCase().replace(/^www\./, "").replace(/\./g, "\\.");
  const pattern = new RegExp(`https?://(?:www\\.)?${host}/([a-z0-9_]{1,64})/v/(\\d+)(?:/)?(\\?[^\\s)\\]>"']*)?`, "gi");
  const text = [post.url, post.url_overridden_by_dest, post.selftext, post.title].filter(Boolean).join("\n");
  const found = [];
  for (const match of text.matchAll(pattern)) {
    const params = new URLSearchParams((match[3] || "").replace(/&amp;/g, "&"));
    found.push({ slug: match[1].toLowerCase(), mediaId: Number(match[2]), code: params.get("r") });
  }
  return found;
}

/**
 * Checks a post someone submitted. Returns { link } (their link to the site)
 * or { error } with what's wrong, in plain words.
 */
export function checkPost(post, { refCode, siteHost, now = Date.now() }) {
  if (!post) return { error: "We couldn’t find that Reddit post. Check the link and try again." };
  if (post.removed_by_category || post.removed || post.banned_by) {
    return { error: "That post has been removed from Reddit, so it doesn’t count. Posts have to stay up." };
  }
  if (!post.author || post.author === "[deleted]") return { error: "That post was deleted, so it doesn’t count." };
  const ageHours = (now - Number(post.created_utc) * 1000) / 3_600_000;
  if (!(ageHours <= MAX_POST_AGE_HOURS)) {
    return { error: `That post is older than ${MAX_POST_AGE_HOURS} hours. Make a new post with your link.` };
  }
  const links = findSiteLinks(post, siteHost);
  if (!links.length) {
    return { error: "That post doesn’t have your video link in it. Copy your link from a video’s Share button and put it in the post." };
  }
  const mine = links.find((link) => link.code === refCode);
  if (!mine) {
    return { error: "That post has someone else’s share link. Open a video on this site, tap Share, and use the link it gives you." };
  }
  return { link: mine };
}
