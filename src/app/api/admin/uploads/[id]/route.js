// Step 2: PUT each 25 MB piece. GET reports progress while processing.
// DELETE cancels an upload that's still arriving, or clears a finished one.
import { handleApiError, jsonError } from "@/lib/api";
import { findMediaByUpload } from "@/lib/creators";
import { isTracked, resumeInterrupted } from "@/lib/jobs";
import { adminOrNull } from "@/lib/session";
import { appendChunk, goneError, readUpload, removeUpload } from "@/lib/uploads";

export async function PUT(request, { params }) {
  if (!(await adminOrNull())) return jsonError(401, "Log in as an admin to upload.");
  try {
    const { id } = await params;
    const offset = Number(new URL(request.url).searchParams.get("offset"));
    const meta = await appendChunk(id, offset, request.body);
    return Response.json({ received: meta.received, size: meta.size });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function GET(_request, { params }) {
  if (!(await adminOrNull())) return jsonError(401, "Log in as an admin.");
  try {
    const { id } = await params;
    await resumeInterrupted();
    const meta = await readUpload(id);
    if (!meta) {
      // The status file is gone (cleared, or lost in a restart), but the
      // database still knows if this upload made it onto the site.
      const saved = await findMediaByUpload(id);
      if (!saved) throw goneError();
      return Response.json({ status: "done", error: null, gone: false, creatorSlug: saved.creator_slug, mediaId: Number(saved.id) });
    }
    return Response.json({
      status: meta.status,
      error: meta.error,
      gone: Boolean(meta.gone),
      received: meta.received,
      size: meta.size,
      creatorSlug: meta.creatorSlug ?? null,
      mediaId: meta.mediaId ?? null,
      updatedAt: meta.updatedAt ?? meta.createdAt,
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(_request, { params }) {
  if (!(await adminOrNull())) return jsonError(401, "Log in as an admin.");
  try {
    const { id } = await params;
    const meta = await readUpload(id);
    if (meta && isTracked(id)) return jsonError(409, "This file is being processed. It can be cleared once it's done.");
    await removeUpload(id);
    return Response.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
