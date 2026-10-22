import { redirect } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import LoginForm from "@/components/LoginForm";
import { getViewer } from "@/lib/session";
import { SITE_NAME } from "@/lib/site";
import { safeNextPath } from "@/lib/vip";

export const dynamic = "force-dynamic";
export const metadata = { title: `Log in – ${SITE_NAME}` };

export default async function LoginPage({ searchParams }) {
  const params = await searchParams;
  const next = safeNextPath(typeof params?.next === "string" ? params.next : "", "");
  const viewer = await getViewer();
  if (viewer) redirect(next || (viewer.isAdmin ? "/admin" : "/"));

  return (
    <>
      <SiteHeader viewer={null} />
      <main className="mx-auto max-w-sm px-4 pb-24 pt-14">
        <h1 className="text-4xl font-extrabold tracking-tight">Log in</h1>
        <p className="mt-2 text-muted">For VIP members and the admin team.</p>
        <div className="mt-8 rounded-3xl border border-line bg-panel p-6">
          <LoginForm next={next} />
        </div>
      </main>
    </>
  );
}
