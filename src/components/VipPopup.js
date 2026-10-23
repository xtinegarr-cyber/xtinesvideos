"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { FiLock, FiX } from "react-icons/fi";
import { GetVipButton } from "./VipForms";
import { PASS_MINUTES } from "@/lib/free-vip";

const DELAY_MS = 60_000;
const STARTED_KEY = "xv_visit_started";
const SHOWN_KEY = "xv_vip_popup_shown";
// Pages where an upsell would get in the way.
const QUIET_PATHS = ["/vip", "/login", "/account", "/admin"];

function readSession(key) {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeSession(key, value) {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    // Private browsing can block storage; the popup still works once.
  }
}

/**
 * Shows the VIP offer once per visit, 60 seconds after the visitor arrives
 * (time on the site, not on the current page). Only rendered for visitors
 * without VIP.
 */
export default function VipPopup({ priceLabel }) {
  const pathname = usePathname() || "/";
  const [open, setOpen] = useState(false);
  const dialogRef = useRef(null);
  const quiet = QUIET_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  useEffect(() => {
    if (quiet || readSession(SHOWN_KEY)) return;
    let started = Number(readSession(STARTED_KEY));
    if (!started) {
      started = Date.now();
      writeSession(STARTED_KEY, String(started));
    }
    const wait = Math.max(0, DELAY_MS - (Date.now() - started));
    const timer = setTimeout(() => {
      writeSession(SHOWN_KEY, "1");
      setOpen(true);
    }, wait);
    return () => clearTimeout(timer);
  }, [quiet]);

  useEffect(() => {
    if (!open) return;
    // Move focus into the dialog for keyboard and screen reader users.
    dialogRef.current?.focus();
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!open || quiet) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-black/70 p-4 backdrop-blur-sm sm:place-items-center">
      <button aria-label="Close" className="absolute inset-0 cursor-default" onClick={() => setOpen(false)} />
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="vip-popup-title"
        className="pop-in relative w-full max-w-md overflow-hidden rounded-3xl outline-none border border-gold/40 bg-panel p-7 shadow-[0_30px_80px_rgba(0,0,0,0.6)]"
      >
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Close"
          className="absolute right-4 top-4 grid size-9 place-items-center rounded-full text-muted hover:bg-raised hover:text-fg"
        >
          <FiX aria-hidden className="size-5" />
        </button>
        <div className="grid size-12 place-items-center rounded-full bg-gold/15 text-gold">
          <FiLock aria-hidden className="size-6" strokeWidth={2.25} />
        </div>
        <h2 id="vip-popup-title" className="mt-5 text-3xl font-extrabold tracking-tight">
          Unlock every VIP creator
        </h2>
        <p className="mt-2 text-muted">
          See every locked profile, video and photo for{" "}
          <span className="font-semibold text-fg">{priceLabel} a month</span>. Cancel anytime.
        </p>
        <div className="mt-7 flex flex-col gap-2 sm:flex-row-reverse">
          <GetVipButton formClassName="flex-1" className="h-12 w-full px-6">
            Get VIP for {priceLabel}/month
          </GetVipButton>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="inline-flex h-12 items-center justify-center rounded-full px-6 font-semibold text-muted hover:text-fg"
          >
            Not now
          </button>
        </div>
        <p className="mt-4 text-center text-sm text-muted">
          Or{" "}
          <a href="/vip/reddit" className="font-semibold text-fg underline-offset-4 hover:underline">
            get {PASS_MINUTES} minutes free
          </a>{" "}
          by sharing a video on Reddit.
        </p>
      </div>
    </div>
  );
}
