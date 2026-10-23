import Link from "next/link";
import { FiCheckCircle, FiClock, FiGift, FiXCircle } from "react-icons/fi";
import SiteHeader from "./SiteHeader";
import RedditClaimForm, { RefreshWhilePending } from "./RedditClaimForm";
import { GetVipButton } from "./VipForms";

function minutesLeft(until) {
  return Math.max(1, Math.ceil((new Date(until).getTime() - Date.now()) / 60000));
}

function Status({ pass, claim }) {
  if (pass) {
    return (
      <div className="rounded-2xl border border-[#9be4b8]/30 bg-[#9be4b8]/[0.07] p-5">
        <p className="flex items-center gap-2 font-bold text-[#9be4b8]">
          <FiCheckCircle aria-hidden /> Your free VIP is on: about {minutesLeft(pass.until)} minutes left
        </p>
        <Link href="/" className="mt-2 inline-block text-sm font-semibold text-fg underline-offset-4 hover:underline">
          Browse VIP creators →
        </Link>
      </div>
    );
  }
  if (claim?.status === "pending") {
    return (
      <div className="rounded-2xl border border-gold/30 bg-gold/[0.07] p-5">
        <RefreshWhilePending />
        <p className="flex items-center gap-2 font-bold text-gold">
          <FiClock aria-hidden /> Your post is waiting for approval
        </p>
        <p className="mt-1 text-sm text-muted">Your VIP starts the next time you visit after it’s approved.</p>
      </div>
    );
  }
  if (claim?.status === "rejected") {
    return (
      <div className="rounded-2xl border border-rose/30 bg-rose/[0.07] p-5">
        <p className="flex items-center gap-2 font-bold text-[#ffb3cb]">
          <FiXCircle aria-hidden /> Your last post wasn’t approved
        </p>
        <p className="mt-1 text-sm text-muted">Make sure the post links to a free creator’s video using your own Share link.</p>
      </div>
    );
  }
  return null;
}

export default function RedditVipView({ viewer, isVip, pass, claim, usedToday, minutes, freeCreators, priceLabel }) {
  const waiting = claim?.status === "pending";
  return (
    <>
      <SiteHeader viewer={viewer} />
      <main className="mx-auto max-w-3xl px-4 pb-28 pt-12 sm:px-6">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-gold/40 bg-gold/10 px-3 py-1 text-sm font-bold text-gold">
          <FiGift aria-hidden /> Free VIP
        </span>
        <h1 className="mt-5 text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
          Get {minutes} minutes of VIP free
        </h1>
        <p className="mt-3 max-w-xl text-lg text-muted">
          Share a video from a free creator on Reddit, then paste your post here. No account needed.
        </p>

        {viewer?.isVip ? (
          <p className="mt-8 rounded-2xl border border-line bg-panel p-5">You already have VIP, so every creator is unlocked.</p>
        ) : (
          <div className="mt-8 space-y-6">
            <Status pass={pass} claim={claim} />

            <ol className="grid gap-3 sm:grid-cols-3">
              {[
                ["Share a video", "Open any free creator’s video and tap Share. Copy your link. It’s personal to you."],
                ["Post it on Reddit", "Put the link in a Reddit post. The post has to stay up."],
                ["Paste your post", "Copy your post’s link and paste it below. We check it right away."],
              ].map(([title, text], i) => (
                <li key={title} className="rounded-2xl border border-line bg-panel/80 p-4">
                  <span className="grid size-8 place-items-center rounded-full bg-gold/15 text-sm font-extrabold text-gold">{i + 1}</span>
                  <p className="mt-3 font-bold">{title}</p>
                  <p className="mt-1 text-sm text-muted">{text}</p>
                </li>
              ))}
            </ol>

            {freeCreators.length > 0 && (
              <div>
                <p className="text-sm font-semibold">Free creators to share from</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {freeCreators.map((c) => (
                    <Link
                      key={c.slug}
                      href={`/${c.slug}`}
                      className="rounded-full border border-line bg-panel px-3.5 py-1.5 text-sm font-semibold hover:border-muted"
                    >
                      {c.name}
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {!pass && !waiting && usedToday && (
              <p className="rounded-2xl border border-line bg-panel p-5 text-muted">
                You’ve used today’s free VIP. {usedToday.replace("You can earn free VIP once a day. ", "")}
              </p>
            )}
            {!pass && !waiting && !usedToday && (
              <div className="rounded-3xl border border-gold/25 bg-panel/80 p-5 sm:p-6">
                <RedditClaimForm />
              </div>
            )}

            <p className="text-sm text-muted">
              Once a day per person. Posts must be from the last 24 hours and link to a free creator’s video with your own
              Share link.
            </p>

            {!isVip && (
              <div className="flex flex-col items-start gap-2 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-muted">Rather not wait? Unlock everything for {priceLabel} a month.</p>
                <GetVipButton className="h-11 px-5 text-sm">Get VIP for {priceLabel}/month</GetVipButton>
              </div>
            )}
          </div>
        )}
      </main>
    </>
  );
}
