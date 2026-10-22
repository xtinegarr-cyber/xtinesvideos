// Small helpers for the admin JSON endpoints.
import { UploadError } from "./uploads";

export function jsonError(status, message, extra = {}) {
  return Response.json({ error: message, ...extra }, { status });
}

export function handleApiError(err) {
  if (err instanceof UploadError) return jsonError(err.status, err.message, err.extra);
  console.error(err);
  return jsonError(500, "Something went wrong on the server. Check the logs.");
}
