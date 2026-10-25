/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  // Every page's title, description, canonical link and preview tags go in
  // the <head> of the first response, for every visitor and crawler.
  // Otherwise Next.js only does that for crawlers on its own list (plain
  // Googlebot and Telegram's link previews aren't sure to be on it) and
  // slips the tags in later for everyone else. Costs nothing here: each
  // page needs the same database lookup for its content anyway.
  htmlLimitedBots: /.*/,
  // These run only on the server and should not be bundled.
  serverExternalPackages: [
    "pg",
    "@aws-sdk/client-s3",
    "@aws-sdk/lib-storage",
    "@aws-sdk/s3-request-presigner",
    "stripe",
  ],
};

export default nextConfig;
