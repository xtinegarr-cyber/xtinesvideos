"use client";

import { useEffect, useRef } from "react";

const SNOW = "242, 228, 202"; // warm beige

/**
 * The navy night sky with slow beige snowfall behind every page.
 * Near flakes are bigger, brighter and fall faster; a few get a soft glow
 * like out-of-focus lights. It pauses when the tab is hidden and stays
 * still for people who turn off animations.
 */
export default function SiteBackdrop() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx) return;

    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let width = 0;
    let height = 0;
    let flakes = [];
    let frame = 0;
    let last = performance.now();

    function makeFlake(anywhere) {
      const depth = Math.random() ** 1.6; // mostly small, distant flakes
      return {
        x: Math.random() * width,
        y: anywhere ? Math.random() * height : -8,
        r: 0.6 + depth * 1.9,
        speed: 8 + depth * 26,
        drift: (Math.random() - 0.5) * 10,
        phase: Math.random() * Math.PI * 2,
        sway: 0.3 + Math.random() * 0.7,
        alpha: 0.24 + depth * 0.62,
        glow: depth > 0.72,
      };
    }

    function resize() {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      const count = Math.round(Math.min(170, Math.max(50, (width * height) / 9500)));
      while (flakes.length < count) flakes.push(makeFlake(true));
      flakes.length = count;
    }

    // One soft, round flake drawn once and reused, so every flake has the
    // blurry edge of falling snow instead of a hard dot.
    const sprite = document.createElement("canvas");
    sprite.width = sprite.height = 64;
    const sctx = sprite.getContext("2d");
    const gradient = sctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, `rgba(${SNOW}, 1)`);
    gradient.addColorStop(0.3, `rgba(${SNOW}, 0.85)`);
    gradient.addColorStop(0.6, `rgba(${SNOW}, 0.25)`);
    gradient.addColorStop(1, `rgba(${SNOW}, 0)`);
    sctx.fillStyle = gradient;
    sctx.fillRect(0, 0, 64, 64);

    function paint() {
      ctx.clearRect(0, 0, width, height);
      for (const f of flakes) {
        // Near flakes are drawn larger and fainter, like out-of-focus snow.
        const size = f.glow ? f.r * 9 : f.r * 4;
        ctx.globalAlpha = f.glow ? f.alpha * 0.55 : f.alpha;
        ctx.drawImage(sprite, f.x - size / 2, f.y - size / 2, size, size);
      }
      ctx.globalAlpha = 1;
    }

    function tick(now) {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      for (const f of flakes) {
        f.phase += f.sway * dt;
        f.y += f.speed * dt;
        f.x += (Math.sin(f.phase) * 7 + f.drift) * dt;
        if (f.y > height + 8) Object.assign(f, makeFlake(false));
        if (f.x < -8) f.x = width + 8;
        else if (f.x > width + 8) f.x = -8;
      }
      paint();
      frame = requestAnimationFrame(tick);
    }

    function start() {
      cancelAnimationFrame(frame);
      if (still || document.hidden) return paint();
      last = performance.now();
      frame = requestAnimationFrame(tick);
    }

    resize();
    start();
    const onResize = () => {
      resize();
      if (still) paint();
    };
    window.addEventListener("resize", onResize);
    document.addEventListener("visibilitychange", start);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", start);
    };
  }, []);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
      <div className="night-sky absolute inset-0" />
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
    </div>
  );
}
