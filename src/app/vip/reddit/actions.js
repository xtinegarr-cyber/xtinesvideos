"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { getMediaWithCreator } from "@/lib/creators";
import { allow } from "@/lib/rate-limit";
import { checkPost, fetchPost, parsePostLink, postUrlFor, resolveShareLink } from "@/lib/reddit";
import { getAccess, siteUrl } from "@/lib/session";
import { clientIp } from "@/lib/visitors";
import { claimBlockReason, createClaim, ensureRefCode, PASS_MINUTES } from "@/lib/vip-pass";

const USED = "That post was already used to get VIP. Each post works once.";

/** Someone pasted their Reddit post: check it and start their 30 minutes. */
export async function claimRedditVipAction(_prev, formData) {
  const ip = clientIp(await headers());
  if (!allow(`reddit:${ip}`, 10)) return { error: "Too many tries. Wait 10 minutes and try again." };

  const access = await getAccess();
  if (access.viewer?.isVip) return { error: "You already have VIP." };
  const refCode = await ensureRefCode();

  const parsed = parsePostLink(formData.get("postUrl"));
  if (!parsed) {
    return { error: "Paste the link to your Reddit post. It starts with https://www.reddit.com/" };
  }
  const blocked = await claimBlockReason({ refCode });
  if (blocked) return { error: blocked };

  const postId = parsed.postId ?? (await resolveShareLink(parsed.shareUrl));
  const postUrl = postId ? postUrlFor(postId) : parsed.shareUrl;
  const lookup = postId ? await fetchPost(postId) : { reachable: false };

  if (!lookup.reachable) {
    // Reddit didn't answer (or blocks the server): an admin checks it by hand.
    const claim = await createClaim({ refCode, postId, postUrl, status: "pending", note: "Reddit couldn’t be checked automatically" });
    if (!claim) return { error: USED };
    return { pending: true };
  }

  const siteHost = new URL(await siteUrl()).host;
  const result = checkPost(lookup.post, { refCode, siteHost });
  if (result.error) return { error: result.error };

  const media = await getMediaWithCreator(result.link.mediaId);
  if (!media || media.creator_tier !== "free") {
    return { error: "Only videos from free creators count. Share one of those and post its link." };
  }
  const authorBlocked = await claimBlockReason({ refCode, author: lookup.post.author });
  if (authorBlocked) return { error: authorBlocked };

  const claim = await createClaim({ refCode, postId, postUrl, author: lookup.post.author, status: "approved" });
  if (!claim) return { error: USED };
  revalidatePath("/", "layout");
  return { approved: true, minutes: PASS_MINUTES };
}
