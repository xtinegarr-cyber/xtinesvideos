import Link from "next/link";
import { FiEye, FiLock } from "react-icons/fi";
import CreatorImage from "./CreatorImage";
import { formatViews } from "@/lib/format";

/**
 * creator: { slug, name, tier, views, isNew, imageUrl, locked }
 * views is null for locked VIP creators: their count is for VIP members only.
 * For locked VIP creators, imageUrl is already the blurred version.
 */
export default function CreatorCard({ creator }) {
  const vip = creator.tier === "vip";
  return (
    <Link
      // Visitors without VIP can't open VIP profiles from here; the card
      // takes them to Get VIP instead.
      href={creator.locked ? "/vip" : `/${creator.slug}`}
      aria-label={creator.locked ? `${creator.name}, VIP only. Get VIP to unlock` : undefined}
      className={`group relative block aspect-[3/4] overflow-hidden rounded-2xl bg-panel ring-1 transition-[box-shadow] ${
        vip ? "ring-gold/35 hover:ring-gold/80" : "ring-line hover:ring-muted"
      }`}
    >
      <CreatorImage name={creator.name} src={creator.imageUrl} locked={creator.locked} className="absolute inset-0" />

      {creator.locked && (
        <div className="absolute inset-0 grid place-items-center">
          <FiLock aria-hidden className="size-9 text-white/90 drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)]" strokeWidth={1.75} />
          <span className="sr-only">VIP only</span>
        </div>
      )}

      {creator.isNew && (
        <span className="absolute left-2.5 top-2.5 rounded-full bg-rose px-2.5 py-1 text-xs font-bold leading-none text-white shadow-[0_2px_10px_rgba(255,79,139,0.45)]">
          New
        </span>
      )}

      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/45 to-transparent px-3 pb-3 pt-12">
        <p className="truncate text-base font-bold leading-tight text-white">{creator.name}</p>
        {creator.views === null ? (
          <p className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-gold">
            <FiLock aria-hidden className="shrink-0" />
            VIP only
          </p>
        ) : (
          <p className="mt-1 flex items-center gap-1.5 text-xs font-medium text-white/75">
            <FiEye aria-hidden className="shrink-0" />
            {formatViews(creator.views)}
          </p>
        )}
      </div>
    </Link>
  );
}
