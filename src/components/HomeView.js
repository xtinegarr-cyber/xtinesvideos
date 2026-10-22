import Link from "next/link";
import { FiLock } from "react-icons/fi";
import SiteHeader from "./SiteHeader";
import CreatorCard from "./CreatorCard";
import VipBanner from "./VipBanner";

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

      <main className="mx-auto max-w-7xl px-4 pb-24 pt-6 sm:px-6 sm:pt-8">
        {showVipPitch && !searching && (
          <div className="mb-10">
            <VipBanner priceLabel={priceLabel} previews={vip} />
          </div>
        )}

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
              className="relative mt-16 overflow-hidden rounded-3xl border border-gold/20 bg-[linear-gradient(180deg,rgba(231,203,152,0.07),rgba(14,19,37,0.55)_160px)] px-4 pb-6 pt-7 sm:px-6"
            >
              <span
                aria-hidden
                className="absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-gold/60 to-transparent"
              />
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
                  className="btn-vip absolute right-6 top-7 hidden h-10 px-5 text-sm sm:inline-flex"
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
