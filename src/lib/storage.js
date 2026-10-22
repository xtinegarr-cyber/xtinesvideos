// Cloudflare R2 (S3-compatible). The bucket stays private: visitors get
// signed links that expire, and VIP files are only ever signed for VIP
// members, so a locked video can't be opened by guessing its address.
import { createReadStream } from "node:fs";
import { S3Client, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const HOUR_MS = 60 * 60 * 1000;
// Links last 6 hours. They're signed per clock-hour, so the same file gets
// the same link for an hour and browsers can cache it.
const LINK_LIFETIME_SECONDS = 6 * 60 * 60;

export function storageConfigured() {
  return Boolean(
    process.env.R2_ACCOUNT_ID &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY &&
      process.env.R2_BUCKET,
  );
}

function client() {
  if (!globalThis.__xvR2) {
    globalThis.__xvR2 = new S3Client({
      region: "auto",
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
      },
      // R2 doesn't need the extra checksums newer AWS SDKs send by default.
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
    });
  }
  return globalThis.__xvR2;
}

export async function uploadFile(key, filePath, contentType) {
  const upload = new Upload({
    client: client(),
    params: {
      Bucket: process.env.R2_BUCKET,
      Key: key,
      Body: createReadStream(filePath),
      ContentType: contentType,
      // Every upload gets a new key, so files never change once stored.
      CacheControl: "private, max-age=31536000, immutable",
    },
    partSize: 64 * 1024 * 1024,
    queueSize: 3,
  });
  await upload.done();
}

export async function deleteFiles(keys) {
  if (!storageConfigured()) return;
  const unique = [...new Set(keys.filter(Boolean))];
  await Promise.all(
    unique.map((Key) =>
      client()
        .send(new DeleteObjectCommand({ Bucket: process.env.R2_BUCKET, Key }))
        .catch((err) => console.error(`Could not delete ${Key} from R2:`, err.message)),
    ),
  );
}

/** A temporary link to a stored file, or null when storage isn't set up. */
export async function fileUrl(key) {
  if (!key || !storageConfigured()) return null;
  const signingDate = new Date(Math.floor(Date.now() / HOUR_MS) * HOUR_MS);
  return getSignedUrl(client(), new GetObjectCommand({ Bucket: process.env.R2_BUCKET, Key: key }), {
    expiresIn: LINK_LIFETIME_SECONDS,
    signingDate,
  });
}
