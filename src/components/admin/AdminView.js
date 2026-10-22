import Link from "next/link";
import { FiTrash2 } from "react-icons/fi";
import SiteHeader from "../SiteHeader";
import CreatorImage from "../CreatorImage";
import UploadPanel from "./UploadPanel";
import { ChangePhotoButton, CreateCreatorForm } from "./CreatorForms";
import MemberForm from "./MemberForm";
import ConfirmButton from "./ConfirmButton";
import { deleteCreatorAction, deleteMemberAction, setTierAction } from "@/app/admin/actions";
import { formatDate, formatViews } from "@/lib/format";
import { VIP_PRICE_LABEL } from "@/lib/vip";

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

function memberStatus(m) {
  if (m.lifetime) return { label: "Active, no end date", tone: "text-[#9be4b8]" };
  if (m.active && m.cancelAtPeriodEnd) return { label: `Canceled, VIP until ${formatDate(m.vipUntil)}`, tone: "text-gold" };
  if (m.active) return { label: `Active until ${formatDate(m.vipUntil)}`, tone: "text-[#9be4b8]" };
  return { label: m.vipUntil ? `Ended ${formatDate(m.vipUntil)}` : "Never paid", tone: "text-muted" };
}

function MemberRow({ member }) {
  const status = memberStatus(member);
  return (
    <tr className="border-t border-line">
      <td className="py-3 pr-4 font-semibold">{member.username}</td>
      <td className={`py-3 pr-4 ${status.tone}`}>{status.label}</td>
      <td className="py-3 pr-4 text-muted">{member.viaStripe ? `Stripe, ${VIP_PRICE_LABEL}/month` : "Added by admin"}</td>
      <td className="py-3 pr-4 text-muted">{formatDate(member.createdAt)}</td>
      <td className="py-3 text-right">
        <form action={deleteMemberAction}>
          <input type="hidden" name="userId" value={member.id} />
          <ConfirmButton
            message={
              member.viaStripe && member.active && !member.cancelAtPeriodEnd
                ? `Remove ${member.username}? Their Stripe subscription will be canceled now.`
                : `Remove ${member.username}? They won't be able to log in anymore.`
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

export default function AdminView({ viewer, stats, creators, members, storageReady, stripeReady }) {
  const uploadCreators = creators.map(({ id, name, tier }) => ({ id, name, tier }));
  const activeMembers = members.filter((m) => m.active).length;

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
          description="Pick a creator, then drop files. Each one is optimized to load fast, gets a thumbnail, and appears on that creator’s page when it’s ready. Keep this tab open until uploads reach 100%."
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
          id="members-heading"
          title="VIP members"
          description={`${activeMembers} active. People who buy VIP appear here automatically. You can also add members yourself, for free or with an end date.`}
        >
          <MemberForm />
          <div className="mt-8 overflow-x-auto">
            {members.length ? (
              <table className="w-full min-w-[40rem] text-left text-sm">
                <thead className="text-muted">
                  <tr>
                    <th className="pb-2 pr-4 font-semibold">Username</th>
                    <th className="pb-2 pr-4 font-semibold">VIP</th>
                    <th className="pb-2 pr-4 font-semibold">How they joined</th>
                    <th className="pb-2 pr-4 font-semibold">Joined</th>
                    <th className="pb-2" />
                  </tr>
                </thead>
                <tbody>
                  {members.map((m) => (
                    <MemberRow key={m.id} member={m} />
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="py-2 text-muted">No VIP members yet.</p>
            )}
          </div>
        </Section>
      </main>
    </>
  );
}
