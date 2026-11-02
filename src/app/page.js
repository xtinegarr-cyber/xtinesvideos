import HomeView from "@/components/HomeView";
import { listCreators } from "@/lib/creators";
import { creatorCard } from "@/lib/cards";
import { getAccess, siteUrl } from "@/lib/session";
import { SITE_NAME } from "@/lib/site";
import { VIP_PRICE_LABEL } from "@/lib/vip";

export const dynamic = "force-dynamic";

const DESCRIPTION =
  "Watch free videos and photos from creators on XTINE’S VIDEOS. Unlock VIP creators for exclusive content.";

export async function generateMetadata() {
  const title = `${SITE_NAME} – Free & VIP Creator Videos`;
  return {
    title: {
      absolute: title, // don't append the layout default again
    },
    description: DESCRIPTION,
    alternates: { canonical: "/" },
    openGraph: {
      title,
      description: DESCRIPTION,
      url: "/",
      siteName: SITE_NAME,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: DESCRIPTION,
    },
  };
}

export default async function HomePage({ searchParams }) {
  const params = await searchParams;
  const search = typeof params?.q === "string" ? params.q.trim().slice(0, 80) : "";
  const access = await getAccess();
  const rows = await listCreators({ search });
  const now = Date.now();
  const cards = await Promise.all(rows.map((row) => creatorCard(row, access, now)));

  const site = await siteUrl();
  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        name: SITE_NAME,
        url: site,
        description: DESCRIPTION,
        potentialAction: {
          "@type": "SearchAction",
          target: {
            "@type": "EntryPoint",
            urlTemplate: `${site}/?q={search_term_string}`,
          },
          "query-input": "required name=search_term_string",
        },
      },
      {
        "@type": "Organization",
        name: SITE_NAME,
        url: site,
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, "\\u003c") }}
      />
      <HomeView
        viewer={access.viewer}
        isVip={access.isVip}
        search={search}
        free={cards.filter((c) => c.tier === "free")}
        vip={cards.filter((c) => c.tier === "vip")}
        priceLabel={VIP_PRICE_LABEL}
      />
    </>
  );
}
