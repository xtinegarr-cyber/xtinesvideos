"use client";

import { useEffect, useRef } from "react";

/**
 * Reports a profile view once the page has loaded in a real browser.
 * The server decides whether it counts (one per visitor per day, no bots).
 */
export default function ViewTracker({ slug }) {
  const sent = useRef(false);
  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    fetch("/api/views", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug }),
      keepalive: true,
    }).catch(() => {});
  }, [slug]);
  return null;
}
