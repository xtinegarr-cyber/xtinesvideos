// Uploads arrive in 25 MB pieces so big videos get past Cloudflare's
// 100 MB request limit and can resume if a piece fails. Pieces are
// stitched together on the server's disk, then processed and sent to R2.
import fs from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";

export const CHUNK_BYTES = 25 * 1024 * 1024;
const MAX_CHUNK_BYTES = 32 * 1024 * 1024;
const STALE_AFTER_MS = 24 * 60 * 60 * 1000;
// Room kept free on the server's disk for everything else.
const DISK_RESERVE_BYTES = 3 * 1024 ** 3;

export function maxUploadBytes() {
  return (Number(process.env.MAX_UPLOAD_GB) || 10) * 1024 ** 3;
}

export class UploadError extends Error {
  constructor(status, message, extra = {}) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

export function uploadsRoot() {
  return process.env.UPLOAD_TMP_DIR || path.join(os.tmpdir(), "xv-uploads");
}

const ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function uploadDir(id) {
  if (!ID_PATTERN.test(String(id))) throw new UploadError(400, "Invalid upload ID.");
  return path.join(uploadsRoot(), id);
}

const dataPath = (id) => path.join(uploadDir(id), "upload.bin");
const metaPath = (id) => path.join(uploadDir(id), "meta.json");

function cleanName(name) {
  return String(name || "file").replace(/[\\/\0]/g, "_").slice(0, 200);
}

export async function readUpload(id) {
  try {
    return JSON.parse(await fs.readFile(metaPath(id), "utf8"));
  } catch (err) {
    if (err.code === "ENOENT") return null;
    throw err;
  }
}

export async function saveUpload(meta) {
  meta.updatedAt = new Date().toISOString();
  const tmp = `${metaPath(meta.id)}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(meta));
  await fs.rename(tmp, metaPath(meta.id));
  return meta;
}

export function uploadFilePath(id) {
  return dataPath(id);
}

/**
 * Each upload needs room for the original plus its converted copy until
 * it's on R2. When a big batch outruns processing, new files wait (the
 * admin panel retries) instead of filling the disk.
 */
async function checkDiskSpace(bytes) {
  let free;
  try {
    const stats = await fs.statfs(uploadsRoot());
    free = Number(stats.bavail) * Number(stats.bsize);
  } catch {
    return; // Can't tell; let the upload try.
  }
  if (free < bytes * 2 + DISK_RESERVE_BYTES) {
    throw new UploadError(507, "The server's disk is full for now. This file starts once earlier uploads finish processing.", {
      full: true,
    });
  }
}

export async function createUpload({ creatorId, creatorName, fileName, size, type }) {
  const bytes = Number(size);
  if (!Number.isInteger(bytes) || bytes <= 0) throw new UploadError(400, "The file is empty.");
  if (bytes > maxUploadBytes()) {
    throw new UploadError(413, `Files can be at most ${process.env.MAX_UPLOAD_GB || 10} GB.`);
  }
  await removeStaleUploads();
  await checkDiskSpace(bytes);
  const id = randomUUID();
  await fs.mkdir(uploadDir(id), { recursive: true });
  await fs.writeFile(dataPath(id), "");
  return saveUpload({
    id,
    creatorId: Number(creatorId),
    creatorName: String(creatorName || ""),
    fileName: cleanName(fileName),
    size: bytes,
    type: String(type || ""),
    received: 0,
    status: "uploading", // uploading -> queued -> processing -> done | failed
    error: null,
    mediaId: null,
    createdAt: new Date().toISOString(),
  });
}

/** Appends one piece. `offset` must match what the server already has. */
export async function appendChunk(id, offset, body) {
  const meta = await readUpload(id);
  if (!meta) throw goneError();
  if (meta.status !== "uploading") throw new UploadError(409, "This upload is already finished.");
  if (!body) throw new UploadError(400, "The upload piece was empty.");

  const file = dataPath(id);
  const { size: current } = await fs.stat(file);
  if (Number(offset) !== current) {
    throw new UploadError(409, "Upload out of sync.", { received: current });
  }

  const limit = Math.min(MAX_CHUNK_BYTES, meta.size - current);
  let written = 0;
  const guard = new Transform({
    transform(chunk, _enc, done) {
      written += chunk.length;
      if (written > limit) done(new UploadError(413, "The upload piece is larger than expected."));
      else done(null, chunk);
    },
  });

  try {
    await pipeline(Readable.fromWeb(body), guard, createWriteStream(file, { flags: "a" }));
  } catch (err) {
    // Roll back a half-written piece so the client can retry it cleanly.
    await fs.truncate(file, current).catch(() => {});
    throw err instanceof UploadError ? err : new UploadError(400, "The upload piece was interrupted.");
  }

  meta.received = current + written;
  return saveUpload(meta);
}

/** The server no longer has this upload (it restarted, or it was cleared). */
export function goneError() {
  return new UploadError(404, "The server no longer has this upload. Start it again.", { gone: true });
}

/** Every upload the server still knows about (kept for a day), oldest first. */
export async function listUploads() {
  let names;
  try {
    names = await fs.readdir(/*turbopackIgnore: true*/ uploadsRoot());
  } catch {
    return [];
  }
  const metas = await Promise.all(names.filter((n) => ID_PATTERN.test(n)).map((n) => readUpload(n).catch(() => null)));
  return metas.filter(Boolean).sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
}

export async function removeUpload(id) {
  await fs.rm(uploadDir(id), { recursive: true, force: true });
}

/** Clears out uploads abandoned for more than a day. */
export async function removeStaleUploads() {
  const root = uploadsRoot();
  await fs.mkdir(root, { recursive: true });
  const now = Date.now();
  for (const name of await fs.readdir(/*turbopackIgnore: true*/ root)) {
    if (!ID_PATTERN.test(name)) continue;
    const stat = await fs.stat(path.join(root, name)).catch(() => null);
    if (stat && now - stat.mtimeMs > STALE_AFTER_MS) {
      await fs.rm(path.join(root, name), { recursive: true, force: true });
    }
  }
}
