// Replaces a creator's profile picture.
import { revalidatePath } from "next/cache";
import { getCreatorById, setCreatorAvatar } from "@/lib/creators";
import { handleApiError, jsonError } from "@/lib/api";
import { hasFile, storeAvatar } from "@/lib/avatars";
import { adminOrNull } from "@/lib/session";
import { deleteFiles } from "@/lib/storage";

export async function POST(request, { params }) {
  if (!(await adminOrNull())) return jsonError(401, "Log in as an admin.");
  try {
    const { id } = await params;
    const creator = await getCreatorById(Number(id));
    if (!creator) return jsonError(404, "That creator doesn't exist anymore.");
    const form = await request.formData();
    const picture = form.get("avatar");
    if (!hasFile(picture)) return jsonError(400, "Choose a picture first.");

    const keys = await storeAvatar(picture);
    const oldKeys = await setCreatorAvatar(creator.id, keys);
    await deleteFiles(oldKeys);
    revalidatePath("/", "layout");
    return Response.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
