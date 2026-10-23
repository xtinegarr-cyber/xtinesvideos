"use client";

// Shown instead of a page that failed to load (for example while the
// database restarts during an update). Visitors can try again in place.
import { useEffect } from "react";
import Link from "next/link";

export default function ErrorPage({ error, reset }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto grid min-h-dvh max-w-md place-content-center px-4 text-center">
      <h1 className="text-4xl font-extrabold tracking-tight">Something went wrong</h1>
      <p className="mt-3 text-muted">This page didn’t load. It’s usually fixed in a few seconds, so try again.</p>
      <div className="mt-8 flex flex-wrap justify-center gap-2">
        <button type="button" onClick={() => reset()} className="btn-vip h-11 px-6">
          Try again
        </button>
        <Link href="/" className="inline-flex h-11 items-center rounded-full border border-line px-6 font-semibold hover:border-muted">
          All creators
        </Link>
      </div>
    </main>
  );
}
