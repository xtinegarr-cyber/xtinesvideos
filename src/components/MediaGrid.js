"use client";

import { useState } from "react";
import Link from "next/link";
import { FiFilm, FiImage, FiPlay, FiTrash2 } from "react-icons/fi";
import { formatDuration, mediaPath } from "@/lib/format";
import { deleteMediaAction } from "@/app/admin/actions";

function Thumb({ item }) {
  if (!item.thumbUrl) return <div className="absolute inset-0 bg-raised" />;
  const vertical = item.kind === "video" && item.height > item.width;
  if (vertical) {
    // Phone videos: show the whole frame upright over a soft blurred fill
    // instead of cropping it into a wide box.
    return (
      <>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={item.thumbUrl}
          alt=""
          aria-hidden
          loading="lazy"
          decoding="async"
          className="absolute inset-0 h-full w-full scale-110 object-cover opacity-60 blur-xl"
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={item.thumbUrl} alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-contain" />
      </>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={item.thumbUrl} alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover" />
  );
}

/** One upload in a grid. Opens its own page (player, title, Share). */
export function MediaTile({ item, href }) {
  const video = item.kind === "video";
  return (
    <Link
      href={href}
      aria-label={`${video ? "Play video" : "Open photo"}${item.title ? `: ${item.title}` : ""}`}
      className={`relative block w-full overflow-hidden rounded-xl bg-panel ring-1 ring-line hover:ring-muted ${
        video ? "aspect-video" : "aspect-[3/4]"
      }`}
    >
      <Thumb item={item} />
      {video && (
        <>
          <span className="absolute inset-0 grid place-items-center">
            <span className="grid size-12 place-items-center rounded-full bg-black/55 text-white backdrop-blur-sm">
              <FiPlay aria-hidden className="ml-0.5 size-5" />
            </span>
          </span>
          <span className="absolute bottom-2 right-2 rounded-md bg-black/70 px-1.5 py-0.5 text-xs font-semibold text-white">
            {formatDuration(item.duration)}
          </span>
        </>
      )}
    </Link>
  );
}

function DeleteButton({ id }) {
  return (
    <form
      action={deleteMediaAction}
      onSubmit={(e) => {
        if (!confirm("Delete this upload? This can't be undone.")) e.preventDefault();
      }}
      className="absolute left-2 top-2"
    >
      <input type="hidden" name="mediaId" value={id} />
      <button
        type="submit"
        aria-label="Delete upload"
        className="grid size-8 place-items-center rounded-full bg-black/65 text-white hover:bg-rose"
      >
        <FiTrash2 aria-hidden className="size-4" />
      </button>
    </form>
  );
}

const TABS = [
  { id: "videos", label: "Videos", kind: "video", icon: FiFilm },
  { id: "photos", label: "Photos", kind: "image", icon: FiImage },
];

/**
 * A creator's uploads, split into Videos and Photos tabs. Videos is
 * selected unless the link says ?tab=photos.
 */
export default function MediaGrid({ items, canManage, initialTab = "videos", creatorSlug }) {
  const [tab, setTab] = useState(initialTab === "photos" ? "photos" : "videos");

  function choose(id) {
    setTab(id);
    // Keep the address in sync so a "photos" link can be shared.
    const url = new URL(window.location.href);
    if (id === "photos") url.searchParams.set("tab", "photos");
    else url.searchParams.delete("tab");
    window.history.replaceState(null, "", url);
  }

  const current = TABS.find((t) => t.id === tab);
  const shown = items.filter((i) => i.kind === current.kind);

  return (
    <>
      <div role="tablist" aria-label="Uploads" className="mb-6 inline-flex rounded-full border border-white/10 bg-white/[0.04] p-1">
        {TABS.map((t) => {
          const count = items.filter((i) => i.kind === t.kind).length;
          const active = t.id === tab;
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`tab-${t.id}`}
              aria-selected={active}
              aria-controls="uploads-panel"
              onClick={() => choose(t.id)}
              className={`inline-flex h-10 items-center gap-2 rounded-full px-5 text-sm font-bold transition-colors ${
                active ? "bg-fg text-ink" : "text-muted hover:text-fg"
              }`}
            >
              <Icon aria-hidden />
              {t.label}
              <span className={`tabular-nums ${active ? "text-ink/60" : "text-muted/70"}`}>{count}</span>
            </button>
          );
        })}
      </div>

      <div role="tabpanel" id="uploads-panel" aria-labelledby={`tab-${tab}`}>
        {shown.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line px-5 py-12 text-center text-muted">
            {canManage
              ? `No ${current.label.toLowerCase()} yet. Upload some from the admin panel.`
              : `No ${current.label.toLowerCase()} yet. Check back soon.`}
          </p>
        ) : (
          <ul
            className={`grid gap-3 sm:gap-4 ${
              tab === "videos" ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4"
            }`}
          >
            {shown.map((item) => (
              <li key={item.id} className="relative">
                <MediaTile item={item} href={mediaPath(creatorSlug, item)} />
                {canManage && <DeleteButton id={item.id} />}
                {item.title && (
                  <p className="mt-1.5 line-clamp-2 px-0.5 text-sm font-semibold leading-snug text-fg/90">{item.title}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
