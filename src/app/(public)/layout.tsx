import { Header, Footer } from "@/components/shell";
import { PageMotion } from "@/components/motion";
import { DataProvider } from "@/lib/store";
import { publicState } from "@/server/public-data";
export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const state = await publicState();
  const content = (
    <>
      <Header />
      <PageMotion />
      <main id="main">{children}</main>
      <Footer />
    </>
  );
  return <DataProvider state={state}>{content}</DataProvider>;
}
