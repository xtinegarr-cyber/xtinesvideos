import { Bricolage_Grotesque } from "next/font/google";
import { getAccess } from "@/lib/session";
import VipPopup from "@/components/VipPopup";
import SiteBackdrop from "@/components/SiteBackdrop";
import VipPassBar from "@/components/VipPassBar";
import { VIP_PRICE_LABEL } from "@/lib/vip";
import "./globals.css";

const brand = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-brand",
  display: "swap",
});

export const metadata = {
  // Lets pages give search engines their full address (e.g. canonical links).
  metadataBase: process.env.SITE_URL ? new URL(process.env.SITE_URL) : undefined,
  title: "XTINE’S VIDEOS",
  description: "Watch videos and photos from free and VIP creators.",
};

export const viewport = {
  themeColor: "#0d1328",
};

export default async function RootLayout({ children }) {
  const access = await getAccess();
  return (
    <html lang="en" className={brand.variable}>
      <body className="min-h-dvh">
        <SiteBackdrop />
        {children}
        {!access.isVip && <VipPopup priceLabel={VIP_PRICE_LABEL} />}
        {access.pass && <VipPassBar until={access.pass.until.toISOString()} />}
      </body>
    </html>
  );
}
