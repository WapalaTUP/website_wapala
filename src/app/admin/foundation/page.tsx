import { redirect } from "next/navigation";
export const metadata = {
  title: "Portal organisasi",
  robots: { index: false, follow: false },
};
export default async function Page() {
  redirect("/admin");
}
