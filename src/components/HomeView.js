import Link from "next/link";
import { FiLock } from "react-icons/fi";
import SiteHeader from "./SiteHeader";
import CreatorCard from "./CreatorCard";

function Grid({ creators }) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5">
      {creators.map((c) => (
        <li key={c.slug}>
          <CreatorCard creator={c} />
        </li>
      ))}
    </ul>
  );
}

function VipStrip({ priceLabel }) {
  return (
    <div className="border-b border-gold/25 bg-gold/[0.07]">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-2.5 sm:px-6">
        <p className="text-sm text-fg/90">
          <span className="font-bold text-gold">VIP</span> unlocks every creator for {priceLabel} a month. Cancel
          anytime.
        </p>
        <Link
          href="/vip"
          className="inline-flex h-9 items-center rounded-full bg-gold px-5 text-sm font-bold text-ink transition-colors hover:bg-[#f2d49a]"
        >
          Get VIP
        </Link>
      </div>
    </div>
  );
}

function SectionHeading({ title, count, children }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
          {title}
          <span className="ml-2 align-middle text-base font-semibold text-muted">{count}</span>
        </h2>
        {children}
      </div>
    </div>
  );
}

function Empty({ children }) {
  return <p className="rounded-2xl border border-dashed border-line px-5 py-10 text-center text-muted">{children}</p>;
}

/**
 * free / vip: arrays of card data (see CreatorCard).
 */
export default function HomeView({ viewer, search, free, vip, priceLabel }) {
  const searching = Boolean(search);
  const noResults = searching && free.length === 0 && vip.length === 0;
  const showVipPitch = !viewer?.isVip;

  return (
    <>
      <SiteHeader viewer={viewer} search={search} />
      {showVipPitch && <VipStrip priceLabel={priceLabel} />}

      <main className="mx-auto max-w-7xl px-4 pb-24 pt-8 sm:px-6">
        {searching && (
          <p className="mb-6 text-sm text-muted">
            {noResults ? "No creators match" : "Showing creators matching"}{" "}
            <span className="font-semibold text-fg">“{search}”</span>.{" "}
            <Link href="/" className="font-semibold text-gold underline-offset-4 hover:underline">
              Clear search
            </Link>
          </p>
        )}

        {!noResults && (
          <>
            <section aria-labelledby="free-heading">
              <SectionHeading title={<span id="free-heading">Free creators</span>} count={free.length} />
              {free.length ? (
                <Grid creators={free} />
              ) : (
                <Empty>{searching ? "No free creators match this search." : "Free creators will show up here."}</Empty>
              )}
            </section>

            <section
              aria-labelledby="vip-heading"
              className="relative mt-16 rounded-3xl border border-gold/25 bg-panel/60 px-4 pb-6 pt-7 sm:px-6"
            >
              <SectionHeading
                title={
                  <span id="vip-heading" className="inline-flex items-center gap-2.5">
                    <FiLock aria-hidden className="size-6 text-gold" strokeWidth={2.25} />
                    VIP creators
                  </span>
                }
                count={vip.length}
              >
                <p className="mt-1.5 text-sm text-muted">
                  {viewer?.isVip
                    ? "You have VIP, so every profile here is unlocked."
                    : `Unlock every VIP profile for ${priceLabel} a month. Cancel anytime.`}
                </p>
              </SectionHeading>
              {showVipPitch && (
                <Link
                  href="/vip"
                  className="absolute right-4 top-7 hidden h-10 items-center rounded-full bg-gold px-5 text-sm font-bold text-ink transition-colors hover:bg-[#f2d49a] sm:inline-flex sm:right-6"
                >
                  Get VIP
                </Link>
              )}
              {vip.length ? (
                <Grid creators={vip} />
              ) : (
                <Empty>{searching ? "No VIP creators match this search." : "VIP creators will show up here."}</Empty>
              )}
            </section>
          </>
        )}
      </main>
    </>
  );
}
