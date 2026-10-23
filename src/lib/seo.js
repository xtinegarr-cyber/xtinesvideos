// The words search engines see for a video or photo page. The page itself
// and the sitemap use the same ones, as Google asks.
import { SITE_NAME } from "./site";

/** Only videos have titles. */
export const titleOf = (media) => (media.kind === "video" ? media.title : null);

/** Needs creator_name and creator_tier on the row. */
export function mediaDescription(media) {
  const what = media.kind === "video" ? "video" : "photo";
  const title = titleOf(media);
  const named = title ? `“${title}”, a ${what} from ${media.creator_name}` : `this ${what} from ${media.creator_name}`;
  return media.creator_tier === "free"
    ? `Watch ${named}, free on ${SITE_NAME}.`
    : `${media.creator_name} is a VIP creator. Get VIP to see ${named} on ${SITE_NAME}.`;
}
