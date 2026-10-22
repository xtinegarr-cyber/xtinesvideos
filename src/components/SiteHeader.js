import Link from "next/link";
import { FaDiscord, FaTelegram } from "react-icons/fa6";
import { FiLogOut, FiSearch, FiUser } from "react-icons/fi";
import { logout } from "@/app/actions";
import { DISCORD_URL, SITE_NAME, TELEGRAM_URL } from "@/lib/site";

function SearchForm({ search, className = "" }) {
  return (
    <form action="/" role="search" className={className}>
      <label className="relative block">
        <span className="sr-only">Search creators</span>
        <FiSearch aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input
          type="search"
          name="q"
          defaultValue={search}
          placeholder="Search creators"
          autoComplete="off"
          className="h-10 w-full rounded-full border border-line bg-panel pl-9 pr-4 text-sm text-fg placeholder:text-muted focus:border-gold/60 focus:outline-none"
        />
      </label>
    </form>
  );
}

function SocialLink({ href, label, children }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      title={label}
      className="grid size-9 place-items-center rounded-full bg-raised text-lg text-fg/90 transition-colors hover:bg-line hover:text-fg sm:size-10"
    >
      {children}
    </a>
  );
}

function AccountControls({ viewer }) {
  if (!viewer) {
    return (
      <Link
        href="/login"
        className="inline-flex h-9 shrink-0 items-center rounded-full bg-fg px-4 text-sm font-semibold text-ink transition-colors hover:bg-white sm:h-10 sm:px-5"
      >
        Log in
      </Link>
    );
  }
  return (
    <div className="flex shrink-0 items-center gap-1">
      <Link
        href={viewer.isAdmin ? "/admin" : "/account"}
        aria-label={viewer.isAdmin ? "Admin panel" : "Your account"}
        className="grid size-9 place-items-center rounded-full border border-line text-sm font-semibold hover:border-muted sm:inline-flex sm:h-10 sm:w-auto sm:max-w-40 sm:px-4"
      >
        <FiUser aria-hidden className="sm:hidden" />
        <span className="hidden truncate sm:inline">{viewer.isAdmin ? "Admin panel" : viewer.username}</span>
      </Link>
      <form action={logout}>
        <button
          type="submit"
          aria-label="Log out"
          title="Log out"
          className="grid size-9 place-items-center rounded-full text-muted hover:bg-raised hover:text-fg sm:size-10"
        >
          <FiLogOut aria-hidden />
        </button>
      </form>
    </div>
  );
}

export default function SiteHeader({ viewer, search = "" }) {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-ink/90 backdrop-blur-md">
      <div className="mx-auto grid max-w-7xl grid-cols-[1fr_auto_1fr] items-center gap-2 px-4 sm:gap-3 py-3 sm:px-6">
        <div className="flex items-center gap-1.5 sm:gap-2">
          <SocialLink href={DISCORD_URL} label="Join our Discord">
            <FaDiscord aria-hidden />
          </SocialLink>
          <SocialLink href={TELEGRAM_URL} label="Join our Telegram">
            <FaTelegram aria-hidden />
          </SocialLink>
        </div>

        <Link href="/" className="rounded-md px-1 text-center leading-none">
          <span className="block whitespace-nowrap text-lg font-extrabold tracking-[-0.03em] min-[400px]:text-xl sm:text-3xl lg:text-4xl">
            {SITE_NAME}
          </span>
        </Link>

        <div className="flex items-center justify-end gap-2">
          <SearchForm search={search} className="hidden w-56 md:block lg:w-64" />
          <AccountControls viewer={viewer} />
        </div>
      </div>
      <SearchForm search={search} className="px-4 pb-3 md:hidden" />
    </header>
  );
}
