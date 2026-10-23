// /robots.txt: keep private pages out of search engines.
export default function robots() {
  const site = (process.env.SITE_URL || "http://localhost:3000").replace(/\/+$/, "");
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/account", "/login", "/api/", "/vip/success"] }],
    sitemap: `${site}/sitemap.xml`,
  };
}
