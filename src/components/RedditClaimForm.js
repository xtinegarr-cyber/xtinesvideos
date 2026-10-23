"use client";

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FiCheckCircle, FiClock } from "react-icons/fi";
import { claimRedditVipAction } from "@/app/vip/reddit/actions";
import { FormError, inputClass } from "./forms";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-vip h-12 w-full px-6 sm:w-auto">
      {pending ? "Checking your post…" : "Check my post"}
    </button>
  );
}

/** Keeps the page up to date while a post waits for approval. */
export function RefreshWhilePending() {
  const router = useRouter();
  useEffect(() => {
    const timer = setInterval(() => router.refresh(), 30_000);
    return () => clearInterval(timer);
  }, [router]);
  return null;
}

export default function RedditClaimForm() {
  const [state, action] = useActionState(claimRedditVipAction, null);

  if (state?.approved) {
    return (
      <div role="status" className="rounded-2xl border border-[#9be4b8]/30 bg-[#9be4b8]/[0.07] p-5">
        <p className="flex items-center gap-2 text-lg font-bold text-[#9be4b8]">
          <FiCheckCircle aria-hidden /> Your post checks out
        </p>
        <p className="mt-1 text-muted">You have VIP for the next {state.minutes} minutes. Every VIP creator is unlocked.</p>
        <Link href="/" className="btn-vip mt-4 h-11 px-5">
          Browse VIP creators
        </Link>
      </div>
    );
  }

  if (state?.pending) {
    return (
      <div role="status" className="rounded-2xl border border-gold/30 bg-gold/[0.07] p-5">
        <RefreshWhilePending />
        <p className="flex items-center gap-2 text-lg font-bold text-gold">
          <FiClock aria-hidden /> Got it. Your post is waiting for approval
        </p>
        <p className="mt-1 text-muted">
          Reddit didn’t let us check it automatically, so the team will look at it. Your VIP starts the next time you visit
          after it’s approved. You don’t need to do anything else.
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-3">
      <label className="block">
        <span className="mb-1.5 block text-sm font-semibold">Your Reddit post’s link</span>
        <input
          name="postUrl"
          type="url"
          required
          inputMode="url"
          placeholder="https://www.reddit.com/r/…/comments/…"
          className={inputClass}
        />
      </label>
      <FormError message={state?.error} />
      <Submit />
    </form>
  );
}
