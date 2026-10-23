import Link from "next/link";
import { FiTrash2 } from "react-icons/fi";
import SiteHeader from "../SiteHeader";
import CreatorImage from "../CreatorImage";
import UploadPanel from "./UploadPanel";
import { ChangePhotoButton, CreateCreatorForm } from "./CreatorForms";
import MemberForm from "./MemberForm";
import ConfirmButton from "./ConfirmButton";
import CopyLink from "./CopyLink";
import { decideClaimAction, deleteCreatorAction, deleteMemberAction, setTierAction } from "@/app/admin/actions";
import { formatDate, formatViews } from "@/lib/format";
import { VIP_PRICE_LABEL } from "@/lib/vip";
import { PASS_MINUTES } from "@/lib/free-vip";

function Section({ id, title, description, children }) {
  return (
    <section aria-labelledby={id} className="rounded-3xl border border-line bg-panel p-5 sm:p-7">
      <h2 id={id} className="text-2xl font-extrabold tracking-tight">
        {title}
      </h2>
      {description && <p className="mt-1 max-w-2xl text-sm text-muted">{description}</p>}
      <div className="mt-6">{children}</div>
    </section>
  );
}

function Stat({ label, value }) {
  return (
    <div className="rounded-2xl border border-line bg-panel px-4 py-3">
      <p className="text-2xl font-extrabold tabular-nums">{value}</p>
      <p className="text-sm text-muted">{label}</p>
    </div>
  );
}

function SetupWarning({ storageReady, stripeReady }) {
  const missing = [];
  if (!storageReady) missing.push("R2 storage (uploads and profile pictures)");
  if (!stripeReady) missing.push("Stripe (VIP purchases)");
  if (!missing.length) return null;
  return (
    <p className="rounded-2xl border border-gold/30 bg-gold/[0.07] px-4 py-3 text-sm text-gold">
      Not connected yet: {missing.join(" and ")}. Add the environment variables from the README, then restart.
    </p>
  );
}

function CreatorRow({ creator, storageReady }) {
  const otherTier = creator.tier === "vip" ? "free" : "vip";
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-3 py-3.5">
      <div className="relative aspect-[3/4] w-12 shrink-0 overflow-hidden rounded-lg ring-1 ring-line">
        <CreatorImage name={creator.name} src={creator.imageUrl} className="absolute inset-0 [&_span]:text-base" />
      </div>
      <div className="min-w-0 flex-1 basis-40">
        <p className="flex items-center gap-2">
          <Link href={`/${creator.slug}`} className="truncate font-bold hover:underline">
            {creator.name}
          </Link>
          {creator.isNew && (
            <span className="rounded-full bg-rose px-2 py-0.5 text-[11px] font-bold leading-none text-white">New</span>
          )}
        </p>
        <p className="truncate text-xs text-muted">
          <span className="text-fg/70">/{creator.slug}</span>, added {formatDate(creator.createdAt)}, {creator.mediaCount} {creator.mediaCount === 1 ? "upload" : "uploads"}
        </p>
      </div>
      <div className="w-28 text-sm">
        <p className="font-semibold tabular-nums">{formatViews(creator.views)}</p>
        <p className="text-xs text-muted tabular-nums">{creator.views7d.toLocaleString()} this week</p>
      </div>
      <div className="flex w-44 items-center gap-2">
        <span
          className={`inline-flex h-7 items-center rounded-full border px-2.5 text-xs font-bold ${
            creator.tier === "vip" ? "border-gold/50 bg-gold/10 text-gold" : "border-line text-fg"
          }`}
        >
          {creator.tier === "vip" ? "VIP" : "Free"}
        </span>
        <form action={setTierAction}>
          <input type="hidden" name="creatorId" value={creator.id} />
          <input type="hidden" name="tier" value={otherTier} />
          <button type="submit" className="text-xs font-semibold text-muted underline-offset-4 hover:text-fg hover:underline">
            {otherTier === "vip" ? "Make VIP" : "Make free"}
          </button>
        </form>
      </div>
      <div className="flex items-center gap-2">
        <ChangePhotoButton creatorId={creator.id} disabled={!storageReady} />
        <form action={deleteCreatorAction}>
          <input type="hidden" name="creatorId" value={creator.id} />
          <ConfirmButton
            message={`Delete ${creator.name}, their profile and all ${creator.mediaCount} uploads? This can't be undone.`}
            aria-label={`Delete ${creator.name}`}
            pendingLabel="…"
            className="grid size-9 place-items-center rounded-full border border-line text-muted hover:border-rose hover:text-rose"
          >
            <FiTrash2 aria-hidden />
          </ConfirmButton>
        </form>
      </div>
    </li>
  );
}

const STOPPED = new Set(["canceled", "unpaid", "incomplete_expired", "past_due", "incomplete"]);

/** Paying members whose payments stopped but who still have VIP. */
function needsReview(m) {
  return m.active && m.viaStripe && (STOPPED.has(m.stripeStatus) || m.cancelAtPeriodEnd);
}

