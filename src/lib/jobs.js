// Processes finished uploads one at a time in the background, so the admin
// panel never waits on ffmpeg (and Cloudflare's 100-second timeout never
// cuts off a long conversion).
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { findMediaByUpload, getCreatorById, insertMedia } from "./creators";
import { detectKind, MediaError, processImage, processVideo } from "./media-processing";
import { deleteFiles, StorageError, uploadFile } from "./storage";
import { listUploads, readUpload, saveUpload, uploadDir, uploadFilePath } from "./uploads";

const queue =
  globalThis.__xvJobs ?? (globalThis.__xvJobs = { running: 0, waiting: [], active: new Set(), resumed: null });
// Files processed at the same time. By default one per 3 CPU cores (2 on a
// 6-core server): ffmpeg already uses several cores per file, and running
// two lets quick files (photos, repackaged videos) finish alongside a long
// conversion instead of waiting behind it.
const CONCURRENCY = Math.max(1, Number(process.env.PROCESSING_CONCURRENCY) || Math.floor(os.availableParallelism() / 3));

export function enqueueUpload(id) {
  if (queue.active.has(id)) return;
  queue.active.add(id);
  queue.waiting.push(id);
  pump();
}

/** False if the server restarted since this upload was queued. */
export function isTracked(id) {
  return queue.active.has(id);
}

/** 0 while it's being processed, 1 if it's next, and so on; null if not queued. */
export function queuePosition(id) {
  if (!queue.active.has(id)) return null;
  const index = queue.waiting.indexOf(id);
  return index === -1 ? 0 : index + 1;
}

/**
 * After a restart (e.g. a redeploy), picks up files that had fully arrived
 * but weren't processed yet. Only possible when the upload folder survives
 * restarts (a persistent volume); otherwise the admin panel sends the
 * files again. Runs once per server start.
 */
export function resumeInterrupted() {
  queue.resumed ??= (async () => {
    for (const meta of await listUploads()) {
      if (!["queued", "processing"].includes(meta.status) || queue.active.has(meta.id)) continue;
      const size = await fs
        .stat(uploadFilePath(meta.id))
        .then((s) => s.size)
        .catch(() => -1);
      if (size === meta.size) {
        meta.status = "queued";
        await saveUpload(meta);
        enqueueUpload(meta.id);
        console.log(`Resuming ${meta.fileName} after a restart.`);
      } else {
        meta.status = "failed";
        meta.error = "The server restarted before this file was saved. Upload it again.";
        meta.gone = true;
        await saveUpload(meta);
      }
    }
  })().catch((err) => console.error("Couldn't resume interrupted uploads:", err));
  return queue.resumed;
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
  await fs.rm(workDir, { recursive: true, force: true }); // leftovers from an interrupted run
  await fs.mkdir(workDir, { recursive: true });

  try {
    const creator = await getCreatorById(meta.creatorId);
    if (!creator) throw new MediaError("That creator was deleted before the upload finished.");

    const kind = detectKind(meta.fileName, meta.type);
    if (!kind) throw new MediaError("Only videos and photos can be uploaded.");
    const result =
      kind === "video" ? await processVideo(input, workDir) : await processImage(input, workDir, meta.fileName);

    const base = `media/${creator.id}/${randomUUID()}`;
    const file = `${base}/${kind}${result.main.ext}`;
    const keys = {
      file,
      // Small photos are their own thumbnail.
      thumb: result.thumb ? `${base}/thumb.jpg` : file,
      thumbBlur: `${base}/thumb-blur.jpg`,
    };
    await Promise.all([
      uploadFile(keys.file, result.main.path, result.main.contentType),
      result.thumb && uploadFile(keys.thumb, result.thumb, "image/jpeg"),
      uploadFile(keys.thumbBlur, result.thumbBlur, "image/jpeg"),
    ]);

    const { size } = await fs.stat(result.main.path);
    let row = await insertMedia({
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
      uploadId: id,
    });
    if (!row) {
      // Already saved by an earlier run of this same upload: keep that one.
      await deleteFiles([keys.file, keys.thumb, keys.thumbBlur]);
      row = await findMediaByUpload(id);
    }

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
