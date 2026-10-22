import Link from "next/link";
import { FiCheck, FiLock } from "react-icons/fi";
import SiteHeader from "./SiteHeader";
import { GetVipButton } from "./VipForms";
import { FormError, FormNotice } from "./forms";

const PERKS = [
  "Every VIP creator’s profile, videos and photos",
  "New uploads as soon as they’re posted",
  "Cancel anytime from your account page",
];

const ERRORS = {
  checkout: "Checkout couldn’t open. Try again in a moment.",
  setup: "VIP checkout isn’t switched on yet. Check back soon.",
};

export default function VipView({ viewer, priceLabel, configured, error }) {
  return (
    <>
      <SiteHeader viewer={viewer} />
      <main className="mx-auto grid max-w-5xl gap-10 px-4 pb-24 pt-12 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:pt-20">
        <section>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-gold/40 bg-gold/10 px-3 py-1 text-sm font-bold text-gold">
            <FiLock aria-hidden /> VIP
          </span>
          <h1 className="mt-5 text-5xl font-extrabold leading-[0.95] tracking-tight sm:text-6xl">
            Unlock every
            <br />
            VIP creator.
          </h1>
          <p className="mt-6 flex items-baseline gap-2">
            <span className="text-5xl font-extrabold text-gold">{priceLabel}</span>
            <span className="text-lg text-muted">a month</span>
          </p>
          <ul className="mt-8 space-y-3">
            {PERKS.map((perk) => (
              <li key={perk} className="flex items-start gap-3">
                <FiCheck aria-hidden className="mt-1 size-5 shrink-0 text-gold" />
                <span>{perk}</span>
              </li>
            ))}
          </ul>
          <p className="mt-8 text-sm text-muted">Payments are handled by Stripe. We never see your card details.</p>
        </section>

        <section className="self-start rounded-3xl border border-gold/25 bg-panel/80 p-6 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.8)] sm:p-7">
          {viewer?.isVip ? (
            <div className="space-y-4">
              <h2 className="text-2xl font-extrabold">You have VIP</h2>
              <p className="text-muted">Every VIP creator is unlocked for you.</p>
              <div className="flex gap-2">
                <Link href="/" className="btn-vip h-11 px-5">
                  Browse creators
                </Link>
                {!viewer.isAdmin && (
                  <Link href="/account" className="inline-flex h-11 items-center rounded-full border border-line px-5 font-semibold">
                    Your account
                  </Link>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              <h2 className="text-2xl font-extrabold">Get VIP</h2>
              <ol className="space-y-2 text-sm text-muted">
                <li>
                  <span className="font-semibold text-fg">1.</span> Pay {priceLabel}/month securely on Stripe.
                </li>
                <li>
                  <span className="font-semibold text-fg">2.</span>{" "}
                  {viewer
                    ? `VIP is added to your account (${viewer.username}).`
                    : "Create your login with your email and a password."}
                </li>
                <li>
                  <span className="font-semibold text-fg">3.</span> Every VIP creator unlocks right away.
                </li>
              </ol>
              {!configured && <FormNotice message={ERRORS.setup} />}
              {configured && <FormError message={ERRORS[error]} />}
              <GetVipButton className="h-12 w-full px-6">Get VIP for {priceLabel}/month</GetVipButton>
              {!viewer && (
                <p className="text-center text-sm text-muted">
                  Already VIP?{" "}
                  <Link href="/login?next=/" className="font-semibold text-fg underline-offset-4 hover:underline">
                    Log in
                  </Link>
                </p>
              )}
            </div>
          )}
        </section>
      </main>
    </>
  );
}