function vipLabel(m) {
  if (m.lifetime) return { label: "Has VIP", tone: "text-[#9be4b8]" };
  if (m.active) return { label: `Until ${formatDate(m.vipUntil)}`, tone: "text-[#9be4b8]" };
  return { label: m.vipUntil ? `Ended ${formatDate(m.vipUntil)}` : "No VIP", tone: "text-muted" };
}

function paymentLabel(m) {
  if (!m.viaStripe) return "Added by admin";
  if (m.stripeStatus === "past_due" || m.stripeStatus === "unpaid") return "Payment failing";
  if (m.stripeStatus === "canceled" || m.stripeStatus === "incomplete_expired") return "Subscription canceled";
  if (m.cancelAtPeriodEnd) return "Canceled, ends this month";
  if (m.stripeStatus === "active" || m.stripeStatus === "trialing") return `Paying ${VIP_PRICE_LABEL}/month`;
  return m.stripeStatus || "Stripe";
}

function MemberRow({ member }) {
  const vip = vipLabel(member);
  const review = needsReview(member);
  const subscriptionLive = member.viaStripe && !STOPPED.has(member.stripeStatus) && !member.cancelAtPeriodEnd;
  return (
    <tr className={`border-t border-line ${review ? "bg-gold/[0.06]" : ""}`}>
      <td className="max-w-[16rem] truncate py-3 pl-2 pr-4 font-semibold">{member.login}</td>
      <td className={`py-3 pr-4 ${vip.tone}`}>{vip.label}</td>
      <td className="py-3 pr-4">
        <span className={review ? "font-semibold text-gold" : "text-muted"}>{paymentLabel(member)}</span>
        {review && (
          <span className="ml-2 rounded-full bg-gold/15 px-2 py-0.5 text-[11px] font-bold text-gold">Review</span>
        )}
      </td>
      <td className="py-3 pr-4 text-muted">{formatDate(member.createdAt)}</td>
      <td className="py-3 pr-2 text-right">
        <form action={deleteMemberAction}>
          <input type="hidden" name="userId" value={member.id} />
          <ConfirmButton
            message={
              subscriptionLive
                ? `Remove ${member.login}? Their account is deleted and their Stripe subscription is canceled now.`
                : `Remove ${member.login}? Their account is deleted and they lose VIP.`
            }
            pendingLabel="Removing…"
            className="text-sm font-semibold text-muted hover:text-rose"
          >
            Remove
          </ConfirmButton>
        </form>
      </td>
    </tr>
  );
}

