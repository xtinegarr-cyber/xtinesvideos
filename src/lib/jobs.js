// Processes finished uploads one at a time in the background, so the admin
// panel never waits on ffmpeg (and Cloudflare's 100-second timeout never
// cuts off a long conversion).
import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { getCreatorById, insertMedia } from "./creators";
import { detectKind, MediaError, processImage, processVideo } from "./media-processing";
import { StorageError, uploadFile } from "./storage";
import { readUpload, saveUpload, uploadDir, uploadFilePath } from "./uploads";

const queue = globalThis.__xvJobs ?? (globalThis.__xvJobs = { running: 0, waiting: [], active: new Set() });
const CONCURRENCY = Math.max(1, Number(process.env.PROCESSING_CONCURRENCY) || 1);

export function enqueueUpload(id) {
  queue.active.add(id);
  queue.waiting.push(id);
  pump();
}

/** False if the server restarted since this upload was queued. */
export function isTracked(id) {
  return queue.active.has(id);
}

function pump() {
  while (queue.running < CONCURRENCY && queue.waiting.length) {
    const id = queue.waiting.shift();
    queue.running++;
    processUpload(id)
      .catch((err) => console.error(`Upload ${id} crashed:`, err))
      .finally(() => {
        queue.running--;
        queue.active.delete(id);
        pump();
      });
  }
}

async function processUpload(id) {
  const meta = await readUpload(id);
  if (!meta) return;
  meta.status = "processing";
  await saveUpload(meta);

  const input = uploadFilePath(id);
  const workDir = path.join(uploadDir(id), "out");
  await fs.mkdir(workDir, { recursive: true });

  try {
    const creator = await getCreatorById(meta.creatorId);
    if (!creator) throw new MediaError("That creator was deleted before the upload finished.");

    const kind = detectKind(meta.fileName, meta.type);
    if (!kind) throw new MediaError("Only videos and photos can be uploaded.");
    const result =
      kind === "video" ? await processVideo(input, workDir) : await processImage(input, workDir, meta.fileName);

    const base = `media/${creator.id}/${randomUUID()}`;
    const keys = {
      file: `${base}/${kind}${result.main.ext}`,
      thumb: `${base}/thumb.jpg`,
      thumbBlur: `${base}/thumb-blur.jpg`,
    };
    await uploadFile(keys.file, result.main.path, result.main.contentType);
    await uploadFile(keys.thumb, result.thumb, "image/jpeg");
    await uploadFile(keys.thumbBlur, result.thumbBlur, "image/jpeg");

    const { size } = await fs.stat(result.main.path);
    const row = await insertMedia({
      creatorId: creator.id,
      kind,
      fileKey: keys.file,
      contentType: result.main.contentType,
      thumbKey: keys.thumb,
      thumbBlurKey: keys.thumbBlur,
      width: result.width,
      height: result.height,
      duration: result.duration,
      sizeBytes: size,
      originalName: meta.fileName,
    });

    meta.status = "done";
    meta.mediaId = Number(row.id);
    meta.creatorSlug = creator.slug;
  } catch (err) {
    console.error(`Processing upload ${id} (${meta.fileName}) failed:`, err.detail || err);
    meta.status = "failed";
    meta.error = err instanceof MediaError || err instanceof StorageError ? err.message : "Processing failed. The server log has details.";
  } finally {
    // Keep only the small status file; the video itself is now on R2.
    await fs.rm(input, { force: true });
    await fs.rm(workDir, { recursive: true, force: true });
    await saveUpload(meta);
  }
}
