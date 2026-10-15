import type { Metadata } from "next";
import "@fontsource/manrope/400.css";
import "@fontsource/manrope/500.css";
import "@fontsource/manrope/600.css";
import "@fontsource/manrope/700.css";
import "@fontsource/barlow-condensed/600.css";
import "@fontsource/barlow-condensed/700.css";
import "./globals.css";
import "./polish.css";
import "./event.css";
import "../components/backend/inventory.css";
import { Providers } from "@/components/providers";
import { emptyState } from "@/lib/empty-state";
import { headers } from "next/headers";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
  ),
  title: { default: "WAPALA Telkom University", template: "%s | WAPALA" },
  description:
    "Wahana Pencinta Alam Telkom University. Cerita perjalanan, kegiatan, dan ruang belajar bersama.",
  openGraph: {
    type: "website",
    locale: "id_ID",
    title: "WAPALA Telkom University",
  },
};
export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const nonce = (await headers()).get("x-nonce") || "";
  return (
    <html lang="id" suppressHydrationWarning>
      <body>
        <Providers initialState={emptyState()} nonce={nonce}>
          {children}
        </Providers>
      </body>
    </html>
  );
}
