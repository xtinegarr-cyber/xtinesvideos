import { initials } from "@/lib/format";

function hueFor(name) {
  let hash = 0;
  for (const ch of String(name)) hash = (hash * 31 + ch.codePointAt(0)) >>> 0;
  return hash % 360;
}

/**
 * A creator's picture, or a colored placeholder with their initials when
 * none has been uploaded yet. `locked` placeholders are blurred to match
 * the blurred VIP photos.
 */
export default function CreatorImage({ name, src, locked = false, className = "" }) {
  if (src) {
    return (
      // Plain <img>: pictures come from signed R2 links, not next/image.
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt="" loading="lazy" decoding="async" className={`h-full w-full object-cover ${className}`} />
    );
  }
  const hue = hueFor(name);
  return (
    <div
      aria-hidden
      className={`grid h-full w-full place-items-center ${className}`}
      style={{
        background: `radial-gradient(120% 90% at 30% 20%, hsl(${hue} 55% 42%), hsl(${(hue + 40) % 360} 45% 18%) 70%)`,
      }}
    >
      <span className={`text-5xl font-extrabold tracking-tight text-white/85 ${locked ? "blur-md" : ""}`}>
        {initials(name)}
      </span>
    </div>
  );
}
