// POST is step 1 of an upload: register the file and get an upload ID.
// GET lists every upload the server knows about, so the admin panel can
// follow processing for a whole batch (and show it again after a reload).
import { getCreatorById } from "@/lib/creators";
import { handleApiError, jsonError } from "@/lib/api";
import { queuePosition, resumeInterrupted } from "@/lib/jobs";
import { detectKind } from "@/lib/media-processing";
import { adminOrNull } from "@/lib/session";
import { storageConfigured } from "@/lib/storage";
import { CHUNK_BYTES, createUpload, listUploads } from "@/lib/uploads";

export async function POST(request) {
  if (!(await adminOrNull())) return jsonError(401, "Log in as an admin to upload.");
  if (!storageConfigured()) return jsonError(503, "R2 storage isn't set up. Add the R2 environment variables first.");

  try {
    await resumeInterrupted();
    const { creatorId, fileName, size, type } = await request.json();
    const creator = await getCreatorById(Number(creatorId));
    if (!creator) return jsonError(404, "That creator doesn't exist anymore.");
    if (!detectKind(fileName, type)) return jsonError(415, `${fileName} isn't a video or photo.`);
    const upload = await createUpload({ creatorId: creator.id, creatorName: creator.name, fileName, size, type });
    return Response.json({ id: upload.id, chunkSize: CHUNK_BYTES });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function GET() {
  if (!(await adminOrNull())) return jsonError(401, "Log in as an admin.");
  try {
    await resumeInterrupted();
    const uploads = (await listUploads()).map((m) => ({
      id: m.id,
      fileName: m.fileName,
      size: m.size,
      received: m.received,
      creatorId: m.creatorId,
      creatorName: m.creatorName || "",
      creatorSlug: m.creatorSlug ?? null,
      mediaId: m.mediaId ?? null,
      status: m.status,
      error: m.error,
      gone: Boolean(m.gone),
      position: queuePosition(m.id),
      createdAt: m.createdAt,
      updatedAt: m.updatedAt ?? m.createdAt,
    }));
    return Response.json({ uploads }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return handleApiError(err);
  }
}
