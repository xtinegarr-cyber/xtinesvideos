"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { normalizeEmail, validateEmail, validatePassword } from "@/lib/passwords";
import { allow } from "@/lib/rate-limit";
import { getViewer, siteUrl, startSession } from "@/lib/session";
import { claimCheckout, createBillingPortal, createVipCheckout, stripeConfigured } from "@/lib/stripe";
import { clientIp } from "@/lib/visitors";

/** Every "Get VIP" button: straight to Stripe's checkout page. */
export async function startCheckoutAction() {
  const viewer = await getViewer();
  if (viewer?.isVip) redirect(viewer.isAdmin ? "/admin" : "/account");
  if (!stripeConfigured()) redirect("/vip?error=setup");

  let url;
  try {
    url = await createVipCheckout(viewer, await siteUrl());
  } catch (err) {
    console.error("Stripe checkout failed:", err);
    redirect("/vip?error=checkout");
  }
  redirect(url);
}

/** After paying: create the login (email + password) that has VIP. */
export async function claimAccountAction(_prev, formData) {
  const sessionId = String(formData.get("sessionId") || "");
  const email = normalizeEmail(formData.get("email"));
  const password = String(formData.get("password") || "");

  const invalid = validateEmail(email) || validatePassword(password);
  if (invalid) return { error: invalid, email };

  const ip = clientIp(await headers());
  if (!allow(`claim:${ip}`, 10)) {
    return { error: "Too many tries. Wait 10 minutes and try again.", email };
  }

  let result;
  try {
    result = await claimCheckout({ sessionId, email, password });
  } catch (err) {
    console.error("Creating a VIP account failed:", err);
    return { error: "Something went wrong creating your account. Try again in a minute.", email };
  }
  if (result.error) return { error: result.error, email };

  await startSession(result.user.id);
  redirect(`/vip/success?session_id=${encodeURIComponent(sessionId)}`);
}

/** Stripe's page for changing the card or canceling VIP. */
export async function manageSubscriptionAction() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login?next=/account");
  if (!stripeConfigured()) redirect("/account");
  const url = await createBillingPortal(viewer, await siteUrl());
  redirect(url || "/account");
}
