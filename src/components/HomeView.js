"use client";

import { useState } from "react";
import Link from "next/link";
import { FiLock } from "react-icons/fi";
import SiteHeader from "./SiteHeader";
import CreatorCard from "./CreatorCard";
import VipBanner from "./VipBanner";
import { GetVipButton } from "./VipForms";
import { MediaTile } from "./MediaGrid";
import CreatorImage from "./CreatorImage";
import { mediaPath } from "@/lib/format";

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

function SectionHeading({ title, count, children, action }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <div>
        <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
          {title}
          <span className="ml-2 align-middle text-base font-semibold text-muted">{count}</span>
        </h2>
        {children}
      </div>
      {action}
    </div>
  );
}

function Empty({ children }) {
  return <p className="rounded-2xl border border-dashed border-line px-5 py-10 text-center text-muted">{children}</p>;
}

/**
 * free / vip: arrays of card data (see CreatorCard).
 * latest: recent free videos for the Latest tab.
 */
export default function HomeView({ viewer, isVip = Boolean(viewer?.isVip), search, free, vip, priceLabel, latest = [] }) {
  const [tab, setTab] = useState("creators");
  const searching = Boolean(search);
  const noResults = searching && free.length === 0 && vip.length === 0;
  const showVipPitch = !isVip;

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

        {!searching && (
          <div role="tablist" aria-label="Home sections" className="mb-8 inline-flex rounded-full border border-white/10 bg-white/[0.04] p-1">
            <button
              type="button"
              role="tab"
              aria-selected={tab === "creators"}
              onClick={() => setTab("creators")}
              className={`h-10 rounded-full px-5 text-sm font-bold transition-colors ${
                tab === "creators" ? "bg-fg text-ink" : "text-muted hover:text-fg"
              }`}
            >
              Creators
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "videos"}
              onClick={() => setTab("videos")}
              className={`h-10 rounded-full px-5 text-sm font-bold transition-colors ${
                tab === "videos" ? "bg-fg text-ink" : "text-muted hover:text-fg"
              }`}
            >
              Latest videos
            </button>
          </div>
        )}

        {tab === "creators" || searching ? (
          !noResults && (
            <>
              <section aria-labelledby="free-heading">
                <SectionHeading title={<span id="free-heading">Free creators</span>} count={free.length} />
                {free.length ? (
                  <Grid creators={free} />
                ) : (
                  <Empty>{searching ? "No free creators match this search." : "Free creators will show up here."}</Empty>
                )}
              </section>

              <section aria-labelledby="vip-heading" className="mt-16">
                <SectionHeading
                  title={
                    <span id="vip-heading" className="inline-flex items-center gap-2.5">
                      <FiLock aria-hidden className="size-6 text-gold" strokeWidth={2.25} />
                      VIP creators
                    </span>
                  }
                  count={vip.length}
                  action={
                    showVipPitch && (
                      <GetVipButton className="h-10 px-5 text-sm">Get VIP for {priceLabel}/month</GetVipButton>
                    )
                  }
                >
                  <p className="mt-1.5 text-sm text-muted">
                    {isVip
                      ? "You have VIP, so every profile here is unlocked."
                      : `Unlock every VIP profile for ${priceLabel} a month. Cancel anytime.`}
                  </p>
                </SectionHeading>
                {vip.length ? (
                  <Grid creators={vip} />
                ) : (
                  <Empty>{searching ? "No VIP creators match this search." : "VIP creators will show up here."}</Empty>
                )}
              </section>
            </>
          )
        ) : (
          <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {latest.map((v) => (
              <li key={v.id}>
                <div className="relative">
                  <MediaTile item={v} href={mediaPath(v.creatorSlug, v)} />
                  <Link
                    href={`/${v.creatorSlug}`}
                    className="absolute bottom-2 left-2 size-10 overflow-hidden rounded-full ring-2 ring-black/70"
                    aria-label={v.creatorName}
                  >
                    <CreatorImage name={v.creatorName} src={v.creatorAvatar} className="h-full w-full" />
                  </Link>
                </div>
                <p className="mt-2 line-clamp-2 text-sm font-semibold leading-snug text-fg">
                  {v.title || `${v.creatorName} video`}
                </p>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
