"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { findUserByLogin } from "@/lib/members";
import { hashPassword, verifyPassword } from "@/lib/passwords";
import { allow } from "@/lib/rate-limit";
import { startSession } from "@/lib/session";
import { clientIp } from "@/lib/visitors";
import { safeNextPath } from "@/lib/vip";

// Checked when the username doesn't exist, so a wrong username takes as
// long as a wrong password and usernames can't be discovered by timing.
let decoyHash;

export async function loginAction(_prev, formData) {
  const username = String(formData.get("username") || "").trim().toLowerCase(); // email or username
  const password = String(formData.get("password") || "");
  const next = safeNextPath(formData.get("next"), "");

  const ip = clientIp(await headers());
  if (!allow(`login:${ip}`, 10)) {
    return { error: "Too many login attempts. Wait 10 minutes and try again.", username };
  }

  const user = username ? await findUserByLogin(username) : null;
  decoyHash ??= await hashPassword("decoy-password");
  const ok = await verifyPassword(password, user?.password_hash ?? decoyHash);
  if (!user || !ok) {
    return { error: "That email or username and password don't match. Check them and try again.", username };
  }

  await startSession(user.id);
  redirect(next || (user.role === "admin" ? "/admin" : "/"));
}
