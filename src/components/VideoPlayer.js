"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  FiMaximize,
  FiMinimize,
  FiPause,
  FiPlay,
  FiRotateCcw,
  FiRotateCw,
  FiVolume2,
  FiVolumeX,
} from "react-icons/fi";
import { formatDuration } from "@/lib/format";

const HIDE_AFTER_MS = 2500;
const SPEEDS = [1, 1.25, 1.5, 2, 0.75];
const VOLUME_KEY = "xv_volume";

function clock(seconds) {
  return Number.isFinite(seconds) && seconds > 0 ? formatDuration(seconds) : "0:00";
}

function Button({ label, onClick, children, className = "" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`grid size-10 shrink-0 place-items-center rounded-full text-white/90 transition-colors hover:bg-white/10 hover:text-white ${className}`}
    >
      {children}
    </button>
  );
}

/**
 * The site's video player: gold progress bar, big play button, controls
 * that fade out while watching, keyboard shortcuts (space, arrows, F, M).
 */
export default function VideoPlayer({ src, poster, label = "Video", width, height }) {
  const wrap = useRef(null);
  const video = useRef(null);
  const hideTimer = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [started, setStarted] = useState(false);
  const [ended, setEnded] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [fullscreen, setFullscreen] = useState(false);
  const [controls, setControls] = useState(true);

  // Controls show on any movement and fade after a moment of watching.
  const poke = useCallback(() => {
    setControls(true);
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      if (video.current && !video.current.paused) setControls(false);
    }, HIDE_AFTER_MS);
  }, []);

  useEffect(() => {
    try {
      const saved = Number(localStorage.getItem(VOLUME_KEY));
      if (saved > 0 && saved <= 1 && video.current) video.current.volume = saved;
    } catch {
      // Storage blocked: keep full volume.
    }
    const onFullscreen = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFullscreen);
    return () => {
      document.removeEventListener("fullscreenchange", onFullscreen);
      clearTimeout(hideTimer.current);
    };
  }, []);

  const toggle = useCallback(() => {
    const v = video.current;
    if (!v) return;
    if (v.paused || v.ended) v.play().catch(() => {});
    else v.pause();
    // Keep keyboard shortcuts working after a click.
    wrap.current?.focus({ preventScroll: true });
    poke();
  }, [poke]);

  const seekBy = useCallback(
    (seconds) => {
      const v = video.current;
      if (!v) return;
      v.currentTime = Math.min(Math.max(0, v.currentTime + seconds), v.duration || 0);
      poke();
    },
    [poke],
  );

  const setVol = useCallback((value) => {
    const v = video.current;
    if (!v) return;
    v.volume = Math.min(1, Math.max(0, value));
    v.muted = v.volume === 0;
  }, []);

  const toggleFullscreen = useCallback(() => {
    const v = video.current;
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else if (wrap.current?.requestFullscreen) wrap.current.requestFullscreen().catch(() => {});
    // iPhone Safari only lets the video itself go full screen.
    else if (v?.webkitEnterFullscreen) v.webkitEnterFullscreen();
  }, []);

  function onKey(e) {
    if (e.target instanceof HTMLInputElement) return; // sliders handle their own keys
    const key = e.key.toLowerCase();
    if (key === " " || key === "k") toggle();
    else if (key === "arrowleft" || key === "j") seekBy(key === "j" ? -10 : -5);
    else if (key === "arrowright" || key === "l") seekBy(key === "l" ? 10 : 5);
    else if (key === "arrowup") setVol((video.current?.volume ?? 1) + 0.1);
    else if (key === "arrowdown") setVol((video.current?.volume ?? 1) - 0.1);
    else if (key === "f") toggleFullscreen();
    else if (key === "m" && video.current) video.current.muted = !video.current.muted;
    else return;
    e.preventDefault();
    poke();
  }

  const played = duration ? (time / duration) * 100 : 0;
  const loaded = duration ? (buffered / duration) * 100 : 0;
  const showControls = controls || !playing;
  const volumeShown = muted ? 0 : volume;
  // The player has its real shape from the first paint (not only once the
  // video starts loading), so the page doesn't jump and Google can measure
  // the video's size and position.
  const shape = width > 0 && height > 0 ? { aspectRatio: `${width} / ${height}` } : undefined;

  return (
    <div
      ref={wrap}
      tabIndex={0}
      role="region"
      aria-label={label}
      onKeyDown={onKey}
      onMouseMove={poke}
      onTouchStart={poke}
      className={`xv-player group relative grid w-full place-items-center overflow-hidden bg-black outline-none ${
        fullscreen ? "h-full" : "rounded-2xl ring-1 ring-line focus-visible:ring-gold/60"
      } ${showControls ? "" : "cursor-none"}`}
    >
      <video
        ref={video}
        src={src}
        poster={poster}
        playsInline
        preload="metadata"
        onClick={toggle}
        onPlay={() => {
          setPlaying(true);
          setStarted(true);
          setEnded(false);
          poke();
        }}
        onPause={() => {
          setPlaying(false);
          setControls(true);
        }}
        onEnded={() => {
          setPlaying(false);
          setEnded(true);
          setControls(true);
        }}
        onWaiting={() => setWaiting(true)}
        onPlaying={() => setWaiting(false)}
        onCanPlay={() => setWaiting(false)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
        onDurationChange={(e) => setDuration(e.currentTarget.duration || 0)}
        onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
        onProgress={(e) => {
          const b = e.currentTarget.buffered;
          if (b.length) setBuffered(b.end(b.length - 1));
        }}
        onVolumeChange={(e) => {
          setVolume(e.currentTarget.volume);
          setMuted(e.currentTarget.muted);
          try {
            if (e.currentTarget.volume > 0) localStorage.setItem(VOLUME_KEY, String(e.currentTarget.volume));
          } catch {
            // Storage blocked: volume just isn't remembered.
          }
        }}
        onRateChange={(e) => setSpeed(e.currentTarget.playbackRate)}
        width={width || undefined}
        height={height || undefined}
        style={fullscreen ? undefined : shape}
        className={`block w-full bg-black object-contain ${fullscreen ? "h-full" : "h-auto max-h-[75dvh]"}`}
      />

      {/* Big play / replay button while stopped */}
      {!playing && !waiting && (
        <button
          type="button"
          onClick={toggle}
          aria-label={ended ? "Play again" : "Play"}
          className="absolute z-10 grid size-20 place-items-center rounded-full bg-gold text-ink shadow-[0_18px_50px_-10px_rgba(231,203,152,0.55)] transition-transform hover:scale-105 active:scale-95"
        >
          {ended ? <FiRotateCcw aria-hidden className="size-8" /> : <FiPlay aria-hidden className="ml-1 size-9" />}
        </button>
      )}

      {/* Buffering */}
      {waiting && (
        <span
          aria-label="Loading"
          role="status"
          className="pointer-events-none absolute size-14 animate-spin rounded-full border-4 border-white/20 border-t-gold"
        />
      )}

      {/* Control bar */}
      <div
        className={`pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent px-3 pb-1.5 pt-8 transition-opacity sm:pb-2 sm:pt-12 duration-300 sm:px-4 ${
          showControls && started ? "opacity-100 [&>*]:pointer-events-auto" : "opacity-0"
        }`}
      >
        <input
          type="range"
          aria-label="Seek"
          min={0}
          max={duration || 0}
          step="any"
          value={Math.min(time, duration || 0)}
          onChange={(e) => {
            if (video.current) video.current.currentTime = Number(e.target.value);
            setTime(Number(e.target.value));
            poke();
          }}
          aria-valuetext={`${clock(time)} of ${clock(duration)}`}
          className="xv-range"
          style={{ "--fill": `${played}%`, "--buffer": `${Math.max(played, loaded)}%` }}
        />
        <div className="mt-1 flex items-center gap-0.5 text-white">
          <Button label={playing ? "Pause" : "Play"} onClick={toggle}>
            {playing ? <FiPause aria-hidden className="size-5" /> : <FiPlay aria-hidden className="ml-0.5 size-5" />}
          </Button>
          <Button label="Back 10 seconds" onClick={() => seekBy(-10)} className="hidden sm:grid">
            <FiRotateCcw aria-hidden className="size-[18px]" />
          </Button>
          <Button label="Forward 10 seconds" onClick={() => seekBy(10)} className="hidden sm:grid">
            <FiRotateCw aria-hidden className="size-[18px]" />
          </Button>
          <Button
            label={muted || volume === 0 ? "Unmute" : "Mute"}
            onClick={() => {
              const v = video.current;
              if (!v) return;
              if (v.muted || v.volume === 0) {
                v.muted = false;
                if (v.volume === 0) v.volume = 0.6;
              } else v.muted = true;
            }}
          >
            {muted || volume === 0 ? <FiVolumeX aria-hidden className="size-5" /> : <FiVolume2 aria-hidden className="size-5" />}
          </Button>
          <input
            type="range"
            aria-label="Volume"
            min={0}
            max={1}
            step={0.05}
            value={volumeShown}
            onChange={(e) => setVol(Number(e.target.value))}
            className="xv-range xv-range-small hidden w-20 sm:block"
            style={{ "--fill": `${volumeShown * 100}%`, "--buffer": `${volumeShown * 100}%` }}
          />
          <span className="ml-2 whitespace-nowrap text-xs font-semibold tabular-nums text-white/85 sm:text-sm">
            {clock(time)} <span className="text-white/45">/ {clock(duration)}</span>
          </span>
          <div className="ml-auto flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => {
                const next = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length];
                if (video.current) video.current.playbackRate = next;
              }}
              aria-label={`Playback speed ${speed}x`}
              title="Playback speed"
              className="h-8 min-w-11 rounded-full px-2 text-xs font-bold text-white/90 hover:bg-white/10"
            >
              {speed}×
            </button>
            <Button label={fullscreen ? "Exit full screen" : "Full screen"} onClick={toggleFullscreen}>
              {fullscreen ? <FiMinimize aria-hidden className="size-5" /> : <FiMaximize aria-hidden className="size-5" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
