import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { detectKind, MediaError, processAvatar } from "./media-processing";
import { storageConfigured, uploadFile } from "./storage";
import { UploadError, uploadsRoot } from "./uploads";

const MAX_AVATAR_BYTES = 25 * 1024 * 1024;

/** True if the form actually included a picture. */
export function hasFile(value) {
  return value && typeof value === "object" && typeof value.arrayBuffer === "function" && value.size > 0;
}

/**
 * Crops a profile picture to portrait, makes the blurred copy shown on
 * locked VIP cards, stores both on R2 and returns their keys.
 */
export async function storeAvatar(file) {
  if (!storageConfigured()) throw new UploadError(503, "R2 storage isn't set up, so profile pictures can't be saved yet.");
  if (file.size > MAX_AVATAR_BYTES) throw new UploadError(413, "Profile pictures can be at most 25 MB.");
  if (detectKind(file.name, file.type) !== "image") throw new UploadError(415, "The profile picture has to be a photo.");

  const id = randomUUID();
  const dir = path.join(uploadsRoot(), id);
  await fs.mkdir(dir, { recursive: true });
  try {
    const input = path.join(dir, "upload.bin");
    await fs.writeFile(input, Buffer.from(await file.arrayBuffer()));
    const { avatar, avatarBlur } = await processAvatar(input, dir);
    const keys = { avatarKey: `avatars/${id}.jpg`, avatarBlurKey: `avatars/${id}-blur.jpg` };
    await uploadFile(keys.avatarKey, avatar, "image/jpeg");
    await uploadFile(keys.avatarBlurKey, avatarBlur, "image/jpeg");
    return keys;
  } catch (err) {
    if (err instanceof MediaError) throw new UploadError(422, "That picture couldn't be read. Try a JPEG or PNG.");
    throw err;
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}
