// Small helpers for the admin JSON endpoints.
import { StorageError } from "./storage";
import { UploadError } from "./uploads";

export function jsonError(status, message, extra = {}) {
  return Response.json({ error: message, ...extra }, { status });
}

export function handleApiError(err) {
  if (err instanceof UploadError) return jsonError(err.status, err.message, err.extra);
  if (err instanceof StorageError) return jsonError(502, err.message);
  console.error(err);
  const code = err?.code || err?.name;
  return jsonError(500, `Something went wrong on the server${code && code !== "Error" ? ` (${code})` : ""}. The site's Logs tab in Coolify has details.`);
}
