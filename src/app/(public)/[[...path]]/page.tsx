import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublicPage } from "@/components/public-pages";
const titles: Record<string, string> = {
  profil: "Profil",
  divisi: "Divisi",
  berita: "Berita",
  announcement: "Announcement",
  galeri: "Galeri",
  buku: "Buku",
  kontak: "Kontak",
  peminjaman: "Peminjaman alat",
  or: "Open Recruitment",
  donasi: "Donasi",
  event: "Event",
  privasi: "Kebijakan privasi",
};
export async function generateMetadata({
  params,
}: {
  params: Promise<{ path?: string[] }>;
}): Promise<Metadata> {
  const { path = [] } = await params;
  return {
    title: titles[path[0]] || "WAPALA Telkom University",
    robots:
      path.includes("status") || path.includes("invoice") || path[0] === "or"
        ? { index: false, follow: false }
        : undefined,
  };
}
export default async function Page({ params }: { params: Promise<{ path?: string[] }> }) {
  const { path = [] } = await params;
  if (path.length && !(path[0] in titles)) notFound();
  return <PublicPage path={path} />;
}
