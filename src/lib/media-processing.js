// Turns uploaded files into what the site serves, using ffmpeg:
//   - videos: an MP4 that starts playing before it finishes downloading
//   - photos: the original (or a JPEG if browsers can't show it)
//   - for both: a thumbnail plus a heavily blurred thumbnail for locked
//     VIP previews (the blur is baked in, so the sharp image never reaches
//     visitors who aren't VIP)
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

const VIDEO_EXT = new Set([".mp4", ".mov", ".m4v", ".mkv", ".webm", ".avi", ".wmv", ".flv", ".3gp", ".mpg", ".mpeg", ".ts", ".mts"]);
const IMAGE_EXT = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif", ".heic", ".heif", ".bmp", ".tif", ".tiff"]);
// Photos in these formats are served as uploaded; anything else becomes a JPEG.
const WEB_IMAGE_TYPES = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

const THUMB_WIDTH = 640;
// Photos this small already load as fast as a thumbnail, so they're used
// as their own thumbnail. Bigger ones (like 12 MP phone photos) get a
// 640px thumbnail so a page full of them still loads quickly.
const SELF_THUMB_MAX_SIDE = 1280;
const SELF_THUMB_MAX_BYTES = 400 * 1024;
const THUMB_AT_SECONDS = 15;
// H.264 videos up to 1080p and this bitrate are only repackaged, which
// takes a second or two. Heavier ones are re-encoded so they stream well.
// 20 Mbps lets normal phone and screen recordings through untouched.
const MAX_COPY_BITRATE = (Number(process.env.COPY_MAX_MBPS) || 20) * 1_000_000;

/** Thumbnails come from 15 seconds in; shorter clips use their midpoint. */
export function thumbnailTime(duration) {
  const d = Number(duration) || 0;
  return d > THUMB_AT_SECONDS ? THUMB_AT_SECONDS : d / 2;
}
// Blur for locked VIP previews: you can tell what the picture is (a person,
// their outfit, the setting) but not see details. Raise for more blur.
const BLUR_SIGMA = 14;
const BLUR_FILTER = `gblur=sigma=${BLUR_SIGMA}`;

export class MediaError extends Error {}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr = (stderr + d).slice(-4000)));
    child.on("error", (err) =>
      reject(err.code === "ENOENT" ? new MediaError(`${command} is not installed on the server.`) : err),
    );
    child.on("close", (code) => {
      if (code === 0) return resolve({ stdout, stderr });
      // The admin sees a plain message; the server log gets ffmpeg's details.
      const err = new MediaError("This file couldn't be converted. It may be damaged or in an unusual format.");
      err.detail = `${command}: ${stderr.trim().split("\n").pop()}`;
      reject(err);
    });
  });
}

export function detectKind(fileName, mimeType = "") {
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("image/")) return "image";
  const ext = path.extname(fileName || "").toLowerCase();
  if (VIDEO_EXT.has(ext)) return "video";
  if (IMAGE_EXT.has(ext)) return "image";
  return null;
}

export async function probe(input) {
  const { stdout } = await run("ffprobe", [
    "-v", "error",
    "-print_format", "json",
    "-show_format",
    "-show_streams",
    input,
  ]).catch((err) => {
    if (err.detail) err.message = "This file couldn't be read. It may be damaged, or it isn't really a video or photo.";
    throw err;
  });
  return JSON.parse(stdout);
}

function rotationOf(stream) {
  const fromSideData = (stream.side_data_list || []).find((d) => d.rotation !== undefined)?.rotation;
  const fromTags = stream.tags?.rotate;
  return Math.abs(Number(fromSideData ?? fromTags ?? 0)) % 180 === 90 ? 90 : 0;
}

/** Display size, accounting for phone videos stored sideways. */
function displaySize(stream) {
  if (!stream?.width || !stream?.height) return { width: null, height: null };
  return rotationOf(stream)
    ? { width: stream.height, height: stream.width }
    : { width: stream.width, height: stream.height };
}

/**
 * The thumbnail and its blurred twin, made in one pass. `orient` is an
 * ffmpeg filter that turns a phone photo upright (see jpegOrientation).
 * With `blurOnly`, the photo is its own thumbnail and only the blur is made.
 */
