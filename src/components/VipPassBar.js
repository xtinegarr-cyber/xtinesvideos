"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FiClock } from "react-icons/fi";

function left(until) {
  const ms = Math.max(0, new Date(until).getTime() - Date.now());
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return { ms, label: `${m}:${String(s).padStart(2, "0")}` };
}

/** Countdown for a free VIP pass. Locks VIP again when it runs out. */
export default function VipPassBar({ until }) {
  const router = useRouter();
  const [time, setTime] = useState(() => left(until));

  useEffect(() => {
    const timer = setInterval(() => {
      const next = left(until);
      setTime(next);
      if (next.ms <= 0) {
        clearInterval(timer);
        router.refresh();
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [until, router]);

  if (time.ms <= 0) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-40 flex justify-center px-4">
      <div
        role="status"
        className="pointer-events-auto flex items-center gap-3 rounded-full border border-gold/40 bg-ink/90 py-2 pl-4 pr-2 text-sm shadow-[0_18px_50px_-15px_rgba(0,0,0,0.9)] backdrop-blur"
      >
        <FiClock aria-hidden className="text-gold" />
        <span>
          Free VIP: <span className="font-bold tabular-nums text-gold">{time.label}</span> left
        </span>
        <Link href="/vip" className="btn-vip h-8 px-3.5 text-xs">
          Keep VIP
        </Link>
      </div>
    </div>
  );
}
