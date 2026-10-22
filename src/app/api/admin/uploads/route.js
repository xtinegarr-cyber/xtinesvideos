// Step 1 of an upload: register the file and get an upload ID.
import { getCreatorById } from "@/lib/creators";
import { handleApiError, jsonError } from "@/lib/api";
import { detectKind } from "@/lib/media-processing";
import { adminOrNull } from "@/lib/session";
import { storageConfigured } from "@/lib/storage";
import { CHUNK_BYTES, createUpload } from "@/lib/uploads";

export async function POST(request) {
  if (!(await adminOrNull())) return jsonError(401, "Log in as an admin to upload.");
  if (!storageConfigured()) return jsonError(503, "R2 storage isn't set up. Add the R2 environment variables first.");

  try {
    const { creatorId, fileName, size, type } = await request.json();
    const creator = await getCreatorById(Number(creatorId));
    if (!creator) return jsonError(404, "Pick a creator for this upload.");
    if (!detectKind(fileName, type)) return jsonError(415, `${fileName} isn't a video or photo.`);
    const upload = await createUpload({ creatorId: creator.id, fileName, size, type });
    return Response.json({ id: upload.id, chunkSize: CHUNK_BYTES });
  } catch (err) {
    return handleApiError(err);
  }
}
