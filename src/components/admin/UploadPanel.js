"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FiAlertCircle, FiCheckCircle, FiFilm, FiImage, FiRotateCw, FiUploadCloud, FiX } from "react-icons/fi";
import { formatBytes } from "@/lib/format";
import { quietButton } from "@/components/forms";

// A batch can be left running: files go up one at a time, each one is
// handed to the server's processing line as soon as it has arrived, and
// connection drops, server restarts and a full disk are waited out instead
// of failing the batch.

const MAX_RESTARTS = 3; // times one file is sent again after the server lost it
const MAX_FAILURES = 40; // connection errors in a row (about 18 minutes) before giving up
const POLL_MS = 4000;
const STALE_MS = 2 * 60 * 1000;

const VIDEO = /\.(mp4|mov|m4v|mkv|webm|avi|wmv|flv|3gp|mpe?g|ts|mts)$/i;
const IMAGE = /\.(jpe?g|png|webp|gif|avif|heic|heif|bmp|tiff?)$/i;

function kindOf(name, type = "") {
  if (type.startsWith("video/") || VIDEO.test(name)) return "video";
  if (type.startsWith("image/") || IMAGE.test(name)) return "image";
  return null;
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const waitUntilOnline = () =>
  new Promise((resolve) => {
    const done = () => {
      window.removeEventListener("online", done);
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(done, 60_000);
    window.addEventListener("online", done);
  });

function problem(message, flags = {}) {
  return Object.assign(new Error(message), flags);
}

/** Sorts a failed request into: wait and retry, start over, or give up. */
function problemFrom(status, data) {
  // Our API always answers with { error }. Anything else (a gateway page
  // while the site redeploys, an empty reply) means try again shortly.
  if (!data || typeof data.error !== "string") return problem(`The server didn't answer (${status || "no connection"}).`, { retry: true });
  if (data.gone) return problem(data.error, { gone: true });
  if (status === 507 || data.full) return problem(data.error, { full: true });
  if (status >= 500 || status === 408 || status === 429) return problem(data.error, { retry: true });
  return problem(data.error);
}

async function request(method, url, body) {
  let res;
  try {
    res = await fetch(url, {
      method,
      cache: "no-store",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw problem("Connection lost.", { retry: true });
  }
  const data = await res.json().catch(() => null);
  if (res.ok) return data ?? {};
  throw problemFrom(res.status, data);
}

function putChunk(row, id, offset, blob, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    row.abort = () => xhr.abort();
    xhr.open("PUT", `/api/admin/uploads/${id}?offset=${offset}`);
    xhr.setRequestHeader("Content-Type", "application/octet-stream");
    xhr.timeout = 15 * 60 * 1000;
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded);
    xhr.onload = () => {
      let data = null;
      try {
        data = JSON.parse(xhr.responseText);
      } catch {}
      if (xhr.status === 200) resolve(data);
      // Out of sync (a retry after a piece did arrive): carry on from
      // whatever the server actually has.
      else if (xhr.status === 409 && typeof data?.received === "number") resolve(data);
      else reject(problemFrom(xhr.status, data));
    };
    xhr.onerror = () => reject(problem("Connection lost.", { retry: true }));
    xhr.ontimeout = () => reject(problem("The connection stalled.", { retry: true }));
    xhr.onabort = () => reject(problem("Canceled.", { cancelled: true }));
    xhr.send(blob);
  }).finally(() => {
    row.abort = null;
  });
}

const isActive = (r) => r.status === "waiting" || r.status === "uploading";
const isOnServer = (r) => r.status === "queued" || r.status === "processing" || r.status === "elsewhere";
const isFinished = (r) => r.status === "done" || r.status === "failed" || r.status === "interrupted";

/** A row for an upload this page didn't start (after a reload, or another device). */
function serverRow(u) {
  const row = {
    key: `s:${u.id}`,
    file: null,
    serverId: u.id,
    name: u.fileName,
    size: u.size,
    kind: kindOf(u.fileName) ?? "video",
    creatorName: u.creatorName,
    creatorSlug: u.creatorSlug,
    progress: u.size ? u.received / u.size : 0,
    restarts: 0,
  };
  return Object.assign(row, statusFromServer(u));
}

function statusFromServer(u) {
  switch (u.status) {
    case "uploading":
      return Date.now() - Date.parse(u.updatedAt) < STALE_MS
        ? { status: "elsewhere", progress: u.size ? u.received / u.size : 0 }
        : { status: "interrupted" };
    case "done":
      return { status: "done", creatorSlug: u.creatorSlug, mediaId: u.mediaId ?? null, note: null };
    case "failed":
      return { status: "failed", error: u.error || "Processing failed.", note: null };
    default:
      return { status: u.status, position: u.position, note: null };
  }
}

function StatusLine({ row }) {
  const pct = Math.floor((row.progress || 0) * 100);
  if (row.note && (row.status === "uploading" || row.status === "waiting")) {
    return <span className="text-gold">{row.note}</span>;
  }
  switch (row.status) {
    case "waiting":
      return <span className="text-muted">Waiting to upload</span>;
    case "uploading":
      return <span className="text-fg">Uploading {pct}%</span>;
    case "elsewhere":
      return <span className="text-muted">Being uploaded from another window, {pct}%</span>;
    case "queued":
      return (
        <span className="text-gold/80">
          {row.position > 1 ? `Sent. #${row.position} in line for processing` : row.position === 1 ? "Sent. Processing next" : "Sent. Waiting to be processed"}
        </span>
      );
    case "processing":
      return (
        <span className="text-gold">
          {row.kind === "video" ? "Making it load fast and picking a thumbnail…" : "Making thumbnails…"}
        </span>
      );
    case "done":
      return (
        <span className="inline-flex items-center gap-1.5 text-[#9be4b8]">
          <FiCheckCircle aria-hidden /> Live on{" "}
          {row.creatorSlug ? (
            <Link href={`/${row.creatorSlug}`} className="underline underline-offset-2">
              {row.creatorName}’s page
            </Link>
          ) : (
            `${row.creatorName}’s page`
          )}
          {row.creatorSlug && row.mediaId && (
            <>
              {" · "}
              <Link href={`/${row.creatorSlug}/${row.mediaId}`} className="underline underline-offset-2">
                Edit title
              </Link>
            </>
          )}
        </span>
      );
    case "interrupted":
      return (
        <span className="inline-flex items-center gap-1.5 text-[#ffb3cb]">
          <FiAlertCircle aria-hidden /> Interrupted when the page closed. Add this file again.
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1.5 text-[#ffb3cb]">
          <FiAlertCircle aria-hidden /> {row.error}
        </span>
      );
  }
}

function Summary({ rows, onRetryFailed, onClearFinished, wakeLock }) {
  const count = (fn) => rows.filter(fn).length;
  const done = count((r) => r.status === "done");
  const failed = count((r) => r.status === "failed" || r.status === "interrupted");
  const retryable = count((r) => r.status === "failed" && r.file);
  const sending = count(isActive);
  const processing = count(isOnServer);
  const finished = count(isFinished);

  let total = 0;
  let sent = 0;
  for (const r of rows) {
    if (r.status === "failed" || r.status === "interrupted" || !r.size) continue;
    total += r.size;
    sent += r.status === "waiting" ? 0 : r.status === "uploading" || r.status === "elsewhere" ? (r.progress || 0) * r.size : r.size;
  }

  const parts = [];
  if (sending) parts.push(`${sending} to send`);
  if (processing) parts.push(`${processing} processing`);
  if (failed) parts.push(`${failed} failed`);

  let message;
  if (sending) {
    message = `Keep this tab open while files are sending${wakeLock ? " (your screen stays on until they’re sent)" : ""}. You can pick another creator and add more files any time.`;
  } else if (processing) {
    message = "Everything’s sent. The server finishes processing on its own, so you can close this tab.";
  } else if (failed) {
    message = "Finished, but some files didn’t make it.";
  } else {
    message = "All done.";
  }

  return (
    <div className="space-y-3 rounded-2xl border border-line bg-ink/40 p-4">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <p className="text-base font-bold">
          {done} of {rows.length} live
        </p>
        {parts.length > 0 && <p className="text-sm text-muted">{parts.join(" · ")}</p>}
        {total > 0 && (
          <p className="text-sm text-muted sm:ml-auto">
            {formatBytes(sent)} of {formatBytes(total)} sent
          </p>
        )}
      </div>
      {total > 0 && (
        <div aria-hidden className="h-1.5 overflow-hidden rounded-full bg-line">
          <div className="h-full rounded-full bg-gold transition-[width]" style={{ width: `${Math.min(100, (sent / total) * 100)}%` }} />
        </div>
      )}
      <p role="status" className="text-sm text-muted">
        {message}
      </p>
      {(retryable > 0 || finished > 0) && (
        <div className="flex flex-wrap gap-2">
          {retryable > 0 && (
            <button type="button" onClick={onRetryFailed} className={quietButton}>
              <FiRotateCw aria-hidden className="mr-1.5" /> Retry failed ({retryable})
            </button>
          )}
          {finished > 0 && (
            <button type="button" onClick={onClearFinished} className={quietButton}>
              Clear finished ({finished})
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function UploadPanel({ creators, storageReady }) {
  const router = useRouter();
  const [creatorId, setCreatorId] = useState("");
  const [dragging, setDragging] = useState(false);
  const [notice, setNotice] = useState("");
  const [wakeLock, setWakeLock] = useState(false);
  const [, setTick] = useState(0);
  const inputRef = useRef(null);

  // Rows are plain objects updated in place by the upload loop; `render`
  // tells React to redraw. This keeps long-running loops free of stale state.
  const rowsRef = useRef([]);
  const runningRef = useRef(false);
  const pollingRef = useRef(false);
  const renderTimer = useRef(null);
  const lastRefresh = useRef(0);
  const refreshTimer = useRef(null);
  const baseTitle = useRef("");
  const hadWork = useRef(false);

  const rows = rowsRef.current;
  const render = () => setTick((t) => t + 1);
  const renderSoon = () => {
    renderTimer.current ??= setTimeout(() => {
      renderTimer.current = null;
      render();
    }, 200);
  };
  const patch = (row, values) => {
    Object.assign(row, values);
    render();
  };

  // Show new uploads on the creator pages and stats, at most every 8 seconds.
  const refreshPage = () => {
    const due = lastRefresh.current + 8000 - Date.now();
    if (due <= 0) {
      lastRefresh.current = Date.now();
      router.refresh();
    } else {
      refreshTimer.current ??= setTimeout(() => {
        refreshTimer.current = null;
        lastRefresh.current = Date.now();
        router.refresh();
      }, due);
    }
  };

  /** Runs `step`, waiting out connection drops and a full server disk. */
  async function patiently(row, step) {
    let failures = 0;
    let fullWaits = 0;
    for (;;) {
      if (row.cancelled) throw problem("Canceled.", { cancelled: true });
      try {
        const result = await step();
        if (row.note) patch(row, { note: null });
        return result;
      } catch (err) {
        if (err.cancelled || row.cancelled) throw problem("Canceled.", { cancelled: true });
        if (err.full) {
          if (++fullWaits > 240) throw err; // two hours
          patch(row, { note: "The server’s disk is full for now. This starts once earlier files finish processing." });
          await wait(30_000);
          continue;
        }
        if (!err.retry) throw err;
        if (!navigator.onLine) {
          patch(row, { note: "No internet connection. It picks up again when you’re back online." });
          await waitUntilOnline();
          continue;
        }
        if (++failures > MAX_FAILURES) throw err;
        patch(row, { note: "Connection problem. Trying again…" });
        await wait(Math.min(30_000, 1000 * 2 ** failures));
      }
    }
  }

  async function transfer(row) {
    const { id, chunkSize } = await patiently(row, () =>
      request("POST", "/api/admin/uploads", {
        creatorId: row.creatorId,
        fileName: row.file.name,
        size: row.file.size,
        type: row.file.type,
      }),
    );
    row.serverId = id;
    let offset = 0;
    while (offset < row.size) {
      const start = offset;
      const piece = row.file.slice(start, start + chunkSize);
      const res = await patiently(row, () =>
        putChunk(row, id, start, piece, (loaded) => {
          row.progress = Math.min(1, (start + loaded) / row.size);
          renderSoon();
        }),
      );
      offset = res.received;
      patch(row, { progress: offset / row.size });
    }
    await patiently(row, () => request("POST", `/api/admin/uploads/${id}/complete`));
    patch(row, { status: "queued", position: null, progress: 1, note: null, sentAt: Date.now() });
  }

  async function send(row) {
    patch(row, { status: "uploading", progress: 0, error: null, note: null });
    try {
      for (;;) {
        try {
          await transfer(row);
          return;
        } catch (err) {
          if (!err.gone || row.restarts >= MAX_RESTARTS) throw err;
          row.restarts += 1;
          patch(row, { serverId: null, progress: 0, note: "The server restarted, so this file is starting over." });
        }
      }
    } catch (err) {
      if (err.cancelled || row.cancelled) {
        // Canceled after the server had already started taking the file.
        if (row.serverId) request("DELETE", `/api/admin/uploads/${row.serverId}`).catch(() => {});
        return;
      }
      patch(row, { status: "failed", error: err.message, note: null });
    }
  }

  async function pump() {
    if (runningRef.current) return;
    runningRef.current = true;
    try {
      for (;;) {
        const next = rowsRef.current.find((r) => r.status === "waiting" && r.file);
        if (!next) break;
        await send(next);
      }
    } finally {
      runningRef.current = false;
    }
  }

  /**
   * Asks about one upload the list didn't include. The answer is its
   * status (it may have finished just before a restart), or "gone". A
   * failed check changes nothing, so a file is never sent twice by mistake.
   */
  async function checkOne(id) {
    try {
      const res = await fetch(`/api/admin/uploads/${id}`, { cache: "no-store" });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.status) return data;
      return res.status === 404 && data?.gone ? data : null;
    } catch {
      return null;
    }
  }

  /** Brings rows up to date with the server's list of uploads. */
  async function merge(list, { addUnknown = false, startedAt = 0 } = {}) {
    const byId = new Map(list.map((u) => [u.id, u]));
    let finishedOne = false;
    let resend = false;
    for (const row of [...rowsRef.current]) {
      if (!row.serverId || !isOnServer(row)) continue;
      const id = row.serverId;
      let u = byId.get(id);
      if (!u) {
        // Sent after the list was read: it just isn't in it yet.
        if ((row.sentAt ?? 0) >= startedAt) continue;
        u = await checkOne(id);
        if (!u || row.serverId !== id || !isOnServer(row)) continue;
      }
      if (u.gone) {
        // The server lost it (it restarted without keeping its upload folder).
        if (row.file && row.restarts < MAX_RESTARTS) {
          row.restarts += 1;
          Object.assign(row, { status: "waiting", serverId: null, progress: 0, note: "The server restarted, so this file will be sent again." });
          resend = true;
        } else {
          Object.assign(row, { status: "failed", error: u.error || "The server lost this file. Upload it again." });
        }
        continue;
      }
      if (row.status === "elsewhere" || u.status !== "uploading") Object.assign(row, statusFromServer(u));
      if (row.status === "done") finishedOne = true;
    }
    if (addUnknown) {
      const known = new Set(rowsRef.current.map((r) => r.serverId).filter(Boolean));
      for (const u of list) if (!known.has(u.id)) rowsRef.current.push(serverRow(u));
    }
    render();
    if (finishedOne) refreshPage();
    if (resend) pump();
  }

  async function poll(options = {}) {
    if (pollingRef.current) return;
    pollingRef.current = true;
    const startedAt = Date.now();
    try {
      const res = await fetch("/api/admin/uploads", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      await merge(data.uploads ?? [], { ...options, startedAt });
    } catch {
      // Offline or redeploying: the next poll tries again.
    } finally {
      pollingRef.current = false;
    }
  }

  // Load what the server already has (e.g. after a reload), then keep
  // following anything that's processing.
  useEffect(() => {
    if (!storageReady) return;
    poll({ addUnknown: true });
    const timer = setInterval(() => {
      if (rowsRef.current.some(isOnServer)) poll();
    }, POLL_MS);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageReady]);

  const sending = rows.some(isActive);
  const working = sending || rows.some(isOnServer);

  // Leaving the page stops files that are still sending.
  useEffect(() => {
    if (!sending) return;
    const warn = (e) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [sending]);

  // Keep the screen (and so the computer) awake while files are sending.
  useEffect(() => {
    if (!sending || !("wakeLock" in navigator)) return;
    let lock = null;
    let stopped = false;
    const acquire = async () => {
      if (stopped || document.visibilityState !== "visible" || (lock && !lock.released)) return;
      try {
        lock = await navigator.wakeLock.request("screen");
        setWakeLock(true);
      } catch {
        setWakeLock(false);
      }
    };
    acquire();
    document.addEventListener("visibilitychange", acquire);
    return () => {
      stopped = true;
      document.removeEventListener("visibilitychange", acquire);
      lock?.release().catch(() => {});
      setWakeLock(false);
    };
  }, [sending]);

  // Progress in the tab's title, so it shows from other tabs.
  const doneCount = rows.filter((r) => r.status === "done").length;
  useEffect(() => {
    if (!baseTitle.current) baseTitle.current = document.title;
    if (working) hadWork.current = true;
    if (working) document.title = `(${doneCount}/${rows.length}) Uploading – ${baseTitle.current}`;
    else if (hadWork.current && rows.length && doneCount === rows.length) document.title = `✓ Uploads done – ${baseTitle.current}`;
    else document.title = baseTitle.current;
  });
  useEffect(
    () => () => {
      if (baseTitle.current) document.title = baseTitle.current;
      clearTimeout(refreshTimer.current);
      clearTimeout(renderTimer.current);
    },
    [],
  );

  function addFiles(fileList) {
    setNotice("");
    const creator = creators.find((c) => String(c.id) === creatorId);
    if (!creator) {
      setNotice("Choose which creator these files are for first.");
      return;
    }
    const added = [];
    let skipped = 0;
    let duplicates = 0;
    for (const file of fileList) {
      const kind = kindOf(file.name, file.type);
      if (!kind || !file.size) {
        skipped++;
        continue;
      }
      const already = rowsRef.current.some(
        (r) => r.file && r.creatorId === creator.id && r.name === file.name && r.size === file.size && r.status !== "failed",
      );
      if (already) {
        duplicates++;
        continue;
      }
      added.push({
        key: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        file,
        name: file.name,
        size: file.size,
        kind,
        creatorId: creator.id,
        creatorName: creator.name,
        status: "waiting",
        progress: 0,
        error: null,
        note: null,
        serverId: null,
        restarts: 0,
      });
    }
    const notes = [];
    if (added.length) notes.push(`Added ${added.length} file${added.length === 1 ? "" : "s"} for ${creator.name}.`);
    if (duplicates) notes.push(`Skipped ${duplicates} already in the list.`);
    if (skipped) notes.push(`Skipped ${skipped} that ${skipped === 1 ? "isn’t a video or photo" : "aren’t videos or photos"}.`);
    setNotice(notes.join(" "));
    if (!added.length) return;
    rowsRef.current.push(...added);
    render();
    pump();
  }

  function remove(row) {
    row.cancelled = true;
    row.abort?.();
    rowsRef.current = rowsRef.current.filter((r) => r !== row);
    if (row.serverId && !isOnServer(row)) request("DELETE", `/api/admin/uploads/${row.serverId}`).catch(() => {});
    render();
  }

  function retry(row) {
    if (row.serverId) request("DELETE", `/api/admin/uploads/${row.serverId}`).catch(() => {});
    Object.assign(row, { status: "waiting", serverId: null, error: null, note: null, progress: 0, restarts: 0, cancelled: false });
  }

  function retryFailed() {
    for (const row of rowsRef.current) if (row.status === "failed" && row.file) retry(row);
    render();
    pump();
  }

  function clearFinished() {
    for (const row of rowsRef.current) {
      if (isFinished(row) && row.serverId) request("DELETE", `/api/admin/uploads/${row.serverId}`).catch(() => {});
    }
    rowsRef.current = rowsRef.current.filter((r) => !isFinished(r));
    render();
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
            As many as you like. They upload one after another, so you can switch creators and keep adding.
          </span>
        </button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="video/*,image/*,.mov,.mkv,.heic,.heif"
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

      {rows.length > 0 && (
        <>
          <Summary rows={rows} onRetryFailed={retryFailed} onClearFinished={clearFinished} wakeLock={wakeLock} />
          <ul className="max-h-[32rem] divide-y divide-line overflow-y-auto overscroll-contain rounded-2xl border border-line">
            {rows.map((row) => (
              <li key={row.key} className="relative px-4 py-3">
                {(row.status === "uploading" || row.status === "elsewhere") && (
                  <span
                    aria-hidden
                    className="absolute inset-y-0 left-0 bg-gold/10 transition-[width]"
                    style={{ width: `${(row.progress || 0) * 100}%` }}
                  />
                )}
                <div className="relative flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                  {row.kind === "video" ? <FiFilm aria-hidden className="text-muted" /> : <FiImage aria-hidden className="text-muted" />}
                  <span className="min-w-0 max-w-[16rem] truncate font-semibold">{row.name}</span>
                  <span className="text-muted">
                    {formatBytes(row.size)} for {row.creatorName || "a creator"}
                  </span>
                  <span className="ml-auto inline-flex items-center gap-2">
                    <StatusLine row={row} />
                    {row.status === "failed" && row.file && (
                      <button
                        type="button"
                        onClick={() => {
                          retry(row);
                          render();
                          pump();
                        }}
                        className="rounded-full px-2 py-1 text-xs font-semibold text-fg underline underline-offset-2 hover:text-gold"
                      >
                        Retry
                      </button>
                    )}
                    {!isOnServer(row) && (
                      <button
                        type="button"
                        onClick={() => remove(row)}
                        aria-label={isActive(row) ? `Cancel ${row.name}` : `Remove ${row.name} from the list`}
                        title={isActive(row) ? "Cancel" : "Remove from the list"}
                        className="grid size-7 place-items-center rounded-full text-muted hover:bg-line hover:text-fg"
                      >
                        <FiX aria-hidden />
                      </button>
                    )}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
