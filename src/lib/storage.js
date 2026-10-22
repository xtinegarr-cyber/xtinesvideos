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

// Values pasted into Coolify sometimes pick up stray spaces.
const env = (name) => (process.env[name] || "").trim();
const bucket = () => env("R2_BUCKET");

export function storageConfigured() {
  return Boolean(env("R2_ACCOUNT_ID") && env("R2_ACCESS_KEY_ID") && env("R2_SECRET_ACCESS_KEY") && bucket());
}

// R2_ACCOUNT_ID is normally just the account ID, but the full S3 address
// (https://<id>.r2.cloudflarestorage.com, with or without the bucket) works too.
function endpoint() {
  const value = env("R2_ACCOUNT_ID");
  if (/^https?:\/\//i.test(value)) return `https://${new URL(value).host}`;
  if (value.includes(".")) return `https://${value.split("/")[0]}`;
  return `https://${value}.r2.cloudflarestorage.com`;
}

function client() {
  if (!globalThis.__xvR2) {
    globalThis.__xvR2 = new S3Client({
      region: "auto",
      endpoint: endpoint(),
      credentials: {
        accessKeyId: env("R2_ACCESS_KEY_ID"),
        secretAccessKey: env("R2_SECRET_ACCESS_KEY"),
      },
      // R2 doesn't need the extra checksums newer AWS SDKs send by default.
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
    });
  }
  return globalThis.__xvR2;
}

/** R2 refused a file. The message says which setting in Coolify to fix. */
export class StorageError extends Error {}

export function explainStorageError(err) {
  const name = String(err?.name || err?.Code || err?.code || "");
  const text = `${name} ${err?.message || ""}`;
  const status = err?.$metadata?.httpStatusCode;
  if (/access key has length|InvalidAccessKeyId/i.test(text)) {
    return "Cloudflare R2 didn't accept the Access Key ID. Check R2_ACCESS_KEY_ID in Coolify: it should be the 32-character Access Key ID, not the token value.";
  }
  if (/SignatureDoesNotMatch/i.test(text)) {
    return "Cloudflare R2 didn't accept the Secret Access Key. Check R2_SECRET_ACCESS_KEY in Coolify.";
  }
  if (/NoSuchBucket/i.test(text)) {
    return `Cloudflare R2 has no bucket named "${bucket()}". Check R2_BUCKET in Coolify: it has to match the bucket's name exactly.`;
  }
  if (/AccessDenied|Unauthorized|Forbidden/i.test(text) || status === 401 || status === 403) {
    return `The R2 API token isn't allowed to save files in "${bucket()}". Give the token Object Read & Write permission for that bucket.`;
  }
  if (/ENOTFOUND|EAI_AGAIN|ECONNREFUSED|ECONNRESET|ETIMEDOUT|CERT|getaddrinfo|Invalid URL/i.test(text)) {
    return "The server couldn't reach Cloudflare R2. Check R2_ACCOUNT_ID in Coolify: it should be your 32-character Account ID.";
  }
  return `Cloudflare R2 refused the file (${name || "unknown error"}). The server log has details.`;
}

export async function uploadFile(key, filePath, contentType) {
  const upload = new Upload({
    client: client(),
    params: {
      Bucket: bucket(),
      Key: key,
      Body: createReadStream(filePath),
      ContentType: contentType,
      // Every upload gets a new key, so files never change once stored.
      CacheControl: "private, max-age=31536000, immutable",
    },
    partSize: 64 * 1024 * 1024,
    queueSize: 3,
  });
  try {
    await upload.done();
  } catch (err) {
    console.error(`Saving ${key} to R2 failed:`, err);
    throw new StorageError(explainStorageError(err));
  }
}

export async function deleteFiles(keys) {
  if (!storageConfigured()) return;
  const unique = [...new Set(keys.filter(Boolean))];
  await Promise.all(
    unique.map((Key) =>
      client()
        .send(new DeleteObjectCommand({ Bucket: bucket(), Key }))
        .catch((err) => console.error(`Could not delete ${Key} from R2:`, err.message)),
    ),
  );
}

/** A temporary link to a stored file, or null when storage isn't set up. */
export async function fileUrl(key) {
  if (!key || !storageConfigured()) return null;
  const signingDate = new Date(Math.floor(Date.now() / HOUR_MS) * HOUR_MS);
  return getSignedUrl(client(), new GetObjectCommand({ Bucket: bucket(), Key: key }), {
    expiresIn: LINK_LIFETIME_SECONDS,
    signingDate,
  });
}
