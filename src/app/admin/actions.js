"use server";

import { revalidatePath } from "next/cache";
import { deleteCreator, deleteMedia, setCreatorTier } from "@/lib/creators";
import { createUser, deleteMember, findUserById } from "@/lib/members";
import { stripe, stripeConfigured } from "@/lib/stripe";
import { validatePassword, validateUsername } from "@/lib/passwords";
import { requireAdmin } from "@/lib/session";
import { deleteFiles } from "@/lib/storage";

function idFrom(formData, field) {
  const id = Number(formData.get(field));
  if (!Number.isInteger(id) || id <= 0) throw new Error(`Missing ${field}.`);
  return id;
}

export async function setTierAction(formData) {
  await requireAdmin();
  const tier = formData.get("tier") === "vip" ? "vip" : "free";
  await setCreatorTier(idFrom(formData, "creatorId"), tier);
  revalidatePath("/", "layout");
}

export async function deleteCreatorAction(formData) {
  await requireAdmin();
  const keys = await deleteCreator(idFrom(formData, "creatorId"));
  await deleteFiles(keys);
  revalidatePath("/", "layout");
}

export async function deleteMediaAction(formData) {
  await requireAdmin();
  const removed = await deleteMedia(idFrom(formData, "mediaId"));
  if (removed) {
    await deleteFiles(removed.keys);
    revalidatePath(`/${removed.slug}`);
  }
}

export async function createMemberAction(_prev, formData) {
  await requireAdmin();
  const username = String(formData.get("username") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  const until = String(formData.get("vipUntil") || "");

  const invalid = validateUsername(username) || validatePassword(password);
  if (invalid) return { error: invalid, ok: null };

  let vipUntil = null;
  if (until) {
    // Access lasts through the end of the chosen day.
    vipUntil = new Date(`${until}T23:59:59`);
    if (Number.isNaN(vipUntil.getTime()) || vipUntil.getTime() < Date.now()) {
      return { error: "Pick an end date in the future, or leave it empty for no end date.", ok: null };
    }
  }

  const user = await createUser({ username, password, vip: true, vipUntil });
  if (!user) return { error: `The username “${username}” is taken.`, ok: null };
  revalidatePath("/admin");
  return { error: null, ok: `Created VIP member “${username}”. Share the username and password with them.` };
}

export async function deleteMemberAction(formData) {
  await requireAdmin();
  const id = idFrom(formData, "userId");
  const member = await findUserById(id);
  if (!member) return;
  // Stop billing before the account disappears, or they'd keep being charged.
  if (member.stripe_subscription_id && ["active", "trialing", "past_due"].includes(member.stripe_status)) {
    if (!stripeConfigured()) throw new Error("Stripe keys are missing, so this member's subscription can't be canceled.");
    await stripe().subscriptions.cancel(member.stripe_subscription_id);
  }
  await deleteMember(id);
  revalidatePath("/admin");
}
