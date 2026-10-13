import type { Metadata } from "next";
import { PortalLogin } from "@/components/auth/portal-login";
export const metadata: Metadata = {
  title: "Portal organisasi",
  robots: { index: false, follow: false },
};
export default function LoginPage() {
  return <PortalLogin />;
}
