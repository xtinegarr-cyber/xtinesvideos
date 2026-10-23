import { query, queryOne } from "./db";
import { RESERVED_SLUGS, slugify } from "./format";

const CREATOR_FIELDS = "id, slug, name, tier, avatar_key, avatar_blur_key, view_count, created_at";

function escapeLike(text) {
  return String(text).replace(/[\\%_]/g, (c) => `\\${c}`);
}

// A to Z, ignoring capitals and accents, with numbers in counting order
// ("creator 2" before "creator 10").
const collator = new Intl.Collator("en", { sensitivity: "base", numeric: true });
const aToZ = (rows) => rows.sort((a, b) => collator.compare(a.name, b.name) || Number(a.id) - Number(b.id));

/** A to Z by name, optionally filtered by a name search. */
export async function listCreators({ search = "" } = {}) {
  const q = search.trim();
  if (!q) {
    return aToZ(await query(`SELECT ${CREATOR_FIELDS} FROM creators ORDER BY lower(name), id`));
  }
  return aToZ(
    await query(
      `SELECT ${CREATOR_FIELDS} FROM creators
        WHERE name ILIKE $1
        ORDER BY lower(name), id`,
      [`%${escapeLike(q)}%`],
    ),
  );
}

export function getCreatorBySlug(slug) {
  return queryOne(`SELECT ${CREATOR_FIELDS} FROM creators WHERE slug = $1`, [slug]);
}

export function getCreatorById(id) {
  return queryOne(`SELECT ${CREATOR_FIELDS} FROM creators WHERE id = $1`, [id]);
}

/** For the admin panel, A to Z: totals plus views in the last 7 days. */
export async function listCreatorsForAdmin() {
  return aToZ(await query(
    `SELECT c.id, c.slug, c.name, c.tier, c.avatar_key, c.avatar_blur_key, c.view_count, c.created_at,
            (SELECT count(*)::int FROM media m WHERE m.creator_id = c.id) AS media_count,
            (SELECT count(*)::int FROM creator_views v
              WHERE v.creator_id = c.id AND v.view_date > current_date - 7) AS views_7d
       FROM creators c
      ORDER BY lower(c.name), c.id`,
  ));
}

export async function createCreator({ name, tier, avatarKey = null, avatarBlurKey = null }) {
  const base = slugify(name);
  // A taken or reserved address gets a number: jadegamer -> jadegamer_2
  const first = RESERVED_SLUGS.has(base) ? 2 : 1;
  for (let attempt = first; attempt <= 50; attempt++) {
    const slug = attempt === 1 ? base : `${base}_${attempt}`;
    const row = await queryOne(
      `INSERT INTO creators (slug, name, tier, avatar_key, avatar_blur_key)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (slug) DO NOTHING
       RETURNING ${CREATOR_FIELDS}`,
      [slug, name, tier, avatarKey, avatarBlurKey],
    );
    if (row) return row;
  }
  throw new Error("Could not find a free web address for this creator name.");
}

/** Saves a new profile picture and returns the old file keys to delete. */
export async function setCreatorAvatar(id, { avatarKey, avatarBlurKey }) {
  const old = await queryOne("SELECT avatar_key, avatar_blur_key FROM creators WHERE id = $1", [id]);
  await query("UPDATE creators SET avatar_key = $2, avatar_blur_key = $3 WHERE id = $1", [
    id,
    avatarKey,
    avatarBlurKey,
  ]);
  return old ? [old.avatar_key, old.avatar_blur_key] : [];
}

export async function setCreatorTier(id, tier) {
  await query("UPDATE creators SET tier = $2 WHERE id = $1", [id, tier]);
}

/** Deletes the creator and their uploads; returns the file keys to remove. */
export async function deleteCreator(id) {
  const files = await query(
    `SELECT unnest(ARRAY[file_key, thumb_key, thumb_blur_key]) AS key FROM media WHERE creator_id = $1
     UNION ALL
     SELECT unnest(ARRAY[avatar_key, avatar_blur_key]) FROM creators WHERE id = $1`,
    [id],
  );
  await query("DELETE FROM creators WHERE id = $1", [id]);
  return files.map((f) => f.key).filter(Boolean);
}

