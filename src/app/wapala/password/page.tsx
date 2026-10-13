import { pageSession } from "@/server/auth/page-session";
import { csrfForSession } from "@/server/security/csrf";
import { PasswordChange } from "@/components/auth/password-change";
export const metadata = {
  title: "Perbarui password",
  robots: { index: false, follow: false },
};
export default async function Page() {
  const { token } = await pageSession(true);
  return <PasswordChange csrfToken={csrfForSession(token)} />;
}
