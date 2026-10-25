// Small helpers with no dependencies, shared by server and client code.

export const NEW_BADGE_HOURS = 72;

const compact = new Intl.NumberFormat("en", {
  notation: "compact",
  maximumFractionDigits: 1,
});

/** 950 -> "950 views", 12_400 -> "12.4K views", 1 -> "1 view" */
export function formatViews(count) {
  const n = Number(count) || 0;
  const label = n === 1 ? "view" : "views";
  return `${n < 1000 ? n : compact.format(n)} ${label}`;
}

/** True during the first 72 hours after a creator profile is created. */
export function isNew(createdAt, now = Date.now()) {
  const created = new Date(createdAt).getTime();
  if (Number.isNaN(created)) return false;
  return now - created < NEW_BADGE_HOURS * 60 * 60 * 1000;
}

/**
 * A creator's web address: "gamercool 123" -> "gamercool_123", so their
 * profile lives at yoursite.com/gamercool_123.
 */
export function slugify(name) {
  const slug = String(name)
    .normalize("NFKD")
    .replace(/\p{M}/gu, "") // drop accents: "Mía" -> "mia"
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
  return slug || "creator";
}

/** Addresses the site itself uses, so no creator can take them. */
export const RESERVED_SLUGS = new Set([
  "admin", "login", "logout", "signup", "register", "vip", "account", "api",
  "search", "settings", "help", "support", "about", "terms", "privacy",
  "creators", "creator", "media", "static", "assets", "public",
  "favicon", "robots", "sitemap", "_next",
]);

export const SLUG_PATTERN = /^[a-z0-9_]{1,64}$/;

/** 75.4 -> "1:15", 3725 -> "1:02:05" */
export function formatDuration(seconds) {
  const total = Math.max(0, Math.round(Number(seconds) || 0));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}

// The server runs on UTC; dates are shown (and picked in the admin panel)
// in this time zone. Set ADMIN_TIMEZONE to change it.
function siteTimeZone() {
  const wanted = (typeof process !== "undefined" && process.env?.ADMIN_TIMEZONE) || "America/Chicago";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: wanted });
    return wanted;
  } catch {
    return "America/Chicago"; // a typo in ADMIN_TIMEZONE mustn't break pages
  }
}
export const SITE_TIME_ZONE = siteTimeZone();

const dateFormat = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: SITE_TIME_ZONE,
});

const zoneParts = new Intl.DateTimeFormat("en-US", {
  timeZone: SITE_TIME_ZONE,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

/** How far the site's time zone is ahead of UTC at a moment, in ms. */
function zoneOffset(ms) {
  const p = Object.fromEntries(zoneParts.formatToParts(ms).map((x) => [x.type, Number(x.value)]));
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(ms / 1000) * 1000;
}

/** "2026-10-31" -> the last second of that day in the site's time zone. Null if invalid. */
export function endOfDay(dateText) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateText))) return null;
  const wall = Date.parse(`${dateText}T23:59:59Z`);
  if (Number.isNaN(wall)) return null;
  const first = wall - zoneOffset(wall);
  return new Date(wall - zoneOffset(first)); // second pass: right across daylight saving changes
}

export function formatDate(value) {
  if (!value) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "" : dateFormat.format(d);
}

export function formatBytes(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = n / 1024;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i++;
  }
  return `${value.toFixed(value < 10 ? 1 : 0)} ${units[i]}`;
}

/** "Mia Rose" -> "MR" for profile picture placeholders. */
export function initials(name) {
  return (
    String(name)
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0] || "")
      .join("")
      .toUpperCase() || "?"
  );
}

export const TITLE_MAX = 120;

// Words cameras and apps put in file names. A name made only of these and
// numbers ("IMG_1234", "Screen Recording 2024-01-01 at 10.00.00") isn't a
// title, so the video shows as "<creator> video" until you give it one.
const FILE_NAME_NOISE = new Set(
  "img image vid video mov mvi dsc dscn dcim pxl gopr gh screen recording screenrecording rpreplay record trim trimmed clip copy final edit edited untitled new file snapchat tiktok whatsapp signal telegram imovie capcut export at pm am".split(" "),
);

/** "my_trip-to vegas.MOV" -> "My trip to vegas". Null for camera-style names. */
export function titleFromFileName(fileName) {
  let text = String(fileName || "").replace(/\.[a-z0-9]{2,5}$/i, "");
  text = text.replace(/[_.]+/g, " ").replace(/(\p{L})-(?=\p{L})/gu, "$1 ").replace(/\s+/g, " ").trim();
  const meaningful = text
    .toLowerCase()
    .split(/[\s\-–—,()[\]{}!?]+/)
    .filter((chunk) => !(/^[a-f0-9]{6,}$/.test(chunk) && /\d/.test(chunk))) // hex IDs
    .map((chunk) => chunk.replace(/[^\p{L}]+/gu, ""))
    .filter((word) => word.length >= 2 && !FILE_NAME_NOISE.has(word));
  if (meaningful.join("").length < 3) return null;
  return cleanTitle(text.charAt(0).toUpperCase() + text.slice(1));
}

/** A title as typed: trimmed, single spaces, at most TITLE_MAX characters. Empty -> null. */
export function cleanTitle(value) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim().slice(0, TITLE_MAX).trim();
  return text || null;
}

/** "Gamer Plays Minecraft! (With Glasses)" -> "gamer-plays-minecraft-with-glasses" for links. */
export function titleSlug(title) {
  const slug = String(title ?? "")
    .normalize("NFKD")
    .replace(/\p{M}/gu, "") // "Mía" -> "mia"
    .toLowerCase()
    .replace(/['’]/g, "") // "Ava's" -> "avas", not "ava-s"
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (slug.length <= 70) return slug;
  // Long titles are cut at a word, so links stay readable.
  const cut = slug.slice(0, 71);
  return cut.slice(0, cut.lastIndexOf("-") > 30 ? cut.lastIndexOf("-") : 70).replace(/-+$/, "");
}

/**
 * A video's or photo's page: /ava/12-gamer-plays-minecraft, or /ava/12
 * without a title. The number is what finds it, so a rename never breaks
 * a link: other wording redirects to the current one.
 */
export function mediaPath(creatorSlug, media) {
  const words = media.kind === "video" ? titleSlug(media.title) : "";
  return `/${creatorSlug}/${Number(media.id)}${words ? `-${words}` : ""}`;
}

/** The number from the last part of a page's link ("12-gamer-plays" -> 12), or null. */
export function mediaIdFromParam(value) {
  const match = /^(\d{1,15})(?:-[a-z0-9-]*)?$/i.exec(String(value ?? ""));
  return match ? Number(match[1]) : null;
}

/** What a video is called on the site ("<creator> video" until it has a title). Photos have no titles. */
export function displayTitle(title, creatorName, kind) {
  if (kind === "image") return `${creatorName} photo`;
  return title || `${creatorName} video`;
}

/** 95 seconds -> "PT1M35S" (the format search engines use for video length). */
export function isoDuration(seconds) {
  const total = Math.max(0, Math.round(Number(seconds) || 0));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `PT${h ? `${h}H` : ""}${m ? `${m}M` : ""}${s || (!h && !m) ? `${s}S` : ""}`;
}
