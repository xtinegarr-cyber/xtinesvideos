import Link from "next/link";
import { FiArrowLeft, FiEye, FiLock } from "react-icons/fi";
import SiteHeader from "./SiteHeader";
import CreatorImage from "./CreatorImage";
import MediaGrid from "./MediaGrid";
import ViewTracker from "./ViewTracker";
import { formatViews } from "@/lib/format";

export default function CreatorView({ viewer, creator, items, canManage, trackView, priceLabel }) {
  const vip = creator.tier === "vip";
  const videos = items.filter((i) => i.kind === "video").length;
  const photos = items.length - videos;

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
              <span>
                {videos} {videos === 1 ? "video" : "videos"}
              </span>
              <span>
                {photos} {photos === 1 ? "photo" : "photos"}
              </span>
            </p>
          </div>
        </div>

        {creator.locked && (
          <div className="mt-8 flex flex-col gap-4 rounded-2xl border border-gold/25 bg-[linear-gradient(105deg,rgba(231,203,152,0.12),rgba(14,19,37,0.6)_55%)] p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-bold text-fg">{creator.name}’s videos and photos are for VIP members.</p>
              <p className="mt-1 text-sm text-muted">
                VIP is {priceLabel} a month and unlocks every VIP creator. Cancel anytime.
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              {!viewer && (
                <Link
                  href={`/login?next=/c/${creator.slug}`}
                  className="inline-flex h-11 items-center rounded-full border border-line px-5 text-sm font-semibold hover:border-muted"
                >
                  Log in
                </Link>
              )}
              <Link
                href="/vip"
                className="btn-vip h-11 px-5 text-sm"
              >
                Get VIP
              </Link>
            </div>
          </div>
        )}

        <div className="mt-8">
          <MediaGrid items={items} locked={creator.locked} canManage={canManage} />
        </div>
      </main>
    </>
  );
}
