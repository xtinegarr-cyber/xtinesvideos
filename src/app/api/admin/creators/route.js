// Creates a creator profile (name, free/VIP, optional profile picture).
import { revalidatePath } from "next/cache";
import { createCreator } from "@/lib/creators";
import { handleApiError, jsonError } from "@/lib/api";
import { hasFile, storeAvatar } from "@/lib/avatars";
import { adminOrNull } from "@/lib/session";
import { notifyIndexNow } from "@/lib/indexnow";

export async function POST(request) {
  if (!(await adminOrNull())) return jsonError(401, "Log in as an admin.");
  try {
    const form = await request.formData();
    const name = String(form.get("name") || "").trim().replace(/\s+/g, " ");
    const tier = form.get("tier") === "vip" ? "vip" : "free";
    if (!name) return jsonError(400, "Give the creator a name.");
    if (name.length > 60) return jsonError(400, "Creator names can be at most 60 characters.");

    const picture = form.get("avatar");
    const keys = hasFile(picture) ? await storeAvatar(picture) : {};
    const creator = await createCreator({ name, tier, ...keys });
    revalidatePath("/", "layout");
    notifyIndexNow(["/", `/${creator.slug}`]);
    return Response.json({ creator: { id: Number(creator.id), slug: creator.slug, name: creator.name } });
  } catch (err) {
    return handleApiError(err);
  }
}
