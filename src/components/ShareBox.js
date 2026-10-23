"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FiCheck, FiCopy, FiShare2 } from "react-icons/fi";

/**
 * A personal link to this video (it carries this browser's share code),
 * plus a shortcut to post it on Reddit for free VIP.
 */
export default function ShareBox({ path, title, minutes, showReward }) {
  const [link, setLink] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/share-code", { cache: "no-store" })
      .then((res) => res.json())
      .then(({ code }) => !cancelled && setLink(`${window.location.origin}${path}${code ? `?r=${code}` : ""}`))
      .catch(() => !cancelled && setLink(`${window.location.origin}${path}`));
    return () => {
      cancelled = true;
    };
  }, [path]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Older browsers: the link stays selected in the box for copying.
    }
  }

  const reddit = link ? `https://www.reddit.com/submit?url=${encodeURIComponent(link)}&title=${encodeURIComponent(title)}` : null;

  return (
    <section id="share" aria-labelledby="share-heading" className="mt-6 rounded-3xl border border-line bg-panel/80 p-5 sm:p-6">
      <h2 id="share-heading" className="flex items-center gap-2 text-xl font-extrabold">
        <FiShare2 aria-hidden className="text-gold" /> Share this video
      </h2>
      {showReward && (
        <p className="mt-1 text-sm text-muted">
          Post your link on Reddit and get <span className="font-semibold text-fg">{minutes} minutes of VIP free</span>.
          The link below is yours, so we know the post is from you.
        </p>
      )}
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <input
          readOnly
          value={link || "Making your link…"}
          aria-label="Your link to this video"
          onFocus={(e) => e.target.select()}
          className="h-11 min-w-0 flex-1 rounded-xl border border-line bg-ink px-3 text-sm text-fg"
        />
        <button
          type="button"
          onClick={copy}
          disabled={!link}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-line px-5 text-sm font-semibold hover:border-muted disabled:opacity-60"
        >
          {copied ? <FiCheck aria-hidden className="text-[#9be4b8]" /> : <FiCopy aria-hidden />}
          {copied ? "Copied" : "Copy link"}
        </button>
      </div>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        {reddit && (
          <a href={reddit} target="_blank" rel="noopener noreferrer" className="btn-vip h-11 px-5 text-sm">
            Post on Reddit
          </a>
        )}
        {showReward && (
          <Link href="/vip/reddit" className="text-sm font-semibold text-muted underline-offset-4 hover:text-fg hover:underline sm:ml-2">
            Posted it? Paste your post’s link to get VIP →
          </Link>
        )}
      </div>
    </section>
  );
}
