import { DataProvider } from "@/lib/store";
import { emptyState } from "@/lib/empty-state";
import { brandLogoUrl } from "@/server/public-data";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const state = emptyState();
  state.settings.logoUrl = await brandLogoUrl();
  return <DataProvider state={state}>{children}</DataProvider>;
}
