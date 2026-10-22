import Link from "next/link";
import { FiCheck, FiLock } from "react-icons/fi";
import SiteHeader from "./SiteHeader";
import { CheckoutButton, SignupForm } from "./VipForms";
import { FormNotice } from "./forms";

const PERKS = [
  "Every VIP creator’s profile, videos and photos",
  "New uploads as soon as they’re posted",
  "Cancel anytime from your account page",
];

export default function VipView({ viewer, priceLabel, configured }) {
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

        <section className="self-start rounded-3xl border border-gold/30 bg-panel p-6 sm:p-7">
          {viewer?.isVip ? (
            <div className="space-y-4">
              <h2 className="text-2xl font-extrabold">You have VIP</h2>
              <p className="text-muted">Every VIP creator is unlocked for you.</p>
              <div className="flex gap-2">
                <Link href="/" className="inline-flex h-11 items-center rounded-full bg-gold px-5 font-bold text-ink">
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
              <h2 className="text-2xl font-extrabold">{viewer ? `Get VIP, ${viewer.username}` : "Get VIP"}</h2>
              {!configured && <FormNotice message="VIP checkout isn't switched on yet. Check back soon." />}
              {viewer ? <CheckoutButton priceLabel={priceLabel} /> : <SignupForm priceLabel={priceLabel} />}
            </div>
          )}
        </section>
      </main>
    </>
  );
}