export function listMedia(creatorId) {
  return query(
    `SELECT id, kind, title, file_key, content_type, thumb_key, thumb_blur_key, width, height,
            duration_seconds, created_at
       FROM media WHERE creator_id = $1
      ORDER BY created_at DESC, id DESC`,
    [creatorId],
  );
}

/** Saves a processed upload. Returns null if this upload was already saved. */
export function insertMedia(media) {
  return queryOne(
    `INSERT INTO media (creator_id, kind, file_key, content_type, thumb_key, thumb_blur_key,
                        width, height, duration_seconds, size_bytes, original_name, upload_id, title)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
     ON CONFLICT (upload_id) DO NOTHING
     RETURNING id`,
    [
      media.creatorId,
      media.kind,
      media.fileKey,
      media.contentType,
      media.thumbKey,
      media.thumbBlurKey,
      media.width,
      media.height,
      media.duration,
      media.sizeBytes,
      media.originalName,
      media.uploadId ?? null,
      media.title ?? null,
    ],
  );
}

/** One upload with its creator, for its own page (/creator/v/123). */
export function getMediaWithCreator(id) {
  if (!Number.isSafeInteger(Number(id)) || Number(id) <= 0) return null;
  return queryOne(
    `SELECT m.*, c.slug AS creator_slug, c.name AS creator_name, c.tier AS creator_tier,
            c.avatar_key AS creator_avatar_key, c.avatar_blur_key AS creator_avatar_blur_key
       FROM media m JOIN creators c ON c.id = m.creator_id
      WHERE m.id = $1`,
    [Number(id)],
  );
}

/** Renames a video or photo. Returns its creator's slug, or null if it's gone. */
export async function setMediaTitle(id, title) {
  const row = await queryOne(
    `UPDATE media m SET title = $2 FROM creators c
      WHERE m.id = $1 AND c.id = m.creator_id
      RETURNING c.slug`,
    [id, title],
  );
  return row?.slug ?? null;
}

/** Every video and photo with its creator's address, for the sitemap. */
export function listMediaForSitemap() {
  return query(
    `SELECT m.id, m.created_at, c.slug FROM media m JOIN creators c ON c.id = m.creator_id
      ORDER BY m.id DESC LIMIT 45000`,
  );
}

/** The saved file an upload turned into, if it finished. */
export function findMediaByUpload(uploadId) {
  return queryOne(
    `SELECT m.id, c.slug AS creator_slug FROM media m JOIN creators c ON c.id = m.creator_id WHERE m.upload_id = $1`,
    [uploadId],
  );
}

/** Deletes one upload; returns its creator's slug and the file keys to remove. */
export async function deleteMedia(id) {
  const row = await queryOne(
    `DELETE FROM media m USING creators c
      WHERE m.id = $1 AND c.id = m.creator_id
      RETURNING c.slug, m.file_key, m.thumb_key, m.thumb_blur_key`,
    [id],
  );
  return row ? { slug: row.slug, keys: [row.file_key, row.thumb_key, row.thumb_blur_key] } : null;
}

/**
 * Counts a view once per visitor per creator per day.
 * Returns true if this was a new view.
 */
export async function recordView(creatorId, visitorHash) {
  const rows = await query(
    `WITH fresh AS (
       INSERT INTO creator_views (creator_id, visitor_hash, view_date)
       VALUES ($1, $2, current_date)
       ON CONFLICT DO NOTHING
       RETURNING creator_id
     )
     UPDATE creators SET view_count = view_count + 1
      WHERE id IN (SELECT creator_id FROM fresh)
     RETURNING id`,
    [creatorId, visitorHash],
  );
  return rows.length > 0;
}

export async function siteStats() {
  return queryOne(
    `SELECT (SELECT count(*)::int FROM creators) AS creators,
            (SELECT coalesce(sum(view_count), 0)::bigint FROM creators) AS views,
            (SELECT count(*)::int FROM creator_views WHERE view_date > current_date - 7) AS views_7d,
            (SELECT count(*)::int FROM media) AS media,
            (SELECT count(*)::int FROM users
              WHERE role = 'member' AND (vip_lifetime OR vip_until > now())) AS vip_members`,
  );
}
