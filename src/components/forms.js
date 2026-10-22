// Shared form pieces so every form on the site looks and behaves the same.

export function Field({ label, hint, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-fg">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

export const inputClass =
  "h-11 w-full rounded-xl border border-line bg-ink px-3.5 text-fg placeholder:text-muted/70 focus:border-gold/60 focus:outline-none";

export function FormError({ message }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-xl border border-rose/40 bg-rose/10 px-3.5 py-2.5 text-sm text-[#ffb3cb]">
      {message}
    </p>
  );
}

export function FormNotice({ message }) {
  if (!message) return null;
  return (
    <p role="status" className="rounded-xl border border-gold/30 bg-gold/10 px-3.5 py-2.5 text-sm text-gold">
      {message}
    </p>
  );
}

export const primaryButton =
  "inline-flex h-11 items-center justify-center rounded-full bg-fg px-6 text-sm font-bold text-ink transition-colors hover:bg-white disabled:cursor-wait disabled:opacity-60";

// Styles live in globals.css (.btn-vip) so every VIP button matches.
export const goldButton = "btn-vip h-12 px-6";

export const quietButton =
  "inline-flex h-10 items-center justify-center rounded-full border border-line px-4 text-sm font-semibold text-fg hover:border-muted disabled:opacity-60";
