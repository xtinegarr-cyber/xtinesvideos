// Step 3: all pieces are in. Queue the file for processing and R2 upload.
import { handleApiError, jsonError } from "@/lib/api";
import { enqueueUpload } from "@/lib/jobs";
import { adminOrNull } from "@/lib/session";
import { readUpload, saveUpload } from "@/lib/uploads";

export async function POST(_request, { params }) {
  if (!(await adminOrNull())) return jsonError(401, "Log in as an admin to upload.");
  try {
    const { id } = await params;
    const meta = await readUpload(id);
    if (!meta) return jsonError(404, "This upload no longer exists. Start it again.");
    if (meta.status !== "uploading") return Response.json({ status: meta.status });
    if (meta.received !== meta.size) {
      return jsonError(409, "Some of the file is missing. Resume the upload.", { received: meta.received });
    }
    meta.status = "queued";
    await saveUpload(meta);
    enqueueUpload(id);
    return Response.json({ status: "queued" });
  } catch (err) {
    return handleApiError(err);
  }
}
