import Link from "next/link";
import { FiLock } from "react-icons/fi";
import CreatorImage from "./CreatorImage";

const TILT = [-9, 0, 9];

/** A small fanned stack of real (blurred) VIP profile pictures. */
function PreviewFan({ previews }) {
  return (
    <div aria-hidden className="relative h-[86px] w-[118px] shrink-0">
      {previews.map((p, i) => (
        <div
          key={p.slug}
          className="absolute top-1 h-20 w-[60px] overflow-hidden rounded-xl shadow-[0_10px_24px_-8px_rgba(0,0,0,0.8)] ring-1 ring-gold/35"
          style={{
            left: previews.length === 1 ? 29 : i * (58 / (previews.length - 1)),
            transform: `rotate(${previews.length === 1 ? 0 : TILT[i]}deg)`,
            zIndex: i === 1 ? 3 : 1,
          }}
        >
          <CreatorImage name={p.name} src={p.imageUrl} locked className="absolute inset-0 [&_span]:text-lg" />
        </div>
      ))}
      <span className="absolute left-1/2 top-1/2 z-10 grid size-8 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-ink/70 text-gold ring-1 ring-gold/40 backdrop-blur-sm">
        <FiLock className="size-4" strokeWidth={2.25} />
      </span>
    </div>
  );
}

/**
 * The VIP offer at the top of the homepage. Shows up to three of the
 * actual VIP creators, blurred, so visitors see what they're unlocking.
 */
export default function VipBanner({ priceLabel, previews = [] }) {
  const fan = previews.slice(0, 3);
  // Put the most recent creator in the middle, on top.
  if (fan.length === 3) [fan[0], fan[1]] = [fan[1], fan[0]];

  return (
    <section
      aria-label="VIP membership"
      className="relative overflow-hidden rounded-3xl border border-gold/20 bg-[linear-gradient(110deg,rgba(231,203,152,0.13)_0%,rgba(14,19,37,0.72)_42%,rgba(14,19,37,0.5)_100%)] px-4 py-4 shadow-[0_24px_60px_-28px_rgba(0,0,0,0.9)] sm:px-6 sm:py-5"
    >
      <span
        aria-hidden
        className="absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-gold/70 to-transparent"
      />
      <div className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-4 sm:flex sm:gap-6">
        {fan.length > 0 ? (
          <PreviewFan previews={fan} />
        ) : (
          <span aria-hidden className="grid size-12 place-items-center rounded-full bg-gold/15 text-gold ring-1 ring-gold/30">
            <FiLock className="size-5" strokeWidth={2.25} />
          </span>
        )}
        <div className="min-w-0">
          <h2 className="text-lg font-extrabold leading-tight tracking-tight sm:text-2xl">
            See every VIP creator without the blur
          </h2>
          <p className="mt-1 text-sm text-muted">
            <span className="font-semibold text-gold">{priceLabel} a month.</span> Cancel anytime.
          </p>
        </div>
        <Link href="/vip" className="btn-vip col-span-2 h-12 w-full px-7 sm:ml-auto sm:w-auto sm:shrink-0">
          Get VIP
        </Link>
      </div>
    </section>
  );
}