function PendingCheckouts({ checkouts }) {
  if (!checkouts.length) return null;
  return (
    <div className="mt-8 rounded-2xl border border-gold/25 bg-gold/[0.05] p-4">
      <h3 className="font-bold">Paid, but haven’t created their login yet</h3>
      <p className="mt-1 text-sm text-muted">
        If someone closed the page after paying, send them their link. It lets them create their account once.
      </p>
      <ul className="mt-4 space-y-3">
        {checkouts.map((c) => (
          <li key={c.sessionId} className="grid gap-2 text-sm sm:grid-cols-[minmax(0,14rem)_7rem_1fr] sm:items-center">
            <span className="truncate font-semibold">{c.email || "No email"}</span>
            <span className="text-muted">Paid {formatDate(c.createdAt)}</span>
            <CopyLink url={c.setupUrl} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function formatWhen(iso) {
  // The server runs on UTC; show times in your own time zone.
  return new Date(iso).toLocaleString("en-US", {
    timeZone: process.env.ADMIN_TIMEZONE || "America/Chicago",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function RedditClaims({ claims, apiConfigured }) {
  const { pending = [], recent = [] } = claims;
  return (
    <>
      <p className="text-sm text-muted">
        {apiConfigured
          ? "Posts are checked automatically with your Reddit app. Anything Reddit wouldn’t answer for lands here."
          : "Without a Reddit app (REDDIT_CLIENT_ID and REDDIT_CLIENT_SECRET) posts are checked through Reddit’s public data when Reddit allows it. Anything it blocks lands here."}
      </p>
      <h3 className="mt-6 font-bold">Waiting for you ({pending.length})</h3>
      {pending.length ? (
        <ul className="mt-3 divide-y divide-line rounded-2xl border border-line">
          {pending.map((c) => (
            <li key={c.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1 text-sm">
                <a href={c.postUrl} target="_blank" rel="noopener noreferrer" className="block truncate font-semibold text-gold underline-offset-2 hover:underline">
                  {c.postUrl}
                </a>
                <p className="mt-1 text-muted">
                  Check the post is up and links to a free creator’s video ending in{" "}
                  <span className="rounded bg-raised px-1.5 py-0.5 font-mono text-fg">?r={c.code}</span>. Sent {formatWhen(c.createdAt)}.
                </p>
              </div>
              <div className="flex gap-2">
                <form action={decideClaimAction}>
                  <input type="hidden" name="claimId" value={c.id} />
                  <input type="hidden" name="decision" value="approve" />
                  <button type="submit" className="btn-vip h-10 px-4 text-sm">Approve</button>
                </form>
                <form action={decideClaimAction}>
                  <input type="hidden" name="claimId" value={c.id} />
                  <input type="hidden" name="decision" value="reject" />
                  <button type="submit" className="inline-flex h-10 items-center rounded-full border border-line px-4 text-sm font-semibold hover:border-rose hover:text-[#ffb3cb]">
                    Reject
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-muted">Nothing waiting.</p>
      )}
      {recent.length > 0 && (
        <>
          <h3 className="mt-6 font-bold">Recent</h3>
          <ul className="mt-2 space-y-1.5 text-sm">
            {recent.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                    c.status === "approved" ? "bg-[#9be4b8]/15 text-[#9be4b8]" : "bg-rose/15 text-[#ffb3cb]"
                  }`}
                >
                  {c.status === "approved" ? "Approved" : "Rejected"}
                </span>
                <a href={c.postUrl} target="_blank" rel="noopener noreferrer" className="truncate text-muted underline-offset-2 hover:text-fg hover:underline">
                  {c.author ? `u/${c.author}` : c.postUrl}
                </a>
                <span className="text-muted/70">{formatWhen(c.createdAt)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}

export default function AdminView({
  viewer,
  stats,
  creators,
  members,
  pendingCheckouts = [],
  redditClaims = { pending: [], recent: [] },
  redditApi = false,
  storageReady,
  stripeReady,
}) {
  const uploadCreators = creators.map(({ id, name, tier }) => ({ id, name, tier }));
  const activeMembers = members.filter((m) => m.active).length;
  const toReview = members.filter(needsReview).length;
  // People to review first, then everyone else newest first.
  const sortedMembers = [...members].sort((a, b) => Number(needsReview(b)) - Number(needsReview(a)));

  return (
    <>
      <SiteHeader viewer={viewer} />
      <main className="mx-auto max-w-6xl space-y-8 px-4 pb-24 pt-8 sm:px-6">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight">Admin panel</h1>
          <p className="mt-1 text-muted">Logged in as {viewer.username}.</p>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <Stat label="Creators" value={stats.creators} />
          <Stat label="Total views" value={Number(stats.views).toLocaleString()} />
          <Stat label="Views this week" value={stats.views_7d.toLocaleString()} />
          <Stat label="Uploads" value={stats.media} />
          <Stat label="Active VIP members" value={stats.vip_members} />
        </div>

        <SetupWarning storageReady={storageReady} stripeReady={stripeReady} />

        <Section
          id="upload-heading"
          title="Upload videos and photos"
          description="Pick a creator, drop files, then pick another creator and drop more. Everything goes into one line and uploads in order. Each file is optimized to load fast, gets a thumbnail, and appears on the creator’s page when it’s ready. Keep this tab open until everything is sent; processing finishes on the server."
        >
          <UploadPanel creators={uploadCreators} storageReady={storageReady} />
        </Section>

        <Section
          id="creators-heading"
          title="Creators"
          description="Add creators your team has approved on Discord. VIP creators show blurred to everyone without VIP."
        >
          <CreateCreatorForm storageReady={storageReady} />
          <div className="mt-8 border-t border-line pt-2">
            {creators.length ? (
              <ul className="divide-y divide-line">
                {creators.map((c) => (
                  <CreatorRow key={c.id} creator={c} storageReady={storageReady} />
                ))}
              </ul>
            ) : (
              <p className="py-6 text-muted">No creators yet. Create the first one above.</p>
            )}
          </div>
        </Section>

        <Section
          id="reddit-heading"
          title={`Free VIP from Reddit${redditClaims.pending.length ? ` (${redditClaims.pending.length} waiting)` : ""}`}
          description={`Visitors who shared a free creator’s video on Reddit get ${PASS_MINUTES} minutes of VIP, once a day. No account needed: it’s tied to their browser.`}
        >
          <RedditClaims claims={redditClaims} apiConfigured={redditApi} />
        </Section>

        <Section
          id="members-heading"
          title="VIP members"
          description={`${activeMembers} with VIP${toReview ? `, ${toReview} to review (their payment stopped but they still have VIP)` : ""}. Buyers appear here automatically and keep VIP until you remove them. You can also add members yourself, with or without an end date.`}
        >
          <MemberForm />
          <div className="mt-8 overflow-x-auto">
            {members.length ? (
              <table className="w-full min-w-[40rem] text-left text-sm">
                <thead className="text-muted">
                  <tr>
                    <th className="pb-2 pl-2 pr-4 font-semibold">Email or username</th>
                    <th className="pb-2 pr-4 font-semibold">VIP</th>
                    <th className="pb-2 pr-4 font-semibold">Payment</th>
                    <th className="pb-2 pr-4 font-semibold">Joined</th>
                    <th className="pb-2" />
                  </tr>
                </thead>
                <tbody>
                  {sortedMembers.map((m) => (
                    <MemberRow key={m.id} member={m} />
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="py-2 text-muted">No VIP members yet.</p>
            )}
          </div>
          <PendingCheckouts checkouts={pendingCheckouts} />
        </Section>
      </main>
    </>
  );
}
