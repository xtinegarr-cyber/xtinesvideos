import { Bricolage_Grotesque } from "next/font/google";
import { getViewer } from "@/lib/session";
import VipPopup from "@/components/VipPopup";
import SiteBackdrop from "@/components/SiteBackdrop";
import { VIP_PRICE_LABEL } from "@/lib/vip";
import "./globals.css";

const brand = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-brand",
  display: "swap",
});

export const metadata = {
  title: "XTINE’S VIDEOS",
  description: "Free and VIP creators.",
};

export const viewport = {
  themeColor: "#0d1328",
};

export default async function RootLayout({ children }) {
  const viewer = await getViewer();
  return (
    <html lang="en" className={brand.variable}>
      <body className="min-h-dvh">
        <SiteBackdrop />
        {children}
        {!viewer?.isVip && <VipPopup priceLabel={VIP_PRICE_LABEL} />}
      </body>
    </html>
  );
}
