// Step 2: PUT each 25 MB piece. GET reports progress while processing.
import { handleApiError, jsonError } from "@/lib/api";
import { isTracked } from "@/lib/jobs";
import { adminOrNull } from "@/lib/session";
import { appendChunk, readUpload, saveUpload } from "@/lib/uploads";

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
    const meta = await readUpload(id);
    if (!meta) return jsonError(404, "This upload no longer exists.");
    if (["queued", "processing"].includes(meta.status) && !isTracked(id)) {
      meta.status = "failed";
      meta.error = "The server restarted while this was processing. Upload it again.";
      await saveUpload(meta);
    }
    return Response.json({
      status: meta.status,
      error: meta.error,
      received: meta.received,
      size: meta.size,
      creatorSlug: meta.creatorSlug ?? null,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
