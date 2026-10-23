// /sitemap.xml: every creator and every video or photo page, for search engines.
import { listCreators, listMediaForSitemap } from "@/lib/creators";

export const dynamic = "force-dynamic";

const base = () => (process.env.SITE_URL || "http://localhost:3000").replace(/\/+$/, "");

export default async function sitemap() {
  const site = base();
  const [creators, media] = await Promise.all([listCreators(), listMediaForSitemap()]);
  return [
    { url: `${site}/`, changeFrequency: "daily", priority: 1 },
    ...creators.map((c) => ({ url: `${site}/${c.slug}`, lastModified: new Date(c.created_at), changeFrequency: "daily", priority: 0.8 })),
    ...media.map((m) => ({ url: `${site}/${m.slug}/v/${m.id}`, lastModified: new Date(m.created_at), priority: 0.6 })),
  ];
}
