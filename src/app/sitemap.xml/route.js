// /sitemap.xml: every creator and every video or photo page, for search
// engines. Free creators' videos also carry their details (title,
// thumbnail, length, a link to the file), so Google knows about them as
// videos before it visits each page. "lastmod" tells Google which pages
// changed: a video when it's uploaded or renamed, a creator's page when
// one of their videos is.
import { listCreators, listMediaForSitemap } from "@/lib/creators";
import { displayTitle, mediaPath } from "@/lib/format";
import { mediaDescription, titleOf } from "@/lib/seo";

export const dynamic = "force-dynamic";

const base = () => (process.env.SITE_URL || "http://localhost:3000").replace(/\/+$/, "");

const ENTITIES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" };
// eslint-disable-next-line no-control-regex
const esc = (value) => String(value).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").replace(/[&<>"']/g, (c) => ENTITIES[c]);

const time = (date) => (date ? new Date(date).getTime() : 0);
const later = (a, b) => (time(b) > time(a) ? b : a);
const stamp = (date) => (date ? `<lastmod>${new Date(date).toISOString()}</lastmod>` : "");

function video(site, m) {
  const seconds = Math.round(Number(m.duration_seconds) || 0);
  return [
    "<video:video>",
    `<video:thumbnail_loc>${esc(`${site}/media/${m.id}/thumb`)}</video:thumbnail_loc>`,
    `<video:title>${esc(displayTitle(titleOf(m), m.creator_name, m.kind))}</video:title>`,
    `<video:description>${esc(mediaDescription(m).slice(0, 2048))}</video:description>`,
    `<video:content_loc>${esc(`${site}/media/${m.id}/video`)}</video:content_loc>`,
    seconds >= 1 && seconds <= 28800 ? `<video:duration>${seconds}</video:duration>` : "",
    `<video:publication_date>${new Date(m.created_at).toISOString()}</video:publication_date>`,
    `<video:uploader info="${esc(`${site}/${m.creator_slug}`)}">${esc(String(m.creator_name).slice(0, 255))}</video:uploader>`,
    "</video:video>",
  ].join("");
}

export async function GET() {
  const site = base();
  const [creators, media] = await Promise.all([listCreators(), listMediaForSitemap()]);

  const creatorChanged = new Map();
  let siteChanged = null;
  const pages = media.map((m) => {
    const changed = later(m.created_at, m.updated_at);
    creatorChanged.set(m.creator_slug, later(creatorChanged.get(m.creator_slug), changed));
    siteChanged = later(siteChanged, changed);
    const extra = m.kind === "video" && m.creator_tier === "free" ? video(site, m) : "";
    return `<url><loc>${esc(`${site}${mediaPath(m.creator_slug, m)}`)}</loc>${stamp(changed)}${extra}</url>`;
  });

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">',
    `<url><loc>${esc(`${site}/`)}</loc>${stamp(siteChanged)}</url>`,
    ...creators.map(
      (c) => `<url><loc>${esc(`${site}/${c.slug}`)}</loc>${stamp(later(c.created_at, creatorChanged.get(c.slug)))}</url>`,
    ),
    ...pages,
    "</urlset>",
    "",
  ].join("\n");

  return new Response(xml, {
    headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=600" },
  });
}
