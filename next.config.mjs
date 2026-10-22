/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
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
