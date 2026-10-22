"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FiAlertCircle, FiCheckCircle, FiFilm, FiImage, FiUploadCloud } from "react-icons/fi";
import { formatBytes } from "@/lib/format";

const MAX_RETRIES = 5;

function sendChunk(id, offset, blob, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", `/api/admin/uploads/${id}?offset=${offset}`);
    xhr.setRequestHeader("Content-Type", "application/octet-stream");
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded);
    xhr.onload = () => {
      let data = {};
      try {
        data = JSON.parse(xhr.responseText);
      } catch {}
      if (xhr.status === 200) resolve(data);
      // Out of sync (e.g. a retry after a piece did arrive): continue from
      // whatever the server actually has.
      else if (xhr.status === 409 && typeof data.received === "number") resolve(data);
      else reject(Object.assign(new Error(data.error || `Upload failed (${xhr.status}).`), { fatal: xhr.status < 500 }));
    };
    xhr.onerror = () => reject(new Error("Connection lost."));
    xhr.send(blob);
  });
}

async function postJson(url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status}).`);
  return data;
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function StatusLine({ item }) {
  switch (item.status) {
    case "waiting":
      return <span className="text-muted">Waiting</span>;
    case "uploading":
      return <span className="text-fg">Uploading {Math.floor(item.progress * 100)}%</span>;
    case "processing":
      return (
        <span className="text-gold">
          {item.kind === "video" ? "Making it load fast and picking a thumbnail…" : "Making thumbnails…"}
        </span>
      );
    case "done":
      return (
        <span className="inline-flex items-center gap-1.5 text-[#9be4b8]">
          <FiCheckCircle aria-hidden /> Live on{" "}
          <Link href={`/c/${item.creatorSlug}`} className="underline underline-offset-2">
            {item.creatorName}’s page
          </Link>
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1.5 text-[#ffb3cb]">
          <FiAlertCircle aria-hidden /> {item.error}
        </span>
      );
  }
}

export default function UploadPanel({ creators, storageReady }) {
  const router = useRouter();
  const [creatorId, setCreatorId] = useState("");
  const [items, setItems] = useState([]);
  const [dragging, setDragging] = useState(false);
  const [notice, setNotice] = useState("");
  const inputRef = useRef(null);
  const queueRef = useRef([]);
  const runningRef = useRef(false);

  const update = useCallback((key, patch) => {
    setItems((list) => list.map((it) => (it.key === key ? { ...it, ...patch } : it)));
  }, []);

  const busy = items.some((it) => ["waiting", "uploading"].includes(it.status));
  useEffect(() => {
    if (!busy) return;
    const warn = (e) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [busy]);

  async function uploadOne(item) {
    const { file } = item;
    update(item.key, { status: "uploading", progress: 0 });
    const { id, chunkSize } = await postJson("/api/admin/uploads", {
      creatorId: item.creatorId,
      fileName: file.name,
      size: file.size,
      type: file.type,
    });

    let offset = 0;
    let failures = 0;
    while (offset < file.size) {
      const piece = file.slice(offset, offset + chunkSize);
      try {
        const res = await sendChunk(id, offset, piece, (loaded) =>
          update(item.key, { progress: Math.min(1, (offset + loaded) / file.size) }),
        );
        offset = res.received;
        failures = 0;
        update(item.key, { progress: offset / file.size });
      } catch (err) {
        if (err.fatal || ++failures > MAX_RETRIES) throw err;
        await wait(1000 * 2 ** failures);
      }
    }

    await postJson(`/api/admin/uploads/${id}/complete`);
    update(item.key, { status: "processing" });

    for (;;) {
      await wait(2500);
      const res = await fetch(`/api/admin/uploads/${id}`);
      const data = await res.json().catch(() => ({}));
      if (data.status === "done") {
        update(item.key, { status: "done", creatorSlug: data.creatorSlug });
        router.refresh();
        return;
      }
      if (data.status === "failed" || !res.ok) {
        throw new Error(data.error || "Processing failed.");
      }
    }
  }

  async function run() {
    if (runningRef.current) return;
    runningRef.current = true;
    while (queueRef.current.length) {
      const item = queueRef.current.shift();
      try {
        await uploadOne(item);
      } catch (err) {
        update(item.key, { status: "failed", error: err.message });
      }
    }
    runningRef.current = false;
  }

  function addFiles(fileList) {
    setNotice("");
    const creator = creators.find((c) => String(c.id) === creatorId);
    if (!creator) {
      setNotice("Choose which creator these files are for first.");
      return;
    }
    const accepted = [];
    let skipped = 0;
    for (const file of fileList) {
      const kind = file.type.startsWith("video/") || /\.(mp4|mov|m4v|mkv|webm|avi)$/i.test(file.name)
        ? "video"
        : file.type.startsWith("image/") || /\.(jpe?g|png|webp|gif|heic|heif)$/i.test(file.name)
          ? "image"
          : null;
      if (!kind) {
        skipped++;
        continue;
      }
      accepted.push({
        key: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        file,
        kind,
        creatorId: creator.id,
        creatorName: creator.name,
        status: "waiting",
        progress: 0,
        error: null,
      });
    }
    if (skipped) setNotice(`Skipped ${skipped} file${skipped === 1 ? "" : "s"} that ${skipped === 1 ? "isn't a video or photo" : "aren't videos or photos"}.`);
    if (!accepted.length) return;
    setItems((list) => [...accepted, ...list]);
    queueRef.current.push(...accepted);
    run();
  }

  if (!storageReady) {
    return (
      <p className="rounded-2xl border border-dashed border-line px-5 py-8 text-muted">
        Uploads are off until R2 storage is connected. Add the R2 environment variables (see the README) and restart
        the site.
      </p>
    );
  }

  if (!creators.length) {
    return (
      <p className="rounded-2xl border border-dashed border-line px-5 py-8 text-muted">
        Create a creator below first. Uploads are always added to a creator’s profile.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <label className="block max-w-sm">
        <span className="mb-1.5 block text-sm font-semibold">1. Choose the creator</span>
        <select
          value={creatorId}
          onChange={(e) => {
            setCreatorId(e.target.value);
            setNotice("");
          }}
          className="h-11 w-full rounded-xl border border-line bg-ink px-3 text-fg focus:border-gold/60 focus:outline-none"
        >
          <option value="">Select a creator…</option>
          {creators.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} {c.tier === "vip" ? "(VIP)" : "(Free)"}
            </option>
          ))}
        </select>
      </label>

      <div>
        <span className="mb-1.5 block text-sm font-semibold">2. Drop videos and photos</span>
        <button
          type="button"
          onClick={() => (creatorId ? inputRef.current?.click() : setNotice("Choose which creator these files are for first."))}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            addFiles(e.dataTransfer.files);
          }}
          className={`flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-6 py-12 text-center transition-colors ${
            dragging ? "border-gold bg-gold/10" : "border-line bg-ink/40 hover:border-muted"
          } ${creatorId ? "" : "opacity-70"}`}
        >
          <FiUploadCloud aria-hidden className="size-9 text-gold" />
          <span className="text-lg font-bold">Drop files here or click to choose</span>
          <span className="text-sm text-muted">
            Videos and photos, several at once. Videos get a thumbnail from 15 seconds in.
          </span>
        </button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="video/*,image/*,.mov,.mkv,.heic"
          className="hidden"
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {notice && (
        <p role="status" className="text-sm text-gold">
          {notice}
        </p>
      )}

      {items.length > 0 && (
        <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line">
          {items.map((item) => (
            <li key={item.key} className="relative px-4 py-3">
              {item.status === "uploading" && (
                <span
                  aria-hidden
                  className="absolute inset-y-0 left-0 bg-gold/10 transition-[width]"
                  style={{ width: `${item.progress * 100}%` }}
                />
              )}
              <div className="relative flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                {item.kind === "video" ? <FiFilm aria-hidden className="text-muted" /> : <FiImage aria-hidden className="text-muted" />}
                <span className="min-w-0 max-w-[16rem] truncate font-semibold">{item.file.name}</span>
                <span className="text-muted">
                  {formatBytes(item.file.size)} for {item.creatorName}
                </span>
                <span className="ml-auto">
                  <StatusLine item={item} />
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
