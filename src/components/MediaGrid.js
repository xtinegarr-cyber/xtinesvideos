"use client";

import { useEffect, useState } from "react";
import { FiImage, FiPlay, FiTrash2, FiX } from "react-icons/fi";
import { formatDuration } from "@/lib/format";
import { deleteMediaAction } from "@/app/admin/actions";

function Viewer({ item, onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

  return (
    <div role="dialog" aria-modal="true" aria-label={item.kind === "video" ? "Video" : "Photo"} className="fixed inset-0 z-50 grid place-items-center bg-black/90 p-3 sm:p-8">
      <button aria-label="Close" className="absolute inset-0 cursor-default" onClick={onClose} />
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute right-3 top-3 z-10 grid size-11 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20"
      >
        <FiX aria-hidden className="size-6" />
      </button>
      <div className="relative max-h-full max-w-full">
        {item.kind === "video" ? (
          // preload="metadata" + a poster shows the picture instantly and
          // starts streaming only when played; faststart files begin quickly.
          <video
            src={item.url}
            poster={item.thumbUrl}
            controls
            autoPlay
            playsInline
            preload="metadata"
            className="max-h-[88dvh] max-w-full rounded-xl bg-black"
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.url} alt="" className="max-h-[88dvh] max-w-full rounded-xl object-contain" />
        )}
      </div>
    </div>
  );
}

function Tile({ item, onOpen }) {
  const inner = (
    <>
      {item.thumbUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.thumbUrl} alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <div className="absolute inset-0 bg-raised" />
      )}
      {item.kind === "video" && (
        <span className="absolute inset-0 grid place-items-center">
          <span className="grid size-12 place-items-center rounded-full bg-black/55 text-white backdrop-blur-sm">
            <FiPlay aria-hidden className="ml-0.5 size-5" />
          </span>
        </span>
      )}
      <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-md bg-black/65 px-1.5 py-0.5 text-xs font-semibold text-white">
        {item.kind === "video" ? formatDuration(item.duration) : <FiImage aria-label="Photo" />}
      </span>
    </>
  );

  const className = "relative block aspect-square w-full overflow-hidden rounded-xl bg-panel ring-1 ring-line";
  return (
    <button type="button" onClick={() => onOpen(item)} className={`${className} hover:ring-muted`} aria-label={item.kind === "video" ? "Play video" : "Open photo"}>
      {inner}
    </button>
  );
}

export default function MediaGrid({ items, canManage }) {
  const [open, setOpen] = useState(null);

  if (items.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-line px-5 py-12 text-center text-muted">
        {canManage ? "No uploads yet. Add videos and photos from the admin panel." : "No videos or photos yet. Check back soon."}
      </p>
    );
  }

  return (
    <>
      <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4">
        {items.map((item) => (
          <li key={item.id} className="relative">
            <Tile item={item} onOpen={setOpen} />
            {canManage && (
              <form
                action={deleteMediaAction}
                onSubmit={(e) => {
                  if (!confirm("Delete this upload? This can't be undone.")) e.preventDefault();
                }}
                className="absolute left-2 top-2"
              >
                <input type="hidden" name="mediaId" value={item.id} />
                <button
                  type="submit"
                  aria-label="Delete upload"
                  className="grid size-8 place-items-center rounded-full bg-black/65 text-white hover:bg-rose"
                >
                  <FiTrash2 aria-hidden className="size-4" />
                </button>
              </form>
            )}
          </li>
        ))}
      </ul>
      {open && <Viewer item={open} onClose={() => setOpen(null)} />}
    </>
  );
}