async function makeThumbs({ input, seekSeconds, outDir, orient = "", blurOnly = false }) {
  const thumb = path.join(outDir, "thumb.jpg");
  const thumbBlur = path.join(outDir, "thumb-blur.jpg");
  const seek = seekSeconds > 0 ? ["-ss", seekSeconds.toFixed(2)] : [];
  const source = [...(orient ? ["-noautorotate"] : []), ...seek, "-i", input];
  const small = `${orient ? `${orient},` : ""}scale='min(${THUMB_WIDTH},iw)':-2`;
  if (blurOnly) {
    // Blur from a small copy: same picture, much less work.
    await run("ffmpeg", ["-y", "-v", "error", ...source, "-frames:v", "1", "-vf", `${small},${BLUR_FILTER}`, "-q:v", "5", thumbBlur]);
    return { thumb: null, thumbBlur };
  }
  await run("ffmpeg", [
    "-y", "-v", "error", ...source,
    "-filter_complex", `[0:v]${small},split=2[t][b];[b]${BLUR_FILTER}[bl]`,
    "-map", "[t]", "-frames:v", "1", "-q:v", "3", thumb,
    "-map", "[bl]", "-frames:v", "1", "-q:v", "5", thumbBlur,
  ]);
  return { thumb, thumbBlur };
}

// EXIF orientation -> the ffmpeg filter that shows the photo upright.
const ORIENT_FILTERS = { 2: "hflip", 3: "hflip,vflip", 4: "vflip", 5: "transpose=0", 6: "transpose=1", 7: "transpose=3", 8: "transpose=2" };

/**
 * Phone cameras save JPEGs sideways and record which way is up in EXIF.
 * Browsers turn them upright on their own; ffmpeg versions differ, so the
 * thumbnails are turned explicitly. Returns 1 (as stored) to 8.
 */
export async function jpegOrientation(file) {
  let buf;
  try {
    const handle = await fs.open(file);
    try {
      buf = Buffer.alloc(128 * 1024);
      const { bytesRead } = await handle.read(buf, 0, buf.length, 0);
      buf = buf.subarray(0, bytesRead);
    } finally {
      await handle.close();
    }
  } catch {
    return 1;
  }
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return 1;
  let pos = 2;
  while (pos + 4 <= buf.length && buf[pos] === 0xff) {
    const marker = buf[pos + 1];
    const length = buf.readUInt16BE(pos + 2);
    if (marker === 0xda || length < 2) break; // image data starts: no EXIF
    if (marker === 0xe1 && buf.toString("latin1", pos + 4, pos + 10) === "Exif\0\0") {
      const tiff = pos + 10;
      if (tiff + 8 > buf.length) return 1;
      const little = buf.toString("latin1", tiff, tiff + 2) === "II";
      const u16 = (o) => (little ? buf.readUInt16LE(o) : buf.readUInt16BE(o));
      const u32 = (o) => (little ? buf.readUInt32LE(o) : buf.readUInt32BE(o));
      const ifd = tiff + u32(tiff + 4);
      if (ifd + 2 > buf.length) return 1;
      const entries = u16(ifd);
      for (let i = 0; i < entries; i++) {
        const entry = ifd + 2 + i * 12;
        if (entry + 12 > buf.length) break;
        if (u16(entry) === 0x0112) {
          const value = u16(entry + 8);
          return value >= 1 && value <= 8 ? value : 1;
        }
      }
      return 1;
    }
    pos += 2 + length;
  }
  return 1;
}

