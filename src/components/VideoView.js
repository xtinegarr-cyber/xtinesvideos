import Link from "next/link";
import { FiArrowLeft, FiLock } from "react-icons/fi";
import SiteHeader from "./SiteHeader";
import ShareBox from "./ShareBox";
import VideoPlayer from "./VideoPlayer";
import { MediaTile } from "./MediaGrid";
import ViewTracker from "./ViewTracker";
import { GetVipButton } from "./VipForms";
import TitleEditor from "./TitleEditor";
import { displayTitle, formatDate, formatDuration, mediaPath } from "@/lib/format";

export default function VideoView({ viewer, isVip, creator, item, more = [], locked, canEdit = false, trackView, rewardMinutes, priceLabel }) {
  const video = item.kind === "video";
  const path = mediaPath(creator.slug, item);
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

        <div
          className={`relative mt-4 grid place-items-center overflow-hidden ${
            video && !locked ? "" : "rounded-2xl bg-black ring-1 ring-line"
          }`}
        >
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
            <VideoPlayer src={item.url} poster={item.thumbUrl} label={name} width={item.width} height={item.height} />
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
          {canEdit && video && <TitleEditor mediaId={item.id} title={item.title} placeholder={name} />}
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
        {more.length > 0 && (
          <section aria-labelledby="more-heading" className="mt-12">
            <div className="flex items-baseline justify-between gap-3">
              <h2 id="more-heading" className="text-xl font-extrabold">
                More from {creator.name}
              </h2>
              <Link href={`/${creator.slug}`} className="text-sm font-semibold text-muted hover:text-fg">
                See all
              </Link>
            </div>
            <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
              {more.map((m) => (
                <li key={m.id}>
                  <MediaTile item={m} href={mediaPath(creator.slug, m)} />
                  {m.title && <p className="mt-1.5 line-clamp-2 px-0.5 text-sm font-semibold leading-snug text-fg/90">{m.title}</p>}
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </>
  );
}
