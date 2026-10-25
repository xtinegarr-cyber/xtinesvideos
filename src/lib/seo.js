// The words search engines see for a video or photo page. The page itself
// and the sitemap use the same ones, as Google asks.
import { formatDate, formatDuration } from "./format";
import { SITE_NAME } from "./site";

/** Only videos have titles. */
export const titleOf = (media) => (media.kind === "video" ? media.title : null);

/**
 * Unique per video (Google asks for that): its title, length and upload
 * date. Needs creator_name, creator_tier and created_at on the row.
 * "Watch “Beach day”, a 2:15 video from Ava Monroe, free on XTINE’S VIDEOS. Added Oct 23, 2026."
 */
export function mediaDescription(media) {
  const video = media.kind === "video";
  const length = video && Number(media.duration_seconds) >= 1 ? `${formatDuration(media.duration_seconds)} ` : "";
  const what = `${length}${video ? "video" : "photo"}`;
  const title = titleOf(media);
  const article = /^[aeiou8]/i.test(what) || /^1[18]:/.test(what) ? "an" : "a";
  const named = title ? `“${title}”, ${article} ${what} from ${media.creator_name}` : `this ${what} from ${media.creator_name}`;
  const added = formatDate(media.created_at);
  const when = added ? ` Added ${added}.` : "";
  return media.creator_tier === "free"
    ? `Watch ${named}, free on ${SITE_NAME}.${when}`
    : `${media.creator_name} is a VIP creator. Get VIP to see ${named} on ${SITE_NAME}.${when}`;
}
