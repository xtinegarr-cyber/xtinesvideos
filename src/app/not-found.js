import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto grid min-h-dvh max-w-md place-content-center px-4 text-center">
      <h1 className="text-4xl font-extrabold tracking-tight">This page doesn’t exist</h1>
      <p className="mt-3 text-muted">The creator may have been removed, or the link has a typo.</p>
      <Link href="/" className="mx-auto mt-8 inline-flex h-11 items-center rounded-full bg-fg px-6 font-bold text-ink">
        Back to all creators
      </Link>
    </main>
  );
}
