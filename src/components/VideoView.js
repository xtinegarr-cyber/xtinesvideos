import Link from "next/link";
import { FiArrowLeft, FiGift, FiLock } from "react-icons/fi";
import SiteHeader from "./SiteHeader";
import ShareBox from "./ShareBox";
import ViewTracker from "./ViewTracker";
import { GetVipButton } from "./VipForms";
import TitleEditor from "./TitleEditor";
import { displayTitle, formatDate, formatDuration } from "@/lib/format";

export default function VideoView({ viewer, isVip, creator, item, locked, canEdit = false, trackView, rewardMinutes, priceLabel }) {
  const video = item.kind === "video";
  const path = `/${creator.slug}/v/${item.id}`;
  const free = creator.tier === "free";
  const name = displayTitle(item.title, creator.name, item.kind);

  return (
    <>
      <SiteHeader viewer={viewer} />
      {trackView && !locked && <ViewTracker slug={creator.slug} />}
      <main className="mx-auto max-w-5xl px-4 pb-28 pt-6 sm:px-6">
        <Link href={`/${creator.slug}`} className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-fg">
          <FiArrowLeft aria-hidden /> {creator.name}
        </Link>

        <div className="relative mt-4 grid place-items-center overflow-hidden rounded-2xl bg-black ring-1 ring-line">
          {locked ? (
            <>
              {item.thumbUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.thumbUrl} alt="" className="aspect-video w-full object-cover opacity-80" />
              ) : (
                <div className="aspect-video w-full bg-raised" />
              )}
              <span className="absolute inset-0 grid place-items-center">
                <span className="grid size-14 place-items-center rounded-full bg-black/60 text-gold ring-1 ring-gold/40">
                  <FiLock aria-hidden className="size-6" />
                </span>
              </span>
            </>
          ) : video ? (
            <video
              src={item.url}
              poster={item.thumbUrl}
              controls
              playsInline
              preload="metadata"
              className="max-h-[75dvh] w-full bg-black object-contain"
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.url} alt="" className="max-h-[80dvh] w-auto max-w-full object-contain" />
          )}
        </div>

        <div className="mt-4">
          <h1 className="break-words text-2xl font-extrabold tracking-tight sm:text-3xl">{name}</h1>
          <p className="mt-1 text-sm text-muted">
            <Link href={`/${creator.slug}`} className="font-semibold text-fg hover:underline">
              {creator.name}
            </Link>{" "}
            · {video ? `Video${item.duration ? ` · ${formatDuration(item.duration)}` : ""}` : "Photo"} · {formatDate(item.createdAt)}
          </p>
          {canEdit && <TitleEditor mediaId={item.id} title={item.title} placeholder={name} />}
        </div>

        {locked ? (
          <section className="mt-6 rounded-3xl border border-gold/25 bg-panel/80 p-6 text-center">
            <h2 className="text-2xl font-extrabold">Get VIP to watch this</h2>
            <p className="mx-auto mt-2 max-w-md text-muted">
              {creator.name} is a VIP creator. Unlock every VIP creator for {priceLabel} a month.
            </p>
            <div className="mt-5 flex flex-col items-center gap-3">
              <GetVipButton formClassName="w-full max-w-xs" className="h-12 w-full px-7">
                Get VIP for {priceLabel}/month
              </GetVipButton>
              <Link href="/vip/reddit" className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-fg">
                <FiGift aria-hidden /> Or get {rewardMinutes} minutes free by sharing on Reddit
              </Link>
            </div>
          </section>
        ) : (
          free && (
            <ShareBox
              path={path}
              title={item.title ? `${item.title} - ${creator.name}` : name}
              minutes={rewardMinutes}
              showReward={!isVip}
            />
          )
        )}
      </main>
    </>
  );
}
