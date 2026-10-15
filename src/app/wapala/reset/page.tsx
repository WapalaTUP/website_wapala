import { PasswordReset } from "@/components/auth/password-reset";
export const metadata = {
  title: "Pemulihan akses",
  robots: { index: false, follow: false },
  referrer: "no-referrer" as const,
};
export default function Page() {
  return <PasswordReset />;
}
