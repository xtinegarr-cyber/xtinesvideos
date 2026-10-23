// Turns uploaded files into what the site serves, using ffmpeg:
//   - videos: an MP4 that starts playing before it finishes downloading
//   - photos: the original (or a JPEG if browsers can't show it)
//   - for both: a thumbnail plus a heavily blurred thumbnail for locked
//     VIP previews (the blur is baked in, so the sharp image never reaches
//     visitors who aren't VIP)
import { spawn } from "node:child_process";
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

async function makeThumbs({ input, seekSeconds, outDir }) {
  const thumb = path.join(outDir, "thumb.jpg");
  const thumbBlur = path.join(outDir, "thumb-blur.jpg");
  const seek = seekSeconds > 0 ? ["-ss", seekSeconds.toFixed(2)] : [];
  await run("ffmpeg", [
    "-y", "-v", "error", ...seek, "-i", input,
    "-frames:v", "1", "-vf", `scale='min(${THUMB_WIDTH},iw)':-2`, "-q:v", "3",
    thumb,
  ]);
  // Blur from the small thumbnail: same picture, much less work.
  await run("ffmpeg", ["-y", "-v", "error", "-i", thumb, "-frames:v", "1", "-vf", BLUR_FILTER, "-q:v", "5", thumbBlur]);
  return { thumb, thumbBlur };
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
  let main;
  if (WEB_IMAGE_TYPES[ext]) {
    main = { path: input, contentType: WEB_IMAGE_TYPES[ext], ext: ext === ".jpeg" ? ".jpg" : ext };
  } else {
    const converted = path.join(outDir, "photo.jpg");
    await run("ffmpeg", ["-y", "-v", "error", "-i", input, "-frames:v", "1", "-q:v", "2", converted]);
    main = { path: converted, contentType: "image/jpeg", ext: ".jpg" };
  }

  const thumbs = await makeThumbs({ input, seekSeconds: 0, outDir });
  return { kind: "image", main, ...thumbs, ...displaySize(stream), duration: null };
}

/** Profile pictures: a 600x800 portrait crop plus its blurred twin. */
export async function processAvatar(input, outDir) {
  const avatar = path.join(outDir, "avatar.jpg");
  const avatarBlur = path.join(outDir, "avatar-blur.jpg");
  await run("ffmpeg", [
    "-y", "-v", "error", "-i", input, "-frames:v", "1",
    "-vf", "scale=600:800:force_original_aspect_ratio=increase,crop=600:800",
    "-q:v", "3", avatar,
  ]);
  await run("ffmpeg", [
    "-y", "-v", "error", "-i", avatar, "-frames:v", "1",
    "-vf", BLUR_FILTER,
    "-q:v", "5", avatarBlur,
  ]);
  return { avatar, avatarBlur };
}
