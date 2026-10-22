"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createUser } from "@/lib/members";
import { validatePassword, validateUsername } from "@/lib/passwords";
import { allow } from "@/lib/rate-limit";
import { getViewer, siteUrl, startSession } from "@/lib/session";
import { createBillingPortal, createVipCheckout, stripeConfigured } from "@/lib/stripe";
import { clientIp } from "@/lib/visitors";
import { toViewer } from "@/lib/vip";

const NOT_SET_UP = "VIP checkout isn't set up yet. The site owner needs to add the Stripe keys.";

/** Logged-in member without VIP -> Stripe checkout. */
export async function startCheckoutAction(_prev) {
  const viewer = await getViewer();
  if (!viewer) redirect("/vip");
  if (viewer.isVip) redirect("/account");
  if (!stripeConfigured()) return { error: NOT_SET_UP };

  let url;
  try {
    url = await createVipCheckout(viewer, await siteUrl());
  } catch (err) {
    console.error("Stripe checkout failed:", err);
    return { error: "Checkout couldn't open. Try again in a moment." };
  }
  redirect(url);
}

/** New visitor: create an account, log them in, then go to Stripe. */
export async function signupAndCheckoutAction(_prev, formData) {
  const username = String(formData.get("username") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  if (!stripeConfigured()) return { error: NOT_SET_UP, username };

  const invalid = validateUsername(username) || validatePassword(password);
  if (invalid) return { error: invalid, username };

  const ip = clientIp(await headers());
  if (!allow(`signup:${ip}`, 5, 60 * 60 * 1000)) {
    return { error: "Too many new accounts from this connection. Try again in an hour.", username };
  }

  const user = await createUser({ username, password });
  if (!user) return { error: "That username is taken. Try another one.", username };
  await startSession(user.id);

  let url;
  try {
    url = await createVipCheckout(toViewer(user), await siteUrl());
  } catch (err) {
    console.error("Stripe checkout failed:", err);
    return { error: "Your account is ready, but checkout couldn't open. Press the button again.", username };
  }
  redirect(url);
}

/** Stripe's page for changing the card or canceling VIP. */
export async function manageSubscriptionAction() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login?next=/account");
  if (!stripeConfigured()) redirect("/account");
  const url = await createBillingPortal(viewer, await siteUrl());
  redirect(url || "/account");
}
