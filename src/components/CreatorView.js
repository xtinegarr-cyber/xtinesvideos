import Link from "next/link";
import { FiArrowLeft, FiEye, FiLock } from "react-icons/fi";
import SiteHeader from "./SiteHeader";
import CreatorImage from "./CreatorImage";
import MediaGrid from "./MediaGrid";
import ViewTracker from "./ViewTracker";
import { formatViews } from "@/lib/format";

function plural(n, word) {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

/** What visitors without VIP see instead of a VIP creator's uploads. */
function VipGate({ creator, counts, viewer, priceLabel }) {
  const total = counts.videos + counts.photos;
  return (
    <section
      aria-labelledby="vip-gate-heading"
      className="relative mt-10 overflow-hidden rounded-3xl border border-gold/20 bg-[radial-gradient(90%_120%_at_50%_0%,rgba(231,203,152,0.14),rgba(14,19,37,0.7)_60%)] px-6 py-12 text-center sm:py-16"
    >
      <span
        aria-hidden
        className="absolute inset-x-12 top-0 h-px bg-gradient-to-r from-transparent via-gold/70 to-transparent"
      />
      <span aria-hidden className="mx-auto grid size-14 place-items-center rounded-full bg-gold/15 text-gold ring-1 ring-gold/30">
        <FiLock className="size-6" strokeWidth={2.25} />
      </span>
      <h2 id="vip-gate-heading" className="mx-auto mt-5 max-w-xl text-3xl font-extrabold tracking-tight sm:text-4xl">
        Get VIP to view {creator.name}’s content
      </h2>
      <p className="mx-auto mt-3 max-w-md text-muted">
        {total > 0
          ? `${plural(counts.videos, "video")} and ${plural(counts.photos, "photo")}, plus every other VIP creator. `
          : "Unlock this creator and every other VIP creator. "}
        <span className="font-semibold text-fg">{priceLabel} a month</span>, cancel anytime.
      </p>
      <div className="mt-8 flex flex-col items-center gap-3">
        <Link href="/vip" className="btn-vip h-12 w-full max-w-xs px-7">
          Get VIP for {priceLabel}/month
        </Link>
        {!viewer && (
          <Link
            href={`/login?next=/${creator.slug}`}
            className="text-sm font-semibold text-muted underline-offset-4 hover:text-fg hover:underline"
          >
            Already VIP? Log in
          </Link>
        )}
      </div>
    </section>
  );
}

export default function CreatorView({ viewer, creator, items, counts, canManage, trackView, priceLabel }) {
  const vip = creator.tier === "vip";
  const { videos, photos } = counts;

  return (
    <>
      <SiteHeader viewer={viewer} />
      {trackView && <ViewTracker slug={creator.slug} />}

      <main className="mx-auto max-w-6xl px-4 pb-24 pt-6 sm:px-6">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-fg">
          <FiArrowLeft aria-hidden /> All creators
        </Link>

        <div className="mt-6 flex flex-col gap-6 sm:flex-row sm:items-end">
          <div
            className={`relative aspect-[3/4] w-36 shrink-0 overflow-hidden rounded-2xl ring-1 sm:w-44 ${
              vip ? "ring-gold/50" : "ring-line"
            }`}
          >
            <CreatorImage name={creator.name} src={creator.imageUrl} locked={creator.locked} className="absolute inset-0" />
            {creator.locked && (
              <span className="absolute inset-0 grid place-items-center">
                <FiLock aria-hidden className="size-8 text-white/90" strokeWidth={1.75} />
              </span>
            )}
            {creator.isNew && (
              <span className="absolute left-2 top-2 rounded-full bg-rose px-2.5 py-1 text-xs font-bold leading-none text-white">
                New
              </span>
            )}
          </div>

          <div className="min-w-0 flex-1">
            {vip && (
              <span className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-gold/40 bg-gold/10 px-2.5 py-1 text-xs font-bold text-gold">
                <FiLock aria-hidden /> VIP creator
              </span>
            )}
            <h1 className="break-words text-4xl font-extrabold tracking-tight sm:text-5xl">{creator.name}</h1>
            <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
              <span className="inline-flex items-center gap-1.5">
                <FiEye aria-hidden /> {formatViews(creator.views)}
              </span>
              <span>{plural(videos, "video")}</span>
              <span>{plural(photos, "photo")}</span>
            </p>
          </div>
        </div>

        {creator.locked ? (
          <VipGate creator={creator} counts={counts} viewer={viewer} priceLabel={priceLabel} />
        ) : (
          <div className="mt-8">
            <MediaGrid items={items} canManage={canManage} />
          </div>
        )}
      </main>
    </>
  );
}
