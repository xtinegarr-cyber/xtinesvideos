// IndexNow: tells Bing right away when a page is added, renamed or
// removed, instead of waiting for it to crawl the site. Bing shares these
// with the other IndexNow search engines (Yandex, Naver, Seznam, Yep);
// Google doesn't use IndexNow (it reads the sitemap instead).
//
// Nothing to set up: the site makes its own key the first time and
// publishes it at /indexnow-key.txt, which is how search engines check
// the pings really come from this site. Set INDEXNOW=off to stop it.
import { randomBytes } from "node:crypto";
import { query, queryOne } from "./db";

const ENDPOINT = "https://api.indexnow.org/indexnow";
export const KEY_PATH = "/indexnow-key.txt";
// Changes are collected for a minute and sent together, so a big upload
// batch becomes a few requests instead of hundreds.
const BATCH_MS = 60_000;
const MAX_URLS = 10_000; // IndexNow's limit per request
const MAX_TRIES = 5;

const state = globalThis.__xvIndexNow ?? (globalThis.__xvIndexNow = { pending: new Map(), timer: null, key: null });

/** The site's public https address, or null (local testing, or turned off). */
function siteBase() {
  if ((process.env.INDEXNOW || "").trim().toLowerCase() === "off") return null;
  try {
    const url = new URL((process.env.SITE_URL || "").trim());
    if (url.protocol !== "https:" || ["localhost", "127.0.0.1"].includes(url.hostname)) return null;
    return url.origin;
  } catch {
    return null;
  }
}

/** The key search engines check against /indexnow-key.txt. Made once, kept in the database. */
export async function indexNowKey() {
  if (state.key) return state.key;
  await query("INSERT INTO app_settings (key, value) VALUES ('indexnow_key', $1) ON CONFLICT (key) DO NOTHING", [
    randomBytes(16).toString("hex"),
  ]);
  const row = await queryOne("SELECT value FROM app_settings WHERE key = 'indexnow_key'");
  state.key = row.value;
  return state.key;
}

function schedule(delay = BATCH_MS) {
  if (state.timer || !state.pending.size) return;
  state.timer = setTimeout(() => {
    state.timer = null;
    sendPending().catch((err) => console.error("IndexNow failed:", err?.message || err));
  }, delay);
  state.timer.unref?.();
}

/**
 * Queues site pages ("/ava/12-beach-day", "/ava") to tell search engines
 * about. Safe to call anywhere: it never throws and never slows a request.
 */
export function notifyIndexNow(paths) {
  if (!siteBase()) return;
  for (const path of [].concat(paths)) {
    if (typeof path === "string" && path.startsWith("/") && !state.pending.has(path)) state.pending.set(path, 0);
  }
  schedule();
}

/** Sends what's queued now. Exported for tests. */
export async function sendPending() {
  const base = siteBase();
  if (!base || !state.pending.size) return;
  const batch = [...state.pending.entries()].slice(0, MAX_URLS);
  for (const [path] of batch) state.pending.delete(path);

  let status = 0;
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        host: new URL(base).host,
        key: await indexNowKey(),
        keyLocation: `${base}${KEY_PATH}`,
        urlList: batch.map(([path]) => `${base}${path}`),
      }),
      signal: AbortSignal.timeout(15_000),
    });
    status = res.status;
  } catch (err) {
    console.warn("IndexNow couldn't be reached:", err?.message || err);
  }

  if (status === 200 || status === 202) {
    // 202: the key is new and still being checked; the pages are accepted.
    console.log(`IndexNow: told search engines about ${batch.length} page${batch.length === 1 ? "" : "s"}.`);
  } else if (status === 0 || status === 429 || status >= 500) {
    // Busy or unreachable: try these again later (a few times at most).
    for (const [path, tries] of batch) if (tries + 1 < MAX_TRIES) state.pending.set(path, tries + 1);
    schedule(5 * BATCH_MS);
  } else {
    console.warn(`IndexNow turned the update down (${status}). Pages are still found through the sitemap.`);
  }
  schedule(); // anything queued meanwhile, or past the 10,000 limit
}
