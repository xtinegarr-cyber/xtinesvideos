import { isNew } from "./format";
import { fileUrl } from "./storage";

/**
 * Database creator row -> what a creator card shows. Visitors without VIP
 * only ever get the pre-blurred picture of a VIP creator.
 */
export async function creatorCard(row, viewer, now = Date.now()) {
  const locked = row.tier === "vip" && !viewer?.isVip;
  return {
    id: Number(row.id),
    slug: row.slug,
    name: row.name,
    tier: row.tier,
    views: Number(row.view_count) || 0,
    isNew: isNew(row.created_at, now),
    locked,
    imageUrl: await fileUrl(locked ? row.avatar_blur_key : row.avatar_key),
  };
}

/** Database media row -> grid item. Locked items get no playable link. */
export async function mediaItem(row, locked) {
  return {
    id: Number(row.id),
    kind: row.kind,
    title: row.kind === "video" ? (row.title ?? null) : null, // photos don't have titles
    width: row.width,
    height: row.height,
    duration: row.duration_seconds,
    thumbUrl: await fileUrl(locked ? row.thumb_blur_key : row.thumb_key),
    url: locked ? null : await fileUrl(row.file_key),
  };
}
