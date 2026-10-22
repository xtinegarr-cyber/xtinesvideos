"use client";

import { useState } from "react";

/** A setup link the admin can copy and send to a buyer. */
export default function CopyLink({ url }) {
  const [copied, setCopied] = useState(false);
  return (
    <span className="flex min-w-0 items-center gap-2">
      <input
        readOnly
        value={url}
        onFocus={(e) => e.target.select()}
        aria-label="Account setup link"
        className="h-9 min-w-0 flex-1 rounded-lg border border-line bg-ink px-2.5 font-mono text-xs text-muted"
      />
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          } catch {}
        }}
        className="h-9 shrink-0 rounded-lg border border-line px-3 text-xs font-semibold hover:border-muted"
      >
        {copied ? "Copied" : "Copy link"}
      </button>
    </span>
  );
}