export async function processVideo(input, outDir) {
  const info = await probe(input);
  const video = info.streams.find((s) => s.codec_type === "video");
  const audio = info.streams.find((s) => s.codec_type === "audio");
  if (!video) throw new MediaError("This file has no video track.");

  const duration = Number(info.format?.duration) || Number(video.duration) || 0;
  const main = path.join(outDir, "video.mp4");

  // Fast loading comes down to two things: the index ("moov") sits at the
  // front of the file so playback starts before the download finishes, and
  // the file isn't heavier than it needs to be.
  const bitrate = Number(info.format?.bit_rate) || 0;
  const longSide = Math.max(video.width || 0, video.height || 0);
  const lightEnough = longSide <= 1920 && (!bitrate || bitrate <= MAX_COPY_BITRATE);

  // A light H.264 file already plays everywhere, so it's repackaged with
  // faststart in seconds instead of being re-encoded.
  const canCopy =
    video.codec_name === "h264" &&
    lightEnough &&
    (!video.pix_fmt || video.pix_fmt.startsWith("yuv420p")) &&
    (!audio || ["aac", "mp3"].includes(audio.codec_name));

  const copyArgs = ["-y", "-v", "error", "-i", input, "-map", "0:v:0", "-map", "0:a:0?", "-c", "copy", "-movflags", "+faststart", main];
  // Everything else (HEVC from iPhones, 4K, WebM, AVI...) becomes 1080p-max
  // H.264 with a bitrate cap, which streams smoothly on phones too. The
  // "superfast" preset converts about a third faster than "veryfast" for
  // files only slightly bigger, and AAC sound is kept as it is.
  const encodeArgs = [
    "-y", "-v", "error", "-i", input,
    "-map", "0:v:0", "-map", "0:a:0?",
    "-vf", "scale='if(gte(iw,ih),min(1920,iw),-2)':'if(gte(iw,ih),-2,min(1920,ih))'",
    "-c:v", "libx264", "-preset", "superfast", "-crf", "23", "-pix_fmt", "yuv420p",
    "-maxrate", "6M", "-bufsize", "12M",
    ...(audio?.codec_name === "aac" ? ["-c:a", "copy"] : ["-c:a", "aac", "-b:a", "160k"]),
    "-movflags", "+faststart",
    main,
  ];

  let reencoded = false;
  if (canCopy) {
    try {
      await run("ffmpeg", copyArgs);
    } catch {
      reencoded = true;
      await run("ffmpeg", encodeArgs);
    }
  } else {
    reencoded = true;
    await run("ffmpeg", encodeArgs);
  }

  const thumbs = await makeThumbs({ input: main, seekSeconds: thumbnailTime(duration), outDir });
  const finalInfo = await probe(main);
  const finalVideo = finalInfo.streams.find((s) => s.codec_type === "video");

  return {
    kind: "video",
    main: { path: main, contentType: "video/mp4", ext: ".mp4" },
    ...thumbs,
    ...displaySize(finalVideo || video),
    duration,
    reencoded,
  };
}

export async function processImage(input, outDir, originalName = "") {
  const info = await probe(input);
  const stream = info.streams.find((s) => s.codec_type === "video");
  if (!stream) throw new MediaError("This file isn't an image ffmpeg can read.");

  const ext = path.extname(originalName || input).toLowerCase();
  const orientation = await jpegOrientation(input);
  const orient = ORIENT_FILTERS[orientation] ?? "";
  const turned = orientation >= 5; // stored sideways
  const width = turned ? stream.height : stream.width;
  const height = turned ? stream.width : stream.height;

  let main;
  if (WEB_IMAGE_TYPES[ext]) {
    main = { path: input, contentType: WEB_IMAGE_TYPES[ext], ext: ext === ".jpeg" ? ".jpg" : ext };
  } else {
    const converted = path.join(outDir, "photo.jpg");
    await run("ffmpeg", ["-y", "-v", "error", "-i", input, "-frames:v", "1", "-q:v", "2", converted]);
    main = { path: converted, contentType: "image/jpeg", ext: ".jpg" };
  }

  const { size } = await fs.stat(/*turbopackIgnore: true*/ main.path);
  const ownThumb =
    main.path === input && Math.max(width || Infinity, height || Infinity) <= SELF_THUMB_MAX_SIDE && size <= SELF_THUMB_MAX_BYTES;
  const thumbs = await makeThumbs({ input, seekSeconds: 0, outDir, orient, blurOnly: ownThumb });
  // A photo that's its own thumbnail has thumb: null; the site then shows the photo itself.
  return { kind: "image", main, ...thumbs, width: width ?? null, height: height ?? null, duration: null };
}

/** Profile pictures: a 600x800 portrait crop plus its blurred twin. */
export async function processAvatar(input, outDir) {
  const avatar = path.join(outDir, "avatar.jpg");
  const avatarBlur = path.join(outDir, "avatar-blur.jpg");
  const orient = ORIENT_FILTERS[await jpegOrientation(input)] ?? "";
  await run("ffmpeg", [
    "-y", "-v", "error", ...(orient ? ["-noautorotate"] : []), "-i", input,
    "-filter_complex", `[0:v]${orient ? `${orient},` : ""}scale=600:800:force_original_aspect_ratio=increase,crop=600:800,split=2[a][b];[b]${BLUR_FILTER}[bl]`,
    "-map", "[a]", "-frames:v", "1", "-q:v", "3", avatar,
    "-map", "[bl]", "-frames:v", "1", "-q:v", "5", avatarBlur,
  ]);
  return { avatar, avatarBlur };
}
